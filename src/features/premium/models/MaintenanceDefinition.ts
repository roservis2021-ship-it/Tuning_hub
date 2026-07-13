import type { EntityMetadata, Money, TechnicalProvenance } from './common';

export interface MaintenanceDefinition extends EntityMetadata {
  title: string;
  description: string;
  applicableVariantIds: string[];
  applicableEngineIds: string[];
  intervalKm?: number;
  intervalMonths?: number;
  severity: 'routine' | 'important' | 'critical';
  estimatedCost?: Money;
  prerequisiteForModificationIds: string[];
  provenance: TechnicalProvenance;
}
