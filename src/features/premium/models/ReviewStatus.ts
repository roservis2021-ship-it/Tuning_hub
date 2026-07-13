export type ReviewStatus =
  | 'draft'
  | 'ai_draft'
  | 'in_review'
  | 'changes_requested'
  | 'approved'
  | 'rejected'
  | 'published'
  | 'archived'
  | 'superseded';

export type ConfidenceLevel = 'unverified' | 'low' | 'medium' | 'high' | 'verified';

export interface ConfidenceAssessment {
  level: ConfidenceLevel;
  rationale: string;
  assessedBy: 'ai' | 'editor' | 'source_import' | 'system';
  assessedAt: Date;
}
