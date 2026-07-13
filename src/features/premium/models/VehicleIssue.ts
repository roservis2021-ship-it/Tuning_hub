import type { EntityMetadata, TechnicalProvenance } from './common';

export interface VehicleIssue extends EntityMetadata {
  scope: 'master_known_issue' | 'user_vehicle_issue';
  ownerId?: string;
  userVehicleId?: string;
  applicableVariantIds: string[];
  title: string;
  symptoms: string[];
  possibleCauses: string[];
  severity: 'low' | 'medium' | 'high' | 'safety_critical';
  status: 'known' | 'suspected' | 'monitoring' | 'resolved' | 'workshop_required';
  obdCodes: string[];
  provenance: TechnicalProvenance;
}
