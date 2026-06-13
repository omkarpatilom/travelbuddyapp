import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Platform,
  Dimensions,
  Linking,
  Alert,
} from 'react-native';
import { useTheme } from '@/contexts/ThemeContext';
import { getRoute } from '@/utils/routeService';
import { darkMapStyle } from '@/utils/mapStyles';
import { MapPin, Navigation, Compass, AlertCircle, Maximize2, ExternalLink, Car } from 'lucide-react-native';

const isWeb = Platform.OS === 'web';

// Import react-native-maps conditionally for native execution
let MapView: any, Marker: any, Polyline: any, PROVIDER_GOOGLE: any;
if (!isWeb) {
  const Maps = require('react-native-maps');
  MapView = Maps.default;
  Marker = Maps.Marker;
  Polyline = Maps.Polyline;
  PROVIDER_GOOGLE = Maps.PROVIDER_GOOGLE;
}

const { width } = Dimensions.get('window');

interface RouteMapProps {
  from: {
    address: string;
    coordinates: { latitude: number; longitude: number };
  };
  to: {
    address: string;
    coordinates: { latitude: number; longitude: number };
  };
  distance: string;
  duration: string;
  driverLocation?: { latitude: number; longitude: number } | null;
  containerStyle?: any;
}

export default function RouteMap({ from, to, distance, duration, driverLocation, containerStyle }: RouteMapProps) {
  const { theme, isDark } = useTheme();
  const [routeCoords, setRouteCoords] = useState<{ latitude: number; longitude: number }[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeMarker, setActiveMarker] = useState<'from' | 'to' | null>(null);
  
  const mapRef = useRef<any>(null);

  useEffect(() => {
    fetchRouteData();
  }, [
    from.coordinates.latitude,
    from.coordinates.longitude,
    to.coordinates.latitude,
    to.coordinates.longitude
  ]);

  const fetchRouteData = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await getRoute(
        from.coordinates.latitude,
        from.coordinates.longitude,
        to.coordinates.latitude,
        to.coordinates.longitude
      );
      setRouteCoords(data.coordinates);
    } catch (err) {
      console.error('Error in RouteMap fetching route:', err);
      setError('Unable to load route layout.');
    } finally {
      setIsLoading(false);
    }
  };

  const fitToRoute = () => {
    if (mapRef.current && routeCoords.length > 0) {
      mapRef.current.fitToCoordinates(
        [
          { latitude: from.coordinates.latitude, longitude: from.coordinates.longitude },
          { latitude: to.coordinates.latitude, longitude: to.coordinates.longitude },
        ],
        {
          edgePadding: { top: 50, right: 50, bottom: 50, left: 50 },
          animated: true,
        }
      );
    }
  };

  useEffect(() => {
    if (!isLoading && routeCoords.length > 0) {
      // Small timeout to allow map layout mounting
      const timer = setTimeout(() => {
        fitToRoute();
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [isLoading, routeCoords]);

  const openDirections = () => {
    const latFrom = from.coordinates.latitude;
    const lonFrom = from.coordinates.longitude;
    const latTo = to.coordinates.latitude;
    const lonTo = to.coordinates.longitude;

    const url = Platform.select({
      ios: `maps://?saddr=${latFrom},${lonFrom}&daddr=${latTo},${lonTo}&dirflg=d`,
      android: `google.navigation:q=${latTo},${lonTo}&referrer=travelbuddy`,
      default: `https://www.google.com/maps/dir/?api=1&origin=${latFrom},${lonFrom}&destination=${latTo},${lonTo}`,
    });

    Linking.canOpenURL(url)
      .then((supported) => {
        if (supported) {
          Linking.openURL(url);
        } else {
          Alert.alert('Error', 'Unable to open maps application.');
        }
      })
      .catch((err) => console.error('An error occurred opening navigation maps', err));
  };

  if (isWeb) {
    // Premium Web Interactive UI fallback representation
    return (
      <View style={[styles.webContainer, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }, containerStyle]}>
        {/* Dynamic decorative backdrop replicating map lines */}
        <View style={styles.webMapArt}>
          <View style={[styles.webGridLine, { top: '30%', backgroundColor: theme.colors.border }]} />
          <View style={[styles.webGridLine, { top: '60%', backgroundColor: theme.colors.border }]} />
          <View style={[styles.webGridLine, { left: '33%', width: 1, height: '100%', backgroundColor: theme.colors.border }]} />
          <View style={[styles.webGridLine, { left: '66%', width: 1, height: '100%', backgroundColor: theme.colors.border }]} />
          
          {/* Animated/Beautiful SVG Route Connector representing a real map route */}
          <View style={styles.webRouteSvgContainer}>
            {/* Start Marker */}
            <View style={[styles.webDot, { left: '20%', top: '70%', backgroundColor: theme.colors.secondary }]}>
              <View style={[styles.webPulse, { backgroundColor: theme.colors.secondary }]} />
            </View>
            
            {/* End Marker */}
            <View style={[styles.webDot, { right: '20%', top: '30%', backgroundColor: theme.colors.error }]}>
              <View style={[styles.webPulse, { backgroundColor: theme.colors.error }]} />
            </View>

            {/* Simulated route road */}
            <View style={[styles.webMockRoad, { borderColor: theme.colors.primary }]} />
            
            {/* Simulated Web Driver pulse dot */}
            {driverLocation && (
              <View style={[styles.webDot, { left: '48%', top: '48%', backgroundColor: theme.colors.primary }]}>
                <View style={[styles.webPulse, { backgroundColor: theme.colors.primary }]} />
                <Car size={9} color="#FFFFFF" />
              </View>
            )}
          </View>
        </View>

        {/* Overlay premium controls for web */}
        <View style={styles.premiumOverlay}>
          <View style={[styles.summaryBadge, { backgroundColor: theme.colors.card, shadowColor: theme.colors.shadow }]}>
            <Text style={[styles.summaryBadgeText, { color: theme.colors.text }]}>
              {distance} • {duration}
            </Text>
          </View>

          {driverLocation && (
            <View style={[styles.liveIndicatorBadge, { backgroundColor: theme.colors.success, shadowColor: theme.colors.shadow }]}>
              <View style={styles.pulseDotMini} />
              <Text style={styles.liveIndicatorText}>LIVE TRACKING</Text>
            </View>
          )}
          
          <TouchableOpacity 
            style={[styles.webDirectionsButton, { backgroundColor: theme.colors.primary }]}
            onPress={openDirections}
          >
            <Navigation size={14} color="#FFF" />
            <Text style={styles.webDirectionsText}>Get Directions</Text>
          </TouchableOpacity>
        </View>

        {/* Informative text footer inside the map */}
        <View style={[styles.webFooter, { backgroundColor: theme.colors.card + 'D0' }]}>
          <Text style={[styles.webFooterTitle, { color: theme.colors.text }]}>Route Preview</Text>
          <Text style={[styles.webFooterSubtitle, { color: theme.colors.textSecondary }]} numberOfLines={1}>
            {from.address.split(',')[0]} → {to.address.split(',')[0]}
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { borderColor: theme.colors.border }, containerStyle]}>
      {isLoading ? (
        <View style={[styles.loadingOverlay, { backgroundColor: theme.colors.surface }]}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
          <Text style={[styles.loadingText, { color: theme.colors.textSecondary }]}>Loading route layout...</Text>
        </View>
      ) : error ? (
        <View style={[styles.errorContainer, { backgroundColor: theme.colors.surface }]}>
          <AlertCircle size={32} color={theme.colors.error} />
          <Text style={[styles.errorText, { color: theme.colors.text }]}>{error}</Text>
          <TouchableOpacity style={[styles.retryButton, { backgroundColor: theme.colors.primary }]} onPress={fetchRouteData}>
            <Text style={styles.retryText}>Retry</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <>
          <MapView
            ref={mapRef}
            style={styles.map}
            provider={PROVIDER_GOOGLE}
            initialRegion={{
              latitude: (from.coordinates.latitude + to.coordinates.latitude) / 2,
              longitude: (from.coordinates.longitude + to.coordinates.longitude) / 2,
              latitudeDelta: Math.abs(from.coordinates.latitude - to.coordinates.latitude) * 1.5 || 0.05,
              longitudeDelta: Math.abs(from.coordinates.longitude - to.coordinates.longitude) * 1.5 || 0.05,
            }}
            customMapStyle={isDark ? darkMapStyle : []}
            showsCompass={true}
            showsScale={true}
          >
            {/* Pickup Marker */}
            <Marker
              coordinate={from.coordinates}
              title="Pickup Location"
              description={from.address}
              onPress={() => setActiveMarker(activeMarker === 'from' ? null : 'from')}
            >
              <View style={[styles.customPin, { backgroundColor: theme.colors.secondary, borderColor: '#FFFFFF' }]}>
                <MapPin size={16} color="#FFFFFF" />
              </View>
            </Marker>

            {/* Destination Marker */}
            <Marker
              coordinate={to.coordinates}
              title="Destination"
              description={to.address}
              onPress={() => setActiveMarker(activeMarker === 'to' ? null : 'to')}
            >
              <View style={[styles.customPin, { backgroundColor: theme.colors.error, borderColor: '#FFFFFF' }]}>
                <MapPin size={16} color="#FFFFFF" />
              </View>
            </Marker>

            {/* Route Polyline */}
            {routeCoords.length > 0 && (
              <Polyline
                coordinates={routeCoords}
                strokeColor={theme.colors.primary}
                strokeWidth={5}
                lineJoin="round"
              />
            )}

            {/* Live Driver Tracking Marker */}
            {driverLocation && (
              <Marker
                coordinate={driverLocation}
                title="Driver Position"
                description="Live tracking active"
              >
                <View style={[styles.customPin, { backgroundColor: theme.colors.primary, borderColor: '#FFFFFF' }]}>
                  <Car size={16} color="#FFFFFF" />
                </View>
              </Marker>
            )}
          </MapView>

          {/* Premium Overlays */}
          <View style={styles.mapControls}>
            {/* Top Info Badge */}
            <View style={[styles.summaryBadge, { backgroundColor: theme.colors.card, shadowColor: theme.colors.shadow }]}>
              <Text style={[styles.summaryBadgeText, { color: theme.colors.text }]}>
                {distance} • {duration}
              </Text>
            </View>

            {/* Live indicator badge */}
            {driverLocation && (
              <View style={[styles.liveIndicatorBadge, { backgroundColor: theme.colors.success, shadowColor: theme.colors.shadow }]}>
                <View style={styles.pulseDotMini} />
                <Text style={styles.liveIndicatorText}>LIVE TRACKING</Text>
              </View>
            )}

            {/* Right Buttons */}
            <View style={styles.rightButtonsContainer}>
              <TouchableOpacity
                style={[styles.mapIconButton, { backgroundColor: theme.colors.card, shadowColor: theme.colors.shadow }]}
                onPress={fitToRoute}
              >
                <Compass size={20} color={theme.colors.primary} />
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.mapIconButton, { backgroundColor: theme.colors.card, shadowColor: theme.colors.shadow }]}
                onPress={openDirections}
              >
                <ExternalLink size={20} color={theme.colors.primary} />
              </TouchableOpacity>
            </View>
          </View>

          {/* Active Marker Detail Card */}
          {activeMarker && (
            <View style={[styles.markerCard, { backgroundColor: theme.colors.card, shadowColor: theme.colors.shadow }]}>
              <View style={styles.markerCardHeader}>
                <View style={[styles.dotIndicator, { backgroundColor: activeMarker === 'from' ? theme.colors.secondary : theme.colors.error }]} />
                <Text style={[styles.markerCardTitle, { color: theme.colors.text }]}>
                  {activeMarker === 'from' ? 'Pickup Location' : 'Destination'}
                </Text>
              </View>
              <Text style={[styles.markerCardAddress, { color: theme.colors.textSecondary }]}>
                {activeMarker === 'from' ? from.address : to.address}
              </Text>
            </View>
          )}
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    height: 240,
    width: '100%',
    borderRadius: 20,
    overflow: 'hidden',
    borderWidth: 1,
    position: 'relative',
  },
  map: {
    ...StyleSheet.absoluteFillObject,
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },
  loadingText: {
    fontSize: 14,
    fontWeight: '500',
  },
  errorContainer: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    gap: 12,
  },
  errorText: {
    fontSize: 14,
    fontWeight: '500',
    textAlign: 'center',
  },
  retryButton: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
  },
  retryText: {
    color: '#FFFFFF',
    fontWeight: '600',
    fontSize: 14,
  },
  customPin: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 2,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 3,
    elevation: 4,
  },
  mapControls: {
    position: 'absolute',
    left: 12,
    right: 12,
    top: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    pointerEvents: 'box-none',
  },
  summaryBadge: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 20,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 3,
    height: 36,
    justifyContent: 'center',
  },
  summaryBadgeText: {
    fontSize: 13,
    fontWeight: '700',
  },
  rightButtonsContainer: {
    gap: 8,
  },
  mapIconButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 3,
  },
  markerCard: {
    position: 'absolute',
    bottom: 12,
    left: 12,
    right: 12,
    padding: 12,
    borderRadius: 12,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 3,
  },
  markerCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  dotIndicator: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  markerCardTitle: {
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  markerCardAddress: {
    fontSize: 13,
    lineHeight: 18,
  },
  
  // Web Fallback styles
  webContainer: {
    height: 240,
    width: '100%',
    borderRadius: 20,
    overflow: 'hidden',
    borderWidth: 1,
    position: 'relative',
  },
  webMapArt: {
    ...StyleSheet.absoluteFillObject,
    overflow: 'hidden',
  },
  webGridLine: {
    position: 'absolute',
    width: '100%',
    height: 1,
    opacity: 0.5,
  },
  webRouteSvgContainer: {
    ...StyleSheet.absoluteFillObject,
    position: 'relative',
  },
  webDot: {
    position: 'absolute',
    width: 14,
    height: 14,
    borderRadius: 7,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 2,
  },
  webPulse: {
    position: 'absolute',
    width: 24,
    height: 24,
    borderRadius: 12,
    opacity: 0.3,
  },
  webMockRoad: {
    position: 'absolute',
    left: '20%',
    top: '30%',
    width: '60%',
    height: '40%',
    borderWidth: 3,
    borderStyle: 'dashed',
    borderRadius: 50,
    transform: [{ rotate: '-15deg' }],
    zIndex: 1,
    opacity: 0.8,
  },
  premiumOverlay: {
    position: 'absolute',
    left: 12,
    right: 12,
    top: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  webDirectionsButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 20,
  },
  webDirectionsText: {
    color: '#FFF',
    fontSize: 12,
    fontWeight: '600',
  },
  webFooter: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,0,0,0.05)',
  },
  webFooterTitle: {
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 2,
  },
  webFooterSubtitle: {
    fontSize: 12,
  },
  liveIndicatorBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 20,
    gap: 6,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 3,
    height: 36,
  },
  pulseDotMini: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#FFFFFF',
    opacity: 0.8,
  },
  liveIndicatorText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
});
