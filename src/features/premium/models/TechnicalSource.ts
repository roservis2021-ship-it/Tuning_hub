import type { EntityMetadata } from './common';

export interface TechnicalSource extends EntityMetadata {
  title: string;
  type: 'manufacturer_manual' | 'parts_catalogue' | 'regulation' | 'technical_database' | 'specialist' | 'community_forum' | 'other';
  publisher?: string;
  url?: string;
  documentStoragePath?: string;
  market?: string;
  publishedAt?: Date;
  accessedAt: Date;
  status: 'pending_review' | 'accepted' | 'rejected' | 'archived';
  notes?: string;
  connectorId?: string;
  trustTier?: 'primary' | 'secondary' | 'community';
  reviewedBy?: string;
  reviewedAt?: Date;
}
