import React from 'react';
import { render, waitFor } from '@testing-library/react-native';
import ProfileScreen from '../app/(tabs)/profile';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { useRouter } from 'expo-router';

// Mock contexts and hooks
jest.mock('../contexts/AuthContext');
jest.mock('../contexts/ThemeContext');
jest.mock('expo-router', () => ({
  useRouter: jest.fn(),
  useFocusEffect: jest.fn(),
}));

describe('ProfileScreen', () => {
  const mockUser = {
    id: '1',
    fullName: 'Jane Doe',
    email: 'jane@example.com',
    rating: 4.9,
    isVerified: true,
    createdAt: '2026-05-23T00:00:00Z',
    totalRides: 150,
    role: 'Passenger',
  };

  const mockTheme = {
    colors: {
      primary: '#000',
      background: '#fff',
      card: '#f9f9f9',
      border: '#eee',
      text: '#000',
      textSecondary: '#666',
      error: '#f00',
      secondary: '#333',
      accent: '#999',
    },
  };

  beforeEach(() => {
    (useAuth as jest.Mock).mockReturnValue({
      user: mockUser,
      logout: jest.fn(),
      refreshProfile: jest.fn(),
    });
    (useTheme as jest.Mock).mockReturnValue({
      theme: mockTheme,
    });
    (useRouter as jest.Mock).mockReturnValue({
      push: jest.fn(),
    });
  });

  it('renders user information correctly', async () => {
    const { getByText, getAllByText } = render(<ProfileScreen />);
    
    expect(getByText('Jane Doe')).toBeTruthy();
    expect(getByText('jane@example.com')).toBeTruthy();
    expect(getByText('150')).toBeTruthy(); // Total Rides
    // Rating appears in header and stats
    expect(getAllByText('4.9').length).toBeGreaterThanOrEqual(1);
  });

  it('shows Driver Dashboard if user is a Driver', () => {
    (useAuth as jest.Mock).mockReturnValue({
      user: { ...mockUser, role: 'Driver' },
      logout: jest.fn(),
      refreshProfile: jest.fn(),
    });

    const { getByText } = render(<ProfileScreen />);
    expect(getByText('Driver Dashboard')).toBeTruthy();
  });

  it('hides Driver Dashboard if user is a Passenger', () => {
    const { queryByText } = render(<ProfileScreen />);
    expect(queryByText('Driver Dashboard')).toBeNull();
  });
});
