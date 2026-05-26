import { api } from '../utils/api';
import { EmergencyContactDto, SafetyIncidentDto, TriggerSosDto } from '../utils/types';

export const safetyService = {
  async getEmergencyContacts() {
    return api.get<EmergencyContactDto[]>('/safety/emergency-contacts');
  },

  async addEmergencyContact(data: any) {
    return api.post<string>('/safety/emergency-contacts', data);
  },

  async deleteEmergencyContact(id: string) {
    return api.delete<void>(`/safety/emergency-contacts/${id}`);
  },

  async triggerSos(data: TriggerSosDto) {
    return api.post<string>('/safety/sos/trigger', data);
  },

  async getMyIncidents() {
    return api.get<SafetyIncidentDto[]>('/safety/sos/my-incidents');
  },
};
