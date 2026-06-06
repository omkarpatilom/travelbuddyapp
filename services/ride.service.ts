import { api } from '../utils/api';
import { CreateRideCommand, RideDto, RideStatus, RideSearchDto } from '../utils/types';

export const rideService = {
  async createRide(data: CreateRideCommand) {
    return api.post<{ id: string }>('/rides', data);
  },

  async getRideById(id: string) {
    return api.get<RideDto>(`/rides/${id}`);
  },

  async updateRide(id: string, data: any) {
    return api.put<void>(`/rides/${id}`, data);
  },

  async deleteRide(id: string) {
    return api.delete<void>(`/rides/${id}`);
  },

  async searchRides(params: {
    From?: string;
    To?: string;
    Date?: string;
    FromCoords?: { latitude: number; longitude: number };
    ToCoords?: { latitude: number; longitude: number };
    Seats?: number;
    MaxPrice?: number;
    AllowPets?: boolean;
    AllowMusic?: boolean;
  }) {
    const queryParams: any = {
      date: params.Date,
      seats: params.Seats,
      maxPrice: params.MaxPrice,
      allowPets: params.AllowPets,
      allowMusic: params.AllowMusic,
    };

    if (params.FromCoords) {
      queryParams.srcLat = params.FromCoords.latitude;
      queryParams.srcLon = params.FromCoords.longitude;
    }
    if (params.ToCoords) {
      queryParams.dstLat = params.ToCoords.latitude;
      queryParams.dstLon = params.ToCoords.longitude;
    }

    const query = new URLSearchParams(queryParams).toString();
    return api.get<RideSearchDto[]>(`/rides/search?${query}`);
  },

  async getNearbyRides(params: {
    Latitude: number;
    Longitude: number;
    RadiusInKm: number;
    Date?: string;
    Seats?: number;
  }) {
    const query = new URLSearchParams(params as any).toString();
    return api.get<RideDto[]>(`/rides/nearby?${query}`);
  },

  async getMyRides() {
    return api.get<RideDto[]>('/rides/my-rides');
  },

  async getActiveRides() {
    return api.get<RideDto[]>('/rides/active');
  },

  async startRide(id: string) {
    return api.post<void>(`/rides/${id}/start`, {});
  },

  async completeRide(id: string) {
    return api.post<void>(`/rides/${id}/complete`, {});
  },

  async cancelRide(id: string, reason?: string) {
    return api.post<void>(`/rides/${id}/cancel`, reason ? { reason } : {});
  },

  async updatePreferences(id: string, data: any) {
    return api.put<void>(`/rides/${id}/preferences`, data);
  },

  async bookSeat(id: string, seats: number = 1) {
    return api.post<void>(`/rides/${id}/book-seat?seats=${seats}`, {});
  },

  async releaseSeat(id: string, seats: number = 1) {
    return api.post<void>(`/rides/${id}/release-seat?seats=${seats}`, {});
  },

  async updateTracking(id: string, data: { latitude: number; longitude: number; address?: string }) {
    return api.post<void>(`/rides/${id}/tracking`, { rideId: id, ...data });
  },

  async getTracking(id: string) {
    return api.get<any>(`/rides/${id}/tracking`);
  },

  async arriveAtPickup(id: string, lat?: number, lng?: number) {
    const query = lat !== undefined && lng !== undefined ? `?lat=${lat}&lng=${lng}` : '';
    return api.post<void>(`/rides/${id}/arrive${query}`, {});
  },

  async startBoarding(id: string) {
    return api.post<void>(`/rides/${id}/boarding`, {});
  },

  async transitionEnRoute(id: string) {
    return api.post<void>(`/rides/${id}/enroute`, {});
  },

  async completeDropoff(id: string) {
    return api.post<void>(`/rides/${id}/drop-completed`, {});
  },
};
