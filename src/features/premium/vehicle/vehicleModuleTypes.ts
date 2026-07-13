import type { GarageVehicleIdentity } from '../garage/garageTypes';

export type TechnicalFieldStatus = 'confirmed' | 'declared' | 'pending';

export interface VehicleTechnicalField {
  key: string;
  label: string;
  value?: string | number | string[];
  unit?: string;
  status: TechnicalFieldStatus;
}

export interface VehicleTechnicalCard {
  id: string;
  title: string;
  description: string;
  fields: VehicleTechnicalField[];
  defaultOpen?: boolean;
}

export interface VehicleModuleData {
  vehicle: GarageVehicleIdentity;
  highlights: VehicleTechnicalField[];
  cards: VehicleTechnicalCard[];
  sourceCount: number;
  masterDataConfirmed: boolean;
}
