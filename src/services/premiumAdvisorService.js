const PLAN_STORAGE_KEY = 'th-premium-advisor-plan';
import { auth } from '../firebase/config';

function resolveApiBaseUrl() {
  const configuredUrl = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/$/, '');
  if (globalThis.location && ['localhost', '127.0.0.1', '::1'].includes(globalThis.location.hostname)) return 'http://127.0.0.1:8787';
  if (configuredUrl) return configuredUrl;
  return '';
}

export function getStoredPremiumAdvisorPlan() {
  if (!globalThis.sessionStorage) return null;
  const uid = auth.currentUser?.uid;
  if (!uid) return null;
  try { return JSON.parse(globalThis.sessionStorage.getItem(`${PLAN_STORAGE_KEY}:${uid}`)); } catch { return null; }
}

async function getAuthorizedHeaders() {
  const user = auth.currentUser;
  if (!user) throw new Error('Inicia sesión para usar el especialista Premium.');
  return { 'Content-Type': 'application/json', Authorization: `Bearer ${await user.getIdToken()}` };
}

export async function generatePremiumAdvisorPlan({ vehicle, result, profile }) {
  const response = await globalThis.fetch(`${resolveApiBaseUrl()}/api/generate-premium-advisor-plan`, {
    method: 'POST',
    headers: await getAuthorizedHeaders(),
    body: JSON.stringify({
      vehicle: {
        brand: vehicle?.brand || result?.vehicleIdentity?.canonicalBrand,
        model: vehicle?.model || result?.vehicleIdentity?.canonicalModel,
        generation: vehicle?.generation || result?.vehicleIdentity?.canonicalGeneration,
        engine: vehicle?.engine || result?.vehicleIdentity?.canonicalEngine,
        powertrain: vehicle?.powertrain,
        aspiration: vehicle?.aspiration,
        transmission: vehicle?.transmission,
        drivetrain: vehicle?.drivetrain,
        basePowerCv: result?.basePowerCv,
        factoryTorqueNm: result?.vehicleIdentity?.factoryTorqueNm,
      },
      profile,
    }),
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok) throw new Error(payload?.error || 'No se pudo generar el análisis Premium.');
  const uid = auth.currentUser?.uid;
  if (uid) globalThis.sessionStorage.setItem(`${PLAN_STORAGE_KEY}:${uid}`, JSON.stringify(payload.plan));
  return payload.plan;
}

export async function askPremiumAdvisor({ vehicle, result, profile, plan, question, history }) {
  const response = await globalThis.fetch(`${resolveApiBaseUrl()}/api/premium-advisor-chat`, {
    method: 'POST', headers: await getAuthorizedHeaders(),
    body: JSON.stringify({
      vehicle: { brand: vehicle?.brand || result?.vehicleIdentity?.canonicalBrand, model: vehicle?.model || result?.vehicleIdentity?.canonicalModel, generation: vehicle?.generation || result?.vehicleIdentity?.canonicalGeneration, engine: vehicle?.engine || result?.vehicleIdentity?.canonicalEngine },
      profile, plan, question, history,
    }),
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok) throw new Error(payload?.error || 'El asesor no pudo responder.');
  return payload.answer;
}
