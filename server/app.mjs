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
    expectedGain: build.expectedGain ?? null,
    estimatedBudget: build.estimatedBudget ?? null,
    reliabilityIndex: build.reliabilityIndex ?? null,
    executionTime: build.executionTime ?? null,
  };
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
  return docs.find((doc) => !doc.powertrain || doc.powertrain === vehicle.powertrain) ?? docs[0];
}

function buildPrompt(vehicle) {
  return [
    'Eres un especialista en preparaciones realistas para coches de calle.',
    'Genera una build en español muy utilizable y nada fantasiosa.',
    'No recomiendes anulaciones ilegales ni piezas absurdas.',
    'Si el codigo motor exacto no esta confirmado, dilo claramente en advertencias.',
    'Piensa en uso real, fiabilidad y coherencia mecanica.',
    `Vehiculo: ${vehicle.brand} ${vehicle.model} ${vehicle.generation} ${vehicle.engine}.`,
    `Combustible: ${vehicle.powertrain}.`,
    `Admision: ${vehicle.aspiration}.`,
    `Cambio: ${vehicle.transmission}.`,
    `Traccion: ${vehicle.drivetrain}.`,
    `Uso: ${vehicle.usage}.`,
    `Prioridad: ${vehicle.priority}.`,
    vehicle.aspiration === 'atmosferico'
      ? 'Si el motor es atmosferico, evita vender ganancias exageradas y prioriza respuesta, admision, escape, chasis y coherencia.'
      : 'Si el motor es turbo, puedes plantear una ruta de stage mas clara, pero siempre indicando soporte de embrague, temperatura o frenos cuando haga falta.',
    'Devuelve exactamente 3 stages: STAGE 1, STAGE 2 y STAGE 3.',
    'Cada stage debe incluir focus, parts y note.',
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
          },
          required: ['label', 'focus', 'parts', 'note'],
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

  const response = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
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
    }),
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
