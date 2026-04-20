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

function normalize(value) {
  return String(value ?? '')
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

function slugify(value) {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
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

function parseSqlValue(token) {
  const trimmed = token.trim();

  if (trimmed === 'NULL') {
    return null;
  }

  if (trimmed.startsWith("'") && trimmed.endsWith("'")) {
    return repairMojibake(trimmed.slice(1, -1).replaceAll("''", "'"));
  }

  if (/^-?\d+$/.test(trimmed)) {
    return Number(trimmed);
  }

  return repairMojibake(trimmed);
}

function splitTuple(tupleContent) {
  const values = [];
  let current = '';
  let inString = false;

  for (let index = 0; index < tupleContent.length; index += 1) {
    const char = tupleContent[index];
    const nextChar = tupleContent[index + 1];

    if (char === "'" && inString && nextChar === "'") {
      current += "''";
      index += 1;
      continue;
    }

    if (char === "'") {
      inString = !inString;
      current += char;
      continue;
    }

    if (char === ',' && !inString) {
      values.push(parseSqlValue(current));
      current = '';
      continue;
    }

    current += char;
  }

  if (current.length > 0) {
    values.push(parseSqlValue(current));
  }

  return values;
}

function extractTuples(valuesBlock) {
  const tuples = [];
  let current = '';
  let depth = 0;
  let inString = false;

  for (let index = 0; index < valuesBlock.length; index += 1) {
    const char = valuesBlock[index];
    const nextChar = valuesBlock[index + 1];

    if (char === "'" && inString && nextChar === "'") {
      current += "''";
      index += 1;
      continue;
    }

    if (char === "'") {
      inString = !inString;
      current += char;
      continue;
    }

    if (!inString && char === '(') {
      if (depth === 0) {
        current = '';
      } else {
        current += char;
      }
      depth += 1;
      continue;
    }

    if (!inString && char === ')') {
      depth -= 1;

      if (depth === 0) {
        tuples.push(splitTuple(current));
        current = '';
      } else {
        current += char;
      }

      continue;
    }

    if (depth > 0) {
      current += char;
    }
  }

  return tuples;
}

function parseInsertBlocks(sql) {
  const inserts = new Map();
  const insertRegex = /INSERT INTO\s+([a-z_]+)\s*\([^)]+\)\s*VALUES\s*/gi;
  let match;

  while ((match = insertRegex.exec(sql)) !== null) {
    const tableName = match[1];
    const valuesStart = insertRegex.lastIndex;
    let inString = false;
    let endIndex = valuesStart;

    for (; endIndex < sql.length; endIndex += 1) {
      const char = sql[endIndex];
      const nextChar = sql[endIndex + 1];

      if (char === "'" && inString && nextChar === "'") {
        endIndex += 1;
        continue;
      }

      if (char === "'") {
        inString = !inString;
        continue;
      }

      if (char === ';' && !inString) {
        break;
      }
    }

    const valuesBlock = sql.slice(valuesStart, endIndex);
    inserts.set(tableName, extractTuples(valuesBlock));
    insertRegex.lastIndex = endIndex + 1;
  }

  return inserts;
}

function inferUsage(power) {
  if (power >= 320) {
    return 'finde';
  }

  if (power >= 240) {
    return 'finde';
  }

  return 'diario';
}

function inferGoal(power, categories) {
  if (power >= 280 && categories.has('Suspension') && categories.has('Frenos')) {
    return 'tandas';
  }

  return 'calle';
}

function inferPriority(fuel, categories) {
  if (fuel === 'Diesel') {
    return 'fiabilidad';
  }

  if (categories.has('Turbo') || categories.has('ECU')) {
    return 'potencia';
  }

  return 'equilibrio';
}

function inferBudget(estimatedBudget) {
  if (estimatedBudget >= 5200) {
    return 'alto';
  }

  if (estimatedBudget >= 2800) {
    return 'medio';
  }

  return 'bajo';
}

function convertFuel(fuel) {
  return {
    Gasolina: 'gasolina',
    Diesel: 'diesel',
    Hibrido: 'hibrido',
    Electrico: 'electrico',
  }[fuel] ?? 'gasolina';
}

function computeEstimatedBudget(recommendations) {
  const categoryBaseCost = {
    ECU: 650,
    Admision: 320,
    Escape: 780,
    Intercooler: 900,
    Turbo: 2100,
    Suspension: 1200,
    Frenos: 700,
  };

  return recommendations.reduce((total, recommendation) => {
    return total + (categoryBaseCost[recommendation.categoryName] ?? 450);
  }, 0);
}

function groupStages(recommendations) {
  const buckets = {
    'STAGE 1': [],
    'STAGE 2': [],
    'STAGE 3': [],
  };

  for (const recommendation of recommendations) {
    const explicitStage = recommendation.stage?.toUpperCase().replace(/\s+/g, ' ').trim();

    if (explicitStage === 'STAGE 1') {
      buckets['STAGE 1'].push(recommendation);
      continue;
    }

    if (explicitStage === 'STAGE 2') {
      buckets['STAGE 2'].push(recommendation);
      continue;
    }

    if (explicitStage === 'STAGE 3') {
      buckets['STAGE 3'].push(recommendation);
      continue;
    }

    if (['ECU', 'Admision', 'Escape'].includes(recommendation.categoryName)) {
      buckets['STAGE 1'].push(recommendation);
      continue;
    }

    if (['Intercooler'].includes(recommendation.categoryName)) {
      buckets['STAGE 2'].push(recommendation);
      continue;
    }

    buckets['STAGE 3'].push(recommendation);
  }

  const stageMeta = {
    'STAGE 1': 'Base y respuesta',
    'STAGE 2': 'Flujo y temperatura',
    'STAGE 3': 'Soporte y fiabilidad',
  };

  return Object.entries(buckets)
    .filter(([, items]) => items.length > 0)
    .map(([label, items]) => {
      const descriptions = items
        .map((item) => item.description)
        .filter(Boolean)
        .slice(0, 2);

      return {
        label,
        focus: stageMeta[label],
        parts: [...new Set(items.map((item) => item.modName))],
        note:
          descriptions.join(' ') ||
          'Etapa pensada para mantener una evolucion coherente y aprovechable en carretera.',
      };
    });
}

function buildWarnings(recommendations, fuel) {
  const warnings = [];

  if (recommendations.some((item) => item.reliability === 'Media')) {
    warnings.push('Las piezas de fase avanzada necesitan montaje fino, mantenimiento al dia y un mapa bien ajustado.');
  }

  if (recommendations.some((item) => item.categoryName === 'Turbo')) {
    warnings.push('Si se cambia turbo o se busca una fase alta, hay que revisar combustible, temperatura y soporte mecanico.');
  }

  if (fuel === 'Diesel') {
    warnings.push('En motores diesel conviene vigilar humos, temperatura de escape y estado del embrague con el aumento de par.');
  } else {
    warnings.push('Revisa homologacion, emisiones e ITV antes de cerrar una configuracion con escape, downpipe o cambios de mapa.');
  }

  return warnings.slice(0, 3);
}

function buildReasons(recommendations, brand, model, engine, generationLabel) {
  const categoryNames = [...new Set(recommendations.map((item) => item.categoryName.toLowerCase()))];
  const gains = recommendations
    .map((item) => item.gain)
    .filter((value) => Number.isFinite(value));

  const totalGain = gains.reduce((sum, value) => sum + value, 0);

  return [
    `${brand} ${model} ${generationLabel} con motor ${engine} tiene una ruta de mejoras clara dentro del ecosistema tuning.`,
    categoryNames.length > 0
      ? `La propuesta combina ${categoryNames.slice(0, 3).join(', ')} para que la build no se quede solo en una reprogramacion suelta.`
      : 'La build se ha organizado para que cada etapa tenga sentido mecanico y de uso.',
    totalGain > 0
      ? `Sobre el papel, la suma de mejoras apunta a una ganancia potencial de alrededor de ${totalGain} cv, siempre dependiendo del estado real de la base.`
      : 'La prioridad aqui no es solo potencia final, sino una base coherente y utilizable.',
  ];
}

function createSummary(model, generationLabel, engine, recommendations) {
  const categories = [...new Set(recommendations.map((item) => item.categoryName.toLowerCase()))];
  const summaryCategories = categories.slice(0, 3).join(', ');

  return `Build para ${model} ${generationLabel} ${engine} orientada a una evolucion ordenada por etapas, con foco en ${summaryCategories || 'una preparacion equilibrada'} y una base utilizable en calle.`;
}

function buildDataset(inserts) {
  const marcas = new Map(
    (inserts.get('marcas') ?? []).map((tuple, index) => {
      const [idOrName, maybeName] = tuple;
      const id = maybeName ? idOrName : index + 1;
      const nombre = maybeName ?? idOrName;

      return [id, { id, nombre }];
    }),
  );
  const modelos = new Map(
    inserts.get('modelos')?.map(([id, marcaId, nombre]) => [id, { id, marcaId, nombre }]) ?? [],
  );
  const generaciones = new Map(
    inserts
      .get('generaciones')
      ?.map(([id, modeloId, nombre, anioInicio, anioFin]) => [
        id,
        { id, modeloId, nombre, anioInicio, anioFin },
      ]) ?? [],
  );
  const motores = new Map(
    inserts
      .get('motores')
      ?.map(([id, generacionId, nombre, combustible, potenciaCv, aspiracion]) => [
        id,
        { id, generacionId, nombre, combustible, potenciaCv, aspiracion },
      ]) ?? [],
  );
  const categorias = new Map(
    inserts
      .get('categorias_modificacion')
      ?.map(([id, nombre]) => [id, { id, nombre }]) ?? [],
  );

  const recommendationsByMotor = new Map();

  for (const [
    ,
    motorId,
    categoriaId,
    nombreMod,
    stage,
    descripcion,
    gananciaCvEstimada,
    fiabilidad,
  ] of inserts.get('recomendaciones_mod') ?? []) {
    if (!recommendationsByMotor.has(motorId)) {
      recommendationsByMotor.set(motorId, []);
    }

    recommendationsByMotor.get(motorId).push({
      categoryId: categoriaId,
      categoryName: categorias.get(categoriaId)?.nombre ?? 'General',
      modName: nombreMod,
      stage,
      description: descripcion,
      gain: gananciaCvEstimada,
      reliability: fiabilidad ?? 'Media',
    });
  }

  const builds = [];

  for (const [motorId, recommendations] of recommendationsByMotor.entries()) {
    const motor = motores.get(motorId);

    if (!motor) {
      continue;
    }

    const generation = generaciones.get(motor.generacionId);
    const model = generation ? modelos.get(generation.modeloId) : null;
    const brand = model ? marcas.get(model.marcaId) : null;

    if (!brand || !model || !generation) {
      continue;
    }

    const generationLabel = `${generation.nombre} (${generation.anioInicio}-${generation.anioFin})`;
    const platformLookupKey = [
      normalize(brand.nombre),
      normalize(model.nombre),
      normalize(generationLabel),
      normalize(motor.nombre),
    ].join('|');

    const estimatedBudget = computeEstimatedBudget(recommendations);
    const gains = recommendations
      .map((item) => item.gain)
      .filter((value) => Number.isFinite(value));
    const totalGain = gains.reduce((sum, value) => sum + value, 0);
    const reliabilityValues = recommendations.map((item) => {
      return {
        Alta: 92,
        Media: 78,
        Baja: 64,
      }[item.reliability] ?? 78;
    });
    const reliabilityIndex = Math.round(
      reliabilityValues.reduce((sum, value) => sum + value, 0) / reliabilityValues.length,
    );
    const fitScore = Math.max(80, Math.min(96, Math.round((reliabilityIndex + 8 + recommendations.length) / 1.1)));
    const categories = new Set(recommendations.map((item) => item.categoryName));
    const usage = inferUsage(motor.potenciaCv);
    const goal = inferGoal(motor.potenciaCv, categories);
    const priority = inferPriority(motor.combustible, categories);
    const budget = inferBudget(estimatedBudget);

    builds.push({
      id: `${slugify(brand.nombre)}-${slugify(model.nombre)}-${slugify(generation.nombre)}-${slugify(motor.nombre)}`,
      platformLookupKey,
      brand: brand.nombre,
      model: model.nombre,
      generation: generationLabel,
      engine: motor.nombre,
      powertrain: convertFuel(motor.combustible),
      yearStart: generation.anioInicio,
      yearEnd: generation.anioFin,
      usage,
      goal,
      priority,
      budget,
      fitScore,
      name: `${model.nombre} ${generation.nombre} ${motor.nombre}`,
      summary: createSummary(model.nombre, generationLabel, motor.nombre, recommendations),
      estimatedBudget,
      expectedGain: totalGain > 0 ? `+${totalGain} cv aprox.` : 'Ganancia moderada segun configuracion',
      reliabilityIndex,
      executionTime:
        recommendations.length >= 5 ? '2 a 5 semanas' : recommendations.length >= 3 ? '1 a 3 semanas' : '1 a 2 semanas',
      stages: groupStages(recommendations),
      reasons: buildReasons(recommendations, brand.nombre, model.nombre, motor.nombre, generationLabel),
      warnings: buildWarnings(recommendations, motor.combustible),
      isFeatured: motor.potenciaCv >= 250 || recommendations.some((item) => item.categoryName === 'Turbo'),
    });
  }

  return { builds };
}

async function run() {
  const inputPath = resolveFromRoot(
    process.argv[2] ?? 'C:/Users/rober/OneDrive/Escritorio/tuning_db_starter.sql',
  );
  const outputPath = resolveFromRoot(process.argv[3] ?? 'firebase/builds-from-sql.json');

  const sql = await readFile(inputPath, 'utf8');
  const inserts = parseInsertBlocks(sql);
  const dataset = buildDataset(inserts);

  await writeFile(outputPath, `${JSON.stringify(dataset, null, 2)}\n`, 'utf8');

  console.log(`Dataset generado en ${outputPath}`);
  console.log(`Builds creadas: ${dataset.builds.length}`);
}

run().catch((error) => {
  console.error('No se pudo convertir el SQL en dataset de builds.');
  console.error(error.message);
  process.exitCode = 1;
});
