import type { EntityMetadata, Money, TechnicalProvenance } from './common';

export interface ModificationDefinition extends EntityMetadata {
  title: string;
  category: 'engine' | 'ecu' | 'intake_exhaust' | 'drivetrain' | 'chassis' | 'brakes' | 'wheels' | 'exterior' | 'interior';
  description: string;
  compatibleVariantIds: string[];
  prerequisiteModificationIds: string[];
  incompatibleModificationIds: string[];
  estimatedPowerGainCv?: { minimum: number; maximum: number };
  estimatedCost?: Money;
  legalImpact: 'none_known' | 'documentation' | 'homologation' | 'track_only' | 'unknown';
  riskLevel: 'low' | 'medium' | 'high' | 'specialist_required';
  applicableGoalTypes?: ('reliability' | 'street_performance' | 'aesthetic' | 'track' | 'custom')[];
  partsAndSpecifications?: string[];
  prerequisiteChecks?: string[];
  expectedResult?: string;
  estimatedTorqueGainNm?: { minimum: number; maximum: number };
  impacts?: {
    response?: string;
    cooling?: string;
    transmission?: string;
    reliability?: string;
  };
  technicalWarnings?: string[];
  provenance: TechnicalProvenance;
}
