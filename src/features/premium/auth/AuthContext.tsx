import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { User } from 'firebase/auth';
import { auth as firebaseAuth } from '../../../firebase/config';
import type { UserProfile } from '../models';
import { configureAuthPersistence, loadTrustedSession, logoutAccount, observeAuth } from './authService';
import type { AccessStatus, AdminRole, AuthSession, AuthStatus } from './authTypes';

interface AuthContextValue extends AuthSession {
  refreshAccess(): Promise<void>;
  logout(): Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

const initialSession: AuthSession = {
  user: null, profile: null, authStatus: 'loading', accessStatus: 'loading', roles: [],
  subscriptionType: null, subscriptionExpiresAt: null, error: null,
};

function toProfile(profile: Awaited<ReturnType<typeof loadTrustedSession>>['profile']): UserProfile | null {
  if (!profile) return null;
  const { createdAt, updatedAt, lastSeenAt, ...rest } = profile;
  return {
    ...rest,
    createdAt: new Date(createdAt),
    updatedAt: new Date(updatedAt),
    ...(lastSeenAt ? { lastSeenAt: new Date(lastSeenAt) } : {}),
  };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<AuthSession>(initialSession);

  const resolveAccess = useCallback(async (user: User) => {
    setSession((current) => ({ ...current, user, authStatus: 'authenticated', accessStatus: 'loading', error: null }));
    try {
      const trusted = await loadTrustedSession(user);
      setSession({
        user, profile: toProfile(trusted.profile), authStatus: 'authenticated', accessStatus: trusted.entitlement ? 'premium' : 'free',
        roles: trusted.roles, subscriptionType: trusted.entitlement?.type ?? null,
        subscriptionExpiresAt: trusted.entitlement?.expiresAt ? new Date(trusted.entitlement.expiresAt) : null, error: null,
      });
    } catch (error) {
      setSession((current) => ({ ...current, authStatus: 'authenticated', accessStatus: 'error', error: error instanceof Error ? error.message : 'No se pudo comprobar el acceso.' }));
    }
  }, []);

  useEffect(() => {
    let unsubscribe = (): void => undefined;
    let active = true;
    configureAuthPersistence()
      .catch(() => undefined)
      .finally(() => {
        if (!active) return;
        unsubscribe = observeAuth((user) => {
          if (!user) {
            setSession({ ...initialSession, authStatus: 'unauthenticated', accessStatus: 'free' });
            return;
          }
          void resolveAccess(user);
        });
      });
    return () => { active = false; unsubscribe(); };
  }, [resolveAccess]);

  const refreshAccess = useCallback(async () => {
    const currentUser = session.user ?? firebaseAuth.currentUser;
    if (currentUser) await resolveAccess(currentUser);
  }, [resolveAccess, session.user]);

  const logout = useCallback(async () => { await logoutAccount(); }, []);
  const value = useMemo(() => ({ ...session, refreshAccess, logout }), [session, refreshAccess, logout]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used inside AuthProvider');
  return context;
}

export type { AccessStatus, AdminRole, AuthStatus };
