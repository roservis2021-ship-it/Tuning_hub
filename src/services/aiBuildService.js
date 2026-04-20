const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/$/, '');

export async function generateAiBuild(vehicle) {
  const response = await fetch(`${API_BASE_URL}/api/generate-build`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(vehicle),
  });

  const payload = await response.json();

  if (!response.ok) {
    throw new Error(payload.error || 'No se pudo generar la build con IA.');
  }

  return payload.result ?? null;
}
