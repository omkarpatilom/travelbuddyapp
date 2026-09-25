import React from 'react';
import { render, fireEvent, act, waitFor } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import SafetyFeatures from '../components/SafetyFeatures';
import ReviewsScreen from '../app/profile/reviews';
import { useTheme } from '../contexts/ThemeContext';
import { useAuth } from '../contexts/AuthContext';
import { api } from '../utils/api';

jest.mock('../utils/api');
jest.mock('../contexts/ThemeContext');
jest.mock('../contexts/AuthContext');
jest.mock('../contexts/NotificationContext', () => ({
  useNotifications: () => ({ sendLocalNotification: jest.fn() }),
}));
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: jest.fn(), back: jest.fn(), canGoBack: () => true, replace: jest.fn() }),
}));
jest.mock('expo-location', () => ({
  getCurrentPositionAsync: jest.fn().mockResolvedValue({ coords: { latitude: 1, longitude: 2 } }),
  Accuracy: { High: 4 },
}));
jest.mock('expo-sms', () => ({
  isAvailableAsync: jest.fn().mockResolvedValue(false),
  sendSMSAsync: jest.fn(),
}));
jest.mock('../utils/permissions', () => ({
  requestLocationPermission: jest.fn().mockResolvedValue({ granted: true }),
}));
jest.mock('lucide-react-native', () => {
  const React = require('react');
  const { View } = require('react-native');
  return new Proxy({}, { get: (_t, name) => (props: any) => React.createElement(View, { ...props, testID: String(name) }) });
});

const theme = {
  colors: {
    primary: '#000', background: '#fff', card: '#fff', border: '#eee', text: '#000', textSecondary: '#666',
    error: '#f00', success: '#0f0', warning: '#ff0', surface: '#fff', secondary: '#333', accent: '#00f',
  },
};

const wrap = (ui: React.ReactElement) =>
  render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>{ui}</QueryClientProvider>);

beforeEach(() => {
  jest.clearAllMocks();
  (useTheme as jest.Mock).mockReturnValue({ theme });
  (useAuth as jest.Mock).mockReturnValue({ user: { id: 'u1' } });
  (api.get as jest.Mock).mockImplementation(async (url: string) => {
    if (url === '/Verification/status') return {};
    return [];
  });
  (api.post as jest.Mock).mockResolvedValue('incident-id');
});

describe('SOS countdown', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it('Cancel stops the countdown: no SOS is sent', async () => {
    const { getByText } = wrap(<SafetyFeatures />);
    fireEvent.press(getByText('SOS EMERGENCY'));
    act(() => {
      jest.advanceTimersByTime(2000);
    });
    fireEvent.press(getByText('Cancel'));
    await act(async () => {
      jest.advanceTimersByTime(10000);
    });
    expect(api.post).not.toHaveBeenCalledWith('/safety/sos/trigger', expect.anything());
  });

  it('still sends the SOS when the countdown is not cancelled', async () => {
    const { getByText } = wrap(<SafetyFeatures />);
    fireEvent.press(getByText('SOS EMERGENCY'));
    await act(async () => {
      jest.advanceTimersByTime(5000);
    });
    jest.useRealTimers();
    await waitFor(() =>
      expect(api.post).toHaveBeenCalledWith('/safety/sos/trigger', expect.objectContaining({ latitude: 1, longitude: 2 })),
    );
    expect((api.post as jest.Mock).mock.calls.filter((c) => c[0] === '/safety/sos/trigger')).toHaveLength(1);
  });
});

describe('Reviews screen', () => {
  it('does not spin forever when opened before the user is loaded', async () => {
    (useAuth as jest.Mock).mockReturnValue({ user: null });
    const { UNSAFE_queryAllByType } = wrap(<ReviewsScreen />);
    const { ActivityIndicator } = require('react-native');
    await waitFor(() => expect(UNSAFE_queryAllByType(ActivityIndicator)).toHaveLength(0));
  });

  it('loads reviews once the user becomes available', async () => {
    (useAuth as jest.Mock).mockReturnValue({ user: null });
    const view = wrap(<ReviewsScreen />);
    (useAuth as jest.Mock).mockReturnValue({ user: { id: 'u1' } });
    view.rerender(
      <QueryClientProvider client={new QueryClient()}>
        <ReviewsScreen />
      </QueryClientProvider>,
    );
    await waitFor(() => expect(api.get).toHaveBeenCalledWith('/Reviews/target/u1'));
  });
});
