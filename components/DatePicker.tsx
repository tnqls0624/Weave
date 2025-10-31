import React, { useState } from 'react';
import { View, StyleSheet, Modal, Pressable, Text, ScrollView } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { toYYYYMMDD } from '../utils/date';

interface DatePickerProps {
  value: { start: string; end?: string };
  onChange: (range: { start: string; end?: string }) => void;
  onClose: () => void;
}

type PickerMode = 'days' | 'months' | 'years';

const DatePicker: React.FC<DatePickerProps> = ({ value, onChange, onClose }) => {
  const initialDate = value.start ? new Date(value.start + 'T00:00:00') : new Date();
  const [displayDate, setDisplayDate] = useState(initialDate);
  const [pickerMode, setPickerMode] = useState<PickerMode>('days');
  const [animationDirection, setAnimationDirection] = useState<'left' | 'right' | null>(null);

  const changeDisplayDate = (amount: number, unit: 'month' | 'year' | 'decade') => {
    const newDate = new Date(displayDate);
    if (unit === 'month') {
      setAnimationDirection(amount > 0 ? 'right' : 'left');
      newDate.setMonth(newDate.getMonth() + amount);
    } else if (unit === 'year') {
      newDate.setFullYear(newDate.getFullYear() + amount);
    } else if (unit === 'decade') {
      newDate.setFullYear(newDate.getFullYear() + amount * 10);
    }
    setDisplayDate(newDate);
  };

  const handleDayClick = (day: Date) => {
    const dateString = toYYYYMMDD(day);
    const { start, end } = value;

    if (!start || end) {
      onChange({ start: dateString, end: undefined });
    } else {
      const startDate = new Date(start + 'T00:00:00');
      if (day < startDate) {
        onChange({ start: dateString, end: undefined });
      } else {
        onChange({ start, end: dateString });
      }
    }
  };

  const goToToday = () => {
    const todayString = toYYYYMMDD(new Date());
    onChange({ start: todayString, end: todayString });
    onClose();
  };
  
  const clearDate = () => {
    onChange({ start: '', end: undefined });
    onClose();
  };

  const renderDaysGrid = () => {
    const year = displayDate.getFullYear();
    const month = displayDate.getMonth();
    
    const firstDayOfMonth = new Date(year, month, 1);
    const lastDayOfMonth = new Date(year, month + 1, 0);
    const startDateOfMonth = new Date(firstDayOfMonth);
    startDateOfMonth.setDate(startDateOfMonth.getDate() - startDateOfMonth.getDay());
    const endDateOfMonth = new Date(lastDayOfMonth);
    if (endDateOfMonth.getDay() !== 6) {
      endDateOfMonth.setDate(endDateOfMonth.getDate() + (6 - endDateOfMonth.getDay()));
    }

    const days: Date[] = [];
    let day = new Date(startDateOfMonth);
    while (day <= endDateOfMonth) {
      days.push(new Date(day));
      day.setDate(day.getDate() + 1);
    }

    const dayNames = ['일', '월', '화', '수', '목', '금', '토'];
    
    const startDateObj = value.start ? new Date(value.start + 'T00:00:00') : null;
    const endDateObj = value.end ? new Date(value.end + 'T00:00:00') : null;

    return (
      <View>
        <View style={styles.dayNames}>
          {dayNames.map((d, i) => (
            <Text 
              key={d} 
              style={[
                styles.dayName,
                i === 0 && styles.sunday,
                i === 6 && styles.saturday
              ]}
            >
              {d}
            </Text>
          ))}
        </View>
        <View style={styles.daysGrid}>
          {days.map((d, index) => {
            const dStr = toYYYYMMDD(d);
            const isCurrentMonth = d.getMonth() === month;
            const isToday = new Date().toDateString() === d.toDateString();

            const isStart = dStr === value.start;
            const isEnd = dStr === value.end;
            const isRangeEdge = isStart || isEnd;
            const isSingleDayRange = isStart && isEnd;
            const isInRange = startDateObj && endDateObj && d > startDateObj && d < endDateObj;

            let dateColor = isCurrentMonth ? '#374151' : '#d1d5db';
            if (isCurrentMonth) {
              if (d.getDay() === 0) dateColor = '#ef4444';
              if (d.getDay() === 6) dateColor = '#3b82f6';
            }

            return (
              <Pressable
                key={index}
                onPress={() => handleDayClick(d)}
                style={[
                  styles.dayCell,
                  isRangeEdge && !isSingleDayRange && styles.rangeEdge,
                  isInRange && styles.inRange,
                  isRangeEdge && styles.selectedDay,
                  isToday && !isRangeEdge && styles.today
                ]}
              >
                <Text style={[styles.dayText, { color: dateColor }]}>
                  {d.getDate()}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>
    );
  };

  const renderMonthsGrid = () => {
    const months = Array.from({ length: 12 }, (_, i) => new Date(0, i).toLocaleString('ko-KR', { month: 'long' }));
    return (
      <View style={styles.monthsGrid}>
        {months.map((month, i) => (
          <Pressable
            key={month}
            onPress={() => {
              setDisplayDate(new Date(displayDate.getFullYear(), i, 1));
              setPickerMode('days');
            }}
            style={styles.monthButton}
          >
            <Text style={styles.monthText}>{month}</Text>
          </Pressable>
        ))}
      </View>
    );
  };

  const renderYearsGrid = () => {
    const year = displayDate.getFullYear();
    const startYear = Math.floor(year / 10) * 10 - 1;
    const years = Array.from({ length: 12 }, (_, i) => startYear + i);
    return (
      <View style={styles.yearsGrid}>
        {years.map((y) => (
          <Pressable
            key={y}
            onPress={() => {
              setDisplayDate(new Date(y, displayDate.getMonth(), 1));
              setPickerMode('months');
            }}
            style={[styles.yearButton, y === year && styles.selectedYear]}
          >
            <Text style={[styles.yearText, y === year && styles.selectedYearText]}>{y}</Text>
          </Pressable>
        ))}
      </View>
    );
  };

  const renderHeader = () => {
    let title = '';
    let onTitlePress: () => void = () => {};
    let onPrev: () => void = () => {};
    let onNext: () => void = () => {};

    if (pickerMode === 'days') {
      title = `${displayDate.getFullYear()}년 ${displayDate.getMonth() + 1}월`;
      onTitlePress = () => setPickerMode('years');
      onPrev = () => changeDisplayDate(-1, 'month');
      onNext = () => changeDisplayDate(1, 'month');
    } else if (pickerMode === 'months') {
      title = `${displayDate.getFullYear()}년`;
      onTitlePress = () => setPickerMode('years');
      onPrev = () => changeDisplayDate(-1, 'year');
      onNext = () => changeDisplayDate(1, 'year');
    } else {
      const startYear = Math.floor(displayDate.getFullYear() / 10) * 10;
      const endYear = startYear + 9;
      title = `${startYear} - ${endYear}`;
      onTitlePress = () => {};
      onPrev = () => changeDisplayDate(-1, 'decade');
      onNext = () => changeDisplayDate(1, 'decade');
    }

    return (
      <View style={styles.header}>
        <Pressable onPress={onPrev} style={styles.headerButton}>
          <MaterialIcons name="chevron-left" size={20} color="#374151" />
        </Pressable>
        <Pressable 
          onPress={onTitlePress} 
          disabled={pickerMode === 'years'} 
          style={styles.headerTitleButton}
        >
          <Text style={styles.headerTitle}>{title}</Text>
          {pickerMode !== 'years' && (
            <MaterialIcons name="keyboard-arrow-down" size={16} color="#374151" />
          )}
        </Pressable>
        <Pressable onPress={onNext} style={styles.headerButton}>
          <MaterialIcons name="chevron-right" size={20} color="#374151" />
        </Pressable>
      </View>
    );
  };

  return (
    <Modal
      visible={true}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <Pressable style={styles.modalBackdrop} onPress={onClose}>
        <Pressable style={styles.picker} onStartShouldSetResponder={() => true}>
          <View style={styles.pickerContent}>
            {renderHeader()}
            <View style={styles.pickerBody}>
              {pickerMode === 'days' && renderDaysGrid()}
              {pickerMode === 'months' && renderMonthsGrid()}
              {pickerMode === 'years' && renderYearsGrid()}
            </View>
          </View>
          <View style={styles.pickerFooter}>
            <Pressable onPress={clearDate} style={styles.footerButton}>
              <Text style={styles.footerButtonText}>삭제</Text>
            </Pressable>
            <Pressable onPress={goToToday} style={styles.footerButton}>
              <Text style={styles.footerButtonText}>오늘</Text>
            </Pressable>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  picker: {
    backgroundColor: '#fff',
    borderRadius: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 10,
    width: 288,
    maxHeight: '80%',
  },
  pickerContent: {
    padding: 16,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  headerButton: {
    padding: 4,
    borderRadius: 20,
  },
  headerTitleButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1f2937',
  },
  pickerBody: {
    minHeight: 200,
  },
  dayNames: {
    flexDirection: 'row',
    marginBottom: 8,
  },
  dayName: {
    flex: 1,
    textAlign: 'center',
    fontSize: 12,
    fontWeight: '600',
    color: '#6b7280',
    paddingVertical: 4,
  },
  sunday: {
    color: '#ef4444',
  },
  saturday: {
    color: '#3b82f6',
  },
  daysGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  dayCell: {
    width: '14.28%',
    aspectRatio: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rangeEdge: {
    backgroundColor: '#dbeafe',
  },
  inRange: {
    backgroundColor: '#dbeafe',
  },
  selectedDay: {
    backgroundColor: '#3b82f6',
    borderRadius: 20,
  },
  today: {
    backgroundColor: '#fef3c7',
    borderRadius: 20,
  },
  dayText: {
    fontSize: 14,
  },
  monthsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    paddingVertical: 8,
  },
  monthButton: {
    width: '23%',
    padding: 12,
    borderRadius: 8,
    backgroundColor: '#f3f4f6',
    alignItems: 'center',
  },
  monthText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
  },
  yearsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    paddingVertical: 8,
  },
  yearButton: {
    width: '23%',
    padding: 12,
    borderRadius: 8,
    backgroundColor: '#f3f4f6',
    alignItems: 'center',
  },
  selectedYear: {
    backgroundColor: '#3b82f6',
  },
  yearText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
  },
  selectedYearText: {
    color: '#fff',
  },
  pickerFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#f9fafb',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
    borderBottomLeftRadius: 8,
    borderBottomRightRadius: 8,
  },
  footerButton: {
    padding: 8,
  },
  footerButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#2563eb',
  },
});

export default DatePicker;
