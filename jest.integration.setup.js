import 'react-native-gesture-handler/jestSetup';

// Mock Expo modules
jest.mock('expo-font');
jest.mock('expo-asset');
jest.mock('expo-constants', () => ({
  expoConfig: {
    extra: {
      eas: {
        projectId: 'test-project-id',
      },
    },
  },
}));
jest.mock('expo-notifications', () => ({
  requestPermissionsAsync: jest.fn(() => Promise.resolve({ status: 'granted' })),
  getExpoPushTokenAsync: jest.fn(() => Promise.resolve({ data: 'test-token' })),
  setNotificationHandler: jest.fn(),
  addNotificationReceivedListener: jest.fn(),
  addNotificationResponseReceivedListener: jest.fn(),
  removeNotificationSubscription: jest.fn(),
}));

// Mock Async Storage
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
);

// Mock NetInfo
jest.mock('@react-native-community/netinfo', () => ({
  fetch: jest.fn(() => Promise.resolve({ isConnected: true, isInternetReachable: true })),
  addEventListener: jest.fn(),
  useNetInfo: jest.fn(() => ({ isConnected: true, isInternetReachable: true })),
}));

// Mock react-native-reanimated
jest.mock('react-native-reanimated', () => {
  const Reanimated = require('react-native-reanimated/mock');
  Reanimated.default.call = () => {};
  return Reanimated;
});

// Mock lucide-react-native
jest.mock('lucide-react-native', () => {
  const React = require('react');
  const { View } = require('react-native');
  const mockIcon = (name) => (props) => React.createElement(View, { ...props, testID: name });
  
  return {
    User: mockIcon('User'),
    Settings: mockIcon('Settings'),
    Star: mockIcon('Star'),
    Car: mockIcon('Car'),
    Calendar: mockIcon('Calendar'),
    Phone: mockIcon('Phone'),
    Mail: mockIcon('Mail'),
    LogOut: mockIcon('LogOut'),
    CreditCard: mockIcon('CreditCard'),
    Shield: mockIcon('Shield'),
    CircleHelp: mockIcon('CircleHelp'),
    Bell: mockIcon('Bell'),
    ChevronRight: mockIcon('ChevronRight'),
    MapPin: mockIcon('MapPin'),
    TrendingUp: mockIcon('TrendingUp'),
    CheckCircle: mockIcon('CheckCircle'),
    Plus: mockIcon('Plus'),
    X: mockIcon('X'),
    Home: mockIcon('Home'),
    Briefcase: mockIcon('Briefcase'),
    Heart: mockIcon('Heart'),
    Save: mockIcon('Save'),
    ArrowLeft: mockIcon('ArrowLeft'),
    Camera: mockIcon('Camera'),
    FileText: mockIcon('FileText'),
    MessageCircle: mockIcon('MessageCircle'),
    Cigarette: mockIcon('Cigarette'),
    Globe: mockIcon('Globe'),
    Lock: mockIcon('Lock'),
    Smartphone: mockIcon('Smartphone'),
    Monitor: mockIcon('Monitor'),
    Key: mockIcon('Key'),
    FileCheck: mockIcon('FileCheck'),
    Clock: mockIcon('Clock'),
    AlertTriangle: mockIcon('AlertTriangle'),
    Hash: mockIcon('Hash'),
    Palette: mockIcon('Palette'),
    Users: mockIcon('Users'),
  };
});

// Mock expo-location
jest.mock('expo-location', () => ({
  requestForegroundPermissionsAsync: jest.fn(() => Promise.resolve({ status: 'granted' })),
  getCurrentPositionAsync: jest.fn(() => Promise.resolve({
    coords: { latitude: 0, longitude: 0 },
  })),
}));

// Mock expo-image-picker
jest.mock('expo-image-picker', () => ({
  requestMediaLibraryPermissionsAsync: jest.fn(() => Promise.resolve({ granted: true })),
  launchImageLibraryAsync: jest.fn(() => Promise.resolve({ canceled: true })),
  MediaTypeOptions: { Images: 'Images' },
}));

// Mock global components to avoid "undefined" errors if they have issues
jest.mock('@/components/PhotoUploader', () => {
  const { View } = require('react-native');
  return (props) => require('react').createElement(View, { ...props, testID: 'PhotoUploader' });
});
jest.mock('@/components/VehicleFeatureTags', () => {
  const { View } = require('react-native');
  return (props) => require('react').createElement(View, { ...props, testID: 'VehicleFeatureTags' });
});
jest.mock('@/components/RidePreferences', () => {
  const { View } = require('react-native');
  return (props) => require('react').createElement(View, { ...props, testID: 'RidePreferences' });
});

// NOTE: We do NOT mock global.fetch here!
// This enables real integration tests hitting the ngrok domain.
// Increase Jest timeout to 90 seconds for live network fetches
jest.setTimeout(90000);
