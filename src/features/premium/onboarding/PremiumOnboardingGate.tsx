import { useState, type ReactNode } from 'react';
import { useAuth } from '../auth/AuthContext';
import { PremiumOnboarding } from './PremiumOnboarding';

interface PremiumOnboardingGateProps {
  vehicle?: { brand?: string; model?: string; generation?: string; engine?: string; year?: string | number; mileageKm?: string | number } | null;
  children: ReactNode;
}

export function PremiumOnboardingGate({ vehicle, children }: PremiumOnboardingGateProps) {
  const { profile, refreshAccess } = useAuth();
  const [completed, setCompleted] = useState(false);
  if (profile?.onboardingCompleted || completed) return <>{children}</>;
  return <PremiumOnboarding initialVehicle={vehicle} onComplete={async () => { await refreshAccess(); setCompleted(true); }} />;
}
