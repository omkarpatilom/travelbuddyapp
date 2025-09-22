import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useTheme } from '@/contexts/ThemeContext';
import { usePhoneAuth } from '@/contexts/PhoneAuthContext';
import { User, Mail, ArrowLeft } from 'lucide-react-native';
import PhoneInput from '@/components/PhoneInput';
import PhoneAuthModal from '@/components/PhoneAuthModal';
import { PhoneValidationResult } from '@/utils/phoneValidation';

export default function PhoneRegisterScreen() {
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phoneNumber: '',
  });
  const [phoneValidation, setPhoneValidation] = useState<PhoneValidationResult>({ isValid: true });
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const { theme } = useTheme();
  const router = useRouter();

  const updateFormData = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    // Clear error when user starts typing
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: '' }));
    }
  };

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.firstName.trim()) {
      newErrors.firstName = 'First name is required';
    }

    if (!formData.lastName.trim()) {
      newErrors.lastName = 'Last name is required';
    }

    if (formData.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = 'Please enter a valid email address';
    }

    if (!formData.phoneNumber) {
      newErrors.phoneNumber = 'Phone number is required';
    } else if (!phoneValidation.isValid) {
      newErrors.phoneNumber = phoneValidation.error || 'Invalid phone number';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleContinue = () => {
    if (validateForm()) {
      setShowAuthModal(true);
    }
  };

  const handleAuthSuccess = (user: any, token: string) => {
    Alert.alert(
      'Welcome to TravelBuddy!',
      'Your account has been created successfully.',
      [
        {
          text: 'Get Started',
          onPress: () => {
            setShowAuthModal(false);
            router.replace('/(tabs)/home');
          },
        },
      ]
    );
  };

  return (
    <KeyboardAvoidingView 
      style={[styles.container, { backgroundColor: theme.colors.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={[styles.header, { backgroundColor: theme.colors.surface, borderBottomColor: theme.colors.border }]}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <ArrowLeft size={24} color={theme.colors.text} />
          </TouchableOpacity>
          <Text style={[styles.title, { color: theme.colors.text }]}>Create Account</Text>
          <View style={styles.placeholder} />
        </View>

        <View style={styles.content}>
          <View style={styles.intro}>
            <Text style={[styles.introTitle, { color: theme.colors.text }]}>
              Join TravelBuddy
            </Text>
            <Text style={[styles.introSubtitle, { color: theme.colors.textSecondary }]}>
              Create your account to start sharing rides and saving money
            </Text>
          </View>

          <View style={styles.form}>
            {/* Name Fields */}
            <View style={styles.nameRow}>
              <View style={[styles.inputContainer, styles.halfWidth]}>
                <View style={[
                  styles.inputWrapper,
                  { backgroundColor: theme.colors.surface, borderColor: theme.colors.border },
                  errors.firstName && styles.errorBorder,
                ]}>
                  <User size={20} color={theme.colors.textSecondary} />
                  <TextInput
                    style={[styles.input, { color: theme.colors.text }]}
                    placeholder="First Name"
                    placeholderTextColor={theme.colors.textSecondary}
                    value={formData.firstName}
                    onChangeText={(value) => updateFormData('firstName', value)}
                    autoCapitalize="words"
                  />
                </View>
                {errors.firstName && (
                  <Text style={[styles.errorText, { color: theme.colors.error }]}>
                    {errors.firstName}
                  </Text>
                )}
              </View>

              <View style={[styles.inputContainer, styles.halfWidth]}>
                <View style={[
                  styles.inputWrapper,
                  { backgroundColor: theme.colors.surface, borderColor: theme.colors.border },
                  errors.lastName && styles.errorBorder,
                ]}>
                  <User size={20} color={theme.colors.textSecondary} />
                  <TextInput
                    style={[styles.input, { color: theme.colors.text }]}
                    placeholder="Last Name"
                    placeholderTextColor={theme.colors.textSecondary}
                    value={formData.lastName}
                    onChangeText={(value) => updateFormData('lastName', value)}
                    autoCapitalize="words"
                  />
                </View>
                {errors.lastName && (
                  <Text style={[styles.errorText, { color: theme.colors.error }]}>
                    {errors.lastName}
                  </Text>
                )}
              </View>
            </View>

            {/* Email Field */}
            <View style={styles.inputContainer}>
              <View style={[
                styles.inputWrapper,
                { backgroundColor: theme.colors.surface, borderColor: theme.colors.border },
                errors.email && styles.errorBorder,
              ]}>
                <Mail size={20} color={theme.colors.textSecondary} />
                <TextInput
                  style={[styles.input, { color: theme.colors.text }]}
                  placeholder="Email (optional)"
                  placeholderTextColor={theme.colors.textSecondary}
                  value={formData.email}
                  onChangeText={(value) => updateFormData('email', value)}
                  keyboardType="email-address"
                  autoCapitalize="none"
                />
              </View>
              {errors.email && (
                <Text style={[styles.errorText, { color: theme.colors.error }]}>
                  {errors.email}
                </Text>
              )}
            </View>

            {/* Phone Number Field */}
            <View style={styles.inputContainer}>
              <PhoneInput
                value={formData.phoneNumber}
                onChangeText={(value) => updateFormData('phoneNumber', value)}
                onValidationChange={setPhoneValidation}
                placeholder="Phone number"
                defaultCountry="US"
              />
              {errors.phoneNumber && (
                <Text style={[styles.errorText, { color: theme.colors.error }]}>
                  {errors.phoneNumber}
                </Text>
              )}
            </View>

            {/* Terms and Privacy */}
            <View style={[styles.termsContainer, { backgroundColor: theme.colors.surface }]}>
              <Text style={[styles.termsText, { color: theme.colors.textSecondary }]}>
                By creating an account, you agree to our{' '}
                <Text style={[styles.termsLink, { color: theme.colors.primary }]}>
                  Terms of Service
                </Text>
                {' '}and{' '}
                <Text style={[styles.termsLink, { color: theme.colors.primary }]}>
                  Privacy Policy
                </Text>
                .
              </Text>
            </View>

            {/* Continue Button */}
            <TouchableOpacity
              style={[
                styles.continueButton,
                { backgroundColor: theme.colors.primary },
                (!formData.firstName || !formData.lastName || !formData.phoneNumber || !phoneValidation.isValid) && styles.disabledButton,
              ]}
              onPress={handleContinue}
              disabled={!formData.firstName || !formData.lastName || !formData.phoneNumber || !phoneValidation.isValid}
            >
              <Text style={styles.continueButtonText}>Continue</Text>
            </TouchableOpacity>

            {/* Login Link */}
            <View style={styles.loginContainer}>
              <Text style={[styles.loginText, { color: theme.colors.textSecondary }]}>
                Already have an account?{' '}
              </Text>
              <TouchableOpacity onPress={() => router.push('/auth/phone-login')}>
                <Text style={[styles.loginLink, { color: theme.colors.primary }]}>
                  Sign In
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </ScrollView>

      <PhoneAuthModal
        visible={showAuthModal}
        mode="register"
        onClose={() => setShowAuthModal(false)}
        onSuccess={handleAuthSuccess}
        initialUserData={{
          firstName: formData.firstName,
          lastName: formData.lastName,
          email: formData.email,
        }}
      />
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
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
    flex: 1,
    padding: 24,
    gap: 32,
  },
  intro: {
    alignItems: 'center',
    gap: 8,
  },
  introTitle: {
    fontSize: 28,
    fontWeight: 'bold',
  },
  introSubtitle: {
    fontSize: 16,
    textAlign: 'center',
    lineHeight: 24,
  },
  form: {
    gap: 20,
  },
  nameRow: {
    flexDirection: 'row',
    gap: 12,
  },
  inputContainer: {
    gap: 8,
  },
  halfWidth: {
    flex: 1,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 12,
  },
  errorBorder: {
    borderColor: '#EF4444',
    borderWidth: 2,
  },
  input: {
    flex: 1,
    fontSize: 16,
  },
  errorText: {
    fontSize: 12,
    marginLeft: 4,
  },
  termsContainer: {
    padding: 16,
    borderRadius: 12,
  },
  termsText: {
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
  },
  termsLink: {
    fontWeight: '600',
  },
  continueButton: {
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 8,
  },
  disabledButton: {
    opacity: 0.5,
  },
  continueButtonText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '600',
  },
  loginContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 16,
  },
  loginText: {
    fontSize: 16,
  },
  loginLink: {
    fontSize: 16,
    fontWeight: '600',
  },
});