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

export async function createCheckoutSession({ vehicleName, buildId }) {
  const response = await fetch(`${API_BASE_URL}/api/create-checkout-session`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      origin: window.location.origin,
      vehicleName,
      buildId,
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

export async function createEmbeddedCheckoutSession({ vehicleName, buildId }) {
  const response = await fetch(`${API_BASE_URL}/api/create-embedded-checkout-session`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      origin: window.location.origin,
      vehicleName,
      buildId,
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

export async function getCheckoutSessionStatus(sessionId) {
  const response = await fetch(
    `${API_BASE_URL}/api/checkout-session-status?session_id=${encodeURIComponent(sessionId)}`,
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
