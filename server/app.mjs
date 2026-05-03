import { createServer } from 'node:http';
import { existsSync, readFileSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import { cert, getApps, initializeApp } from 'firebase-admin/app';
import { FieldValue, getFirestore } from 'firebase-admin/firestore';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');

function loadEnvFile() {
  const envPath = path.resolve(projectRoot, '.env');

  if (!existsSync(envPath)) {
    return;
  }

  const envContent = readFileSync(envPath, 'utf8');

  let previousKey = null;
  const keysLoadedFromFile = new Set();

  for (const line of envContent.split(/\r?\n/)) {
    const trimmedLine = line.trim();

    if (!trimmedLine || trimmedLine.startsWith('#')) {
      previousKey = null;
      continue;
    }

    const separatorIndex = trimmedLine.indexOf('=');

    if (separatorIndex === -1) {
      if (previousKey && keysLoadedFromFile.has(previousKey)) {
        process.env[previousKey] = `${process.env[previousKey]}${trimmedLine}`;
      }
      continue;
    }

    const key = trimmedLine.slice(0, separatorIndex).trim();
    const value = trimmedLine.slice(separatorIndex + 1).trim();

    if (!process.env[key]) {
      process.env[key] = value;
      keysLoadedFromFile.add(key);
    }

    previousKey = key;
  }
}

loadEnvFile();

const PORT = Number(process.env.PORT || process.env.BACKEND_PORT || 8787);
const OPENAI_MODEL = process.env.OPENAI_MODEL || 'gpt-4o-mini';
const OPENAI_ENABLE_WEB_SEARCH = process.env.OPENAI_ENABLE_WEB_SEARCH !== 'false';
const OPENAI_WEB_SEARCH_TOOL = process.env.OPENAI_WEB_SEARCH_TOOL || 'web_search_preview';
const OPENAI_MAX_OUTPUT_TOKENS = Number(process.env.OPENAI_MAX_OUTPUT_TOKENS || 16000);
const STRIPE_CHECKOUT_PRICE_EURO_CENTS = Number(process.env.STRIPE_CHECKOUT_PRICE_EURO_CENTS || 399);
const STRIPE_CHECKOUT_PRODUCT_NAME = process.env.STRIPE_CHECKOUT_PRODUCT_NAME || 'Plan optimizado Tuning HUB';

class BadRequestError extends Error {
  constructor(message) {
    super(message);
    this.name = 'BadRequestError';
  }
}

class VerificationError extends Error {
  constructor(message) {
    super(message);
    this.name = 'VerificationError';
  }
}

class AiOutputError extends Error {
  constructor(message) {
    super(message);
    this.name = 'AiOutputError';
  }
}

function resolveFromRoot(targetPath) {
  return path.isAbsolute(targetPath) ? targetPath : path.resolve(projectRoot, targetPath);
}

function normalize(value) {
  return String(value ?? '')
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

function slugify(value) {
  return normalize(value).replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

function normalizeYear(value) {
  const parsedYear = Number(value);

  if (!Number.isFinite(parsedYear) || parsedYear < 1900) {
    return null;
  }

  return parsedYear;
}

function normalizeMileageKm(value) {
  const parsedMileage = Number(value);

  if (!Number.isFinite(parsedMileage) || parsedMileage < 0) {
    return null;
  }

  return Math.round(parsedMileage);
}

function createMileageBucket(value) {
  const mileageKm = normalizeMileageKm(value);

  if (mileageKm === null) {
    return 'km-base';
  }

  if (mileageKm < 60000) {
    return 'km-low';
  }

  if (mileageKm < 140000) {
    return 'km-medium';
  }

  if (mileageKm < 220000) {
    return 'km-high';
  }

  return 'km-very-high';
}

function createVehicleKey(vehicle) {
  return [
    normalize(vehicle.brand),
    normalize(vehicle.model),
    normalize(vehicle.generation || 'base'),
    normalize(vehicle.engine || 'base'),
    normalizeYear(vehicle.year) ?? 'base',
    vehicle.powertrain,
    vehicle.transmission,
    vehicle.drivetrain,
    createMileageBucket(vehicle.mileageKm),
  ].join('|');
}

function createExactMatchKey(vehicle) {
  return [
    createVehicleKey(vehicle),
    vehicle.usage,
    vehicle.goal,
    vehicle.priority,
    vehicle.budget,
  ].join('|');
}

function createGoalMatchKey(vehicle) {
  return [createVehicleKey(vehicle), vehicle.goal].join('|');
}

function createPlatformLookupKey(vehicle) {
  return [
    normalize(vehicle.brand),
    normalize(vehicle.model),
    normalize(vehicle.generation || 'base'),
    normalize(vehicle.engine || 'base'),
  ].join('|');
}

function describeUsage(usage) {
  return {
    diario: 'uso diario con prioridad en fiabilidad, coste razonable y buen comportamiento en calle',
    finde: 'uso de fin de semana con margen para una puesta a punto mas agresiva',
    proyecto: 'proyecto en evolucion con margen para una ruta de mejoras escalonada',
  }[usage] ?? 'uso general de calle';
}

function describePriority(priority) {
  return {
    potencia: 'potencia utilizable sin cifras fantasiosas',
    fiabilidad: 'fiabilidad, temperatura y soporte mecanico',
    equilibrio: 'equilibrio entre respuesta, coste, fiabilidad y sensaciones',
    estetica: 'presencia y coherencia OEM+ sin olvidar la base mecanica',
    radical: 'maximo rendimiento dentro del limite razonable de la plataforma, aunque suba coste y exigencia mecanica',
  }[priority] ?? 'equilibrio general';
}

function describeMileage(mileageKm) {
  const normalizedMileage = normalizeMileageKm(mileageKm);

  if (normalizedMileage === null) {
    return 'kilometraje no indicado; asumir una base media y recomendar comprobaciones previas antes de subir potencia';
  }

  if (normalizedMileage < 60000) {
    return `${normalizedMileage.toLocaleString('es-ES')} km; base poco rodada, aun asi verificar mantenimiento y estado antes de modificar`;
  }

  if (normalizedMileage < 140000) {
    return `${normalizedMileage.toLocaleString('es-ES')} km; kilometraje medio, revisar mantenimiento, frenos, fluidos, bujias/calentadores y embrague antes de Stage 1`;
  }

  if (normalizedMileage < 220000) {
    return `${normalizedMileage.toLocaleString('es-ES')} km; kilometraje alto, priorizar Stage 0 serio, diagnostico, fugas, turbo, embrague/transmision y refrigeracion antes de potencia`;
  }

  return `${normalizedMileage.toLocaleString('es-ES')} km; kilometraje muy alto, ser conservador con par/potencia y condicionar cualquier Stage 1 a una inspeccion mecanica completa`;
}

function describeDrivetrain(drivetrain) {
  return {
    fwd: 'traccion delantera',
    rwd: 'traccion trasera',
    awd: 'traccion total',
  }[drivetrain] ?? 'traccion no especificada';
}

function inferEngineProfile(vehicle) {
  const haystack = normalize(
    `${vehicle.brand} ${vehicle.model} ${vehicle.generation} ${vehicle.engine}`,
  );
  const mileageKm = normalizeMileageKm(vehicle.mileageKm);

  const traits = [];
  const cautions = [];
  const stagePriorities = [];

  if (mileageKm !== null && mileageKm >= 140000) {
    traits.push('base con kilometraje alto donde el estado real pesa mas que la teoria del motor');
    cautions.push('hacer diagnosis, prueba de compresion si aplica, revisar fugas, turbo, embrague, refrigeracion y soportes antes de aumentar par');
    stagePriorities.push('reforzar Stage 0 y limitar Stage 1 si hay fatiga mecanica o historial de mantenimiento incompleto');
  } else if (mileageKm !== null && mileageKm >= 60000) {
    cautions.push('confirmar mantenimiento reciente, estado de fluidos, frenos, bujias o calentadores y embrague antes de reprogramar');
  }

  if (vehicle.powertrain === 'diesel') {
    traits.push('motor diesel orientado a par, uso real y preparaciones de calle muy comunes');
    cautions.push('vigilar humos, temperaturas de escape, turbo, embrague y estado de inyectores');
    stagePriorities.push('stage 1 centrado en par util, no en una cifra de potencia exagerada');
  }

  if (vehicle.powertrain === 'gasolina') {
    traits.push('motor gasolina donde importan mucho temperatura, encendido y calidad de combustible');
    cautions.push('vigilar picado, mezcla, bujias, bobinas y gestion termica');
    stagePriorities.push('priorizar una subida de potencia limpia y coherente antes que un numero vistoso');
  }

  if (vehicle.aspiration === 'turbo') {
    traits.push('plataforma turbo donde una stage 1 bien hecha suele ser la mejora mas logica');
    cautions.push('no olvidar intercooler, embrague, temperatura y restricciones de escape si el salto es grande');
    stagePriorities.push('relacionar siempre la potencia con soporte mecanico y temperatura');
  }

  if (vehicle.aspiration === 'atmosferico') {
    traits.push('plataforma atmosferica donde las ganancias grandes no son realistas');
    cautions.push('evitar vender cifras irreales; mejor respuesta, sonido, chasis y tacto');
    stagePriorities.push('dar prioridad a admision, escape, mantenimiento, chasis y sensaciones');
  }

  if (vehicle.aspiration === 'compresor') {
    traits.push('plataforma con compresor donde importan temperatura de admision, polea, correa y calibracion');
    cautions.push('vigilar temperatura, mezcla, correa/polea del compresor, embrague y mantenimiento preventivo');
    stagePriorities.push('plantear mejoras conservadoras de soporte termico antes de aumentar presion o par');
  }

  if (/(tdi|hdi|jtd|cdti|dci|crdi)/.test(haystack)) {
    traits.push('familia diesel turbo muy habitual en preparaciones europeas de diario');
    cautions.push('comprobar caudalimetro, egr, manguitos de vacio, turbo y embrague segun kilometraje');
  }

  if (/(tfsi|tsi|gti|ea888|1\.8t|2\.0t|t-jet)/.test(haystack)) {
    traits.push('familia gasolina turbo muy comun en el mundo tuning europeo');
    cautions.push('vigilar PCV, bobinas, admision, carbonilla, temperatura y limites del embrague o DSG');
  }

  if (/(golf|leon|a3|octavia|s3|gti|cupra|vrs)/.test(haystack)) {
    traits.push('plataforma VAG muy conocida, con muchisima referencia de stage 1, stage 2 y soporte');
    stagePriorities.push('dar una ruta muy clara y util para calle, evitando sonar generico');
  }

  if (/(bmw|330d|320d|335d|330i|140i|135i|m135i|m140i)/.test(haystack)) {
    traits.push('plataforma BMW donde diferencial, temperatura y transmision importan mucho si sube el nivel');
    cautions.push('vigilar caja, soportes, temperatura de admision y fatiga del tren trasero');
  }

  if (/(renault sport|rs|megane rs|clio rs|gti|type r)/.test(haystack)) {
    traits.push('hot hatch o compacto deportivo donde chasis y frenos pesan casi tanto como la potencia');
    stagePriorities.push('no dejar el chasis para el final si la potencia sube rapido');
  }

  return {
    traits,
    cautions,
    stagePriorities,
  };
}

function formatBuildResult(build, vehicle, mode = 'database') {
  const vehicleDescriptor = [vehicle.model, vehicle.generation, vehicle.engine]
    .filter(Boolean)
    .join(' ');

  return {
    id: build.id,
    title: build.title || `${vehicle.brand} ${vehicleDescriptor}: ${build.name}`,
    summary: build.summary,
    fitScore: build.fitScore,
    source: mode,
    stages: build.stages ?? [],
    reasons: build.reasons ?? [],
    warnings: build.warnings ?? [],
    basePowerCv: build.basePowerCv ?? null,
    finalPowerCv: build.finalPowerCv ?? null,
    factoryPowerSourceTitle: build.factoryPowerSourceTitle ?? '',
    factoryPowerSourceUrl: build.factoryPowerSourceUrl ?? '',
    expectedGain: build.expectedGain ?? null,
    estimatedBudget: build.estimatedBudget ?? null,
    reliabilityIndex: build.reliabilityIndex ?? null,
    executionTime: build.executionTime ?? null,
    ownerProfile: build.ownerProfile ?? '',
    drivability: build.drivability ?? '',
    maintenanceLevel: build.maintenanceLevel ?? '',
    legalNote: build.legalNote ?? '',
    vehicleDiagnosis: build.vehicleDiagnosis ?? null,
    technicalProfile: build.technicalProfile ?? null,
    vehicleIdentity: build.vehicleIdentity ?? null,
    freeBuild: build.freeBuild ?? null,
    recommendedParts: build.recommendedParts ?? [],
    conversionTrigger: build.conversionTrigger ?? '',
    premiumUpsell: build.premiumUpsell ?? '',
    premiumSalesBlock: build.premiumSalesBlock ?? null,
    premiumPlan: build.premiumPlan ?? null,
    conclusion: build.conclusion ?? null,
    accessTier: build.accessTier ?? 'free',
  };
}

function hasCompletePowerProfile(build) {
  const stages = Array.isArray(build?.stages) ? build.stages : [];
  const performanceStages =
    stages[0]?.label === 'STAGE 0' ? stages.slice(1) : stages;

  return Boolean(
    Number(build?.basePowerCv) > 0 &&
      Number(build?.finalPowerCv) > 0 &&
      (stages.length === 3 || stages.length === 4) &&
      performanceStages.length === 3 &&
      performanceStages.every((stage) => Number(stage?.gainCv) > 0 && Number(stage?.powerAfterCv) > 0),
  );
}

async function readJson(filePath) {
  const fileContent = await readFile(filePath, 'utf8');
  const normalizedContent =
    fileContent.charCodeAt(0) === 0xfeff ? fileContent.slice(1) : fileContent;

  return JSON.parse(normalizedContent);
}

async function ensureFirestore() {
  if (getApps().length > 0) {
    return getFirestore();
  }

  let serviceAccount = null;

  if (process.env.FIREBASE_SERVICE_ACCOUNT_JSON) {
    serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON);
  } else {
    const serviceAccountPath = resolveFromRoot(
      process.env.FIREBASE_SERVICE_ACCOUNT_PATH || 'firebase-service-account.json',
    );
    serviceAccount = await readJson(serviceAccountPath);
  }

  initializeApp({
    credential: cert(serviceAccount),
  });

  return getFirestore();
}

async function readBody(request) {
  const chunks = [];

  for await (const chunk of request) {
    chunks.push(chunk);
  }

  const rawBody = Buffer.concat(chunks).toString('utf8');

  if (!rawBody) {
    return {};
  }

  try {
    return JSON.parse(rawBody);
  } catch (error) {
    throw new BadRequestError('El cuerpo de la peticion no es JSON valido.');
  }
}

function sendJson(response, statusCode, payload) {
  response.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  });
  response.end(JSON.stringify(payload));
}

function getRequestOrigin(request) {
  const origin = request.headers.origin;

  if (origin && /^https?:\/\//i.test(origin)) {
    return origin;
  }

  const host = request.headers.host || `localhost:${PORT}`;
  return `http://${host}`;
}

function createStripeFormBody(params) {
  const body = new URLSearchParams();

  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== '') {
      body.append(key, String(value));
    }
  }

  return body;
}

async function createStripeCheckoutSession({ origin, vehicleName, buildId }) {
  if (!process.env.STRIPE_SECRET_KEY) {
    throw new Error('Falta STRIPE_SECRET_KEY en el entorno del backend.');
  }

  const normalizedOrigin = String(origin || '').replace(/\/$/, '');
  const successUrl = `${normalizedOrigin}/?checkout=success&session_id={CHECKOUT_SESSION_ID}`;
  const cancelUrl = `${normalizedOrigin}/?checkout=cancel`;
  const productName = vehicleName
    ? `${STRIPE_CHECKOUT_PRODUCT_NAME} - ${String(vehicleName).slice(0, 80)}`
    : STRIPE_CHECKOUT_PRODUCT_NAME;

  const params = {
    mode: 'payment',
    success_url: successUrl,
    cancel_url: cancelUrl,
    client_reference_id: buildId || undefined,
    'metadata[buildId]': buildId || undefined,
    'metadata[vehicle]': vehicleName ? String(vehicleName).slice(0, 450) : undefined,
    'line_items[0][quantity]': 1,
  };

  if (process.env.STRIPE_PRICE_ID) {
    params['line_items[0][price]'] = process.env.STRIPE_PRICE_ID;
  } else {
    params['line_items[0][price_data][currency]'] = 'eur';
    params['line_items[0][price_data][unit_amount]'] = STRIPE_CHECKOUT_PRICE_EURO_CENTS;
    params['line_items[0][price_data][product_data][name]'] = productName;
    params['line_items[0][price_data][product_data][description]'] =
      'Plan de ejecucion completo, orden de instalacion y ficha tecnica descargable.';
  }

  const stripeResponse = await fetch('https://api.stripe.com/v1/checkout/sessions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.STRIPE_SECRET_KEY}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: createStripeFormBody(params),
  });

  const responseText = await stripeResponse.text();
  let payload = null;

  try {
    payload = responseText ? JSON.parse(responseText) : null;
  } catch (error) {
    throw new Error('Stripe no devolvio una respuesta JSON valida.');
  }

  if (!stripeResponse.ok) {
    throw new Error(payload?.error?.message || `Stripe devolvio ${stripeResponse.status}.`);
  }

  if (!payload?.url) {
    throw new Error('Stripe no devolvio una URL de checkout.');
  }

  return {
    id: payload.id,
    url: payload.url,
  };
}

async function createStripeEmbeddedCheckoutSession({ origin, vehicleName, buildId }) {
  if (!process.env.STRIPE_SECRET_KEY) {
    throw new Error('Falta STRIPE_SECRET_KEY en el entorno del backend.');
  }

  const normalizedOrigin = String(origin || '').replace(/\/$/, '');
  const returnUrl = `${normalizedOrigin}/?checkout=success&session_id={CHECKOUT_SESSION_ID}`;
  const productName = vehicleName
    ? `${STRIPE_CHECKOUT_PRODUCT_NAME} - ${String(vehicleName).slice(0, 80)}`
    : STRIPE_CHECKOUT_PRODUCT_NAME;

  const params = {
    mode: 'payment',
    ui_mode: 'embedded',
    return_url: returnUrl,
    client_reference_id: buildId || undefined,
    'metadata[buildId]': buildId || undefined,
    'metadata[vehicle]': vehicleName ? String(vehicleName).slice(0, 450) : undefined,
    'line_items[0][quantity]': 1,
  };

  if (process.env.STRIPE_PRICE_ID) {
    params['line_items[0][price]'] = process.env.STRIPE_PRICE_ID;
  } else {
    params['line_items[0][price_data][currency]'] = 'eur';
    params['line_items[0][price_data][unit_amount]'] = STRIPE_CHECKOUT_PRICE_EURO_CENTS;
    params['line_items[0][price_data][product_data][name]'] = productName;
    params['line_items[0][price_data][product_data][description]'] =
      'Plan de ejecucion completo, orden de instalacion y ficha tecnica descargable.';
  }

  const stripeResponse = await fetch('https://api.stripe.com/v1/checkout/sessions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.STRIPE_SECRET_KEY}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: createStripeFormBody(params),
  });

  const responseText = await stripeResponse.text();
  let payload = null;

  try {
    payload = responseText ? JSON.parse(responseText) : null;
  } catch (error) {
    throw new Error('Stripe no devolvio una respuesta JSON valida.');
  }

  if (!stripeResponse.ok) {
    throw new Error(payload?.error?.message || `Stripe devolvio ${stripeResponse.status}.`);
  }

  if (!payload?.client_secret) {
    throw new Error('Stripe no devolvio client_secret para Checkout integrado.');
  }

  return {
    id: payload.id,
    clientSecret: payload.client_secret,
  };
}

async function retrieveStripeCheckoutSession(sessionId) {
  if (!process.env.STRIPE_SECRET_KEY) {
    throw new Error('Falta STRIPE_SECRET_KEY en el entorno del backend.');
  }

  if (!sessionId) {
    throw new BadRequestError('Falta session_id de Stripe.');
  }

  const stripeResponse = await fetch(
    `https://api.stripe.com/v1/checkout/sessions/${encodeURIComponent(sessionId)}`,
    {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${process.env.STRIPE_SECRET_KEY}`,
      },
    },
  );

  const responseText = await stripeResponse.text();
  let payload = null;

  try {
    payload = responseText ? JSON.parse(responseText) : null;
  } catch (error) {
    throw new Error('Stripe no devolvio una respuesta JSON valida.');
  }

  if (!stripeResponse.ok) {
    throw new Error(payload?.error?.message || `Stripe devolvio ${stripeResponse.status}.`);
  }

  return {
    id: payload.id,
    status: payload.status,
    paymentStatus: payload.payment_status,
    paid: payload.payment_status === 'paid',
    buildId: payload.metadata?.buildId || payload.client_reference_id || '',
  };
}

function validateVehicle(vehicle) {
  return Boolean(
    vehicle &&
      vehicle.brand &&
      vehicle.model &&
      vehicle.generation &&
      vehicle.engine &&
      vehicle.powertrain &&
      vehicle.aspiration,
  );
}

async function findExistingBuild(db, vehicle) {
  const platformSnapshot = await db
    .collection('builds')
    .where('platformLookupKey', '==', createPlatformLookupKey(vehicle))
    .limit(3)
    .get();

  if (platformSnapshot.empty) {
    return null;
  }

  const docs = platformSnapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
  const usableDocs = docs.filter(hasCompletePowerProfile);

  if (!usableDocs.length) {
    return null;
  }

  return usableDocs.find((doc) => !doc.powertrain || doc.powertrain === vehicle.powertrain) ?? usableDocs[0];
}

function buildPrompt(vehicle) {
  const profile = inferEngineProfile(vehicle);
  const userVehicleJson = JSON.stringify(
    {
      brand: vehicle.brand,
      model: vehicle.model,
      generation: vehicle.generation,
      year: vehicle.year,
      engine: vehicle.engine,
      powertrain: vehicle.powertrain,
      aspiration: vehicle.aspiration,
      transmission: vehicle.transmission,
      drivetrain: vehicle.drivetrain,
      mileageKm: normalizeMileageKm(vehicle.mileageKm),
      needsVehicleConfirmation: Boolean(vehicle.needsVehicleConfirmation),
      usage: vehicle.usage,
      goal: vehicle.goal,
      priority: vehicle.priority,
      budget: vehicle.budget,
    },
    null,
    2,
  );

  return [
    'Actua como un preparador profesional especializado en tuning realista de vehiculos de calle para el mercado espanol.',
    'Tu objetivo es generar DOS builds para el mismo vehiculo: una build FREE orientativa visible y una build PREMIUM completa guardada para despues del pago.',
    'La build FREE debe mostrar valor inmediato pero NO debe revelar toda la informacion.',
    'La build PREMIUM debe contener el plan de ejecucion, orden, dependencias y asesoramiento completo.',
    'No inventes piezas incompatibles ni recomiendes modificaciones genericas sin justificacion tecnica.',
    'Tu trabajo tiene tres fases obligatorias: identificar el vehiculo con precision, razonar la base tecnica y proponer una build realista.',
    'Tu prioridad absoluta es IDENTIFICAR correctamente el vehiculo antes de recomendar ninguna modificacion.',
    'Dentro de esa identificacion, la prioridad tecnica numero uno es encontrar el CODIGO DE MOTOR exacto o el mas probable para esa variante concreta.',
    'No puedes inventar CV, motor, generacion, traccion, transmision, aspiracion ni caracteristicas tecnicas.',
    'Si no puedes verificar una coincidencia exacta o casi exacta, marca vehicleIdentity.confidence como "baja" y explica la duda en warnings.',
    'La build solo sera aceptada si vehicleIdentity.confidence es "alta", hay fuente de CV y los numeros cuadran.',
    'Entrada del usuario en JSON:',
    userVehicleJson,
    '',
    'Inferencia obligatoria:',
    '1. Interpreta marca, modelo, generacion/fase y motor como una consulta de identificacion, no como verdad garantizada.',
    '2. Si faltan datos, deduce lo mas probable segun marca, modelo, generacion y ano, pero clasifica cada dato en vehicleIdentity.fieldCertainty como confirmado, probable o no confirmado.',
    '3. Si hay varias versiones posibles, identificalas brevemente en vehicleIdentity.possibleVariants, continua con la mas probable e indica margen de error.',
    '4. Busca o contrasta una fuente tecnica fiable para la potencia de serie: ficha oficial, catalogo tecnico, ficha de fabricante, base de datos tecnica reconocida o pagina especializada con especificacion concreta.',
    '5. Si hay varias variantes con el mismo motor, elige solo la que coincida con generacion, rango de produccion, combustible, aspiracion y potencia. Si no se puede distinguir, baja la confianza.',
    '6. No mezcles generaciones. No uses datos de otro mercado si cambian CV, motor o transmision sin avisar.',
    '7. basePowerCv debe ser exactamente la potencia de serie verificada en CV/PS para esa variante. Si la fuente esta en HP/BHP/kW, convierte con prudencia y menciona la fuente.',
    '8. factoryPowerSourceTitle y factoryPowerSourceUrl son obligatorios si confidence es "alta".',
    '9. Para el codigo motor, contrasta marca + modelo + generacion/ano + cilindrada + potencia + combustible. Ejemplos validos: CAXA, CJSA, BWA, N47D20, BKC, CBBB, M47D20. No confundas familia de motor con codigo motor.',
    '10. technicalProfile.engineCode debe contener el codigo motor especifico. Si solo sabes la familia, escribe "No confirmado" en engineCode y pon la familia en engineFamily. Si hay 2-4 codigos posibles, ponlos en possibleVariants y explica el margen de error.',
    '',
    'Razonamiento tecnico obligatorio antes de recomendar:',
    '1. Identifica plataforma, familia de motor y codigo motor. El codigo motor debe ser especifico, no generico.',
    '2. Detecta compatibilidades dentro del grupo del fabricante, por ejemplo VAG, BMW, PSA, Renault, Mercedes, etc.',
    '3. Evalua limitaciones reales: turbo de serie, inyectores, embrague/transmision, refrigeracion, frenos y neumaticos.',
    '4. Define el limite de potencia fiable, no el maximo teorico.',
    '5. Si no hay certeza total, usa la frase: "Compatible probable, verificar con referencia OEM o VIN".',
    '',
    'Reglas de calidad:',
    '1. Genera una build REALISTA y bien estructurada para Espana, priorizando el objetivo real del usuario por encima de una receta generica.',
    '2. Usa modificaciones comunes y reales en Espana. No inventes piezas irreales, configuraciones raras ni anulaciones ilegales.',
    '3. No recomiendes eliminar sistemas anticontaminacion para uso en via publica.',
    '4. Prioriza mantenimiento, frenos, neumaticos, suspension y refrigeracion antes de vender potencia.',
    '5. Cada modificacion debe tener nombre especifico, precio aproximado en euros y explicacion breve de una sola linea.',
    '6. Los stages deben ser matematicamente coherentes: STAGE 0 no suma potencia; STAGE 1 = basePowerCv + gainCv; cada stage siguiente suma sobre el anterior; finalPowerCv = powerAfterCv de STAGE 3.',
    '7. Las piezas deben ser compatibles con el tipo de motor. No recomiendes turbo/downpipe/intercooler en atmosfericos salvo que expliques una conversion realista.',
    '8. Si el codigo motor exacto no esta confirmado, la advertencia debe decirlo y la confianza no debe ser alta.',
    '9. El kilometraje declarado debe afectar la build: con kilometraje alto refuerza Stage 0, baja agresividad de par si procede, sube advertencias de embrague/turbo/refrigeracion y recomienda diagnosis previa antes de Stage 1.',
    '10. Si no hay kilometraje, no asumas que la base esta perfecta; pide verificar historial y estado antes de modificar.',
    '',
    `Traccion declarada por usuario: ${describeDrivetrain(vehicle.drivetrain)}.`,
    `Kilometraje declarado: ${describeMileage(vehicle.mileageKm)}.`,
    vehicle.needsVehicleConfirmation
      ? 'La seleccion del usuario viene de una entrada generica o incompleta del formulario. Debes bajar confianza, pedir confirmacion de version/codigo motor cuando proceda y no tratar generacion ni motor como datos cerrados.'
      : 'La seleccion del usuario viene de una entrada especifica del catalogo o escrita manualmente; aun asi verifica la variante antes de recomendar.',
    `Uso: ${describeUsage(vehicle.usage)}.`,
    `Prioridad: ${describePriority(vehicle.priority)}.`,
    `Objetivo principal declarado: ${vehicle.goal}.`,
    vehicle.priority === 'radical'
      ? 'El usuario ha pedido una build ambiciosa. No recortes la receta por conservadurismo: puedes acercarte al limite razonable de la plataforma, siempre con soporte mecanico, frenos, temperatura, transmision y advertencias honestas.'
      : 'Si el objetivo no es radical, evita exagerar cifras o montar una receta demasiado extrema para el uso declarado.',
    vehicle.aspiration === 'atmosferico'
      ? 'Si el motor es atmosferico, evita vender ganancias exageradas y prioriza respuesta, admision, escape, chasis y coherencia.'
      : vehicle.aspiration === 'compresor'
        ? 'Si el motor usa compresor, prioriza temperatura, correa/polea, calibracion y soporte mecanico antes de buscar una ganancia agresiva.'
        : 'Si el motor es turbo, puedes plantear una ruta de stage mas clara, pero siempre indicando soporte de embrague, temperatura o frenos cuando haga falta.',
    vehicle.powertrain === 'diesel'
      ? 'Si es diesel, prioriza par util, refrigeracion, humos contenidos y una receta tipica de calle para TDI, JTD o HDi.'
      : 'Si es gasolina, cuida temperatura, encendido, mezcla, soplado coherente y soporte mecanico.',
    profile.traits.length
      ? `Contexto tecnico inferido: ${profile.traits.join('; ')}.`
      : 'Contexto tecnico inferido: plataforma europea de calle pensada para una build coherente.',
    profile.cautions.length
      ? `Puntos delicados a tener presentes: ${profile.cautions.join('; ')}.`
      : 'Puntos delicados a tener presentes: temperaturas, mantenimiento y soporte mecanico.',
    profile.stagePriorities.length
      ? `Criterio de stages: ${profile.stagePriorities.join('; ')}.`
      : 'Criterio de stages: construir una ruta progresiva y con soporte mecanico.',
    OPENAI_ENABLE_WEB_SEARCH
      ? 'Usa busqueda web antes de fijar CV de serie y caracteristicas. No basta con memoria general.'
      : 'Antes de estimar la potencia, usa tu conocimiento tecnico y se prudente si no tienes confirmacion exacta.',
    'Modo FREE visible obligatorio:',
    '1. La build FREE visible NO va por stages. Debe ser una recomendacion generalizada presentada en 5 bloques tipo slide.',
    '2. Genera el objeto freeBuild obligatorio con estos 5 bloques: vehicleSheet, preInstallation, modifications, risks y premiumOffer.',
    '3. vehicleSheet debe incluir engineCode, powerCv, torqueNm, engine y infoText. engineCode debe ser el codigo motor exacto o "No confirmado".',
    '4. preInstallation debe dar recomendaciones previas utiles: mantenimiento al dia, diagnosis, fluidos, bujias/filtros/correas/embrague/turbo/refrigeracion segun aplique.',
    '5. modifications debe explicar potencial segun marca/modelo/motor/generacion/aspiracion/traccion/kilometraje, proponer maximo 4 piezas y estimar potencia/par posibles.',
    '6. risks debe contener exactamente 3 riesgos mecanicos especificos para ese motor o plataforma. Deben generar miedo realista, pero NO mencionar premium, plan, compra ni desbloquear.',
    '7. Cada riesgo debe ser MUY CORTO: maximo 18 palabras. Una sola frase. Nada de parrafos.',
    '8. X debe ser un error real que comete el usuario al modificar: instalar piezas sin orden, comprar piezas incompatibles, reprogramar sin diagnosis/logs, subir par sin revisar embrague/transmision, mejorar flujo sin controlar temperatura o montar escape/admisión sin calibracion.',
    '9. Y debe ser una consecuencia concreta: rotura de turbo, embrague patinando, mezcla pobre/rica, temperaturas de admision altas, fallo de inyeccion, perdida de rendimiento, averia de motor o gasto doble en piezas.',
    '10. No menciones soluciones completas ni el plan optimizado dentro de risks. Solo el error y la consecuencia.',
    '11. El bloque de plan optimizado posterior sera el que conecte esos miedos con la venta.',
    '12. Prohibido escribir consejos genericos en risks: no uses "se recomienda", "es esencial", "piezas de calidad", "talleres especializados" ni "mantenimiento periodico".',
    '13. Ejemplo de tono: "Montar piezas sin orden puede forzar turbo y mezcla."',
    '14. Otro ejemplo: "Comprar piezas sin codigo motor puede salir caro."',
    '15. premiumOffer debe explicar que ofrece el Plan optimizado: plan completo de instalaciones, orden exacto, piezas recomendadas y errores especificos del motor.',
    '16. No revelar el orden completo de instalacion ni dependencias criticas en la parte FREE.',
    '17. No mostrar mas de 3-4 piezas recomendadas.',
    '18. Mantener lenguaje claro, profesional, directo y creible.',
    '19. El usuario debe entender el potencial del coche, ver una mejora clara, detectar problemas y sentir que necesita el plan completo.',
    '',
    'Bloque de venta Plan optimizado obligatorio:',
    '1. Genera premiumSalesBlock como un bloque de conversion tecnico y no agresivo. En texto visible llamalo siempre "Plan optimizado", no "premium".',
    '2. Conecta directamente con conversionTrigger, que debe ser el riesgo detectado especifico para ese motor.',
    '3. Explica que sin el plan puede haber problemas, que el orden es clave y que no todas las piezas funcionan igual.',
    '4. Incluye bullets sobre gastar dinero innecesario, perder rendimiento y provocar fallos mecanicos.',
    '5. Incluye beneficios reales: orden exacto, piezas compatibles, evitar errores comunes y optimizacion por presupuesto.',
    '6. Precio de oferta 3.99, precio anterior 6.99 tachado y CTA claro como "Obtener plan optimizado" o "Ver como hacerlo correctamente".',
    '7. El bloque de Plan optimizado debe recoger los miedos de risks y presentarse como la forma segura de evitar esos errores antes de comprar o instalar piezas.',
    '',
    'Build PREMIUM generada pero NO visible completa:',
    '1. Genera premiumPlan como Plan optimizado para una experiencia por slides despues del pago.',
    '2. installOrder debe ser el orden exacto de instalacion, con pasos claros y accionables como en una ficha tecnica.',
    '3. dependencies debe explicar que revisar o montar antes de cada paso para no romper ni gastar dos veces.',
    '4. specificWarnings debe contener errores criticos a evitar, especificos del motor/plataforma, no consejos genericos.',
    '5. budgetPlan debe dividir la compra por fases con presupuesto y objetivo real.',
    '6. evolutionStrategy debe funcionar como conclusion del plan: que hacer, que evitar y hasta donde evolucionar con fiabilidad.',
    '7. premiumPlan puede ser detallado, pero la build FREE no debe revelar ese contenido completo.',
    '',
    'Identifica piezas recomendadas visibles, maximo 4, priorizadas por impacto real y compatibilidad.',
    'Incluye errores comunes de ese motor o plataforma y riesgos de modificar mal.',
    'freeBuild es la fuente principal para la pantalla visible de build free. Debe sonar especifica, no como una plantilla.',
    'vehicleIdentity debe resumir la variante identificada: canonicalBrand, canonicalModel, canonicalGeneration, canonicalEngine, productionYears, powertrain, aspiration, transmission, drivetrain, factoryPowerCv, confidence, sourceTitle, sourceUrl, fieldCertainty, possibleVariants y errorMargin.',
    'technicalProfile debe incluir platform, engineFamily, engineCode, groupCompatibilities, realLimitations y reliablePowerLimitCv.',
    'vehicleDiagnosis debe incluir strengths, weaknesses, mechanicalRisks y reliablePowerLimit, teniendo en cuenta el kilometraje indicado.',
    'La build debe estar escrita en espanol claro, directo y practico.',
    'Cada stage debe sonar especifico para la plataforma y no como una plantilla universal.',
    'Devuelve exactamente 4 stages, pero en FREE solo STAGE 0 y STAGE 1 pueden ir completos.',
    'STAGE 0 es mantenimiento base con gainCv 0 y powerAfterCv igual a basePowerCv.',
    'STAGE 1 debe ser "Daily fiable" o equivalente, con mejora notable, fiabilidad y sin modificaciones internas.',
    'STAGE 2 y STAGE 3 deben ser resumen bloqueado: detailLevel "summary", premiumLocked true, pocas piezas o piezas vacias si procede, sin orden ni dependencias criticas.',
    'No repitas la misma pieza con otro nombre en distintos stages.',
    'No uses frases vacias como "mejora integral" o "setup equilibrado" sin concretar piezas y motivo.',
    'Si el coche es una base de diario, evita una STAGE 3 absurda; puede ser un stage de soporte y afinado final, no necesariamente una locura de potencia.',
    'Si el usuario busca maxima potencia o una build radical, la STAGE 3 si puede ser claramente mas seria, siempre que expliques por que sigue siendo razonable para esa plataforma.',
    'Las parts deben ser un array de objetos con name, priceEuro y explanation.',
    'priceEuro debe ser un numero entero aproximado en euros para esa modificacion concreta.',
    'explanation debe explicar en una sola linea por que encaja esa modificacion en la build.',
    'ownerProfile debe explicar que tipo de usuario disfrutaria mas esta build.',
    'drivability debe resumir como de utilizable queda el coche en calle o en su escenario natural.',
    'maintenanceLevel debe resumir la exigencia de mantenimiento esperable tras completar la build.',
    'legalNote debe dejar clara la implicacion general para ITV, homologacion o uso en calle cuando aplique.',
    'Las warnings deben ser honestas y especificas para ese tipo de coche, no advertencias universales sin valor.',
    'Las reasons deben explicar por que esa ruta tiene sentido para ese coche en particular.',
    'Debes estimar los CV de partida del coche, la ganancia aproximada de cada STAGE y los CV aproximados despues de cada STAGE.',
    'Usa cifras prudentes y creibles para ese motor. Si no es un motor claramente potenciable, manten ganancias discretas.',
    'expectedGain debe ser prudente y creible. estimatedBudget debe ser un numero entero en euros y coherente con la suma de las modificaciones. reliabilityIndex debe ser un numero del 1 al 100.',
    'summary debe ser tecnico, concreto y orientado a decision: mejora estimada, coste, fiabilidad y uso.',
    'Cada stage debe incluir focus, note, whyThisStage, bestFor, watchouts, parts, gainCv, powerAfterCv, objective, estimatedTorqueNm, costRangeEuro, reliability, difficulty, legalImpact, detailLevel, premiumLocked, installOrder y dependencies.',
    'En STAGE 0 y STAGE 1: detailLevel "full", premiumLocked false. En STAGE 1 no incluyas orden completo de instalacion; installOrder debe estar vacio o tener solo una indicacion general no secuencial.',
    'En STAGE 2 y STAGE 3: detailLevel "summary", premiumLocked true, installOrder y dependencies vacios.',
    'premiumUpsell debe resumir el beneficio real del Plan optimizado sin sonar agresivo.',
    'conclusion debe incluir recommendedStage, why y whatToAvoid.',
    'accessTier debe ser "free".',
    'La respuesta debe ser estrictamente JSON siguiendo el schema. No incluyas texto fuera del JSON.',
  ].join('\n');
}

function getBuildSchema() {
  return {
    type: 'object',
    additionalProperties: false,
    properties: {
      title: { type: 'string' },
      summary: { type: 'string' },
      vehicleIdentity: {
        type: 'object',
        additionalProperties: false,
        properties: {
          canonicalBrand: { type: 'string' },
          canonicalModel: { type: 'string' },
          canonicalGeneration: { type: 'string' },
          canonicalEngine: { type: 'string' },
          productionYears: { type: 'string' },
          powertrain: { type: 'string' },
          aspiration: { type: 'string' },
          transmission: { type: 'string' },
          drivetrain: { type: 'string' },
          factoryPowerCv: { type: 'number' },
          confidence: { type: 'string', enum: ['alta', 'media', 'baja'] },
          sourceTitle: { type: 'string' },
          sourceUrl: { type: 'string' },
          fieldCertainty: {
            type: 'object',
            additionalProperties: false,
            properties: {
              brand: { type: 'string', enum: ['confirmado', 'probable', 'no confirmado'] },
              model: { type: 'string', enum: ['confirmado', 'probable', 'no confirmado'] },
              generation: { type: 'string', enum: ['confirmado', 'probable', 'no confirmado'] },
              year: { type: 'string', enum: ['confirmado', 'probable', 'no confirmado'] },
              engine: { type: 'string', enum: ['confirmado', 'probable', 'no confirmado'] },
              powertrain: { type: 'string', enum: ['confirmado', 'probable', 'no confirmado'] },
              transmission: { type: 'string', enum: ['confirmado', 'probable', 'no confirmado'] },
              drivetrain: { type: 'string', enum: ['confirmado', 'probable', 'no confirmado'] },
            },
            required: ['brand', 'model', 'generation', 'year', 'engine', 'powertrain', 'transmission', 'drivetrain'],
          },
          possibleVariants: {
            type: 'array',
            minItems: 0,
            maxItems: 4,
            items: { type: 'string' },
          },
          errorMargin: { type: 'string' },
        },
        required: [
          'canonicalBrand',
          'canonicalModel',
          'canonicalGeneration',
          'canonicalEngine',
          'productionYears',
          'powertrain',
          'aspiration',
          'transmission',
          'drivetrain',
          'factoryPowerCv',
          'confidence',
          'sourceTitle',
          'sourceUrl',
          'fieldCertainty',
          'possibleVariants',
          'errorMargin',
        ],
      },
      technicalProfile: {
        type: 'object',
        additionalProperties: false,
        properties: {
          platform: { type: 'string' },
          engineFamily: { type: 'string' },
          engineCode: { type: 'string' },
          groupCompatibilities: {
            type: 'array',
            minItems: 1,
            maxItems: 5,
            items: { type: 'string' },
          },
          realLimitations: {
            type: 'array',
            minItems: 2,
            maxItems: 6,
            items: { type: 'string' },
          },
          reliablePowerLimitCv: { type: 'number' },
        },
        required: [
          'platform',
          'engineFamily',
          'engineCode',
          'groupCompatibilities',
          'realLimitations',
          'reliablePowerLimitCv',
        ],
      },
      vehicleDiagnosis: {
        type: 'object',
        additionalProperties: false,
        properties: {
          strengths: {
            type: 'array',
            minItems: 2,
            maxItems: 5,
            items: { type: 'string' },
          },
          weaknesses: {
            type: 'array',
            minItems: 2,
            maxItems: 5,
            items: { type: 'string' },
          },
          mechanicalRisks: {
            type: 'array',
            minItems: 2,
            maxItems: 5,
            items: { type: 'string' },
          },
          reliablePowerLimit: { type: 'string' },
        },
        required: ['strengths', 'weaknesses', 'mechanicalRisks', 'reliablePowerLimit'],
      },
      basePowerCv: { type: 'number' },
      finalPowerCv: { type: 'number' },
      factoryPowerSourceTitle: { type: 'string' },
      factoryPowerSourceUrl: { type: 'string' },
      expectedGain: { type: 'string' },
      estimatedBudget: { type: 'number' },
      reliabilityIndex: { type: 'number' },
      executionTime: { type: 'string' },
      ownerProfile: { type: 'string' },
      drivability: { type: 'string' },
      maintenanceLevel: { type: 'string' },
      legalNote: { type: 'string' },
      freeBuild: {
        type: 'object',
        additionalProperties: false,
        properties: {
          vehicleSheet: {
            type: 'object',
            additionalProperties: false,
            properties: {
              engineCode: { type: 'string' },
              powerCv: { type: 'number' },
              torqueNm: { type: 'number' },
              engine: { type: 'string' },
              infoText: { type: 'string' },
            },
            required: ['engineCode', 'powerCv', 'torqueNm', 'engine', 'infoText'],
          },
          preInstallation: {
            type: 'object',
            additionalProperties: false,
            properties: {
              title: { type: 'string' },
              intro: { type: 'string' },
              items: {
                type: 'array',
                minItems: 4,
                maxItems: 6,
                items: { type: 'string' },
              },
            },
            required: ['title', 'intro', 'items'],
          },
          modifications: {
            type: 'object',
            additionalProperties: false,
            properties: {
              potentialText: { type: 'string' },
              possiblePowerCv: { type: 'number' },
              possibleTorqueNm: { type: 'number' },
              parts: {
                type: 'array',
                minItems: 3,
                maxItems: 4,
                items: {
                  type: 'object',
                  additionalProperties: false,
                  properties: {
                    name: { type: 'string' },
                    reason: { type: 'string' },
                    estimatedPriceEuro: { type: 'number' },
                  },
                  required: ['name', 'reason', 'estimatedPriceEuro'],
                },
              },
            },
            required: ['potentialText', 'possiblePowerCv', 'possibleTorqueNm', 'parts'],
          },
          risks: {
            type: 'array',
            minItems: 3,
            maxItems: 3,
            items: { type: 'string' },
          },
          premiumOffer: {
            type: 'object',
            additionalProperties: false,
            properties: {
              title: { type: 'string' },
              intro: { type: 'string' },
              benefits: {
                type: 'array',
                minItems: 4,
                maxItems: 4,
                items: { type: 'string' },
              },
              cta: { type: 'string' },
              finalReinforcement: { type: 'string' },
            },
            required: ['title', 'intro', 'benefits', 'cta', 'finalReinforcement'],
          },
        },
        required: ['vehicleSheet', 'preInstallation', 'modifications', 'risks', 'premiumOffer'],
      },
      stages: {
        type: 'array',
        minItems: 4,
        maxItems: 4,
        items: {
          type: 'object',
          additionalProperties: false,
          properties: {
            label: { type: 'string' },
            focus: { type: 'string' },
            objective: { type: 'string' },
            parts: {
              type: 'array',
              minItems: 0,
              maxItems: 6,
              items: {
                type: 'object',
                additionalProperties: false,
                properties: {
                  name: { type: 'string' },
                  priceEuro: { type: 'number' },
                  explanation: { type: 'string' },
                },
                required: ['name', 'priceEuro', 'explanation'],
              },
            },
            note: { type: 'string' },
            whyThisStage: { type: 'string' },
            bestFor: { type: 'string' },
            watchouts: {
              type: 'array',
              minItems: 1,
              maxItems: 3,
              items: { type: 'string' },
            },
            gainCv: { type: 'number' },
            powerAfterCv: { type: 'number' },
            estimatedTorqueNm: { type: 'number' },
            costRangeEuro: { type: 'string' },
            reliability: { type: 'string', enum: ['alta', 'media', 'exigente'] },
            difficulty: { type: 'string', enum: ['baja', 'media', 'alta'] },
            legalImpact: { type: 'string' },
            detailLevel: { type: 'string', enum: ['full', 'summary'] },
            premiumLocked: { type: 'boolean' },
            installOrder: {
              type: 'array',
              minItems: 0,
              maxItems: 6,
              items: { type: 'string' },
            },
            dependencies: {
              type: 'array',
              minItems: 0,
              maxItems: 6,
              items: { type: 'string' },
            },
          },
          required: [
            'label',
            'focus',
            'objective',
            'parts',
            'note',
            'whyThisStage',
            'bestFor',
            'watchouts',
            'gainCv',
            'powerAfterCv',
            'estimatedTorqueNm',
            'costRangeEuro',
            'reliability',
            'difficulty',
            'legalImpact',
            'detailLevel',
            'premiumLocked',
            'installOrder',
            'dependencies',
          ],
        },
      },
      recommendedParts: {
        type: 'array',
        minItems: 3,
        maxItems: 4,
        items: {
          type: 'object',
          additionalProperties: false,
          properties: {
            name: { type: 'string' },
            reason: { type: 'string' },
            priority: { type: 'string', enum: ['alta', 'media', 'baja'] },
            impact: { type: 'string', enum: ['rendimiento', 'fiabilidad'] },
            estimatedPriceEuro: { type: 'number' },
          },
          required: ['name', 'reason', 'priority', 'impact', 'estimatedPriceEuro'],
        },
      },
      conversionTrigger: { type: 'string' },
      premiumUpsell: { type: 'string' },
      premiumSalesBlock: {
        type: 'object',
        additionalProperties: false,
        properties: {
          title: { type: 'string' },
          intro: { type: 'string' },
          riskBullets: {
            type: 'array',
            minItems: 3,
            maxItems: 3,
            items: { type: 'string' },
          },
          benefits: {
            type: 'array',
            minItems: 4,
            maxItems: 4,
            items: { type: 'string' },
          },
          priceEuro: { type: 'number' },
          cta: { type: 'string' },
          finalReinforcement: { type: 'string' },
        },
        required: [
          'title',
          'intro',
          'riskBullets',
          'benefits',
          'priceEuro',
          'cta',
          'finalReinforcement',
        ],
      },
      premiumPlan: {
        type: 'object',
        additionalProperties: false,
        properties: {
          title: { type: 'string' },
          summary: { type: 'string' },
          installOrder: {
            type: 'array',
            minItems: 3,
            maxItems: 10,
            items: { type: 'string' },
          },
          dependencies: {
            type: 'array',
            minItems: 3,
            maxItems: 10,
            items: { type: 'string' },
          },
          budgetPlan: {
            type: 'array',
            minItems: 2,
            maxItems: 6,
            items: {
              type: 'object',
              additionalProperties: false,
              properties: {
                phase: { type: 'string' },
                budgetEuro: { type: 'number' },
                objective: { type: 'string' },
              },
              required: ['phase', 'budgetEuro', 'objective'],
            },
          },
          specificWarnings: {
            type: 'array',
            minItems: 3,
            maxItems: 8,
            items: { type: 'string' },
          },
          evolutionStrategy: { type: 'string' },
        },
        required: [
          'title',
          'summary',
          'installOrder',
          'dependencies',
          'budgetPlan',
          'specificWarnings',
          'evolutionStrategy',
        ],
      },
      conclusion: {
        type: 'object',
        additionalProperties: false,
        properties: {
          recommendedStage: { type: 'string' },
          why: { type: 'string' },
          whatToAvoid: { type: 'string' },
        },
        required: ['recommendedStage', 'why', 'whatToAvoid'],
      },
      accessTier: { type: 'string', enum: ['free', 'premium'] },
      reasons: {
        type: 'array',
        minItems: 2,
        maxItems: 4,
        items: { type: 'string' },
      },
      warnings: {
        type: 'array',
        minItems: 2,
        maxItems: 4,
        items: { type: 'string' },
      },
    },
    required: [
      'title',
      'summary',
      'vehicleIdentity',
      'technicalProfile',
      'vehicleDiagnosis',
      'basePowerCv',
      'finalPowerCv',
      'factoryPowerSourceTitle',
      'factoryPowerSourceUrl',
      'expectedGain',
      'estimatedBudget',
      'reliabilityIndex',
      'executionTime',
      'ownerProfile',
      'drivability',
      'maintenanceLevel',
      'legalNote',
      'freeBuild',
      'stages',
      'recommendedParts',
      'conversionTrigger',
      'premiumUpsell',
      'premiumSalesBlock',
      'premiumPlan',
      'conclusion',
      'accessTier',
      'reasons',
      'warnings',
    ],
  };
}

function isHttpUrl(value) {
  return /^https?:\/\//i.test(String(value ?? '').trim());
}

function almostEqual(left, right, tolerance = 1) {
  return Math.abs(Number(left) - Number(right)) <= tolerance;
}

function validateGeneratedBuild(aiBuild, vehicle) {
  const errors = [];
  const identity = aiBuild?.vehicleIdentity;
  const stages = Array.isArray(aiBuild?.stages) ? aiBuild.stages : [];

  if (!identity) {
    errors.push('falta la identificacion tecnica del vehiculo');
  } else {
    if (identity.confidence !== 'alta') {
      errors.push('la IA no alcanzo confianza alta en la variante exacta');
    }

    if (!isHttpUrl(identity.sourceUrl) || !identity.sourceTitle.trim()) {
      errors.push('falta una fuente tecnica verificable para los CV de serie');
    }

    if (!almostEqual(aiBuild.basePowerCv, identity.factoryPowerCv)) {
      errors.push('basePowerCv no coincide con los CV de serie verificados');
    }

    if (normalize(identity.canonicalBrand) && normalize(vehicle.brand) !== normalize(identity.canonicalBrand)) {
      errors.push('la marca identificada no coincide con la marca solicitada');
    }

    if (vehicle.powertrain && identity.powertrain && normalize(vehicle.powertrain) !== normalize(identity.powertrain)) {
      errors.push('el combustible identificado no coincide con el declarado');
    }
  }

  if (stages.length !== 4) {
    errors.push('la build no contiene exactamente cuatro stages');
  }

  let expectedPower = Number(aiBuild?.basePowerCv);

  for (const [index, stage] of stages.entries()) {
    const expectedLabel = `STAGE ${index}`;
    const gainCv = Number(stage?.gainCv);
    const powerAfterCv = Number(stage?.powerAfterCv);

    const stageNumberMatch = normalize(stage?.label).match(/stage\s*(\d)/);
    const stageNumber = stageNumberMatch ? Number(stageNumberMatch[1]) : null;

    if (stageNumber !== index) {
      errors.push(`la etiqueta del stage ${index} no es ${expectedLabel}`);
    } else {
      stage.label = expectedLabel;
    }

    if (!Number.isFinite(gainCv) || gainCv < 0) {
      errors.push(`la ganancia del stage ${index} no es valida`);
    }

    if ((!Array.isArray(stage?.parts) || stage.parts.length < 1) && !stage?.premiumLocked && index !== 0) {
      errors.push(`el stage ${index} no tiene suficientes modificaciones`);
    }

    for (const [partIndex, part] of (stage?.parts ?? []).entries()) {
      if (!part?.name?.trim()) {
        errors.push(`falta el nombre de la modificacion ${partIndex + 1} del stage ${index}`);
      }

      if (!Number.isFinite(Number(part?.priceEuro)) || Number(part.priceEuro) <= 0) {
        errors.push(`el precio de la modificacion ${partIndex + 1} del stage ${index} no es valido`);
      }

      if (!part?.explanation?.trim()) {
        errors.push(`falta la explicacion de la modificacion ${partIndex + 1} del stage ${index}`);
      }
    }

    expectedPower += gainCv;

    if (!almostEqual(powerAfterCv, expectedPower)) {
      stage.powerAfterCv = expectedPower;
    }
  }

  const finalStagePower = Number(stages.at(-1)?.powerAfterCv);

  if (Number.isFinite(finalStagePower) && !almostEqual(aiBuild?.finalPowerCv, finalStagePower)) {
    aiBuild.finalPowerCv = finalStagePower;
  }

  if (!almostEqual(aiBuild?.basePowerCv, aiBuild?.vehicleIdentity?.factoryPowerCv)) {
    errors.push('la potencia base no coincide con la identidad verificada');
  }

  if (errors.length) {
    throw new VerificationError(
      `No se pudo verificar con suficiente precision el vehiculo y sus CV: ${errors.join('; ')}.`,
    );
  }

  return {
    ...aiBuild,
    factoryPowerSourceTitle: aiBuild.factoryPowerSourceTitle || identity.sourceTitle,
    factoryPowerSourceUrl: aiBuild.factoryPowerSourceUrl || identity.sourceUrl,
  };
}

async function generateBuildWithOpenAI(vehicle) {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error('Falta OPENAI_API_KEY en el entorno del backend.');
  }

  const requestBody = {
    model: OPENAI_MODEL,
    max_output_tokens: OPENAI_MAX_OUTPUT_TOKENS,
    input: buildPrompt(vehicle),
    text: {
      format: {
        type: 'json_schema',
        name: 'tuning_build',
        strict: true,
        schema: getBuildSchema(),
      },
    },
  };

  if (OPENAI_ENABLE_WEB_SEARCH) {
    requestBody.tools = [{ type: OPENAI_WEB_SEARCH_TOOL }];
    requestBody.tool_choice = 'auto';
  }

  const response = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
    },
    body: JSON.stringify(requestBody),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`OpenAI devolvio ${response.status}: ${errorText}`);
  }

  const payload = await response.json();

  if (payload.status === 'incomplete') {
    const reason = payload.incomplete_details?.reason;
    throw new AiOutputError(
      reason === 'max_output_tokens'
        ? 'La IA genero una build demasiado larga y se corto antes de terminar. Prueba de nuevo o reduce algun dato del formulario.'
        : 'La IA no termino la respuesta correctamente. Prueba de nuevo en unos segundos.',
    );
  }

  const outputText = extractStructuredOutput(payload);

  if (!outputText) {
    throw new Error('OpenAI no devolvio texto estructurado.');
  }

  let parsedBuild = null;

  try {
    parsedBuild = JSON.parse(outputText);
  } catch (error) {
    if (error instanceof SyntaxError) {
      throw new AiOutputError(
        'La IA devolvio una respuesta tecnica incompleta. Vuelve a generar la build para recibir el JSON completo.',
      );
    }

    throw error;
  }

  return validateGeneratedBuild(parsedBuild, vehicle);
}

function extractStructuredOutput(payload) {
  if (typeof payload?.output_text === 'string' && payload.output_text.trim()) {
    return payload.output_text.trim();
  }

  for (const outputItem of payload?.output ?? []) {
    for (const contentItem of outputItem?.content ?? []) {
      if (typeof contentItem?.text === 'string' && contentItem.text.trim()) {
        return contentItem.text.trim();
      }

      if (
        typeof contentItem?.text?.value === 'string' &&
        contentItem.text.value.trim()
      ) {
        return contentItem.text.value.trim();
      }

      if (typeof contentItem?.value === 'string' && contentItem.value.trim()) {
        return contentItem.value.trim();
      }

      if (typeof contentItem?.parsed === 'object' && contentItem.parsed) {
        return JSON.stringify(contentItem.parsed);
      }

      if (typeof contentItem?.json === 'object' && contentItem.json) {
        return JSON.stringify(contentItem.json);
      }

      if (typeof contentItem?.arguments === 'string' && contentItem.arguments.trim()) {
        return contentItem.arguments.trim();
      }
    }
  }

  return null;
}

function buildFirestoreDocument(aiBuild, vehicle) {
  const platformLookupKey = createPlatformLookupKey(vehicle);
  const fitScore = Math.max(
    82,
    Math.min(98, Math.round((Number(aiBuild.reliabilityIndex || 80) + 12) / 1.03)),
  );

  return {
    id: `ai-${slugify(vehicle.brand)}-${slugify(vehicle.model)}-${slugify(vehicle.generation)}-${slugify(vehicle.engine)}-${createMileageBucket(vehicle.mileageKm)}`,
    platformLookupKey,
    exactMatchKey: createExactMatchKey(vehicle),
    goalMatchKey: createGoalMatchKey(vehicle),
    brand: vehicle.brand,
    model: vehicle.model,
    generation: vehicle.generation,
    engine: vehicle.engine,
    powertrain: vehicle.powertrain,
    aspiration: vehicle.aspiration,
    mileageKm: normalizeMileageKm(vehicle.mileageKm),
    mileageBucket: createMileageBucket(vehicle.mileageKm),
    usage: vehicle.usage,
    goal: vehicle.goal,
    priority: vehicle.priority,
    budget: vehicle.budget,
    fitScore,
    name: aiBuild.title,
    title: aiBuild.title,
    summary: aiBuild.summary,
    vehicleIdentity: aiBuild.vehicleIdentity,
    technicalProfile: aiBuild.technicalProfile,
    vehicleDiagnosis: aiBuild.vehicleDiagnosis,
    basePowerCv: Number(aiBuild.basePowerCv || 0),
    finalPowerCv: Number(aiBuild.finalPowerCv || 0),
    factoryPowerSourceTitle: aiBuild.factoryPowerSourceTitle || '',
    factoryPowerSourceUrl: aiBuild.factoryPowerSourceUrl || '',
    expectedGain: aiBuild.expectedGain,
    estimatedBudget: Number(aiBuild.estimatedBudget || 0),
    reliabilityIndex: Number(aiBuild.reliabilityIndex || 80),
    executionTime: aiBuild.executionTime,
    ownerProfile: aiBuild.ownerProfile,
    drivability: aiBuild.drivability,
    maintenanceLevel: aiBuild.maintenanceLevel,
    legalNote: aiBuild.legalNote,
    freeBuild: aiBuild.freeBuild,
    stages: aiBuild.stages,
    recommendedParts: aiBuild.recommendedParts,
    conversionTrigger: aiBuild.conversionTrigger,
    premiumUpsell: aiBuild.premiumUpsell,
    premiumSalesBlock: aiBuild.premiumSalesBlock,
    premiumPlan: aiBuild.premiumPlan,
    conclusion: aiBuild.conclusion,
    accessTier: aiBuild.accessTier,
    reasons: aiBuild.reasons,
    warnings: aiBuild.warnings,
    isFeatured: true,
    sourceModel: OPENAI_MODEL,
    sourceType: 'openai',
    year: normalizeYear(vehicle.year),
    updatedAt: FieldValue.serverTimestamp(),
    createdAt: FieldValue.serverTimestamp(),
  };
}

async function upsertBuild(db, documentData) {
  const { id, ...payload } = documentData;
  await db.collection('builds').doc(id).set(payload, { merge: true });
  return { id, ...payload };
}

const server = createServer(async (request, response) => {
  const requestPath = new URL(request.url, `http://${request.headers.host ?? 'localhost'}`).pathname;

  if (request.method === 'OPTIONS') {
    sendJson(response, 204, {});
    return;
  }

  if (requestPath === '/' && request.method === 'GET') {
    sendJson(response, 200, {
      ok: true,
      service: 'tuning-hub-api',
      routes: [
        '/api/health',
        '/api/generate-build',
        '/api/create-checkout-session',
        '/api/create-embedded-checkout-session',
        '/api/checkout-session-status',
      ],
    });
    return;
  }

  if (requestPath === '/api/health' && request.method === 'GET') {
    sendJson(response, 200, { ok: true });
    return;
  }

  if (requestPath === '/api/generate-build' && request.method === 'POST') {
    try {
      const vehicle = await readBody(request);

      if (!validateVehicle(vehicle)) {
        sendJson(response, 400, {
          error: 'Faltan datos del vehiculo. Marca, modelo, generacion, motor y combustible son obligatorios.',
        });
        return;
      }

      const aiBuild = await generateBuildWithOpenAI(vehicle);
      let resultBuild = {
        id: `ai-${slugify(vehicle.brand)}-${slugify(vehicle.model)}-${slugify(vehicle.generation)}-${slugify(vehicle.engine)}-${createMileageBucket(vehicle.mileageKm)}`,
        ...aiBuild,
      };

      try {
        const db = await ensureFirestore();
        resultBuild = await upsertBuild(db, buildFirestoreDocument(aiBuild, vehicle));
      } catch (saveError) {
        console.warn(
          `No se pudo guardar la build generada, pero se devuelve igualmente: ${saveError.message}`,
        );
      }

      sendJson(response, 200, {
        mode: 'generated',
        result: formatBuildResult(resultBuild, vehicle, 'generated'),
      });
      return;
    } catch (error) {
      if (error instanceof BadRequestError) {
        sendJson(response, 400, { error: error.message });
        return;
      }

      if (error instanceof VerificationError) {
        sendJson(response, 422, { error: error.message, code: 'VEHICLE_VERIFICATION_FAILED' });
        return;
      }

      if (error instanceof AiOutputError) {
        sendJson(response, 502, { error: error.message, code: 'AI_OUTPUT_INCOMPLETE' });
        return;
      }

      sendJson(response, 500, {
        error: error.message || 'No se pudo generar la build con OpenAI.',
      });
      return;
    }
  }

  if (requestPath === '/api/create-checkout-session' && request.method === 'POST') {
    try {
      const payload = await readBody(request);
      const session = await createStripeCheckoutSession({
        origin: payload.origin || getRequestOrigin(request),
        vehicleName: payload.vehicleName,
        buildId: payload.buildId,
      });

      sendJson(response, 200, session);
      return;
    } catch (error) {
      sendJson(response, 500, {
        error: error.message || 'No se pudo crear la sesion de pago con Stripe.',
      });
      return;
    }
  }

  if (requestPath === '/api/create-embedded-checkout-session' && request.method === 'POST') {
    try {
      const payload = await readBody(request);
      const session = await createStripeEmbeddedCheckoutSession({
        origin: payload.origin || getRequestOrigin(request),
        vehicleName: payload.vehicleName,
        buildId: payload.buildId,
      });

      sendJson(response, 200, session);
      return;
    } catch (error) {
      sendJson(response, 500, {
        error: error.message || 'No se pudo crear el pago integrado con Stripe.',
      });
      return;
    }
  }

  if (requestPath === '/api/checkout-session-status' && request.method === 'GET') {
    try {
      const requestUrl = new URL(request.url, `http://${request.headers.host ?? 'localhost'}`);
      const session = await retrieveStripeCheckoutSession(requestUrl.searchParams.get('session_id'));

      sendJson(response, 200, session);
      return;
    } catch (error) {
      const statusCode = error instanceof BadRequestError ? 400 : 500;
      sendJson(response, statusCode, {
        error: error.message || 'No se pudo verificar el pago con Stripe.',
      });
      return;
    }
  }

  sendJson(response, 404, { error: 'Ruta no encontrada.' });
});

server.listen(PORT, () => {
  console.log(`Backend listo en puerto ${PORT}`);
});
