import type { ConfidenceAssessment, ReviewStatus } from './ReviewStatus';
import type { EntityMetadata, Money } from './common';

export interface InstalledModification extends EntityMetadata {
  ownerId: string;
  userVehicleId: string;
  modificationId?: string;
  customName?: string;
  manufacturer?: string;
  partNumber?: string;
  installedAt?: Date;
  mileageKm?: number;
  installedBy?: string;
  cost?: Money;
  tuneRequired: boolean;
  tuneDetails?: string;
  estimatedPowerAfterCv?: number;
  userDeclaredPowerAfterCv?: number;
  homologationStatus: 'not_required' | 'pending' | 'approved' | 'rejected' | 'unknown';
  documentMediaIds: string[];
  compatibilityStatus: 'confirmed' | 'probable' | 'incompatible' | 'unknown';
  confidence: ConfidenceAssessment;
  reviewStatus: ReviewStatus;
  active: boolean;
}
