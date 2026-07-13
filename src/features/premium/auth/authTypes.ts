import type { User } from 'firebase/auth';
import type { UserProfile } from '../models';

export type AuthStatus = 'loading' | 'authenticated' | 'unauthenticated' | 'error';
export type AccessStatus = 'loading' | 'free' | 'premium' | 'error';
export type AdminRole = 'admin' | 'editor' | 'reviewer';

export interface AuthSession {
  user: User | null;
  profile: UserProfile | null;
  authStatus: AuthStatus;
  accessStatus: AccessStatus;
  roles: AdminRole[];
  subscriptionType: 'premium_project' | 'premium_subscription' | 'extra_build' | null;
  subscriptionExpiresAt: Date | null;
  error: string | null;
}

export interface AuthCredentials {
  email: string;
  password: string;
}

export interface RegistrationInput extends AuthCredentials {
  displayName: string;
}
