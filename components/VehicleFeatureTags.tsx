import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Modal,
} from 'react-native';
import { useTheme } from '@/contexts/ThemeContext';
import { 
  Wind, 
  Music, 
  Smartphone, 
  Wifi, 
  Heart, 
  Coffee, 
  Zap, 
  Shield, 
  Plus,
  X,
  Search
} from 'lucide-react-native';

export interface VehicleFeature {
  id: string;
  name: string;
  icon: React.ReactNode;
  category: 'comfort' | 'entertainment' | 'safety' | 'convenience';
  popular: boolean;
}

interface VehicleFeatureTagsProps {
  selectedFeatures: string[];
  onFeaturesChange: (features: string[]) => void;
  style?: any;
}

const AVAILABLE_FEATURES: VehicleFeature[] = [
  // Comfort
  { id: 'ac', name: 'Air Conditioning', icon: <Wind size={16} />, category: 'comfort', popular: true },
  { id: 'heating', name: 'Heating', icon: <Zap size={16} />, category: 'comfort', popular: false },
  { id: 'leather_seats', name: 'Leather Seats', icon: <Coffee size={16} />, category: 'comfort', popular: false },
  { id: 'sunroof', name: 'Sunroof', icon: <Shield size={16} />, category: 'comfort', popular: false },
  
  // Entertainment
  { id: 'music_system', name: 'Music System', icon: <Music size={16} />, category: 'entertainment', popular: true },
  { id: 'bluetooth', name: 'Bluetooth', icon: <Smartphone size={16} />, category: 'entertainment', popular: true },
  { id: 'wifi', name: 'WiFi Hotspot', icon: <Wifi size={16} />, category: 'entertainment', popular: false },
  { id: 'usb_charging', name: 'USB Charging', icon: <Zap size={16} />, category: 'entertainment', popular: true },
  
  // Safety
  { id: 'dashcam', name: 'Dash Camera', icon: <Shield size={16} />, category: 'safety', popular: false },
  { id: 'gps_tracking', name: 'GPS Tracking', icon: <Shield size={16} />, category: 'safety', popular: false },
  { id: 'emergency_kit', name: 'Emergency Kit', icon: <Shield size={16} />, category: 'safety', popular: false },
  
  // Convenience
  { id: 'pet_friendly', name: 'Pet Friendly', icon: <Heart size={16} />, category: 'convenience', popular: true },
  { id: 'phone_charger', name: 'Phone Charger', icon: <Smartphone size={16} />, category: 'convenience', popular: true },
  { id: 'water_bottles', name: 'Water Bottles', icon: <Coffee size={16} />, category: 'convenience', popular: false },
  { id: 'tissues', name: 'Tissues', icon: <Coffee size={16} />, category: 'convenience', popular: false },
];

export default function VehicleFeatureTags({
  selectedFeatures,
  onFeaturesChange,
  style,
}: VehicleFeatureTagsProps) {
  const [showAllFeatures, setShowAllFeatures] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [customFeature, setCustomFeature] = useState('');
  const { theme } = useTheme();

  const toggleFeature = (featureId: string) => {
    if (selectedFeatures.includes(featureId)) {
      onFeaturesChange(selectedFeatures.filter(id => id !== featureId));
    } else {
      onFeaturesChange([...selectedFeatures, featureId]);
    }
  };

  const addCustomFeature = () => {
    if (customFeature.trim() && !selectedFeatures.includes(customFeature.trim())) {
      onFeaturesChange([...selectedFeatures, customFeature.trim()]);
      setCustomFeature('');
    }
  };

  const removeCustomFeature = (feature: string) => {
    onFeaturesChange(selectedFeatures.filter(f => f !== feature));
  };

  const getFeaturesByCategory = (category: string) => {
    return AVAILABLE_FEATURES.filter(feature => feature.category === category);
  };

  const getFilteredFeatures = () => {
    if (!searchQuery) return AVAILABLE_FEATURES;
    return AVAILABLE_FEATURES.filter(feature =>
      feature.name.toLowerCase().includes(searchQuery.toLowerCase())
    );
  };

  const getCustomFeatures = () => {
    return selectedFeatures.filter(feature => 
      !AVAILABLE_FEATURES.some(af => af.id === feature)
    );
  };

  const getCategoryColor = (category: string) => {
    switch (category) {
      case 'comfort': return theme.colors.primary;
      case 'entertainment': return theme.colors.secondary;
      case 'safety': return theme.colors.error;
      case 'convenience': return theme.colors.accent;
      default: return theme.colors.textSecondary;
    }
  };

  const renderFeatureTag = (feature: VehicleFeature, isSelected: boolean) => (
    <TouchableOpacity
      key={feature.id}
      style={[
        styles.featureTag,
        { 
          backgroundColor: isSelected ? getCategoryColor(feature.category) + '20' : theme.colors.surface,
          borderColor: isSelected ? getCategoryColor(feature.category) : theme.colors.border,
        }
      ]}
      onPress={() => toggleFeature(feature.id)}
    >
      <View style={[
        styles.featureIcon,
        { backgroundColor: isSelected ? getCategoryColor(feature.category) : theme.colors.background }
      ]}>
        {React.cloneElement(feature.icon as React.ReactElement, {
          color: isSelected ? '#FFFFFF' : theme.colors.textSecondary,
        })}
      </View>
      <Text style={[
        styles.featureText,
        { color: isSelected ? getCategoryColor(feature.category) : theme.colors.text }
      ]}>
        {feature.name}
      </Text>
      {feature.popular && (
        <View style={[styles.popularBadge, { backgroundColor: theme.colors.warning }]}>
          <Text style={styles.popularText}>Popular</Text>
        </View>
      )}
    </TouchableOpacity>
  );

  const renderCustomFeatureTag = (feature: string) => (
    <View
      key={feature}
      style={[
        styles.customFeatureTag,
        { 
          backgroundColor: theme.colors.accent + '20',
          borderColor: theme.colors.accent,
        }
      ]}
    >
      <Text style={[styles.customFeatureText, { color: theme.colors.accent }]}>
        {feature}
      </Text>
      <TouchableOpacity
        style={styles.removeCustomFeature}
        onPress={() => removeCustomFeature(feature)}
      >
        <X size={14} color={theme.colors.accent} />
      </TouchableOpacity>
    </View>
  );

  const popularFeatures = AVAILABLE_FEATURES.filter(f => f.popular);
  const customFeatures = getCustomFeatures();

  return (
    <View style={[styles.container, style]}>
      <View style={styles.header}>
        <Text style={[styles.title, { color: theme.colors.text }]}>
          Vehicle Features ({selectedFeatures.length})
        </Text>
        <Text style={[styles.subtitle, { color: theme.colors.textSecondary }]}>
          Select features available in your vehicle
        </Text>
      </View>

      {/* Popular Features */}
      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>
          Popular Features
        </Text>
        <View style={styles.featuresGrid}>
          {popularFeatures.map(feature => 
            renderFeatureTag(feature, selectedFeatures.includes(feature.id))
          )}
        </View>
      </View>

      {/* Custom Features */}
      {customFeatures.length > 0 && (
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>
            Custom Features
          </Text>
          <View style={styles.customFeaturesContainer}>
            {customFeatures.map(renderCustomFeatureTag)}
          </View>
        </View>
      )}

      {/* Add Custom Feature */}
      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>
          Add Custom Feature
        </Text>
        <View style={styles.customFeatureInput}>
          <TextInput
            style={[
              styles.customInput,
              { 
                backgroundColor: theme.colors.surface,
                borderColor: theme.colors.border,
                color: theme.colors.text,
              }
            ]}
            placeholder="Enter custom feature (e.g., Baby Seat)"
            placeholderTextColor={theme.colors.textSecondary}
            value={customFeature}
            onChangeText={setCustomFeature}
            onSubmitEditing={addCustomFeature}
          />
          <TouchableOpacity
            style={[styles.addButton, { backgroundColor: theme.colors.primary }]}
            onPress={addCustomFeature}
            disabled={!customFeature.trim()}
          >
            <Plus size={20} color="#FFFFFF" />
          </TouchableOpacity>
        </View>
      </View>

      {/* Browse All Features */}
      <TouchableOpacity
        style={[styles.browseAllButton, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}
        onPress={() => setShowAllFeatures(true)}
      >
        <Search size={20} color={theme.colors.primary} />
        <Text style={[styles.browseAllText, { color: theme.colors.primary }]}>
          Browse All Features
        </Text>
      </TouchableOpacity>

      {/* All Features Modal */}
      <Modal
        visible={showAllFeatures}
        transparent
        animationType="slide"
        onRequestClose={() => setShowAllFeatures(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: theme.colors.card }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: theme.colors.text }]}>
                All Vehicle Features
              </Text>
              <TouchableOpacity onPress={() => setShowAllFeatures(false)}>
                <X size={24} color={theme.colors.textSecondary} />
              </TouchableOpacity>
            </View>

            <View style={[styles.searchContainer, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
              <Search size={20} color={theme.colors.textSecondary} />
              <TextInput
                style={[styles.searchInput, { color: theme.colors.text }]}
                placeholder="Search features..."
                placeholderTextColor={theme.colors.textSecondary}
                value={searchQuery}
                onChangeText={setSearchQuery}
              />
            </View>

            <ScrollView style={styles.modalScroll}>
              {['comfort', 'entertainment', 'safety', 'convenience'].map(category => {
                const categoryFeatures = getFeaturesByCategory(category).filter(feature =>
                  !searchQuery || feature.name.toLowerCase().includes(searchQuery.toLowerCase())
                );
                
                if (categoryFeatures.length === 0) return null;

                return (
                  <View key={category} style={styles.categorySection}>
                    <Text style={[styles.categoryTitle, { color: getCategoryColor(category) }]}>
                      {category.charAt(0).toUpperCase() + category.slice(1)}
                    </Text>
                    <View style={styles.categoryFeatures}>
                      {categoryFeatures.map(feature => 
                        renderFeatureTag(feature, selectedFeatures.includes(feature.id))
                      )}
                    </View>
                  </View>
                );
              })}
            </ScrollView>

            <TouchableOpacity
              style={[styles.doneButton, { backgroundColor: theme.colors.primary }]}
              onPress={() => setShowAllFeatures(false)}
            >
              <Text style={styles.doneButtonText}>Done</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 20,
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
  },
  section: {
    gap: 12,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
  },
  featuresGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  featureTag: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 20,
    paddingVertical: 8,
    paddingHorizontal: 12,
    gap: 8,
    position: 'relative',
  },
  featureIcon: {
    width: 24,
    height: 24,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  featureText: {
    fontSize: 14,
    fontWeight: '500',
  },
  popularBadge: {
    position: 'absolute',
    top: -6,
    right: -6,
    paddingVertical: 2,
    paddingHorizontal: 6,
    borderRadius: 8,
  },
  popularText: {
    color: '#FFFFFF',
    fontSize: 8,
    fontWeight: '600',
  },
  customFeaturesContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  customFeatureTag: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 16,
    paddingVertical: 6,
    paddingHorizontal: 12,
    gap: 8,
  },
  customFeatureText: {
    fontSize: 14,
    fontWeight: '500',
  },
  removeCustomFeature: {
    padding: 2,
  },
  customFeatureInput: {
    flexDirection: 'row',
    gap: 8,
  },
  customInput: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
  },
  addButton: {
    width: 40,
    height: 40,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  browseAllButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderRadius: 8,
    paddingVertical: 12,
    gap: 8,
  },
  browseAllText: {
    fontSize: 14,
    fontWeight: '600',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '90%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    margin: 20,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
  },
  modalScroll: {
    flex: 1,
    padding: 20,
  },
  categorySection: {
    marginBottom: 24,
  },
  categoryTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 12,
  },
  categoryFeatures: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  doneButton: {
    margin: 20,
    paddingVertical: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  doneButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
});