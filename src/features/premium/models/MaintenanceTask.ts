import type { EntityMetadata } from './common';

export type MaintenanceTaskStatus = 'up_to_date' | 'upcoming' | 'overdue' | 'urgent' | 'insufficient_information';

export interface MaintenanceReminderSettings {
  byTime: boolean;
  byMileage: boolean;
  nextReminderAt?: Date;
  nextReminderMileageKm?: number;
}

export interface MaintenanceTask extends EntityMetadata {
  ownerId: string;
  userVehicleId: string;
  maintenanceDefinitionId: string;
  title: string;
  intervalKm?: number;
  intervalMonths?: number;
  severity: 'routine' | 'important' | 'critical';
  status: MaintenanceTaskStatus;
  lastPerformedAt?: Date;
  lastPerformedMileageKm?: number;
  nextDueAt?: Date;
  nextDueMileageKm?: number;
  reminder: MaintenanceReminderSettings;
  recommendationStatus: 'approved_definition' | 'pending_review';
  adaptationReasons: string[];
}
