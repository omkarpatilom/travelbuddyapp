import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Switch,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useTheme } from '@/contexts/ThemeContext';
import { api } from '@/utils/api';
import { Settings, Music, Cigarette, Heart, Globe, ArrowLeft, Save, MessageCircle } from 'lucide-react-native';

export default function PreferencesScreen() {
  const { theme } = useTheme();
  const router = useRouter();

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [preferences, setPreferences] = useState({
    allowMusic: true,
    allowSmoking: false,
    allowPets: false,
    preferredLanguage: 'English',
  });

  useEffect(() => {
    fetchPreferences();
  }, []);

  const fetchPreferences = async () => {
    try {
      const data = await api.get<any>('/preferences');
      setPreferences({
        allowMusic: data.allowMusic,
        allowSmoking: data.allowSmoking,
        allowPets: data.allowPets,
        preferredLanguage: data.preferredLanguage || 'English',
      });
    } catch (error) {
      console.error('Error fetching preferences:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await api.put('/preferences', preferences);
      Alert.alert('Success', 'Preferences updated successfully!');
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to update preferences');
    } finally {
      setIsSaving(false);
    }
  };

  const togglePreference = (key: keyof typeof preferences) => {
    if (typeof preferences[key] === 'boolean') {
      setPreferences(prev => ({ ...prev, [key]: !prev[key] }));
    }
  };

  const languages = ['English', 'Spanish', 'French', 'German', 'Hindi'];
  const conversationLevels = ['Quiet', 'Moderate', 'Chatty'];

  if (isLoading) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: theme.colors.background }]}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
      </View>
    );
  }

  return (
    <ScrollView style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <View style={[styles.header, { backgroundColor: theme.colors.surface, borderBottomColor: theme.colors.border }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <ArrowLeft size={24} color={theme.colors.text} />
        </TouchableOpacity>
        <Text style={[styles.title, { color: theme.colors.text }]}>Ride Preferences</Text>
        <TouchableOpacity onPress={handleSave} style={styles.saveButton} disabled={isSaving}>
          {isSaving ? (
            <ActivityIndicator size="small" color={theme.colors.primary} />
          ) : (
            <Save size={24} color={theme.colors.primary} />
          )}
        </TouchableOpacity>
      </View>

      <View style={styles.content}>
        <Text style={[styles.sectionDescription, { color: theme.colors.textSecondary }]}>
          Set your default preferences for rides. These will be visible to drivers or passengers when booking.
        </Text>

        <View style={[styles.section, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
          <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Comfort Defaults</Text>
          
          <View style={styles.preferenceItem}>
            <View style={styles.preferenceInfo}>
              <Music size={20} color={theme.colors.primary} />
              <Text style={[styles.preferenceLabel, { color: theme.colors.text }]}>Music Allowed</Text>
            </View>
            <Switch
              value={preferences.allowMusic}
              onValueChange={() => togglePreference('allowMusic')}
              trackColor={{ false: theme.colors.border, true: theme.colors.primary + '80' }}
              thumbColor={preferences.allowMusic ? theme.colors.primary : '#f4f3f4'}
            />
          </View>

          <View style={[styles.divider, { backgroundColor: theme.colors.border }]} />

          <View style={styles.preferenceItem}>
            <View style={styles.preferenceInfo}>
              <Cigarette size={20} color={theme.colors.secondary} />
              <Text style={[styles.preferenceLabel, { color: theme.colors.text }]}>Smoking Allowed</Text>
            </View>
            <Switch
              value={preferences.allowSmoking}
              onValueChange={() => togglePreference('allowSmoking')}
              trackColor={{ false: theme.colors.border, true: theme.colors.primary + '80' }}
              thumbColor={preferences.allowSmoking ? theme.colors.primary : '#f4f3f4'}
            />
          </View>

          <View style={[styles.divider, { backgroundColor: theme.colors.border }]} />

          <View style={styles.preferenceItem}>
            <View style={styles.preferenceInfo}>
              <Heart size={20} color={theme.colors.accent} />
              <Text style={[styles.preferenceLabel, { color: theme.colors.text }]}>Pets Allowed</Text>
            </View>
            <Switch
              value={preferences.allowPets}
              onValueChange={() => togglePreference('allowPets')}
              trackColor={{ false: theme.colors.border, true: theme.colors.primary + '80' }}
              thumbColor={preferences.allowPets ? theme.colors.primary : '#f4f3f4'}
            />
          </View>
        </View>

        <View style={[styles.section, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
          <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Communication</Text>
          
          <View style={styles.optionGroup}>
            <View style={styles.optionHeader}>
              <Globe size={20} color={theme.colors.primary} />
              <Text style={[styles.optionLabel, { color: theme.colors.text }]}>Preferred Language</Text>
            </View>
            <View style={styles.chipsRow}>
              {languages.map(lang => (
                <TouchableOpacity
                  key={lang}
                  style={[
                    styles.chip,
                    { borderColor: theme.colors.border },
                    preferences.preferredLanguage === lang && { backgroundColor: theme.colors.primary, borderColor: theme.colors.primary }
                  ]}
                  onPress={() => setPreferences(prev => ({ ...prev, preferredLanguage: lang }))}
                >
                  <Text style={[
                    styles.chipText,
                    { color: theme.colors.text },
                    preferences.preferredLanguage === lang && { color: '#FFFFFF' }
                  ]}>{lang}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          <View style={[styles.divider, { backgroundColor: theme.colors.border, marginVertical: 12 }]} />

          <View style={styles.optionGroup}>
            <View style={styles.optionHeader}>
              <MessageCircle size={20} color={theme.colors.secondary} />
              <Text style={[styles.optionLabel, { color: theme.colors.text }]}>Conversation Level</Text>
            </View>
            <View style={styles.chipsRow}>
              {conversationLevels.map(level => (
                <TouchableOpacity
                  key={level}
                  style={[
                    styles.chip,
                    { borderColor: theme.colors.border },
                    preferences.conversationLevel === level && { backgroundColor: theme.colors.secondary, borderColor: theme.colors.secondary }
                  ]}
                  onPress={() => setPreferences(prev => ({ ...prev, conversationLevel: level }))}
                >
                  <Text style={[
                    styles.chipText,
                    { color: theme.colors.text },
                    preferences.conversationLevel === level && { color: '#FFFFFF' }
                  ]}>{level}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </View>

        <TouchableOpacity 
          style={[styles.saveButtonLarge, { backgroundColor: theme.colors.primary }]}
          onPress={handleSave}
          disabled={isSaving}
        >
          {isSaving ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <Text style={styles.saveButtonText}>Save Preferences</Text>
          )}
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 60,
    paddingBottom: 20,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
  },
  backButton: {
    padding: 8,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  saveButton: {
    padding: 8,
  },
  content: {
    padding: 20,
    gap: 24,
  },
  sectionDescription: {
    fontSize: 16,
    lineHeight: 24,
  },
  section: {
    padding: 20,
    borderRadius: 16,
    borderWidth: 1,
    gap: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  preferenceItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
  },
  preferenceInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  preferenceLabel: {
    fontSize: 16,
    fontWeight: '500',
  },
  divider: {
    height: 1,
  },
  optionGroup: {
    gap: 12,
  },
  optionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  optionLabel: {
    fontSize: 16,
    fontWeight: '500',
  },
  chipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
    borderWidth: 1,
  },
  chipText: {
    fontSize: 14,
    fontWeight: '500',
  },
  saveButtonLarge: {
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 20,
  },
  saveButtonText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '600',
  },
});
