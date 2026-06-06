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
  Modal,
  Pressable,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useTheme } from '@/contexts/ThemeContext';
import { useAuth } from '@/contexts/AuthContext';
import { api } from '@/utils/api';
import { Shield, Lock, Smartphone, Monitor, LogOut, ArrowLeft, ChevronRight, Key } from 'lucide-react-native';
import Svg, { Path } from 'react-native-svg';
import { Config } from '@/utils/config';
import { googleAuthHelper } from '@/utils/googleAuth';

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
  const { user, linkGoogle, unlinkGoogle } = useAuth();

  const [isLoading, setIsLoading] = useState(true);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [is2FAEnabled, setIs2FAEnabled] = useState(false);
  const [showPasswordChange, setShowPasswordChange] = useState(false);
  const [showGoogleModal, setShowGoogleModal] = useState(false);
  const [googleEmail, setGoogleEmail] = useState('');

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
      try {
        const sessionData = await api.get<any[]>('/security/sessions');
        setSessions(sessionData.map(s => ({
          id: s.id,
          deviceName: s.device || 'Unknown Device',
          location: s.location || 'Unknown Location',
          lastActive: s.lastActive,
          isCurrent: s.isCurrent,
        })));
      } catch (e) {
        console.warn('Sessions API not available, falling back to local device session info.');
        // Fallback to local session (Current Device)
        setSessions([
          {
            id: 'current',
            deviceName: 'Active Session (Current Device)',
            location: 'Local Connection',
            lastActive: new Date().toISOString(),
            isCurrent: true,
          }
        ]);
      }

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

  const handleLinkGoogleMock = async (selectedEmail: string) => {
    if (!selectedEmail) return;
    setIsLoading(true);
    const mockToken = `mock_${selectedEmail.trim().toLowerCase()}`;
    const success = await linkGoogle(mockToken);
    setIsLoading(false);
    if (success) {
      Alert.alert('Success', 'Google account linked successfully!');
      fetchSecurityData();
    } else {
      Alert.alert('Link Failed', 'Failed to link Google account.');
    }
  };

  const handleLinkGoogleReal = async () => {
    try {
      setIsLoading(true);
      const token = await googleAuthHelper.startGoogleAuth();
      setIsLoading(false);
      
      if (token) {
        setIsLoading(true);
        const success = await linkGoogle(token);
        setIsLoading(false);
        if (success) {
          Alert.alert('Success', 'Google account linked successfully!');
          fetchSecurityData();
        } else {
          Alert.alert('Link Failed', 'Failed to link Google account.');
        }
      }
    } catch (error: any) {
      setIsLoading(false);
      if (!error.message?.includes('cancelled') && !error.message?.includes('closed')) {
        Alert.alert('Google Link Error', error.message || 'An error occurred during Google linking.');
      }
    }
  };

  const handleUnlinkGoogle = async () => {
    Alert.alert(
      'Unlink Google Account',
      'Are you sure you want to unlink your Google account?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Unlink',
          style: 'destructive',
          onPress: async () => {
            setIsLoading(true);
            const success = await unlinkGoogle();
            setIsLoading(false);
            if (success) {
              Alert.alert('Success', 'Google account unlinked successfully!');
              fetchSecurityData();
            } else {
              Alert.alert('Unlink Failed', 'Cannot unlink Google account. Ensure you have a password set first.');
            }
          },
        },
      ]
    );
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


        </View>

        {/* Linked Accounts */}
        <View style={[styles.section, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
          <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Linked Accounts</Text>
          <Text style={[styles.sectionSubtitle, { color: theme.colors.textSecondary }]}>Manage your connected social login providers</Text>
          
          <View style={styles.menuItem}>
            <View style={styles.menuInfo}>
              <Svg width="20" height="20" viewBox="0 0 18 18">
                <Path fill="#4285F4" d="M17.64 9.2c0-.63-.06-1.25-.16-1.84H9v3.47h4.84a4.14 4.14 0 0 1-1.8 2.71v2.26h2.91c1.7-1.56 2.69-3.86 2.69-6.6z" />
                <Path fill="#34A853" d="M9 18c2.43 0 4.47-.8 5.96-2.2l-2.91-2.26c-.8.54-1.83.86-3.05.86-2.34 0-4.33-1.58-5.04-3.7H.9v2.33A9 9 0 0 0 9 18z" />
                <Path fill="#FBBC05" d="M3.96 10.7a5.4 5.4 0 0 1 0-3.4V4.97H.9a9 9 0 0 0 0 8.06l3.06-2.33z" />
                <Path fill="#EA4335" d="M9 3.58c1.32 0 2.5.45 3.44 1.35L15 2.1A9 9 0 0 0 .9 4.97l3.06 2.33C4.67 5.16 6.66 3.58 9 3.58z" />
              </Svg>
              <View style={{ marginLeft: 8 }}>
                <Text style={[styles.menuLabel, { color: theme.colors.text }]}>Google</Text>
                <Text style={[styles.preferenceSublabel, { color: theme.colors.textSecondary }]}>
                  {user?.isGoogleLinked ? 'Linked' : 'Not Linked'}
                </Text>
              </View>
            </View>
            <TouchableOpacity
              style={[
                styles.linkActionButton,
                {
                  borderColor: user?.isGoogleLinked ? theme.colors.border : theme.colors.primary,
                  backgroundColor: user?.isGoogleLinked ? 'transparent' : theme.colors.primary + '10'
                }
              ]}
              onPress={() => {
                if (user?.isGoogleLinked) {
                  handleUnlinkGoogle();
                } else {
                  if (Config.USE_MOCK_GOOGLE_AUTH && __DEV__) {
                    setShowGoogleModal(true);
                  } else {
                    handleLinkGoogleReal();
                  }
                }
              }}
            >
              <Text
                style={[
                  styles.linkActionText,
                  { color: user?.isGoogleLinked ? theme.colors.textSecondary : theme.colors.primary }
                ]}
              >
                {user?.isGoogleLinked ? 'Unlink' : 'Link'}
              </Text>
            </TouchableOpacity>
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

      <Modal
        visible={showGoogleModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowGoogleModal(false)}
      >
        <View style={styles.modalOverlay}>
          <Pressable style={styles.modalDismiss} onPress={() => setShowGoogleModal(false)} />
          <View style={[styles.modalCard, { backgroundColor: theme.colors.background, borderColor: theme.colors.border }]}>
            <Text style={[styles.modalTitle, { color: theme.colors.text }]}>Developer Google Link</Text>
            <Text style={[styles.modalSubtitle, { color: theme.colors.textSecondary }]}>
              Enter an email to simulate Google Identity linking.
            </Text>

            <TextInput
              style={[styles.modalInput, { color: theme.colors.text, borderColor: theme.colors.border, backgroundColor: theme.colors.surface }]}
              placeholder="user@example.com"
              placeholderTextColor={theme.colors.textSecondary}
              value={googleEmail}
              onChangeText={setGoogleEmail}
              keyboardType="email-address"
              autoCapitalize="none"
            />

            <View style={styles.presetContainer}>
              <Text style={[styles.presetTitle, { color: theme.colors.textSecondary }]}>Quick Select:</Text>
              <View style={styles.presetButtons}>
                <TouchableOpacity 
                  style={[styles.presetButton, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}
                  onPress={() => setGoogleEmail('john@example.com')}
                >
                  <Text style={[styles.presetText, { color: theme.colors.text }]}>John (Passenger)</Text>
                </TouchableOpacity>
                <TouchableOpacity 
                  style={[styles.presetButton, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}
                  onPress={() => setGoogleEmail('dave@example.com')}
                >
                  <Text style={[styles.presetText, { color: theme.colors.text }]}>Dave (Driver)</Text>
                </TouchableOpacity>
                <TouchableOpacity 
                  style={[styles.presetButton, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}
                  onPress={() => setGoogleEmail('newlink@example.com')}
                >
                  <Text style={[styles.presetText, { color: theme.colors.text }]}>New Link Email</Text>
                </TouchableOpacity>
              </View>
            </View>

            <TouchableOpacity 
              style={[styles.modalSubmitButton, { backgroundColor: theme.colors.primary }]}
              onPress={() => {
                if (!googleEmail) {
                  Alert.alert('Error', 'Please enter an email address');
                  return;
                }
                setShowGoogleModal(false);
                handleLinkGoogleMock(googleEmail);
              }}
            >
              <Text style={styles.modalSubmitButtonText}>Link Account</Text>
            </TouchableOpacity>

            <TouchableOpacity 
              style={styles.modalCancelButton}
              onPress={() => setShowGoogleModal(false)}
            >
              <Text style={[styles.modalCancelButtonText, { color: theme.colors.textSecondary }]}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
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
  linkActionButton: {
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
  },
  linkActionText: {
    fontSize: 14,
    fontWeight: '600',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalDismiss: {
    flex: 1,
  },
  modalCard: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderTopWidth: 1,
    borderLeftWidth: 1,
    borderRightWidth: 1,
    padding: 24,
    paddingBottom: Platform.OS === 'ios' ? 40 : 24,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 8,
    textAlign: 'center',
  },
  modalSubtitle: {
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 20,
  },
  modalInput: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 14,
    fontSize: 16,
    marginBottom: 16,
  },
  presetContainer: {
    marginBottom: 20,
  },
  presetTitle: {
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 8,
  },
  presetButtons: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  presetButton: {
    borderWidth: 1,
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  presetText: {
    fontSize: 12,
  },
  modalSubmitButton: {
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    marginBottom: 12,
  },
  modalSubmitButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  modalCancelButton: {
    paddingVertical: 12,
    alignItems: 'center',
  },
  modalCancelButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
});
