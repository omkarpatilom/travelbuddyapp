import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  TextInput,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useTheme } from '@/contexts/ThemeContext';
import { Phone, MessageSquare, ArrowLeft, RefreshCw, X } from 'lucide-react-native';
import { phoneAuthService, PhoneAuthResponse } from '@/utils/phoneAuth';

interface PhoneAuthModalProps {
  visible: boolean;
  mode: 'register' | 'login';
  onClose: () => void;
  onSuccess: (user: any, token: string) => void;
  initialUserData?: any;
}

type AuthStep = 'phone' | 'otp';

export default function PhoneAuthModal({
  visible,
  mode,
  onClose,
  onSuccess,
  initialUserData,
}: PhoneAuthModalProps) {
  const [step, setStep] = useState<AuthStep>('phone');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [otp, setOtp] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [countdown, setCountdown] = useState(0);
  const [canResend, setCanResend] = useState(false);

  const { theme } = useTheme();
  const otpInputRefs = useRef<TextInput[]>([]);
  const countdownInterval = useRef<NodeJS.Timeout>();

  useEffect(() => {
    if (visible) {
      resetForm();
    }
  }, [visible, mode]);

  useEffect(() => {
    if (countdown > 0) {
      countdownInterval.current = setTimeout(() => {
        setCountdown(countdown - 1);
      }, 1000);
    } else {
      setCanResend(true);
    }

    return () => {
      if (countdownInterval.current) {
        clearTimeout(countdownInterval.current);
      }
    };
  }, [countdown]);

  const resetForm = () => {
    setStep('phone');
    setPhoneNumber('');
    setOtp('');
    setError('');
    setIsLoading(false);
    setCountdown(0);
    setCanResend(false);
  };

  const formatPhoneNumber = (text: string) => {
    // Remove all non-digit characters except +
    let cleaned = text.replace(/[^\d+]/g, '');
    
    // Ensure it starts with +
    if (!cleaned.startsWith('+') && cleaned.length > 0) {
      cleaned = '+' + cleaned;
    }
    
    return cleaned;
  };

  const handlePhoneSubmit = async () => {
    setError('');
    setIsLoading(true);

    try {
      let response: PhoneAuthResponse;
      
      if (mode === 'register') {
        response = await phoneAuthService.initiateRegistration(phoneNumber);
      } else {
        response = await phoneAuthService.initiateLogin(phoneNumber);
      }

      if (response.success) {
        setStep('otp');
        setCountdown(300); // 5 minutes
        setCanResend(false);
      } else {
        setError(response.message);
      }
    } catch (error) {
      setError('Network error. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleOTPSubmit = async () => {
    if (otp.length !== 6) {
      setError('Please enter the complete 6-digit code');
      return;
    }

    setError('');
    setIsLoading(true);

    try {
      let response: PhoneAuthResponse;
      
      if (mode === 'register') {
        response = await phoneAuthService.verifyRegistrationOTP(phoneNumber, otp, initialUserData);
      } else {
        response = await phoneAuthService.verifyLoginOTP(phoneNumber, otp);
      }

      if (response.success) {
        onSuccess(response.data.user, response.data.authToken);
        onClose();
      } else {
        setError(response.message);
        // Clear OTP on error
        setOtp('');
        otpInputRefs.current[0]?.focus();
      }
    } catch (error) {
      setError('Network error. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleResendOTP = async () => {
    if (!canResend) return;

    setError('');
    setIsLoading(true);

    try {
      const response = await phoneAuthService.resendOTP(phoneNumber);
      
      if (response.success) {
        setCountdown(300); // 5 minutes
        setCanResend(false);
        setOtp('');
        Alert.alert('Success', 'New verification code sent!');
      } else {
        setError(response.message);
      }
    } catch (error) {
      setError('Failed to resend code. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleOTPChange = (text: string, index: number) => {
    // Only allow digits
    const digit = text.replace(/[^0-9]/g, '');
    
    if (digit.length > 1) return; // Prevent multiple digits
    
    const newOtp = otp.split('');
    newOtp[index] = digit;
    const updatedOtp = newOtp.join('');
    
    setOtp(updatedOtp);
    
    // Auto-focus next input
    if (digit && index < 5) {
      otpInputRefs.current[index + 1]?.focus();
    }
    
    // Auto-submit when complete
    if (updatedOtp.length === 6) {
      setTimeout(() => handleOTPSubmit(), 100);
    }
  };

  const handleOTPKeyPress = (key: string, index: number) => {
    if (key === 'Backspace' && !otp[index] && index > 0) {
      otpInputRefs.current[index - 1]?.focus();
    }
  };

  const formatCountdown = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const renderPhoneStep = () => (
    <View style={styles.stepContainer}>
      <View style={styles.iconContainer}>
        <Phone size={40} color={theme.colors.primary} />
      </View>
      
      <Text style={[styles.title, { color: theme.colors.text }]}>
        {mode === 'register' ? 'Create Account' : 'Welcome Back'}
      </Text>
      
      <Text style={[styles.subtitle, { color: theme.colors.textSecondary }]}>
        {mode === 'register' 
          ? 'Enter your phone number to create your account'
          : 'Enter your phone number to sign in'
        }
      </Text>

      <View style={[styles.inputContainer, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
        <Phone size={20} color={theme.colors.textSecondary} />
        <TextInput
          style={[styles.phoneInput, { color: theme.colors.text }]}
          placeholder="+1 234 567 8900"
          placeholderTextColor={theme.colors.textSecondary}
          value={phoneNumber}
          onChangeText={(text) => setPhoneNumber(formatPhoneNumber(text))}
          keyboardType="phone-pad"
          autoFocus
        />
      </View>

      {error ? (
        <Text style={[styles.errorText, { color: theme.colors.error }]}>
          {error}
        </Text>
      ) : null}

      <TouchableOpacity
        style={[
          styles.primaryButton,
          { backgroundColor: theme.colors.primary },
          (!phoneNumber || isLoading) && styles.disabledButton,
        ]}
        onPress={handlePhoneSubmit}
        disabled={!phoneNumber || isLoading}
      >
        {isLoading ? (
          <ActivityIndicator color="#FFFFFF" />
        ) : (
          <Text style={styles.primaryButtonText}>
            Send Verification Code
          </Text>
        )}
      </TouchableOpacity>

      <Text style={[styles.disclaimer, { color: theme.colors.textSecondary }]}>
        By continuing, you agree to receive SMS messages for verification purposes.
      </Text>
    </View>
  );

  const renderOTPStep = () => (
    <View style={styles.stepContainer}>
      <TouchableOpacity
        style={styles.backButton}
        onPress={() => setStep('phone')}
      >
        <ArrowLeft size={24} color={theme.colors.text} />
      </TouchableOpacity>

      <View style={styles.iconContainer}>
        <MessageSquare size={40} color={theme.colors.primary} />
      </View>
      
      <Text style={[styles.title, { color: theme.colors.text }]}>
        Enter Verification Code
      </Text>
      
      <Text style={[styles.subtitle, { color: theme.colors.textSecondary }]}>
        We sent a 6-digit code to {phoneNumber}
      </Text>

      <View style={styles.otpContainer}>
        {Array.from({ length: 6 }, (_, index) => (
          <TextInput
            key={index}
            ref={(ref) => {
              if (ref) otpInputRefs.current[index] = ref;
            }}
            style={[
              styles.otpInput,
              { 
                backgroundColor: theme.colors.surface,
                borderColor: theme.colors.border,
                color: theme.colors.text,
              },
              otp[index] && { borderColor: theme.colors.primary },
            ]}
            value={otp[index] || ''}
            onChangeText={(text) => handleOTPChange(text, index)}
            onKeyPress={({ nativeEvent }) => handleOTPKeyPress(nativeEvent.key, index)}
            keyboardType="numeric"
            maxLength={1}
            textAlign="center"
          />
        ))}
      </View>

      {error ? (
        <Text style={[styles.errorText, { color: theme.colors.error }]}>
          {error}
        </Text>
      ) : null}

      <TouchableOpacity
        style={[
          styles.primaryButton,
          { backgroundColor: theme.colors.primary },
          (otp.length !== 6 || isLoading) && styles.disabledButton,
        ]}
        onPress={handleOTPSubmit}
        disabled={otp.length !== 6 || isLoading}
      >
        {isLoading ? (
          <ActivityIndicator color="#FFFFFF" />
        ) : (
          <Text style={styles.primaryButtonText}>
            Verify Code
          </Text>
        )}
      </TouchableOpacity>

      <View style={styles.resendContainer}>
        {countdown > 0 ? (
          <Text style={[styles.countdownText, { color: theme.colors.textSecondary }]}>
            Resend code in {formatCountdown(countdown)}
          </Text>
        ) : (
          <TouchableOpacity
            style={styles.resendButton}
            onPress={handleResendOTP}
            disabled={!canResend || isLoading}
          >
            <RefreshCw size={16} color={theme.colors.primary} />
            <Text style={[styles.resendText, { color: theme.colors.primary }]}>
              Resend Code
            </Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        style={styles.overlay}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <View style={[styles.modal, { backgroundColor: theme.colors.card }]}>
          <TouchableOpacity style={styles.closeButton} onPress={onClose}>
            <X size={24} color={theme.colors.textSecondary} />
          </TouchableOpacity>

          {step === 'phone' ? renderPhoneStep() : renderOTPStep()}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modal: {
    width: '100%',
    maxWidth: 400,
    borderRadius: 20,
    padding: 24,
    position: 'relative',
  },
  closeButton: {
    position: 'absolute',
    top: 16,
    right: 16,
    padding: 8,
    zIndex: 1,
  },
  stepContainer: {
    alignItems: 'center',
    gap: 20,
  },
  backButton: {
    alignSelf: 'flex-start',
    padding: 8,
    marginBottom: -12,
  },
  iconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(37, 99, 235, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    textAlign: 'center',
    lineHeight: 24,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 12,
    width: '100%',
  },
  phoneInput: {
    flex: 1,
    fontSize: 16,
  },
  otpContainer: {
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'center',
  },
  otpInput: {
    width: 48,
    height: 56,
    borderWidth: 2,
    borderRadius: 12,
    fontSize: 24,
    fontWeight: 'bold',
  },
  errorText: {
    fontSize: 14,
    textAlign: 'center',
    marginTop: -8,
  },
  primaryButton: {
    width: '100%',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  disabledButton: {
    opacity: 0.5,
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  disclaimer: {
    fontSize: 12,
    textAlign: 'center',
    lineHeight: 18,
  },
  resendContainer: {
    alignItems: 'center',
    marginTop: 8,
  },
  countdownText: {
    fontSize: 14,
  },
  resendButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  resendText: {
    fontSize: 14,
    fontWeight: '600',
  },
});