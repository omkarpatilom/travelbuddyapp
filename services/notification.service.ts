import { api } from '../utils/api';
import { NotificationResponseDto, NotificationPreferenceDto } from '../utils/types';

export const notificationService = {
  async getMyNotifications() {
    return api.get<NotificationResponseDto[]>('/notifications/my-notifications');
  },

  async getById(id: string) {
    return api.get<NotificationResponseDto>(`/notifications/${id}`);
  },

  async deleteNotification(id: string) {
    return api.delete<void>(`/notifications/${id}`);
  },

  async markAsRead(id: string) {
    return api.patch<void>(`/notifications/${id}/read`, {});
  },

  async markAllAsRead() {
    return api.patch<void>('/notifications/read-all', {});
  },

  async getPreferences() {
    return api.get<NotificationPreferenceDto>('/notifications/preferences');
  },

  async updatePreferences(data: any) {
    return api.put<void>('/notifications/preferences', data);
  },

  async getSettings() {
    return api.get<any>('/notifications/settings');
  },

  async updateSettings(data: any) {
    return api.put<void>('/notifications/settings', data);
  },
};
