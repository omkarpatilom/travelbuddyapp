import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { Link, useRouter } from 'expo-router';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import { Mail, Lock, User, Phone, Eye, EyeOff } from 'lucide-react-native';
import { Modal, Pressable } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { userService } from '@/services/user.service';
import { Config } from '@/utils/config';
import { googleAuthHelper } from '@/utils/googleAuth';

export default function RegisterScreen() {
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    password: '',
    confirmPassword: '',
  });
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [showGoogleModal, setShowGoogleModal] = useState(false);
  const [googleEmail, setGoogleEmail] = useState('');
  
  const { register, loginWithGoogle } = useAuth();
  const { theme } = useTheme();
  const router = useRouter();

  const updateFormData = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const validateForm = () => {
    if (!formData.firstName || !formData.lastName || !formData.email || 
        !formData.phone || !formData.password || !formData.confirmPassword) {
      Alert.alert('Error', 'Please fill in all fields');
      return false;
    }
    
    if (formData.password !== formData.confirmPassword) {
      Alert.alert('Error', 'Passwords do not match');
      return false;
    }

    if (formData.password.length < 6) {
      Alert.alert('Error', 'Password must be at least 6 characters long');
      return false;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(formData.email)) {
      Alert.alert('Error', 'Please enter a valid email address');
      return false;
    }

    return true;
  };

  const handleRegister = async () => {
    if (!validateForm()) return;

    setIsLoading(true);
    const success = await register({
      email: formData.email,
      password: formData.password,
      firstName: formData.firstName,
      lastName: formData.lastName,
      phone: formData.phone,
    });
    setIsLoading(false);

    if (success) {
      router.replace('/(tabs)/home');
    } else {
      Alert.alert('Registration Failed', 'Please try again');
    }
  };

  const handleGoogleLogin = async (selectedEmail: string) => {
    if (!selectedEmail) return;
    
    setIsLoading(true);
    const mockToken = `mock_${selectedEmail.trim().toLowerCase()}`;
    const success = await loginWithGoogle(mockToken);
    setIsLoading(false);

    if (success) {
      try {
        const profile = await userService.getMe();
        if (!profile.phoneNumber) {
          Alert.alert(
            'Onboarding Required',
            'Please complete your profile by adding your phone number.',
            [
              {
                text: 'OK',
                onPress: () => router.replace('/profile/edit?onboarding=true'),
              }
            ]
          );
        } else {
          router.replace('/(tabs)/home');
        }
      } catch (err) {
        // Fallback to home
        router.replace('/(tabs)/home');
      }
    } else {
      Alert.alert('Login Failed', 'Invalid Google token or authentication failure.');
    }
  };

  const handleGooglePress = async () => {
    if (Config.USE_MOCK_GOOGLE_AUTH && __DEV__) {
      setShowGoogleModal(true);
      return;
    }

    try {
      setIsLoading(true);
      const token = await googleAuthHelper.startGoogleAuth();
      setIsLoading(false);
      
      if (token) {
        setIsLoading(true);
        const success = await loginWithGoogle(token);
        setIsLoading(false);

        if (success) {
          try {
            const profile = await userService.getMe();
            if (!profile.phoneNumber) {
              Alert.alert(
                'Onboarding Required',
                'Please complete your profile by adding your phone number.',
                [
                  {
                    text: 'OK',
                    onPress: () => router.replace('/profile/edit?onboarding=true'),
                  }
                ]
              );
            } else {
              router.replace('/(tabs)/home');
            }
          } catch (err) {
            router.replace('/(tabs)/home');
          }
        } else {
          Alert.alert('Login Failed', 'Google login failed on backend verification.');
        }
      }
    } catch (error: any) {
      setIsLoading(false);
      if (!error.message?.includes('cancelled') && !error.message?.includes('closed')) {
        Alert.alert('Google Authentication Error', error.message || 'An error occurred during Google sign-in.');
      }
    }
  };

  return (
    <KeyboardAvoidingView 
      style={[styles.container, { backgroundColor: theme.colors.background }]} 
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Text style={[styles.logo, { color: theme.colors.primary }]}>🚗</Text>
          <Text style={[styles.title, { color: theme.colors.text }]}>Join TravelBuddy</Text>
          <Text style={[styles.subtitle, { color: theme.colors.textSecondary }]}>
            Create your account to start sharing rides
          </Text>
        </View>

        <View style={styles.form}>
          <View style={styles.nameRow}>
            <View style={[styles.inputContainer, styles.halfWidth, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
              <User size={20} color={theme.colors.textSecondary} />
              <TextInput
                style={[styles.input, { color: theme.colors.text }]}
                placeholder="First Name"
                placeholderTextColor={theme.colors.textSecondary}
                value={formData.firstName}
                onChangeText={(value) => updateFormData('firstName', value)}
              />
            </View>

            <View style={[styles.inputContainer, styles.halfWidth, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
              <User size={20} color={theme.colors.textSecondary} />
              <TextInput
                style={[styles.input, { color: theme.colors.text }]}
                placeholder="Last Name"
                placeholderTextColor={theme.colors.textSecondary}
                value={formData.lastName}
                onChangeText={(value) => updateFormData('lastName', value)}
              />
            </View>
          </View>

          <View style={[styles.inputContainer, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
            <Mail size={20} color={theme.colors.textSecondary} />
            <TextInput
              style={[styles.input, { color: theme.colors.text }]}
              placeholder="Email"
              placeholderTextColor={theme.colors.textSecondary}
              value={formData.email}
              onChangeText={(value) => updateFormData('email', value)}
              keyboardType="email-address"
              autoCapitalize="none"
            />
          </View>

          <View style={[styles.inputContainer, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
            <Phone size={20} color={theme.colors.textSecondary} />
            <TextInput
              style={[styles.input, { color: theme.colors.text }]}
              placeholder="Phone Number"
              placeholderTextColor={theme.colors.textSecondary}
              value={formData.phone}
              onChangeText={(value) => updateFormData('phone', value)}
              keyboardType="phone-pad"
            />
          </View>

          <View style={[styles.inputContainer, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
            <Lock size={20} color={theme.colors.textSecondary} />
            <TextInput
              style={[styles.input, { color: theme.colors.text }]}
              placeholder="Password"
              placeholderTextColor={theme.colors.textSecondary}
              value={formData.password}
              onChangeText={(value) => updateFormData('password', value)}
              secureTextEntry={!showPassword}
            />
            <TouchableOpacity onPress={() => setShowPassword(!showPassword)}>
              {showPassword ? (
                <EyeOff size={20} color={theme.colors.textSecondary} />
              ) : (
                <Eye size={20} color={theme.colors.textSecondary} />
              )}
            </TouchableOpacity>
          </View>

          <View style={[styles.inputContainer, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
            <Lock size={20} color={theme.colors.textSecondary} />
            <TextInput
              style={[styles.input, { color: theme.colors.text }]}
              placeholder="Confirm Password"
              placeholderTextColor={theme.colors.textSecondary}
              value={formData.confirmPassword}
              onChangeText={(value) => updateFormData('confirmPassword', value)}
              secureTextEntry={!showConfirmPassword}
            />
            <TouchableOpacity onPress={() => setShowConfirmPassword(!showConfirmPassword)}>
              {showConfirmPassword ? (
                <EyeOff size={20} color={theme.colors.textSecondary} />
              ) : (
                <Eye size={20} color={theme.colors.textSecondary} />
              )}
            </TouchableOpacity>
          </View>

          <TouchableOpacity 
            style={[styles.registerButton, { backgroundColor: theme.colors.primary }]}
            onPress={handleRegister}
            disabled={isLoading}
          >
            {isLoading ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={styles.registerButtonText}>Create Account</Text>
            )}
          </TouchableOpacity>

          <View style={styles.dividerContainer}>
            <View style={[styles.dividerLine, { backgroundColor: theme.colors.border }]} />
            <Text style={[styles.dividerText, { color: theme.colors.textSecondary }]}>or</Text>
            <View style={[styles.dividerLine, { backgroundColor: theme.colors.border }]} />
          </View>

          <TouchableOpacity 
            style={[styles.googleButton, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}
            onPress={handleGooglePress}
            disabled={isLoading}
          >
            <Svg width="18" height="18" viewBox="0 0 18 18" style={{ marginRight: 12 }}>
              <Path fill="#4285F4" d="M17.64 9.2c0-.63-.06-1.25-.16-1.84H9v3.47h4.84a4.14 4.14 0 0 1-1.8 2.71v2.26h2.91c1.7-1.56 2.69-3.86 2.69-6.6z" />
              <Path fill="#34A853" d="M9 18c2.43 0 4.47-.8 5.96-2.2l-2.91-2.26c-.8.54-1.83.86-3.05.86-2.34 0-4.33-1.58-5.04-3.7H.9v2.33A9 9 0 0 0 9 18z" />
              <Path fill="#FBBC05" d="M3.96 10.7a5.4 5.4 0 0 1 0-3.4V4.97H.9a9 9 0 0 0 0 8.06l3.06-2.33z" />
              <Path fill="#EA4335" d="M9 3.58c1.32 0 2.5.45 3.44 1.35L15 2.1A9 9 0 0 0 .9 4.97l3.06 2.33C4.67 5.16 6.66 3.58 9 3.58z" />
            </Svg>
            <Text style={[styles.googleButtonText, { color: theme.colors.text }]}>Continue with Google</Text>
          </TouchableOpacity>

          <View style={styles.loginContainer}>
            <Text style={[styles.loginText, { color: theme.colors.textSecondary }]}>
              Already have an account?{' '}
            </Text>
            <Link href="/auth/login" asChild>
              <TouchableOpacity>
                <Text style={[styles.loginLink, { color: theme.colors.primary }]}>Sign In</Text>
              </TouchableOpacity>
            </Link>
          </View>
        </View>
      </ScrollView>

      <Modal
        visible={showGoogleModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowGoogleModal(false)}
      >
        <View style={styles.modalOverlay}>
          <Pressable style={styles.modalDismiss} onPress={() => setShowGoogleModal(false)} />
          <View style={[styles.modalCard, { backgroundColor: theme.colors.background, borderColor: theme.colors.border }]}>
            <Text style={[styles.modalTitle, { color: theme.colors.text }]}>Developer Google Sign-In</Text>
            <Text style={[styles.modalSubtitle, { color: theme.colors.textSecondary }]}>
              Enter an email to simulate Google Authentication.
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
                  onPress={() => setGoogleEmail('newuser@example.com')}
                >
                  <Text style={[styles.presetText, { color: theme.colors.text }]}>New Account</Text>
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
                handleGoogleLogin(googleEmail);
              }}
            >
              <Text style={styles.modalSubmitButtonText}>Authenticate</Text>
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
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 24,
    paddingTop: 60,
  },
  header: {
    alignItems: 'center',
    marginBottom: 32,
  },
  logo: {
    fontSize: 60,
    marginBottom: 16,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    textAlign: 'center',
  },
  form: {
    width: '100%',
  },
  nameRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginBottom: 16,
    gap: 12,
  },
  halfWidth: {
    flex: 1,
  },
  input: {
    flex: 1,
    fontSize: 16,
  },
  registerButton: {
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 8,
    marginBottom: 24,
  },
  registerButtonText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '600',
  },
  loginContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  loginText: {
    fontSize: 16,
  },
  loginLink: {
    fontSize: 16,
    fontWeight: '600',
  },
  dividerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 16,
  },
  dividerLine: {
    flex: 1,
    height: 1,
  },
  dividerText: {
    paddingHorizontal: 16,
    fontSize: 14,
    fontWeight: '500',
  },
  googleButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    borderWidth: 1,
    paddingVertical: 16,
    marginBottom: 24,
  },
  googleButtonText: {
    fontSize: 16,
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