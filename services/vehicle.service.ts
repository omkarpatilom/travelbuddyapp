import { api } from '../utils/api';
import { VehicleResponseDto, VehicleFeatureDto, VehiclePhotoDto, VehiclePreferenceDto } from '../utils/types';

export const vehicleService = {
  async createVehicle(data: any) {
    return api.post<string>('/vehicles', data);
  },

  async getById(id: string) {
    return api.get<VehicleResponseDto>(`/vehicles/${id}`);
  },

  async updateVehicle(id: string, data: any) {
    return api.put<void>(`/vehicles/${id}`, data);
  },

  async deleteVehicle(id: string) {
    return api.delete<void>(`/vehicles/${id}`);
  },

  async getMyVehicles() {
    return api.get<VehicleResponseDto[]>('/vehicles/my-vehicles');
  },

  async setDefault(id: string) {
    return api.patch<void>(`/vehicles/${id}/default`, {});
  },

  async search(params: any) {
    const queryParams: any = {};
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        queryParams[key] = value;
      }
    });
    const query = new URLSearchParams(queryParams).toString();
    return api.get<VehicleResponseDto[]>(`/vehicles/search?${query}`);
  },

  async getFeatures(vehicleId: string) {
    return api.get<VehicleFeatureDto[]>(`/VehicleFeatures/${vehicleId}/features`);
  },

  async addFeature(vehicleId: string, data: any) {
    return api.post<string>(`/VehicleFeatures/${vehicleId}/features`, data);
  },

  async deleteFeature(vehicleId: string, featureId: string) {
    return api.delete<void>(`/VehicleFeatures/${vehicleId}/features/${featureId}`);
  },

  async getPhotos(vehicleId: string) {
    return api.get<VehiclePhotoDto[]>(`/VehiclePhotos/${vehicleId}/photos`);
  },

  async addPhoto(vehicleId: string, data: any) {
    return api.post<string>(`/VehiclePhotos/${vehicleId}/photos`, data);
  },

  async setPrimaryPhoto(vehicleId: string, photoId: string) {
    return api.patch<void>(`/VehiclePhotos/${vehicleId}/photos/${photoId}/primary`, {});
  },

  async getPreferences(vehicleId: string) {
    return api.get<VehiclePreferenceDto>(`/VehiclePreferences/${vehicleId}/preferences`);
  },

  async updatePreferences(vehicleId: string, data: any) {
    return api.put<void>(`/VehiclePreferences/${vehicleId}/preferences`, data);
  },

  async getDocuments(vehicleId: string) {
    return api.get<any[]>(`/vehicleverification/${vehicleId}/documents`);
  },

  async uploadDocument(vehicleId: string, data: any) {
    return api.post<string>(`/vehicleverification/${vehicleId}/documents`, data);
  },

  async submitVerification(vehicleId: string) {
    return api.post<void>(`/vehicleverification/${vehicleId}/submit-verification`, {});
  },
};
