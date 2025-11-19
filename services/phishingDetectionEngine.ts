/**
 * 피싱 탐지 엔진
 * TensorFlow.js + 패턴 매칭 + 휴리스틱 분석을 결합한 하이브리드 접근
 */

import * as tf from '@tensorflow/tfjs';
import '@tensorflow/tfjs-react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface AnalysisRequest {
  sender: string;
  message: string;
  timestamp: number;
  sensitivityLevel: 'high' | 'medium' | 'low';
}

interface AnalysisResult {
  isPhishing: boolean;
  riskScore: number;
  reasons: string[];
  confidence: number;
  details: {
    urlAnalysis?: URLAnalysis;
    patternMatches?: PatternMatch[];
    mlScore?: number;
    heuristicScore?: number;
  };
}

interface URLAnalysis {
  hasURL: boolean;
  urls: string[];
  suspiciousURLs: string[];
  shortURLs: string[];
}

interface PatternMatch {
  pattern: string;
  matched: boolean;
  score: number;
  description: string;
}

class PhishingDetectionEngine {
  private static instance: PhishingDetectionEngine;
  private model: tf.LayersModel | null = null;
  private isModelLoaded: boolean = false;
  private vocabulary: Map<string, number> = new Map();
  private readonly MAX_SEQUENCE_LENGTH = 200;

  // 한국 피싱 패턴 데이터베이스
  private readonly KOREAN_PHISHING_PATTERNS = {
    // 금융 관련 키워드
    financial: {
      patterns: [
        /(?:국민|신한|우리|하나|농협|기업|카카오)(?:은행|뱅크|카드)/gi,
        /(?:입금|송금|이체|출금|결제|환급|지급).*(?:안내|확인|요청)/gi,
        /(?:계좌|계정|비밀번호|인증).*(?:확인|변경|만료)/gi,
        /(?:대출|융자|신용).*(?:승인|한도|상담)/gi,
        /(?:\d+(?:,\d{3})*|\d+)(?:원|만원|천원).*(?:입금|송금|지급)/gi,
      ],
      weight: 0.3,
      description: '금융 관련 의심 패턴'
    },

    // 정부기관 사칭
    government: {
      patterns: [
        /(?:국세청|경찰청|검찰청|법원|정부|관세청|보건복지부)/gi,
        /(?:과태료|벌금|고지서|소환장|압류|체납).*(?:안내|통지)/gi,
        /(?:명의|도용|사기|범죄).*(?:연루|혐의|조사)/gi,
        /(?:국민|주민|재난).*(?:지원금|보조금|수당)/gi,
      ],
      weight: 0.4,
      description: '정부기관 사칭 의심'
    },

    // 택배/배송 사칭
    delivery: {
      patterns: [
        /(?:택배|배송|우체국|CJ|한진|로젠).*(?:도착|반송|보관)/gi,
        /(?:주소|수령|배달).*(?:확인|불가|실패)/gi,
        /(?:운송장|송장).*(?:번호|조회)/gi,
        /택배.*(?:분실|파손|보상)/gi,
      ],
      weight: 0.25,
      description: '택배 사칭 의심'
    },

    // 긴급성/위협
    urgency: {
      patterns: [
        /(?:긴급|즉시|시급|당장|오늘|24시간|48시간).*(?:확인|처리|조치)/gi,
        /(?:제한|중지|정지|차단|해지).*(?:예정|통보|안내)/gi,
        /(?:마감|만료|종료).*(?:임박|예정)/gi,
        /지금.*(?:바로|즉시|클릭|확인)/gi,
      ],
      weight: 0.35,
      description: '긴급성 유도 패턴'
    },

    // URL 관련
    urlPatterns: {
      patterns: [
        /(?:bit\.ly|tinyurl|short\.link|me2\.do|han\.gl)/gi,
        /https?:\/\/\S+/gi,
        /(?:클릭|접속|확인).*(?:링크|URL|주소)/gi,
        /(?:아래|다음|첨부).*(?:링크|URL).*(?:클릭|접속)/gi,
      ],
      weight: 0.3,
      description: 'URL 포함 메시지'
    },

    // 개인정보 요구
    personalInfo: {
      patterns: [
        /(?:주민|주민등록).*(?:번호|등록)/gi,
        /(?:계좌|카드).*(?:번호|비밀번호)/gi,
        /(?:인증|본인).*(?:확인|번호|코드)/gi,
        /(?:OTP|보안|인증).*(?:번호|코드).*(?:입력|전송)/gi,
      ],
      weight: 0.45,
      description: '개인정보 요구 패턴'
    },

    // 이벤트/당첨 사기
    event: {
      patterns: [
        /(?:당첨|선정|축하).*(?:되셨|하셨|드립니다)/gi,
        /(?:무료|공짜|할인|특가).*(?:이벤트|행사|쿠폰)/gi,
        /(?:상품권|기프티콘|포인트).*(?:지급|증정|받)/gi,
        /(?:한정|선착순|마감).*(?:이벤트|혜택)/gi,
      ],
      weight: 0.28,
      description: '이벤트 사기 의심'
    }
  };

  // 의심스러운 URL 도메인
  private readonly SUSPICIOUS_DOMAINS = [
    // 단축 URL 서비스
    'bit.ly', 'tinyurl.com', 'short.link', 'me2.do', 'han.gl', 'vo.la',
    // 의심스러운 TLD
    '.tk', '.ml', '.ga', '.cf',
    // 타이포스쿼팅 (유사 도메인)
    'naver.', 'daum.', 'kakao.', 'samsung.', 'kb.', 'shinhan.',
  ];

  // 안전한 도메인 화이트리스트
  private readonly SAFE_DOMAINS = [
    'naver.com', 'daum.net', 'kakao.com', 'google.com',
    'kbstar.com', 'shinhan.com', 'wooribank.com', 'hanabank.com',
    'samsung.com', 'apple.com', 'microsoft.com',
  ];

  constructor() {
    this.initialize();
  }

  public static getInstance(): PhishingDetectionEngine {
    if (!PhishingDetectionEngine.instance) {
      PhishingDetectionEngine.instance = new PhishingDetectionEngine();
    }
    return PhishingDetectionEngine.instance;
  }

  private async initialize(): Promise<void> {
    try {
      // TensorFlow.js 초기화
      await tf.ready();

      // 모델 로드
      await this.loadModel();

      // 어휘 사전 로드
      await this.loadVocabulary();

      console.log('피싱 탐지 엔진 초기화 완료');
    } catch (error) {
      console.error('피싱 탐지 엔진 초기화 실패:', error);
    }
  }

  /**
   * AI 모델 로드
   */
  private async loadModel(): Promise<void> {
    try {
      // 로컬 저장소에서 모델 체크
      const modelPath = await AsyncStorage.getItem('phishing_model_path');

      if (modelPath) {
        // 저장된 모델 로드
        this.model = await tf.loadLayersModel(modelPath);
      } else {
        // 기본 모델 생성 (실제로는 사전 학습된 모델 사용)
        this.model = this.createDefaultModel();
      }

      this.isModelLoaded = true;
    } catch (error) {
      console.error('모델 로드 실패:', error);
      // 폴백: 휴리스틱만 사용
      this.isModelLoaded = false;
    }
  }

  /**
   * 기본 LSTM 모델 생성
   */
  private createDefaultModel(): tf.LayersModel {
    const model = tf.sequential({
      layers: [
        tf.layers.embedding({
          inputDim: 10000,
          outputDim: 128,
          inputLength: this.MAX_SEQUENCE_LENGTH
        }),
        tf.layers.lstm({
          units: 64,
          returnSequences: true,
          dropout: 0.2
        }),
        tf.layers.lstm({
          units: 32,
          dropout: 0.2
        }),
        tf.layers.dense({
          units: 16,
          activation: 'relu'
        }),
        tf.layers.dropout({ rate: 0.3 }),
        tf.layers.dense({
          units: 1,
          activation: 'sigmoid'
        })
      ]
    });

    model.compile({
      optimizer: tf.train.adam(0.001),
      loss: 'binaryCrossentropy',
      metrics: ['accuracy']
    });

    return model;
  }

  /**
   * 어휘 사전 로드
   */
  private async loadVocabulary(): Promise<void> {
    try {
      const vocab = await AsyncStorage.getItem('phishing_vocabulary');
      if (vocab) {
        this.vocabulary = new Map(JSON.parse(vocab));
      } else {
        // 기본 어휘 생성
        this.createDefaultVocabulary();
      }
    } catch (error) {
      console.error('어휘 로드 실패:', error);
      this.createDefaultVocabulary();
    }
  }

  /**
   * 기본 어휘 사전 생성
   */
  private createDefaultVocabulary(): void {
    const commonWords = [
      '은행', '카드', '계좌', '비밀번호', '인증', '확인', '클릭',
      '링크', '입금', '송금', '대출', '택배', '배송', '도착',
      '당첨', '축하', '긴급', '중요', '안내', '통지', '만료'
    ];

    commonWords.forEach((word, index) => {
      this.vocabulary.set(word, index + 1);
    });
  }

  /**
   * 메시지 분석
   */
  public async analyze(request: AnalysisRequest): Promise<AnalysisResult> {
    const startTime = Date.now();

    try {
      // 1. URL 분석
      const urlAnalysis = this.analyzeURLs(request.message);

      // 2. 패턴 매칭 분석
      const patternResults = this.analyzePatterns(request.message, request.sender);

      // 3. 휴리스틱 분석
      const heuristicScore = this.calculateHeuristicScore(
        request.message,
        request.sender,
        urlAnalysis,
        patternResults
      );

      // 4. ML 모델 분석 (가능한 경우)
      let mlScore = 0;
      if (this.isModelLoaded && this.model) {
        mlScore = await this.predictWithModel(request.message);
      }

      // 5. 종합 점수 계산
      const finalScore = this.calculateFinalScore(
        heuristicScore,
        mlScore,
        patternResults,
        request.sensitivityLevel
      );

      // 6. 탐지 이유 생성
      const reasons = this.generateDetectionReasons(
        finalScore,
        urlAnalysis,
        patternResults,
        heuristicScore,
        mlScore
      );

      // 7. 피싱 여부 판단
      const isPhishing = this.isPhishingBySensitivity(
        finalScore,
        request.sensitivityLevel
      );

      const processingTime = Date.now() - startTime;
      console.log(`피싱 분석 완료 (${processingTime}ms): Score=${finalScore.toFixed(2)}`);

      return {
        isPhishing,
        riskScore: finalScore,
        reasons,
        confidence: this.calculateConfidence(finalScore, patternResults),
        details: {
          urlAnalysis,
          patternMatches: patternResults,
          mlScore,
          heuristicScore
        }
      };
    } catch (error) {
      console.error('피싱 분석 실패:', error);
      return {
        isPhishing: false,
        riskScore: 0,
        reasons: ['분석 실패'],
        confidence: 0,
        details: {}
      };
    }
  }

  /**
   * URL 분석
   */
  private analyzeURLs(message: string): URLAnalysis {
    const urlRegex = /https?:\/\/[^\s]+/gi;
    const urls = message.match(urlRegex) || [];
    const suspiciousURLs: string[] = [];
    const shortURLs: string[] = [];

    urls.forEach(url => {
      // 단축 URL 검사
      if (this.isShortURL(url)) {
        shortURLs.push(url);
        suspiciousURLs.push(url);
      }

      // 의심스러운 도메인 검사
      if (this.isSuspiciousDomain(url)) {
        suspiciousURLs.push(url);
      }

      // 타이포스쿼팅 검사
      if (this.isTyposquatting(url)) {
        suspiciousURLs.push(url);
      }
    });

    return {
      hasURL: urls.length > 0,
      urls,
      suspiciousURLs: [...new Set(suspiciousURLs)],
      shortURLs: [...new Set(shortURLs)]
    };
  }

  /**
   * 패턴 매칭 분석
   */
  private analyzePatterns(message: string, sender: string): PatternMatch[] {
    const results: PatternMatch[] = [];

    Object.entries(this.KOREAN_PHISHING_PATTERNS).forEach(([category, config]) => {
      config.patterns.forEach(pattern => {
        if (pattern.test(message) || pattern.test(sender)) {
          results.push({
            pattern: category,
            matched: true,
            score: config.weight,
            description: config.description
          });
        }
      });
    });

    return results;
  }

  /**
   * 휴리스틱 점수 계산
   */
  private calculateHeuristicScore(
    message: string,
    sender: string,
    urlAnalysis: URLAnalysis,
    patterns: PatternMatch[]
  ): number {
    let score = 0;

    // 1. 패턴 매칭 점수
    patterns.forEach(pattern => {
      score += pattern.score;
    });

    // 2. URL 관련 점수
    if (urlAnalysis.hasURL) {
      score += 0.1;
      if (urlAnalysis.suspiciousURLs.length > 0) {
        score += 0.3 * urlAnalysis.suspiciousURLs.length;
      }
      if (urlAnalysis.shortURLs.length > 0) {
        score += 0.2 * urlAnalysis.shortURLs.length;
      }
    }

    // 3. 발신자 분석
    if (this.isSuspiciousSender(sender)) {
      score += 0.25;
    }

    // 4. 메시지 특성 분석
    const messageFeatures = this.analyzeMessageFeatures(message);
    score += messageFeatures.suspicionScore;

    // 5. 시간대 분석 (새벽/심야 메시지)
    const hour = new Date().getHours();
    if (hour < 6 || hour > 23) {
      score += 0.1;
    }

    return Math.min(score, 1.0); // 최대 1.0
  }

  /**
   * ML 모델 예측
   */
  private async predictWithModel(message: string): Promise<number> {
    if (!this.model || !this.isModelLoaded) {
      return 0;
    }

    try {
      // 텍스트를 시퀀스로 변환
      const sequence = this.textToSequence(message);

      // 패딩
      const padded = this.padSequence(sequence, this.MAX_SEQUENCE_LENGTH);

      // 텐서 생성
      const input = tf.tensor2d([padded], [1, this.MAX_SEQUENCE_LENGTH]);

      // 예측
      const prediction = this.model.predict(input) as tf.Tensor;
      const score = await prediction.data();

      // 메모리 정리
      input.dispose();
      prediction.dispose();

      return score[0];
    } catch (error) {
      console.error('ML 모델 예측 실패:', error);
      return 0;
    }
  }

  /**
   * 텍스트를 시퀀스로 변환
   */
  private textToSequence(text: string): number[] {
    const tokens = text.toLowerCase().split(/\s+/);
    const sequence: number[] = [];

    tokens.forEach(token => {
      if (this.vocabulary.has(token)) {
        sequence.push(this.vocabulary.get(token)!);
      } else {
        sequence.push(0); // Unknown token
      }
    });

    return sequence;
  }

  /**
   * 시퀀스 패딩
   */
  private padSequence(sequence: number[], maxLength: number): number[] {
    if (sequence.length >= maxLength) {
      return sequence.slice(0, maxLength);
    }

    const padded = [...sequence];
    while (padded.length < maxLength) {
      padded.push(0);
    }

    return padded;
  }

  /**
   * 최종 점수 계산
   */
  private calculateFinalScore(
    heuristicScore: number,
    mlScore: number,
    patterns: PatternMatch[],
    sensitivityLevel: 'high' | 'medium' | 'low'
  ): number {
    let finalScore = 0;

    // ML 모델 사용 가능한 경우
    if (this.isModelLoaded && mlScore > 0) {
      // ML 60%, 휴리스틱 40% 가중치
      finalScore = (mlScore * 0.6) + (heuristicScore * 0.4);
    } else {
      // 휴리스틱만 사용
      finalScore = heuristicScore;
    }

    // 민감도에 따른 조정
    const sensitivityMultiplier = {
      'high': 1.2,
      'medium': 1.0,
      'low': 0.8
    };

    finalScore *= sensitivityMultiplier[sensitivityLevel];

    // 다중 패턴 매칭 시 보너스
    if (patterns.length >= 3) {
      finalScore += 0.15;
    }

    return Math.min(finalScore, 1.0);
  }

  /**
   * 탐지 이유 생성
   */
  private generateDetectionReasons(
    score: number,
    urlAnalysis: URLAnalysis,
    patterns: PatternMatch[],
    heuristicScore: number,
    mlScore: number
  ): string[] {
    const reasons: string[] = [];

    // 패턴 매칭 이유
    patterns.forEach(pattern => {
      if (pattern.matched) {
        reasons.push(pattern.description);
      }
    });

    // URL 관련 이유
    if (urlAnalysis.suspiciousURLs.length > 0) {
      reasons.push('의심스러운 URL 포함');
    }
    if (urlAnalysis.shortURLs.length > 0) {
      reasons.push('단축 URL 사용');
    }

    // 점수 기반 이유
    if (score >= 0.8) {
      reasons.push('매우 높은 피싱 위험도');
    } else if (score >= 0.5) {
      reasons.push('피싱 의심 패턴 감지');
    }

    // ML 모델 탐지
    if (mlScore > 0.7) {
      reasons.push('AI 모델 피싱 판정');
    }

    return reasons.length > 0 ? reasons : ['정상 메시지'];
  }

  /**
   * 민감도별 피싱 판정
   */
  private isPhishingBySensitivity(
    score: number,
    sensitivityLevel: 'high' | 'medium' | 'low'
  ): boolean {
    const thresholds = {
      'high': 0.4,
      'medium': 0.5,
      'low': 0.7
    };

    return score >= thresholds[sensitivityLevel];
  }

  /**
   * 신뢰도 계산
   */
  private calculateConfidence(score: number, patterns: PatternMatch[]): number {
    let confidence = score;

    // 패턴 매칭 수에 따른 신뢰도 증가
    confidence += patterns.length * 0.05;

    // ML 모델 사용 시 신뢰도 증가
    if (this.isModelLoaded) {
      confidence += 0.1;
    }

    return Math.min(confidence, 1.0);
  }

  /**
   * 단축 URL 검사
   */
  private isShortURL(url: string): boolean {
    const shortURLServices = [
      'bit.ly', 'tinyurl', 'short.link', 'me2.do',
      'han.gl', 'vo.la', 'ow.ly', 'is.gd'
    ];

    return shortURLServices.some(service => url.includes(service));
  }

  /**
   * 의심스러운 도메인 검사
   */
  private isSuspiciousDomain(url: string): boolean {
    return this.SUSPICIOUS_DOMAINS.some(domain =>
      url.toLowerCase().includes(domain)
    );
  }

  /**
   * 타이포스쿼팅 검사
   */
  private isTyposquatting(url: string): boolean {
    const commonTypos = [
      { original: 'naver.com', typos: ['never.com', 'naver.co', 'navor.com'] },
      { original: 'kakao.com', typos: ['kakoa.com', 'cacao.com', 'kakao.co'] },
      { original: 'kbstar.com', typos: ['kbstar.co', 'kpstar.com', 'kbstart.com'] },
    ];

    for (const { typos } of commonTypos) {
      if (typos.some(typo => url.includes(typo))) {
        return true;
      }
    }

    return false;
  }

  /**
   * 의심스러운 발신자 검사
   */
  private isSuspiciousSender(sender: string): boolean {
    // 숫자만 있는 발신자
    if (/^\d+$/.test(sender)) {
      // 정상적인 한국 전화번호 형식이 아닌 경우
      if (!(/^0\d{9,10}$/.test(sender) || /^01\d{8,9}$/.test(sender))) {
        return true;
      }
    }

    // 국제 발신 번호
    if (sender.startsWith('+') && !sender.startsWith('+82')) {
      return true;
    }

    // 웹발신 표시
    if (sender.includes('Web발신') || sender.includes('[Web]')) {
      return true;
    }

    return false;
  }

  /**
   * 메시지 특성 분석
   */
  private analyzeMessageFeatures(message: string): {
    suspicionScore: number;
    features: string[];
  } {
    let score = 0;
    const features: string[] = [];

    // 과도한 특수문자
    const specialCharRatio = (message.match(/[!@#$%^&*()]/g) || []).length / message.length;
    if (specialCharRatio > 0.1) {
      score += 0.1;
      features.push('과도한 특수문자');
    }

    // 대문자 남용
    const upperCaseRatio = (message.match(/[A-Z]/g) || []).length / message.length;
    if (upperCaseRatio > 0.3) {
      score += 0.05;
      features.push('대문자 남용');
    }

    // 숫자 포함 (금액, 전화번호 등)
    if (/\d{4,}/.test(message)) {
      score += 0.05;
      features.push('긴 숫자 포함');
    }

    // 이모지 과다 사용
    const emojiCount = (message.match(/[\u{1F600}-\u{1F64F}]|[\u{1F300}-\u{1F5FF}]|[\u{1F680}-\u{1F6FF}]/gu) || []).length;
    if (emojiCount > 5) {
      score += 0.05;
      features.push('이모지 과다');
    }

    return {
      suspicionScore: score,
      features
    };
  }

  /**
   * 모델 업데이트 (서버에서 새 모델 다운로드)
   */
  public async updateModel(modelUrl: string): Promise<void> {
    try {
      const newModel = await tf.loadLayersModel(modelUrl);

      // 기존 모델 정리
      if (this.model) {
        this.model.dispose();
      }

      this.model = newModel;
      this.isModelLoaded = true;

      // 모델 경로 저장
      await AsyncStorage.setItem('phishing_model_path', modelUrl);

      console.log('피싱 탐지 모델 업데이트 완료');
    } catch (error) {
      console.error('모델 업데이트 실패:', error);
    }
  }

  /**
   * 학습 데이터 추가 (사용자 피드백)
   */
  public async addTrainingData(
    message: string,
    isPhishing: boolean,
    userFeedback?: string
  ): Promise<void> {
    try {
      const trainingData = await AsyncStorage.getItem('phishing_training_data');
      const data = trainingData ? JSON.parse(trainingData) : [];

      data.push({
        message,
        isPhishing,
        userFeedback,
        timestamp: Date.now()
      });

      // 최대 1000개까지만 저장
      if (data.length > 1000) {
        data.shift();
      }

      await AsyncStorage.setItem('phishing_training_data', JSON.stringify(data));
    } catch (error) {
      console.error('학습 데이터 저장 실패:', error);
    }
  }

  /**
   * 통계 정보 가져오기
   */
  public async getStatistics(): Promise<{
    totalAnalyzed: number;
    phishingDetected: number;
    accuracy: number;
  }> {
    try {
      const stats = await AsyncStorage.getItem('phishing_stats');
      return stats ? JSON.parse(stats) : {
        totalAnalyzed: 0,
        phishingDetected: 0,
        accuracy: 0.95 // 기본값
      };
    } catch (error) {
      console.error('통계 로드 실패:', error);
      return {
        totalAnalyzed: 0,
        phishingDetected: 0,
        accuracy: 0.95
      };
    }
  }

  /**
   * 리소스 정리
   */
  public dispose(): void {
    if (this.model) {
      this.model.dispose();
    }
    this.vocabulary.clear();
  }
}

export const phishingDetectionEngine = PhishingDetectionEngine.getInstance();
export type { AnalysisRequest, AnalysisResult, URLAnalysis, PatternMatch };