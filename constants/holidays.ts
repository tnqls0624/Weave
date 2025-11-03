// 한국 공휴일 데이터
export interface Holiday {
  date: string; // "YYYY-MM-DD" 형식
  name: string;
  isLunar?: boolean; // 음력 여부
}

export const KOREAN_HOLIDAYS_2025: Holiday[] = [
  { date: "2025-01-01", name: "신정" },
  { date: "2025-01-28", name: "설날 연휴" },
  { date: "2025-01-29", name: "설날" },
  { date: "2025-01-30", name: "설날 연휴" },
  { date: "2025-03-01", name: "삼일절" },
  { date: "2025-03-03", name: "대체공휴일(삼일절)" },
  { date: "2025-05-05", name: "어린이날" },
  { date: "2025-05-06", name: "대체공휴일(어린이날)" },
  { date: "2025-05-15", name: "부처님오신날" },
  { date: "2025-06-06", name: "현충일" },
  { date: "2025-08-15", name: "광복절" },
  { date: "2025-10-05", name: "추석 연휴" },
  { date: "2025-10-06", name: "추석" },
  { date: "2025-10-07", name: "추석 연휴" },
  { date: "2025-10-08", name: "대체공휴일(추석)" },
  { date: "2025-10-03", name: "개천절" },
  { date: "2025-10-09", name: "한글날" },
  { date: "2025-12-25", name: "성탄절" },
];

export const KOREAN_HOLIDAYS_2024: Holiday[] = [
  { date: "2024-01-01", name: "신정" },
  { date: "2024-02-09", name: "설날 연휴" },
  { date: "2024-02-10", name: "설날" },
  { date: "2024-02-11", name: "설날 연휴" },
  { date: "2024-02-12", name: "대체공휴일(설날)" },
  { date: "2024-03-01", name: "삼일절" },
  { date: "2024-04-10", name: "제22대 국회의원 선거일" },
  { date: "2024-05-05", name: "어린이날" },
  { date: "2024-05-06", name: "대체공휴일(어린이날)" },
  { date: "2024-05-15", name: "부처님오신날" },
  { date: "2024-06-06", name: "현충일" },
  { date: "2024-08-15", name: "광복절" },
  { date: "2024-09-16", name: "추석 연휴" },
  { date: "2024-09-17", name: "추석" },
  { date: "2024-09-18", name: "추석 연휴" },
  { date: "2024-10-03", name: "개천절" },
  { date: "2024-10-09", name: "한글날" },
  { date: "2024-12-25", name: "성탄절" },
];

export const KOREAN_HOLIDAYS_2026: Holiday[] = [
  { date: "2026-01-01", name: "신정" },
  { date: "2026-02-16", name: "설날 연휴" },
  { date: "2026-02-17", name: "설날" },
  { date: "2026-02-18", name: "설날 연휴" },
  { date: "2026-03-01", name: "삼일절" },
  { date: "2026-05-05", name: "어린이날" },
  { date: "2026-05-24", name: "부처님오신날" },
  { date: "2026-06-06", name: "현충일" },
  { date: "2026-08-15", name: "광복절" },
  { date: "2026-09-24", name: "추석 연휴" },
  { date: "2026-09-25", name: "추석" },
  { date: "2026-09-26", name: "추석 연휴" },
  { date: "2026-10-03", name: "개천절" },
  { date: "2026-10-09", name: "한글날" },
  { date: "2026-12-25", name: "성탄절" },
];

// 모든 공휴일을 맵으로 병합
export const ALL_HOLIDAYS: Map<string, Holiday> = new Map([
  ...KOREAN_HOLIDAYS_2024.map((h) => [h.date, h] as [string, Holiday]),
  ...KOREAN_HOLIDAYS_2025.map((h) => [h.date, h] as [string, Holiday]),
  ...KOREAN_HOLIDAYS_2026.map((h) => [h.date, h] as [string, Holiday]),
]);

// 특정 날짜가 공휴일인지 확인
export const isHoliday = (dateString: string): Holiday | undefined => {
  return ALL_HOLIDAYS.get(dateString);
};
