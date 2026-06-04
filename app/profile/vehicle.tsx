import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useTheme } from '@/contexts/ThemeContext';
import { api } from '@/utils/api';
import { Car, Hash, Palette, Calendar, Users, ArrowLeft, Save, Plus } from 'lucide-react-native';
import PhotoUploader from '@/components/PhotoUploader';
import VehicleFeatureTags, { AVAILABLE_FEATURES } from '@/components/VehicleFeatureTags';
import RidePreferences, { UniversalRidePreferences } from '@/components/RidePreferences';

interface Vehicle {
  id: string;
  category: string;
  make: string;
  model: string;
  year: string;
  color: string;
  licensePlate: string;
  seats: string;
  photos: string[];
  isDefault: boolean;
  features: string[];
  preferences?: UniversalRidePreferences;
}

export default function VehicleDetailsScreen() {
  const { theme } = useTheme();
  const router = useRouter();

  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [isEditing, setIsEditing] = useState(false);
  const [editingVehicle, setEditingVehicle] = useState<Vehicle | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const [formData, setFormData] = useState({
    category: 'Car',
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
      femalePassengersOnly: false,
      verifiedPassengersOnly: false,
    } as UniversalRidePreferences,
  });

  useEffect(() => {
    fetchVehicles();
  }, []);

  const fetchVehicles = async () => {
    setIsLoading(true);
    try {
      const data = await api.get<any[]>('/vehicles/my-vehicles');
      const mappedVehicles = await Promise.all(data.map(async (v: any) => {
        // Fetch features, preferences, and photos for each vehicle
        let features: string[] = [];
        let preferences: UniversalRidePreferences | undefined;
        let photos: string[] = [];
        
        try {
          const featureData = await api.get<any[]>(`/VehicleFeatures/${v.id}/features`);
          features = featureData.map(f => f.featureCode);
        } catch (e) { console.error('Error fetching features', e); }

        try {
          const photoData = await api.get<any[]>(`/VehiclePhotos/${v.id}/photos`);
          photos = photoData.map(p => p.fileUrl);
        } catch (e) { console.error('Error fetching photos', e); }

        try {
          const prefData = await api.get<any>(`/VehiclePreferences/${v.id}/preferences`);
          preferences = {
            nonSmoking: !prefData.allowSmoking,
            musicAllowed: prefData.allowMusic,
            petsAllowed: prefData.allowPets,
            airConditioning: true, // Default
            conversationLevel: mapConversationLevel(prefData.conversationLevel),
            maxPassengers: v.totalSeats,
            instantBooking: false,
            femalePassengersOnly: false,
            verifiedPassengersOnly: prefData.requireVerifiedPassengers,
          };
        } catch (e) { console.error('Error fetching preferences', e); }

        let makeVal = v.brand || '';
        let categoryVal = 'Car';
        if (makeVal.includes(':')) {
          const parts = makeVal.split(':');
          categoryVal = parts[0];
          makeVal = parts[1];
        }

        return {
          id: v.id,
          category: categoryVal,
          make: makeVal,
          model: v.model || '',
          year: v.createdAt ? new Date(v.createdAt).getFullYear().toString() : '',
          color: v.color || '',
          licensePlate: v.registrationNumber || '',
          seats: v.totalSeats?.toString() || '0',
          photos,
          isDefault: v.isDefault || false,
          features,
          preferences,
        };
      }));
      setVehicles(mappedVehicles);
    } catch (error) {
      console.error('Error fetching vehicles:', error);
      // Fallback to mock data if API fails during development
      // setVehicles(mockVehicles);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  const mapConversationLevel = (level: number): 'quiet' | 'moderate' | 'talkative' => {
    switch (level) {
      case 0: return 'quiet';
      case 1: return 'moderate';
      case 2: return 'talkative';
      default: return 'moderate';
    }
  };

  const reverseMapConversationLevel = (level: string): number => {
    switch (level) {
      case 'quiet': return 0;
      case 'moderate': return 1;
      case 'talkative': return 2;
      default: return 1;
    }
  };

  const onRefresh = () => {
    setIsRefreshing(true);
    fetchVehicles();
  };

  const updateFormData = (field: string, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleAddVehicle = () => {
    setFormData({
      category: 'Car',
      make: '',
      model: '',
      year: '',
      color: '',
      licensePlate: '',
      seats: '4',
      photos: [],
      features: [],
      preferences: {
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
    setEditingVehicle(null);
    setIsEditing(true);
  };

  const handleEditVehicle = (vehicle: Vehicle) => {
    setFormData({
      category: vehicle.category || 'Car',
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
    if (!formData.make || !formData.model || !formData.color || !formData.licensePlate) {
      Alert.alert('Missing Information', 'Please fill in all required fields');
      return;
    }

    setIsLoading(true);
    try {
      let vehicleId = editingVehicle?.id;

      const serializedBrand = `${formData.category}:${formData.make}`;

      if (editingVehicle) {
        // Update existing vehicle
        await api.put(`/vehicles/${editingVehicle.id}`, {
          vehicleId: editingVehicle.id,
          brand: serializedBrand,
          model: formData.model,
          color: formData.color,
          totalSeats: parseInt(formData.seats),
        });

        // Update preferences
        await api.put(`/VehiclePreferences/${editingVehicle.id}/preferences`, {
          vehicleId: editingVehicle.id,
          allowMusic: formData.preferences.musicAllowed,
          allowSmoking: !formData.preferences.nonSmoking,
          allowPets: formData.preferences.petsAllowed,
          conversationLevel: reverseMapConversationLevel(formData.preferences.conversationLevel),
          requireVerifiedPassengers: formData.preferences.verifiedPassengersOnly,
        });

      } else {
        // Add new vehicle
        vehicleId = await api.post<string>('/vehicles', {
          brand: serializedBrand,
          model: formData.model,
          color: formData.color,
          registrationNumber: formData.licensePlate,
          totalSeats: parseInt(formData.seats),
        });

        // Set preferences for new vehicle
        await api.put(`/VehiclePreferences/${vehicleId}/preferences`, {
          vehicleId: vehicleId,
          allowMusic: formData.preferences.musicAllowed,
          allowSmoking: !formData.preferences.nonSmoking,
          allowPets: formData.preferences.petsAllowed,
          conversationLevel: reverseMapConversationLevel(formData.preferences.conversationLevel),
          requireVerifiedPassengers: formData.preferences.verifiedPassengersOnly,
        });
      }

      if (vehicleId) {
        // Save features
        for (const featureId of formData.features) {
          const feature = AVAILABLE_FEATURES.find(f => f.id === featureId);
          if (feature) {
            try {
              await api.post(`/VehicleFeatures/${vehicleId}/features`, {
                vehicleId: vehicleId,
                featureCode: feature.id,
                featureName: feature.name,
                category: mapFeatureCategory(feature.category),
              });
            } catch (e) {
              console.log(`Error saving feature ${featureId}`, e);
            }
          }
        }

        // Save photos
        const localPhotos = formData.photos.filter(p => p.startsWith('file://') || p.startsWith('content://'));
        for (let i = 0; i < localPhotos.length; i++) {
          try {
            await api.post(`/VehiclePhotos/${vehicleId}/photos`, {
              vehicleId: vehicleId,
              fileUrl: localPhotos[i],
              isPrimary: i === 0 && formData.photos[0] === localPhotos[i],
            });
          } catch (e) {
            console.error(`Error saving photo ${i}`, e);
          }
        }
      }

      setIsEditing(false);
      fetchVehicles();
      Alert.alert('Success', 'Vehicle saved successfully!');
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to save vehicle. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const mapFeatureCategory = (category: string): number => {
    switch (category) {
      case 'comfort': return 0;
      case 'entertainment': return 1;
      case 'safety': return 2;
      case 'convenience': return 3;
      default: return 0;
    }
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
          onPress: async () => {
            try {
              setIsLoading(true);
              await api.delete(`/vehicles/${vehicleId}`);
              fetchVehicles();
            } catch (error: any) {
              Alert.alert('Error', error.message || 'Failed to delete vehicle');
            } finally {
              setIsLoading(false);
            }
          }
        },
      ]
    );
  };

  const handleSetDefault = async (vehicleId: string) => {
    try {
      setIsLoading(true);
      await api.patch(`/vehicles/${vehicleId}/default`, {});
      fetchVehicles();
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to set default vehicle');
    } finally {
      setIsLoading(false);
    }
  };

  const getCategoryEmoji = (category: string) => {
    switch (category?.toLowerCase()) {
      case 'car': return '🚗';
      case 'bike': return '🏍';
      case 'bus': return '🚌';
      case 'van': return '🚐';
      case 'ev': return '⚡';
      default: return '🚗';
    }
  };

  const renderVehicle = (vehicle: Vehicle) => (
    <View key={vehicle.id} style={[styles.vehicleCard, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
      <View style={styles.vehicleHeader}>
        <View style={styles.vehicleInfo}>
          <Text style={[styles.vehicleName, { color: theme.colors.text }]}>
            {getCategoryEmoji(vehicle.category)} {vehicle.year} {vehicle.make} {vehicle.model}
          </Text>
          <Text style={[styles.vehicleDetails, { color: theme.colors.textSecondary }]}>
            {vehicle.category} • {vehicle.color} • {vehicle.licensePlate} • {vehicle.seats} seats
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

            <Text style={[styles.inputLabel, { color: theme.colors.textSecondary, marginBottom: 8, fontSize: 13, fontWeight: '600' }]}>Vehicle Category</Text>
            <View style={styles.categoryTabRow}>
              {['Car', 'Bike', 'Bus', 'Van', 'EV'].map((cat) => (
                <TouchableOpacity
                  key={cat}
                  style={[
                    styles.categoryTab,
                    { borderColor: theme.colors.border, backgroundColor: theme.colors.surface },
                    formData.category === cat && { borderColor: theme.colors.primary, backgroundColor: theme.colors.primary + '15' }
                  ]}
                  onPress={() => updateFormData('category', cat)}
                >
                  <Text style={styles.categoryTabEmoji}>
                    {cat === 'Car' ? '🚗' : cat === 'Bike' ? '🏍' : cat === 'Bus' ? '🚌' : cat === 'Van' ? '🚐' : '⚡'}
                  </Text>
                  <Text style={[styles.categoryTabText, { color: formData.category === cat ? theme.colors.primary : theme.colors.text, fontWeight: formData.category === cat ? '700' : '500' }]}>
                    {cat}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            
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

          <RidePreferences
            preferences={formData.preferences}
            onPreferencesChange={(preferences) => updateFormData('preferences', preferences)}
            mode="edit"
            canOverride={true}
          />

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
    <ScrollView 
      style={[styles.container, { backgroundColor: theme.colors.background }]}
      refreshControl={
        <RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} colors={[theme.colors.primary]} />
      }
    >
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
  categoryTabRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 6,
    marginBottom: 16,
  },
  categoryTab: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: 10,
    alignItems: 'center',
    gap: 4,
  },
  categoryTabEmoji: {
    fontSize: 16,
  },
  categoryTabText: {
    fontSize: 11,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '600',
  },
});