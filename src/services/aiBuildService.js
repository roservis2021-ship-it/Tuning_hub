const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/$/, '');

export async function generateAiBuild(vehicle) {
  const response = await fetch(`${API_BASE_URL}/api/generate-build`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(vehicle),
  });

  const responseText = await response.text();
  let payload = null;

  if (responseText) {
    try {
      payload = JSON.parse(responseText);
    } catch (error) {
      throw new Error('El backend no devolvio una respuesta valida.');
    }
  }

  if (!response.ok) {
    const error = new Error(payload?.error || 'No se pudo generar la build con IA.');
    error.code = payload?.code;
    error.status = response.status;
    throw error;
  }

  return payload?.result ?? null;
}
