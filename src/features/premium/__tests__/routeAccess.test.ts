import { describe, expect, it } from 'vitest';
import { decideRouteAccess } from '../auth/routeAccess';

describe('protected route decisions', () => {
  it('waits while Firebase restores the session', () => {
    expect(decideRouteAccess({ area: 'premium', authStatus: 'loading', accessStatus: 'loading', roles: [] })).toBe('loading');
  });

  it('requires authentication before Premium access', () => {
    expect(decideRouteAccess({ area: 'premium', authStatus: 'unauthenticated', accessStatus: 'free', roles: [] })).toBe('sign_in');
  });

  it('allows an authenticated free user to enter checkout without granting Premium', () => {
    expect(decideRouteAccess({ area: 'authenticated', authStatus: 'authenticated', accessStatus: 'free', roles: [] })).toBe('allow');
  });

  it('does not treat an authenticated free user as Premium', () => {
    expect(decideRouteAccess({ area: 'premium', authStatus: 'authenticated', accessStatus: 'free', roles: [] })).toBe('subscription_required');
  });

  it('allows a server-verified Premium session', () => {
    expect(decideRouteAccess({ area: 'premium', authStatus: 'authenticated', accessStatus: 'premium', roles: [] })).toBe('allow');
  });

  it('does not grant administration to Premium users', () => {
    expect(decideRouteAccess({ area: 'admin', authStatus: 'authenticated', accessStatus: 'premium', roles: [] })).toBe('forbidden');
  });

  it('requires the exact administrative role', () => {
    expect(decideRouteAccess({ area: 'admin', requiredRole: 'reviewer', authStatus: 'authenticated', accessStatus: 'free', roles: ['editor'] })).toBe('forbidden');
    expect(decideRouteAccess({ area: 'admin', requiredRole: 'reviewer', authStatus: 'authenticated', accessStatus: 'free', roles: ['reviewer'] })).toBe('allow');
  });

  it('surfaces entitlement verification failures', () => {
    expect(decideRouteAccess({ area: 'premium', authStatus: 'authenticated', accessStatus: 'error', roles: [] })).toBe('error');
  });
});
