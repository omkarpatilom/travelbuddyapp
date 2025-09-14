import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
} from 'react-native';
import { useTheme } from '@/contexts/ThemeContext';
import { MapPin, Navigation } from 'lucide-react-native';
import InteractiveMap from './InteractiveMap';

interface LocationData {
  latitude: number;
  longitude: number;
  address: string;
  placeId?: string;
}

interface MapLocationSelectorProps {
  fromLocation?: LocationData;
  toLocation?: LocationData;
  onLocationsSelected: (from: LocationData, to: LocationData) => void;
  style?: any;
}

export default function MapLocationSelector({
  fromLocation,
  toLocation,
  onLocationsSelected,
  style,
}: MapLocationSelectorProps) {
  const [showMap, setShowMap] = useState(false);
  const { theme } = useTheme();

  const handleLocationsSelected = (from: LocationData, to: LocationData) => {
    onLocationsSelected(from, to);
    setShowMap(false);
  };

  return (
    <>
      <TouchableOpacity
        style={[
          styles.container,
          { backgroundColor: theme.colors.card, borderColor: theme.colors.border },
          style,
        ]}
        onPress={() => setShowMap(true)}
      >
        <View style={styles.header}>
          <Navigation size={20} color={theme.colors.primary} />
          <Text style={[styles.title, { color: theme.colors.text }]}>
            Select on Map
          </Text>
        </View>

        {fromLocation || toLocation ? (
          <View style={styles.locationsPreview}>
            {fromLocation && (
              <View style={styles.locationRow}>
                <MapPin size={16} color="#22C55E" />
                <Text style={[styles.locationText, { color: theme.colors.text }]} numberOfLines={1}>
                  From: {fromLocation.address}
                </Text>
              </View>
            )}
            {toLocation && (
              <View style={styles.locationRow}>
                <MapPin size={16} color="#EF4444" />
                <Text style={[styles.locationText, { color: theme.colors.text }]} numberOfLines={1}>
                  To: {toLocation.address}
                </Text>
              </View>
            )}
          </View>
        ) : (
          <Text style={[styles.subtitle, { color: theme.colors.textSecondary }]}>
            Tap to open interactive map and select pickup & destination
          </Text>
        )}
      </TouchableOpacity>

      <Modal
        visible={showMap}
        animationType="slide"
        presentationStyle="fullScreen"
        onRequestClose={() => setShowMap(false)}
      >
        <InteractiveMap
          initialFrom={fromLocation}
          initialTo={toLocation}
          onLocationsSelected={handleLocationsSelected}
          onClose={() => setShowMap(false)}
        />
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    borderWidth: 1,
    borderRadius: 16,
    padding: 20,
    gap: 12,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  subtitle: {
    fontSize: 14,
    lineHeight: 20,
  },
  locationsPreview: {
    gap: 8,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  locationText: {
    flex: 1,
    fontSize: 14,
  },
});