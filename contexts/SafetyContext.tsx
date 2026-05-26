import React, { createContext, useContext, useState, useEffect } from 'react';
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
  const [contacts, setContacts] = useState<EmergencyContactDto[]>([]);
  const [incidents, setIncidents] = useState<SafetyIncidentDto[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const { user } = useAuth();

  useEffect(() => {
    if (user) {
      fetchContacts();
      fetchIncidents();
    }
  }, [user]);

  const fetchContacts = async () => {
    try {
      setIsLoading(true);
      const data = await safetyService.getEmergencyContacts();
      setContacts(data);
    } catch (e) {
      console.error('Error fetching contacts:', e);
    } finally {
      setIsLoading(false);
    }
  };

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
      await fetchContacts();
      return id;
    } catch (e) {
      return null;
    }
  };

  const deleteContact = async (id: string) => {
    try {
      await safetyService.deleteEmergencyContact(id);
      await fetchContacts();
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
