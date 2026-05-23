import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  ActivityIndicator,
  Switch,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useTheme } from '@/contexts/ThemeContext';
import { api } from '@/utils/api';
import { Shield, Lock, Smartphone, Monitor, LogOut, ArrowLeft, ChevronRight, Key } from 'lucide-react-native';

interface Session {
  id: string;
  deviceName: string;
  location: string;
  lastActive: string;
  isCurrent: boolean;
}

export default function SecurityScreen() {
  const { theme } = useTheme();
  const router = useRouter();

  const [isLoading, setIsLoading] = useState(true);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [is2FAEnabled, setIs2FAEnabled] = useState(false);
  const [showPasswordChange, setShowPasswordChange] = useState(false);

  const [passwordData, setPasswordData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });

  useEffect(() => {
    fetchSecurityData();
  }, []);

  const fetchSecurityData = async () => {
    try {
      // Fetch active sessions
      const sessionData = await api.get<any[]>('/security/sessions');
      setSessions(sessionData.map(s => ({
        id: s.id,
        deviceName: s.device || 'Unknown Device',
        location: s.location || 'Unknown Location',
        lastActive: s.lastActive,
        isCurrent: s.isCurrent,
      })));

      // Fetch 2FA status - assuming an endpoint exists or part of user profile
      // For now we'll just mock or set to false
      setIs2FAEnabled(false);
    } catch (error) {
      console.error('Error fetching security data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handlePasswordChange = async () => {
    if (!passwordData.currentPassword || !passwordData.newPassword || !passwordData.confirmPassword) {
      Alert.alert('Error', 'Please fill in all fields');
      return;
    }

    if (passwordData.newPassword !== passwordData.confirmPassword) {
      Alert.alert('Error', 'Passwords do not match');
      return;
    }

    try {
      setIsLoading(true);
      await api.post('/security/change-password', {
        currentPassword: passwordData.currentPassword,
        newPassword: passwordData.newPassword,
      });
      setShowPasswordChange(false);
      setPasswordData({ currentPassword: '', newPassword: '', confirmPassword: '' });
      Alert.alert('Success', 'Password changed successfully!');
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to change password');
    } finally {
      setIsLoading(false);
    }
  };

  const handleRevokeSession = (sessionId: string) => {
    Alert.alert(
      'Logout Session',
      'Are you sure you want to log out from this device?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Logout',
          style: 'destructive',
          onPress: async () => {
            try {
              setIsLoading(true);
              await api.delete(`/security/sessions/${sessionId}`);
              fetchSecurityData();
            } catch (error: any) {
              Alert.alert('Error', error.message || 'Failed to revoke session');
            } finally {
              setIsLoading(false);
            }
          },
        },
      ]
    );
  };

  const toggle2FA = async () => {
    try {
      setIsLoading(true);
      if (is2FAEnabled) {
        await api.post('/security/disable-2fa', {});
        setIs2FAEnabled(false);
        Alert.alert('Success', '2FA disabled successfully');
      } else {
        await api.post('/security/enable-2fa', {});
        setIs2FAEnabled(true);
        Alert.alert('Success', '2FA enabled successfully');
      }
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to update 2FA status');
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading && sessions.length === 0) {
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
        <Text style={[styles.title, { color: theme.colors.text }]}>Security Settings</Text>
        <View style={styles.placeholder} />
      </View>

      <View style={styles.content}>
        {/* Password Section */}
        <View style={[styles.section, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
          <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Login Security</Text>
          
          <TouchableOpacity 
            style={styles.menuItem}
            onPress={() => setShowPasswordChange(!showPasswordChange)}
          >
            <View style={styles.menuInfo}>
              <Lock size={20} color={theme.colors.primary} />
              <Text style={[styles.menuLabel, { color: theme.colors.text }]}>Change Password</Text>
            </View>
            <ChevronRight size={20} color={theme.colors.textSecondary} />
          </TouchableOpacity>

          {showPasswordChange && (
            <View style={styles.passwordForm}>
              <TextInput
                style={[styles.input, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border, color: theme.colors.text }]}
                placeholder="Current Password"
                placeholderTextColor={theme.colors.textSecondary}
                value={passwordData.currentPassword}
                onChangeText={(text) => setPasswordData(prev => ({ ...prev, currentPassword: text }))}
                secureTextEntry
              />
              <TextInput
                style={[styles.input, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border, color: theme.colors.text }]}
                placeholder="New Password"
                placeholderTextColor={theme.colors.textSecondary}
                value={passwordData.newPassword}
                onChangeText={(text) => setPasswordData(prev => ({ ...prev, newPassword: text }))}
                secureTextEntry
              />
              <TextInput
                style={[styles.input, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border, color: theme.colors.text }]}
                placeholder="Confirm New Password"
                placeholderTextColor={theme.colors.textSecondary}
                value={passwordData.confirmPassword}
                onChangeText={(text) => setPasswordData(prev => ({ ...prev, confirmPassword: text }))}
                secureTextEntry
              />
              <TouchableOpacity
                style={[styles.changeButton, { backgroundColor: theme.colors.primary }]}
                onPress={handlePasswordChange}
              >
                <Text style={styles.changeButtonText}>Update Password</Text>
              </TouchableOpacity>
            </View>
          )}

          <View style={[styles.divider, { backgroundColor: theme.colors.border }]} />

          <View style={styles.preferenceItem}>
            <View style={styles.preferenceInfo}>
              <Smartphone size={20} color={theme.colors.secondary} />
              <View>
                <Text style={[styles.preferenceLabel, { color: theme.colors.text }]}>Two-Factor Auth</Text>
                <Text style={[styles.preferenceSublabel, { color: theme.colors.textSecondary }]}>Protect with phone/email OTP</Text>
              </View>
            </View>
            <Switch
              value={is2FAEnabled}
              onValueChange={toggle2FA}
              trackColor={{ false: theme.colors.border, true: theme.colors.primary + '80' }}
              thumbColor={is2FAEnabled ? theme.colors.primary : '#f4f3f4'}
            />
          </View>
        </View>

        {/* Active Sessions */}
        <View style={[styles.section, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
          <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Active Sessions</Text>
          <Text style={[styles.sectionSubtitle, { color: theme.colors.textSecondary }]}>Devices currently logged into your account</Text>
          
          <View style={styles.sessionList}>
            {sessions.map((session) => (
              <View key={session.id} style={styles.sessionItem}>
                <View style={[styles.sessionIcon, { backgroundColor: theme.colors.surface }]}>
                  {session.deviceName.toLowerCase().includes('phone') ? <Smartphone size={20} color={theme.colors.text} /> : <Monitor size={20} color={theme.colors.text} />}
                </View>
                <View style={styles.sessionInfo}>
                  <View style={styles.sessionHeader}>
                    <Text style={[styles.sessionDevice, { color: theme.colors.text }]}>{session.deviceName}</Text>
                    {session.isCurrent && (
                      <View style={[styles.currentBadge, { backgroundColor: theme.colors.success + '20' }]}>
                        <Text style={[styles.currentText, { color: theme.colors.success }]}>This Device</Text>
                      </View>
                    )}
                  </View>
                  <Text style={[styles.sessionDetails, { color: theme.colors.textSecondary }]}>{session.location} • {new Date(session.lastActive).toLocaleString()}</Text>
                </View>
                {!session.isCurrent && (
                  <TouchableOpacity onPress={() => handleRevokeSession(session.id)} style={styles.revokeButton}>
                    <LogOut size={20} color={theme.colors.error} />
                  </TouchableOpacity>
                )}
              </View>
            ))}
          </View>
        </View>

        <TouchableOpacity 
          style={[styles.dangerButton, { borderColor: theme.colors.error }]}
          onPress={() => Alert.alert('Delete Account', 'Are you sure? This cannot be undone.')}
        >
          <Shield size={20} color={theme.colors.error} />
          <Text style={[styles.dangerText, { color: theme.colors.error }]}>Delete Account</Text>
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
  placeholder: {
    width: 40,
  },
  content: {
    padding: 20,
    gap: 24,
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
  },
  sectionSubtitle: {
    fontSize: 14,
    marginTop: -8,
    marginBottom: 8,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
  },
  menuInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  menuLabel: {
    fontSize: 16,
    fontWeight: '500',
  },
  passwordForm: {
    gap: 12,
    marginTop: 8,
  },
  input: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    fontSize: 16,
  },
  changeButton: {
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 4,
  },
  changeButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  divider: {
    height: 1,
  },
  preferenceItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
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
  preferenceSublabel: {
    fontSize: 12,
  },
  sessionList: {
    gap: 16,
  },
  sessionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  sessionIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sessionInfo: {
    flex: 1,
  },
  sessionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  sessionDevice: {
    fontSize: 16,
    fontWeight: '600',
  },
  currentBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  currentText: {
    fontSize: 10,
    fontWeight: 'bold',
  },
  sessionDetails: {
    fontSize: 12,
  },
  revokeButton: {
    padding: 8,
  },
  dangerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderRadius: 12,
    borderWidth: 1,
    gap: 8,
    marginTop: 12,
  },
  dangerText: {
    fontSize: 16,
    fontWeight: '600',
  },
});
