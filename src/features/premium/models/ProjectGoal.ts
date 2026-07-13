import type { EntityMetadata, Money } from './common';

export interface ProjectGoal extends EntityMetadata {
  ownerId: string;
  userVehicleId: string;
  type: 'reliability' | 'street_performance' | 'aesthetic' | 'track' | 'custom';
  title: string;
  targetPowerCv?: number;
  targetTorqueNm?: number;
  budget?: Money;
  targetDate?: Date;
  usageConstraints: string[];
  comfortPriority: number;
  legalRoadUseRequired: boolean;
  feasibility: 'pending_evaluation' | 'realistic' | 'conditional' | 'not_recommended';
  status: 'draft' | 'active' | 'completed' | 'abandoned';
}
