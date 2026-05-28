import React, { useState, useEffect } from 'react';
import { View, TextInput, FlatList, Text, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { SearchCacheService, CachedSearch } from '../../services/SearchCacheService';

export default function SearchScreen() {
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
      const response = await fetch(`http://localhost:5000/api/places/autocomplete?q=${encodeURIComponent(text)}`);
      if (response.ok) {
        const data = await response.json();
        setSuggestions(data);
      }
    } catch (error) {
      console.error('Failed to fetch suggestions', error);
      setIsOffline(true);
    } finally {
      setLoading(false);
    }
  };

  const handleSelect = async (place: any) => {
    setQuery('');
    setSuggestions([]);
    setLoading(true);
    try {
      const response = await fetch(`http://localhost:5000/api/places/geocode?q=${encodeURIComponent(place.name)}`);
      if (response.ok) {
        const data = await response.json();
        if (focusedInput === 'pickup') {
            setPickupPlace(data);
        } else {
            setDropoffPlace(data);
        }
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
      const response = await fetch(
        `http://localhost:5000/api/rides/search?srcLat=${pickupPlace.lat}&srcLon=${pickupPlace.lon}&dstLat=${dropoffPlace.lat}&dstLon=${dropoffPlace.lon}`
      );
      if (response.ok) {
        const data = await response.json();
        setSearchResults(data);
        const searchQuery = `${pickupPlace.name} to ${dropoffPlace.name}`;
        await SearchCacheService.saveSearch(searchQuery, data);
        await loadHistory();
      }
    } catch (error) {
      console.error('Failed to search rides, falling back to offline', error);
      setIsOffline(true);
      // Fallback: try to find a matching query in history
      const searchQuery = `${pickupPlace.name} to ${dropoffPlace.name}`;
      const cached = history.find(h => h.query === searchQuery);
      if (cached) {
          setSearchResults(cached.results);
      }
    } finally {
      setLoading(false);
    }
  };

  const loadFromHistory = (item: CachedSearch) => {
      setSearchResults(item.results);
      setIsOffline(true); // Indicate we are viewing offline results
  };

  return (
    <SafeAreaView style={styles.container}>
      {isOffline && (
          <View style={styles.offlineBanner}>
              <Text style={styles.offlineText}>You are offline. Showing cached results.</Text>
          </View>
      )}
      
      <View style={styles.formContainer}>
        <TextInput
            style={[styles.input, focusedInput === 'pickup' && styles.activeInput]}
            placeholder={pickupPlace ? pickupPlace.name : "Pickup location"}
            value={focusedInput === 'pickup' ? query : ''}
            onChangeText={(text) => { setFocusedInput('pickup'); setQuery(text); }}
            onFocus={() => { setFocusedInput('pickup'); setQuery(''); }}
        />
        <TextInput
            style={[styles.input, focusedInput === 'dropoff' && styles.activeInput]}
            placeholder={dropoffPlace ? dropoffPlace.name : "Drop-off location"}
            value={focusedInput === 'dropoff' ? query : ''}
            onChangeText={(text) => { setFocusedInput('dropoff'); setQuery(text); }}
            onFocus={() => { setFocusedInput('dropoff'); setQuery(''); }}
        />
        <TouchableOpacity style={styles.searchButton} onPress={handleSearchRides}>
            <Text style={styles.searchButtonText}>Find Rides</Text>
        </TouchableOpacity>
      </View>
      
      {loading && <ActivityIndicator style={styles.loader} />}

      {suggestions.length > 0 && !isOffline && (
        <FlatList
            data={suggestions}
            keyExtractor={(item, index) => `${item.name}-${index}`}
            renderItem={({ item }) => (
            <TouchableOpacity style={styles.item} onPress={() => handleSelect(item)}>
                <Text style={styles.itemText}>{item.name}, {item.country}</Text>
            </TouchableOpacity>
            )}
        />
      )}

      {searchResults.length > 0 && (
        <FlatList
            data={searchResults}
            keyExtractor={(item) => item.rideId}
            renderItem={({ item }) => (
            <View style={styles.resultContainer}>
                <Text style={styles.resultTitle}>Driver ID: {item.driverId}</Text>
                <Text style={styles.resultText}>Departure: {new Date(item.departureTime).toLocaleString()}</Text>
                <Text style={styles.resultText}>Price: ${item.price}</Text>
                <Text style={styles.resultText}>Seats: {item.availableSeats}</Text>
                <Text style={styles.resultText}>Walk to pickup: {item.pickupDistanceMeters?.toFixed(0)}m</Text>
                <Text style={styles.resultText}>Walk from drop-off: {item.dropoffDistanceMeters?.toFixed(0)}m</Text>
            </View>
            )}
        />
      )}

      {isOffline && searchResults.length === 0 && history.length > 0 && (
          <View style={styles.historyContainer}>
              <Text style={styles.historyTitle}>Recent Searches</Text>
              <FlatList
                  data={history}
                  keyExtractor={(item) => item.id}
                  renderItem={({ item }) => (
                      <TouchableOpacity style={styles.historyItem} onPress={() => loadFromHistory(item)}>
                          <Text style={styles.historyItemText}>{item.query}</Text>
                          <Text style={styles.historyItemTime}>{new Date(item.timestamp).toLocaleString()}</Text>
                      </TouchableOpacity>
                  )}
              />
          </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, backgroundColor: '#fff' },
  offlineBanner: { backgroundColor: '#ffcccc', padding: 10, borderRadius: 8, marginBottom: 10, alignItems: 'center' },
  offlineText: { color: '#cc0000', fontWeight: 'bold' },
  formContainer: { marginBottom: 16 },
  input: { height: 50, borderColor: '#ccc', borderWidth: 1, borderRadius: 8, paddingHorizontal: 16, marginBottom: 8 },
  activeInput: { borderColor: '#007AFF', borderWidth: 2 },
  searchButton: { backgroundColor: '#007AFF', padding: 16, borderRadius: 8, alignItems: 'center', marginTop: 8 },
  searchButtonText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
  loader: { marginVertical: 10 },
  item: { padding: 16, borderBottomWidth: 1, borderBottomColor: '#eee' },
  itemText: { fontSize: 16 },
  resultContainer: { padding: 16, backgroundColor: '#f9f9f9', borderRadius: 8, marginBottom: 10, borderWidth: 1, borderColor: '#ddd' },
  resultTitle: { fontSize: 16, fontWeight: 'bold', marginBottom: 4 },
  resultText: { fontSize: 14, marginBottom: 2 },
  historyContainer: { flex: 1, marginTop: 20 },
  historyTitle: { fontSize: 18, fontWeight: 'bold', marginBottom: 10 },
  historyItem: { padding: 16, backgroundColor: '#f0f0f0', borderRadius: 8, marginBottom: 8 },
  historyItemText: { fontSize: 16, fontWeight: 'bold' },
  historyItemTime: { fontSize: 12, color: '#666', marginTop: 4 }
});
