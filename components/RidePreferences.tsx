import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Switch } from 'react-native';
import { Settings, Car, Users, Volume2, Cigarette, Heart, MessageCircle, Clock, Shield } from 'lucide-react-native';

interface RidePreference {
  id: string;
  label: string;
  description: string;
  icon: React.ComponentType<any>;
  type: 'boolean' | 'select';
  options?: string[];
  defaultValue: boolean | string;
}

interface RidePreferencesProps {
  vehicleId?: string;
  onPreferencesChange?: (preferences: Record<string, any>) => void;
  isUniversal?: boolean;
}

const PREFERENCE_CATEGORIES = {
  comfort: {
    title: 'Comfort & Environment',
    icon: Car,
    preferences: [
      {
        id: 'smoking',
        label: 'Smoking Policy',
        description: 'Allow smoking in vehicle',
        icon: Cigarette,
        type: 'select',
        options: ['No Smoking', 'Smoking Allowed', 'Vaping Only'],
        defaultValue: 'No Smoking'
      },
      {
        id: 'ac',
        label: 'Air Conditioning',
        description: 'AC availability and usage',
        icon: Settings,
        type: 'boolean',
        defaultValue: true
      },
      {
        id: 'pets',
        label: 'Pet Friendly',
        description: 'Allow pets in vehicle',
        icon: Heart,
        type: 'boolean',
        defaultValue: false
      }
    ]
  },
  social: {
    title: 'Social Preferences',
    icon: MessageCircle,
    preferences: [
      {
        id: 'music',
        label: 'Music Policy',
        description: 'Music preferences during rides',
        icon: Volume2,
        type: 'select',
        options: ['No Music', 'Driver Choice', 'Passenger Choice', 'Shared Control'],
        defaultValue: 'Driver Choice'
      },
      {
        id: 'conversation',
        label: 'Conversation Level',
        description: 'Preferred conversation during rides',
        icon: MessageCircle,
        type: 'select',
        options: ['Quiet Ride', 'Light Chat', 'Open to Talk'],
        defaultValue: 'Light Chat'
      }
    ]
  },
  booking: {
    title: 'Booking & Safety',
    icon: Shield,
    preferences: [
      {
        id: 'instantBooking',
        label: 'Instant Booking',
        description: 'Allow immediate bookings without approval',
        icon: Clock,
        type: 'boolean',
        defaultValue: false
      },
      {
        id: 'maxPassengers',
        label: 'Maximum Passengers',
        description: 'Maximum number of passengers per ride',
        icon: Users,
        type: 'select',
        options: ['1', '2', '3', '4'],
        defaultValue: '3'
      },
      {
        id: 'verificationRequired',
        label: 'ID Verification Required',
        description: 'Require passenger ID verification',
        icon: Shield,
        type: 'boolean',
        defaultValue: true
      }
    ]
  }
};

export default function RidePreferences({ 
  vehicleId, 
  onPreferencesChange, 
  isUniversal = false 
}: RidePreferencesProps) {
  const [preferences, setPreferences] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadPreferences();
  }, [vehicleId, isUniversal]);

  const loadPreferences = async () => {
    setLoading(true);
    try {
      // Load preferences from storage
      const storageKey = isUniversal ? 'universal_ride_preferences' : `vehicle_preferences_${vehicleId}`;
      // Mock loading - replace with actual storage implementation
      const defaultPrefs: Record<string, any> = {};
      
      Object.values(PREFERENCE_CATEGORIES).forEach(category => {
        category.preferences.forEach(pref => {
          defaultPrefs[pref.id] = pref.defaultValue;
        });
      });
      
      setPreferences(defaultPrefs);
    } catch (error) {
      console.error('Error loading preferences:', error);
    } finally {
      setLoading(false);
    }
  };

  const updatePreference = async (preferenceId: string, value: any) => {
    const updatedPreferences = {
      ...preferences,
      [preferenceId]: value
    };
    
    setPreferences(updatedPreferences);
    
    try {
      // Save to storage
      const storageKey = isUniversal ? 'universal_ride_preferences' : `vehicle_preferences_${vehicleId}`;
      // Mock saving - replace with actual storage implementation
      console.log('Saving preferences:', storageKey, updatedPreferences);
      
      onPreferencesChange?.(updatedPreferences);
    } catch (error) {
      console.error('Error saving preferences:', error);
    }
  };

  const renderBooleanPreference = (preference: RidePreference) => {
    const IconComponent = preference.icon;
    
    return (
      <View key={preference.id} style={styles.preferenceItem}>
        <View style={styles.preferenceHeader}>
          <View style={styles.preferenceInfo}>
            <IconComponent size={20} color="#666" style={styles.preferenceIcon} />
            <View style={styles.preferenceText}>
              <Text style={styles.preferenceLabel}>{preference.label}</Text>
              <Text style={styles.preferenceDescription}>{preference.description}</Text>
            </View>
          </View>
          <Switch
            value={preferences[preference.id] || false}
            onValueChange={(value) => updatePreference(preference.id, value)}
            trackColor={{ false: '#e0e0e0', true: '#4CAF50' }}
            thumbColor={preferences[preference.id] ? '#fff' : '#f4f3f4'}
          />
        </View>
      </View>
    );
  };

  const renderSelectPreference = (preference: RidePreference) => {
    const IconComponent = preference.icon;
    const currentValue = preferences[preference.id] || preference.defaultValue;
    
    return (
      <View key={preference.id} style={styles.preferenceItem}>
        <View style={styles.preferenceHeader}>
          <View style={styles.preferenceInfo}>
            <IconComponent size={20} color="#666" style={styles.preferenceIcon} />
            <View style={styles.preferenceText}>
              <Text style={styles.preferenceLabel}>{preference.label}</Text>
              <Text style={styles.preferenceDescription}>{preference.description}</Text>
            </View>
          </View>
        </View>
        
        <View style={styles.optionsContainer}>
          {preference.options?.map((option) => (
            <TouchableOpacity
              key={option}
              style={[
                styles.optionButton,
                currentValue === option && styles.optionButtonSelected
              ]}
              onPress={() => updatePreference(preference.id, option)}
            >
              <Text style={[
                styles.optionText,
                currentValue === option && styles.optionTextSelected
              ]}>
                {option}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>
    );
  };

  const renderCategory = (categoryKey: string, category: any) => {
    const CategoryIcon = category.icon;
    
    return (
      <View key={categoryKey} style={styles.categoryContainer}>
        <View style={styles.categoryHeader}>
          <CategoryIcon size={24} color="#333" />
          <Text style={styles.categoryTitle}>{category.title}</Text>
        </View>
        
        {category.preferences.map((preference: RidePreference) => (
          preference.type === 'boolean' 
            ? renderBooleanPreference(preference)
            : renderSelectPreference(preference)
        ))}
      </View>
    );
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.loadingText}>Loading preferences...</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      <View style={styles.header}>
        <Settings size={24} color="#333" />
        <Text style={styles.title}>
          {isUniversal ? 'Universal Ride Preferences' : 'Vehicle Preferences'}
        </Text>
      </View>
      
      <Text style={styles.subtitle}>
        {isUniversal 
          ? 'These preferences will apply to all your vehicles by default'
          : 'Customize preferences for this specific vehicle'
        }
      </Text>

      {Object.entries(PREFERENCE_CATEGORIES).map(([key, category]) => 
        renderCategory(key, category)
      )}
      
      <View style={styles.footer}>
        <Text style={styles.footerText}>
          {isUniversal 
            ? 'Individual vehicle settings can override these universal preferences'
            : 'These settings override your universal preferences for this vehicle'
          }
        </Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f8f9fa',
  },
  loadingText: {
    fontSize: 16,
    color: '#666',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 10,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    marginLeft: 12,
  },
  subtitle: {
    fontSize: 14,
    color: '#666',
    paddingHorizontal: 20,
    paddingBottom: 20,
    lineHeight: 20,
  },
  categoryContainer: {
    backgroundColor: '#fff',
    marginHorizontal: 20,
    marginBottom: 20,
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
  },
  categoryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  categoryTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginLeft: 12,
  },
  preferenceItem: {
    marginBottom: 16,
  },
  preferenceHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  preferenceInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  preferenceIcon: {
    marginRight: 12,
  },
  preferenceText: {
    flex: 1,
  },
  preferenceLabel: {
    fontSize: 16,
    fontWeight: '500',
    color: '#333',
    marginBottom: 2,
  },
  preferenceDescription: {
    fontSize: 14,
    color: '#666',
    lineHeight: 18,
  },
  optionsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 12,
    gap: 8,
  },
  optionButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#f0f0f0',
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  optionButtonSelected: {
    backgroundColor: '#4CAF50',
    borderColor: '#4CAF50',
  },
  optionText: {
    fontSize: 14,
    color: '#666',
    fontWeight: '500',
  },
  optionTextSelected: {
    color: '#fff',
  },
  footer: {
    paddingHorizontal: 20,
    paddingBottom: 40,
  },
  footerText: {
    fontSize: 12,
    color: '#999',
    textAlign: 'center',
    lineHeight: 16,
  },
});