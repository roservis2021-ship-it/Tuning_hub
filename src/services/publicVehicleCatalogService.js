import { collection, getDocs, limit, query, where } from 'firebase/firestore';
import { db, isFirebaseConfigured } from '../firebase/config';

const PUBLIC_STATUSES = ['published', 'verified'];

function toText(value) {
  return String(value ?? '').trim();
}

function normalizeFuel(value) {
  const normalized = toText(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();

  if (normalized.includes('diesel')) return 'diesel';
  if (normalized.includes('hibr')) return 'hibrido';
  if (normalized.includes('elect')) return 'electrico';
  return 'gasolina';
}

function normalizeAspiration(value) {
  const normalized = toText(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();

  if (normalized.includes('atmos')) return 'atmosferico';
  if (normalized.includes('compres')) return 'compresor';
  return 'turbo';
}

function normalizeDrivetrain(value) {
  const normalized = toText(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();

  if (normalized.includes('tras')) return 'rwd';
  if (normalized.includes('total') || normalized.includes('awd') || normalized.includes('4')) return 'awd';
  return 'fwd';
}

function normalizeTransmission(value) {
  const normalized = toText(value).toLowerCase();
  return normalized.includes('auto') || normalized.includes('dsg') || normalized.includes('tiptronic')
    ? 'automatico'
    : 'manual';
}

function formatGeneration(vehicle) {
  const generation = toText(vehicle.generation);
  const start = Number(vehicle.yearStart);
  const end = Number(vehicle.yearEnd);

  if (generation && Number.isFinite(start) && Number.isFinite(end)) {
    return `${generation} (${start}-${end})`;
  }

  if (generation && Number.isFinite(start)) {
    return `${generation} (${start}-)`;
  }

  return generation || 'Generacion por confirmar';
}

function formatEngine(vehicle) {
  return [
    toText(vehicle.version),
    toText(vehicle.engineCode),
    Number(vehicle.powerCv) > 0 ? `${Number(vehicle.powerCv)} CV` : '',
  ]
    .filter(Boolean)
    .join(' · ');
}

function toPublicVehicle(docSnapshot) {
  const vehicle = docSnapshot.data();

  return {
    id: docSnapshot.id,
    brand: toText(vehicle.brand),
    model: toText(vehicle.model),
    generation: formatGeneration(vehicle),
    generationRaw: toText(vehicle.generation),
    engine: formatEngine(vehicle) || toText(vehicle.engineCode) || toText(vehicle.version),
    version: toText(vehicle.version),
    engineCode: toText(vehicle.engineCode),
    yearStart: vehicle.yearStart ?? '',
    powertrain: normalizeFuel(vehicle.fuel),
    aspiration: normalizeAspiration(vehicle.induction),
    transmission: normalizeTransmission(vehicle.gearbox),
    drivetrain: normalizeDrivetrain(vehicle.drivetrain),
  };
}

function sortVehicles(left, right) {
  return [left.brand, left.model, left.generation, left.engine]
    .join(' ')
    .localeCompare([right.brand, right.model, right.generation, right.engine].join(' '), 'es');
}

export async function fetchPublicVehicleCatalog() {
  if (!isFirebaseConfigured) {
    return [];
  }

  const snapshot = await getDocs(
    query(collection(db, 'vehicles'), where('status', 'in', PUBLIC_STATUSES), limit(500)),
  );

  return snapshot.docs
    .map(toPublicVehicle)
    .filter((vehicle) => vehicle.brand && vehicle.model && vehicle.engine)
    .sort(sortVehicles);
}
