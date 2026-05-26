import { api } from '../utils/api';

export const driverService = {
  async createDriverProfile(data: { licenseNumber: string }) {
    return api.post<any>('/drivers', data);
  },

  async getMe() {
    return api.get<any>('/drivers/me');
  },

  async updateMe(data: { licenseNumber: string }) {
    return api.put<any>('/drivers/me', data);
  },

  async getRating(driverId: string) {
    return api.get<any>(`/drivers/${driverId}/rating`);
  },
};
