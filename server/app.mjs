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

  for (const line of envContent.split(/\r?\n/)) {
    const trimmedLine = line.trim();

    if (!trimmedLine || trimmedLine.startsWith('#')) {
      continue;
    }

    const separatorIndex = trimmedLine.indexOf('=');

    if (separatorIndex === -1) {
      continue;
    }

    const key = trimmedLine.slice(0, separatorIndex).trim();
    const value = trimmedLine.slice(separatorIndex + 1).trim();

    if (!process.env[key]) {
      process.env[key] = value;
    }
  }
}

loadEnvFile();

const PORT = Number(process.env.PORT || process.env.BACKEND_PORT || 8787);
const OPENAI_MODEL = process.env.OPENAI_MODEL || 'gpt-4o-mini';
const OPENAI_ENABLE_WEB_SEARCH = process.env.OPENAI_ENABLE_WEB_SEARCH !== 'false';
const OPENAI_WEB_SEARCH_TOOL = process.env.OPENAI_WEB_SEARCH_TOOL || 'web_search_preview';

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
  }[priority] ?? 'equilibrio general';
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

  const traits = [];
  const cautions = [];
  const stagePriorities = [];

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
  };
}

function hasCompletePowerProfile(build) {
  return Boolean(
    Number(build?.basePowerCv) > 0 &&
      Number(build?.finalPowerCv) > 0 &&
      Array.isArray(build?.stages) &&
      build.stages.length === 3 &&
      build.stages.every((stage) => Number(stage?.gainCv) > 0 && Number(stage?.powerAfterCv) > 0),
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
  return rawBody ? JSON.parse(rawBody) : {};
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

  return [
    'Eres un especialista en preparaciones realistas para coches de calle.',
    'Tu trabajo es recomendar una build que parezca escrita por alguien que conoce de verdad esa plataforma.',
    'Genera una build en español muy utilizable, concreta y nada fantasiosa.',
    'No recomiendes anulaciones ilegales ni piezas absurdas.',
    'Si el codigo motor exacto no esta confirmado, dilo claramente en advertencias.',
    'Piensa en uso real, fiabilidad y coherencia mecanica.',
    `Vehiculo: ${vehicle.brand} ${vehicle.model} ${vehicle.generation} ${vehicle.engine}.`,
    `Combustible: ${vehicle.powertrain}.`,
    `Admision: ${vehicle.aspiration}.`,
    `Cambio: ${vehicle.transmission}.`,
    `Traccion: ${describeDrivetrain(vehicle.drivetrain)}.`,
    `Uso: ${describeUsage(vehicle.usage)}.`,
    `Prioridad: ${describePriority(vehicle.priority)}.`,
    vehicle.aspiration === 'atmosferico'
      ? 'Si el motor es atmosferico, evita vender ganancias exageradas y prioriza respuesta, admision, escape, chasis y coherencia.'
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
      ? 'Antes de estimar la potencia, busca en la web la ficha tecnica o una fuente razonable para el coche exacto indicado por marca, modelo, generacion/fase y motor.'
      : 'Antes de estimar la potencia, usa tu conocimiento tecnico y se prudente si no tienes confirmacion exacta.',
    'El objetivo es encontrar los CV de serie del vehiculo exacto. Si hay varias variantes, elige la que coincida mejor con motor, generacion y combustible.',
    'Devuelve factoryPowerSourceTitle y factoryPowerSourceUrl con la fuente usada para los CV de serie. Si no encuentras fuente clara, usa cadenas vacias y explica la incertidumbre en warnings.',
    'Cada stage debe sonar especifico para la plataforma y no como una plantilla universal.',
    'En STAGE 1 prioriza la mejora mas razonable. En STAGE 2 solo escala si tiene sentido. En STAGE 3 refuerza soporte, frenos, temperatura, embrague, diferencial o chasis segun corresponda.',
    'No repitas la misma pieza con otro nombre en distintos stages.',
    'No uses frases vacias como "mejora integral" o "setup equilibrado" sin concretar piezas y motivo.',
    'Si el coche es una base de diario, evita una STAGE 3 absurda; puede ser un stage de soporte y afinado final, no necesariamente una locura de potencia.',
    'Las parts deben ser piezas o acciones concretas, cortas y utiles para el usuario final.',
    'Las warnings deben ser honestas y especificas para ese tipo de coche, no advertencias universales sin valor.',
    'Las reasons deben explicar por que esa ruta tiene sentido para ese coche en particular.',
    'Debes estimar los CV de partida del coche, la ganancia aproximada de cada STAGE y los CV aproximados despues de cada STAGE.',
    'Usa cifras prudentes y creibles para ese motor. Si no es un motor claramente potenciable, manten ganancias discretas.',
    'expectedGain debe ser prudente y creible. estimatedBudget debe ser un numero entero en euros. reliabilityIndex debe ser un numero del 1 al 100.',
    'summary debe sonar premium, concreta y orientada al usuario final.',
    'Devuelve exactamente 3 stages: STAGE 1, STAGE 2 y STAGE 3.',
    'Cada stage debe incluir focus, parts, note, gainCv y powerAfterCv.',
    'La respuesta debe ser estrictamente JSON siguiendo el schema.',
  ].join('\n');
}

function getBuildSchema() {
  return {
    type: 'object',
    additionalProperties: false,
    properties: {
      title: { type: 'string' },
      summary: { type: 'string' },
      basePowerCv: { type: 'number' },
      finalPowerCv: { type: 'number' },
      factoryPowerSourceTitle: { type: 'string' },
      factoryPowerSourceUrl: { type: 'string' },
      expectedGain: { type: 'string' },
      estimatedBudget: { type: 'number' },
      reliabilityIndex: { type: 'number' },
      executionTime: { type: 'string' },
      stages: {
        type: 'array',
        minItems: 3,
        maxItems: 3,
        items: {
          type: 'object',
          additionalProperties: false,
          properties: {
            label: { type: 'string' },
            focus: { type: 'string' },
            parts: {
              type: 'array',
              minItems: 2,
              maxItems: 6,
              items: { type: 'string' },
            },
            note: { type: 'string' },
            gainCv: { type: 'number' },
            powerAfterCv: { type: 'number' },
          },
          required: ['label', 'focus', 'parts', 'note', 'gainCv', 'powerAfterCv'],
        },
      },
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
      'basePowerCv',
      'finalPowerCv',
      'factoryPowerSourceTitle',
      'factoryPowerSourceUrl',
      'expectedGain',
      'estimatedBudget',
      'reliabilityIndex',
      'executionTime',
      'stages',
      'reasons',
      'warnings',
    ],
  };
}

async function generateBuildWithOpenAI(vehicle) {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error('Falta OPENAI_API_KEY en el entorno del backend.');
  }

  const requestBody = {
    model: OPENAI_MODEL,
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
  const outputText = extractStructuredOutput(payload);

  if (!outputText) {
    throw new Error('OpenAI no devolvio texto estructurado.');
  }

  return JSON.parse(outputText);
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
    id: `ai-${slugify(vehicle.brand)}-${slugify(vehicle.model)}-${slugify(vehicle.generation)}-${slugify(vehicle.engine)}`,
    platformLookupKey,
    exactMatchKey: createExactMatchKey(vehicle),
    goalMatchKey: createGoalMatchKey(vehicle),
    brand: vehicle.brand,
    model: vehicle.model,
    generation: vehicle.generation,
    engine: vehicle.engine,
    powertrain: vehicle.powertrain,
    aspiration: vehicle.aspiration,
    usage: vehicle.usage,
    goal: vehicle.goal,
    priority: vehicle.priority,
    budget: vehicle.budget,
    fitScore,
    name: aiBuild.title,
    title: aiBuild.title,
    summary: aiBuild.summary,
    basePowerCv: Number(aiBuild.basePowerCv || 0),
    finalPowerCv: Number(aiBuild.finalPowerCv || 0),
    factoryPowerSourceTitle: aiBuild.factoryPowerSourceTitle || '',
    factoryPowerSourceUrl: aiBuild.factoryPowerSourceUrl || '',
    expectedGain: aiBuild.expectedGain,
    estimatedBudget: Number(aiBuild.estimatedBudget || 0),
    reliabilityIndex: Number(aiBuild.reliabilityIndex || 80),
    executionTime: aiBuild.executionTime,
    stages: aiBuild.stages,
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
  if (request.method === 'OPTIONS') {
    sendJson(response, 204, {});
    return;
  }

  if (request.url === '/' && request.method === 'GET') {
    sendJson(response, 200, {
      ok: true,
      service: 'tuning-hub-api',
      routes: ['/api/health', '/api/generate-build'],
    });
    return;
  }

  if (request.url === '/api/health' && request.method === 'GET') {
    sendJson(response, 200, { ok: true });
    return;
  }

  if (request.url === '/api/generate-build' && request.method === 'POST') {
    try {
      const vehicle = await readBody(request);

      if (!validateVehicle(vehicle)) {
        sendJson(response, 400, {
          error: 'Faltan datos del vehiculo. Marca, modelo, generacion, motor y combustible son obligatorios.',
        });
        return;
      }

      const db = await ensureFirestore();
      const existingBuild = await findExistingBuild(db, vehicle);

      if (existingBuild) {
        sendJson(response, 200, {
          mode: 'cached',
          result: formatBuildResult(existingBuild, vehicle, 'database'),
        });
        return;
      }

      const aiBuild = await generateBuildWithOpenAI(vehicle);
      const savedBuild = await upsertBuild(db, buildFirestoreDocument(aiBuild, vehicle));

      sendJson(response, 200, {
        mode: 'generated',
        result: formatBuildResult(savedBuild, vehicle, 'generated'),
      });
      return;
    } catch (error) {
      sendJson(response, 500, {
        error: error.message || 'No se pudo generar la build con OpenAI.',
      });
      return;
    }
  }

  sendJson(response, 404, { error: 'Ruta no encontrada.' });
});

server.listen(PORT, () => {
  console.log(`Backend listo en puerto ${PORT}`);
});
