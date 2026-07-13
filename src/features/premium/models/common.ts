import type { ConfidenceAssessment, ReviewStatus } from './ReviewStatus';

export interface EntityMetadata {
  id: string;
  schemaVersion: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface TechnicalProvenance {
  sourceIds: string[];
  confidence: ConfidenceAssessment;
  reviewStatus: ReviewStatus;
  researchedAt?: Date;
  reviewedAt?: Date;
  reviewedBy?: string;
}

export interface PowerProfile {
  stockPowerCv?: number;
  estimatedPowerCv?: number;
  userDeclaredPowerCv?: number;
}

export interface Money {
  amount: number;
  currency: string;
}
