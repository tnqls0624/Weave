import AsyncStorage from "@react-native-async-storage/async-storage";
import dayjs from "dayjs";

// 위젯 데이터를 가져오는 핸들러
export async function widgetTaskHandler(props: any) {
  const widgetInfo = props.widgetInfo;
  const Widget = props.renderWidget;

  try {
    // AsyncStorage에서 캐시된 일정 데이터 가져오기
    const cachedSchedules = await AsyncStorage.getItem("widget_schedules");
    const workspaceName = await AsyncStorage.getItem("widget_workspace_name");

    let schedules = [];
    if (cachedSchedules) {
      schedules = JSON.parse(cachedSchedules);
    }

    // 위젯 크기에 따라 다른 컴포넌트 렌더링
    switch (widgetInfo.widgetName) {
      case "ScheduleWidgetSmall":
        return (
          <Widget
            schedules={schedules}
          />
        );
      case "ScheduleWidget":
      default:
        return (
          <Widget
            schedules={schedules}
            workspaceName={workspaceName || "모두의캘린더"}
          />
        );
    }
  } catch (error) {
    console.error("Widget task handler error:", error);
    return null;
  }
}

// 위젯 데이터 업데이트 함수 (앱에서 호출)
export async function updateWidgetData(
  schedules: any[],
  workspaceName: string
) {
  try {
    // 이번 주 일정만 필터링하여 저장
    const today = dayjs().startOf("day");
    const weekEnd = today.add(7, "day");

    const weekSchedules = schedules
      .filter((s) => {
        const startDate = dayjs(s.startDate);
        return startDate.isAfter(today.subtract(1, "day")) && startDate.isBefore(weekEnd);
      })
      .map((s) => ({
        id: s.id,
        title: s.title,
        startDate: s.startDate,
        startTime: s.startTime,
        isAllDay: s.isAllDay,
      }))
      .sort((a, b) => {
        if (a.startDate !== b.startDate) {
          return a.startDate.localeCompare(b.startDate);
        }
        if (a.startTime && b.startTime) {
          return a.startTime.localeCompare(b.startTime);
        }
        return 0;
      });

    await AsyncStorage.setItem("widget_schedules", JSON.stringify(weekSchedules));
    await AsyncStorage.setItem("widget_workspace_name", workspaceName);

    // Android 위젯 갱신 요청
    try {
      const { requestWidgetUpdate } = await import("react-native-android-widget");
      await requestWidgetUpdate({
        widgetName: "ScheduleWidget",
        renderWidget: () => null,
        widgetInfo: { widgetName: "ScheduleWidget" },
      });
    } catch (e) {
      // Android 위젯 모듈이 없는 경우 무시
    }
  } catch (error) {
    console.error("Failed to update widget data:", error);
  }
}

export default widgetTaskHandler;
