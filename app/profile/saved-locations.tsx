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
  Modal,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useTheme } from '@/contexts/ThemeContext';
import { MapPin, Plus, X, Home, Briefcase, Heart, ArrowLeft, Save } from 'lucide-react-native';
import LocationPicker from '@/components/LocationPicker';
import { safeBack } from '@/utils/navigation';
import { confirmAction } from '@/utils/dialog';
import {
  SavedLocation,
  useSavedLocationsQuery,
  addSavedLocationOp,
  deleteSavedLocationOp,
} from '@/hooks/useSavedLocations';
import { useOperation, usePendingKeys } from '@/hooks/mutations/operations';

export default function SavedLocationsScreen() {
  const { theme } = useTheme();
  const router = useRouter();

  // Shared with Home, Find Ride and the location picker.
  const locationsQuery = useSavedLocationsQuery();
  const locations: SavedLocation[] = locationsQuery.data ?? [];
  const isLoading = locationsQuery.isPending;
  const [showAddModal, setShowAddModal] = useState(false);
  const { run: runAddLocation } = useOperation(addSavedLocationOp);
  const { run: runDeleteLocation } = useOperation(deleteSavedLocationOp);
  const deletingIds = usePendingKeys('deleteSavedLocation');

  const [newLocation, setNewLocation] = useState({
    name: '',
    address: '',
    type: 'Favorite' as SavedLocation['type'],
    latitude: 0,
    longitude: 0,
  });

  // Pending: the modal closes and a "Saving…" row appears immediately; the
  // real row (with its server id) replaces it once the server has created it.
  const handleAddLocation = async () => {
    if (!newLocation.name || !newLocation.address) {
      Alert.alert('Error', 'Please fill in all fields');
      return;
    }

    const vars = {
      name: newLocation.name,
      address: newLocation.address,
      latitude: newLocation.latitude || 0,
      longitude: newLocation.longitude || 0,
      tempId: `pending-${Date.now()}`,
    };
    setShowAddModal(false);
    setNewLocation({ name: '', address: '', type: 'Favorite', latitude: 0, longitude: 0 });
    try {
      const result = await runAddLocation(vars);
      if (result) Alert.alert('Success', 'Location saved successfully!');
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to save location');
    }
  };

  // Optimistic: the row disappears immediately; restored if the server refuses.
  const handleDeleteLocation = async (id: string) => {
    const confirmed = await confirmAction(
      'Delete Location',
      'Are you sure you want to delete this saved location?',
      'Delete',
      true
    );
    if (!confirmed) return;
    try {
      await runDeleteLocation({ id });
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to delete location');
    }
  };

  const getLocationIcon = (type: SavedLocation['type']) => {
    switch (type) {
      case 'Home': return <Home size={20} color={theme.colors.primary} />;
      case 'Work': return <Briefcase size={20} color={theme.colors.secondary} />;
      case 'Favorite': return <Heart size={20} color={theme.colors.accent} />;
      default: return <MapPin size={20} color={theme.colors.textSecondary} />;
    }
  };

  if (isLoading && locations.length === 0) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: theme.colors.background }]}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
      </View>
    );
  }

  return (
    <ScrollView style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <View style={[styles.header, { backgroundColor: theme.colors.surface, borderBottomColor: theme.colors.border }]}>
        <TouchableOpacity onPress={() => safeBack(router)} style={styles.backButton}>
          <ArrowLeft size={24} color={theme.colors.text} />
        </TouchableOpacity>
        <Text style={[styles.title, { color: theme.colors.text }]}>Saved Locations</Text>
        <TouchableOpacity onPress={() => setShowAddModal(true)} style={styles.addButton}>
          <Plus size={24} color={theme.colors.primary} />
        </TouchableOpacity>
      </View>

      <View style={styles.content}>
        {locations.length === 0 ? (
          <View style={styles.emptyContainer}>
            <MapPin size={60} color={theme.colors.textSecondary} />
            <Text style={[styles.emptyTitle, { color: theme.colors.text }]}>No saved locations</Text>
            <Text style={[styles.emptyText, { color: theme.colors.textSecondary }]}>
              Save your home, work, and other frequent spots for quicker booking.
            </Text>
            <TouchableOpacity 
              style={[styles.addButtonLarge, { backgroundColor: theme.colors.primary }]}
              onPress={() => setShowAddModal(true)}
            >
              <Plus size={20} color="#FFFFFF" />
              <Text style={styles.addButtonText}>Add New Location</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.locationList}>
            {locations.map((item) => (
              <View key={item.id} style={[styles.locationCard, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
                <View style={[styles.iconContainer, { backgroundColor: theme.colors.surface }]}>
                  {getLocationIcon(item.type)}
                </View>
                <View style={styles.locationInfo}>
                  <Text style={[styles.locationName, { color: theme.colors.text }]}>{item.name}</Text>
                  <Text style={[styles.locationAddress, { color: theme.colors.textSecondary }]}>
                    {item._pending ? item._pending.label : item.address}
                  </Text>
                </View>
                <TouchableOpacity
                  onPress={() => handleDeleteLocation(item.id)}
                  style={styles.deleteButton}
                  disabled={!!item._pending || deletingIds.has(item.id)}
                >
                  {item._pending || deletingIds.has(item.id) ? (
                    <ActivityIndicator size="small" color={theme.colors.error} />
                  ) : (
                    <X size={20} color={theme.colors.error} />
                  )}
                </TouchableOpacity>
              </View>
            ))}
            
            <TouchableOpacity 
              style={[styles.addNewButton, { borderColor: theme.colors.border }]}
              onPress={() => setShowAddModal(true)}
            >
              <Plus size={20} color={theme.colors.primary} />
              <Text style={[styles.addNewText, { color: theme.colors.primary }]}>Add Another Location</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>

      <Modal
        visible={showAddModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowAddModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: theme.colors.card }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: theme.colors.text }]}>Save New Location</Text>
              <TouchableOpacity onPress={() => setShowAddModal(false)}>
                <X size={24} color={theme.colors.textSecondary} />
              </TouchableOpacity>
            </View>

            <View style={styles.modalBody}>
              <View style={styles.inputGroup}>
                <Text style={[styles.inputLabel, { color: theme.colors.textSecondary }]}>Name</Text>
                <TextInput
                  style={[styles.input, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border, color: theme.colors.text }]}
                  placeholder="e.g., Home, Work, Gym"
                  placeholderTextColor={theme.colors.textSecondary}
                  value={newLocation.name}
                  onChangeText={(text) => setNewLocation(prev => ({ ...prev, name: text }))}
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={[styles.inputLabel, { color: theme.colors.textSecondary }]}>Address</Text>
                <LocationPicker
                  value={newLocation.address}
                  onLocationChange={(address, coords) => {
                    setNewLocation(prev => ({
                      ...prev,
                      address,
                      latitude: coords?.latitude || 0,
                      longitude: coords?.longitude || 0,
                    }));
                  }}
                  placeholder="Search and select address..."
                  showIcon={true}
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={[styles.inputLabel, { color: theme.colors.textSecondary }]}>Type</Text>
                <View style={styles.typeRow}>
                  {(['Home', 'Work', 'Favorite', 'Other'] as const).map((type) => (
                    <TouchableOpacity
                      key={type}
                      style={[
                        styles.typeButton,
                        { borderColor: theme.colors.border },
                        newLocation.type === type && { backgroundColor: theme.colors.primary, borderColor: theme.colors.primary }
                      ]}
                      onPress={() => setNewLocation(prev => ({ ...prev, type }))}
                    >
                      <Text style={[
                        styles.typeButtonText,
                        { color: theme.colors.text },
                        newLocation.type === type && { color: '#FFFFFF' }
                      ]}>{type}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              <TouchableOpacity
                style={[styles.saveButton, { backgroundColor: theme.colors.primary }]}
                onPress={handleAddLocation}
              >
                <Save size={20} color="#FFFFFF" />
                <Text style={styles.saveButtonText}>Save Location</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
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
  addButton: {
    padding: 8,
  },
  content: {
    padding: 20,
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
  locationList: {
    gap: 16,
  },
  locationCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    gap: 16,
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  locationInfo: {
    flex: 1,
  },
  locationName: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  locationAddress: {
    fontSize: 14,
  },
  deleteButton: {
    padding: 8,
  },
  addNewButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    borderRadius: 12,
    borderWidth: 2,
    borderStyle: 'dashed',
    gap: 8,
    marginTop: 8,
  },
  addNewText: {
    fontSize: 16,
    fontWeight: '600',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingBottom: 40,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 24,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  modalBody: {
    padding: 24,
    gap: 20,
  },
  inputGroup: {
    gap: 8,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '500',
  },
  input: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
  },
  typeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  typeButton: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
    borderWidth: 1,
  },
  typeButtonText: {
    fontSize: 14,
    fontWeight: '500',
  },
  saveButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderRadius: 12,
    gap: 8,
    marginTop: 12,
  },
  saveButtonText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '600',
  },
});
