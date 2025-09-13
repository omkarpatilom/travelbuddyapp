import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Switch,
} from 'react-native';
import { useTheme } from '@/contexts/ThemeContext';
import { 
  Cigarette, 
  Music, 
  Heart, 
  Wind, 
  MessageCircle,
  Volume2,
  VolumeX,
  Users
} from 'lucide-react-native';

export interface UniversalRidePreferences {
  nonSmoking: boolean;
  musicAllowed: boolean;
  petsAllowed: boolean;
  airConditioning: boolean;
  conversationLevel: 'quiet' | 'moderate' | 'chatty';
  maxPassengers: number;
  instantBooking: boolean;
  femalePassengersOnly: boolean;
  verifiedPassengersOnly: boolean;
}

interface RidePreferencesProps {
  preferences: UniversalRidePreferences;
  onPreferencesChange: (preferences: UniversalRidePreferences) => void;
  mode?: 'driver' | 'passenger';
  canOverride?: boolean;
  style?: any;
}

export default function RidePreferences({
  preferences,
  onPreferencesChange,
  mode = 'driver',
  canOverride = false,
  style,
}: RidePreferencesProps) {
  const { theme } = useTheme();

  const updatePreference = <K extends keyof UniversalRidePreferences>(
    key: K,
    value: UniversalRidePreferences[K]
  ) => {
    onPreferencesChange({
      ...preferences,
      [key]: value,
    });
  };

  const conversationLevels = [
    { 
      key: 'quiet' as const, 
      label: 'Quiet Ride', 
      icon: <VolumeX size={20} />,
      description: 'Minimal conversation preferred'
    },
    { 
      key: 'moderate' as const, 
      label: 'Some Chat', 
      icon: <MessageCircle size={20} />,
      description: 'Light conversation is welcome'
    },
    { 
      key: 'chatty' as const, 
      label: 'Friendly Chat', 
      icon: <Volume2 size={20} />,
      description: 'Enjoy good conversations'
    },
  ];

  const maxPassengerOptions = [1, 2, 3, 4, 5, 6];

  const renderTogglePreference = (
    key: keyof UniversalRidePreferences,
    label: string,
    description: string,
    icon: React.ReactNode,
    value: boolean
  ) => (
    <View style={[styles.preferenceItem, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
      <View style={styles.preferenceContent}>
        <View style={[styles.iconContainer, { backgroundColor: value ? theme.colors.primary : theme.colors.background }]}>
          {React.cloneElement(icon as React.ReactElement, {
            size: 20,
            color: value ? '#FFFFFF' : theme.colors.textSecondary,
          })}
        </View>
        <View style={styles.preferenceText}>
          <Text style={[styles.preferenceLabel, { color: theme.colors.text }]}>
            {label}
          </Text>
          <Text style={[styles.preferenceDescription, { color: theme.colors.textSecondary }]}>
            {description}
          </Text>
        </View>
      </View>
      <Switch
        value={value}
        onValueChange={(newValue) => updatePreference(key, newValue)}
        trackColor={{ false: theme.colors.border, true: theme.colors.primary + '40' }}
        thumbColor={value ? theme.colors.primary : theme.colors.surface}
      />
    </View>
  );

  return (
    <View style={[styles.container, style]}>
      <View style={styles.header}>
        <Text style={[styles.title, { color: theme.colors.text }]}>
          {mode === 'driver' ? 'Universal Ride Preferences' : 'Passenger Preferences'}
        </Text>
        <Text style={[styles.subtitle, { color: theme.colors.textSecondary }]}>
          {canOverride 
            ? 'These settings apply to all your vehicles but can be overridden per vehicle'
            : 'These preferences will be applied to all your rides'
          }
        </Text>
      </View>

      {/* Basic Preferences */}
      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>
          Basic Preferences
        </Text>
        
        {renderTogglePreference(
          'nonSmoking',
          'Non-Smoking Vehicle',
          'No smoking allowed during rides',
          <Cigarette />,
          preferences.nonSmoking
        )}

        {renderTogglePreference(
          'musicAllowed',
          'Music Allowed',
          'Background music is welcome',
          <Music />,
          preferences.musicAllowed
        )}

        {renderTogglePreference(
          'petsAllowed',
          'Pet Friendly',
          'Pets are welcome in the vehicle',
          <Heart />,
          preferences.petsAllowed
        )}

        {renderTogglePreference(
          'airConditioning',
          'Air Conditioning',
          'AC is available and used',
          <Wind />,
          preferences.airConditioning
        )}
      </View>

      {/* Conversation Level */}
      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>
          Conversation Preference
        </Text>
        <View style={styles.conversationOptions}>
          {conversationLevels.map((level) => (
            <TouchableOpacity
              key={level.key}
              style={[
                styles.conversationOption,
                { backgroundColor: theme.colors.surface, borderColor: theme.colors.border },
                preferences.conversationLevel === level.key && {
                  borderColor: theme.colors.primary,
                  backgroundColor: theme.colors.primary + '10',
                },
              ]}
              onPress={() => updatePreference('conversationLevel', level.key)}
            >
              <View style={[
                styles.conversationIcon,
                { backgroundColor: preferences.conversationLevel === level.key ? theme.colors.primary : theme.colors.background }
              ]}>
                {React.cloneElement(level.icon as React.ReactElement, {
                  color: preferences.conversationLevel === level.key ? '#FFFFFF' : theme.colors.textSecondary,
                })}
              </View>
              <Text style={[styles.conversationLabel, { color: theme.colors.text }]}>
                {level.label}
              </Text>
              <Text style={[styles.conversationDescription, { color: theme.colors.textSecondary }]}>
                {level.description}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {mode === 'driver' && (
        <>
          {/* Passenger Limits */}
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>
              Passenger Settings
            </Text>
            
            <View style={[styles.preferenceItem, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
              <View style={styles.preferenceContent}>
                <View style={[styles.iconContainer, { backgroundColor: theme.colors.background }]}>
                  <Users size={20} color={theme.colors.textSecondary} />
                </View>
                <View style={styles.preferenceText}>
                  <Text style={[styles.preferenceLabel, { color: theme.colors.text }]}>
                    Maximum Passengers per Booking
                  </Text>
                  <Text style={[styles.preferenceDescription, { color: theme.colors.textSecondary }]}>
                    Limit how many seats one passenger can book
                  </Text>
                </View>
              </View>
              <View style={styles.passengerOptions}>
                {maxPassengerOptions.map((num) => (
                  <TouchableOpacity
                    key={num}
                    style={[
                      styles.passengerOption,
                      { backgroundColor: theme.colors.background, borderColor: theme.colors.border },
                      preferences.maxPassengers === num && {
                        backgroundColor: theme.colors.primary,
                        borderColor: theme.colors.primary,
                      },
                    ]}
                    onPress={() => updatePreference('maxPassengers', num)}
                  >
                    <Text style={[
                      styles.passengerOptionText,
                      { color: preferences.maxPassengers === num ? '#FFFFFF' : theme.colors.text }
                    ]}>
                      {num}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {renderTogglePreference(
              'instantBooking',
              'Instant Booking',
              'Allow passengers to book without approval',
              <Users />,
              preferences.instantBooking
            )}

            {renderTogglePreference(
              'femalePassengersOnly',
              'Female Passengers Only',
              'Only accept bookings from female passengers',
              <Users />,
              preferences.femalePassengersOnly
            )}

            {renderTogglePreference(
              'verifiedPassengersOnly',
              'Verified Passengers Only',
              'Only accept bookings from ID-verified passengers',
              <Users />,
              preferences.verifiedPassengersOnly
            )}
          </View>
        </>
      )}

      {canOverride && (
        <View style={[styles.overrideNotice, { backgroundColor: theme.colors.warning + '10', borderColor: theme.colors.warning }]}>
          <Text style={[styles.overrideText, { color: theme.colors.warning }]}>
            💡 These preferences can be customized for individual vehicles in your vehicle settings.
          </Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 24,
  },
  header: {
    gap: 4,
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  subtitle: {
    fontSize: 14,
    lineHeight: 20,
  },
  section: {
    gap: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
  },
  preferenceItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderRadius: 12,
    padding: 16,
  },
  preferenceContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  preferenceText: {
    flex: 1,
  },
  preferenceLabel: {
    fontSize: 16,
    fontWeight: '500',
    marginBottom: 2,
  },
  preferenceDescription: {
    fontSize: 14,
  },
  conversationOptions: {
    gap: 12,
  },
  conversationOption: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 16,
    gap: 8,
  },
  conversationIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    alignSelf: 'flex-start',
  },
  conversationLabel: {
    fontSize: 16,
    fontWeight: '600',
  },
  conversationDescription: {
    fontSize: 14,
  },
  passengerOptions: {
    flexDirection: 'row',
    gap: 8,
  },
  passengerOption: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  passengerOptionText: {
    fontSize: 14,
    fontWeight: '600',
  },
  overrideNotice: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
  },
  overrideText: {
    fontSize: 14,
    fontWeight: '500',
  },
});