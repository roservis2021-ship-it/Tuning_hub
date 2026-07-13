import type { EntityMetadata } from './common';

export interface DiagnosticEvidence extends EntityMetadata {
  ownerId: string;
  userVehicleId: string;
  diagnosticSessionId: string;
  type: 'image' | 'audio' | 'document' | 'obd_snapshot' | 'text';
  purpose: string;
  storagePath?: string;
  contentType?: string;
  sizeBytes?: number;
  durationSeconds?: number;
  checksum?: string;
  textContent?: string;
  uploadStatus: 'pending' | 'uploaded' | 'failed' | 'deleted';
  analysisStatus: 'not_requested' | 'queued' | 'processing' | 'completed' | 'failed';
  retentionClass: 'project' | 'temporary' | 'legal';
  deletedAt?: Date;
}
