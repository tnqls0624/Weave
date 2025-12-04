import React from "react";
import {
  FlexWidget,
  TextWidget,
  ListWidget,
} from "react-native-android-widget";
import dayjs from "dayjs";

interface ScheduleItem {
  id: string;
  title: string;
  startDate: string;
  startTime?: string;
  isAllDay?: boolean;
  participantNames?: string[];
}

interface ScheduleWidgetProps {
  schedules: ScheduleItem[];
  workspaceName?: string;
}

// 오늘/내일/이번 주 일정을 표시하는 위젯
export function ScheduleWidget({
  schedules = [],
  workspaceName = "모두의캘린더",
}: ScheduleWidgetProps) {
  const today = dayjs().format("YYYY-MM-DD");
  const tomorrow = dayjs().add(1, "day").format("YYYY-MM-DD");
  const weekEnd = dayjs().add(7, "day").format("YYYY-MM-DD");

  // 오늘 일정
  const todaySchedules = schedules.filter((s) => s.startDate === today);
  // 내일 일정
  const tomorrowSchedules = schedules.filter((s) => s.startDate === tomorrow);
  // 이번 주 일정 (오늘, 내일 제외)
  const weekSchedules = schedules.filter(
    (s) => s.startDate > tomorrow && s.startDate <= weekEnd
  );

  const formatTime = (schedule: ScheduleItem) => {
    if (schedule.isAllDay) return "종일";
    if (schedule.startTime) return schedule.startTime;
    return "";
  };

  const formatDate = (dateStr: string) => {
    const date = dayjs(dateStr);
    const weekdays = ["일", "월", "화", "수", "목", "금", "토"];
    return `${date.format("M/D")}(${weekdays[date.day()]})`;
  };

  return (
    <FlexWidget
      style={{
        height: "match_parent",
        width: "match_parent",
        backgroundColor: "#ffffff",
        borderRadius: 16,
        padding: 16,
        flexDirection: "column",
      }}
    >
      {/* 헤더 */}
      <FlexWidget
        style={{
          flexDirection: "row",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 12,
        }}
      >
        <TextWidget
          text={workspaceName}
          style={{
            fontSize: 14,
            fontWeight: "600",
            color: "#6b7280",
          }}
        />
        <TextWidget
          text={dayjs().format("M월 D일")}
          style={{
            fontSize: 14,
            fontWeight: "bold",
            color: "#111827",
          }}
        />
      </FlexWidget>

      {/* 오늘 일정 */}
      {todaySchedules.length > 0 ? (
        <FlexWidget style={{ marginBottom: 8 }}>
          <TextWidget
            text="오늘"
            style={{
              fontSize: 12,
              fontWeight: "600",
              color: "#3b82f6",
              marginBottom: 4,
            }}
          />
          {todaySchedules.slice(0, 3).map((schedule, index) => (
            <FlexWidget
              key={schedule.id}
              style={{
                flexDirection: "row",
                alignItems: "center",
                paddingVertical: 4,
              }}
            >
              <FlexWidget
                style={{
                  width: 4,
                  height: 16,
                  backgroundColor: "#3b82f6",
                  borderRadius: 2,
                  marginRight: 8,
                }}
              />
              <TextWidget
                text={formatTime(schedule)}
                style={{
                  fontSize: 11,
                  color: "#6b7280",
                  width: 36,
                }}
              />
              <TextWidget
                text={schedule.title}
                style={{
                  fontSize: 13,
                  color: "#111827",
                  flex: 1,
                }}
                maxLines={1}
              />
            </FlexWidget>
          ))}
          {todaySchedules.length > 3 && (
            <TextWidget
              text={`+${todaySchedules.length - 3}개 더보기`}
              style={{
                fontSize: 11,
                color: "#9ca3af",
                marginTop: 2,
              }}
            />
          )}
        </FlexWidget>
      ) : (
        <FlexWidget
          style={{
            paddingVertical: 16,
            alignItems: "center",
          }}
        >
          <TextWidget
            text="오늘 일정이 없습니다"
            style={{
              fontSize: 13,
              color: "#9ca3af",
            }}
          />
        </FlexWidget>
      )}

      {/* 내일 일정 */}
      {tomorrowSchedules.length > 0 && (
        <FlexWidget style={{ marginBottom: 8 }}>
          <TextWidget
            text="내일"
            style={{
              fontSize: 12,
              fontWeight: "600",
              color: "#f59e0b",
              marginBottom: 4,
            }}
          />
          {tomorrowSchedules.slice(0, 2).map((schedule) => (
            <FlexWidget
              key={schedule.id}
              style={{
                flexDirection: "row",
                alignItems: "center",
                paddingVertical: 4,
              }}
            >
              <FlexWidget
                style={{
                  width: 4,
                  height: 16,
                  backgroundColor: "#f59e0b",
                  borderRadius: 2,
                  marginRight: 8,
                }}
              />
              <TextWidget
                text={formatTime(schedule)}
                style={{
                  fontSize: 11,
                  color: "#6b7280",
                  width: 36,
                }}
              />
              <TextWidget
                text={schedule.title}
                style={{
                  fontSize: 13,
                  color: "#111827",
                  flex: 1,
                }}
                maxLines={1}
              />
            </FlexWidget>
          ))}
        </FlexWidget>
      )}

      {/* 이번 주 일정 */}
      {weekSchedules.length > 0 && (
        <FlexWidget>
          <TextWidget
            text="이번 주"
            style={{
              fontSize: 12,
              fontWeight: "600",
              color: "#22c55e",
              marginBottom: 4,
            }}
          />
          {weekSchedules.slice(0, 2).map((schedule) => (
            <FlexWidget
              key={schedule.id}
              style={{
                flexDirection: "row",
                alignItems: "center",
                paddingVertical: 4,
              }}
            >
              <FlexWidget
                style={{
                  width: 4,
                  height: 16,
                  backgroundColor: "#22c55e",
                  borderRadius: 2,
                  marginRight: 8,
                }}
              />
              <TextWidget
                text={formatDate(schedule.startDate)}
                style={{
                  fontSize: 11,
                  color: "#6b7280",
                  width: 50,
                }}
              />
              <TextWidget
                text={schedule.title}
                style={{
                  fontSize: 13,
                  color: "#111827",
                  flex: 1,
                }}
                maxLines={1}
              />
            </FlexWidget>
          ))}
        </FlexWidget>
      )}

      {/* 일정이 전혀 없을 때 */}
      {todaySchedules.length === 0 &&
        tomorrowSchedules.length === 0 &&
        weekSchedules.length === 0 && (
          <FlexWidget
            style={{
              flex: 1,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <TextWidget
              text="이번 주 일정이 없습니다"
              style={{
                fontSize: 14,
                color: "#9ca3af",
              }}
            />
            <TextWidget
              text="탭하여 일정 추가하기"
              style={{
                fontSize: 12,
                color: "#3b82f6",
                marginTop: 8,
              }}
            />
          </FlexWidget>
        )}
    </FlexWidget>
  );
}

// 소형 위젯 (오늘 일정만)
export function ScheduleWidgetSmall({
  schedules = [],
}: {
  schedules: ScheduleItem[];
}) {
  const today = dayjs().format("YYYY-MM-DD");
  const todaySchedules = schedules.filter((s) => s.startDate === today);

  return (
    <FlexWidget
      style={{
        height: "match_parent",
        width: "match_parent",
        backgroundColor: "#ffffff",
        borderRadius: 16,
        padding: 12,
        flexDirection: "column",
      }}
    >
      <TextWidget
        text={dayjs().format("M월 D일")}
        style={{
          fontSize: 12,
          fontWeight: "bold",
          color: "#111827",
          marginBottom: 8,
        }}
      />

      {todaySchedules.length > 0 ? (
        <>
          {todaySchedules.slice(0, 3).map((schedule) => (
            <FlexWidget
              key={schedule.id}
              style={{
                flexDirection: "row",
                alignItems: "center",
                marginBottom: 4,
              }}
            >
              <FlexWidget
                style={{
                  width: 4,
                  height: 12,
                  backgroundColor: "#3b82f6",
                  borderRadius: 2,
                  marginRight: 6,
                }}
              />
              <TextWidget
                text={schedule.title}
                style={{
                  fontSize: 12,
                  color: "#374151",
                }}
                maxLines={1}
              />
            </FlexWidget>
          ))}
          {todaySchedules.length > 3 && (
            <TextWidget
              text={`+${todaySchedules.length - 3}`}
              style={{
                fontSize: 10,
                color: "#9ca3af",
              }}
            />
          )}
        </>
      ) : (
        <TextWidget
          text="일정 없음"
          style={{
            fontSize: 12,
            color: "#9ca3af",
          }}
        />
      )}
    </FlexWidget>
  );
}

export default ScheduleWidget;
