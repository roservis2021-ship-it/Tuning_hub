import { writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  EUROPEAN_CAR_BRANDS,
  EUROPEAN_CAR_MODELS,
  EUROPEAN_CAR_VARIANTS,
} from '../src/data/europeanCars.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');
const outputPath = path.join(projectRoot, 'firebase', 'catalog-seed.json');

function slugify(value) {
  return String(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function buildCatalogDocuments() {
  const brands = [];
  const models = [];
  const generations = [];
  const engines = [];

  for (const brandName of EUROPEAN_CAR_BRANDS) {
    const brandId = slugify(brandName);
    brands.push({
      id: brandId,
      name: brandName,
      brandSlug: brandId,
      region: 'Europe',
    });

    const brandModels = EUROPEAN_CAR_MODELS[brandName] ?? [];

    for (const modelName of brandModels) {
      const modelId = `${brandId}__${slugify(modelName)}`;
      models.push({
        id: modelId,
        brandId,
        brandName,
        modelName,
        modelSlug: slugify(modelName),
      });

      const variantInfo = EUROPEAN_CAR_VARIANTS[brandName]?.[modelName];

      if (!variantInfo) {
        continue;
      }

      for (const generationName of variantInfo.generations ?? []) {
        generations.push({
          id: `${modelId}__${slugify(generationName)}`,
          brandId,
          modelId,
          brandName,
          modelName,
          generationName,
          generationSlug: slugify(generationName),
        });
      }

      for (const engineName of variantInfo.engines ?? []) {
        engines.push({
          id: `${modelId}__${slugify(engineName)}`,
          brandId,
          modelId,
          brandName,
          modelName,
          engineName,
          engineSlug: slugify(engineName),
        });
      }
    }
  }

  return {
    catalog_brands: brands,
    catalog_models: models,
    catalog_generations: generations,
    catalog_engines: engines,
  };
}

async function run() {
  const catalogSeed = buildCatalogDocuments();
  await writeFile(outputPath, `${JSON.stringify(catalogSeed, null, 2)}\n`, 'utf8');
  console.log(`Catalogo generado en ${outputPath}`);
}

run().catch((error) => {
  console.error('No se pudo generar el seed del catalogo.');
  console.error(error.message);
  process.exitCode = 1;
});
