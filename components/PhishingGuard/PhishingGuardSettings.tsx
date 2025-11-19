/**
 * 피싱 가드 설정 화면
 * 민감도, 화이트리스트, 알림 설정 등 관리
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  Switch,
  TouchableOpacity,
  Alert,
  TextInput,
  Modal,
  FlatList,
  Platform,
  ActivityIndicator
} from 'react-native';
import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Slider from '@react-native-community/slider';
import {
  smsPhishingGuardService,
  PhishingGuardConfig
} from '../../services/smsPhishingGuardService';

interface SettingItem {
  id: string;
  title: string;
  description: string;
  type: 'switch' | 'slider' | 'list' | 'button';
  value?: boolean | number | string[];
  icon: string;
}

export default function PhishingGuardSettings() {
  const insets = useSafeAreaInsets();
  const [config, setConfig] = useState<PhishingGuardConfig | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [showWhitelistModal, setShowWhitelistModal] = useState(false);
  const [showBlacklistModal, setShowBlacklistModal] = useState(false);
  const [newNumber, setNewNumber] = useState('');
  const [isUpdating, setIsUpdating] = useState(false);

  useEffect(() => {
    loadConfig();
  }, []);

  const loadConfig = async () => {
    setIsLoading(true);
    try {
      const currentConfig = smsPhishingGuardService.getConfig();
      setConfig(currentConfig);
    } catch (error) {
      console.error('설정 로드 실패:', error);
      Alert.alert('오류', '설정을 불러올 수 없습니다.');
    } finally {
      setIsLoading(false);
    }
  };

  const updateConfig = async (updates: Partial<PhishingGuardConfig>) => {
    if (!config) return;

    setIsUpdating(true);
    try {
      const newConfig = { ...config, ...updates };
      await smsPhishingGuardService.updateConfig(newConfig);
      setConfig(newConfig);
    } catch (error) {
      console.error('설정 업데이트 실패:', error);
      Alert.alert('오류', '설정 변경에 실패했습니다.');
    } finally {
      setIsUpdating(false);
    }
  };

  const handleToggle = (key: keyof PhishingGuardConfig, value: boolean) => {
    updateConfig({ [key]: value });

    // 특별 처리: 피싱 가드 활성화/비활성화
    if (key === 'enabled') {
      if (value) {
        smsPhishingGuardService.startMonitoring();
      } else {
        smsPhishingGuardService.stopMonitoring();
      }
    }
  };

  const handleSensitivityChange = (value: number) => {
    const levels: ('low' | 'medium' | 'high')[] = ['low', 'medium', 'high'];
    const level = levels[Math.floor(value)];
    updateConfig({ sensitivityLevel: level });
  };

  const getSensitivityValue = () => {
    if (!config) return 1;
    const map = { 'low': 0, 'medium': 1, 'high': 2 };
    return map[config.sensitivityLevel];
  };

  const addWhitelistNumber = () => {
    if (!newNumber.trim()) {
      Alert.alert('오류', '번호를 입력해주세요.');
      return;
    }

    if (!config) return;

    const updatedList = [...config.whitelistedNumbers, newNumber.trim()];
    updateConfig({ whitelistedNumbers: updatedList });
    setNewNumber('');
    setShowWhitelistModal(false);
  };

  const removeWhitelistNumber = (number: string) => {
    if (!config) return;

    Alert.alert(
      '삭제 확인',
      `${number}를 안전한 번호 목록에서 삭제하시겠습니까?`,
      [
        { text: '취소', style: 'cancel' },
        {
          text: '삭제',
          style: 'destructive',
          onPress: () => {
            const updatedList = config.whitelistedNumbers.filter(n => n !== number);
            updateConfig({ whitelistedNumbers: updatedList });
          }
        }
      ]
    );
  };

  const resetToDefaults = () => {
    Alert.alert(
      '초기화',
      '모든 설정을 기본값으로 초기화하시겠습니까?',
      [
        { text: '취소', style: 'cancel' },
        {
          text: '초기화',
          style: 'destructive',
          onPress: async () => {
            await updateConfig({
              enabled: true,
              autoBlockHighRisk: true,
              notificationEnabled: true,
              realtimeProtection: true,
              sensitivityLevel: 'medium',
              whitelistedNumbers: [],
              blacklistedPatterns: []
            });
            Alert.alert('완료', '설정이 초기화되었습니다.');
          }
        }
      ]
    );
  };

  const testPhishingDetection = () => {
    Alert.prompt(
      '피싱 테스트',
      '테스트할 메시지를 입력하세요',
      async (text) => {
        if (text) {
          const result = await smsPhishingGuardService.scanSMS({
            id: 'test-' + Date.now(),
            sender: 'TEST',
            body: text,
            timestamp: Date.now(),
            isRead: false
          });

          if (result) {
            Alert.alert(
              '피싱 감지됨',
              `위험도: ${result.riskLevel.toUpperCase()}\n점수: ${(result.riskScore * 100).toFixed(1)}%\n이유: ${result.detectionReasons.join(', ')}`
            );
          } else {
            Alert.alert('안전', '피싱이 감지되지 않았습니다.');
          }
        }
      }
    );
  };

  const WhitelistModal = () => (
    <Modal
      visible={showWhitelistModal}
      animationType="slide"
      transparent={true}
      onRequestClose={() => setShowWhitelistModal(false)}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>안전한 번호 관리</Text>
            <TouchableOpacity
              onPress={() => setShowWhitelistModal(false)}
              style={styles.modalClose}
            >
              <Ionicons name="close" size={24} color="#000" />
            </TouchableOpacity>
          </View>

          <View style={styles.addNumberSection}>
            <TextInput
              style={styles.numberInput}
              placeholder="번호 입력 (예: 01012345678)"
              value={newNumber}
              onChangeText={setNewNumber}
              keyboardType="phone-pad"
            />
            <TouchableOpacity
              style={styles.addButton}
              onPress={addWhitelistNumber}
            >
              <Ionicons name="add" size={24} color="#FFF" />
            </TouchableOpacity>
          </View>

          {config && config.whitelistedNumbers.length > 0 ? (
            <FlatList
              data={config.whitelistedNumbers}
              keyExtractor={(item, index) => index.toString()}
              renderItem={({ item }) => (
                <View style={styles.numberItem}>
                  <Text style={styles.numberText}>{item}</Text>
                  <TouchableOpacity
                    onPress={() => removeWhitelistNumber(item)}
                  >
                    <Ionicons name="trash-outline" size={20} color="#FF3B30" />
                  </TouchableOpacity>
                </View>
              )}
              style={styles.numberList}
            />
          ) : (
            <View style={styles.emptyList}>
              <Text style={styles.emptyText}>등록된 안전한 번호가 없습니다</Text>
            </View>
          )}
        </View>
      </View>
    </Modal>
  );

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#007AFF" />
      </View>
    );
  }

  if (!config) {
    return (
      <View style={styles.errorContainer}>
        <Text>설정을 불러올 수 없습니다</Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>피싱 가드 설정</Text>
      </View>

      <ScrollView
        style={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* 기본 설정 섹션 */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>기본 설정</Text>

          <View style={styles.settingItem}>
            <View style={styles.settingInfo}>
              <Ionicons name="shield-checkmark" size={24} color="#007AFF" />
              <View style={styles.settingText}>
                <Text style={styles.settingTitle}>피싱 가드 활성화</Text>
                <Text style={styles.settingDescription}>
                  SMS 메시지 실시간 모니터링
                </Text>
              </View>
            </View>
            <Switch
              value={config.enabled}
              onValueChange={(value) => handleToggle('enabled', value)}
              trackColor={{ false: '#C7C7CC', true: '#34C759' }}
              disabled={isUpdating}
            />
          </View>

          <View style={styles.settingItem}>
            <View style={styles.settingInfo}>
              <Ionicons name="notifications" size={24} color="#FF9500" />
              <View style={styles.settingText}>
                <Text style={styles.settingTitle}>알림 표시</Text>
                <Text style={styles.settingDescription}>
                  피싱 감지 시 푸시 알림 표시
                </Text>
              </View>
            </View>
            <Switch
              value={config.notificationEnabled}
              onValueChange={(value) => handleToggle('notificationEnabled', value)}
              trackColor={{ false: '#C7C7CC', true: '#34C759' }}
              disabled={isUpdating}
            />
          </View>

          <View style={styles.settingItem}>
            <View style={styles.settingInfo}>
              <MaterialIcons name="block" size={24} color="#FF3B30" />
              <View style={styles.settingText}>
                <Text style={styles.settingTitle}>고위험 자동 차단</Text>
                <Text style={styles.settingDescription}>
                  고위험 메시지 자동 차단
                </Text>
              </View>
            </View>
            <Switch
              value={config.autoBlockHighRisk}
              onValueChange={(value) => handleToggle('autoBlockHighRisk', value)}
              trackColor={{ false: '#C7C7CC', true: '#34C759' }}
              disabled={isUpdating}
            />
          </View>

          <View style={styles.settingItem}>
            <View style={styles.settingInfo}>
              <Ionicons name="sync" size={24} color="#5856D6" />
              <View style={styles.settingText}>
                <Text style={styles.settingTitle}>실시간 보호</Text>
                <Text style={styles.settingDescription}>
                  클라우드 연동 실시간 분석
                </Text>
              </View>
            </View>
            <Switch
              value={config.realtimeProtection}
              onValueChange={(value) => handleToggle('realtimeProtection', value)}
              trackColor={{ false: '#C7C7CC', true: '#34C759' }}
              disabled={isUpdating}
            />
          </View>
        </View>

        {/* 민감도 설정 섹션 */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>탐지 민감도</Text>

          <View style={styles.sensitivityContainer}>
            <View style={styles.sensitivityLabels}>
              <Text style={[
                styles.sensitivityLabel,
                config.sensitivityLevel === 'low' && styles.activeSensitivityLabel
              ]}>낮음</Text>
              <Text style={[
                styles.sensitivityLabel,
                config.sensitivityLevel === 'medium' && styles.activeSensitivityLabel
              ]}>보통</Text>
              <Text style={[
                styles.sensitivityLabel,
                config.sensitivityLevel === 'high' && styles.activeSensitivityLabel
              ]}>높음</Text>
            </View>

            <Slider
              style={styles.slider}
              minimumValue={0}
              maximumValue={2}
              step={1}
              value={getSensitivityValue()}
              onSlidingComplete={handleSensitivityChange}
              minimumTrackTintColor="#007AFF"
              maximumTrackTintColor="#C7C7CC"
              thumbTintColor="#007AFF"
              disabled={isUpdating}
            />

            <Text style={styles.sensitivityDescription}>
              {config.sensitivityLevel === 'low' && '최소한의 피싱만 탐지합니다'}
              {config.sensitivityLevel === 'medium' && '균형잡힌 탐지 수준입니다'}
              {config.sensitivityLevel === 'high' && '의심스러운 모든 메시지를 탐지합니다'}
            </Text>
          </View>
        </View>

        {/* 관리 섹션 */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>관리</Text>

          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => setShowWhitelistModal(true)}
          >
            <View style={styles.actionInfo}>
              <Ionicons name="checkmark-circle" size={24} color="#34C759" />
              <Text style={styles.actionTitle}>안전한 번호 관리</Text>
            </View>
            <View style={styles.actionRight}>
              <Text style={styles.actionCount}>
                {config.whitelistedNumbers.length}개
              </Text>
              <Ionicons name="chevron-forward" size={20} color="#C7C7CC" />
            </View>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.actionButton}
            onPress={testPhishingDetection}
          >
            <View style={styles.actionInfo}>
              <Ionicons name="flask" size={24} color="#5856D6" />
              <Text style={styles.actionTitle}>피싱 테스트</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color="#C7C7CC" />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.actionButton}
            onPress={resetToDefaults}
          >
            <View style={styles.actionInfo}>
              <Ionicons name="refresh" size={24} color="#FF9500" />
              <Text style={styles.actionTitle}>설정 초기화</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color="#C7C7CC" />
          </TouchableOpacity>
        </View>

        {/* 정보 섹션 */}
        <View style={styles.infoSection}>
          <View style={styles.infoItem}>
            <Ionicons name="information-circle" size={16} color="#8E8E93" />
            <Text style={styles.infoText}>
              피싱 가드는 AI와 패턴 분석을 통해 의심스러운 메시지를 탐지합니다.
              100% 정확하지 않을 수 있으므로 중요한 메시지는 직접 확인하세요.
            </Text>
          </View>
        </View>
      </ScrollView>

      {/* 모달 */}
      <WhitelistModal />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F2F2F7',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    backgroundColor: '#FFF',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5EA',
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#000',
  },
  content: {
    flex: 1,
  },
  section: {
    backgroundColor: '#FFF',
    marginTop: 20,
    marginHorizontal: 20,
    borderRadius: 12,
    padding: 16,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 3,
      },
      android: {
        elevation: 2,
      },
    }),
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#8E8E93',
    textTransform: 'uppercase',
    marginBottom: 16,
  },
  settingItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F2F2F7',
  },
  settingItem: {
    borderBottomWidth: 0,
  },
  settingInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  settingText: {
    marginLeft: 12,
    flex: 1,
  },
  settingTitle: {
    fontSize: 16,
    color: '#000',
    fontWeight: '500',
  },
  settingDescription: {
    fontSize: 12,
    color: '#8E8E93',
    marginTop: 2,
  },
  sensitivityContainer: {
    paddingTop: 8,
  },
  sensitivityLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
  },
  sensitivityLabel: {
    fontSize: 14,
    color: '#8E8E93',
  },
  activeSensitivityLabel: {
    color: '#007AFF',
    fontWeight: '600',
  },
  slider: {
    height: 40,
    marginHorizontal: 10,
  },
  sensitivityDescription: {
    fontSize: 12,
    color: '#8E8E93',
    textAlign: 'center',
    marginTop: 8,
  },
  actionButton: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F2F2F7',
  },
  actionButton: {
    borderBottomWidth: 0,
  },
  actionInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  actionTitle: {
    fontSize: 16,
    color: '#000',
    marginLeft: 12,
  },
  actionRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  actionCount: {
    fontSize: 14,
    color: '#8E8E93',
    marginRight: 8,
  },
  infoSection: {
    margin: 20,
    marginTop: 10,
  },
  infoItem: {
    flexDirection: 'row',
    backgroundColor: '#F2F2F7',
    borderRadius: 8,
    padding: 12,
  },
  infoText: {
    fontSize: 12,
    color: '#8E8E93',
    marginLeft: 8,
    flex: 1,
    lineHeight: 18,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  modalContent: {
    backgroundColor: '#FFF',
    borderRadius: 12,
    maxHeight: '70%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5EA',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
  },
  modalClose: {
    padding: 4,
  },
  addNumberSection: {
    flexDirection: 'row',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5EA',
  },
  numberInput: {
    flex: 1,
    height: 40,
    borderWidth: 1,
    borderColor: '#E5E5EA',
    borderRadius: 8,
    paddingHorizontal: 12,
    fontSize: 16,
  },
  addButton: {
    width: 40,
    height: 40,
    backgroundColor: '#007AFF',
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8,
  },
  numberList: {
    maxHeight: 300,
  },
  numberItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F2F2F7',
  },
  numberText: {
    fontSize: 16,
    color: '#000',
  },
  emptyList: {
    padding: 40,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 14,
    color: '#8E8E93',
  },
});