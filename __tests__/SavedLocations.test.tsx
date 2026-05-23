import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import SavedLocationsScreen from '../app/profile/saved-locations';
import { useTheme } from '../contexts/ThemeContext';
import { api } from '../utils/api';
import { Alert } from 'react-native';

jest.mock('../contexts/ThemeContext');
jest.mock('../utils/api');
jest.mock('expo-router', () => ({
  useRouter: jest.fn(),
}));

describe('SavedLocationsScreen', () => {
  const mockLocations = [
    { id: '1', name: 'Home', address: '123 Test St', latitude: 0, longitude: 0, type: 'Home' },
    { id: '2', name: 'Work', address: '456 Office Rd', latitude: 0, longitude: 0, type: 'Work' },
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
      secondary: '#333',
      accent: '#999',
    },
  };

  beforeEach(() => {
    (useTheme as jest.Mock).mockReturnValue({ theme: mockTheme });
    (api.get as jest.Mock).mockResolvedValue(mockLocations);
    jest.spyOn(Alert, 'alert');
  });

  it('renders list of saved locations', async () => {
    const { findByText } = render(<SavedLocationsScreen />);
    
    expect(await findByText('Home')).toBeTruthy();
    expect(await findByText('123 Test St')).toBeTruthy();
    expect(await findByText('Work')).toBeTruthy();
  });

  it('allows adding a new location', async () => {
    (api.post as jest.Mock).mockResolvedValue({});
    const { getByPlaceholderText, findByText, getByText } = render(<SavedLocationsScreen />);
    
    // In empty state it's "Add New Location", in list state it's a Plus icon but we mocked it as testID="Plus"
    // Wait, I added a "Add Another Location" button at the bottom
    const addButton = await findByText(/Add Another Location/);
    fireEvent.press(addButton);
    
    fireEvent.changeText(getByPlaceholderText(/e.g., Home/), 'Gym');
    fireEvent.changeText(getByPlaceholderText(/Enter full address/), '789 Fitness Ave');
    
    fireEvent.press(getByText('Save Location'));
    
    await waitFor(() => {
      expect(api.post).toHaveBeenCalledWith('/saved-locations', expect.objectContaining({
        name: 'Gym',
        address: '789 Fitness Ave',
      }));
    });
  });
});
