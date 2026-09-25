import React, { useEffect, useRef, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/contexts/ThemeContext';
import { FeedbackEvent, subscribeFeedback } from '@/hooks/mutations/operations';

const AUTO_HIDE_MS = { success: 3500, error: 8000 };

/**
 * App-wide banner for operation outcomes that no screen is around to show:
 * a background mutation that failed or finished after the user navigated
 * away. Failures offer Retry. Mounted once in app/_layout.tsx.
 */
export default function OperationFeedback() {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const [event, setEvent] = useState<FeedbackEvent | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const unsubscribe = subscribeFeedback((e) => {
      if (timer.current) clearTimeout(timer.current);
      setEvent(e);
      timer.current = setTimeout(() => setEvent(null), AUTO_HIDE_MS[e.kind]);
    });
    return () => {
      unsubscribe();
      if (timer.current) clearTimeout(timer.current);
    };
  }, []);

  if (!event) return null;

  const accent = event.kind === 'error' ? theme.colors.error : theme.colors.success;
  const dismiss = () => setEvent(null);

  return (
    <View pointerEvents="box-none" style={[styles.host, { top: insets.top + 8 }]}>
      <View
        testID="operation-feedback"
        accessibilityRole="alert"
        style={[styles.banner, { backgroundColor: theme.colors.card, borderLeftColor: accent, shadowColor: theme.colors.shadow }]}
      >
        <View style={styles.textBlock}>
          <Text style={[styles.title, { color: accent }]}>{event.title}</Text>
          <Text style={[styles.message, { color: theme.colors.text }]} numberOfLines={3}>
            {event.message}
          </Text>
        </View>
        {event.retry && (
          <TouchableOpacity
            onPress={() => {
              event.retry?.();
              dismiss();
            }}
            style={styles.action}
          >
            <Text style={[styles.actionText, { color: theme.colors.primary }]}>Retry</Text>
          </TouchableOpacity>
        )}
        <TouchableOpacity onPress={dismiss} style={styles.action} accessibilityLabel="Dismiss">
          <Text style={[styles.actionText, { color: theme.colors.textSecondary }]}>✕</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  host: {
    position: 'absolute',
    left: 16,
    right: 16,
    zIndex: 1000,
    elevation: 1000,
  },
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    borderLeftWidth: 4,
    paddingVertical: 10,
    paddingHorizontal: 12,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 6,
  },
  textBlock: { flex: 1 },
  title: { fontSize: 14, fontWeight: '700' },
  message: { fontSize: 13, marginTop: 2 },
  action: { paddingHorizontal: 8, paddingVertical: 4 },
  actionText: { fontSize: 14, fontWeight: '700' },
});
