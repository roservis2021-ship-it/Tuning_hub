import type { EntityMetadata, Money } from './common';

export interface MaintenancePart {
  name: string;
  manufacturer?: string;
  partNumber?: string;
  quantity?: number;
}

export interface MaintenanceRecord extends EntityMetadata {
  ownerId: string;
  userVehicleId: string;
  maintenanceDefinitionId?: string;
  type: 'service' | 'inspection' | 'repair' | 'replacement' | 'other';
  title: string;
  performedAt: Date;
  mileageKm?: number;
  workshop?: string;
  cost?: Money;
  parts: MaintenancePart[];
  notes?: string;
  sourceMediaIds: string[];
  verificationStatus: 'user_declared' | 'documented' | 'professional_verified';
}
