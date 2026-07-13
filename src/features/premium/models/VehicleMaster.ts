import type { EntityMetadata, PowerProfile, TechnicalProvenance } from './common';

export interface VehicleSuspensionSpecification { front?: string; rear?: string; }
export interface VehicleBrakeSpecification { front?: string; rear?: string; }
export interface VehicleWheelFitment {
  pcd?: string;
  hubBoreMm?: number;
  offsetRange?: string;
  compatibleSizes?: string[];
}

export interface VehicleMaster extends EntityMetadata {
  brandId: string;
  modelId: string;
  generationId: string;
  engineId: string;
  transmissionId?: string;
  displayName: string;
  market: string;
  productionStartYear: number;
  productionEndYear?: number;
  bodyStyle?: string;
  driveLayout?: 'fwd' | 'rwd' | 'awd' | '4wd';
  power: Pick<PowerProfile, 'stockPowerCv'>;
  stockTorqueNm?: number;
  chassisCode?: string;
  suspension?: VehicleSuspensionSpecification;
  brakes?: VehicleBrakeSpecification;
  wheelFitment?: VehicleWheelFitment;
  strengths?: string[];
  weaknesses?: string[];
  knownRiskIds?: string[];
  tuningHubRating?: number;
  normalizedLookupKey?: string;
  provenance: TechnicalProvenance;
}
