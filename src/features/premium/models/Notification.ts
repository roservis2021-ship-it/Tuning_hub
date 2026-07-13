import type { EntityMetadata } from './common';

export type NotificationCategory = 'maintenance' | 'research' | 'diagnostics' | 'vehicle_alerts';
export type NotificationChannel = 'in_app' | 'push' | 'email';
export type NotificationEventType = 'maintenance_mileage_upcoming' | 'maintenance_date_upcoming' | 'maintenance_overdue' | 'vehicle_research_completed' | 'diagnostic_available' | 'important_vehicle_alert';

export interface NotificationPreferences extends EntityMetadata {
  ownerId: string;
  timezone: string;
  categories: Record<NotificationCategory, boolean>;
  channels: Record<NotificationChannel, boolean>;
  quietHours?: { start: string; end: string };
}

export interface UserNotification extends EntityMetadata {
  ownerId: string; category: NotificationCategory; type: NotificationEventType;
  title: string; body: string; deepLink?: string; relatedEntityType: string; relatedEntityId: string;
  readAt?: Date; expiresAt?: Date;
}

export interface NotificationDelivery extends EntityMetadata {
  ownerId: string; notificationId: string; channel: NotificationChannel; deduplicationKey: string;
  status: 'pending' | 'sent' | 'retry' | 'failed' | 'skipped'; attemptCount: number;
  nextAttemptAt?: Date; sentAt?: Date; lastErrorCode?: string;
}
