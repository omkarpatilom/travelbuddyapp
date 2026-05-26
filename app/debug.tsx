import React, { useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { useAuth } from '@/contexts/AuthContext';
import { useRides } from '@/contexts/RideContext';
import { useVehicles } from '@/contexts/VehicleContext';
import { useSafety } from '@/contexts/SafetyContext';
import { useReviews } from '@/contexts/ReviewContext';
import { useNotifications } from '@/contexts/NotificationContext';
import { useRouter } from 'expo-router';

export default function DebugScreen() {
  const [logs, setLogs] = useState<string[]>([]);
  const [isTesting, setIsTesting] = useState(false);
  const { user, login } = useAuth();
  const { searchRides, createRide, getRideById } = useRides();
  const { vehicles, fetchMyVehicles } = useVehicles();
  const { contacts, triggerSos } = useSafety();
  const { getRatingSummary } = useReviews();
  const { fetchNotifications } = useNotifications();
  const router = useRouter();

  const addLog = (msg: string) => {
    setLogs(prev => [...prev, `[${new Date().toLocaleTimeString()}] ${msg}`]);
    console.log(msg);
  };

  const runAllTests = async () => {
    setIsTesting(true);
    setLogs([]);
    addLog('Starting Global API Synchronization Test...');

    try {
      // 1. Auth Test
      addLog('Test 1: Auth/User Sync...');
      if (!user) {
        addLog('Not logged in. Attempting login...');
        await login('admin@travelbuddy.com', 'Password123!');
      }
      addLog(`Authenticated as: ${user?.fullName} (${user?.role})`);

      // 2. Rides Test
      addLog('Test 2: Ride Search Sync...');
      const rides = await searchRides('Pune', 'Mumbai', '2026-06-01');
      addLog(`Found ${rides.length} rides in search.`);

      // 3. Vehicles Test
      addLog('Test 3: Vehicle Fetching Sync...');
      await fetchMyVehicles();
      addLog(`User has ${vehicles.length} vehicles registered.`);

      // 4. Safety Test
      addLog('Test 4: Safety/SOS Sync...');
      addLog(`Emergency Contacts: ${contacts.length}`);

      // 5. Review Test
      addLog('Test 5: Review Summary Sync...');
      if (user) {
        const summary = await getRatingSummary(user.id);
        addLog(`Rating Summary: ${summary?.averageRating || 'N/A'} stars (${summary?.totalReviews || 0} reviews)`);
      }

      // 6. Notification Test
      addLog('Test 6: Notification Sync...');
      await fetchNotifications();
      addLog('Notification fetch complete.');

      addLog('✅ ALL TESTS COMPLETED SUCCESSFULLY.');
    } catch (error: any) {
      addLog(`❌ TEST FAILED: ${error.message}`);
    } finally {
      setIsTesting(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>API Sync Debugger</Text>
        <TouchableOpacity style={styles.closeButton} onPress={() => router.back()}>
          <Text style={styles.closeText}>Back</Text>
        </TouchableOpacity>
      </View>

      <TouchableOpacity 
        style={[styles.testButton, isTesting && styles.disabledButton]} 
        onPress={runAllTests}
        disabled={isTesting}
      >
        {isTesting ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.buttonText}>Run Full Sync Test</Text>
        )}
      </TouchableOpacity>

      <ScrollView style={styles.logContainer} contentContainerStyle={styles.logContent}>
        {logs.map((log, i) => (
          <Text key={i} style={[
            styles.logText, 
            log.includes('❌') && styles.errorLog,
            log.includes('✅') && styles.successLog
          ]}>
            {log}
          </Text>
        ))}
        {logs.length === 0 && <Text style={styles.placeholder}>No tests run yet.</Text>}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0F172A',
    paddingTop: 60,
    paddingHorizontal: 20,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#F8FAFC',
  },
  closeButton: {
    padding: 8,
  },
  closeText: {
    color: '#3B82F6',
    fontSize: 16,
  },
  testButton: {
    backgroundColor: '#3B82F6',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 20,
  },
  disabledButton: {
    backgroundColor: '#1E293B',
  },
  buttonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
  logContainer: {
    flex: 1,
    backgroundColor: '#020617',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#1E293B',
  },
  logContent: {
    padding: 12,
  },
  logText: {
    color: '#94A3B8',
    fontFamily: 'monospace',
    fontSize: 12,
    marginBottom: 4,
  },
  errorLog: {
    color: '#EF4444',
  },
  successLog: {
    color: '#10B981',
    fontWeight: 'bold',
  },
  placeholder: {
    color: '#475569',
    textAlign: 'center',
    marginTop: 40,
  },
});
