import React from 'react';
import { renderHook, act, waitFor } from '@testing-library/react-native';
import { RideProvider, useRides } from '../contexts/RideContext';
import { useAuth } from '../contexts/AuthContext';
import { api } from '../utils/api';

jest.mock('../contexts/AuthContext');
jest.mock('../utils/api');

const mockUser = { id: '1', name: 'Test User', role: 'Driver' };
const mockRide = {
  id: 'r1',
  driverId: '1',
  driverName: 'Test Driver',
  driverRating: 4.5,
  from: { address: 'A', latitude: 1, longitude: 1 },
  to: { address: 'B', latitude: 2, longitude: 2 },
  departureTime: '2026-05-25T14:30:00Z',
  pricePerSeat: 20,
  availableSeats: 3,
  totalSeats: 4,
  vehicleModel: 'Toyota Camry',
  vehicleColor: 'Silver',
  status: 'active'
};

const mockBooking = {
  bookingId: 'b1',
  rideId: 'r1',
  userId: '2',
  seats: 1,
  totalPrice: 20,
  status: 'confirmed',
  bookingDate: '2026-05-25T14:00:00Z',
  passengerName: 'Test Passenger',
  passengerPhone: '1234567890'
};

describe('RideContext', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (useAuth as jest.Mock).mockReturnValue({ user: mockUser });
  });

  it('loads initial data correctly for Driver', async () => {
    (api.get as jest.Mock).mockImplementation((url) => {
      if (url === '/rides/active') return Promise.resolve([mockRide]);
      if (url === '/bookings/my-bookings') return Promise.resolve([mockBooking]);
      if (url === '/rides/my-rides') return Promise.resolve([mockRide]);
      if (url === '/rides/r1') return Promise.resolve(mockRide);
      return Promise.reject(new Error('not found'));
    });

    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <RideProvider>{children}</RideProvider>
    );

    const { result } = renderHook(() => useRides(), { wrapper });

    expect(result.current.isLoading).toBe(true);
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    
    expect(result.current.isLoading).toBe(false);
    expect(result.current.rides).toHaveLength(1);
    expect(result.current.bookings).toHaveLength(1);
    expect(result.current.myRides).toHaveLength(1);
    
    // Check mapping
    const mappedRide = result.current.rides[0];
    expect(mappedRide.date).toBe('2026-05-25');
    expect(mappedRide.time).toBe('14:30');
  });

  it('handles API failure during initial load', async () => {
    (api.get as jest.Mock).mockRejectedValue(new Error('Network error'));

    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <RideProvider>{children}</RideProvider>
    );

    const { result } = renderHook(() => useRides(), { wrapper });

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    
    expect(result.current.isLoading).toBe(false);
    expect(result.current.rides).toHaveLength(0);
    expect(result.current.bookings).toHaveLength(0);
  });

  it('searchRides returns correct data', async () => {
    (api.get as jest.Mock).mockImplementation((url) => {
      if (url.includes('/rides/search')) return Promise.resolve([mockRide]);
      if (url === '/rides/active') return Promise.resolve([]);
      if (url === '/bookings/my-bookings') return Promise.resolve([]);
      if (url === '/rides/my-rides') return Promise.resolve([]);
      return Promise.resolve([]);
    });

    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <RideProvider>{children}</RideProvider>
    );

    const { result } = renderHook(() => useRides(), { wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    let searchResults;
    await act(async () => {
      searchResults = await result.current.searchRides('A', 'B', '2026-05-25');
    });

    expect(searchResults).toHaveLength(1);
    expect(api.get).toHaveBeenCalledWith('/rides/search?from=A&to=B&date=2026-05-25');
  });

  it('createRide calls api.post with correct payload', async () => {
    (api.get as jest.Mock).mockResolvedValue([]);
    (api.post as jest.Mock).mockResolvedValue({ id: 'r2' });

    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <RideProvider>{children}</RideProvider>
    );

    const { result } = renderHook(() => useRides(), { wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    const rideData = {
      vehicleId: 'v1',
      from: { address: 'A', coordinates: { latitude: 1, longitude: 1 } },
      to: { address: 'B', coordinates: { latitude: 2, longitude: 2 } },
      date: '2026-05-25',
      time: '14:30',
      price: 20,
      totalSeats: 4
    };

    let success;
    await act(async () => {
      success = await result.current.createRide(rideData);
    });

    expect(success).toBe(true);
    expect(api.post).toHaveBeenCalledWith('/rides', expect.objectContaining({
      departureTime: '2026-05-25T14:30:00Z',
      vehicleId: 'v1',
      fromAddress: 'A',
      fromLat: 1,
      fromLng: 1,
      toAddress: 'B',
      toLat: 2,
      toLng: 2,
    }));
  });

  it('createRide handles API failure gracefully', async () => {
    (api.get as jest.Mock).mockResolvedValue([]);
    (api.post as jest.Mock).mockRejectedValue(new Error('Failed to create'));

    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <RideProvider>{children}</RideProvider>
    );

    const { result } = renderHook(() => useRides(), { wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    const rideData = {
      from: { address: 'A', coordinates: { latitude: 1, longitude: 1 } },
      to: { address: 'B', coordinates: { latitude: 2, longitude: 2 } },
      date: '2026-05-25',
      time: '14:30',
    };

    let success;
    await act(async () => {
      success = await result.current.createRide(rideData);
    });

    expect(success).toBe(false);
  });
});
