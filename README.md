# TravelBuddy - Ride Sharing App

A comprehensive ride-sharing application built with React Native and Expo, featuring advanced safety, location services, and user experience enhancements.

## 🚀 Features

### Core Functionality
- **User Authentication**: Secure login/registration with demo credentials
- **Ride Management**: Create, search, and book rides
- **Real-time Location Services**: GPS integration with fallback support
- **Profile Management**: Complete user profile with vehicle details
- **Booking System**: Comprehensive booking and cancellation system

### 🔍 Enhanced Location Services
- **Google Places Autocomplete**: Intelligent location suggestions
- **Fallback Location Search**: Custom logic for areas with limited API coverage
- **Recent Locations**: Quick access to frequently used locations
- **Favorite Destinations**: Save and manage favorite locations
- **Current Location**: One-tap GPS location detection

### 🚗 Vehicle Management
- **Feature Tags System**: Comprehensive vehicle feature tagging (AC, Music, WiFi, etc.)
- **Photo Upload**: Multiple vehicle photos with OCR support
- **Universal Ride Preferences**: Settings that apply to all vehicles
- **Per-Vehicle Overrides**: Customize preferences for individual vehicles

### 🛡️ Safety & Security Features
- **One-tap SOS Button**: Emergency alert system with 5-second countdown
- **Emergency Contacts**: Manage multiple emergency contacts
- **Background Trip Tracking**: Encrypted location tracking during rides
- **Identity Verification**: Document scanning for Aadhar, License, and Passport
- **Auto-deletion**: Automatic data cleanup after trip completion

### 🎨 UI/UX Enhancements
- **Dark/Light Theme**: Automatic theme switching
- **Responsive Design**: Mobile-first responsive layout
- **Accessibility**: WCAG 2.1 compliant components
- **Error Handling**: Comprehensive error states and offline support
- **Loading States**: Smooth loading indicators and skeleton screens

## 📱 Technical Specifications

### Architecture
- **Framework**: React Native with Expo SDK 52
- **Navigation**: Expo Router with typed routes
- **State Management**: React Context API
- **Storage**: AsyncStorage with encryption
- **Permissions**: Comprehensive permission handling

### API Integrations
- **Google Places API**: Location autocomplete and geocoding
- **SMS API**: Emergency alert messaging
- **Push Notifications**: Real-time notifications
- **Location Services**: GPS and reverse geocoding
- **Camera/Gallery**: Document scanning and photo upload

### Security Features
- **Data Encryption**: End-to-end encryption for sensitive data
- **Automatic Cleanup**: Location data auto-deletion
- **Permission Management**: Granular permission controls
- **Secure Storage**: Encrypted local storage

## 🛠️ Installation & Setup

### Prerequisites
- Node.js 18+
- Expo CLI
- iPhone with **Expo Go** app installed
- Both computer and iPhone connected to the same network

### Required Dependencies
The following critical dependencies have been configured for **Expo SDK 54** and **Reanimated v4**:
- `react-native-reanimated`: Core animation library.
- `react-native-worklets`: Required companion for Reanimated v4 Babel plugin.
- `expo-dev-client`: Required for testing native modules.
- `babel-preset-expo`: Configured for proper bundling.

### Running on iPhone (Windows)
To ensure your iPhone can connect to your computer, you must force the local IP address and clear the bundler cache. Use the `--offline` flag to bypass the Expo login prompt.

1. **Find your IP address**: Run `ipconfig` in your terminal.
2. **Run the project**:

**In PowerShell (Recommended for Windows):**
```powershell
$env:REACT_NATIVE_PACKAGER_HOSTNAME='192.168.1.9'; npx expo start -c --go --offline
```

**In Command Prompt (CMD):**
```cmd
set REACT_NATIVE_PACKAGER_HOSTNAME=10.106.57.252 && npx expo start -c --go --offline
```

*Note: Replace `10.106.57.252` with your current IPv4 address if it changes.*

### Troubleshooting
- **Babel Errors**: If you see "Cannot find module 'react-native-worklets/plugin'", ensure `react-native-worklets` is installed and run with the `-c` flag to clear the cache.
- **Connection Issues**: 
  - Ensure Windows Firewall allows Node.js through both Private and Public networks.
  - Double check both devices are on the same Wi-Fi.
- **Android SDK Error**: You can safely ignore "Failed to resolve Android SDK" errors when testing on a physical iPhone.

### API Configuration
1. **Google Places API**:
   - Enable Places API in Google Cloud Console
   - Add API key to environment variables
   - Configure billing for production use

2. **SMS Services**:
   - Configure SMS provider (Twilio recommended)
   - Set up emergency contact messaging

3. **Push Notifications**:
   - Configure Expo push notifications
   - Set up notification channels

## 📋 Feature Implementation Details

### 1. Auto-Suggestion Enhancement
- **Google Places Integration**: Real-time location suggestions
- **Fallback Logic**: Custom search for limited coverage areas
- **Caching**: Recent and favorite locations caching
- **Error Handling**: Graceful degradation when API fails
- **Performance**: Debounced search with 300ms delay

### 2. Vehicle Features System
- **Tag Categories**: Comfort, Entertainment, Safety, Convenience
- **Custom Features**: User-defined feature tags
- **Search & Filter**: Feature-based ride filtering
- **Visual Indicators**: Color-coded category system
- **Popular Tags**: Highlighted commonly used features

### 3. Universal Ride Preferences
- **Global Settings**: Apply to all user vehicles
- **Per-Vehicle Override**: Customize individual vehicles
- **Conversation Levels**: Quiet, Moderate, Chatty options
- **Passenger Limits**: Configurable booking limits
- **Safety Preferences**: Verification requirements

### 4. Safety Features Implementation
- **SOS System**: 
  - 5-second countdown with cancel option
  - GPS location sharing via SMS
  - Push notification alerts
  - Emergency contact management

- **Trip Tracking**:
  - Background location monitoring
  - Encrypted data transmission
  - Automatic data deletion
  - Privacy controls

- **Identity Verification**:
  - OCR document scanning
  - Manual review workflow
  - Multi-document support
  - Status tracking system

## 🔒 Privacy & Security

### Data Protection
- **Encryption**: AES-256 encryption for sensitive data
- **Data Minimization**: Collect only necessary information
- **Automatic Cleanup**: Location data deleted after trips
- **User Control**: Granular privacy settings

### Compliance
- **GDPR Ready**: Data portability and deletion rights
- **CCPA Compliant**: California privacy law compliance
- **WCAG 2.1**: Accessibility guidelines adherence
- **Security Audits**: Regular security assessments

## 🚀 Deployment

### Production Build
```bash
# Build for production
npm run build:web

# Deploy to Expo
npx expo publish

# Build native apps
npx expo build:ios
npx expo build:android
```

### Environment Variables
```env
EXPO_PUBLIC_GOOGLE_PLACES_API_KEY=your_api_key
EXPO_PUBLIC_SMS_API_KEY=your_sms_key
EXPO_PUBLIC_PUSH_NOTIFICATION_KEY=your_push_key
```

## 📊 Performance Metrics

### Target Performance
- **App Launch**: < 3 seconds
- **Location Search**: < 500ms response
- **SOS Alert**: < 2 seconds delivery
- **Photo Upload**: < 10 seconds for 5MB
- **Offline Support**: Core features available offline

### Monitoring
- **Crash Reporting**: Sentry integration
- **Performance Monitoring**: Real-time metrics
- **User Analytics**: Privacy-compliant tracking
- **Error Logging**: Comprehensive error tracking

## 🤝 Contributing

### Development Guidelines
1. Follow React Native best practices
2. Implement comprehensive error handling
3. Add unit tests for critical features
4. Ensure accessibility compliance
5. Document API integrations

### Code Quality
- **ESLint**: Code linting and formatting.
- **TypeScript**: Strict Type safety throughout (Achieved 0 compilation errors across all components and hooks).
- **Testing**: Jest and React Native Testing Library.
- **Documentation**: Inline code documentation.

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 🆘 Support

For technical support or feature requests:
- Create an issue on GitHub
- Contact: support@travelbuddy.com
- Documentation: docs.travelbuddy.com

---

**TravelBuddy** - Ride Together, Stay Safe Together 🚗✨entation

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 🆘 Support

For technical support or feature requests:
- Create an issue on GitHub
- Contact: support@travelbuddy.com
- Documentation: docs.travelbuddy.com

---

**TravelBuddy** - Ride Together, Stay Safe Together 🚗✨