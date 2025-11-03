import DateTimePicker from "@react-native-community/datetimepicker";
import dayjs from "dayjs";
import React from "react";
import { StyleProp, ViewStyle } from "react-native";

interface DateTimePickerProps {
  value: string | Date; // "HH:mm" 형태 또는 Date 객체
  onChange: (value: string | Date) => void;
  mode?: "date" | "time" | "datetime";
  display?: "default" | "spinner" | "clock";
  style?: StyleProp<ViewStyle>;
  textColor?: string;
  locale?: string;
  is24Hour?: boolean;
  minimumDate?: Date;
  maximumDate?: Date;
}

export default function CustomDateTimePicker({
  value,
  onChange,
  mode = "time",
  display = "spinner",
  style,
  textColor = "#374151",
  locale,
  is24Hour = true,
  minimumDate,
  maximumDate,
}: DateTimePickerProps) {
  // value가 문자열인 경우 Date 객체로 변환
  const currentDate =
    typeof value === "string"
      ? mode === "time"
        ? dayjs(
            `${dayjs().format("YYYY-MM-DD")} ${value}`,
            "YYYY-MM-DD HH:mm"
          ).toDate()
        : new Date(value)
      : value;

  const handleChange = (event: any, date?: Date) => {
    if (date) {
      if (mode === "time") {
        onChange(dayjs(date).format("HH:mm"));
      } else {
        onChange(date);
      }
    }
  };

  return (
    <DateTimePicker
      value={currentDate}
      mode={mode}
      display={display}
      is24Hour={is24Hour}
      locale={locale || (mode === "time" ? "en_GB" : "ko-KR")}
      onChange={handleChange}
      style={style}
      textColor={textColor}
      minimumDate={minimumDate}
      maximumDate={maximumDate}
    />
  );
}
