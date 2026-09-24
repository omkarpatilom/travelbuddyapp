import React, { useEffect, useRef, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useTheme } from '@/contexts/ThemeContext';

type Mode = 'date' | 'time' | 'datetime';

interface Props {
  isVisible: boolean;
  mode?: Mode;
  date?: Date;
  minimumDate?: Date;
  maximumDate?: Date;
  onConfirm: (date: Date) => void;
  onCancel: () => void;
  // Accepted for API compatibility with react-native-modal-datetime-picker; unused on web.
  [key: string]: unknown;
}

const pad = (n: number) => String(n).padStart(2, '0');
const toDateValue = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const toTimeValue = (d: Date) => `${pad(d.getHours())}:${pad(d.getMinutes())}`;

const inputType = (mode: Mode) => (mode === 'datetime' ? 'datetime-local' : mode);

function toInputValue(d: Date, mode: Mode) {
  if (mode === 'time') return toTimeValue(d);
  if (mode === 'datetime') return `${toDateValue(d)}T${toTimeValue(d)}`;
  return toDateValue(d);
}

/** Parses an <input> value as *local* time (new Date('YYYY-MM-DD') would be UTC midnight). */
function fromInputValue(value: string, mode: Mode, base: Date): Date | null {
  if (!value) return null;
  const result = new Date(base);
  if (mode === 'time') {
    const [h, m] = value.split(':').map(Number);
    result.setHours(h, m, 0, 0);
    return result;
  }
  const [datePart, timePart] = value.split('T');
  const [y, mo, d] = datePart.split('-').map(Number);
  result.setFullYear(y, mo - 1, d);
  if (mode === 'datetime' && timePart) {
    const [h, m] = timePart.split(':').map(Number);
    result.setHours(h, m, 0, 0);
  } else if (mode === 'date') {
    result.setHours(0, 0, 0, 0);
  }
  return result;
}

/**
 * Web replacement for react-native-modal-datetime-picker: a small dialog around the
 * browser's own date/time input, which provides the calendar. Same props as the
 * native component, so screens import it unchanged.
 */
export default function DateTimePickerModal({
  isVisible,
  mode = 'date',
  date,
  minimumDate,
  maximumDate,
  onConfirm,
  onCancel,
}: Props) {
  const { theme, isDark } = useTheme();
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [value, setValue] = useState('');

  useEffect(() => {
    if (!isVisible) return;
    const initial = date ?? (minimumDate && minimumDate > new Date() ? minimumDate : new Date());
    setValue(toInputValue(initial, mode));
    // Open the browser's calendar straight away where supported. showPicker() needs the
    // user's tap to still count as recent; if the browser refuses, the field stays focused
    // and one more click opens it.
    const timer = setTimeout(() => {
      const input = inputRef.current;
      if (!input) return;
      input.focus();
      try {
        (input as HTMLInputElement & { showPicker?: () => void }).showPicker?.();
      } catch {
        // Not allowed without a fresh user gesture; the focused input is still usable.
      }
    }, 50);
    return () => clearTimeout(timer);
  }, [isVisible]);

  const confirm = () => {
    const parsed = fromInputValue(value, mode, date ?? new Date());
    if (!parsed) return;
    if (minimumDate && mode === 'date' && toDateValue(parsed) < toDateValue(minimumDate)) return;
    onConfirm(parsed);
  };

  const bounds = (d?: Date) => (d ? toInputValue(d, mode) : undefined);
  const title = mode === 'time' ? 'Select time' : mode === 'datetime' ? 'Select date & time' : 'Select date';

  return (
    <Modal visible={isVisible} transparent animationType="fade" onRequestClose={onCancel}>
      <Pressable style={styles.backdrop} onPress={onCancel} accessibilityLabel="Close date picker">
        <Pressable
          style={[styles.card, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}
          onPress={(e) => e.stopPropagation()}
        >
          <Text style={[styles.title, { color: theme.colors.text }]}>{title}</Text>
          {React.createElement('input', {
            ref: inputRef,
            type: inputType(mode),
            value,
            min: mode === 'time' ? undefined : bounds(minimumDate),
            max: mode === 'time' ? undefined : bounds(maximumDate),
            onChange: (e: { target: { value: string } }) => setValue(e.target.value),
            onKeyDown: (e: { key: string }) => {
              if (e.key === 'Enter') confirm();
              if (e.key === 'Escape') onCancel();
            },
            'aria-label': title,
            style: {
              width: '100%',
              boxSizing: 'border-box',
              padding: '12px 14px',
              fontSize: 16,
              borderRadius: 10,
              border: `1px solid ${theme.colors.border}`,
              background: theme.colors.background,
              color: theme.colors.text,
              colorScheme: isDark ? 'dark' : 'light',
              outline: 'none',
            },
          })}
          <View style={styles.actions}>
            <Pressable onPress={onCancel} style={[styles.button, { borderColor: theme.colors.border }]}>
              <Text style={{ color: theme.colors.textSecondary, fontWeight: '600' }}>Cancel</Text>
            </Pressable>
            <Pressable
              onPress={confirm}
              disabled={!value}
              style={[styles.button, { backgroundColor: theme.colors.primary, borderColor: theme.colors.primary, opacity: value ? 1 : 0.5 }]}
            >
              <Text style={{ color: '#FFFFFF', fontWeight: '600' }}>Confirm</Text>
            </Pressable>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
  },
  card: {
    width: '100%',
    maxWidth: 360,
    borderRadius: 16,
    borderWidth: 1,
    padding: 20,
    gap: 16,
  },
  title: { fontSize: 17, fontWeight: '700' },
  actions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 10 },
  button: { paddingVertical: 10, paddingHorizontal: 18, borderRadius: 10, borderWidth: 1 },
});
