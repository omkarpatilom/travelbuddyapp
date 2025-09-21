import React, { useState } from 'react';
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
} from 'react-native';
import { useRouter } from 'expo-router';
import { useTheme } from '@/contexts/ThemeContext';
import { Car, Hash, Palette, Calendar, Users, ArrowLeft, Save, Plus, Settings, Cigarette, Music, Heart, Wind, MessageCircle } from 'lucide-react-native';
import PhotoUploader from '@/components/PhotoUploader';
import VehicleFeatureTags from '@/components/VehicleFeatureTags';

interface Vehicle {
  id: string;
  make: string;
  model: string;
  year: string;
  color: string;
  licensePlate: string;
  seats: string;
  photos: string[];
  isDefault: boolean;
  features: string[];
  preferences?: RidePreferences;
}

interface RidePreferences {
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

export default function VehicleDetailsScreen() {
  const { theme } = useTheme();
  const router = useRouter();

  // Mock vehicle data
  const [vehicles, setVehicles] = useState<Vehicle[]>([
    {
      id: '1',
      make: 'Toyota',
      model: 'Camry',
      year: '2020',
      color: 'Blue',
      licensePlate: 'ABC123',
      seats: '4',
      photos: ['https://images.pexels.com/photos/116675/pexels-photo-116675.jpeg?auto=compress&cs=tinysrgb&w=400'],
      isDefault: true,
      features: ['ac', 'music_system', 'phone_charger'],
      preferences: {
        nonSmoking: true,
        musicAllowed: true,
        petsAllowed: false,
        airConditioning: true,
        conversationLevel: 'moderate',
        maxPassengers: 3,
        instantBooking: false,
        verifiedPassengersOnly: true,
        femalePassengersOnly: false,
      },
    }
  ]);

  const [isEditing, setIsEditing] = useState(false);
  const [editingVehicle, setEditingVehicle] = useState<Vehicle | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const [formData, setFormData] = useState({
    make: '',
    model: '',
    year: '',
    color: '',
    licensePlate: '',
    seats: '4',
    photos: [] as string[],
    features: [] as string[],
    preferences: {
      nonSmoking: true,
      musicAllowed: true,
      petsAllowed: false,
      airConditioning: true,
      conversationLevel: 'moderate' as const,
      maxPassengers: 4,
      instantBooking: false,
      verifiedPassengersOnly: false,
      femalePassengersOnly: false,
    } as RidePreferences,
  });

  const updateFormData = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleAddVehicle = () => {
    setFormData({
      make: '',
      model: '',
      year: '',
      color: '',
      licensePlate: '',
      seats: '4',
    });
    setEditingVehicle(null);
    setIsEditing(true);
  };

  const handleEditVehicle = (vehicle: Vehicle) => {
    setFormData({
      make: vehicle.make,
      model: vehicle.model,
      year: vehicle.year,
      color: vehicle.color,
      licensePlate: vehicle.licensePlate,
      seats: vehicle.seats,
      photos: vehicle.photos,
      features: vehicle.features,
      preferences: vehicle.preferences || {
        nonSmoking: true,
        musicAllowed: true,
        petsAllowed: false,
        airConditioning: true,
        conversationLevel: 'moderate' as const,
        maxPassengers: 4,
        instantBooking: false,
        femalePassengersOnly: false,
        verifiedPassengersOnly: false,
      },
    });
    setEditingVehicle(vehicle);
    setIsEditing(true);
  };

  const handleSaveVehicle = async () => {
    if (!formData.make || !formData.model || !formData.year || !formData.color || !formData.licensePlate) {
      Alert.alert('Missing Information', 'Please fill in all required fields');
      return;
    }

    setIsLoading(true);
    try {
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 1000));

      if (editingVehicle) {
        // Update existing vehicle
        setVehicles(prev => prev.map(v => 
          v.id === editingVehicle.id 
            ? { ...v, ...formData }
            : v
        ));
      } else {
        // Add new vehicle
        const newVehicle: Vehicle = {
          id: Date.now().toString(),
          ...formData,
          isDefault: vehicles.length === 0,
        };
        setVehicles(prev => [...prev, newVehicle]);
      }

      setIsEditing(false);
      Alert.alert('Success', 'Vehicle saved successfully!');
    } catch (error) {
      Alert.alert('Error', 'Failed to save vehicle. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const updatePreference = (key: keyof RidePreferences, value: any) => {
    setFormData(prev => ({
      ...prev,
      preferences: {
        ...prev.preferences,
        [key]: value,
      },
    }));
  };

  const renderPreferenceToggle = (
    key: keyof RidePreferences,
    label: string,
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
        </View>
      </View>
      <Switch
        value={value}
        onValueChange={(newValue) => updatePreference(key, newValue)}
        trackColor={{ false: theme.colors.border, true: theme.colors.primary }}
        thumbColor={value ? '#FFFFFF' : '#f4f3f4'}
      />
    </View>
  );

  const renderConversationSelector = () => {
    const conversationLevels = [
      { key: 'quiet', label: 'Quiet', icon: '🤫' },
      { key: 'moderate', label: 'Moderate', icon: '😊' },
      { key: 'chatty', label: 'Chatty', icon: '😄' },
    ];

    return (
      <View style={styles.conversationSection}>
        <Text style={[styles.conversationTitle, { color: theme.colors.text }]}>
          Conversation Level
        </Text>
        <View style={styles.conversationOptions}>
          {conversationLevels.map((level) => (
            <TouchableOpacity
              key={level.key}
              style={[
                styles.conversationOption,
                { backgroundColor: theme.colors.surface, borderColor: theme.colors.border },
                formData.preferences.conversationLevel === level.key && {
                  borderColor: theme.colors.primary,
                  backgroundColor: theme.colors.primary + '10',
                },
              ]}
              onPress={() => updatePreference('conversationLevel', level.key)}
            >
              <Text style={styles.conversationEmoji}>{level.icon}</Text>
              <Text style={[styles.conversationLabel, { color: theme.colors.text }]}>
                {level.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>
    );
  };
  const handleDeleteVehicle = (vehicleId: string) => {
    Alert.alert(
      'Delete Vehicle',
      'Are you sure you want to delete this vehicle?',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Delete', 
          style: 'destructive',
          onPress: () => {
            setVehicles(prev => prev.filter(v => v.id !== vehicleId));
          }
        },
      ]
    );
  };

  const handleSetDefault = (vehicleId: string) => {
    setVehicles(prev => prev.map(v => ({
      ...v,
      isDefault: v.id === vehicleId
    })));
  };

  const renderVehicle = (vehicle: Vehicle) => (
    <View key={vehicle.id} style={[styles.vehicleCard, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
      <View style={styles.vehicleHeader}>
        <View style={styles.vehicleInfo}>
          <Text style={[styles.vehicleName, { color: theme.colors.text }]}>
            {vehicle.year} {vehicle.make} {vehicle.model}
          </Text>
          <Text style={[styles.vehicleDetails, { color: theme.colors.textSecondary }]}>
            {vehicle.color} • {vehicle.licensePlate} • {vehicle.seats} seats
          </Text>
          <Text style={[styles.vehicleFeatures, { color: theme.colors.textSecondary }]}>
            {vehicle.features.length} features • {vehicle.preferences?.nonSmoking ? 'Non-smoking' : 'Smoking OK'}
          </Text>
          <Text style={[styles.vehiclePhotos, { color: theme.colors.textSecondary }]}>
            {vehicle.photos.length} photo{vehicle.photos.length !== 1 ? 's' : ''}
          </Text>
        </View>
        {vehicle.isDefault && (
          <View style={[styles.defaultBadge, { backgroundColor: theme.colors.primary }]}>
            <Text style={styles.defaultText}>Default</Text>
          </View>
        )}
      </View>

      <View style={styles.vehicleActions}>
        <TouchableOpacity 
          style={[styles.actionButton, { backgroundColor: theme.colors.surface }]}
          onPress={() => handleEditVehicle(vehicle)}
        >
          <Text style={[styles.actionButtonText, { color: theme.colors.primary }]}>Edit</Text>
        </TouchableOpacity>
        
        {!vehicle.isDefault && (
          <TouchableOpacity 
            style={[styles.actionButton, { backgroundColor: theme.colors.surface }]}
            onPress={() => handleSetDefault(vehicle.id)}
          >
            <Text style={[styles.actionButtonText, { color: theme.colors.secondary }]}>Set Default</Text>
          </TouchableOpacity>
        )}
        
        {vehicles.length > 1 && (
          <TouchableOpacity 
            style={[styles.actionButton, { backgroundColor: theme.colors.surface }]}
            onPress={() => handleDeleteVehicle(vehicle.id)}
          >
            <Text style={[styles.actionButtonText, { color: theme.colors.error }]}>Delete</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );

  if (isEditing) {
    return (
      <ScrollView style={[styles.container, { backgroundColor: theme.colors.background }]}>
        <View style={[styles.header, { backgroundColor: theme.colors.surface, borderBottomColor: theme.colors.border }]}>
          <TouchableOpacity onPress={() => setIsEditing(false)} style={styles.backButton}>
            <ArrowLeft size={24} color={theme.colors.text} />
          </TouchableOpacity>
          <Text style={[styles.title, { color: theme.colors.text }]}>
            {editingVehicle ? 'Edit Vehicle' : 'Add Vehicle'}
          </Text>
          <TouchableOpacity onPress={handleSaveVehicle} style={styles.saveButton} disabled={isLoading}>
            {isLoading ? (
              <ActivityIndicator size="small" color={theme.colors.primary} />
            ) : (
              <Save size={24} color={theme.colors.primary} />
            )}
          </TouchableOpacity>
        </View>

        <View style={styles.content}>
          <View style={[styles.section, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
            <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Vehicle Information</Text>
            
            <View style={styles.row}>
              <View style={[styles.inputContainer, styles.halfWidth, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
                <Car size={20} color={theme.colors.textSecondary} />
                <TextInput
                  style={[styles.input, { color: theme.colors.text }]}
                  placeholder="Make (e.g., Toyota)"
                  placeholderTextColor={theme.colors.textSecondary}
                  value={formData.make}
                  onChangeText={(value) => updateFormData('make', value)}
                />
              </View>

              <View style={[styles.inputContainer, styles.halfWidth, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
                <Car size={20} color={theme.colors.textSecondary} />
                <TextInput
                  style={[styles.input, { color: theme.colors.text }]}
                  placeholder="Model (e.g., Camry)"
                  placeholderTextColor={theme.colors.textSecondary}
                  value={formData.model}
                  onChangeText={(value) => updateFormData('model', value)}
                />
              </View>
            </View>

            <View style={styles.row}>
              <View style={[styles.inputContainer, styles.halfWidth, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
                <Calendar size={20} color={theme.colors.textSecondary} />
                <TextInput
                  style={[styles.input, { color: theme.colors.text }]}
                  placeholder="Year"
                  placeholderTextColor={theme.colors.textSecondary}
                  value={formData.year}
                  onChangeText={(value) => updateFormData('year', value)}
                  keyboardType="numeric"
                />
              </View>

              <View style={[styles.inputContainer, styles.halfWidth, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
                <Palette size={20} color={theme.colors.textSecondary} />
                <TextInput
                  style={[styles.input, { color: theme.colors.text }]}
                  placeholder="Color"
                  placeholderTextColor={theme.colors.textSecondary}
                  value={formData.color}
                  onChangeText={(value) => updateFormData('color', value)}
                />
              </View>
            </View>

            <View style={styles.row}>
              <View style={[styles.inputContainer, styles.halfWidth, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
                <Hash size={20} color={theme.colors.textSecondary} />
                <TextInput
                  style={[styles.input, { color: theme.colors.text }]}
                  placeholder="License Plate"
                  placeholderTextColor={theme.colors.textSecondary}
                  value={formData.licensePlate}
                  onChangeText={(value) => updateFormData('licensePlate', value)}
                  autoCapitalize="characters"
                />
              </View>

              <View style={[styles.inputContainer, styles.halfWidth, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
                <Users size={20} color={theme.colors.textSecondary} />
                <TextInput
                  style={[styles.input, { color: theme.colors.text }]}
                  placeholder="Seats"
                  placeholderTextColor={theme.colors.textSecondary}
                  value={formData.seats}
                  onChangeText={(value) => updateFormData('seats', value)}
                  keyboardType="numeric"
                />
              </View>
            </View>
          </View>

          <PhotoUploader
            photos={formData.photos}
            onPhotosChange={(photos) => updateFormData('photos', photos)}
            minPhotos={1}
            maxPhotos={8}
          />

          <VehicleFeatureTags
            selectedFeatures={formData.features}
            onFeaturesChange={(features) => updateFormData('features', features)}
          />

          {/* Vehicle Ride Preferences */}
          <View style={[styles.section, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
            <View style={styles.preferencesHeader}>
              <Settings size={24} color={theme.colors.primary} />
              <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>
                Ride Preferences
              </Text>
            </View>
            
            <Text style={[styles.preferencesDescription, { color: theme.colors.textSecondary }]}>
              Set your preferences for rides with this vehicle
            </Text>

            <View style={styles.preferencesGrid}>
              {renderPreferenceToggle('nonSmoking', 'Non-smoking vehicle', <Cigarette />, formData.preferences.nonSmoking)}
              {renderPreferenceToggle('musicAllowed', 'Music allowed', <Music />, formData.preferences.musicAllowed)}
              {renderPreferenceToggle('petsAllowed', 'Pet friendly', <Heart />, formData.preferences.petsAllowed)}
              {renderPreferenceToggle('airConditioning', 'Air conditioning', <Wind />, formData.preferences.airConditioning)}
              {renderPreferenceToggle('instantBooking', 'Instant booking', <Car />, formData.preferences.instantBooking)}
              {renderPreferenceToggle('verifiedPassengersOnly', 'Verified passengers only', <Settings />, formData.preferences.verifiedPassengersOnly)}
              {renderPreferenceToggle('femalePassengersOnly', 'Female passengers only', <Users />, formData.preferences.femalePassengersOnly)}
            </View>

            {renderConversationSelector()}

            <View style={styles.maxPassengersSection}>
              <Text style={[styles.maxPassengersTitle, { color: theme.colors.text }]}>
                Maximum Passengers
              </Text>
              <View style={styles.maxPassengersOptions}>
                {[1, 2, 3, 4, 5, 6].map((num) => (
                  <TouchableOpacity
                    key={num}
                    style={[
                      styles.maxPassengersOption,
                      { backgroundColor: theme.colors.surface, borderColor: theme.colors.border },
                      formData.preferences.maxPassengers === num && {
                        borderColor: theme.colors.primary,
                        backgroundColor: theme.colors.primary + '10',
                      },
                    ]}
                    onPress={() => updatePreference('maxPassengers', num)}
                  >
                    <Text style={[
                      styles.maxPassengersText,
                      { color: formData.preferences.maxPassengers === num ? theme.colors.primary : theme.colors.text }
                    ]}>
                      {num}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          </View>
          <TouchableOpacity 
            style={[styles.saveButtonLarge, { backgroundColor: theme.colors.primary }]}
            onPress={handleSaveVehicle}
            disabled={isLoading}
          >
            {isLoading ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <>
                <Save size={20} color="#FFFFFF" />
                <Text style={styles.saveButtonText}>Save Vehicle</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      </ScrollView>
    );
  }

  return (
    <ScrollView style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <View style={[styles.header, { backgroundColor: theme.colors.surface, borderBottomColor: theme.colors.border }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <ArrowLeft size={24} color={theme.colors.text} />
        </TouchableOpacity>
        <Text style={[styles.title, { color: theme.colors.text }]}>My Vehicles</Text>
        <TouchableOpacity onPress={handleAddVehicle} style={styles.addButton}>
          <Plus size={24} color={theme.colors.primary} />
        </TouchableOpacity>
      </View>

      <View style={styles.content}>
        {vehicles.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Car size={60} color={theme.colors.textSecondary} />
            <Text style={[styles.emptyTitle, { color: theme.colors.text }]}>No vehicles added</Text>
            <Text style={[styles.emptyText, { color: theme.colors.textSecondary }]}>
              Add your vehicle details to start offering rides
            </Text>
            <TouchableOpacity 
              style={[styles.addButtonLarge, { backgroundColor: theme.colors.primary }]}
              onPress={handleAddVehicle}
            >
              <Plus size={20} color="#FFFFFF" />
              <Text style={styles.addButtonText}>Add Vehicle</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.vehiclesList}>
            {vehicles.map(renderVehicle)}
            
            <TouchableOpacity 
              style={[styles.addVehicleButton, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}
              onPress={handleAddVehicle}
            >
              <Plus size={24} color={theme.colors.primary} />
              <Text style={[styles.addVehicleText, { color: theme.colors.primary }]}>Add Another Vehicle</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
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
  addButton: {
    padding: 8,
  },
  saveButton: {
    padding: 8,
  },
  content: {
    padding: 20,
    gap: 20,
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
  row: {
    flexDirection: 'row',
    gap: 12,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 12,
  },
  halfWidth: {
    flex: 1,
  },
  input: {
    flex: 1,
    fontSize: 16,
  },
  saveButtonLarge: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderRadius: 12,
    gap: 8,
    marginTop: 20,
  },
  saveButtonText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '600',
  },
  preferencesHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 8,
  },
  preferencesDescription: {
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 20,
  },
  preferencesGrid: {
    gap: 12,
    marginBottom: 20,
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
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  preferenceText: {
    flex: 1,
  },
  preferenceLabel: {
    fontSize: 16,
    fontWeight: '500',
  },
  conversationSection: {
    marginBottom: 20,
  },
  conversationTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 12,
  },
  conversationOptions: {
    flexDirection: 'row',
    gap: 8,
  },
  conversationOption: {
    flex: 1,
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: 16,
    paddingHorizontal: 8,
    gap: 8,
  },
  conversationEmoji: {
    fontSize: 24,
  },
  conversationLabel: {
    fontSize: 14,
    fontWeight: '500',
    textAlign: 'center',
  },
  maxPassengersSection: {
    marginBottom: 20,
  },
  maxPassengersTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 12,
  },
  maxPassengersOptions: {
    flexDirection: 'row',
    gap: 8,
  },
  maxPassengersOption: {
    flex: 1,
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: 12,
  },
  maxPassengersText: {
    fontSize: 16,
    fontWeight: '600',
  },
  vehiclesList: {
    gap: 16,
  },
  vehicleCard: {
    padding: 20,
    borderRadius: 16,
    borderWidth: 1,
    gap: 16,
  },
  vehicleHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  vehicleInfo: {
    flex: 1,
  },
  vehicleName: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  vehicleDetails: {
    fontSize: 14,
  },
  vehicleFeatures: {
    fontSize: 12,
    marginTop: 2,
  },
  vehiclePhotos: {
    fontSize: 12,
    marginTop: 2,
  },
  defaultBadge: {
    paddingVertical: 4,
    paddingHorizontal: 12,
    borderRadius: 12,
  },
  defaultText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
  },
  vehicleActions: {
    flexDirection: 'row',
    gap: 8,
  },
  actionButton: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
  },
  actionButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
  addVehicleButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
    borderRadius: 16,
    borderWidth: 2,
    borderStyle: 'dashed',
    gap: 8,
  },
  addVehicleText: {
    fontSize: 16,
    fontWeight: '600',
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 80,
    gap: 16,
  },
  emptyTitle: {
    fontSize: 24,
    fontWeight: 'bold',
  },
  emptyText: {
    fontSize: 16,
    textAlign: 'center',
    lineHeight: 24,
  },
  addButtonLarge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 12,
    gap: 8,
    marginTop: 16,
  },
  addButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
});