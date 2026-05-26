import React, { createContext, useContext, useState, useEffect } from 'react';
import { vehicleService } from '@/services/vehicle.service';
import { useAuth } from './AuthContext';
import { VehicleResponseDto, VehicleFeatureDto, VehiclePhotoDto, VehiclePreferenceDto } from '@/utils/types';

interface VehicleContextType {
  vehicles: VehicleResponseDto[];
  isLoading: boolean;
  fetchMyVehicles: () => Promise<void>;
  getVehicleById: (id: string) => Promise<VehicleResponseDto | null>;
  createVehicle: (data: any) => Promise<string | null>;
  updateVehicle: (id: string, data: any) => Promise<boolean>;
  deleteVehicle: (id: string) => Promise<boolean>;
  setDefaultVehicle: (id: string) => Promise<boolean>;
  getVehicleFeatures: (vehicleId: string) => Promise<VehicleFeatureDto[]>;
  getVehiclePhotos: (vehicleId: string) => Promise<VehiclePhotoDto[]>;
  getVehiclePreferences: (vehicleId: string) => Promise<VehiclePreferenceDto | null>;
}

const VehicleContext = createContext<VehicleContextType | undefined>(undefined);

export function VehicleProvider({ children }: { children: React.ReactNode }) {
  const [vehicles, setVehicles] = useState<VehicleResponseDto[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const { user } = useAuth();

  useEffect(() => {
    if (user?.role === 'Driver' || user?.role === 'Admin') {
      fetchMyVehicles();
    }
  }, [user]);

  const fetchMyVehicles = async () => {
    try {
      setIsLoading(true);
      const data = await vehicleService.getMyVehicles();
      setVehicles(data);
    } catch (e) {
      console.error('Error fetching vehicles:', e);
    } finally {
      setIsLoading(false);
    }
  };

  const getVehicleById = async (id: string) => {
    try {
      return await vehicleService.getById(id);
    } catch (e) {
      return null;
    }
  };

  const createVehicle = async (data: any) => {
    try {
      const id = await vehicleService.createVehicle(data);
      await fetchMyVehicles();
      return id;
    } catch (e) {
      return null;
    }
  };

  const updateVehicle = async (id: string, data: any) => {
    try {
      await vehicleService.updateVehicle(id, data);
      await fetchMyVehicles();
      return true;
    } catch (e) {
      return false;
    }
  };

  const deleteVehicle = async (id: string) => {
    try {
      await vehicleService.deleteVehicle(id);
      await fetchMyVehicles();
      return true;
    } catch (e) {
      return false;
    }
  };

  const setDefaultVehicle = async (id: string) => {
    try {
      await vehicleService.setDefault(id);
      await fetchMyVehicles();
      return true;
    } catch (e) {
      return false;
    }
  };

  const getVehicleFeatures = async (vehicleId: string) => {
    try {
      return await vehicleService.getFeatures(vehicleId);
    } catch (e) {
      return [];
    }
  };

  const getVehiclePhotos = async (vehicleId: string) => {
    try {
      return await vehicleService.getPhotos(vehicleId);
    } catch (e) {
      return [];
    }
  };

  const getVehiclePreferences = async (vehicleId: string) => {
    try {
      return await vehicleService.getPreferences(vehicleId);
    } catch (e) {
      return null;
    }
  };

  return (
    <VehicleContext.Provider value={{ 
      vehicles, 
      isLoading, 
      fetchMyVehicles, 
      getVehicleById, 
      createVehicle, 
      updateVehicle, 
      deleteVehicle, 
      setDefaultVehicle,
      getVehicleFeatures,
      getVehiclePhotos,
      getVehiclePreferences
    }}>
      {children}
    </VehicleContext.Provider>
  );
}

export function useVehicles() {
  const context = useContext(VehicleContext);
  if (context === undefined) {
    throw new Error('useVehicles must be used within a VehicleProvider');
  }
  return context;
}
