import type { EntityMetadata, TechnicalProvenance } from './common';

export interface EngineOilSpecification {
  recommendedViscosity?: string;
  capacityLitres?: number;
  approvals?: string[];
}

export interface EngineMaster extends EntityMetadata {
  manufacturer: string;
  code: string;
  family?: string;
  fuel: 'petrol' | 'diesel' | 'hybrid' | 'electric' | 'other';
  induction: 'naturally_aspirated' | 'turbo' | 'supercharged' | 'twincharged' | 'electric';
  displacementCc?: number;
  cylinders?: number;
  stockPowerCv?: number;
  stockTorqueNm?: number;
  markets: string[];
  productionStartYear?: number;
  productionEndYear?: number;
  documentedLimitNotes?: string;
  architecture?: string;
  injection?: string;
  timingSystem?: string;
  ecu?: string;
  oil?: EngineOilSpecification;
  provenance: TechnicalProvenance;
}
