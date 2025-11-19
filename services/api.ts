import axios, {
  AxiosInstance,
  AxiosRequestConfig,
  AxiosResponse,
  InternalAxiosRequestConfig,
  isAxiosError,
} from "axios";
import dayjs from "dayjs";
import { Calendar, Schedule, User } from "../types";

// API Base Configuration
const API_BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL;

// 백엔드 응답 타입
interface ApiResponse<T> {
  code: number;
  data: T;
  message: string;
}

interface SocialLoginRequest {
  loginType: "GOOGLE" | "APPLE" | "KAKAO";
  accessToken: string;
}

interface AuthResponse {
  accessToken: string;
  refreshToken: string;
  user: User;
}

interface WorkspaceScheduleParams {
  year?: number;
  month?: number;
  week?: number;
  day?: number;
}

// Hex 코드를 색상 이름으로 변환하는 헬퍼 함수
export const hexToColorName = (hex: string): string => {
  if (!hex || !hex.startsWith("#")) {
    return hex;
  }

  const colorMap: { [key: string]: string } = {
    "#EF4444": "red",
    "#FB923C": "orange",
    "#F59E0B": "amber",
    "#EAB308": "yellow",
    "#84CC16": "lime",
    "#22C55E": "green",
    "#34D399": "emerald",
    "#14B8A6": "teal",
    "#06B6D4": "cyan",
    "#60A5FA": "blue",
    "#6366F1": "indigo",
    "#A78BFA": "violet",
    "#A855F7": "purple",
    "#D946EF": "fuchsia",
    "#EC4899": "pink",
    "#F43F5E": "rose",
    "#9CA3AF": "gray",
  };
  const upperHex = hex.toUpperCase();
  const result = colorMap[upperHex] || hex;

  return result;
};

class ApiService {
  private static instance: ApiService;
  private axiosInstance: AxiosInstance;
  private accessToken: string | null = null;
  private refreshToken: string | null = null;
  private isRefreshing: boolean = false;
  private failedQueue: {
    resolve: (value?: any) => void;
    reject: (error?: any) => void;
  }[] = [];

  private constructor() {
    // Axios 인스턴스 생성
    this.axiosInstance = axios.create({
      baseURL: API_BASE_URL,
      timeout: 30000,
      headers: {
        "Content-Type": "application/json",
      },
    });

    // Request Interceptor: 모든 요청에 토큰 추가
    this.axiosInstance.interceptors.request.use(
      (config: InternalAxiosRequestConfig) => {
        if (this.accessToken && config.headers) {
          config.headers.Authorization = `Bearer ${this.accessToken}`;
        } else {
          console.warn(
            `⚠️ [API Request] ${config.method?.toUpperCase()} ${
              config.url
            } - No token available`
          );
        }
        return config;
      },
      (error) => {
        return Promise.reject(error);
      }
    );

    // Response Interceptor: 401 에러 시 토큰 갱신
    this.axiosInstance.interceptors.response.use(
      (response: AxiosResponse) => {
        return response;
      },
      async (error) => {
        const originalRequest = error.config;

        // 401 에러이고, 재시도하지 않은 요청인 경우
        if (error.response?.status === 401 && !originalRequest._retry) {
          if (this.isRefreshing) {
            // 이미 토큰 갱신 중이면 대기열에 추가
            return new Promise((resolve, reject) => {
              this.failedQueue.push({ resolve, reject });
            })
              .then(() => {
                return this.axiosInstance(originalRequest);
              })
              .catch((err) => {
                return Promise.reject(err);
              });
          }

          originalRequest._retry = true;
          this.isRefreshing = true;

          try {
            const refreshed = await this.refreshAccessToken();
            if (refreshed) {
              // 대기 중인 요청들 재시도
              this.failedQueue.forEach((promise) => promise.resolve());
              this.failedQueue = [];
              return this.axiosInstance(originalRequest);
            }
          } catch (refreshError) {
            // 토큰 갱신 실패 시 대기 중인 요청들 모두 실패 처리
            this.failedQueue.forEach((promise) => promise.reject(refreshError));
            this.failedQueue = [];
            return Promise.reject(refreshError);
          } finally {
            this.isRefreshing = false;
          }
        }

        return Promise.reject(error);
      }
    );
  }

  public static getInstance(): ApiService {
    if (!ApiService.instance) {
      ApiService.instance = new ApiService();
    }
    return ApiService.instance;
  }

  // 토큰 설정
  setTokens(accessToken: string, refreshToken: string) {
    this.accessToken = accessToken;
    this.refreshToken = refreshToken;
  }

  // 토큰 제거
  clearTokens() {
    this.accessToken = null;
    this.refreshToken = null;
  }

  // 현재 액세스 토큰 가져오기
  getAccessToken(): string | null {
    return this.accessToken;
  }

  // Private request wrapper
  private async request<T>(
    config: AxiosRequestConfig,
    requiresAuth: boolean = true
  ): Promise<T> {
    try {
      const response = await this.axiosInstance.request<ApiResponse<T>>(config);
      // 백엔드 응답 구조: { code, data, message }
      const apiResponse = response.data;

      // code가 0이 아니면 에러로 처리
      if (apiResponse.code !== 0) {
        throw new Error(apiResponse.message || "API request failed");
      }

      // 실제 데이터 반환
      return apiResponse.data;
    } catch (error) {
      if (isAxiosError(error)) {
        const errorInfo = {
          url: error.config?.url,
          method: error.config?.method,
          status: error.response?.status,
          statusText: error.response?.statusText,
          message: error.message,
          data: error.response?.data,
        };

        console.error("❌ [API Request failed]:", errorInfo);

        // 403: 토큰 만료 또는 권한 없음
        if (error.response?.status === 403) {
          console.warn("⚠️ Access forbidden. Token may be expired or invalid.");
          // 인증 실패 시 토큰 초기화
          this.clearTokens();
        }

        // 서버 응답 에러 메시지 추출
        const serverMessage =
          error.response?.data?.message ||
          error.response?.data?.error ||
          error.response?.statusText;

        throw new Error(
          serverMessage || error.message || "Network request failed"
        );
      }
      console.error("❌ [API Request failed]:", error);
      throw error;
    }
  }

  // ==================== Auth API ====================
  async socialLogin(
    loginType: "GOOGLE" | "APPLE" | "KAKAO",
    accessToken: string
  ): Promise<AuthResponse> {
    return this.request<AuthResponse>({
      url: "/api/auth/social-login",
      method: "POST",
      data: {
        loginType,
        accessToken,
      },
    });
  }

  async refreshAccessToken(): Promise<boolean> {
    try {
      if (!this.refreshToken) return false;

      const response = await this.axiosInstance.post<{ accessToken: string }>(
        "/api/auth/refresh",
        {},
        {
          headers: {
            Authorization: `Bearer ${this.refreshToken}`,
          },
        }
      );

      this.accessToken = response.data.accessToken;
      return true;
    } catch (error) {
      console.error("Token refresh failed:", error);
      this.clearTokens();
      return false;
    }
  }

  // ==================== User API ====================
  async getMyProfile(): Promise<User> {
    return this.request<User>({
      url: "/api/user/me",
      method: "GET",
    });
  }

  async updateUser(userId: string, userData: Partial<User>): Promise<User> {
    return this.request<User>({
      url: "/api/user/me",
      method: "PUT",
      data: userData,
    });
  }

  async uploadProfileImage(imageUri: string): Promise<string> {
    try {
      const formData = new FormData();

      // 이미지 파일 정보 추출
      const filename = imageUri.split("/").pop() || "photo.jpg";
      const match = /\.(\w+)$/.exec(filename);
      const type = match ? `image/${match[1]}` : "image/jpeg";

      // FormData에 이미지 추가
      formData.append("file", {
        uri: imageUri,
        name: filename,
        type: type,
      } as any);

      const response = await this.axiosInstance.post<
        ApiResponse<{ url: string }>
      >("/api/photo", formData, {
        headers: {
          "Content-Type": "multipart/form-data",
          ...(this.accessToken && {
            Authorization: `Bearer ${this.accessToken}`,
          }),
        },
      });

      if (response.data.code !== 0) {
        throw new Error(response.data.message || "Image upload failed");
      }

      return response.data.data.url;
    } catch (error) {
      console.error("❌ [Upload Profile Image] Failed:", error);
      throw error;
    }
  }

  // ==================== Schedule API ====================
  async getSchedule(scheduleId: string): Promise<Schedule> {
    const schedule = await this.request<any>({
      url: `/api/schedule/${scheduleId}`,
      method: "GET",
    });
    return this.transformScheduleFromServer(schedule);
  }

  async createSchedule(scheduleData: Omit<Schedule, "id">): Promise<Schedule> {
    // 서버가 원하는 형식으로 데이터 변환
    const transformedData: any = {
      workspace: scheduleData.workspace, // 필수
      title: scheduleData.title,
      memo: scheduleData.memo || "",
      participants: scheduleData.participants,
      repeatType: scheduleData.repeatType || "none",
      calendarType: scheduleData.calendarType || "solar",
    };

    // startDate: "YYYY-MM-DD HH:mm:ss" 형식 (공백으로 구분)
    if (scheduleData.startDate) {
      if (scheduleData.startTime) {
        transformedData.startDate = `${scheduleData.startDate}T${scheduleData.startTime}:00`;
      } else {
        transformedData.startDate = `${scheduleData.startDate}T00:00:00`;
      }
    }

    // endDate: "YYYY-MM-DD HH:mm:ss" 형식 (공백으로 구분)
    if (scheduleData.endDate) {
      if (scheduleData.endTime) {
        transformedData.endDate = `${scheduleData.endDate}T${scheduleData.endTime}:00`;
      } else {
        transformedData.endDate = `${scheduleData.endDate}T23:59:59`;
      }
    }

    console.log("🔍 [Create Schedule] Transformed Data:", transformedData);
    const createdSchedule = await this.request<any>({
      url: "/api/schedule",
      method: "POST",
      data: transformedData,
    });

    return this.transformScheduleFromServer(createdSchedule);
  }

  async updateSchedule(
    scheduleId: string,
    scheduleData: Partial<Schedule>
  ): Promise<Schedule> {
    // 서버가 원하는 형식으로 데이터 변환
    const transformedData: any = {};

    if (scheduleData.workspace)
      transformedData.workspace = scheduleData.workspace;
    if (scheduleData.title) transformedData.title = scheduleData.title;
    if (scheduleData.memo !== undefined)
      transformedData.memo = scheduleData.memo;
    if (scheduleData.participants)
      transformedData.participants = scheduleData.participants;
    if (scheduleData.repeatType !== undefined)
      transformedData.repeatType = scheduleData.repeatType;
    if (scheduleData.calendarType)
      transformedData.calendarType = scheduleData.calendarType;

    // startDate: "YYYY-MM-DD HH:mm:ss" 형식 (공백으로 구분)
    if (scheduleData.startDate) {
      if (scheduleData.startTime) {
        transformedData.startDate = `${scheduleData.startDate} ${scheduleData.startTime}:00`;
      } else {
        transformedData.startDate = `${scheduleData.startDate} 00:00:00`;
      }
    }

    // endDate: "YYYY-MM-DD HH:mm:ss" 형식 (공백으로 구분)
    if (scheduleData.endDate) {
      if (scheduleData.endTime) {
        transformedData.endDate = `${scheduleData.endDate} ${scheduleData.endTime}:00`;
      } else {
        transformedData.endDate = `${scheduleData.endDate} 23:59:59`;
      }
    }

    const updatedSchedule = await this.request<any>({
      url: `/api/schedule/${scheduleId}`,
      method: "PUT",
      data: transformedData,
    });

    return this.transformScheduleFromServer(updatedSchedule);
  }

  async deleteSchedule(scheduleId: string): Promise<void> {
    return this.request<void>({
      url: `/api/schedule/${scheduleId}`,
      method: "DELETE",
    });
  }

  // ==================== Workspace API ====================
  async getMyWorkspaces(): Promise<Calendar[]> {
    const workspaces = await this.request<Calendar[]>({
      url: "/api/workspace",
      method: "GET",
    });

    return workspaces;
  }

  async getWorkspace(workspaceId: string): Promise<Calendar> {
    const workspace = await this.request<Calendar>({
      url: `/api/workspace/${workspaceId}`,
      method: "GET",
    });

    console.log(
      "🏢 [Workspace Detail] Response:",
      JSON.stringify(workspace, null, 2)
    );

    return workspace;
  }

  async getWorkspaceSchedules(
    workspaceId: string,
    params?: WorkspaceScheduleParams
  ): Promise<Schedule[]> {
    console.log("🔍 [Get Workspace Schedules] Params:", params);
    const response = await this.request<any>({
      url: `/api/workspace/${workspaceId}/schedule/`,
      method: "GET",
      params,
    });

    // 응답에서 schedules 배열 추출
    const schedules = response.schedules || [];

    // 서버 응답 데이터를 클라이언트 형식으로 변환
    return schedules.map((schedule: any) =>
      this.transformScheduleFromServer(schedule)
    );
  }

  async getWorkspaceScheduleFeed(workspaceId: string): Promise<Schedule[]> {
    const response = await this.request<any>({
      url: `/api/workspace/${workspaceId}/schedule/feed`,
      method: "GET",
    });

    const schedules =
      Array.isArray(response?.schedules) || Array.isArray(response)
        ? response.schedules ?? response
        : [];

    return (schedules as any[]).map((schedule) =>
      this.transformScheduleFromServer(schedule)
    );
  }

  async updateParticipantColors(
    workspaceId: string,
    participantColors: Record<string, string>
  ): Promise<void> {
    return this.request<void>({
      url: `/api/workspace/${workspaceId}/participant-colors`,
      method: "PUT",
      data: { participantColors },
    });
  }

  // 알림 설정 업데이트
  async updateNotifications(
    pushEnabled?: boolean,
    fcmToken?: string,
    locationEnabled?: boolean
  ): Promise<User> {
    return this.request<User>({
      url: "/api/user/notifications",
      method: "PUT",
      data: {
        ...(pushEnabled && { pushEnabled }),
        ...(fcmToken && { fcmToken }),
        ...(locationEnabled && { locationEnabled }),
      },
    });
  }

  // 위치 공유 설정 업데이트
  async updateLocationSharing(locationEnabled: boolean): Promise<User> {
    return this.request<User>({
      url: "/api/user/me",
      method: "PUT",
      data: { locationEnabled },
    });
  }

  // 서버 응답에서 추출한 사용자 정보를 저장 (외부에서 접근 가능)
  private cachedUsers = new Map<string, User>();

  getCachedUsers(): User[] {
    return Array.from(this.cachedUsers.values());
  }

  // 서버 데이터를 클라이언트 형식으로 변환하는 헬퍼 메서드
  private transformScheduleFromServer(serverSchedule: any): Schedule {
    // "2025-01-10 13:00:00" -> { date: "2025-01-10", time: "13:00" }
    const parseDateTime = (dateTimeStr: string) => {
      if (!dateTimeStr) {
        return { date: "", time: undefined };
      }

      const trimmed = dateTimeStr.trim();

      // ISO 8601 또는 타임존 정보가 포함된 문자열 처리
      if (trimmed.includes("T")) {
        const parsed = dayjs(trimmed);
        if (parsed.isValid()) {
          const hasTimeComponent = /T\d{2}:\d{2}/.test(trimmed);
          return {
            date: parsed.format("YYYY-MM-DD"),
            time: hasTimeComponent ? parsed.format("HH:mm") : undefined,
          };
        }
      }

      const parts = trimmed.split(" ");
      if (parts.length === 2) {
        const [date, timeWithSeconds] = parts;
        const time = timeWithSeconds.substring(0, 5); // "13:00:00" -> "13:00"
        return { date, time };
      }

      return { date: trimmed, time: undefined };
    };

    const start = parseDateTime(serverSchedule.startDate);
    const end = parseDateTime(serverSchedule.endDate);

    // participants가 객체 배열이면 User 정보 캐싱 후 ID만 추출
    const participants = serverSchedule.participants
      ? serverSchedule.participants.map((p: any) => {
          if (typeof p === "string") {
            return p;
          } else {
            this.cachedUsers.set(p.id, {
              id: p.id,
              name: p.name,
              birthday: p.birthday,
              avatarUrl: p.avatarUrl,
              color: p.color,
            });
            return p.id;
          }
        })
      : [];

    return {
      id: serverSchedule._id || serverSchedule.id,
      workspace: serverSchedule.workspace,
      title: serverSchedule.title,
      memo: serverSchedule.memo,
      startDate: start.date,
      startTime: start.time,
      endDate: end.date,
      endTime: end.time,
      participants,
      repeatType:
        serverSchedule.repeatType?.toLowerCase() || serverSchedule.repeatType,
      calendarType:
        serverSchedule.calendarType?.toLowerCase() ||
        serverSchedule.calendarType,
      isHoliday: serverSchedule.isHoliday,
    };
  }

  // ==================== Location API ====================
  // 워크스페이스 멤버들의 위치 정보 가져오기
  async getWorkspaceUserLocations(workspaceId: string): Promise<any[]> {
    return this.request<any[]>({
      url: `/api/workspace/${workspaceId}/locations`,
      method: "GET",
    });
  }

  // 워크스페이스에 내 위치 전송 (서버 LocationController와 일치)
  async saveLocationToWorkspace(
    workspaceId: string,
    location: {
      latitude: number;
      longitude: number;
    }
  ): Promise<any> {
    return this.request<any>({
      url: `/api/workspace/${workspaceId}/locations`,
      method: "POST",
      data: location,
    });
  }

  // 현재 사용자 위치 업데이트 (기존 메서드 유지 - 호환성)
  async updateMyLocation(location: {
    latitude: number;
    longitude: number;
  }): Promise<void> {
    return this.request<void>({
      url: "/api/user/me/location",
      method: "PUT",
      data: location,
    });
  }

  // ==================== Phishing Guard API ====================

  // 피싱 신고
  async reportPhishing(data: {
    smsId: string;
    sender: string;
    message: string;
    workspaceId?: string;
    riskScore: number;
    riskLevel: string;
    detectionReasons: string[];
    phishingType?: string;
    location?: { latitude: number; longitude: number };
    deviceInfo?: any;
  }): Promise<any> {
    return this.request<any>({
      url: "/api/phishing/report",
      method: "POST",
      data,
    });
  }

  // 피싱 탐지 요청
  async detectPhishing(data: {
    sender: string;
    message: string;
    sensitivityLevel?: string;
  }): Promise<{
    isPhishing: boolean;
    riskScore: number;
    riskLevel: string;
    detectionReasons: string[];
    phishingType: string;
    confidence: number;
  }> {
    return this.request<any>({
      url: "/api/phishing/detect",
      method: "POST",
      data,
    });
  }

  // 내 피싱 신고 목록 조회
  async getMyPhishingReports(params?: {
    page?: number;
    size?: number;
  }): Promise<any> {
    return this.request<any>({
      url: "/api/phishing/reports/me",
      method: "GET",
      params,
    });
  }

  // 워크스페이스 피싱 신고 조회
  async getWorkspacePhishingReports(
    workspaceId: string,
    params?: { page?: number; size?: number }
  ): Promise<any> {
    return this.request<any>({
      url: `/api/phishing/reports/workspace/${workspaceId}`,
      method: "GET",
      params,
    });
  }

  // 피싱 신고 상세 조회
  async getPhishingReport(reportId: string): Promise<any> {
    return this.request<any>({
      url: `/api/phishing/reports/${reportId}`,
      method: "GET",
    });
  }

  // 피싱 신고 피드백 추가
  async addPhishingFeedback(reportId: string, feedback: string): Promise<any> {
    return this.request<any>({
      url: `/api/phishing/reports/${reportId}/feedback`,
      method: "PUT",
      data: { feedback },
    });
  }

  // 내 피싱 통계 조회
  async getMyPhishingStatistics(): Promise<any> {
    return this.request<any>({
      url: "/api/phishing/statistics/me",
      method: "GET",
    });
  }

  // 워크스페이스 피싱 통계 조회
  async getWorkspacePhishingStatistics(workspaceId: string): Promise<any> {
    return this.request<any>({
      url: `/api/phishing/statistics/workspace/${workspaceId}`,
      method: "GET",
    });
  }

  // 근처 피싱 알림 조회
  async getNearbyPhishingReports(
    latitude: number,
    longitude: number,
    radius?: number
  ): Promise<any> {
    return this.request<any>({
      url: "/api/phishing/reports/nearby",
      method: "GET",
      params: { latitude, longitude, radius: radius || 5000 },
    });
  }

  // 피싱 패턴 목록 조회 (관리자용)
  async getPhishingPatterns(params?: {
    category?: string;
    language?: string;
    activeOnly?: boolean;
  }): Promise<any> {
    return this.request<any>({
      url: "/api/phishing/patterns",
      method: "GET",
      params,
    });
  }

  // 고위험 미처리 신고 조회 (관리자용)
  async getHighRiskPendingReports(): Promise<any> {
    return this.request<any>({
      url: "/api/phishing/reports/high-risk/pending",
      method: "GET",
    });
  }

  // 피싱 신고 상태 변경 (관리자용)
  async updatePhishingReportStatus(
    reportId: string,
    status: string,
    adminNote?: string
  ): Promise<any> {
    return this.request<any>({
      url: `/api/phishing/reports/${reportId}/status`,
      method: "PUT",
      data: { status, adminNote },
    });
  }
}

export const apiService = ApiService.getInstance();
