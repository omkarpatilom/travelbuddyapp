# Graph Report - travelbuddyapp (2026-09-15)

## Corpus Check
- 96 TypeScript/React Native files · ~50,000 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 265 nodes · 224 edges · 14 communities detected
- Extraction: 95% EXTRACTED · 5% INFERRED · 0% AMBIGUOUS

## Community Hubs (Navigation)
- Community 0: Camera, Verification & Document Upload
- Community 1: Real-Time Location & Proximity Tracking
- Community 2: Vehicle Management & Preference Overrides
- Community 3: Emergency Contacts & SOS Safety Engine
- Community 4: Ride Search & Corridor Matching Interface
- Community 5: Theme & UI Layout Tokens (useTheme)
- Community 6: React Context State Providers (Auth, Ride, Safety, Vehicle)
- Community 7: Ride Lifecycle Cockpit (Driver & Passenger Handlers)
- Community 8: Saved Locations & Autocomplete Cache
- Community 9: JWT Auth & Interceptor Headers
- Community 10: Command Center Journey Stepper

## Core Abstractions & Hooks
1. `useAuth()` - Auth Session & Bearer propagation
2. `useRides()` - Ride publishing, corridor search & lifecycle
3. `useTheme()` - Light/Dark theme dynamic colors
4. `requestLocationPermission()` - GPS permissions & proximity watcher
5. `fetchVehicles()` - Vehicle management & preference overrides
6. `triggerSOS()` - 5-second countdown & SMS broadcast
