import React, { createContext, useContext } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { vehicleKeys, invalidateVehicles } from '@/hooks/useVehicles';
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
  const { user } = useAuth();
  const queryClient = useQueryClient();

  // Same `vehicles` cache root as the vehicle manager and the Offer Ride form,
  // so a change made on any of them refreshes this list too.
  const vehiclesQuery = useQuery({
    queryKey: vehicleKeys.raw,
    queryFn: async () => {
      try {
        return await vehicleService.getMyVehicles();
      } catch (e) {
        console.error('Error fetching vehicles:', e);
        throw e;
      }
    },
    enabled: user?.role === 'Driver' || user?.role === 'Admin',
  });
  const vehicles: VehicleResponseDto[] = vehiclesQuery.data ?? [];
  const isLoading = vehiclesQuery.isFetching;

  const fetchMyVehicles = async () => {
    await vehiclesQuery.refetch();
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
      await invalidateVehicles(queryClient);
      return id;
    } catch (e) {
      return null;
    }
  };

  const updateVehicle = async (id: string, data: any) => {
    try {
      await vehicleService.updateVehicle(id, data);
      await invalidateVehicles(queryClient);
      return true;
    } catch (e) {
      return false;
    }
  };

  const deleteVehicle = async (id: string) => {
    try {
      await vehicleService.deleteVehicle(id);
      await invalidateVehicles(queryClient);
      return true;
    } catch (e) {
      return false;
    }
  };

  const setDefaultVehicle = async (id: string) => {
    try {
      await vehicleService.setDefault(id);
      await invalidateVehicles(queryClient);
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
