import type { EntityMetadata, TechnicalProvenance } from './common';

export interface TransmissionMaster extends EntityMetadata {
  manufacturer: string;
  code: string;
  family?: string;
  type: 'manual' | 'automatic' | 'dct' | 'cvt';
  gears: number;
  driveLayout: 'fwd' | 'rwd' | 'awd' | '4wd';
  factoryTorqueRatingNm?: number;
  knownIssueIds: string[];
  serviceRequirementIds: string[];
  compatibleVariantIds: string[];
  provenance: TechnicalProvenance;
}
