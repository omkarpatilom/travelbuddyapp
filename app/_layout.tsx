import { useEffect } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useFrameworkReady } from '@/hooks/useFrameworkReady';
import { AuthProvider } from '@/contexts/AuthContext';
import { RideProvider } from '@/contexts/RideContext';
import { ThemeProvider } from '@/contexts/ThemeContext';
import { NotificationProvider } from '@/contexts/NotificationContext';
import ErrorBoundary from '@/components/ErrorBoundary';

export default function RootLayout() {
  useFrameworkReady();

  return (
    <ErrorBoundary>
      <ThemeProvider>
        <NotificationProvider>
          <AuthProvider>
            <RideProvider>
              <Stack screenOptions={{ headerShown: false }}>
                <Stack.Screen name="index" />
                <Stack.Screen name="auth/login" />
                <Stack.Screen name="auth/register" />
                <Stack.Screen name="(tabs)" />
                <Stack.Screen name="ride/details" />
                <Stack.Screen name="ride/offer" />
                <Stack.Screen name="ride/find" />
                <Stack.Screen name="ride/book" />
                <Stack.Screen name="ride/map-select" />
                <Stack.Screen name="booking/details" />
                <Stack.Screen name="profile/edit" />
                <Stack.Screen name="profile/vehicle" />
                <Stack.Screen name="profile/reviews" />
                <Stack.Screen name="profile/safety" />
                <Stack.Screen name="+not-found" />
              </Stack>
              <StatusBar style="auto" />
            </RideProvider>
          </AuthProvider>
        </NotificationProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}