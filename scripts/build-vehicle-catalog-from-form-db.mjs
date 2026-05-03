import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const projectRoot = path.resolve(path.dirname(__filename), '..');

const positionalArgs = process.argv.slice(2).filter((arg) => !arg.startsWith('--'));
const inputPath = positionalArgs[0];
const outputPath = positionalArgs[1] || path.join(projectRoot, 'src', 'data', 'vehicleCatalog.json');
const shouldMergeHeadCatalog = process.argv.includes('--merge-head-catalog');

if (!inputPath) {
  console.error('Uso: node scripts/build-vehicle-catalog-from-form-db.mjs <csv> [output]');
  process.exit(1);
}

function parseCsv(content) {
  const rows = [];
  let row = [];
  let field = '';
  let inQuotes = false;

  for (let index = 0; index < content.length; index += 1) {
    const char = content[index];
    const nextChar = content[index + 1];

    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        field += '"';
        index += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (char === ',' && !inQuotes) {
      row.push(field);
      field = '';
      continue;
    }

    if ((char === '\n' || char === '\r') && !inQuotes) {
      if (char === '\r' && nextChar === '\n') {
        index += 1;
      }
      row.push(field);
      if (row.some((value) => value.trim())) {
        rows.push(row);
      }
      row = [];
      field = '';
      continue;
    }

    field += char;
  }

  if (field || row.length) {
    row.push(field);
    if (row.some((value) => value.trim())) {
      rows.push(row);
    }
  }

  return rows;
}

function normalizeText(value) {
  return String(value ?? '').replace(/\s+/g, ' ').trim();
}

function normalizeKey(value) {
  return normalizeText(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

function normalizeGenerationKey(value) {
  return normalizeKey(value)
    .replace(/\([^)]*\)/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\bmk\s+/g, 'mk')
    .trim();
}

function normalizeFuel(value, motor) {
  const source = `${value} ${motor}`
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
  const motorText = String(motor ?? '').toLowerCase();

  if (
    /\b(tdi|hdi|dci|cdti|jtd|crdi|cdi|tdci|d-4d|d4d)\b/.test(source) ||
    /\b(116d|118d|120d|123d|125d|318d|320d|325d|330d|335d)\b/.test(motorText) ||
    /\b(m47|n47|b47|m57|n57)\b/.test(motorText)
  ) {
    return 'diesel';
  }

  if (source.includes('hibrido') || source.includes('hybrid')) {
    return 'hibrido';
  }

  if (source.includes('electrico') || source.includes('electric')) {
    return 'electrico';
  }

  return 'gasolina';
}

function normalizeAspiration(value, motor, fuel) {
  const source = `${value} ${motor}`
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();

  if (source.includes('compresor') || source.includes('kompressor') || source.includes('supercharged')) {
    return 'compresor';
  }

  if (
    fuel === 'diesel' ||
    /\b(turbo|tsi|tfsi|tfsI|t-jet|ecoboost|tce|thp|puretech|t-gdi|gti|cupra|opc|rs|st)\b/i.test(source) ||
    /\b(1\.8t|2\.0t|n13|b38|b48|n20|n54|n55|b58|ea113|ea888|m133|m139|m270|m274)\b/i.test(source)
  ) {
    return 'turbo';
  }

  return 'atmosferico';
}

function formatGeneration(generation, yearRange) {
  const cleanGeneration = normalizeText(generation);
  const cleanYearRange = normalizeText(yearRange);

  if (!cleanGeneration || cleanGeneration.includes('(') || !cleanYearRange) {
    return cleanGeneration;
  }

  return `${cleanGeneration} (${cleanYearRange})`;
}

function addUnique(list, value) {
  if (value && !list.includes(value)) {
    list.push(value);
  }
}

function findByNormalizedKey(list, value) {
  const valueKey = normalizeKey(value);

  return list.find((item) => normalizeKey(item) === valueKey) || null;
}

function hasGeneration(list, value) {
  const valueKey = normalizeGenerationKey(value);

  return list.some((item) => normalizeGenerationKey(item) === valueKey);
}

function mergePreviousCatalog(catalog) {
  const previousContent = execFileSync('git', ['show', 'HEAD:src/data/vehicleCatalog.json'], {
    cwd: projectRoot,
    encoding: 'utf8',
  });
  const previousCatalog = JSON.parse(previousContent);

  for (const previousBrand of previousCatalog.brands ?? []) {
    const brand = findByNormalizedKey(catalog.brands, previousBrand) || previousBrand;
    addUnique(catalog.brands, brand);
    catalog.models[brand] ??= [];
    catalog.variants[brand] ??= {};

    for (const previousModel of previousCatalog.models?.[previousBrand] ?? []) {
      const model = findByNormalizedKey(catalog.models[brand], previousModel) || previousModel;
      addUnique(catalog.models[brand], model);

      const previousVariant = previousCatalog.variants?.[previousBrand]?.[previousModel];

      if (!previousVariant) {
        continue;
      }

      catalog.variants[brand][model] ??= {
        generations: [],
        engines: [],
        generationEngines: {},
        generationEngineMeta: {},
      };

      const variant = catalog.variants[brand][model];

      for (const engine of previousVariant.engines ?? []) {
        addUnique(variant.engines, engine);
      }

      for (const previousGeneration of previousVariant.generations ?? []) {
        const generation = hasGeneration(variant.generations, previousGeneration)
          ? variant.generations.find(
              (item) => normalizeGenerationKey(item) === normalizeGenerationKey(previousGeneration),
            )
          : previousGeneration;

        addUnique(variant.generations, generation);
        variant.generationEngines[generation] ??= [];
        variant.generationEngineMeta[generation] ??= {};

        for (const engine of previousVariant.generationEngines?.[previousGeneration] ?? []) {
          addUnique(variant.generationEngines[generation], engine);
          addUnique(variant.engines, engine);

          const previousMeta = previousVariant.generationEngineMeta?.[previousGeneration]?.[engine];
          if (previousMeta && !variant.generationEngineMeta[generation][engine]) {
            variant.generationEngineMeta[generation][engine] = previousMeta;
          }
        }
      }
    }
  }
}

const content = await readFile(inputPath, 'utf8');
const [headers, ...dataRows] = parseCsv(content);
const headerIndex = new Map(headers.map((header, index) => [normalizeText(header), index]));
const catalog = {
  brands: [],
  models: {},
  variants: {},
};

for (const row of dataRows) {
  const brand = normalizeText(row[headerIndex.get('marca')]);
  const model = normalizeText(row[headerIndex.get('modelo')]);
  const generation = formatGeneration(row[headerIndex.get('generacion')], row[headerIndex.get('rango_anos')]);
  const engine = normalizeText(row[headerIndex.get('motor')]);
  const notes = normalizeText(row[headerIndex.get('notas_formulario')]);

  if (!brand || !model || !generation || !engine) {
    continue;
  }

  const fuel = normalizeFuel(row[headerIndex.get('combustible_probable')], engine);
  const aspiration = normalizeAspiration(row[headerIndex.get('aspiracion_probable')], engine, fuel);

  addUnique(catalog.brands, brand);
  catalog.models[brand] ??= [];
  catalog.variants[brand] ??= {};
  addUnique(catalog.models[brand], model);

  catalog.variants[brand][model] ??= {
    generations: [],
    engines: [],
    generationEngines: {},
    generationEngineMeta: {},
  };

  const variant = catalog.variants[brand][model];
  addUnique(variant.generations, generation);
  addUnique(variant.engines, engine);

  variant.generationEngines[generation] ??= [];
  addUnique(variant.generationEngines[generation], engine);

  variant.generationEngineMeta[generation] ??= {};
  variant.generationEngineMeta[generation][engine] = {
    powertrain: fuel,
    aspiration,
    notes,
  };
}

if (shouldMergeHeadCatalog) {
  mergePreviousCatalog(catalog);
}

await writeFile(outputPath, `${JSON.stringify(catalog, null, 2)}\n`, 'utf8');

const modelCount = Object.values(catalog.models).reduce((total, models) => total + models.length, 0);
const generationCount = Object.values(catalog.variants).reduce(
  (total, models) =>
    total + Object.values(models).reduce((modelTotal, variant) => modelTotal + variant.generations.length, 0),
  0,
);
const engineCount = Object.values(catalog.variants).reduce(
  (total, models) =>
    total + Object.values(models).reduce((modelTotal, variant) => modelTotal + variant.engines.length, 0),
  0,
);

console.log(
  `Catalogo generado: ${catalog.brands.length} marcas, ${modelCount} modelos, ${generationCount} generaciones, ${engineCount} motores.`,
);
