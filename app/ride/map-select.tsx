import React, { useState } from 'react';
import {
  View,
  StyleSheet,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useTheme } from '@/contexts/ThemeContext';
import InteractiveMap from '@/components/InteractiveMap';

interface LocationData {
  latitude: number;
  longitude: number;
  address: string;
  placeId?: string;
}

export default function MapSelectScreen() {
  const { theme } = useTheme();
  const router = useRouter();
  const params = useLocalSearchParams();

  // Parse initial locations from params if provided
  const initialFrom = params.from ? JSON.parse(params.from as string) : undefined;
  const initialTo = params.to ? JSON.parse(params.to as string) : undefined;

  const handleLocationsSelected = (from: LocationData, to: LocationData) => {
    // Navigate back with selected locations
    const returnScreen = params.returnScreen as string || '/ride/find';
    
    router.push({
      pathname: returnScreen,
      params: {
        fromLocation: JSON.stringify(from),
        toLocation: JSON.stringify(to),
        fromMap: 'true',
      },
    });
  };

  const handleClose = () => {
    router.back();
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <InteractiveMap
        initialFrom={initialFrom}
        initialTo={initialTo}
        onLocationsSelected={handleLocationsSelected}
        onClose={handleClose}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});