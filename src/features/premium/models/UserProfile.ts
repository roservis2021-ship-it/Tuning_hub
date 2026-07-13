import type { EntityMetadata } from './common';

export interface UserProfile extends EntityMetadata {
  displayName: string;
  emailNormalized: string;
  locale: string;
  timezone: string;
  status: 'active' | 'disabled' | 'deleted';
  onboardingCompleted: boolean;
  lastSeenAt?: Date;
}
