import { z } from 'zod';
import { auth } from '../../../firebase/config';
import { premiumOnboardingSchema, type PremiumOnboardingInput } from './onboardingSchema';

const responseSchema = z.object({ userVehicleId: z.string().min(1), projectId: z.string().min(1), status: z.literal('preparing') }).strict();

function resolveApiBaseUrl(): string {
  const configured = String(import.meta.env.VITE_API_BASE_URL ?? '').replace(/\/$/, '');
  if (typeof window !== 'undefined' && ['localhost', '127.0.0.1', '::1'].includes(window.location.hostname)) return 'http://127.0.0.1:8787';
  return configured;
}

export async function submitPremiumOnboarding(input: PremiumOnboardingInput) {
  const user = auth.currentUser;
  if (!user) throw new Error('La sesión ha caducado. Inicia sesión de nuevo.');
  const validated = premiumOnboardingSchema.parse(input);
  const response = await fetch(`${resolveApiBaseUrl()}/api/premium/onboarding`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${await user.getIdToken()}` },
    body: JSON.stringify(validated),
  });
  const payload: unknown = await response.json();
  if (!response.ok) {
    const message = typeof payload === 'object' && payload !== null && 'error' in payload ? String(payload.error) : 'No se pudo preparar el garaje.';
    throw new Error(message);
  }
  return responseSchema.parse(payload);
}
