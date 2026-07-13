import type { ConfidenceAssessment, ReviewStatus } from './ReviewStatus';
import type { EntityMetadata } from './common';

export type VehicleResearchCategory = 'identification' | 'engine' | 'transmission' | 'chassis' | 'brakes' | 'wheels' | 'tyres' | 'fluids' | 'maintenance' | 'strengths' | 'weaknesses' | 'issues' | 'risks' | 'modifications' | 'compatibilities' | 'reasonable_limits' | 'year_market_differences';
export type TechnicalClaimValue = string | number | boolean | string[] | number[];

export interface TechnicalClaim extends EntityMetadata {
  entityType: 'vehicle_master'; entityKey: string; category: VehicleResearchCategory; fieldPath: string;
  value: TechnicalClaimValue; unit?: string; scope: { generation: string; market: string; year: number | null; engineCode: string };
  sourceIds: string[]; confidence: ConfidenceAssessment; contradictionIds: string[]; reviewStatus: ReviewStatus;
  reviewedBy?: string; reviewedAt?: Date;
}

export interface ResearchContradiction extends EntityMetadata {
  jobLookupKey: string; fieldKey: string; values: { value: string; sourceKeys: string[] }[];
  status: 'open' | 'resolved' | 'accepted_difference'; detectedAt: Date; resolvedBy?: string; resolvedAt?: Date; resolution?: string;
}

export interface ResearchReviewTask extends EntityMetadata {
  type: 'vehicle_research'; jobId: string; resultId: string; status: 'open' | 'approved' | 'changes_requested' | 'rejected';
  priority: 'normal' | 'high'; ambiguityCount: number; contradictionCount: number; blockingIssueCount: number;
  requiredRole: 'reviewer'; reviewedBy?: string; reviewedAt?: Date; decisionNotes?: string;
}

export interface PublishedResearchRevision extends EntityMetadata {
  entityType: 'vehicle_research'; entityKey: string; jobId: string; resultId: string; claimIds: string[]; sourceIds: string[];
  status: 'published' | 'superseded' | 'withdrawn'; publishedBy: string; publishedAt: Date;
}

export interface VehicleResearchResult extends EntityMetadata {
  jobId: string; normalizedRequest: import('./ResearchJob').VehicleResearchRequest; claimIds: string[]; sourceIds: string[]; contradictionIds: string[];
  excludedClaims: { sourceKey: string; category: VehicleResearchCategory; fieldPath: string; reason: 'scope_mismatch' }[];
  blockingIssues: string[]; categories: VehicleResearchCategory[]; status: 'awaiting_human_review' | 'approved' | 'published';
  reviewedBy?: string; reviewedAt?: Date; publishedRevisionId?: string;
}
