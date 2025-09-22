import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useTheme } from '@/contexts/ThemeContext';
import { usePhoneAuth } from '@/contexts/PhoneAuthContext';
import PhoneAuthModal from '@/components/PhoneAuthModal';
import { Phone, UserPlus } from 'lucide-react-native';

export default function PhoneLoginScreen() {
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');
  
  const { theme } = useTheme();
  const { login, register } = usePhoneAuth();
  const router = useRouter();

  const handleAuthSuccess = async (user: any, token: string) => {
    Alert.alert(
      'Success!',
      `Welcome ${authMode === 'register' ? 'to TravelBuddy' : 'back'}, ${user.firstName || 'User'}!`,
      [
        {
          text: 'Continue',
          onPress: () => {
            setShowAuthModal(false);
            router.replace('/(tabs)/home');
          },
        },
      ]
    );
  };

  const openAuthModal = (mode: 'login' | 'register') => {
    setAuthMode(mode);
    setShowAuthModal(true);
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <View style={styles.content}>
        <View style={styles.header}>
          <Text style={[styles.logo, { color: theme.colors.primary }]}>🚗</Text>
          <Text style={[styles.title, { color: theme.colors.text }]}>TravelBuddy</Text>
          <Text style={[styles.subtitle, { color: theme.colors.textSecondary }]}>
            Ride Together, Save Together
          </Text>
        </View>

        <View style={styles.authOptions}>
          <TouchableOpacity
            style={[styles.authButton, styles.primaryButton, { backgroundColor: theme.colors.primary }]}
            onPress={() => openAuthModal('login')}
          >
            <Phone size={24} color="#FFFFFF" />
            <Text style={styles.primaryButtonText}>Sign In with Phone</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.authButton, styles.secondaryButton, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}
            onPress={() => openAuthModal('register')}
          >
            <UserPlus size={24} color={theme.colors.primary} />
            <Text style={[styles.secondaryButtonText, { color: theme.colors.primary }]}>
              Create Account
            </Text>
          </TouchableOpacity>
        </View>

        <View style={styles.features}>
          <Text style={[styles.featuresTitle, { color: theme.colors.text }]}>
            Why choose phone authentication?
          </Text>
          
          <View style={styles.featuresList}>
            <View style={styles.featureItem}>
              <Text style={styles.featureIcon}>🔒</Text>
              <Text style={[styles.featureText, { color: theme.colors.textSecondary }]}>
                Secure verification with SMS
              </Text>
            </View>
            
            <View style={styles.featureItem}>
              <Text style={styles.featureIcon}>⚡</Text>
              <Text style={[styles.featureText, { color: theme.colors.textSecondary }]}>
                Quick and easy sign-up
              </Text>
            </View>
            
            <View style={styles.featureItem}>
              <Text style={styles.featureIcon}>🌍</Text>
              <Text style={[styles.featureText, { color: theme.colors.textSecondary }]}>
                Works worldwide
              </Text>
            </View>
          </View>
        </View>

        <Text style={[styles.disclaimer, { color: theme.colors.textSecondary }]}>
          By continuing, you agree to our Terms of Service and Privacy Policy.
          Standard message and data rates may apply.
        </Text>
      </View>

      <PhoneAuthModal
        visible={showAuthModal}
        mode={authMode}
        onClose={() => setShowAuthModal(false)}
        onSuccess={handleAuthSuccess}
        initialUserData={{
          firstName: '',
          lastName: '',
          email: '',
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flex: 1,
    padding: 24,
    justifyContent: 'center',
    gap: 40,
  },
  header: {
    alignItems: 'center',
    gap: 16,
  },
  logo: {
    fontSize: 80,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
  },
  subtitle: {
    fontSize: 18,
    textAlign: 'center',
  },
  authOptions: {
    gap: 16,
  },
  authButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderRadius: 12,
    gap: 12,
  },
  primaryButton: {
    // Primary button styles handled by backgroundColor prop
  },
  secondaryButton: {
    borderWidth: 2,
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '600',
  },
  secondaryButtonText: {
    fontSize: 18,
    fontWeight: '600',
  },
  features: {
    gap: 16,
  },
  featuresTitle: {
    fontSize: 18,
    fontWeight: '600',
    textAlign: 'center',
  },
  featuresList: {
    gap: 12,
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  featureIcon: {
    fontSize: 24,
    width: 32,
    textAlign: 'center',
  },
  featureText: {
    fontSize: 16,
    flex: 1,
  },
  disclaimer: {
    fontSize: 12,
    textAlign: 'center',
    lineHeight: 18,
  },
});