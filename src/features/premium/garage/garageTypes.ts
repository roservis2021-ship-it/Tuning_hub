export type GarageModuleId = 'vehicle' | 'maintenance' | 'modifications' | 'issues' | 'advisor';
export type GarageViewState = 'loading' | 'no_vehicle' | 'research_pending' | 'incomplete' | 'ready';

export interface GarageVehicleIdentity {
  id?: string;
  brand: string;
  model: string;
  generation: string;
  variant: string;
  year?: number;
  mileageKm?: number;
  market?: string;
  imageUrl?: string;
  variantResolutionStatus: 'unresolved' | 'probable' | 'confirmed' | 'rejected';
  profileCompleteness: number;
}

export interface GarageModuleDefinition {
  id: GarageModuleId;
  label: string;
  shortLabel: string;
  icon: string;
}

export interface GarageData {
  activeVehicle: GarageVehicleIdentity | null;
  loading: boolean;
}
