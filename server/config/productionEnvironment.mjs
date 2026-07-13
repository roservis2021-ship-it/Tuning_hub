const REQUIRED_PRODUCTION_KEYS = [
  'OPENAI_API_KEY',
  'STRIPE_SECRET_KEY',
  'STRIPE_WEBHOOK_SECRET',
  'PUBLIC_APP_URL',
  'API_ALLOWED_ORIGINS',
  'NOTIFICATION_SCHEDULER_SECRET',
];

export function productionEnvironmentErrors(env) {
  if (env.NODE_ENV !== 'production') return [];
  const errors = REQUIRED_PRODUCTION_KEYS.filter((key) => !meaningful(env[key])).map((key) => `Falta ${key}.`);
  if (!meaningful(env.FIREBASE_SERVICE_ACCOUNT_JSON) && !meaningful(env.FIREBASE_SERVICE_ACCOUNT_PATH)) errors.push('Falta una credencial Firebase Admin.');
  if (meaningful(env.PUBLIC_APP_URL) && !isHttpsUrl(env.PUBLIC_APP_URL)) errors.push('PUBLIC_APP_URL debe usar HTTPS.');
  for (const key of ['API_ALLOWED_ORIGINS', 'STRIPE_ALLOWED_ORIGINS']) {
    if (!meaningful(env[key])) continue;
    const origins = String(env[key]).split(',').map((value) => value.trim()).filter(Boolean);
    if (origins.some((origin) => origin === '*' || /localhost|127\.0\.0\.1/i.test(origin) || !isHttpsUrl(origin))) errors.push(`${key} solo puede contener orígenes HTTPS explícitos en producción.`);
  }
  for (const key of ['OPENAI_MAX_OUTPUT_TOKENS', 'OPENAI_PREMIUM_MAX_OUTPUT_TOKENS']) {
    if (env[key] !== undefined && (!Number.isFinite(Number(env[key])) || Number(env[key]) < 300 || Number(env[key]) > 6000)) errors.push(`${key} debe estar entre 300 y 6000.`);
  }
  const dailyLimit = Number(env.OPENAI_SPECIALIST_DAILY_LIMIT ?? 20);
  if (!Number.isInteger(dailyLimit) || dailyLimit < 1 || dailyLimit > 100) errors.push('OPENAI_SPECIALIST_DAILY_LIMIT debe estar entre 1 y 100.');
  return errors;
}

export function assertProductionEnvironment(env) {
  const errors = productionEnvironmentErrors(env);
  if (errors.length) throw new Error(`Configuración de producción inválida:\n- ${errors.join('\n- ')}`);
}

function meaningful(value) {
  const text = String(value ?? '').trim();
  return text.length > 0 && !/^(tu_|your_|change-me|sk-x+|whsec-x+|\{.*\.\.\.\})/i.test(text);
}

function isHttpsUrl(value) {
  try { return new URL(String(value)).protocol === 'https:'; }
  catch { return false; }
}
