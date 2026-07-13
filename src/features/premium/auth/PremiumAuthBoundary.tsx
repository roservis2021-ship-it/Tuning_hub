import type { ReactNode } from 'react';
import { AuthProvider } from './AuthContext';

export function PremiumAuthBoundary({ children }: { children: ReactNode }) {
  return <AuthProvider>{children}</AuthProvider>;
}
