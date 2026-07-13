import type { EntityMetadata } from './common';

export interface Subscription extends EntityMetadata {
  userId: string;
  type: 'premium_project' | 'premium_subscription' | 'extra_build';
  billingMode: 'one_time' | 'subscription';
  status: 'active' | 'pending' | 'past_due' | 'expired' | 'revoked' | 'cancelled';
  sourcePurchaseId: string;
  projectId?: string;
  userVehicleId?: string;
  startsAt: Date;
  expiresAt?: Date;
  usageLimits: Readonly<Record<string, number>>;
  usageCounters: Readonly<Record<string, number>>;
}
