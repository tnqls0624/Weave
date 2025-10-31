import React, { useState } from 'react';
import { View, StyleSheet, Pressable, Text, Modal } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';

interface MonthYearPickerProps {
  currentDate: Date;
  onDateSelect: (date: Date) => void;
  onClose: () => void;
}

type PickerMode = 'months' | 'years';

const MonthYearPicker: React.FC<MonthYearPickerProps> = ({ currentDate, onDateSelect, onClose }) => {
  const [displayDate, setDisplayDate] = useState(new Date(currentDate));
  const [pickerMode, setPickerMode] = useState<PickerMode>('months');

  const changeDisplayDate = (amount: number, unit: 'year' | 'decade') => {
    const newDate = new Date(displayDate);
    if (unit === 'year') {
      newDate.setFullYear(newDate.getFullYear() + amount);
    } else {
      newDate.setFullYear(newDate.getFullYear() + amount * 10);
    }
    setDisplayDate(newDate);
  };

  const renderMonthsGrid = () => {
    const months = Array.from({ length: 12 }, (_, i) => new Date(0, i).toLocaleString('ko-KR', { month: 'long' }));
    const currentDisplayMonth = displayDate.getMonth();
    const currentActualMonth = currentDate.getMonth();
    const currentActualYear = currentDate.getFullYear();

    return (
      <View style={styles.monthsGrid}>
        {months.map((month, i) => (
          <Pressable
            key={month}
            onPress={() => {
              const newDate = new Date(displayDate.getFullYear(), i, 1);
              onDateSelect(newDate);
            }}
            style={[
              styles.monthButton,
              i === currentActualMonth && displayDate.getFullYear() === currentActualYear && styles.selectedMonth
            ]}
          >
            <Text style={[
              styles.monthText,
              i === currentActualMonth && displayDate.getFullYear() === currentActualYear && styles.selectedMonthText
            ]}>
              {month}
            </Text>
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

    if (pickerMode === 'months') {
      title = `${displayDate.getFullYear()}년`;
      onTitlePress = () => setPickerMode('years');
      onPrev = () => changeDisplayDate(-1, 'year');
      onNext = () => changeDisplayDate(1, 'year');
    } else {
      const startYear = Math.floor(displayDate.getFullYear() / 10) * 10;
      const endYear = startYear + 9;
      title = `${startYear} - ${endYear}`;
      onPrev = () => changeDisplayDate(-1, 'decade');
      onNext = () => changeDisplayDate(1, 'decade');
    }

    return (
      <View style={styles.header}>
        <Pressable onPress={onTitlePress} style={styles.titleButton}>
          <Text style={styles.title}>{title}</Text>
        </Pressable>
        <View style={styles.navButtons}>
          <Pressable onPress={onPrev} style={styles.navButton}>
            <MaterialIcons name="chevron-left" size={20} color="#374151" />
          </Pressable>
          <Pressable onPress={onNext} style={styles.navButton}>
            <MaterialIcons name="chevron-right" size={20} color="#374151" />
          </Pressable>
        </View>
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
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.picker} onStartShouldSetResponder={() => true}>
          {renderHeader()}
          {pickerMode === 'months' && renderMonthsGrid()}
          {pickerMode === 'years' && renderYearsGrid()}
        </Pressable>
      </Pressable>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: {
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
    padding: 16,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  titleButton: {
    padding: 4,
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1f2937',
  },
  navButtons: {
    flexDirection: 'row',
    gap: 4,
  },
  navButton: {
    padding: 8,
    borderRadius: 20,
  },
  monthsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    paddingVertical: 8,
  },
  monthButton: {
    width: '30%',
    padding: 12,
    borderRadius: 8,
    backgroundColor: '#f3f4f6',
    alignItems: 'center',
  },
  selectedMonth: {
    backgroundColor: '#3b82f6',
  },
  monthText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
  },
  selectedMonthText: {
    color: '#fff',
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
});

export default MonthYearPicker;
