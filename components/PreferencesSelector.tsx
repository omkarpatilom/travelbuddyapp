import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
} from 'react-native';
import { useTheme } from '@/contexts/ThemeContext';
import { Cigarette, Music, Heart, Wind, MessageCircle } from 'lucide-react-native';

export interface RidePreferences {
  nonSmoking: boolean;
  musicAllowed: boolean;
  petsAllowed: boolean;
  airConditioning: boolean;
  conversationLevel: 'quiet' | 'moderate' | 'chatty';
}

interface PreferencesSelectorProps {
  preferences: RidePreferences;
  onPreferencesChange: (preferences: RidePreferences) => void;
  mode?: 'driver' | 'passenger';
  style?: any;
}

export default function PreferencesSelector({
  preferences,
  onPreferencesChange,
  mode = 'driver',
  style,
}: PreferencesSelectorProps) {
  const { theme } = useTheme();

  const updatePreference = (key: keyof RidePreferences, value: any) => {
    onPreferencesChange({
      ...preferences,
      [key]: value,
    });
  };

  const conversationLevels = [
    { key: 'quiet', label: 'Quiet', icon: '🤫' },
    { key: 'moderate', label: 'Moderate', icon: '😊' },
    { key: 'chatty', label: 'Chatty', icon: '😄' },
  ];

  const renderToggle = (
    key: keyof RidePreferences,
    label: string,
    icon: React.ReactNode,
    value: boolean
  ) => (
    <TouchableOpacity
      style={[
        styles.preferenceItem,
        { backgroundColor: theme.colors.surface, borderColor: theme.colors.border },
        value && { borderColor: theme.colors.primary, backgroundColor: theme.colors.primary + '10' },
      ]}
      onPress={() => updatePreference(key, !value)}
    >
      <View style={styles.preferenceContent}>
        <View style={[styles.iconContainer, { backgroundColor: value ? theme.colors.primary : theme.colors.background }]}>
          {React.cloneElement(icon as React.ReactElement, {
            size: 20,
            color: value ? '#FFFFFF' : theme.colors.textSecondary,
          })}
        </View>
        <Text style={[styles.preferenceLabel, { color: theme.colors.text }]}>
          {label}
        </Text>
      </View>
      <View style={[styles.toggle, { backgroundColor: value ? theme.colors.primary : theme.colors.border }]}>
        <View style={[styles.toggleThumb, { backgroundColor: '#FFFFFF' }, value && styles.toggleThumbActive]} />
      </View>
    </TouchableOpacity>
  );

  return (
    <View style={[styles.container, style]}>
      <Text style={[styles.title, { color: theme.colors.text }]}>
        {mode === 'driver' ? 'Ride Preferences' : 'Filter by Preferences'}
      </Text>
      
      <View style={styles.preferencesGrid}>
        {renderToggle('nonSmoking', 'Non-smoking', <Cigarette />, preferences.nonSmoking)}
        {renderToggle('musicAllowed', 'Music allowed', <Music />, preferences.musicAllowed)}
        {renderToggle('petsAllowed', 'Pets allowed', <Heart />, preferences.petsAllowed)}
        {renderToggle('airConditioning', 'Air conditioning', <Wind />, preferences.airConditioning)}
      </View>

      <View style={styles.conversationSection}>
        <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>
          Conversation Level
        </Text>
        <View style={styles.conversationOptions}>
          {conversationLevels.map((level) => (
            <TouchableOpacity
              key={level.key}
              style={[
                styles.conversationOption,
                { backgroundColor: theme.colors.surface, borderColor: theme.colors.border },
                preferences.conversationLevel === level.key && {
                  borderColor: theme.colors.primary,
                  backgroundColor: theme.colors.primary + '10',
                },
              ]}
              onPress={() => updatePreference('conversationLevel', level.key)}
            >
              <Text style={styles.conversationEmoji}>{level.icon}</Text>
              <Text style={[styles.conversationLabel, { color: theme.colors.text }]}>
                {level.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 20,
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  preferencesGrid: {
    gap: 12,
  },
  preferenceItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderRadius: 12,
    padding: 16,
  },
  preferenceContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  iconContainer: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  preferenceLabel: {
    fontSize: 16,
    fontWeight: '500',
  },
  toggle: {
    width: 50,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    paddingHorizontal: 2,
  },
  toggleThumb: {
    width: 24,
    height: 24,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 2,
  },
  toggleThumbActive: {
    alignSelf: 'flex-end',
  },
  conversationSection: {
    gap: 12,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
  },
  conversationOptions: {
    flexDirection: 'row',
    gap: 8,
  },
  conversationOption: {
    flex: 1,
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: 16,
    paddingHorizontal: 8,
    gap: 8,
  },
  conversationEmoji: {
    fontSize: 24,
  },
  conversationLabel: {
    fontSize: 14,
    fontWeight: '500',
    textAlign: 'center',
  },
});