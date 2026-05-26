import { api } from '../utils/api';
import { UserProfileDto } from '../utils/types';

export const userService = {
  async getMe() {
    return api.get<UserProfileDto>('/users/me');
  },

  async updateProfile(data: { fullName: string; phoneNumber: string }) {
    return api.put<void>('/users/me', data);
  },

  async deleteAccount() {
    return api.delete<void>('/users/me');
  },

  async getById(userId: string) {
    return api.get<UserProfileDto>(`/users/${userId}`);
  },

  async uploadProfilePhoto(file: any) {
    const formData = new FormData();
    formData.append('file', file);
    return api.post<{ url: string }>('/users/me/profile-photo', formData);
  },

  async deleteProfilePhoto() {
    return api.delete<void>('/users/me/profile-photo');
  },

  async getSavedLocations() {
    return api.get<any[]>('/saved-locations');
  },

  async saveLocation(data: { name: string; address: string; latitude: number; longitude: number }) {
    return api.post<void>('/saved-locations', data);
  },

  async deleteSavedLocation(locationId: string) {
    return api.delete<void>(`/saved-locations/${locationId}`);
  },
};
