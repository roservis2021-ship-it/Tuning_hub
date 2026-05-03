import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');

const catalogPath = path.join(projectRoot, 'src', 'data', 'vehicleCatalog.json');
const buildSources = [
  path.join(projectRoot, 'firebase', 'builds-from-sql.json'),
  path.join(projectRoot, 'firebase', 'builds-from-xlsx.json'),
];

function normalize(value) {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

function generationBase(value) {
  return String(value ?? '')
    .replace(/\s*\([^)]*\)\s*/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function generationAliases(value) {
  const base = generationBase(value);
  const aliases = new Set([base]);
  const romanToNumber = {
    I: 1,
    II: 2,
    III: 3,
    IV: 4,
    V: 5,
    VI: 6,
    VII: 7,
    VIII: 8,
  };

  const romanMatch = base.match(/\b(I|II|III|IV|V|VI|VII|VIII)\b$/i);
  if (romanMatch) {
    const roman = romanMatch[1].toUpperCase();
    const number = romanToNumber[roman];
    const prefix = base.slice(0, romanMatch.index).trim();

    if (number) {
      aliases.add(`Mk${number}`);
      aliases.add(`${prefix} Mk${number}`.trim());
    }
  }

  const mkMatch = base.match(/\bmk\s*(\d+)\b/i);
  if (mkMatch) {
    const number = Number(mkMatch[1]);
    const roman = Object.entries(romanToNumber).find(([, valueNumber]) => valueNumber === number)?.[0];

    if (roman) {
      aliases.add(roman);
    }
  }

  if (base.includes('/')) {
    for (const part of base.split('/')) {
      const cleanPart = part.trim();

      if (cleanPart) {
        aliases.add(cleanPart);
      }
    }
  }

  return [...aliases];
}

function formatGeneration(base, yearStart, yearEnd) {
  if (!base || !Number.isFinite(yearStart) || !Number.isFinite(yearEnd)) {
    return base;
  }

  return `${base} (${yearStart}-${yearEnd})`;
}

async function readJson(filePath) {
  let content = await readFile(filePath, 'utf8');
  if (content.charCodeAt(0) === 0xfeff) {
    content = content.slice(1);
  }

  return JSON.parse(content);
}

function makeKey(brand, model, generation) {
  return [brand, model, generation].map(normalize).join('|');
}

async function run() {
  const catalog = await readJson(catalogPath);
  const generationYears = new Map();

  for (const sourcePath of buildSources) {
    const source = await readJson(sourcePath);

    for (const build of source.builds ?? []) {
      const baseGeneration = generationBase(build.generation);
      const yearStart = Number(build.yearStart);
      const yearEnd = Number(build.yearEnd);
      if (!build.brand || !build.model || !baseGeneration) {
        continue;
      }

      for (const alias of generationAliases(baseGeneration)) {
        generationYears.set(makeKey(build.brand, build.model, alias), { yearStart, yearEnd });
      }
    }
  }

  let updatedGenerations = 0;

  for (const [brand, models] of Object.entries(catalog.variants ?? {})) {
    for (const [model, variant] of Object.entries(models ?? {})) {
      const labelForGeneration = (generation) => {
        for (const alias of generationAliases(generation)) {
          const years = generationYears.get(makeKey(brand, model, alias));

          if (years) {
            return formatGeneration(generationBase(generation), years.yearStart, years.yearEnd);
          }
        }

        return generation;
      };

      const oldGenerations = Array.isArray(variant.generations) ? variant.generations : [];
      const newGenerations = oldGenerations.map(labelForGeneration);

      updatedGenerations += newGenerations.filter(
        (generation, index) => generation !== oldGenerations[index],
      ).length;

      variant.generations = newGenerations;

      const remapGenerationObject = (sourceObject = {}) =>
        Object.fromEntries(
          Object.entries(sourceObject).map(([generation, value]) => [
            labelForGeneration(generation),
            value,
          ]),
        );

      variant.generationEngines = remapGenerationObject(variant.generationEngines);
      variant.generationEngineMeta = remapGenerationObject(variant.generationEngineMeta);
    }
  }

  await writeFile(catalogPath, `${JSON.stringify(catalog, null, 2)}\n`, 'utf8');

  console.log(`Generaciones enriquecidas: ${updatedGenerations}`);
}

run().catch((error) => {
  console.error('No se pudieron enriquecer los rangos de generacion.');
  console.error(error.message);
  process.exitCode = 1;
});
