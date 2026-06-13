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
import { 
  Settings, 
  Music, 
  Cigarette, 
  Heart, 
  Globe, 
  ArrowLeft, 
  Save, 
  MessageCircle, 
  Shield, 
  Clock, 
  Wind, 
  Zap, 
  Briefcase,
  Baby
} from 'lucide-react-native';

export default function PreferencesScreen() {
  const { theme } = useTheme();
  const router = useRouter();

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  // Preference State
  const [preferences, setPreferences] = useState({
    allowSmoking: false,
    allowPets: false,
    preferredLanguage: 'English',
    musicPreference: 'Driver Choice',
    conversationLevel: 'Moderate',
    instantBooking: false,
    femalePassengersOnly: false,
    verifiedPassengersOnly: false,
    // Safety Features List
    safetyDashcam: false,
    safetyGps: false,
    safetyKit: false,
    // Comfort Amenities List
    comfortAc: true,
    comfortHeating: false,
    comfortSunroof: false,
    comfortWifi: false,
    comfortCharging: false,
    comfortLuggage: false,
    comfortChildSeat: false,
  });

  useEffect(() => {
    fetchPreferences();
  }, []);

  const fetchPreferences = async () => {
    try {
      const data = await api.get<any>('/preferences');
      if (data) {
        const safetyList = (data.safetyFeatures || '').split(',').map((s: string) => s.trim().toLowerCase());
        const comfortList = (data.comfortAmenities || '').split(',').map((c: string) => c.trim().toLowerCase());

        setPreferences({
          allowSmoking: data.allowSmoking,
          allowPets: data.allowPets,
          preferredLanguage: data.preferredLanguage || 'English',
          musicPreference: data.musicPreference || 'Driver Choice',
          conversationLevel: data.conversationLevel || 'Moderate',
          instantBooking: data.instantBooking || false,
          femalePassengersOnly: data.femalePassengersOnly || false,
          verifiedPassengersOnly: data.verifiedPassengersOnly || false,
          // Safety
          safetyDashcam: safetyList.includes('dashcam'),
          safetyGps: safetyList.includes('gps_tracking'),
          safetyKit: safetyList.includes('emergency_kit'),
          // Comfort
          comfortAc: comfortList.includes('ac'),
          comfortHeating: comfortList.includes('heating'),
          comfortSunroof: comfortList.includes('sunroof'),
          comfortWifi: comfortList.includes('wifi'),
          comfortCharging: comfortList.includes('charging_port'),
          comfortLuggage: comfortList.includes('luggage_space'),
          comfortChildSeat: comfortList.includes('child_seat'),
        });
      }
    } catch (error) {
      console.error('Error fetching preferences:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      // Build safety features list
      const safetyFeaturesArray = [];
      if (preferences.safetyDashcam) safetyFeaturesArray.push('dashcam');
      if (preferences.safetyGps) safetyFeaturesArray.push('gps_tracking');
      if (preferences.safetyKit) safetyFeaturesArray.push('emergency_kit');

      // Build comfort amenities list
      const comfortAmenitiesArray = [];
      if (preferences.comfortAc) comfortAmenitiesArray.push('ac');
      if (preferences.comfortHeating) comfortAmenitiesArray.push('heating');
      if (preferences.comfortSunroof) comfortAmenitiesArray.push('sunroof');
      if (preferences.comfortWifi) comfortAmenitiesArray.push('wifi');
      if (preferences.comfortCharging) comfortAmenitiesArray.push('charging_port');
      if (preferences.comfortLuggage) comfortAmenitiesArray.push('luggage_space');
      if (preferences.comfortChildSeat) comfortAmenitiesArray.push('child_seat');

      const payload = {
        allowMusic: preferences.musicPreference !== 'No Music',
        allowSmoking: preferences.allowSmoking,
        allowPets: preferences.allowPets,
        preferredLanguage: preferences.preferredLanguage,
        musicPreference: preferences.musicPreference,
        conversationLevel: preferences.conversationLevel,
        instantBooking: preferences.instantBooking,
        femalePassengersOnly: preferences.femalePassengersOnly,
        verifiedPassengersOnly: preferences.verifiedPassengersOnly,
        safetyFeatures: safetyFeaturesArray.join(','),
        comfortAmenities: comfortAmenitiesArray.join(','),
      };

      await api.put('/preferences', payload);
      Alert.alert('Success', 'Ride Preferences updated successfully!', [
        {
          text: 'OK',
          onPress: () => {
            if (router.canGoBack()) {
              router.back();
            } else {
              router.replace('/(tabs)/profile');
            }
          }
        }
      ]);
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to update preferences');
    } finally {
      setIsSaving(false);
    }
  };

  const toggleSwitch = (key: keyof typeof preferences) => {
    setPreferences(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const setPreferenceValue = (key: keyof typeof preferences, value: any) => {
    setPreferences(prev => ({ ...prev, [key]: value }));
  };

  const languages = ['English', 'Spanish', 'French', 'German', 'Hindi'];
  const conversationLevels = ['Quiet', 'Moderate', 'Chatty'];
  const musicPreferences = ['No Music', 'Driver Choice', 'Passenger Choice', 'Shared Control'];

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
          Manage your ride preferences. Passengers will see these default rules, comfort settings, and features during discovery and booking.
        </Text>

        {/* Social Preferences Category */}
        <View style={[styles.section, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
          <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Social Policies</Text>
          
          {/* Smoking Switch */}
          <View style={styles.preferenceItem}>
            <View style={styles.preferenceInfo}>
              <Cigarette size={20} color={theme.colors.secondary} />
              <Text style={[styles.preferenceLabel, { color: theme.colors.text }]}>Smoking Allowed</Text>
            </View>
            <Switch
              value={preferences.allowSmoking}
              onValueChange={() => toggleSwitch('allowSmoking')}
              trackColor={{ false: theme.colors.border, true: theme.colors.primary + '80' }}
              thumbColor={preferences.allowSmoking ? theme.colors.primary : '#f4f3f4'}
            />
          </View>

          <View style={[styles.divider, { backgroundColor: theme.colors.border }]} />

          {/* Pets Switch */}
          <View style={styles.preferenceItem}>
            <View style={styles.preferenceInfo}>
              <Heart size={20} color={theme.colors.accent} />
              <Text style={[styles.preferenceLabel, { color: theme.colors.text }]}>Pets Allowed</Text>
            </View>
            <Switch
              value={preferences.allowPets}
              onValueChange={() => toggleSwitch('allowPets')}
              trackColor={{ false: theme.colors.border, true: theme.colors.primary + '80' }}
              thumbColor={preferences.allowPets ? theme.colors.primary : '#f4f3f4'}
            />
          </View>

          <View style={[styles.divider, { backgroundColor: theme.colors.border }]} />

          {/* Conversation Level Chips */}
          <View style={styles.optionGroup}>
            <View style={styles.optionHeader}>
              <MessageCircle size={20} color={theme.colors.primary} />
              <Text style={[styles.optionLabel, { color: theme.colors.text }]}>Conversation Level</Text>
            </View>
            <View style={styles.chipsRow}>
              {conversationLevels.map(level => (
                <TouchableOpacity
                  key={level}
                  style={[
                    styles.chip,
                    { borderColor: theme.colors.border },
                    preferences.conversationLevel === level && { backgroundColor: theme.colors.primary, borderColor: theme.colors.primary }
                  ]}
                  onPress={() => setPreferenceValue('conversationLevel', level)}
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

          <View style={[styles.divider, { backgroundColor: theme.colors.border }]} />

          {/* Music Preferences Chips */}
          <View style={styles.optionGroup}>
            <View style={styles.optionHeader}>
              <Music size={20} color={theme.colors.secondary} />
              <Text style={[styles.optionLabel, { color: theme.colors.text }]}>Music Policy</Text>
            </View>
            <View style={styles.chipsRow}>
              {musicPreferences.map(music => (
                <TouchableOpacity
                  key={music}
                  style={[
                    styles.chip,
                    { borderColor: theme.colors.border },
                    preferences.musicPreference === music && { backgroundColor: theme.colors.secondary, borderColor: theme.colors.secondary }
                  ]}
                  onPress={() => setPreferenceValue('musicPreference', music)}
                >
                  <Text style={[
                    styles.chipText,
                    { color: theme.colors.text },
                    preferences.musicPreference === music && { color: '#FFFFFF' }
                  ]}>{music}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </View>

        {/* Booking Preferences Category */}
        <View style={[styles.section, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
          <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Booking Policies</Text>

          {/* Instant Booking */}
          <View style={styles.preferenceItem}>
            <View style={styles.preferenceInfo}>
              <Clock size={20} color={theme.colors.primary} />
              <Text style={[styles.preferenceLabel, { color: theme.colors.text }]}>Instant Booking</Text>
            </View>
            <Switch
              value={preferences.instantBooking}
              onValueChange={() => toggleSwitch('instantBooking')}
              trackColor={{ false: theme.colors.border, true: theme.colors.primary + '80' }}
              thumbColor={preferences.instantBooking ? theme.colors.primary : '#f4f3f4'}
            />
          </View>

          <View style={[styles.divider, { backgroundColor: theme.colors.border }]} />

          {/* Female Passengers Only */}
          <View style={styles.preferenceItem}>
            <View style={styles.preferenceInfo}>
              <Settings size={20} color={theme.colors.secondary} />
              <Text style={[styles.preferenceLabel, { color: theme.colors.text }]}>Female Passengers Only</Text>
            </View>
            <Switch
              value={preferences.femalePassengersOnly}
              onValueChange={() => toggleSwitch('femalePassengersOnly')}
              trackColor={{ false: theme.colors.border, true: theme.colors.primary + '80' }}
              thumbColor={preferences.femalePassengersOnly ? theme.colors.primary : '#f4f3f4'}
            />
          </View>

          <View style={[styles.divider, { backgroundColor: theme.colors.border }]} />

          {/* Verified Passengers Only */}
          <View style={styles.preferenceItem}>
            <View style={styles.preferenceInfo}>
              <Shield size={20} color={theme.colors.accent} />
              <Text style={[styles.preferenceLabel, { color: theme.colors.text }]}>Require ID Verification</Text>
            </View>
            <Switch
              value={preferences.verifiedPassengersOnly}
              onValueChange={() => toggleSwitch('verifiedPassengersOnly')}
              trackColor={{ false: theme.colors.border, true: theme.colors.primary + '80' }}
              thumbColor={preferences.verifiedPassengersOnly ? theme.colors.primary : '#f4f3f4'}
            />
          </View>
        </View>

        {/* Safety Features */}
        <View style={[styles.section, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
          <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Safety Settings</Text>

          {/* Dashcam */}
          <View style={styles.preferenceItem}>
            <View style={styles.preferenceInfo}>
              <Shield size={20} color={theme.colors.primary} />
              <Text style={[styles.preferenceLabel, { color: theme.colors.text }]}>Dash Camera</Text>
            </View>
            <Switch
              value={preferences.safetyDashcam}
              onValueChange={() => toggleSwitch('safetyDashcam')}
              trackColor={{ false: theme.colors.border, true: theme.colors.primary + '80' }}
              thumbColor={preferences.safetyDashcam ? theme.colors.primary : '#f4f3f4'}
            />
          </View>

          <View style={[styles.divider, { backgroundColor: theme.colors.border }]} />

          {/* GPS Tracking */}
          <View style={styles.preferenceItem}>
            <View style={styles.preferenceInfo}>
              <Shield size={20} color={theme.colors.secondary} />
              <Text style={[styles.preferenceLabel, { color: theme.colors.text }]}>GPS Tracking</Text>
            </View>
            <Switch
              value={preferences.safetyGps}
              onValueChange={() => toggleSwitch('safetyGps')}
              trackColor={{ false: theme.colors.border, true: theme.colors.primary + '80' }}
              thumbColor={preferences.safetyGps ? theme.colors.primary : '#f4f3f4'}
            />
          </View>

          <View style={[styles.divider, { backgroundColor: theme.colors.border }]} />

          {/* Emergency Kit */}
          <View style={styles.preferenceItem}>
            <View style={styles.preferenceInfo}>
              <Shield size={20} color={theme.colors.accent} />
              <Text style={[styles.preferenceLabel, { color: theme.colors.text }]}>Emergency First Aid Kit</Text>
            </View>
            <Switch
              value={preferences.safetyKit}
              onValueChange={() => toggleSwitch('safetyKit')}
              trackColor={{ false: theme.colors.border, true: theme.colors.primary + '80' }}
              thumbColor={preferences.safetyKit ? theme.colors.primary : '#f4f3f4'}
            />
          </View>
        </View>

        {/* Comfort Amenities */}
        <View style={[styles.section, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
          <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Comfort & Amenities</Text>

          {/* AC */}
          <View style={styles.preferenceItem}>
            <View style={styles.preferenceInfo}>
              <Wind size={20} color={theme.colors.primary} />
              <Text style={[styles.preferenceLabel, { color: theme.colors.text }]}>Air Conditioning (AC)</Text>
            </View>
            <Switch
              value={preferences.comfortAc}
              onValueChange={() => toggleSwitch('comfortAc')}
              trackColor={{ false: theme.colors.border, true: theme.colors.primary + '80' }}
              thumbColor={preferences.comfortAc ? theme.colors.primary : '#f4f3f4'}
            />
          </View>

          <View style={[styles.divider, { backgroundColor: theme.colors.border }]} />

          {/* Heating */}
          <View style={styles.preferenceItem}>
            <View style={styles.preferenceInfo}>
              <Zap size={20} color={theme.colors.secondary} />
              <Text style={[styles.preferenceLabel, { color: theme.colors.text }]}>Heating</Text>
            </View>
            <Switch
              value={preferences.comfortHeating}
              onValueChange={() => toggleSwitch('comfortHeating')}
              trackColor={{ false: theme.colors.border, true: theme.colors.primary + '80' }}
              thumbColor={preferences.comfortHeating ? theme.colors.primary : '#f4f3f4'}
            />
          </View>

          <View style={[styles.divider, { backgroundColor: theme.colors.border }]} />

          {/* Sunroof */}
          <View style={styles.preferenceItem}>
            <View style={styles.preferenceInfo}>
              <Settings size={20} color={theme.colors.accent} />
              <Text style={[styles.preferenceLabel, { color: theme.colors.text }]}>Sunroof</Text>
            </View>
            <Switch
              value={preferences.comfortSunroof}
              onValueChange={() => toggleSwitch('comfortSunroof')}
              trackColor={{ false: theme.colors.border, true: theme.colors.primary + '80' }}
              thumbColor={preferences.comfortSunroof ? theme.colors.primary : '#f4f3f4'}
            />
          </View>

          <View style={[styles.divider, { backgroundColor: theme.colors.border }]} />

          {/* Wifi */}
          <View style={styles.preferenceItem}>
            <View style={styles.preferenceInfo}>
              <Globe size={20} color={theme.colors.primary} />
              <Text style={[styles.preferenceLabel, { color: theme.colors.text }]}>WiFi Hotspot</Text>
            </View>
            <Switch
              value={preferences.comfortWifi}
              onValueChange={() => toggleSwitch('comfortWifi')}
              trackColor={{ false: theme.colors.border, true: theme.colors.primary + '80' }}
              thumbColor={preferences.comfortWifi ? theme.colors.primary : '#f4f3f4'}
            />
          </View>

          <View style={[styles.divider, { backgroundColor: theme.colors.border }]} />

          {/* Charging Port */}
          <View style={styles.preferenceItem}>
            <View style={styles.preferenceInfo}>
              <Zap size={20} color={theme.colors.secondary} />
              <Text style={[styles.preferenceLabel, { color: theme.colors.text }]}>Charging Port (USB)</Text>
            </View>
            <Switch
              value={preferences.comfortCharging}
              onValueChange={() => toggleSwitch('comfortCharging')}
              trackColor={{ false: theme.colors.border, true: theme.colors.primary + '80' }}
              thumbColor={preferences.comfortCharging ? theme.colors.primary : '#f4f3f4'}
            />
          </View>

          <View style={[styles.divider, { backgroundColor: theme.colors.border }]} />

          {/* Luggage */}
          <View style={styles.preferenceItem}>
            <View style={styles.preferenceInfo}>
              <Briefcase size={20} color={theme.colors.accent} />
              <Text style={[styles.preferenceLabel, { color: theme.colors.text }]}>Luggage Space</Text>
            </View>
            <Switch
              value={preferences.comfortLuggage}
              onValueChange={() => toggleSwitch('comfortLuggage')}
              trackColor={{ false: theme.colors.border, true: theme.colors.primary + '80' }}
              thumbColor={preferences.comfortLuggage ? theme.colors.primary : '#f4f3f4'}
            />
          </View>

          <View style={[styles.divider, { backgroundColor: theme.colors.border }]} />

          {/* Child Seat */}
          <View style={styles.preferenceItem}>
            <View style={styles.preferenceInfo}>
              <Baby size={20} color={theme.colors.primary} />
              <Text style={[styles.preferenceLabel, { color: theme.colors.text }]}>Child Seat</Text>
            </View>
            <Switch
              value={preferences.comfortChildSeat}
              onValueChange={() => toggleSwitch('comfortChildSeat')}
              trackColor={{ false: theme.colors.border, true: theme.colors.primary + '80' }}
              thumbColor={preferences.comfortChildSeat ? theme.colors.primary : '#f4f3f4'}
            />
          </View>
        </View>

        {/* Language Preferences */}
        <View style={[styles.section, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
          <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Communication Language</Text>
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
                  onPress={() => setPreferenceValue('preferredLanguage', lang)}
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
    fontSize: 15,
    lineHeight: 22,
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
