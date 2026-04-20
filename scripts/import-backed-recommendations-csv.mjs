import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');

function resolveFromRoot(targetPath) {
  return path.isAbsolute(targetPath) ? targetPath : path.resolve(projectRoot, targetPath);
}

function repairMojibake(value) {
  const text = String(value ?? '');

  if (!/[ÃÂ]/.test(text)) {
    return text;
  }

  try {
    return Buffer.from(text, 'latin1').toString('utf8');
  } catch {
    return text;
  }
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

function toTitleCase(value) {
  return String(value ?? '')
    .split(/\s+/)
    .filter(Boolean)
    .map((token) => token.charAt(0).toUpperCase() + token.slice(1).toLowerCase())
    .join(' ');
}

function parseCsv(content) {
  const rows = [];
  let current = '';
  let currentRow = [];
  let inQuotes = false;

  for (let index = 0; index < content.length; index += 1) {
    const char = content[index];
    const nextChar = content[index + 1];

    if (char === '"' && inQuotes && nextChar === '"') {
      current += '"';
      index += 1;
      continue;
    }

    if (char === '"') {
      inQuotes = !inQuotes;
      continue;
    }

    if (char === ',' && !inQuotes) {
      currentRow.push(repairMojibake(current.trim()));
      current = '';
      continue;
    }

    if ((char === '\n' || char === '\r') && !inQuotes) {
      if (char === '\r' && nextChar === '\n') {
        index += 1;
      }

      if (current.length > 0 || currentRow.length > 0) {
        currentRow.push(repairMojibake(current.trim()));
        rows.push(currentRow);
        currentRow = [];
        current = '';
      }

      continue;
    }

    current += char;
  }

  if (current.length > 0 || currentRow.length > 0) {
    currentRow.push(repairMojibake(current.trim()));
    rows.push(currentRow);
  }

  const [header = [], ...dataRows] = rows;

  return dataRows
    .filter((row) => row.some((cell) => String(cell).trim() !== ''))
    .map((row) =>
      Object.fromEntries(header.map((key, index) => [key, repairMojibake(row[index] ?? '')])),
    );
}

function detectPowertrain(engine, profile, recommendation) {
  const haystack = normalize([engine, profile, recommendation].filter(Boolean).join(' '));

  if (/(tdi|tdci|dci|hdi|jtd|mjet|cdti|crdi|cdi|d4d|multijet|diesel)/.test(haystack)) {
    return 'diesel';
  }

  if (/(hybrid|hibrid|phev|hev)/.test(haystack)) {
    return 'hibrido';
  }

  if (/(ev|electrico)/.test(haystack)) {
    return 'electrico';
  }

  return 'gasolina';
}

function splitList(text, limit = 4) {
  return String(text ?? '')
    .replace(/\.+/g, '.')
    .split(/[;,]|(?:\.\s+)/)
    .map((item) => item.trim().replace(/^[-–]\s*/, ''))
    .filter(Boolean)
    .slice(0, limit);
}

function compactSentence(text, maxLength = 180) {
  const sentence = String(text ?? '').replace(/\s+/g, ' ').trim();
  if (sentence.length <= maxLength) {
    return sentence;
  }

  return `${sentence.slice(0, maxLength - 1).trimEnd()}…`;
}

function extractExpectedGain(resultText) {
  const normalizedText = String(resultText ?? '').replace(/\s+/g, ' ').trim();

  if (!normalizedText) {
    return 'Mejora sensible segun el estado real de la base';
  }

  const match = normalizedText.match(
    /(~?\s*\d+\s*(?:-\s*\d+)?\s*(?:bhp|hp|ps|cv)[^.,;)]*)/i,
  );

  if (match) {
    return match[1].replace(/\s+/g, ' ').trim();
  }

  return compactSentence(normalizedText, 80);
}

function inferBudgetAmount(row) {
  const haystack = normalize(
    [row.titulo, row.recomendacion, row.resultado_esperado, row.prerrequisitos].join(' '),
  );

  let amount = 900;

  if (/(turbo|hibrido|vnt17|vnt-17|injectores|inyectores|bomba 11 mm|intercooler)/.test(haystack)) {
    amount += 1700;
  }

  if (/(embrague|frenos|suspension|suspensión)/.test(haystack)) {
    amount += 700;
  }

  if (/(stage 1|repro|mapa|remap)/.test(haystack)) {
    amount += 350;
  }

  return amount;
}

function inferBudgetLabel(amount) {
  if (amount >= 2800) {
    return 'alto';
  }

  if (amount >= 1600) {
    return 'medio';
  }

  return 'bajo';
}

function inferUsage(profile) {
  const normalizedProfile = normalize(profile);
  return /(track|finde|weekend)/.test(normalizedProfile) ? 'finde' : 'diario';
}

function inferPriority(type) {
  const normalizedType = normalize(type);

  if (normalizedType.includes('fiabilidad')) {
    return 'fiabilidad';
  }

  if (normalizedType.includes('potencia')) {
    return 'potencia';
  }

  return 'equilibrio';
}

function inferReliability(level, confidence) {
  const combined = normalize(`${level} ${confidence}`);

  if (combined.includes('alta')) {
    return 90;
  }

  if (combined.includes('media-alta') || combined.includes('medio-alto')) {
    return 84;
  }

  if (combined.includes('media')) {
    return 78;
  }

  return 72;
}

function buildStages(row) {
  const stageOneParts = [
    row.titulo,
    ...splitList(row.recomendacion, 3),
  ]
    .map((item) => compactSentence(item, 96))
    .filter(Boolean);

  const stageTwoParts = [
    ...splitList(row.prerrequisitos, 4),
    row.requiere_codigo_motor === 'Sí' || row.requiere_codigo_motor === 'Si'
      ? 'Confirmar codigo motor exacto antes de comprar piezas'
      : null,
  ]
    .filter(Boolean)
    .map((item) => compactSentence(item, 90));

  const stageThreeParts = splitList(row.vigilar, 4).map((item) => compactSentence(item, 90));

  return [
    {
      label: 'STAGE 1',
      focus: 'Ruta principal',
      parts: [...new Set(stageOneParts)].slice(0, 4),
      note:
        compactSentence(row.resultado_esperado, 160) ||
        'Base recomendada para mejorar el coche sin perder coherencia de uso.',
    },
    {
      label: 'STAGE 2',
      focus: 'Prerequisitos',
      parts:
        stageTwoParts.length > 0
          ? [...new Set(stageTwoParts)].slice(0, 4)
          : ['Puesta a punto, mantenimiento al dia y verificacion de la base'],
      note:
        'Antes de apretar mas, conviene asegurar que la base mecanica y el soporte acompanen la recomendacion.',
    },
    {
      label: 'STAGE 3',
      focus: 'Lo que debes vigilar',
      parts:
        stageThreeParts.length > 0
          ? [...new Set(stageThreeParts)].slice(0, 4)
          : ['Revisar temperatura, fiabilidad y comportamiento despues del ajuste'],
      note:
        compactSentence(row.nota_legal, 160) ||
        'Ultima capa pensada para mantener una preparacion utilizable y razonable para calle.',
    },
  ];
}

function buildReasons(row) {
  return [
    compactSentence(row.resultado_esperado, 160) ||
      `${row.marca} ${row.modelo} ${row.generacion} ${row.motor} tiene una ruta clara de mejora.`,
    `Nivel de respaldo ${String(row.nivel_respaldo ?? '').toLowerCase()} con confianza ${String(row.confianza ?? '').toLowerCase()}.`,
    row.fuente_1_url
      ? 'La recomendacion parte de referencias reales y no de una build generica inventada.'
      : 'La build se ha adaptado a la informacion tecnica disponible para ese conjunto.',
  ];
}

function buildWarnings(row) {
  const warnings = [];

  if (row.vigilar) {
    warnings.push(compactSentence(row.vigilar, 160));
  }

  if (row.requiere_codigo_motor === 'Sí' || row.requiere_codigo_motor === 'Si') {
    warnings.push('Conviene confirmar el codigo motor exacto antes de comprar piezas o cerrar la receta.');
  }

  if (row.nota_legal) {
    warnings.push(compactSentence(row.nota_legal, 160));
  }

  return warnings.slice(0, 3);
}

function buildCatalog(rows) {
  const brandSet = new Set();
  const models = {};
  const variants = {};

  for (const row of rows) {
    const brand = row.marca.trim();
    const model = row.modelo.trim();
    const generation = row.generacion.trim();
    const engine = row.motor.trim();
    const powertrain = detectPowertrain(row.motor, row.perfil, row.recomendacion);

    brandSet.add(brand);
    models[brand] ??= [];
    if (!models[brand].includes(model)) {
      models[brand].push(model);
    }

    variants[brand] ??= {};
    variants[brand][model] ??= {
      generations: [],
      engines: [],
      generationEngines: {},
      generationEngineMeta: {},
    };

    if (!variants[brand][model].generations.includes(generation)) {
      variants[brand][model].generations.push(generation);
    }

    if (!variants[brand][model].engines.includes(engine)) {
      variants[brand][model].engines.push(engine);
    }

    variants[brand][model].generationEngines[generation] ??= [];
    if (!variants[brand][model].generationEngines[generation].includes(engine)) {
      variants[brand][model].generationEngines[generation].push(engine);
    }

    variants[brand][model].generationEngineMeta[generation] ??= {};
    variants[brand][model].generationEngineMeta[generation][engine] = { powertrain };
  }

  return {
    brands: [...brandSet].sort((left, right) => left.localeCompare(right, 'es')),
    models: Object.fromEntries(
      Object.entries(models)
        .sort(([left], [right]) => left.localeCompare(right, 'es'))
        .map(([brand, brandModels]) => [
          brand,
          [...brandModels].sort((left, right) => left.localeCompare(right, 'es')),
        ]),
    ),
    variants,
  };
}

function buildFirestoreSeed(rows) {
  const catalog = buildCatalog(rows);
  const catalogBrands = [];
  const catalogModels = [];
  const catalogGenerations = [];
  const catalogEngines = [];
  const vehicles = [];
  const builds = [];

  let brandIndex = 1;
  let modelIndex = 1;
  let generationIndex = 1;
  let engineIndex = 1;

  const brandIds = new Map();
  const modelIds = new Map();
  const generationIds = new Map();

  for (const brand of catalog.brands) {
    const brandId = `brand-${brandIndex}`;
    brandIds.set(brand, brandId);
    catalogBrands.push({ id: brandId, name: brand });
    brandIndex += 1;
  }

  for (const row of rows) {
    const brand = row.marca.trim();
    const model = row.modelo.trim();
    const generation = row.generacion.trim();
    const engine = row.motor.trim();
    const powertrain = detectPowertrain(row.motor, row.perfil, row.recomendacion);
    const amount = inferBudgetAmount(row);
    const reliabilityIndex = inferReliability(row.nivel_respaldo, row.confianza);
    const normalizedGenerationLabel = generation.includes('(') ? generation : generation;
    const platformLookupKey = [
      normalize(brand),
      normalize(model),
      normalize(normalizedGenerationLabel),
      normalize(engine),
    ].join('|');

    const modelKey = `${brand}|${model}`;
    if (!modelIds.has(modelKey)) {
      const modelId = `model-${modelIndex}`;
      modelIds.set(modelKey, modelId);
      catalogModels.push({
        id: modelId,
        brandId: brandIds.get(brand),
        name: model,
      });
      modelIndex += 1;
    }

    const generationKey = `${modelKey}|${generation}`;
    if (!generationIds.has(generationKey)) {
      const generationId = `generation-${generationIndex}`;
      generationIds.set(generationKey, generationId);
      catalogGenerations.push({
        id: generationId,
        modelId: modelIds.get(modelKey),
        name: generation,
      });
      generationIndex += 1;
    }

    const engineId = `engine-${engineIndex}`;
    catalogEngines.push({
      id: engineId,
      generationId: generationIds.get(generationKey),
      name: engine,
      powertrain,
    });
    engineIndex += 1;

    vehicles.push({
      id: `vehicle-${row.recomendacion_id}`,
      brand,
      model,
      generation,
      engine,
      powertrain,
      platformLookupKey,
    });

    builds.push({
      id: `${slugify(brand)}-${slugify(model)}-${slugify(generation)}-${slugify(engine)}-${row.recomendacion_id}`,
      platformLookupKey,
      brand,
      model,
      generation,
      engine,
      powertrain,
      usage: inferUsage(row.perfil),
      goal: 'calle',
      priority: inferPriority(row.tipo_recomendacion),
      budget: inferBudgetLabel(amount),
      fitScore: Math.min(97, reliabilityIndex + 6),
      name: row.titulo,
      summary: compactSentence(row.recomendacion, 190),
      estimatedBudget: amount,
      expectedGain: extractExpectedGain(row.resultado_esperado),
      reliabilityIndex,
      executionTime: amount >= 2800 ? '2 a 4 semanas' : '1 a 2 semanas',
      stages: buildStages(row),
      reasons: buildReasons(row),
      warnings: buildWarnings(row),
      isFeatured: reliabilityIndex >= 84,
      sourceUrls: [row.fuente_1_url, row.fuente_2_url, row.fuente_3_url].filter(Boolean),
      legalNote: row.nota_legal || null,
    });
  }

  return {
    catalog_brands: catalogBrands,
    catalog_models: catalogModels,
    catalog_generations: catalogGenerations,
    catalog_engines: catalogEngines,
    vehicles,
    builds,
  };
}

async function run() {
  const inputPath = resolveFromRoot(
    process.argv[2] ?? 'C:/Users/rober/OneDrive/Escritorio/recomendaciones_respaldadas_v5.csv',
  );
  const outputSeedPath = resolveFromRoot(
    process.argv[3] ?? 'firebase/recomendaciones-v5-seed.json',
  );
  const outputCatalogPath = resolveFromRoot(
    process.argv[4] ?? 'src/data/vehicleCatalog.json',
  );

  const rawContent = await readFile(inputPath, 'utf8');
  const repairedContent = repairMojibake(rawContent);
  const rows = parseCsv(repairedContent);
  const catalog = buildCatalog(rows);
  const seed = buildFirestoreSeed(rows);

  await writeFile(outputSeedPath, `${JSON.stringify(seed, null, 2)}\n`, 'utf8');
  await writeFile(outputCatalogPath, `${JSON.stringify(catalog, null, 2)}\n`, 'utf8');

  console.log(`Catalogo actualizado en ${outputCatalogPath}`);
  console.log(`Seed actualizado en ${outputSeedPath}`);
  console.log(`Marcas: ${catalog.brands.length}`);
  console.log(`Builds: ${seed.builds.length}`);
}

run().catch((error) => {
  console.error('No se pudo convertir el CSV respaldado.');
  console.error(error.message);
  process.exitCode = 1;
});
