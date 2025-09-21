import React, { useState } from 'react';
import { TouchableOpacity, Text, StyleSheet, Platform } from 'react-native';
import DateTimePickerModal from 'react-native-modal-datetime-picker';
import { useTheme } from '@/contexts/ThemeContext';
import { Calendar } from 'lucide-react-native';

interface DatePickerProps {
  value: Date | null;
  onDateChange: (date: Date) => void;
  placeholder?: string;
  minimumDate?: Date;
  maximumDate?: Date;
  mode?: 'date' | 'time' | 'datetime';
  style?: any;
}

export default function DatePicker({
  value,
  onDateChange,
  placeholder = 'Select Date',
  minimumDate,
  maximumDate,
  mode = 'date',
  style,
}: DatePickerProps) {
  const [isVisible, setIsVisible] = useState(false);
  const { theme } = useTheme();

  const formatDate = (date: Date) => {
    if (mode === 'time') {
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
    }
    if (mode === 'datetime') {
      return date.toLocaleString([], {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
      });
    }
    return date.toLocaleDateString([], {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
  };

  const handleConfirm = (selectedDate: Date) => {
    setIsVisible(false);
    onDateChange(selectedDate);
  };

  return (
    <>
      <TouchableOpacity
        style={[
          styles.container,
          { backgroundColor: theme.colors.surface, borderColor: theme.colors.border },
          style,
        ]}
        onPress={() => setIsVisible(true)}
      >
        <Calendar size={20} color={theme.colors.textSecondary} />
        <Text
          style={[
            styles.text,
            { color: value ? theme.colors.text : theme.colors.textSecondary },
          ]}
        >
          {value ? formatDate(value) : placeholder}
        </Text>
      </TouchableOpacity>

      <DateTimePickerModal
        isVisible={isVisible}
        mode={mode}
        date={value || new Date()}
        minimumDate={minimumDate || new Date()}
        maximumDate={maximumDate}
        onConfirm={handleConfirm}
        onCancel={() => setIsVisible(false)}
        isDarkModeEnabled={theme.colors.background === '#111827'}
      />
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 12,
  },
  text: {
    flex: 1,
    fontSize: 16,
  },
});