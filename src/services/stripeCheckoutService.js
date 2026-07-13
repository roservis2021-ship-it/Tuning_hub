function resolveApiBaseUrl() {
  const configuredUrl = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/$/, '');

  if (configuredUrl) {
    return configuredUrl;
  }

  if (typeof window !== 'undefined') {
    const isLocalHost = ['localhost', '127.0.0.1', '::1'].includes(window.location.hostname);

    if (isLocalHost) {
      return 'http://127.0.0.1:8787';
    }
  }

  return '';
}

const API_BASE_URL = resolveApiBaseUrl();

async function getAuthHeaders(includeContentType = false) {
  const user = auth.currentUser;
  return {
    ...(includeContentType ? { 'Content-Type': 'application/json' } : {}),
    ...(user ? { Authorization: `Bearer ${await user.getIdToken()}` } : {}),
  };
}

export async function createCheckoutSession({ vehicleName, buildId, checkoutType = 'plan_action' }) {
  const response = await fetch(`${API_BASE_URL}/api/create-checkout-session`, {
    method: 'POST',
    headers: await getAuthHeaders(true),
    body: JSON.stringify({
      origin: window.location.origin,
      vehicleName,
      buildId,
      checkoutType,
    }),
  });

  const responseText = await response.text();
  let payload = null;

  if (responseText) {
    try {
      payload = JSON.parse(responseText);
    } catch (error) {
      throw new Error('El backend no devolvio una respuesta valida de Stripe.');
    }
  }

  if (!response.ok) {
    throw new Error(payload?.error || 'No se pudo iniciar el pago con Stripe.');
  }

  if (!payload?.url) {
    throw new Error('Stripe no devolvio una URL de pago.');
  }

  return payload;
}

export async function createEmbeddedCheckoutSession({ vehicleName, buildId, checkoutType = 'plan_action' }) {
  const response = await fetch(`${API_BASE_URL}/api/create-embedded-checkout-session`, {
    method: 'POST',
    headers: await getAuthHeaders(true),
    body: JSON.stringify({
      origin: window.location.origin,
      vehicleName,
      buildId,
      checkoutType,
    }),
  });

  const responseText = await response.text();
  let payload = null;

  if (responseText) {
    try {
      payload = JSON.parse(responseText);
    } catch (error) {
      throw new Error('El backend no devolvio una respuesta valida de Stripe.');
    }
  }

  if (!response.ok) {
    throw new Error(payload?.error || 'No se pudo iniciar el pago integrado con Stripe.');
  }

  if (!payload?.clientSecret) {
    throw new Error('Stripe no devolvio el client secret de pago.');
  }

  return payload;
}

export async function getCheckoutSessionStatus(sessionId, claimToken = '') {
  const response = await fetch(
    `${API_BASE_URL}/api/checkout-session-status?session_id=${encodeURIComponent(sessionId)}&claim_token=${encodeURIComponent(claimToken)}`,
    { headers: await getAuthHeaders() },
  );

  const responseText = await response.text();
  let payload = null;

  if (responseText) {
    try {
      payload = JSON.parse(responseText);
    } catch (error) {
      throw new Error('El backend no devolvio una verificacion valida de Stripe.');
    }
  }

  if (!response.ok) {
    throw new Error(payload?.error || 'No se pudo verificar el pago.');
  }

  return payload;
}

export async function claimPremiumPurchase({ purchaseId, claimToken }) {
  const user = auth.currentUser;
  if (!user) throw new Error('Crea una cuenta o inicia sesión para activar Premium.');
  const response = await fetch(`${API_BASE_URL}/api/premium/claim-purchase`, {
    method: 'POST', headers: await getAuthHeaders(true), body: JSON.stringify({ purchaseId, claimToken }),
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok) throw new Error(payload?.error || 'No se pudo vincular la compra a tu cuenta.');
  return payload;
}
import { auth } from '../firebase/config';
