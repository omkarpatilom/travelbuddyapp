# TravelBuddy App Instructions

This directory contains the React Native/Expo mobile application for TravelBuddy.

## Tech Stack
- **Framework:** React Native with Expo SDK 54
- **Navigation:** Expo Router
- **Animations:** Reanimated v4
- **State Management:** React Context API

## Development Workflow
- **Start App:** `npx expo start --offline`
- **Local IP:** When testing on physical devices, update `API_BASE_URL` in `utils/api.ts` to your machine's local IP (e.g., `192.168.1.9`).
- **Backend:** The app connects to the `ApiGateway` on port 5000.

## Key Directories
- `app/`: Routing and screen components.
- `components/`: Reusable UI components.
- `contexts/`: Global state management.
- `utils/`: Helper functions and API configuration.
