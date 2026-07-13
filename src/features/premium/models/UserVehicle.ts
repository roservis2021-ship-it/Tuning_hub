import type { EntityMetadata, PowerProfile } from './common';

export interface VehicleIdentitySnapshot {
  brand: string;
  model: string;
  generation: string;
  variant: string;
  market?: string;
  engineCode?: string;
  transmissionCode?: string;
}

export interface UserVehicle extends EntityMetadata {
  ownerId: string;
  variantId?: string;
  variantSnapshot: VehicleIdentitySnapshot;
  variantResolutionStatus: 'unresolved' | 'probable' | 'confirmed' | 'rejected';
  nickname?: string;
  year: number;
  mileageKm: number;
  color?: string;
  protectedVinReference?: string;
  registrationCountry?: string;
  primaryUse: 'daily' | 'weekend' | 'track' | 'competition' | 'show' | 'mixed';
  condition: 'unknown' | 'needs_inspection' | 'service_due' | 'good' | 'project';
  power: PowerProfile;
  currentGoalId?: string;
  activeProjectId?: string;
  researchJobId?: string;
  profileCompleteness: number;
  archivedAt?: Date;
}
