import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { AuthProvider, useAuth } from '../contexts/AuthContext';
import { api } from '../utils/api';
import { storage, StorageKeys } from '../utils/storage';
import { Text, Button, View } from 'react-native';

// Mock dependencies
jest.mock('../utils/api');
jest.mock('../utils/storage');
jest.mock('../utils/validation', () => ({
  validateEmail: jest.fn(() => true),
  validatePassword: jest.fn(() => ({ isValid: true })),
}));

const TestConsumer = () => {
  const { user, login, logout, isLoading } = useAuth();
  return (
    <View>
      <Text testID="user-name">{user?.fullName || 'Guest'}</Text>
      <Text testID="loading">{isLoading ? 'Loading' : 'Idle'}</Text>
      <Button title="Login" onPress={() => login('test@example.com', 'password')} />
      <Button title="Logout" onPress={() => logout()} />
    </View>
  );
};

describe('AuthContext Integration', () => {
  const mockUser = {
    id: '00000000-0000-0000-0000-000000000001',
    fullName: 'Test User',
    email: 'test@example.com',
    phoneNumber: '1234567890',
    role: 'Passenger',
    status: 'Active',
    rating: 4.8,
    isVerified: true,
    profilePictureUrl: 'https://example.com/avatar.jpg',
    createdAt: '2026-01-01T00:00:00Z',
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should fetch profile if token exists on mount', async () => {
    (storage.getItem as jest.Mock).mockImplementation((key) => {
      if (key === StorageKeys.AUTH_TOKEN) return Promise.resolve('valid-token');
      return Promise.resolve(null);
    });
    (api.get as jest.Mock).mockResolvedValue(mockUser);

    const { getByTestId } = render(
      <AuthProvider>
        <TestConsumer />
      </AuthProvider>
    );

    await waitFor(() => {
      expect(getByTestId('user-name').props.children).toBe('Test User');
    });

    expect(api.get).toHaveBeenCalledWith('/users/me');
  });

  it('should handle login success', async () => {
    (storage.getItem as jest.Mock).mockResolvedValue(null);
    (api.post as jest.Mock).mockResolvedValue({ accessToken: 'new-token' });
    (api.get as jest.Mock).mockResolvedValue(mockUser);

    const { getByText, getByTestId } = render(
      <AuthProvider>
        <TestConsumer />
      </AuthProvider>
    );

    fireEvent.press(getByText('Login'));

    await waitFor(() => {
      expect(getByTestId('user-name').props.children).toBe('Test User');
    });

    expect(storage.setItem).toHaveBeenCalledWith(StorageKeys.AUTH_TOKEN, 'new-token');
  });

  it('should handle logout', async () => {
    (storage.getItem as jest.Mock).mockImplementation((key) => {
      if (key === StorageKeys.USER_DATA) return Promise.resolve(mockUser);
      if (key === StorageKeys.AUTH_TOKEN) return Promise.resolve('token');
      return Promise.resolve(null);
    });

    const { getByText, getByTestId } = render(
      <AuthProvider>
        <TestConsumer />
      </AuthProvider>
    );

    fireEvent.press(getByText('Logout'));

    await waitFor(() => {
      expect(getByTestId('user-name').props.children).toBe('Guest');
    });

    expect(storage.removeItem).toHaveBeenCalledWith(StorageKeys.AUTH_TOKEN);
    expect(storage.removeItem).toHaveBeenCalledWith(StorageKeys.USER_DATA);
  });
});
