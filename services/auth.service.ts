import { api } from '../utils/api';
import { LoginRequest, RegisterUserCommand, UserProfileDto } from '../utils/types';

export const authService = {
  async login(data: LoginRequest) {
    return api.post<{ accessToken: string; refreshToken: string; userId: string; role: string }>(
      '/auth/login',
      data
    );
  },

  async register(data: RegisterUserCommand) {
    return api.post<void>('/auth/register', data);
  },

  async refreshToken(accessToken: string, refreshToken: string) {
    return api.post<{ accessToken: string; refreshToken: string }>(
      '/auth/refresh-token',
      { accessToken, refreshToken }
    );
  },

  async changePassword(data: any) {
    return api.post<void>('/security/change-password', data);
  },

  async logout(refreshToken: string) {
    return api.post<void>('/security/logout', { refreshToken });
  },
};
