import type { EntityMetadata, Money, TechnicalProvenance } from './common';

export interface ModificationPlanStep {
  id: string;
  order: number;
  title: string;
  rationale: string;
  modificationDefinitionIds: string[];
  prerequisiteStepIds: string[];
  estimatedCost?: Money;
  estimatedPowerCv?: number;
  risks: string[];
  status: 'proposed' | 'approved' | 'in_progress' | 'completed' | 'skipped';
  provenance: TechnicalProvenance;
}

export interface ModificationPlan extends EntityMetadata {
  ownerId: string;
  projectId: string;
  userVehicleId: string;
  goalId: string;
  versionNumber: number;
  contextVersion: number;
  status: 'generating' | 'draft' | 'delivered' | 'superseded' | 'failed';
  generatedBy: 'ai' | 'human' | 'hybrid';
  researchJobId?: string;
  summary: string;
  steps: ModificationPlanStep[];
  deliveredAt?: Date;
}
