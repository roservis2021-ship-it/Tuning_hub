import type { ConfidenceAssessment, ReviewStatus } from './ReviewStatus';
import type { EntityMetadata } from './common';

export interface ResearchJob extends EntityMetadata {
  ownerId?: string;
  ownerIds?: string[];
  projectId?: string;
  projectIds?: string[];
  userVehicleId?: string;
  userVehicleIds?: string[];
  purpose: 'premium_plan' | 'diagnostic_assessment' | 'advisor_reply' | 'master_data_research';
  targetType: string;
  targetId: string;
  model?: string;
  promptVersion?: string;
  contextHash: string;
  status: 'queued' | 'running' | 'validating' | 'completed' | 'failed' | 'cancelled';
  sourceIds: string[];
  confidence?: ConfidenceAssessment;
  reviewStatus: ReviewStatus;
  errorCode?: string;
  startedAt?: Date;
  completedAt?: Date;
  stage?: 'queued' | 'normalizing' | 'identifying' | 'ambiguity_check' | 'collecting_sources' | 'contrasting' | 'structuring' | 'persisting_sources' | 'scoring_confidence' | 'detecting_contradictions' | 'awaiting_human_review' | 'approved' | 'publishing' | 'published' | 'failed';
  normalizedRequest?: VehicleResearchRequest;
  ambiguities?: ResearchAmbiguity[];
  resultId?: string;
  reviewTaskId?: string;
  connectorIds?: string[];
  reopenCount?: number;
  collectedSourceCount?: number;
  excludedClaimCount?: number;
  contradictionCount?: number;
  publishedRevisionId?: string;
  reviewedBy?: string;
  reviewedAt?: Date;
  errorMessage?: string;
}

export interface ResearchAmbiguity { field: string; severity: 'high' | 'critical'; message: string; }
export interface VehicleResearchRequest {
  brand: string; model: string; generation: string; variant: string; year: number | null; market: string;
  engineCode: string; transmissionCode: string; lookupKey: string; precision: 'exact' | 'probable' | 'ambiguous'; ambiguities: ResearchAmbiguity[];
}
