/**
 * 피싱 탐지 엔진 (서버 기반)
 * 서버의 ML 모델을 사용하여 피싱 탐지
 * 클라이언트에서는 경량 패턴 매칭만 수행 (빠른 응답용)
 */

import AsyncStorage from "@react-native-async-storage/async-storage";
import { apiService } from "./api";

interface AnalysisRequest {
  sender: string;
  message: string;
  timestamp: number;
  sensitivityLevel: "high" | "medium" | "low";
}

interface AnalysisResult {
  isPhishing: boolean;
  riskScore: number;
  riskLevel: "high" | "medium" | "low";
  reasons: string[];
  confidence: number;
  phishingType?: string;
  details?: {
    urlAnalysis?: URLAnalysis;
    patternMatches?: PatternMatch[];
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
  private analysisCache: Map<string, AnalysisResult> = new Map();
  private readonly MAX_CACHE_SIZE = 100;

  // 한국 피싱 패턴 데이터베이스 (경량 버전 - 빠른 로컬 검사용)
  private readonly QUICK_CHECK_PATTERNS = {
    // 고위험 키워드
    highRisk: [
      /주민(?:등록)?번호/gi,
      /비밀번호.*(?:입력|전송|확인)/gi,
      /OTP.*(?:입력|전송)/gi,
      /계좌번호.*(?:입력|전송)/gi,
      /카드번호.*(?:입력|전송)/gi,
    ],
    // 긴급성
    urgency: [
      /긴급.*(?:확인|처리|조치)/gi,
      /(?:즉시|당장|지금).*(?:클릭|확인|접속)/gi,
      /24시간.*(?:내|이내).*(?:처리|확인)/gi,
    ],
    // URL
    urls: [
      /(?:bit\.ly|tinyurl|me2\.do|han\.gl)/gi,
      /https?:\/\/[^\s]+/gi,
    ],
  };

  constructor() {
    // 초기화는 가볍게
  }

  public static getInstance(): PhishingDetectionEngine {
    if (!PhishingDetectionEngine.instance) {
      PhishingDetectionEngine.instance = new PhishingDetectionEngine();
    }
    return PhishingDetectionEngine.instance;
  }

  /**
   * 메시지 분석 (서버 기반)
   */
  public async analyze(request: AnalysisRequest): Promise<AnalysisResult> {
    const startTime = Date.now();

    try {
      // 1. 캐시 확인
      const cacheKey = `${request.sender}_${request.message}`;
      if (this.analysisCache.has(cacheKey)) {
        console.log("캐시에서 결과 반환");
        return this.analysisCache.get(cacheKey)!;
      }

      // 2. 빠른 로컬 체크 (고위험 패턴만)
      const quickCheck = this.quickLocalCheck(request.message);

      // 3. 서버 API 호출하여 정밀 분석
      const serverResult = await this.analyzeWithServer(request);

      // 4. 결과 병합 (로컬 체크와 서버 결과)
      const finalResult: AnalysisResult = {
        ...serverResult,
        details: {
          ...serverResult.details,
          patternMatches: quickCheck.patterns,
        },
      };

      // 5. 캐시 저장
      this.cacheResult(cacheKey, finalResult);

      const processingTime = Date.now() - startTime;
      console.log(
        `피싱 분석 완료 (${processingTime}ms): Score=${finalResult.riskScore.toFixed(
          2
        )}`
      );

      return finalResult;
    } catch (error) {
      console.error("피싱 분석 실패:", error);

      // 서버 오류 시 로컬 패턴 매칭 결과만 반환
      return this.fallbackLocalAnalysis(request);
    }
  }

  /**
   * 서버 API로 분석 요청
   */
  private async analyzeWithServer(
    request: AnalysisRequest
  ): Promise<AnalysisResult> {
    try {
      // 서버의 /api/phishing/detect 엔드포인트 호출
      const response = await apiService.post<any>("/phishing/detect", {
        sender: request.sender,
        message: request.message,
        sensitivityLevel: request.sensitivityLevel,
      });

      // 서버 응답을 AnalysisResult 형식으로 변환
      const serverData = response.data;

      return {
        isPhishing: serverData.isPhishing || serverData.phishing,
        riskScore: serverData.riskScore || 0,
        riskLevel: serverData.riskLevel || "low",
        reasons: serverData.detectionReasons || serverData.reasons || [],
        confidence: serverData.confidence || 0,
        phishingType: serverData.phishingType,
      };
    } catch (error) {
      console.error("서버 분석 API 호출 실패:", error);
      throw error;
    }
  }

  /**
   * 빠른 로컬 체크 (오프라인 또는 즉시 응답용)
   */
  private quickLocalCheck(message: string): {
    isHighRisk: boolean;
    patterns: PatternMatch[];
  } {
    const patterns: PatternMatch[] = [];
    let isHighRisk = false;

    // 고위험 패턴 체크
    this.QUICK_CHECK_PATTERNS.highRisk.forEach((pattern) => {
      if (pattern.test(message)) {
        patterns.push({
          pattern: "high_risk",
          matched: true,
          score: 0.8,
          description: "고위험 개인정보 요구",
        });
        isHighRisk = true;
      }
    });

    // 긴급성 패턴
    this.QUICK_CHECK_PATTERNS.urgency.forEach((pattern) => {
      if (pattern.test(message)) {
        patterns.push({
          pattern: "urgency",
          matched: true,
          score: 0.4,
          description: "긴급성 유도",
        });
      }
    });

    // URL 체크
    this.QUICK_CHECK_PATTERNS.urls.forEach((pattern) => {
      if (pattern.test(message)) {
        patterns.push({
          pattern: "url",
          matched: true,
          score: 0.3,
          description: "URL 포함",
        });
      }
    });

    return { isHighRisk, patterns };
  }

  /**
   * 서버 오류 시 대체 로컬 분석
   */
  private fallbackLocalAnalysis(
    request: AnalysisRequest
  ): AnalysisResult {
    const quickCheck = this.quickLocalCheck(request.message);
    const totalScore =
      quickCheck.patterns.reduce((sum, p) => sum + p.score, 0) / 2;

    return {
      isPhishing: quickCheck.isHighRisk || totalScore > 0.5,
      riskScore: Math.min(totalScore, 1.0),
      riskLevel: totalScore >= 0.7 ? "high" : totalScore >= 0.4 ? "medium" : "low",
      reasons: quickCheck.patterns.map((p) => p.description),
      confidence: 0.6, // 로컬 분석이므로 낮은 신뢰도
      details: {
        patternMatches: quickCheck.patterns,
      },
    };
  }

  /**
   * URL 분석
   */
  public analyzeURLs(message: string): URLAnalysis {
    const urlRegex = /https?:\/\/[^\s]+/gi;
    const urls = message.match(urlRegex) || [];
    const suspiciousURLs: string[] = [];
    const shortURLs: string[] = [];

    const shortURLServices = [
      "bit.ly",
      "tinyurl",
      "short.link",
      "me2.do",
      "han.gl",
      "vo.la",
    ];

    urls.forEach((url) => {
      if (shortURLServices.some((service) => url.includes(service))) {
        shortURLs.push(url);
        suspiciousURLs.push(url);
      }
    });

    return {
      hasURL: urls.length > 0,
      urls,
      suspiciousURLs: [...new Set(suspiciousURLs)],
      shortURLs: [...new Set(shortURLs)],
    };
  }

  /**
   * 캐시 저장
   */
  private cacheResult(key: string, result: AnalysisResult): void {
    if (this.analysisCache.size >= this.MAX_CACHE_SIZE) {
      const firstKey = this.analysisCache.keys().next().value;
      if (firstKey) {
        this.analysisCache.delete(firstKey);
      }
    }
    this.analysisCache.set(key, result);
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
      const stats = await AsyncStorage.getItem("phishing_stats");
      return stats
        ? JSON.parse(stats)
        : {
            totalAnalyzed: 0,
            phishingDetected: 0,
            accuracy: 0.95,
          };
    } catch (error) {
      console.error("통계 로드 실패:", error);
      return {
        totalAnalyzed: 0,
        phishingDetected: 0,
        accuracy: 0.95,
      };
    }
  }

  /**
   * 캐시 초기화
   */
  public clearCache(): void {
    this.analysisCache.clear();
  }

  /**
   * 리소스 정리
   */
  public dispose(): void {
    this.analysisCache.clear();
  }
}

export const phishingDetectionEngine = PhishingDetectionEngine.getInstance();
export type { AnalysisRequest, AnalysisResult, PatternMatch, URLAnalysis };
