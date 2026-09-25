import React, { createContext, useContext, useState, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { emergencyContactKeys } from '@/hooks/useSafety';
import { safetyService } from '@/services/safety.service';
import { useAuth } from './AuthContext';
import { EmergencyContactDto, SafetyIncidentDto, TriggerSosDto } from '@/utils/types';

interface SafetyContextType {
  contacts: EmergencyContactDto[];
  incidents: SafetyIncidentDto[];
  isLoading: boolean;
  fetchContacts: () => Promise<void>;
  fetchIncidents: () => Promise<void>;
  addContact: (data: any) => Promise<string | null>;
  deleteContact: (id: string) => Promise<boolean>;
  triggerSos: (data: TriggerSosDto) => Promise<string | null>;
}

const SafetyContext = createContext<SafetyContextType | undefined>(undefined);

export function SafetyProvider({ children }: { children: React.ReactNode }) {
  const [incidents, setIncidents] = useState<SafetyIncidentDto[]>([]);
  const { user } = useAuth();
  const queryClient = useQueryClient();

  // Same `emergencyContacts` cache root as the Safety screen, so a contact
  // added or removed on either side refreshes both.
  const contactsQuery = useQuery({
    queryKey: emergencyContactKeys.raw,
    queryFn: async () => {
      try {
        return await safetyService.getEmergencyContacts();
      } catch (e) {
        console.error('Error fetching contacts:', e);
        throw e;
      }
    },
    enabled: !!user,
  });
  const contacts: EmergencyContactDto[] = contactsQuery.data ?? [];
  const isLoading = contactsQuery.isFetching;

  useEffect(() => {
    if (user) {
      fetchIncidents();
    }
  }, [user]);

  const fetchContacts = async () => {
    await contactsQuery.refetch();
  };

  const refreshAllContacts = () => queryClient.invalidateQueries({ queryKey: emergencyContactKeys.all });

  const fetchIncidents = async () => {
    try {
      const data = await safetyService.getMyIncidents();
      setIncidents(data);
    } catch (e) {
      console.error('Error fetching incidents:', e);
    }
  };

  const addContact = async (data: any) => {
    try {
      const id = await safetyService.addEmergencyContact(data);
      await refreshAllContacts();
      return id;
    } catch (e) {
      return null;
    }
  };

  const deleteContact = async (id: string) => {
    try {
      await safetyService.deleteEmergencyContact(id);
      await refreshAllContacts();
      return true;
    } catch (e) {
      return false;
    }
  };

  const triggerSos = async (data: TriggerSosDto) => {
    try {
      const id = await safetyService.triggerSos(data);
      await fetchIncidents();
      return id;
    } catch (e) {
      return null;
    }
  };

  return (
    <SafetyContext.Provider value={{ 
      contacts, 
      incidents, 
      isLoading, 
      fetchContacts, 
      fetchIncidents, 
      addContact, 
      deleteContact, 
      triggerSos 
    }}>
      {children}
    </SafetyContext.Provider>
  );
}

export function useSafety() {
  const context = useContext(SafetyContext);
  if (context === undefined) {
    throw new Error('useSafety must be used within a SafetyProvider');
  }
  return context;
}
