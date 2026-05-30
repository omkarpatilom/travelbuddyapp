import React, { useState, useEffect } from 'react';
import { 
  View, 
  TextInput, 
  FlatList, 
  Text, 
  TouchableOpacity, 
  StyleSheet, 
  ActivityIndicator,
  SafeAreaView,
  StatusBar
} from 'react-native';
import { useRouter } from 'expo-router';
import { useTheme } from '@/contexts/ThemeContext';
import { SearchCacheService, CachedSearch } from '../../services/SearchCacheService';
import { api } from '../../utils/api';
import { 
  Search, 
  MapPin, 
  History, 
  ArrowLeft, 
  ChevronRight,
  Clock,
  WifiOff
} from 'lucide-react-native';

export default function SearchScreen() {
  const { theme, isDark } = useTheme();
  const router = useRouter();
  
  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [isOffline, setIsOffline] = useState(false);
  
  const [pickupPlace, setPickupPlace] = useState<any | null>(null);
  const [dropoffPlace, setDropoffPlace] = useState<any | null>(null);
  const [focusedInput, setFocusedInput] = useState<'pickup' | 'dropoff'>('pickup');
  
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [history, setHistory] = useState<CachedSearch[]>([]);

  useEffect(() => {
    loadHistory();
  }, []);

  useEffect(() => {
    const delayDebounceFn = setTimeout(() => {
      if (query.length > 2 && !isOffline) {
        fetchSuggestions(query);
      } else {
        setSuggestions([]);
      }
    }, 300);

    return () => clearTimeout(delayDebounceFn);
  }, [query, isOffline]);

  const loadHistory = async () => {
    const cached = await SearchCacheService.getHistory();
    setHistory(cached);
  };

  const fetchSuggestions = async (text: string) => {
    setLoading(true);
    setIsOffline(false);
    try {
      const data = await api.get<any[]>(`/places/autocomplete?q=${encodeURIComponent(text)}`);
      setSuggestions(data);
    } catch (error) {
      console.error('Failed to fetch suggestions', error);
      setIsOffline(true);
    } finally {
      setLoading(false);
    }
  };

  const handleSelect = async (place: any) => {
    const selectedName = place.name || place.address || place.label;
    
    // Combine name and description for a complete detailed location string
    let finalAddress = '';
    if (place.name) {
      if (place.description && place.description.startsWith(place.name)) {
        finalAddress = place.description;
      } else {
        finalAddress = `${place.name}${place.description ? ', ' + place.description : ''}`;
      }
    } else {
      finalAddress = place.description || place.address || place.name || selectedName;
    }
    finalAddress = finalAddress.replace(/,\s*$/, '').trim();

    setQuery('');
    setSuggestions([]);

    // Check if suggestion already contains coordinates (bypasses geocoding API)
    if (place.lat !== undefined && place.lon !== undefined) {
      const locationData = {
        name: place.name || selectedName,
        address: finalAddress,
        lat: place.lat,
        lon: place.lon,
      };
      if (focusedInput === 'pickup') {
          setPickupPlace(locationData);
      } else {
          setDropoffPlace(locationData);
      }
      return;
    }

    setLoading(true);
    try {
      const data = await api.get<any>(`/places/geocode?q=${encodeURIComponent(selectedName)}`);
      if (focusedInput === 'pickup') {
          setPickupPlace(data);
      } else {
          setDropoffPlace(data);
      }
    } catch (error) {
      console.error('Failed to geocode', error);
      setIsOffline(true);
    } finally {
      setLoading(false);
    }
  };

  const handleSearchRides = async () => {
    if (!pickupPlace || !dropoffPlace) return;
    
    setLoading(true);
    setIsOffline(false);
    try {
      const data = await api.get<any[]>(
        `/rides/search?srcLat=${pickupPlace.lat}&srcLon=${pickupPlace.lon}&dstLat=${dropoffPlace.lat}&dstLon=${dropoffPlace.lon}`
      );
      
      // Navigate to FindRide with these results or just show them here
      // To keep it seamless, let's navigate to /ride/find with the correct params
      router.push({
        pathname: '/ride/find',
        params: {
          from: pickupPlace.name || pickupPlace.address,
          to: dropoffPlace.name || dropoffPlace.address,
          fromLat: pickupPlace.lat.toString(),
          fromLon: pickupPlace.lon.toString(),
          toLat: dropoffPlace.lat.toString(),
          toLon: dropoffPlace.lon.toString(),
          date: new Date().toISOString()
        }
      });
      
      const searchQuery = `${pickupPlace.name || pickupPlace.address} to ${dropoffPlace.name || dropoffPlace.address}`;
      await SearchCacheService.saveSearch(searchQuery, data);
    } catch (error) {
      console.error('Failed to search rides', error);
      setIsOffline(true);
    } finally {
      setLoading(false);
    }
  };

  const loadFromHistory = (item: CachedSearch) => {
      // Split query back to from/to if possible
      const parts = item.query.split(' to ');
      if (parts.length === 2) {
          router.push({
              pathname: '/ride/find',
              params: { from: parts[0], to: parts[1], date: new Date().toISOString() }
          });
      }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />
      
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <ArrowLeft size={24} color={theme.colors.text} />
        </TouchableOpacity>
        <Text style={[styles.title, { color: theme.colors.text }]}>Search History</Text>
      </View>

      {isOffline && (
          <View style={[styles.offlineBanner, { backgroundColor: theme.colors.error + '20' }]}>
              <WifiOff size={16} color={theme.colors.error} />
              <Text style={[styles.offlineText, { color: theme.colors.error }]}>Offline Mode - Showing Cached Results</Text>
          </View>
      )}
      
      <View style={styles.content}>
        <View style={[styles.searchBox, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
          <View style={styles.inputRow}>
            <MapPin size={20} color={theme.colors.primary} />
            <TextInput
                style={[styles.input, { color: theme.colors.text }]}
                placeholder={pickupPlace ? (pickupPlace.name || pickupPlace.address) : "Pickup location"}
                placeholderTextColor={theme.colors.textSecondary}
                value={focusedInput === 'pickup' ? query : ''}
                onChangeText={(text) => { setFocusedInput('pickup'); setQuery(text); }}
                onFocus={() => { setFocusedInput('pickup'); setQuery(''); }}
            />
          </View>
          <View style={[styles.divider, { backgroundColor: theme.colors.border }]} />
          <View style={{ height: 10 }} />
          <View style={styles.inputRow}>
            <MapPin size={20} color={theme.colors.secondary} />
            <TextInput
                style={[styles.input, { color: theme.colors.text }]}
                placeholder={dropoffPlace ? (dropoffPlace.name || dropoffPlace.address) : "Drop-off location"}
                placeholderTextColor={theme.colors.textSecondary}
                value={focusedInput === 'dropoff' ? query : ''}
                onChangeText={(text) => { setFocusedInput('dropoff'); setQuery(text); }}
                onFocus={() => { setFocusedInput('dropoff'); setQuery(''); }}
            />
          </View>
          
          <TouchableOpacity 
            style={[styles.searchButton, { backgroundColor: theme.colors.primary }]} 
            onPress={handleSearchRides}
          >
            <Text style={styles.searchButtonText}>Find Rides</Text>
          </TouchableOpacity>
        </View>

        {loading && <ActivityIndicator style={styles.loader} color={theme.colors.primary} />}

        <View style={styles.listContainer}>
          {suggestions.length > 0 && !isOffline && (
            <View style={[styles.suggestionsOverlay, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
              <FlatList
                  data={suggestions}
                  keyExtractor={(item, index) => `${item.name || item.address}-${index}`}
                  renderItem={({ item }) => {
                    const addressText = item.description || item.address || item.country || '';
                    return (
                      <TouchableOpacity style={[styles.item, { borderBottomColor: theme.colors.border }]} onPress={() => handleSelect(item)}>
                          <View style={[styles.iconBox, { backgroundColor: theme.colors.surface }]}>
                            <MapPin size={18} color={theme.colors.primary} />
                          </View>
                          <View style={{ flex: 1 }}>
                            <Text style={[styles.itemText, { color: theme.colors.text }]} numberOfLines={1}>{item.name || item.address}</Text>
                            {addressText ? (
                              <Text style={[styles.itemSubtext, { color: theme.colors.textSecondary }]} numberOfLines={2}>
                                {addressText}
                              </Text>
                            ) : null}
                          </View>
                      </TouchableOpacity>
                    );
                  }}
                  keyboardShouldPersistTaps="handled"
              />
            </View>
          )}

          <View style={styles.historyContainer}>
              <View style={styles.sectionHeader}>
                <History size={18} color={theme.colors.textSecondary} />
                <Text style={[styles.historyTitle, { color: theme.colors.text }]}>Recent Searches</Text>
              </View>
              
              <FlatList
                  data={history}
                  keyExtractor={(item) => item.id}
                  renderItem={({ item }) => (
                      <TouchableOpacity 
                        style={[styles.historyItem, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]} 
                        onPress={() => loadFromHistory(item)}
                      >
                          <View style={styles.historyIcon}>
                            <Clock size={16} color={theme.colors.primary} />
                          </View>
                          <View style={{ flex: 1 }}>
                            <Text style={[styles.historyItemText, { color: theme.colors.text }]} numberOfLines={1}>{item.query}</Text>
                            <Text style={[styles.historyItemTime, { color: theme.colors.textSecondary }]}>
                              {new Date(item.timestamp).toLocaleDateString()}
                            </Text>
                          </View>
                          <ChevronRight size={18} color={theme.colors.border} />
                      </TouchableOpacity>
                  )}
                  ListEmptyComponent={
                    <View style={styles.emptyHistory}>
                      <Text style={{ color: theme.colors.textSecondary }}>No recent searches</Text>
                    </View>
                  }
              />
          </View>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 20,
    gap: 15,
  },
  backBtn: {
    padding: 5,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
  },
  offlineBanner: { 
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 10, 
    borderRadius: 12, 
    marginHorizontal: 20,
    marginBottom: 15,
    gap: 8
  },
  offlineText: { fontWeight: '600', fontSize: 13 },
  searchBox: {
    padding: 20,
    borderRadius: 20,
    borderWidth: 1,
    marginBottom: 20,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 5,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    height: 40,
  },
  input: { 
    flex: 1, 
    fontSize: 16,
    fontWeight: '500',
  },
  divider: {
    height: 1,
    marginVertical: 12,
    marginLeft: 32,
  },
  searchButton: { 
    padding: 15, 
    borderRadius: 12, 
    alignItems: 'center', 
    marginTop: 20 
  },
  searchButtonText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
  loader: { marginVertical: 10 },
  listContainer: { flex: 1, position: 'relative' },
  suggestionsOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 100,
    elevation: 5,
    maxHeight: 300,
    borderRadius: 15,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    overflow: 'hidden',
  },
  item: { 
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16, 
    borderBottomWidth: 0.5, 
    gap: 16,
  },
  iconBox: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  itemText: { fontSize: 16, fontWeight: '600', marginBottom: 2 },
  itemSubtext: { fontSize: 14, lineHeight: 20 },
  historyContainer: { flex: 1, marginTop: 10 },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 15,
  },
  historyTitle: { fontSize: 16, fontWeight: 'bold' },
  historyItem: { 
    flexDirection: 'row',
    alignItems: 'center',
    padding: 15, 
    borderRadius: 15, 
    marginBottom: 10, 
    borderWidth: 1,
    gap: 15,
  },
  historyIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(0,122,255,0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  historyItemText: { fontSize: 14, fontWeight: '600' },
  historyItemTime: { fontSize: 11, marginTop: 2 },
  emptyHistory: {
    alignItems: 'center',
    marginTop: 40,
  }
});
