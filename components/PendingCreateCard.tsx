import React from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator, StyleSheet } from 'react-native';
import { useTheme } from '@/contexts/ThemeContext';

interface Props {
  status: 'pending' | 'error';
  pendingLabel: string;
  errorLabel: string;
  title: string;
  subtitle?: string;
  error?: Error | null;
  onRetry: () => void;
  onDismiss: () => void;
  testID?: string;
}

/**
 * Placeholder for something the user asked to create that the server has not
 * created yet ("Creating ride…"), or failed to create (reason + Retry). It is
 * never presented as the real entity: it has no id and cannot be opened.
 */
export default function PendingCreateCard({
  status, pendingLabel, errorLabel, title, subtitle, error, onRetry, onDismiss, testID,
}: Props) {
  const { theme } = useTheme();
  const failed = status === 'error';
  const accent = failed ? theme.colors.error : theme.colors.primary;

  return (
    <View
      testID={testID}
      style={[styles.card, { backgroundColor: theme.colors.card, borderColor: accent + '60' }]}
    >
      <View style={styles.headerRow}>
        {failed ? null : <ActivityIndicator size="small" color={accent} style={{ marginRight: 8 }} />}
        <Text style={[styles.status, { color: accent }]}>{failed ? errorLabel : pendingLabel}</Text>
      </View>
      <Text style={[styles.title, { color: theme.colors.text }]} numberOfLines={2}>{title}</Text>
      {!!subtitle && (
        <Text style={[styles.subtitle, { color: theme.colors.textSecondary }]}>{subtitle}</Text>
      )}
      {failed && (
        <>
          {!!error?.message && (
            <Text style={[styles.error, { color: theme.colors.error }]} numberOfLines={3}>{error.message}</Text>
          )}
          <View style={styles.actions}>
            <TouchableOpacity onPress={onDismiss} style={[styles.button, { borderColor: theme.colors.border }]}>
              <Text style={[styles.buttonText, { color: theme.colors.textSecondary }]}>Dismiss</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={onRetry} style={[styles.button, { backgroundColor: theme.colors.primary, borderColor: theme.colors.primary }]}>
              <Text style={[styles.buttonText, { color: '#FFFFFF' }]}>Retry</Text>
            </TouchableOpacity>
          </View>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    borderStyle: 'dashed',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
  },
  headerRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  status: { fontSize: 13, fontWeight: '700' },
  title: { fontSize: 15, fontWeight: '600' },
  subtitle: { fontSize: 13, marginTop: 4 },
  error: { fontSize: 13, marginTop: 8 },
  actions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 10, marginTop: 12 },
  button: { borderWidth: 1, borderRadius: 10, paddingVertical: 8, paddingHorizontal: 16 },
  buttonText: { fontSize: 14, fontWeight: '600' },
});
