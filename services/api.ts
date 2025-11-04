import { CALENDARS, EVENTS, USERS } from "../constants";
import { Calendar, Event, User } from "../types";

// API Base Configuration
const API_BASE_URL = "https://api.weave.com"; // 실제 API 엔드포인트로 변경
const USE_MOCK_DATA = true; // 실제 API가 준비될 때까지 mock 데이터 사용

class ApiService {
  private static instance: ApiService;
  private baseURL: string;

  private constructor() {
    this.baseURL = API_BASE_URL;
  }

  public static getInstance(): ApiService {
    if (!ApiService.instance) {
      ApiService.instance = new ApiService();
    }
    return ApiService.instance;
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    // Mock 데이터 사용 모드
    if (USE_MOCK_DATA) {
      return this.getMockData<T>(endpoint, options);
    }

    const url = `${this.baseURL}${endpoint}`;

    const config: RequestInit = {
      headers: {
        "Content-Type": "application/json",
        ...options.headers,
      },
      ...options,
    };

    try {
      const response = await fetch(url, config);

      if (!response.ok) {
        throw new Error(`API Error: ${response.status} ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error("API Request failed:", error);
      throw error;
    }
  }

  // Mock 데이터 반환 (실제 API가 준비될 때까지 사용)
  private async getMockData<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    // 네트워크 딜레이 시뮬레이션
    await new Promise((resolve) => setTimeout(resolve, 100));

    const method = options.method || "GET";

    if (endpoint.includes("/events")) {
      if (method === "GET") {
        // 쿼리 파라미터에서 calendarId 추출
        const url = new URL(`http://dummy${endpoint}`);
        const calendarId = url.searchParams.get("calendarId");
        const filteredEvents = calendarId
          ? EVENTS.filter((event) => event.calendarId === calendarId)
          : EVENTS;
        return filteredEvents as T;
      } else if (method === "POST") {
        // 새 이벤트 생성 시뮬레이션
        const newEvent = options.body ? JSON.parse(options.body as string) : {};
        const createdEvent = {
          ...newEvent,
          id: `event_${Date.now()}`,
          createdAt: new Date().toISOString(),
        };
        return createdEvent as T;
      }
    } else if (endpoint.includes("/users")) {
      if (method === "GET") {
        return USERS as T;
      } else if (method === "PUT") {
        // 사용자 업데이트 시뮬레이션
        const updateData = options.body
          ? JSON.parse(options.body as string)
          : {};
        const userId = endpoint.split("/").pop();
        const updatedUser = USERS.find((u) => u.id === userId);
        if (updatedUser) {
          return { ...updatedUser, ...updateData } as T;
        }
      }
    } else if (endpoint.includes("/calendars")) {
      return CALENDARS as T;
    }

    // 기본적으로 빈 배열 반환
    return [] as T;
  }

  // Events API
  async getEvents(calendarId?: string): Promise<Event[]> {
    const endpoint = calendarId
      ? `/events?calendarId=${calendarId}`
      : "/events";
    return this.request(endpoint);
  }

  async getEvent(eventId: string): Promise<Event> {
    return this.request(`/events/${eventId}`);
  }

  async createEvent(eventData: Omit<Event, "id">): Promise<Event> {
    return this.request("/events", {
      method: "POST",
      body: JSON.stringify(eventData),
    });
  }

  async updateEvent(
    eventId: string,
    eventData: Partial<Event>
  ): Promise<Event> {
    return this.request(`/events/${eventId}`, {
      method: "PUT",
      body: JSON.stringify(eventData),
    });
  }

  async deleteEvent(eventId: string): Promise<void> {
    return this.request(`/events/${eventId}`, {
      method: "DELETE",
    });
  }

  // Users API
  async getUsers(): Promise<User[]> {
    return this.request("/users");
  }

  async getUser(userId: string): Promise<User> {
    return this.request(`/users/${userId}`);
  }

  async updateUser(userId: string, userData: Partial<User>): Promise<User> {
    return this.request(`/users/${userId}`, {
      method: "PUT",
      body: JSON.stringify(userData),
    });
  }

  // Calendars API
  async getCalendars(): Promise<Calendar[]> {
    return this.request("/calendars");
  }

  async getCalendar(calendarId: string): Promise<Calendar> {
    return this.request(`/calendars/${calendarId}`);
  }
}

export const apiService = ApiService.getInstance();
