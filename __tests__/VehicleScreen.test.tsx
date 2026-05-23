import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import VehicleDetailsScreen from '../app/profile/vehicle';
import { useTheme } from '../contexts/ThemeContext';
import { api } from '../utils/api';
import { Alert } from 'react-native';

// Mock hooks and api
jest.mock('../contexts/ThemeContext');
jest.mock('../utils/api');
jest.mock('expo-router', () => ({
  useRouter: jest.fn(),
}));

describe('VehicleDetailsScreen', () => {
  const mockVehicles = [
    {
      id: 'v1',
      brand: 'Toyota',
      model: 'Camry',
      color: 'Blue',
      registrationNumber: 'ABC1234',
      totalSeats: 4,
      isDefault: true,
      createdAt: '2026-05-23T00:00:00Z',
    }
  ];

  const mockTheme = {
    colors: {
      primary: '#000',
      background: '#fff',
      surface: '#fff',
      card: '#f9f9f9',
      border: '#eee',
      text: '#000',
      textSecondary: '#666',
      error: '#f00',
      success: '#0f0',
      warning: '#f0f',
    },
  };

  beforeEach(() => {
    (useTheme as jest.Mock).mockReturnValue({ theme: mockTheme });
    (api.get as jest.Mock).mockImplementation((url: string) => {
      if (url === '/vehicles/my-vehicles') return Promise.resolve(mockVehicles);
      if (url.includes('/features')) return Promise.resolve([]);
      if (url.includes('/preferences')) return Promise.resolve({ allowSmoking: false, allowMusic: true, allowPets: false, conversationLevel: 1 });
      if (url === '/users/me') return Promise.resolve({ id: 'u1' });
      return Promise.resolve([]);
    });
    jest.spyOn(Alert, 'alert');
  });

  it('renders existing vehicles', async () => {
    const { findByText } = render(<VehicleDetailsScreen />);
    
    // Using regex to handle interpolated strings
    expect(await findByText(/Toyota/)).toBeTruthy();
    expect(await findByText(/Camry/)).toBeTruthy();
    expect(await findByText(/ABC1234/)).toBeTruthy();
  });

  it('opens add vehicle form on button press', async () => {
    const { findByPlaceholderText, findByText } = render(<VehicleDetailsScreen />);
    
    const addButton = await findByText(/Add Another Vehicle/);
    fireEvent.press(addButton);
    
    expect(await findByPlaceholderText(/Toyota/)).toBeTruthy();
  });

  it('validates required fields on save', async () => {
    const { findByText } = render(<VehicleDetailsScreen />);
    
    fireEvent.press(await findByText(/Add Another Vehicle/));
    fireEvent.press(await findByText(/Save Vehicle/));
    
    expect(Alert.alert).toHaveBeenCalledWith('Missing Information', expect.any(String));
  });

  it('calls POST api on save new vehicle', async () => {
    (api.post as jest.Mock).mockResolvedValue('new-v-id');
    const { findByText, findByPlaceholderText } = render(<VehicleDetailsScreen />);
    
    fireEvent.press(await findByText(/Add Another Vehicle/));
    
    fireEvent.changeText(await findByPlaceholderText(/Toyota/), 'Honda');
    fireEvent.changeText(await findByPlaceholderText(/Camry/), 'Civic');
    fireEvent.changeText(await findByPlaceholderText('Color'), 'Red');
    fireEvent.changeText(await findByPlaceholderText('License Plate'), 'XYZ789');
    
    fireEvent.press(await findByText(/Save Vehicle/));
    
    await waitFor(() => {
      expect(api.post).toHaveBeenCalledWith('/vehicles', expect.objectContaining({
        brand: 'Honda',
        model: 'Civic',
      }));
    });
  });
});
