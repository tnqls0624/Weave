import { Picker } from "@react-native-picker/picker";
import dayjs from "dayjs";
import React, { useMemo } from "react";
import { StyleSheet, View } from "react-native";

interface MonthDayPickerProps {
  value?: string | null;
  onChange: (date: string) => void;
  locale?: string;
}

const MonthDayPicker: React.FC<MonthDayPickerProps> = ({
  value,
  onChange,
  locale = "ko-KR",
}) => {
  const baseYear = 2000;

  const resolvedDate = useMemo(() => {
    if (!value || value.length !== 4) {
      const today = new Date();
      return new Date(baseYear, today.getMonth(), today.getDate());
    }
    const month = Number.parseInt(value.slice(0, 2), 10);
    const day = Number.parseInt(value.slice(2, 4), 10);
    if (Number.isNaN(month) || Number.isNaN(day)) {
      const today = new Date();
      return new Date(baseYear, today.getMonth(), today.getDate());
    }
    return new Date(baseYear, month - 1, day);
  }, [baseYear, value]);

  const currentMonth = resolvedDate.getMonth() + 1;
  const currentDay = resolvedDate.getDate();

  const monthFormatter = useMemo(() => {
    try {
      return new Intl.DateTimeFormat(locale, { month: "long" });
    } catch {
      return null;
    }
  }, [locale]);

  const monthOptions = useMemo(
    () =>
      Array.from({ length: 12 }, (_, idx) => {
        const monthIndex = idx + 1;
        const label =
          monthFormatter?.format(new Date(2000, idx, 1)) ?? `${monthIndex}월`;
        return { value: monthIndex, label };
      }),
    [monthFormatter]
  );

  const daysInCurrentMonth = useMemo(
    () => dayjs(new Date(baseYear, currentMonth - 1, 1)).daysInMonth(),
    [baseYear, currentMonth]
  );

  const dayOptions = useMemo(
    () =>
      Array.from({ length: daysInCurrentMonth }, (_, idx) => {
        const day = idx + 1;
        const label = `${day}일`;
        return { value: day, label };
      }),
    [daysInCurrentMonth]
  );

  const formatValue = (month: number, day: number) =>
    `${month.toString().padStart(2, "0")}${day.toString().padStart(2, "0")}`;

  const handleMonthChange = (nextMonth: number) => {
    const maxDayForNextMonth = dayjs(
      new Date(baseYear, nextMonth - 1, 1)
    ).daysInMonth();
    const nextDay = Math.min(currentDay, maxDayForNextMonth);
    onChange(formatValue(nextMonth, nextDay));
  };

  const handleDayChange = (nextDay: number) => {
    onChange(formatValue(currentMonth, nextDay));
  };

  return (
    <View style={styles.container}>
      <Picker
        style={styles.picker}
        itemStyle={styles.pickerItem}
        selectedValue={currentMonth}
        onValueChange={handleMonthChange}
      >
        {monthOptions.map((month) => (
          <Picker.Item
            key={month.value}
            label={month.label}
            value={month.value}
          />
        ))}
      </Picker>
      <Picker
        style={styles.picker}
        itemStyle={styles.pickerItem}
        selectedValue={Math.min(currentDay, daysInCurrentMonth)}
        onValueChange={handleDayChange}
      >
        {dayOptions.map((day) => (
          <Picker.Item key={day.value} label={day.label} value={day.value} />
        ))}
      </Picker>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: 12,
  },
  picker: {
    flex: 1,
  },
  pickerItem: {
    fontSize: 20,
  },
});

export default MonthDayPicker;
