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
    radical: 'maximo rendimiento dentro del limite razonable de la plataforma, aunque suba coste y exigencia mecanica',
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
      engine: vehicle.engine,
      powertrain: vehicle.powertrain,
      aspiration: vehicle.aspiration,
      transmission: vehicle.transmission,
      drivetrain: vehicle.drivetrain,
      usage: vehicle.usage,
      goal: vehicle.goal,
      priority: vehicle.priority,
      budget: vehicle.budget,
    },
    null,
    2,
  );

  return [
    'Actua como un experto en tuning de coches especializado en el mercado espanol, con foco en builds realistas, progresivas y habituales en Espana.',
    'Tu trabajo tiene dos fases obligatorias: primero identificar el vehiculo con precision y despues proponer una build coherente.',
    'Tu prioridad absoluta es IDENTIFICAR correctamente el vehiculo antes de recomendar ninguna modificacion.',
    'No puedes inventar CV, motor, generacion, traccion, transmision, aspiracion ni caracteristicas tecnicas.',
    'Si no puedes verificar una coincidencia exacta o casi exacta, marca vehicleIdentity.confidence como "baja" y explica la duda en warnings.',
    'La build solo sera aceptada si vehicleIdentity.confidence es "alta", hay fuente de CV y los numeros cuadran.',
    'Entrada del usuario en JSON:',
    userVehicleJson,
    '',
    'Proceso obligatorio:',
    '1. Interpreta marca, modelo, generacion/fase y motor como una consulta de identificacion, no como verdad garantizada.',
    '2. Busca o contrasta una fuente tecnica fiable para la potencia de serie: ficha oficial, catalogo tecnico, ficha de fabricante, base de datos tecnica reconocida o pagina especializada con especificacion concreta.',
    '3. Si hay varias variantes con el mismo motor, elige solo la que coincida con generacion, rango de produccion, combustible, aspiracion y potencia. Si no se puede distinguir, baja la confianza.',
    '4. No mezcles generaciones. No uses datos de otro mercado si cambian CV, motor o transmision sin avisar.',
    '5. basePowerCv debe ser exactamente la potencia de serie verificada en CV/PS para esa variante. Si la fuente esta en HP/BHP/kW, convierte con prudencia y menciona la fuente.',
    '6. factoryPowerSourceTitle y factoryPowerSourceUrl son obligatorios si confidence es "alta".',
    '7. Genera una build REALISTA y bien estructurada para Espana, priorizando el objetivo real del usuario por encima de una receta generica.',
    '8. Usa modificaciones comunes y reales en Espana. No inventes piezas irreales, configuraciones raras ni anulaciones ilegales.',
    '9. Cada modificacion debe tener nombre especifico, precio aproximado en euros y explicacion breve de una sola linea.',
    '10. Los stages deben ser matematicamente coherentes: powerAfterCv de STAGE 1 = basePowerCv + gainCv; cada stage siguiente suma sobre el anterior; finalPowerCv = powerAfterCv de STAGE 3.',
    '11. Las piezas deben ser compatibles con el tipo de motor. No recomiendes turbo/downpipe/intercooler en atmosfericos salvo que expliques una conversion realista.',
    '12. Si el codigo motor exacto no esta confirmado, la advertencia debe decirlo y la confianza no debe ser alta.',
    '',
    `Traccion declarada por usuario: ${describeDrivetrain(vehicle.drivetrain)}.`,
    `Uso: ${describeUsage(vehicle.usage)}.`,
    `Prioridad: ${describePriority(vehicle.priority)}.`,
    `Objetivo principal declarado: ${vehicle.goal}.`,
    vehicle.priority === 'radical'
      ? 'El usuario ha pedido una build ambiciosa. No recortes la receta por conservadurismo: puedes acercarte al limite razonable de la plataforma, siempre con soporte mecanico, frenos, temperatura, transmision y advertencias honestas.'
      : 'Si el objetivo no es radical, evita exagerar cifras o montar una receta demasiado extrema para el uso declarado.',
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
      ? 'Usa busqueda web antes de fijar CV de serie y caracteristicas. No basta con memoria general.'
      : 'Antes de estimar la potencia, usa tu conocimiento tecnico y se prudente si no tienes confirmacion exacta.',
    'vehicleIdentity debe resumir la variante identificada: canonicalBrand, canonicalModel, canonicalGeneration, canonicalEngine, productionYears, powertrain, aspiration, transmission, drivetrain, factoryPowerCv, confidence, sourceTitle y sourceUrl.',
    'La build debe estar escrita en espanol claro, directo y practico.',
    'Cada stage debe sonar especifico para la plataforma y no como una plantilla universal.',
    'En STAGE 1 prioriza la mejora mas razonable para el objetivo declarado. En STAGE 2 solo escala si tiene sentido. En STAGE 3 refuerza soporte, frenos, temperatura, embrague, diferencial o chasis segun corresponda y solo si de verdad tiene sentido para ese coche.',
    'No repitas la misma pieza con otro nombre en distintos stages.',
    'No uses frases vacias como "mejora integral" o "setup equilibrado" sin concretar piezas y motivo.',
    'Si el coche es una base de diario, evita una STAGE 3 absurda; puede ser un stage de soporte y afinado final, no necesariamente una locura de potencia.',
    'Si el usuario busca maxima potencia o una build radical, la STAGE 3 si puede ser claramente mas seria, siempre que expliques por que sigue siendo razonable para esa plataforma.',
    'Las parts deben ser un array de objetos con name, priceEuro y explanation.',
    'priceEuro debe ser un numero entero aproximado en euros para esa modificacion concreta.',
    'explanation debe explicar en una sola linea por que encaja esa modificacion en la build.',
    'Las warnings deben ser honestas y especificas para ese tipo de coche, no advertencias universales sin valor.',
    'Las reasons deben explicar por que esa ruta tiene sentido para ese coche en particular.',
    'Debes estimar los CV de partida del coche, la ganancia aproximada de cada STAGE y los CV aproximados despues de cada STAGE.',
    'Usa cifras prudentes y creibles para ese motor. Si no es un motor claramente potenciable, manten ganancias discretas.',
    'expectedGain debe ser prudente y creible. estimatedBudget debe ser un numero entero en euros y coherente con la suma de las modificaciones. reliabilityIndex debe ser un numero del 1 al 100.',
    'summary debe sonar premium, concreta y orientada al usuario final, incluyendo mejora estimada, nivel de coste y nivel de fiabilidad.',
    'Devuelve exactamente 3 stages: STAGE 1, STAGE 2 y STAGE 3.',
    'Cada stage debe incluir focus, parts, note, gainCv y powerAfterCv.',
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
        ],
      },
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
      'vehicleIdentity',
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

  if (stages.length !== 3) {
    errors.push('la build no contiene exactamente tres stages');
  }

  let expectedPower = Number(aiBuild?.basePowerCv);

  for (const [index, stage] of stages.entries()) {
    const expectedLabel = `STAGE ${index + 1}`;
    const gainCv = Number(stage?.gainCv);
    const powerAfterCv = Number(stage?.powerAfterCv);

    if (stage?.label !== expectedLabel) {
      errors.push(`la etiqueta del stage ${index + 1} no es ${expectedLabel}`);
    }

    if (!Number.isFinite(gainCv) || gainCv <= 0) {
      errors.push(`la ganancia del stage ${index + 1} no es valida`);
    }

    if (!Array.isArray(stage?.parts) || stage.parts.length < 2) {
      errors.push(`el stage ${index + 1} no tiene suficientes modificaciones`);
    }

    for (const [partIndex, part] of (stage?.parts ?? []).entries()) {
      if (!part?.name?.trim()) {
        errors.push(`falta el nombre de la modificacion ${partIndex + 1} del stage ${index + 1}`);
      }

      if (!Number.isFinite(Number(part?.priceEuro)) || Number(part.priceEuro) <= 0) {
        errors.push(`el precio de la modificacion ${partIndex + 1} del stage ${index + 1} no es valido`);
      }

      if (!part?.explanation?.trim()) {
        errors.push(`falta la explicacion de la modificacion ${partIndex + 1} del stage ${index + 1}`);
      }
    }

    expectedPower += gainCv;

    if (!almostEqual(powerAfterCv, expectedPower)) {
      errors.push(`los CV despues del stage ${index + 1} no cuadran con la suma acumulada`);
    }
  }

  if (!almostEqual(aiBuild?.finalPowerCv, stages.at(-1)?.powerAfterCv)) {
    errors.push('finalPowerCv no coincide con la potencia despues del STAGE 3');
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

  return validateGeneratedBuild(JSON.parse(outputText), vehicle);
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
    vehicleIdentity: aiBuild.vehicleIdentity,
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
  const requestPath = new URL(request.url, `http://${request.headers.host ?? 'localhost'}`).pathname;

  if (request.method === 'OPTIONS') {
    sendJson(response, 204, {});
    return;
  }

  if (requestPath === '/' && request.method === 'GET') {
    sendJson(response, 200, {
      ok: true,
      service: 'tuning-hub-api',
      routes: ['/api/health', '/api/generate-build'],
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
      if (error instanceof BadRequestError) {
        sendJson(response, 400, { error: error.message });
        return;
      }

      if (error instanceof VerificationError) {
        sendJson(response, 422, { error: error.message, code: 'VEHICLE_VERIFICATION_FAILED' });
        return;
      }

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
