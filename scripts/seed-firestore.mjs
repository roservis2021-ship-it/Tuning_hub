import { readFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import { cert, getApps, initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');

function resolveFromRoot(targetPath) {
  return path.isAbsolute(targetPath) ? targetPath : path.resolve(projectRoot, targetPath);
}

async function readJson(filePath) {
  const fileContent = await readFile(filePath, 'utf8');
  const normalizedContent =
    fileContent.charCodeAt(0) === 0xfeff ? fileContent.slice(1) : fileContent;

  return JSON.parse(normalizedContent);
}

async function loadServiceAccount() {
  const configuredPath =
    process.env.FIREBASE_SERVICE_ACCOUNT_PATH ?? 'firebase-service-account.json';

  const serviceAccountPath = resolveFromRoot(configuredPath);
  return readJson(serviceAccountPath);
}

async function loadSeedData() {
  const seedPathArgument = process.argv[2] ?? 'firebase/seed-example.json';
  const seedPath = resolveFromRoot(seedPathArgument);
  return readJson(seedPath);
}

function shouldResetCollections() {
  return process.argv.includes('--reset');
}

function ensureAdminApp(serviceAccount) {
  if (getApps().length > 0) {
    return getApps()[0];
  }

  return initializeApp({
    credential: cert(serviceAccount),
  });
}

async function upsertCollection(db, collectionName, documents) {
  if (!Array.isArray(documents) || documents.length === 0) {
    return 0;
  }

  const batch = db.batch();

  for (const documentData of documents) {
    if (!documentData.id) {
      throw new Error(`Cada documento en "${collectionName}" necesita un campo "id".`);
    }

    const { id, ...payload } = documentData;
    const docRef = db.collection(collectionName).doc(id);
    batch.set(docRef, payload, { merge: true });
  }

  await batch.commit();
  return documents.length;
}

async function clearCollection(db, collectionName) {
  const snapshot = await db.collection(collectionName).get();

  if (snapshot.empty) {
    return 0;
  }

  let deletedCount = 0;
  let batch = db.batch();
  let batchSize = 0;

  for (const documentRef of snapshot.docs) {
    batch.delete(documentRef.ref);
    batchSize += 1;
    deletedCount += 1;

    if (batchSize === 400) {
      await batch.commit();
      batch = db.batch();
      batchSize = 0;
    }
  }

  if (batchSize > 0) {
    await batch.commit();
  }

  return deletedCount;
}

async function run() {
  const serviceAccount = await loadServiceAccount();
  const seedData = await loadSeedData();

  ensureAdminApp(serviceAccount);
  const db = getFirestore();

  if (shouldResetCollections()) {
    await clearCollection(db, 'catalog_brands');
    await clearCollection(db, 'catalog_models');
    await clearCollection(db, 'catalog_generations');
    await clearCollection(db, 'catalog_engines');
    await clearCollection(db, 'vehicles');
    await clearCollection(db, 'builds');
  }

  const catalogBrandsCount = await upsertCollection(db, 'catalog_brands', seedData.catalog_brands);
  const catalogModelsCount = await upsertCollection(db, 'catalog_models', seedData.catalog_models);
  const catalogGenerationsCount = await upsertCollection(
    db,
    'catalog_generations',
    seedData.catalog_generations,
  );
  const catalogEnginesCount = await upsertCollection(
    db,
    'catalog_engines',
    seedData.catalog_engines,
  );
  const vehiclesCount = await upsertCollection(db, 'vehicles', seedData.vehicles);
  const buildsCount = await upsertCollection(db, 'builds', seedData.builds);

  console.log(
    `Seed completado: ${catalogBrandsCount} brands, ${catalogModelsCount} models, ${catalogGenerationsCount} generations, ${catalogEnginesCount} engines, ${vehiclesCount} vehicles, ${buildsCount} builds.`,
  );
}

run().catch((error) => {
  console.error('No se pudo ejecutar el seed de Firestore.');
  console.error(error.message);
  process.exitCode = 1;
});
