import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  FlatList,
  Image,
} from 'react-native';
import { useTheme } from '@/contexts/ThemeContext';
import { Car, ChevronDown, Check } from 'lucide-react-native';

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
}

interface VehicleSelectorProps {
  vehicles: Vehicle[];
  selectedVehicle: Vehicle | null;
  onVehicleSelect: (vehicle: Vehicle) => void;
  style?: any;
}

export default function VehicleSelector({
  vehicles,
  selectedVehicle,
  onVehicleSelect,
  style,
}: VehicleSelectorProps) {
  const [isVisible, setIsVisible] = useState(false);
  const { theme } = useTheme();

  const renderVehicle = ({ item }: { item: Vehicle }) => (
    <TouchableOpacity
      style={[
        styles.vehicleItem,
        { backgroundColor: theme.colors.surface, borderColor: theme.colors.border },
        selectedVehicle?.id === item.id && { borderColor: theme.colors.primary, borderWidth: 2 },
      ]}
      onPress={() => {
        onVehicleSelect(item);
        setIsVisible(false);
      }}
    >
      <View style={styles.vehicleContent}>
        {item.photos.length > 0 ? (
          <Image source={{ uri: item.photos[0] }} style={styles.vehiclePhoto} />
        ) : (
          <View style={[styles.vehiclePhotoPlaceholder, { backgroundColor: theme.colors.background }]}>
            <Car size={24} color={theme.colors.textSecondary} />
          </View>
        )}
        
        <View style={styles.vehicleDetails}>
          <Text style={[styles.vehicleName, { color: theme.colors.text }]}>
            {item.year} {item.make} {item.model}
          </Text>
          <Text style={[styles.vehicleInfo, { color: theme.colors.textSecondary }]}>
            {item.color} • {item.licensePlate} • {item.seats} seats
          </Text>
          {item.isDefault && (
            <View style={[styles.defaultBadge, { backgroundColor: theme.colors.primary }]}>
              <Text style={styles.defaultText}>Default</Text>
            </View>
          )}
        </View>
        
        {selectedVehicle?.id === item.id && (
          <Check size={20} color={theme.colors.primary} />
        )}
      </View>
    </TouchableOpacity>
  );

  if (vehicles.length === 0) {
    return (
      <View style={[styles.emptyContainer, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }, style]}>
        <Car size={20} color={theme.colors.textSecondary} />
        <Text style={[styles.emptyText, { color: theme.colors.textSecondary }]}>
          No vehicles added
        </Text>
      </View>
    );
  }

  if (vehicles.length === 1) {
    const vehicle = vehicles[0];
    return (
      <View style={[styles.singleVehicleContainer, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }, style]}>
        {vehicle.photos.length > 0 ? (
          <Image source={{ uri: vehicle.photos[0] }} style={styles.singleVehiclePhoto} />
        ) : (
          <View style={[styles.singleVehiclePhotoPlaceholder, { backgroundColor: theme.colors.background }]}>
            <Car size={16} color={theme.colors.textSecondary} />
          </View>
        )}
        <Text style={[styles.singleVehicleText, { color: theme.colors.text }]}>
          {vehicle.year} {vehicle.make} {vehicle.model}
        </Text>
      </View>
    );
  }

  return (
    <>
      <TouchableOpacity
        style={[
          styles.selector,
          { backgroundColor: theme.colors.surface, borderColor: theme.colors.border },
          style,
        ]}
        onPress={() => setIsVisible(true)}
      >
        <View style={styles.selectorContent}>
          {selectedVehicle ? (
            <>
              {selectedVehicle.photos.length > 0 ? (
                <Image source={{ uri: selectedVehicle.photos[0] }} style={styles.selectedVehiclePhoto} />
              ) : (
                <View style={[styles.selectedVehiclePhotoPlaceholder, { backgroundColor: theme.colors.background }]}>
                  <Car size={16} color={theme.colors.textSecondary} />
                </View>
              )}
              <Text style={[styles.selectedVehicleText, { color: theme.colors.text }]}>
                {selectedVehicle.year} {selectedVehicle.make} {selectedVehicle.model}
              </Text>
            </>
          ) : (
            <>
              <Car size={20} color={theme.colors.textSecondary} />
              <Text style={[styles.placeholderText, { color: theme.colors.textSecondary }]}>
                Select Vehicle
              </Text>
            </>
          )}
        </View>
        <ChevronDown size={20} color={theme.colors.textSecondary} />
      </TouchableOpacity>

      <Modal
        visible={isVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setIsVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: theme.colors.card }]}>
            <Text style={[styles.modalTitle, { color: theme.colors.text }]}>
              Select Vehicle
            </Text>
            <FlatList
              data={vehicles}
              keyExtractor={(item) => item.id}
              renderItem={renderVehicle}
              style={styles.vehicleList}
            />
            <TouchableOpacity
              style={[styles.cancelButton, { backgroundColor: theme.colors.surface }]}
              onPress={() => setIsVisible(false)}
            >
              <Text style={[styles.cancelButtonText, { color: theme.colors.textSecondary }]}>
                Cancel
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  selector: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  selectorContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  selectedVehiclePhoto: {
    width: 32,
    height: 32,
    borderRadius: 6,
  },
  selectedVehiclePhotoPlaceholder: {
    width: 32,
    height: 32,
    borderRadius: 6,
    justifyContent: 'center',
    alignItems: 'center',
  },
  selectedVehicleText: {
    fontSize: 16,
    flex: 1,
  },
  placeholderText: {
    fontSize: 16,
    flex: 1,
  },
  singleVehicleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 12,
  },
  singleVehiclePhoto: {
    width: 32,
    height: 32,
    borderRadius: 6,
  },
  singleVehiclePhotoPlaceholder: {
    width: 32,
    height: 32,
    borderRadius: 6,
    justifyContent: 'center',
    alignItems: 'center',
  },
  singleVehicleText: {
    fontSize: 16,
    flex: 1,
  },
  emptyContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 12,
  },
  emptyText: {
    fontSize: 16,
    flex: 1,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    width: '100%',
    maxWidth: 400,
    borderRadius: 16,
    padding: 20,
    maxHeight: '80%',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 16,
    textAlign: 'center',
  },
  vehicleList: {
    maxHeight: 400,
  },
  vehicleItem: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  vehicleContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  vehiclePhoto: {
    width: 50,
    height: 50,
    borderRadius: 8,
  },
  vehiclePhotoPlaceholder: {
    width: 50,
    height: 50,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  vehicleDetails: {
    flex: 1,
  },
  vehicleName: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  vehicleInfo: {
    fontSize: 14,
    marginBottom: 4,
  },
  defaultBadge: {
    alignSelf: 'flex-start',
    paddingVertical: 2,
    paddingHorizontal: 8,
    borderRadius: 8,
  },
  defaultText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '600',
  },
  cancelButton: {
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 16,
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
});