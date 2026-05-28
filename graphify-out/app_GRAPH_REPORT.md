# Graph Report - travelbuddyapp  (2026-05-27)

## Corpus Check
- 77 files · ~46,749 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 257 nodes · 211 edges · 13 communities detected
- Extraction: 93% EXTRACTED · 7% INFERRED · 0% AMBIGUOUS · INFERRED: 14 edges (avg confidence: 0.8)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- [[_COMMUNITY_Community 0|Community 0]]
- [[_COMMUNITY_Community 1|Community 1]]
- [[_COMMUNITY_Community 2|Community 2]]
- [[_COMMUNITY_Community 3|Community 3]]
- [[_COMMUNITY_Community 5|Community 5]]
- [[_COMMUNITY_Community 6|Community 6]]
- [[_COMMUNITY_Community 7|Community 7]]
- [[_COMMUNITY_Community 8|Community 8]]
- [[_COMMUNITY_Community 12|Community 12]]
- [[_COMMUNITY_Community 13|Community 13]]
- [[_COMMUNITY_Community 19|Community 19]]
- [[_COMMUNITY_Community 24|Community 24]]
- [[_COMMUNITY_Community 27|Community 27]]

## God Nodes (most connected - your core abstractions)
1. `useTheme()` - 5 edges
2. `requestLocationPermission()` - 5 edges
3. `fetchVehicles()` - 4 edges
4. `handleSaveVehicle()` - 4 edges
5. `useAuth()` - 4 edges
6. `fetchRideDetails()` - 3 edges
7. `getCurrentLocation()` - 3 edges
8. `saveRecentLocation()` - 3 edges
9. `handleResponse()` - 3 edges
10. `requestMediaLibraryPermission()` - 3 edges

## Surprising Connections (you probably didn't know these)
- `SplashScreenComponent()` --calls--> `useTheme()`  [INFERRED]
  app\index.tsx → contexts\ThemeContext.tsx
- `SafetyScreen()` --calls--> `useTheme()`  [INFERRED]
  app\profile\safety.tsx → contexts\ThemeContext.tsx
- `SavedLocationsScreen()` --calls--> `useTheme()`  [INFERRED]
  app\profile\saved-locations.tsx → contexts\ThemeContext.tsx
- `MapSelectScreen()` --calls--> `useTheme()`  [INFERRED]
  app\ride\map-select.tsx → contexts\ThemeContext.tsx
- `getCurrentLocation()` --calls--> `requestLocationPermission()`  [INFERRED]
  components\InteractiveMap.tsx → utils\permissions.ts

## Communities

### Community 0 - "Community 0"
Cohesion: 0.16
Nodes (5): editPhoto(), pickImage(), takePhoto(), requestCameraPermission(), requestMediaLibraryPermission()

### Community 1 - "Community 1"
Cohesion: 0.17
Nodes (4): getCurrentLocation(), useCurrentLocationForPickup(), triggerSOS(), requestLocationPermission()

### Community 2 - "Community 2"
Cohesion: 0.24
Nodes (6): fetchVehicles(), handleSaveVehicle(), handleSetDefault(), mapFeatureCategory(), onRefresh(), reverseMapConversationLevel()

### Community 3 - "Community 3"
Cohesion: 0.18
Nodes (2): addEmergencyContact(), fetchEmergencyContacts()

### Community 5 - "Community 5"
Cohesion: 0.18
Nodes (5): SplashScreenComponent(), useTheme(), SafetyScreen(), SavedLocationsScreen(), MapSelectScreen()

### Community 6 - "Community 6"
Cohesion: 0.18
Nodes (4): useAuth(), RideProvider(), SafetyProvider(), VehicleProvider()

### Community 7 - "Community 7"
Cohesion: 0.28
Nodes (3): fetchRideDetails(), handleCompleteRide(), handleStartRide()

### Community 8 - "Community 8"
Cohesion: 0.28
Nodes (3): getCurrentLocation(), saveRecentLocation(), selectSuggestion()

### Community 12 - "Community 12"
Cohesion: 0.43
Nodes (5): getApiHeaders(), getAuthHeader(), handleRefreshToken(), handleResponse(), onRefreshed()

### Community 13 - "Community 13"
Cohesion: 0.4
Nodes (2): handleSubmit(), validateForm()

### Community 19 - "Community 19"
Cohesion: 0.67
Nodes (2): handleRegister(), validateForm()

### Community 24 - "Community 24"
Cohesion: 1.0
Nodes (2): addLog(), runAllTests()

### Community 27 - "Community 27"
Cohesion: 1.0
Nodes (2): fetchVerificationStatus(), uploadDocument()

## Knowledge Gaps
- **Thin community `Community 3`** (12 nodes): `addEmergencyContact()`, `cancelSOS()`, `fetchEmergencyContacts()`, `fetchVerificationStatus()`, `getDocumentIcon()`, `getStatusColor()`, `getStatusText()`, `handleDocumentVerification()`, `handleSOSPress()`, `removeEmergencyContact()`, `toggleTripTracking()`, `SafetyFeatures.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 13`** (6 nodes): `offer.tsx`, `fetchVehicles()`, `handleSubmit()`, `updateFormData()`, `updateLocationData()`, `validateForm()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 19`** (4 nodes): `register.tsx`, `handleRegister()`, `updateFormData()`, `validateForm()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 24`** (3 nodes): `addLog()`, `runAllTests()`, `debug.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 27`** (3 nodes): `verification.tsx`, `fetchVerificationStatus()`, `uploadDocument()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `requestLocationPermission()` connect `Community 1` to `Community 0`, `Community 8`?**
  _High betweenness centrality (0.025) - this node is a cross-community bridge._
- **Why does `triggerSOS()` connect `Community 1` to `Community 3`?**
  _High betweenness centrality (0.013) - this node is a cross-community bridge._
- **Why does `getCurrentLocation()` connect `Community 8` to `Community 1`?**
  _High betweenness centrality (0.010) - this node is a cross-community bridge._
- **Are the 4 inferred relationships involving `useTheme()` (e.g. with `SplashScreenComponent()` and `SafetyScreen()`) actually correct?**
  _`useTheme()` has 4 INFERRED edges - model-reasoned connections that need verification._
- **Are the 4 inferred relationships involving `requestLocationPermission()` (e.g. with `getCurrentLocation()` and `useCurrentLocationForPickup()`) actually correct?**
  _`requestLocationPermission()` has 4 INFERRED edges - model-reasoned connections that need verification._
- **Are the 3 inferred relationships involving `useAuth()` (e.g. with `RideProvider()` and `SafetyProvider()`) actually correct?**
  _`useAuth()` has 3 INFERRED edges - model-reasoned connections that need verification._