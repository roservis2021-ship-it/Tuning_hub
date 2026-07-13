import type { AccessStatus, AdminRole, AuthStatus } from './authTypes';

export type ProtectedArea = 'authenticated' | 'premium' | 'admin';
export type RouteDecision = 'loading' | 'sign_in' | 'subscription_required' | 'forbidden' | 'allow' | 'error';

export interface RouteAccessInput {
  area: ProtectedArea;
  authStatus: AuthStatus;
  accessStatus: AccessStatus;
  roles: AdminRole[];
  requiredRole?: AdminRole;
}

export function decideRouteAccess(input: RouteAccessInput): RouteDecision {
  if (input.authStatus === 'loading' || (input.authStatus === 'authenticated' && input.accessStatus === 'loading')) return 'loading';
  if (input.authStatus === 'error' || input.accessStatus === 'error') return 'error';
  if (input.authStatus === 'unauthenticated') return 'sign_in';

  if (input.area === 'authenticated') return 'allow';
  if (input.area === 'premium') return input.accessStatus === 'premium' ? 'allow' : 'subscription_required';

  const requiredRole = input.requiredRole ?? 'admin';
  return input.roles.includes(requiredRole) ? 'allow' : 'forbidden';
}
