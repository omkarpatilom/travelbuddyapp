import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import EditProfileScreen from '../app/profile/edit';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { useRouter } from 'expo-router';
import { api } from '../utils/api';
import { Alert } from 'react-native';

// Mock contexts and hooks
jest.mock('../contexts/AuthContext');
jest.mock('../contexts/ThemeContext');
jest.mock('../utils/api');
jest.mock('expo-router', () => ({
  useRouter: jest.fn(),
}));

describe('EditProfileScreen', () => {
  const mockUser = {
    id: '1',
    fullName: 'Jane Doe',
    email: 'jane@example.com',
    phone: '1234567890',
    role: 'Passenger',
  };

  const mockTheme = {
    colors: {
      primary: '#000',
      background: '#fff',
      surface: '#fff',
      card: '#f9f9f9',
      border: '#eee',
      text: '#000',
      textSecondary: '#666',
    },
  };

  const mockUpdateUser = jest.fn();

  beforeEach(() => {
    (useAuth as jest.Mock).mockReturnValue({
      user: mockUser,
      updateUser: mockUpdateUser,
      refreshProfile: jest.fn(),
    });
    (useTheme as jest.Mock).mockReturnValue({
      theme: mockTheme,
    });
    (useRouter as jest.Mock).mockReturnValue({
      back: jest.fn(),
    });
    jest.spyOn(Alert, 'alert');
  });

  it('renders initial user data', () => {
    const { getByPlaceholderText } = render(<EditProfileScreen />);
    
    expect(getByPlaceholderText('Full Name').props.value).toBe('Jane Doe');
    expect(getByPlaceholderText('Email').props.value).toBe('jane@example.com');
    expect(getByPlaceholderText('Phone Number').props.value).toBe('1234567890');
  });

  it('updates state when input changes', () => {
    const { getByPlaceholderText } = render(<EditProfileScreen />);
    const nameInput = getByPlaceholderText('Full Name');
    
    fireEvent.changeText(nameInput, 'Jane Smith');
    expect(nameInput.props.value).toBe('Jane Smith');
  });

  it('calls updateUser and shows success alert on save', async () => {
    const { getByText } = render(<EditProfileScreen />);
    const saveButton = getByText('Save Changes');
    
    fireEvent.press(saveButton);
    
    await waitFor(() => {
      expect(mockUpdateUser).toHaveBeenCalled();
      expect(Alert.alert).toHaveBeenCalledWith('Success', 'Profile updated successfully!', expect.any(Array));
    });
  });

  it('shows error if fields are missing', async () => {
    const { getByPlaceholderText, getByText } = render(<EditProfileScreen />);
    const nameInput = getByPlaceholderText('Full Name');
    const saveButton = getByText('Save Changes');
    
    fireEvent.changeText(nameInput, '');
    fireEvent.press(saveButton);
    
    expect(Alert.alert).toHaveBeenCalledWith('Missing Information', expect.any(String));
  });
});
