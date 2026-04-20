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

function normalizeName(value) {
  const rawText = String(value ?? '');
  const repairedText = /[ÃÂ]/.test(rawText)
    ? Buffer.from(rawText, 'latin1').toString('utf8')
    : rawText;

  return repairedText
    .replace(/^Ford Europe$/i, 'Ford')
    .replace(/^Citroen$/i, 'Citroën')
    .replace(/^Mini$/i, 'MINI')
    .replace(/^Skoda$/i, 'Skoda')
    .replace(/\s+/g, ' ')
    .trim();
}

function normalize(value) {
  return String(value ?? '')
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

function detectPowertrain(engineName) {
  const haystack = normalize(engineName);

  if (/(tdi|tdci|dci|hdi|jtd|multijet|mjet|cdti|crdi|cdi|d4d|diesel|bluehdi)/.test(haystack)) {
    return 'diesel';
  }

  if (/(hybrid|hibrid|phev|hev)/.test(haystack)) {
    return 'hibrido';
  }

  if (/(ev|electric|electrico)/.test(haystack)) {
    return 'electrico';
  }

  return 'gasolina';
}

async function run() {
  const inputPath = resolveFromRoot(process.argv[2] ?? 'firebase/catalog-seed.json');
  const outputPath = resolveFromRoot(process.argv[3] ?? 'src/data/vehicleCatalog.json');

  let content = await readFile(inputPath, 'utf8');
  if (content.charCodeAt(0) === 0xfeff) {
    content = content.slice(1);
  }

  const seed = JSON.parse(content);
  const brands = new Set();
  const modelsByBrand = {};
  const variants = {};

  const modelMap = new Map(
    (seed.catalog_models ?? []).map((model) => [
      model.id,
      {
        brand: normalizeName(model.brandName),
        model: normalizeName(model.modelName),
      },
    ]),
  );

  const generationsByModel = new Map();
  for (const generation of seed.catalog_generations ?? []) {
    const modelInfo = modelMap.get(generation.modelId);

    if (!modelInfo) {
      continue;
    }

    const generationName = normalizeName(generation.generationName);
    const modelKey = `${modelInfo.brand}|${modelInfo.model}`;

    if (!generationsByModel.has(modelKey)) {
      generationsByModel.set(modelKey, new Set());
    }

    generationsByModel.get(modelKey).add(generationName);
  }

  const enginesByModel = new Map();
  for (const engine of seed.catalog_engines ?? []) {
    const modelInfo = modelMap.get(engine.modelId);

    if (!modelInfo) {
      continue;
    }

    const engineName = normalizeName(engine.engineName);
    const modelKey = `${modelInfo.brand}|${modelInfo.model}`;

    if (!enginesByModel.has(modelKey)) {
      enginesByModel.set(modelKey, new Map());
    }

    enginesByModel.get(modelKey).set(engineName, {
      powertrain: detectPowertrain(engineName),
    });
  }

  for (const [modelKey, modelInfo] of modelMap.entries()) {
    void modelKey;
    const brand = modelInfo.brand;
    const model = modelInfo.model;
    const key = `${brand}|${model}`;
    const generations = [...(generationsByModel.get(key) ?? new Set())].sort((a, b) =>
      a.localeCompare(b, 'es'),
    );
    const engines = [...(enginesByModel.get(key)?.keys() ?? [])].sort((a, b) =>
      a.localeCompare(b, 'es'),
    );

    if (generations.length === 0 && engines.length === 0) {
      continue;
    }

    brands.add(brand);
    modelsByBrand[brand] ??= [];
    if (!modelsByBrand[brand].includes(model)) {
      modelsByBrand[brand].push(model);
    }

    variants[brand] ??= {};
    variants[brand][model] = {
      generations,
      engines,
      generationEngines: Object.fromEntries(
        generations.map((generation) => [generation, [...engines]]),
      ),
      generationEngineMeta: Object.fromEntries(
        generations.map((generation) => [
          generation,
          Object.fromEntries(
            engines.map((engine) => [engine, enginesByModel.get(key)?.get(engine) ?? { powertrain: 'gasolina' }]),
          ),
        ]),
      ),
    };
  }

  const catalog = {
    brands: [...brands].sort((a, b) => a.localeCompare(b, 'es')),
    models: Object.fromEntries(
      Object.entries(modelsByBrand)
        .sort(([left], [right]) => left.localeCompare(right, 'es'))
        .map(([brand, brandModels]) => [
          brand,
          [...brandModels].sort((a, b) => a.localeCompare(b, 'es')),
        ]),
    ),
    variants,
  };

  await writeFile(outputPath, `${JSON.stringify(catalog, null, 2)}\n`, 'utf8');

  console.log(`Catalogo generado en ${outputPath}`);
  console.log(`Marcas: ${catalog.brands.length}`);
  console.log(
    `Modelos: ${Object.values(catalog.models).reduce((total, brandModels) => total + brandModels.length, 0)}`,
  );
}

run().catch((error) => {
  console.error('No se pudo generar el catalogo amplio desde catalog-seed.json');
  console.error(error.message);
  process.exitCode = 1;
});
