import { addDoc, collection, getDocs, limit, query, serverTimestamp, where } from 'firebase/firestore';
import { db, isFirebaseConfigured } from '../firebase/config';

function normalize(value) {
  return String(value)
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
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

function formatBudget(amount) {
  return new Intl.NumberFormat('es-ES', {
    style: 'currency',
    currency: 'EUR',
    maximumFractionDigits: 0,
  }).format(amount);
}

function hasCompletePowerProfile(build) {
  const stages = Array.isArray(build?.stages) ? build.stages : [];
  const performanceStages = stages[0]?.label === 'STAGE 0' ? stages.slice(1) : stages;

  return Boolean(
    Number(build?.basePowerCv) > 0 &&
      Number(build?.finalPowerCv) > 0 &&
      (stages.length === 3 || stages.length === 4) &&
      performanceStages.length === 3 &&
      performanceStages.every((stage) => Number(stage?.gainCv) > 0 && Number(stage?.powerAfterCv) > 0),
  );
}

function toResultShape(build, vehicle) {
  const vehicleDescriptor = [vehicle.model, vehicle.generation, vehicle.engine]
    .filter(Boolean)
    .join(' ');

  return {
    id: build.id,
    title: `${vehicle.brand} ${vehicleDescriptor}: ${build.name}`,
    summary: build.summary,
    fitScore: build.fitScore,
    source: 'database',
    basePowerCv: build.basePowerCv ?? null,
    finalPowerCv: build.finalPowerCv ?? null,
    factoryPowerSourceTitle: build.factoryPowerSourceTitle ?? '',
    factoryPowerSourceUrl: build.factoryPowerSourceUrl ?? '',
    ownerProfile: build.ownerProfile ?? '',
    drivability: build.drivability ?? '',
    maintenanceLevel: build.maintenanceLevel ?? '',
    legalNote: build.legalNote ?? '',
    vehicleDiagnosis: build.vehicleDiagnosis ?? null,
    technicalProfile: build.technicalProfile ?? null,
    vehicleIdentity: build.vehicleIdentity ?? null,
    freeBuild: build.freeBuild ?? null,
    recommendedParts: build.recommendedParts ?? [],
    conversionTrigger: build.conversionTrigger ?? '',
    premiumUpsell: build.premiumUpsell ?? '',
    conclusion: build.conclusion ?? null,
    accessTier: build.accessTier ?? 'free',
    stats: [
      {
        label: 'Presupuesto estimado',
        value: formatBudget(build.estimatedBudget),
        helper: 'Tomado de una build registrada',
      },
      {
        label: 'Ganancia esperada',
        value: build.expectedGain,
        helper: 'Basada en esa receta guardada',
      },
      {
        label: 'Fiabilidad objetivo',
        value: `${build.reliabilityIndex} / 100`,
        helper: 'Indice almacenado en la build',
      },
      {
        label: 'Tiempo de ejecucion',
        value: build.executionTime,
        helper: 'Estimacion de la receta',
      },
    ],
    stages: build.stages ?? [],
    reasons: build.reasons ?? [],
    warnings: build.warnings ?? [],
  };
}

async function findExactBuild(vehicle) {
  const exactQuery = query(
    collection(db, 'builds'),
    where('exactMatchKey', '==', createExactMatchKey(vehicle)),
    limit(1),
  );

  const snapshot = await getDocs(exactQuery);

  if (snapshot.empty) {
    return null;
  }

  const firstDoc = snapshot.docs[0];
  const build = { id: firstDoc.id, ...firstDoc.data() };
  return hasCompletePowerProfile(build) ? build : null;
}

async function findGoalBuild(vehicle) {
  const goalQuery = query(
    collection(db, 'builds'),
    where('goalMatchKey', '==', createGoalMatchKey(vehicle)),
    limit(6),
  );

  const snapshot = await getDocs(goalQuery);

  if (snapshot.empty) {
    return null;
  }

  const candidates = snapshot.docs
    .map((buildDoc) => ({ id: buildDoc.id, ...buildDoc.data() }))
    .filter(hasCompletePowerProfile)
    .sort((left, right) => {
      const leftFeatured = left.isFeatured ? 1 : 0;
      const rightFeatured = right.isFeatured ? 1 : 0;

      if (leftFeatured !== rightFeatured) {
        return rightFeatured - leftFeatured;
      }

      return (right.fitScore ?? 0) - (left.fitScore ?? 0);
    });

  return candidates[0] ?? null;
}

async function findPlatformBuild(vehicle) {
  const platformQuery = query(
    collection(db, 'builds'),
    where('platformLookupKey', '==', createPlatformLookupKey(vehicle)),
    limit(6),
  );

  const snapshot = await getDocs(platformQuery);

  if (snapshot.empty) {
    return null;
  }

  const targetYear = normalizeYear(vehicle.year);

  const candidates = snapshot.docs
    .map((buildDoc) => ({ id: buildDoc.id, ...buildDoc.data() }))
    .filter(hasCompletePowerProfile)
    .filter((build) => {
      const matchesPowertrain = !build.powertrain || build.powertrain === vehicle.powertrain;
      const matchesYear =
        targetYear === null ||
        ((!build.yearStart || targetYear >= build.yearStart) &&
          (!build.yearEnd || targetYear <= build.yearEnd));

      return matchesPowertrain && matchesYear;
    })
    .sort((left, right) => {
      const leftFeatured = left.isFeatured ? 1 : 0;
      const rightFeatured = right.isFeatured ? 1 : 0;

      if (leftFeatured !== rightFeatured) {
        return rightFeatured - leftFeatured;
      }

      return (right.fitScore ?? 0) - (left.fitScore ?? 0);
    });

  return candidates[0] ?? null;
}

export async function findMatchingBuild(vehicle) {
  if (!isFirebaseConfigured) {
    return null;
  }

  const exactBuild = await findExactBuild(vehicle);

  if (exactBuild) {
    return toResultShape(exactBuild, vehicle);
  }

  const goalBuild = await findGoalBuild(vehicle);

  if (!goalBuild) {
    const platformBuild = await findPlatformBuild(vehicle);

    if (!platformBuild) {
      return null;
    }

    return toResultShape(platformBuild, vehicle);
  }

  return toResultShape(goalBuild, vehicle);
}

export async function logUserSearch(vehicle, matchedBuildId, matchedFromDatabase) {
  if (!isFirebaseConfigured) {
    return;
  }

  await addDoc(collection(db, 'searches'), {
    brand: vehicle.brand,
    model: vehicle.model,
    generation: vehicle.generation || null,
    engine: vehicle.engine || null,
    year: normalizeYear(vehicle.year),
    powertrain: vehicle.powertrain,
    transmission: vehicle.transmission,
    drivetrain: vehicle.drivetrain,
    usage: vehicle.usage,
    goal: vehicle.goal,
    priority: vehicle.priority,
    budget: vehicle.budget,
    vehicleKey: createVehicleKey(vehicle),
    exactMatchKey: createExactMatchKey(vehicle),
    goalMatchKey: createGoalMatchKey(vehicle),
    matchedBuildId: matchedBuildId ?? null,
    matchedFromDatabase,
    createdAt: serverTimestamp(),
  });
}
