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
import { Bell, Mail, Smartphone, MessageSquare, ArrowLeft, Save } from 'lucide-react-native';

export default function NotificationSettingsScreen() {
  const { theme } = useTheme();
  const router = useRouter();

  const [settings, setSettings] = useState({
    enableEmail: true,
    enablePush: true,
    enableSms: false,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      const data = await api.get<any>('/notifications/preferences');
      setSettings({
        enableEmail: data.enableEmail,
        enablePush: data.enablePush,
        enableSms: data.enableSms,
      });
    } catch (error) {
      console.error('Error fetching notification settings:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const toggleSetting = (key: keyof typeof settings) => {
    setSettings(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await api.put('/notifications/preferences', {
        ...settings,
        enableInApp: true,
        rideUpdatesEnabled: true,
        bookingUpdatesEnabled: true,
        safetyAlertsEnabled: true,
        promotionsEnabled: false,
        preferredLanguage: 'en'
      });
      Alert.alert('Success', 'Notification settings updated successfully!');
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to update settings');
    } finally {
      setIsSaving(false);
    }
  };

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
        <Text style={[styles.title, { color: theme.colors.text }]}>Notification Settings</Text>
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
          Choose how you want to receive updates about your rides, bookings, and account activity.
        </Text>

        <View style={[styles.section, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
          <View style={styles.settingItem}>
            <View style={styles.settingInfo}>
              <View style={[styles.iconContainer, { backgroundColor: theme.colors.primary + '20' }]}>
                <Bell size={20} color={theme.colors.primary} />
              </View>
              <View>
                <Text style={[styles.settingLabel, { color: theme.colors.text }]}>Push Notifications</Text>
                <Text style={[styles.settingSublabel, { color: theme.colors.textSecondary }]}>Real-time alerts on your device</Text>
              </View>
            </View>
            <Switch
              value={settings.enablePush}
              onValueChange={() => toggleSetting('enablePush')}
              trackColor={{ false: theme.colors.border, true: theme.colors.primary + '80' }}
              thumbColor={settings.enablePush ? theme.colors.primary : '#f4f3f4'}
            />
          </View>

          <View style={[styles.divider, { backgroundColor: theme.colors.border }]} />

          <View style={styles.settingItem}>
            <View style={styles.settingInfo}>
              <View style={[styles.iconContainer, { backgroundColor: theme.colors.secondary + '20' }]}>
                <Mail size={20} color={theme.colors.secondary} />
              </View>
              <View>
                <Text style={[styles.settingLabel, { color: theme.colors.text }]}>Email Notifications</Text>
                <Text style={[styles.settingSublabel, { color: theme.colors.textSecondary }]}>Weekly reports and account security</Text>
              </View>
            </View>
            <Switch
              value={settings.enableEmail}
              onValueChange={() => toggleSetting('enableEmail')}
              trackColor={{ false: theme.colors.border, true: theme.colors.primary + '80' }}
              thumbColor={settings.enableEmail ? theme.colors.primary : '#f4f3f4'}
            />
          </View>

          <View style={[styles.divider, { backgroundColor: theme.colors.border }]} />

          <View style={styles.settingItem}>
            <View style={styles.settingInfo}>
              <View style={[styles.iconContainer, { backgroundColor: theme.colors.accent + '20' }]}>
                <MessageSquare size={20} color={theme.colors.accent} />
              </View>
              <View>
                <Text style={[styles.settingLabel, { color: theme.colors.text }]}>SMS Notifications</Text>
                <Text style={[styles.settingSublabel, { color: theme.colors.textSecondary }]}>Important ride updates via text</Text>
              </View>
            </View>
            <Switch
              value={settings.enableSms}
              onValueChange={() => toggleSetting('enableSms')}
              trackColor={{ false: theme.colors.border, true: theme.colors.primary + '80' }}
              thumbColor={settings.enableSms ? theme.colors.primary : '#f4f3f4'}
            />
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
    borderRadius: 16,
    borderWidth: 1,
    padding: 8,
  },
  settingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
  },
  settingInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    flex: 1,
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  settingLabel: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 2,
  },
  settingSublabel: {
    fontSize: 12,
  },
  divider: {
    height: 1,
    marginHorizontal: 16,
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
