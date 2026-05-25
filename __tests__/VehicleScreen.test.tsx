import React from 'react';
import { render, fireEvent, waitFor, act } from '@testing-library/react-native';
import VehicleDetailsScreen from '../app/profile/vehicle';
import { useTheme } from '../contexts/ThemeContext';
import { api } from '../utils/api';
import { Alert } from 'react-native';

// Mock hooks and api
jest.mock('../contexts/ThemeContext');
jest.mock('../utils/api');
jest.mock('expo-router', () => ({
  useRouter: jest.fn(() => ({ back: jest.fn() })),
}));
jest.mock('lucide-react-native', () => ({
  Car: () => 'CarIcon',
  Hash: () => 'HashIcon',
  Palette: () => 'PaletteIcon',
  Calendar: () => 'CalendarIcon',
  Users: () => 'UsersIcon',
  ArrowLeft: () => 'ArrowLeftIcon',
  Save: () => 'SaveIcon',
  Plus: () => 'PlusIcon',
}));
jest.mock('../components/PhotoUploader', () => 'PhotoUploader');
jest.mock('../components/VehicleFeatureTags', () => {
  const comp = () => 'VehicleFeatureTags';
  comp.AVAILABLE_FEATURES = [{ id: 'f1', name: 'Feature 1', category: 'comfort' }];
  return comp;
});
jest.mock('../components/RidePreferences', () => 'RidePreferences');

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
    jest.clearAllMocks();
    (useTheme as jest.Mock).mockReturnValue({ theme: mockTheme });
    (api.get as jest.Mock).mockImplementation(async (url: string) => {
      if (url === '/vehicles/my-vehicles') return mockVehicles;
      if (url.includes('/features')) return [];
      if (url.includes('/preferences')) return { allowSmoking: false, allowMusic: true, allowPets: false, conversationLevel: 1 };
      if (url === '/users/me') return { id: 'u1' };
      return [];
    });
    jest.spyOn(Alert, 'alert');
  });

  it('renders existing vehicles successfully', async () => {
    const { findByText } = render(<VehicleDetailsScreen />);
    expect(await findByText(/Toyota/)).toBeTruthy();
    expect(await findByText(/Camry/)).toBeTruthy();
    expect(await findByText(/ABC1234/)).toBeTruthy();
  });

  it('renders empty state correctly', async () => {
    (api.get as jest.Mock).mockImplementationOnce(async (url) => {
      if (url === '/vehicles/my-vehicles') return [];
      return [];
    });
    const { findByText } = render(<VehicleDetailsScreen />);
    expect(await findByText('No vehicles added')).toBeTruthy();
  });

  it('handles API failure state gracefully', async () => {
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    (api.get as jest.Mock).mockRejectedValueOnce(new Error('Network Error'));
    const { findByText } = render(<VehicleDetailsScreen />);
    // Should fallback to empty state or stay without crashing
    expect(await findByText('No vehicles added')).toBeTruthy();
    consoleSpy.mockRestore();
  });

  it('validates required fields on save', async () => {
    const { findByText } = render(<VehicleDetailsScreen />);
    fireEvent.press(await findByText(/Add Another Vehicle/));
    fireEvent.press(await findByText('Save Vehicle'));
    expect(Alert.alert).toHaveBeenCalledWith('Missing Information', 'Please fill in all required fields');
  });

  it('calls POST api on save new vehicle', async () => {
    (api.post as jest.Mock).mockResolvedValue('new-v-id');
    const { findByText, findByPlaceholderText } = render(<VehicleDetailsScreen />);
    fireEvent.press(await findByText(/Add Another Vehicle/));
    fireEvent.changeText(await findByPlaceholderText(/Make/), 'Honda');
    fireEvent.changeText(await findByPlaceholderText(/Model/), 'Civic');
    fireEvent.changeText(await findByPlaceholderText('Color'), 'Red');
    fireEvent.changeText(await findByPlaceholderText('License Plate'), 'XYZ789');
    
    await act(async () => {
      fireEvent.press(await findByText('Save Vehicle'));
    });
    
    expect(api.post).toHaveBeenCalledWith('/vehicles', expect.objectContaining({
      brand: 'Honda',
      model: 'Civic',
      color: 'Red',
      registrationNumber: 'XYZ789',
    }));
  });

  it('handles partial/malformed API data gracefully', async () => {
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    (api.get as jest.Mock).mockImplementation(async (url: string) => {
      if (url === '/vehicles/my-vehicles') return [{
        id: 'v2',
        brand: 'Ford',
        // Missing model, color, registrationNumber
        totalSeats: null, // malformed
        createdAt: 'invalid-date',
      }];
      if (url.includes('/features')) throw new Error('Features failed'); // API Failure
      if (url.includes('/preferences')) throw new Error('Preferences failed'); // API Failure
      return [];
    });
    const { findByText } = render(<VehicleDetailsScreen />);
    expect(await findByText(/Ford/)).toBeTruthy();
    expect(await findByText(/0 seats/)).toBeTruthy(); // Since totalSeats is null, falls back to 0
    consoleSpy.mockRestore();
  });

  it('tests set default vehicle', async () => {
    (api.patch as jest.Mock).mockResolvedValue({});
    (api.get as jest.Mock).mockResolvedValue([{
      id: 'v1', brand: 'Ford', model: 'Focus', color: 'White', registrationNumber: 'AAA', totalSeats: 4, isDefault: false, createdAt: '2026-05-23T00:00:00Z',
    }]);

    const { findByText } = render(<VehicleDetailsScreen />);
    const setDefaultBtn = await findByText('Set Default');
    
    await act(async () => {
      fireEvent.press(setDefaultBtn);
    });

    expect(api.patch).toHaveBeenCalledWith('/vehicles/v1/default', {});
  });

  it('handles delete vehicle', async () => {
    (api.delete as jest.Mock).mockResolvedValue({});
    (api.get as jest.Mock).mockResolvedValue([
      { id: 'v1', brand: 'Ford', model: 'Focus', color: 'White', registrationNumber: 'AAA', totalSeats: 4, isDefault: true, createdAt: '2026-05-23T00:00:00Z' },
      { id: 'v2', brand: 'Toyota', model: 'Camry', color: 'Blue', registrationNumber: 'BBB', totalSeats: 4, isDefault: false, createdAt: '2026-05-23T00:00:00Z' }
    ]);

    const { findAllByText } = render(<VehicleDetailsScreen />);
    const deleteBtns = await findAllByText('Delete');
    
    await act(async () => {
      fireEvent.press(deleteBtns[0]);
    });

    // Alert should be shown
    expect(Alert.alert).toHaveBeenCalledWith(
      'Delete Vehicle',
      'Are you sure you want to delete this vehicle?',
      expect.any(Array)
    );

    // Simulate pressing 'Delete' on the alert
    const deleteAction = (Alert.alert as jest.Mock).mock.calls[0][2].find((c: any) => c.style === 'destructive');
    await act(async () => {
      await deleteAction.onPress();
    });

    expect(api.delete).toHaveBeenCalledWith('/vehicles/v1'); // First vehicle has the delete button
  });
});