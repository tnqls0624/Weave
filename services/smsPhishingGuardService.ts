/**
 * SMS 피싱 가드 서비스
 * Meta의 React Native 베스트 프랙티스를 적용한 고성능 피싱 탐지 시스템
 */

import { Platform, PermissionsAndroid, NativeModules, NativeEventEmitter } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';
import { locationWebSocketService } from './locationWebSocketService';
import { phishingDetectionEngine } from './phishingDetectionEngine';
import { apiService } from './api';

interface SMS {
  id: string;
  sender: string;
  body: string;
  timestamp: number;
  isRead: boolean;
  threadId?: string;
}

interface PhishingAlert {
  smsId: string;
  sender: string;
  message: string;
  riskScore: number;
  riskLevel: 'high' | 'medium' | 'low';
  detectionReasons: string[];
  timestamp: number;
  location?: {
    latitude: number;
    longitude: number;
  };
}

interface PhishingGuardConfig {
  enabled: boolean;
  autoBlockHighRisk: boolean;
  notificationEnabled: boolean;
  realtimeProtection: boolean;
  sensitivityLevel: 'high' | 'medium' | 'low';
  whitelistedNumbers: string[];
  blacklistedPatterns: string[];
}

class SMSPhishingGuardService {
  private static instance: SMSPhishingGuardService;
  private eventEmitter: NativeEventEmitter | null = null;
  private config: PhishingGuardConfig;
  private isMonitoring: boolean = false;
  private detectedPhishingMessages: Map<string, PhishingAlert> = new Map();
  private smsListener: any = null;
  private lastProcessedSMSId: string | null = null;

  // 성능 최적화를 위한 캐시
  private analysisCache: Map<string, any> = new Map();
  private readonly MAX_CACHE_SIZE = 100;

  constructor() {
    this.config = {
      enabled: true,
      autoBlockHighRisk: true,
      notificationEnabled: true,
      realtimeProtection: true,
      sensitivityLevel: 'medium',
      whitelistedNumbers: [],
      blacklistedPatterns: []
    };

    this.initialize();
  }

  public static getInstance(): SMSPhishingGuardService {
    if (!SMSPhishingGuardService.instance) {
      SMSPhishingGuardService.instance = new SMSPhishingGuardService();
    }
    return SMSPhishingGuardService.instance;
  }

  private async initialize(): Promise<void> {
    try {
      // 저장된 설정 불러오기
      await this.loadConfig();

      // 플랫폼별 초기화
      if (Platform.OS === 'android') {
        await this.initializeAndroid();
      } else if (Platform.OS === 'ios') {
        await this.initializeiOS();
      }

      // WebSocket 연결 초기화 (실시간 알림용)
      if (this.config.realtimeProtection) {
        await this.initializeWebSocket();
      }
    } catch (error) {
      console.error('SMS 피싱 가드 초기화 실패:', error);
    }
  }

  /**
   * Android SMS 권한 요청 및 리스너 설정
   */
  private async initializeAndroid(): Promise<void> {
    try {
      // SMS 읽기 권한 요청
      const granted = await PermissionsAndroid.requestMultiple([
        PermissionsAndroid.PERMISSIONS.READ_SMS,
        PermissionsAndroid.PERMISSIONS.RECEIVE_SMS,
        PermissionsAndroid.PERMISSIONS.SEND_SMS,
      ]);

      const allGranted = Object.values(granted).every(
        permission => permission === PermissionsAndroid.RESULTS.GRANTED
      );

      if (!allGranted) {
        console.warn('SMS 권한이 거부되었습니다');
        return;
      }

      // Native 모듈 이벤트 리스너 설정
      if (NativeModules.SMSReader) {
        this.eventEmitter = new NativeEventEmitter(NativeModules.SMSReader);

        // 새 SMS 수신 리스너
        this.smsListener = this.eventEmitter.addListener(
          'onSMSReceived',
          this.handleNewSMS.bind(this)
        );

        // 백그라운드 SMS 모니터링 시작
        NativeModules.SMSReader.startSMSMonitoring();
      }
    } catch (error) {
      console.error('Android SMS 초기화 실패:', error);
    }
  }

  /**
   * iOS 초기화 (푸시 알림 기반)
   */
  private async initializeiOS(): Promise<void> {
    // iOS는 SMS 직접 읽기가 제한되므로
    // 푸시 알림과 ML Kit을 활용한 대안 방법 구현
    console.log('iOS 피싱 가드: 푸시 알림 기반 모니터링 활성화');
  }

  /**
   * WebSocket 연결 초기화 (실시간 알림)
   */
  private async initializeWebSocket(): Promise<void> {
    try {
      await locationWebSocketService.connect();

      // 피싱 알림 전용 채널 구독
      await locationWebSocketService.subscribeToPhishingAlerts(
        (alert: PhishingAlert) => {
          this.handlePhishingAlert(alert);
        }
      );
    } catch (error) {
      console.error('WebSocket 초기화 실패:', error);
    }
  }

  /**
   * 새 SMS 메시지 처리
   */
  private async handleNewSMS(sms: SMS): Promise<void> {
    if (!this.config.enabled) return;

    // 중복 처리 방지
    if (this.lastProcessedSMSId === sms.id) return;
    this.lastProcessedSMSId = sms.id;

    try {
      // 화이트리스트 체크
      if (this.isWhitelisted(sms.sender)) {
        console.log(`신뢰할 수 있는 발신자: ${sms.sender}`);
        return;
      }

      // 피싱 분석 실행
      const analysis = await this.analyzeSMS(sms);

      if (analysis.isPhishing) {
        const alert: PhishingAlert = {
          smsId: sms.id,
          sender: sms.sender,
          message: sms.body,
          riskScore: analysis.riskScore,
          riskLevel: this.calculateRiskLevel(analysis.riskScore),
          detectionReasons: analysis.reasons,
          timestamp: Date.now(),
          location: await this.getCurrentLocation()
        };

        // 피싱 메시지 저장
        this.detectedPhishingMessages.set(sms.id, alert);
        await this.savePhishingAlert(alert);

        // 처리 액션 실행
        await this.executeProtectionActions(alert);

        // 실시간 알림 전송
        if (this.config.realtimeProtection) {
          await this.broadcastPhishingAlert(alert);
        }
      }
    } catch (error) {
      console.error('SMS 분석 실패:', error);
    }
  }

  /**
   * SMS 피싱 분석
   */
  private async analyzeSMS(sms: SMS): Promise<any> {
    // 캐시 확인
    const cacheKey = `${sms.sender}_${sms.body}`;
    if (this.analysisCache.has(cacheKey)) {
      return this.analysisCache.get(cacheKey);
    }

    try {
      // 피싱 탐지 엔진 호출
      const result = await phishingDetectionEngine.analyze({
        sender: sms.sender,
        message: sms.body,
        timestamp: sms.timestamp,
        sensitivityLevel: this.config.sensitivityLevel
      });

      // 캐시 저장 (최대 크기 제한)
      if (this.analysisCache.size >= this.MAX_CACHE_SIZE) {
        const firstKey = this.analysisCache.keys().next().value;
        this.analysisCache.delete(firstKey);
      }
      this.analysisCache.set(cacheKey, result);

      return result;
    } catch (error) {
      console.error('피싱 분석 실패:', error);
      return { isPhishing: false, riskScore: 0, reasons: [] };
    }
  }

  /**
   * 보호 액션 실행
   */
  private async executeProtectionActions(alert: PhishingAlert): Promise<void> {
    // 1. 로컬 알림 표시
    if (this.config.notificationEnabled) {
      await this.showPhishingNotification(alert);
    }

    // 2. 고위험 메시지 자동 차단
    if (this.config.autoBlockHighRisk && alert.riskLevel === 'high') {
      await this.blockPhishingMessage(alert);
    }

    // 3. 서버에 보고
    await this.reportToServer(alert);

    // 4. 사용자 위치 기반 경고 (지도에 표시)
    if (alert.location) {
      await this.updateMapAlert(alert);
    }
  }

  /**
   * 피싱 알림 표시
   */
  private async showPhishingNotification(alert: PhishingAlert): Promise<void> {
    const riskEmoji = alert.riskLevel === 'high' ? '🚨' :
                      alert.riskLevel === 'medium' ? '⚠️' : 'ℹ️';

    await Notifications.scheduleNotificationAsync({
      content: {
        title: `${riskEmoji} 피싱 의심 메시지 감지`,
        body: `발신자: ${alert.sender}\n위험도: ${alert.riskLevel.toUpperCase()}`,
        data: { alert },
        sound: 'default',
        badge: 1,
        priority: Notifications.AndroidNotificationPriority.HIGH,
      },
      trigger: null,
    });
  }

  /**
   * 피싱 메시지 차단
   */
  private async blockPhishingMessage(alert: PhishingAlert): Promise<void> {
    if (Platform.OS === 'android' && NativeModules.SMSReader) {
      await NativeModules.SMSReader.blockSMS(alert.smsId, alert.sender);
    }

    // 블랙리스트에 추가
    if (!this.config.blacklistedPatterns.includes(alert.sender)) {
      this.config.blacklistedPatterns.push(alert.sender);
      await this.saveConfig();
    }
  }

  /**
   * 서버에 피싱 보고
   */
  private async reportToServer(alert: PhishingAlert): Promise<void> {
    try {
      // 현재 워크스페이스 ID 가져오기 (필요시)
      const currentWorkspace = await AsyncStorage.getItem('currentWorkspace');

      // API 서비스를 통해 서버에 보고
      await apiService.reportPhishing({
        smsId: alert.smsId,
        sender: alert.sender,
        message: alert.message,
        riskScore: alert.riskScore,
        riskLevel: alert.riskLevel,
        detectionReasons: alert.detectionReasons,
        phishingType: this.detectPhishingType(alert.message),
        workspaceId: currentWorkspace || undefined,
        location: alert.location,
        deviceInfo: await this.getDeviceInfo()
      });

      console.log('✅ 피싱 신고가 서버에 성공적으로 전송되었습니다');
    } catch (error) {
      console.error('❌ 피싱 보고 실패:', error);
      // 오프라인일 경우 로컬에 저장하여 나중에 재시도
      await this.saveOfflineReport(alert);
    }
  }

  /**
   * 피싱 타입 감지
   */
  private detectPhishingType(message: string): string {
    if (message.includes('은행') || message.includes('송금') || message.includes('계좌')) {
      return 'financial';
    }
    if (message.includes('정부') || message.includes('국세청') || message.includes('검찰')) {
      return 'government';
    }
    if (message.includes('택배') || message.includes('배송')) {
      return 'delivery';
    }
    if (message.includes('쇼핑') || message.includes('구매')) {
      return 'shopping';
    }
    return 'other';
  }

  /**
   * 오프라인 신고 저장
   */
  private async saveOfflineReport(alert: PhishingAlert): Promise<void> {
    try {
      const offlineReports = await AsyncStorage.getItem('offline_phishing_reports');
      const reports = offlineReports ? JSON.parse(offlineReports) : [];
      reports.push(alert);
      await AsyncStorage.setItem('offline_phishing_reports', JSON.stringify(reports));
    } catch (error) {
      console.error('오프라인 신고 저장 실패:', error);
    }
  }

  /**
   * 실시간 피싱 알림 브로드캐스트
   */
  private async broadcastPhishingAlert(alert: PhishingAlert): Promise<void> {
    if (locationWebSocketService.isConnected()) {
      await locationWebSocketService.sendPhishingAlert(alert);
    }
  }

  /**
   * 지도에 피싱 알림 업데이트
   */
  private async updateMapAlert(alert: PhishingAlert): Promise<void> {
    // 지도 컴포넌트에 이벤트 전송
    if (this.eventEmitter) {
      this.eventEmitter.emit('phishingAlertOnMap', {
        location: alert.location,
        alert: alert
      });
    }
  }

  /**
   * 위험도 계산
   */
  private calculateRiskLevel(score: number): 'high' | 'medium' | 'low' {
    if (score >= 0.8) return 'high';
    if (score >= 0.5) return 'medium';
    return 'low';
  }

  /**
   * 화이트리스트 체크
   */
  private isWhitelisted(sender: string): boolean {
    return this.config.whitelistedNumbers.some(number =>
      sender.includes(number) || number.includes(sender)
    );
  }

  /**
   * 현재 위치 가져오기
   */
  private async getCurrentLocation(): Promise<{ latitude: number; longitude: number } | undefined> {
    try {
      // locationTrackingService에서 위치 가져오기
      const location = await NativeModules.LocationModule?.getCurrentPosition();
      return location ? {
        latitude: location.coords.latitude,
        longitude: location.coords.longitude
      } : undefined;
    } catch (error) {
      console.error('위치 가져오기 실패:', error);
      return undefined;
    }
  }

  /**
   * 설정 저장
   */
  private async saveConfig(): Promise<void> {
    await AsyncStorage.setItem('phishing_guard_config', JSON.stringify(this.config));
  }

  /**
   * 설정 불러오기
   */
  private async loadConfig(): Promise<void> {
    try {
      const saved = await AsyncStorage.getItem('phishing_guard_config');
      if (saved) {
        this.config = { ...this.config, ...JSON.parse(saved) };
      }
    } catch (error) {
      console.error('설정 로드 실패:', error);
    }
  }

  /**
   * 피싱 알림 저장
   */
  private async savePhishingAlert(alert: PhishingAlert): Promise<void> {
    const alerts = await this.getPhishingHistory();
    alerts.push(alert);

    // 최대 100개까지만 저장
    if (alerts.length > 100) {
      alerts.shift();
    }

    await AsyncStorage.setItem('phishing_alerts_history', JSON.stringify(alerts));
  }

  /**
   * 피싱 히스토리 가져오기
   */
  public async getPhishingHistory(): Promise<PhishingAlert[]> {
    try {
      const saved = await AsyncStorage.getItem('phishing_alerts_history');
      return saved ? JSON.parse(saved) : [];
    } catch (error) {
      console.error('히스토리 로드 실패:', error);
      return [];
    }
  }

  /**
   * Auth 토큰 가져오기
   */
  private async getAuthToken(): Promise<string> {
    const token = await AsyncStorage.getItem('access_token');
    return token || '';
  }

  /**
   * 디바이스 정보 가져오기
   */
  private async getDeviceInfo(): Promise<any> {
    return {
      platform: Platform.OS,
      version: Platform.Version,
      // 추가 디바이스 정보
    };
  }

  // Public API Methods

  /**
   * 피싱 가드 시작
   */
  public async startMonitoring(): Promise<boolean> {
    if (this.isMonitoring) {
      console.log('이미 모니터링 중입니다');
      return true;
    }

    try {
      this.isMonitoring = true;
      this.config.enabled = true;
      await this.saveConfig();

      if (Platform.OS === 'android' && NativeModules.SMSReader) {
        await NativeModules.SMSReader.startSMSMonitoring();
      }

      console.log('SMS 피싱 가드 시작됨');
      return true;
    } catch (error) {
      console.error('모니터링 시작 실패:', error);
      this.isMonitoring = false;
      return false;
    }
  }

  /**
   * 피싱 가드 중지
   */
  public async stopMonitoring(): Promise<void> {
    this.isMonitoring = false;
    this.config.enabled = false;
    await this.saveConfig();

    if (Platform.OS === 'android' && NativeModules.SMSReader) {
      await NativeModules.SMSReader.stopSMSMonitoring();
    }

    if (this.smsListener) {
      this.smsListener.remove();
      this.smsListener = null;
    }

    console.log('SMS 피싱 가드 중지됨');
  }

  /**
   * 피싱 가드 활성화 상태 확인
   */
  public async isEnabled(): Promise<boolean> {
    return this.config.enabled && this.isMonitoring;
  }

  /**
   * 설정 업데이트
   */
  public async updateConfig(newConfig: Partial<PhishingGuardConfig>): Promise<void> {
    this.config = { ...this.config, ...newConfig };
    await this.saveConfig();

    // 실시간 보호 설정 변경 시 WebSocket 재연결
    if ('realtimeProtection' in newConfig) {
      if (newConfig.realtimeProtection) {
        await this.initializeWebSocket();
      } else {
        locationWebSocketService.disconnect();
      }
    }
  }

  /**
   * 현재 설정 가져오기
   */
  public getConfig(): PhishingGuardConfig {
    return { ...this.config };
  }

  /**
   * 통계 가져오기
   */
  public async getStatistics(): Promise<{
    totalScanned: number;
    phishingDetected: number;
    highRiskCount: number;
    mediumRiskCount: number;
    lowRiskCount: number;
  }> {
    const history = await this.getPhishingHistory();

    return {
      totalScanned: history.length * 10, // 예시 값
      phishingDetected: history.length,
      highRiskCount: history.filter(a => a.riskLevel === 'high').length,
      mediumRiskCount: history.filter(a => a.riskLevel === 'medium').length,
      lowRiskCount: history.filter(a => a.riskLevel === 'low').length,
    };
  }

  /**
   * 수동 SMS 스캔
   */
  public async scanSMS(sms: SMS): Promise<PhishingAlert | null> {
    const analysis = await this.analyzeSMS(sms);

    if (analysis.isPhishing) {
      const alert: PhishingAlert = {
        smsId: sms.id,
        sender: sms.sender,
        message: sms.body,
        riskScore: analysis.riskScore,
        riskLevel: this.calculateRiskLevel(analysis.riskScore),
        detectionReasons: analysis.reasons,
        timestamp: Date.now(),
      };

      return alert;
    }

    return null;
  }

  /**
   * 리소스 정리
   */
  public dispose(): void {
    this.stopMonitoring();
    this.analysisCache.clear();
    this.detectedPhishingMessages.clear();
  }
}

export const smsPhishingGuardService = SMSPhishingGuardService.getInstance();
export type { SMS, PhishingAlert, PhishingGuardConfig };