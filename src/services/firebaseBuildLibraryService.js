import { addDoc, collection, doc, getDoc, getDocs, limit, query, serverTimestamp, where } from 'firebase/firestore';
import { db, isFirebaseConfigured } from '../firebase/config';

const PUBLIC_VEHICLE_STATUSES = ['published', 'verified'];

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

function toNumber(value) {
  const numericValue = Number(value);
  return Number.isFinite(numericValue) && numericValue > 0 ? numericValue : null;
}

function splitLines(value) {
  return String(value ?? '')
    .split(/\r?\n|;/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function joinTruthy(parts, separator = ' ') {
  return parts.filter(Boolean).join(separator);
}

function mapPartName(name) {
  return {
    name,
    reason: 'Recomendado desde la ficha tecnica THKB.',
    estimatedPriceEuro: null,
  };
}

function createStage({ label, text, basePowerCv, fallbackGain, premiumLocked = false }) {
  const parts = splitLines(text);
  const gainCv = parts.length ? fallbackGain : null;
  const powerAfterCv = basePowerCv && gainCv ? basePowerCv + gainCv : null;

  return {
    label,
    focus: label === 'STAGE 0' ? 'Base sana' : 'Preparacion recomendada',
    objective: text || 'Pendiente de completar en THKB.',
    gainCv,
    powerAfterCv,
    estimatedTorqueNm: null,
    reliability: label === 'STAGE 3' ? 'Media' : 'Alta',
    priceRange: 'Por confirmar',
    parts: parts.length ? parts.map(mapPartName) : [],
    premiumLocked,
  };
}

function toVehicleKnowledgeResult(vehicleDoc, requestedVehicle) {
  const vehicle = vehicleDoc.data();
  const basePowerCv = toNumber(vehicle.powerCv);
  const baseTorqueNm = toNumber(vehicle.torqueNm);
  const reliableLimitCv = toNumber(vehicle.reliableLimitCv);
  const vehicleName = joinTruthy([vehicle.brand, vehicle.model, vehicle.generation, vehicle.version]);
  const recommendedParts = splitLines(vehicle.recommendedMods).map(mapPartName);
  const maintenanceItems = splitLines(vehicle.maintenanceItems);
  const knownIssues = splitLines(vehicle.knownIssues);
  const stage0Text = splitLines(vehicle.preStageRequirements).length
    ? vehicle.preStageRequirements
    : vehicle.maintenanceItems;
  const stages = [
    createStage({ label: 'STAGE 0', text: stage0Text, basePowerCv, fallbackGain: 0 }),
    createStage({ label: 'STAGE 1', text: vehicle.stage1Plan || vehicle.recommendedMods, basePowerCv, fallbackGain: 25 }),
    createStage({ label: 'STAGE 2', text: vehicle.stage2Plan, basePowerCv, fallbackGain: 55 }),
    createStage({ label: 'STAGE 3', text: vehicle.stage3Plan, basePowerCv, fallbackGain: 90, premiumLocked: true }),
  ];

  return {
    id: vehicleDoc.id,
    title: `${vehicleName}: preparacion THKB`,
    summary:
      vehicle.description ||
      vehicle.premiumSummary ||
      `${vehicleName} tiene una ficha creada en THKB con informacion tecnica, mantenimiento, fallos y modificaciones recomendadas.`,
    fitScore: 98,
    source: 'thkb',
    basePowerCv,
    baseTorqueNm,
    finalPowerCv: reliableLimitCv || stages.find((stage) => stage.label === 'STAGE 1')?.powerAfterCv || basePowerCv,
    factoryPowerSourceTitle: 'THKB',
    factoryPowerSourceUrl: splitLines(vehicle.researchSources)[0] || '',
    ownerProfile: requestedVehicle?.usage || 'Uso real',
    drivability: vehicle.engineTechnicalNotes || vehicle.description || '',
    maintenanceLevel: vehicle.maintenanceIntervals || 'Revisar mantenimiento antes de modificar.',
    legalNote: vehicle.tuningRequirements || 'Confirma normativa, homologacion y emisiones antes de instalar piezas.',
    vehicleDiagnosis: {
      mechanicalRisks: knownIssues,
      weakPoints: knownIssues,
      maintenanceBeforeTuning: maintenanceItems,
    },
    technicalProfile: {
      platform: vehicle.generation || vehicle.body || '',
      engineCode: vehicle.engineCode || vehicle.version || requestedVehicle?.engine || '',
      engineFamily: vehicle.engineFamily || '',
      reliablePowerLimitCv: reliableLimitCv,
      realLimitations: [
        ...splitLines(vehicle.issueSeverityAndCosts),
        ...splitLines(vehicle.incompatibilities),
      ],
    },
    vehicleIdentity: {
      canonicalBrand: vehicle.brand || requestedVehicle?.brand,
      canonicalModel: vehicle.model || requestedVehicle?.model,
      canonicalGeneration: vehicle.generation || requestedVehicle?.generation,
      canonicalEngine: vehicle.engineCode || vehicle.version || requestedVehicle?.engine,
      productionYears: joinTruthy([vehicle.yearStart, vehicle.yearEnd], '-'),
      factoryPowerCv: basePowerCv,
      factoryTorqueNm: baseTorqueNm,
      drivetrain: vehicle.drivetrain || requestedVehicle?.drivetrain,
      powertrain: vehicle.fuel || requestedVehicle?.powertrain,
    },
    freeBuild: {
      vehicleSheet: {
        infoText: vehicle.description || vehicle.engineTechnicalNotes,
        engineCode: vehicle.engineCode,
        engine: vehicle.version || vehicle.engineFamily,
        powerCv: basePowerCv,
        torqueNm: baseTorqueNm,
      },
      preInstallation: {
        title: 'Antes de modificar',
        intro: vehicle.preStageRequirements || vehicle.maintenanceIntervals,
        items: maintenanceItems,
      },
      modifications: {
        potentialText: vehicle.modCostsAndGains || vehicle.recommendedMods,
        possiblePowerCv: reliableLimitCv,
        possibleTorqueNm: null,
        parts: recommendedParts,
      },
      premiumOffer: {
        finalReinforcement:
          vehicle.premiumSummary ||
          'El plan de accion organiza esta ficha en pasos concretos para evitar compras incompatibles.',
      },
      risks: [
        ...knownIssues,
        ...splitLines(vehicle.issueSymptoms),
        ...splitLines(vehicle.issueSolutions),
      ],
    },
    recommendedParts,
    conversionTrigger: vehicle.premiumSummary || '',
    premiumUpsell: vehicle.premiumEvolution || vehicle.premiumSummary || '',
    conclusion: {
      recommendedStage: 'STAGE 1',
      summary: vehicle.premiumEvolution || vehicle.verificationNotes || vehicle.description || '',
    },
    accessTier: 'free',
    estimatedBudget: null,
    expectedGain: reliableLimitCv && basePowerCv ? `+${reliableLimitCv - basePowerCv} CV` : 'Por confirmar',
    reliabilityIndex: 82,
    executionTime: 'Por confirmar',
    stats: [
      { label: 'Potencia de serie', value: basePowerCv ? `${basePowerCv} CV` : 'Por confirmar', helper: 'Dato de THKB' },
      { label: 'Limite fiable', value: reliableLimitCv ? `${reliableLimitCv} CV` : 'Por confirmar', helper: 'Dato de THKB' },
      { label: 'Fallos conocidos', value: String(knownIssues.length), helper: 'Registrados en la ficha' },
      { label: 'Nivel de confianza', value: vehicle.confidenceLevel || 'Por confirmar', helper: 'Validacion THKB' },
    ],
    stages,
    reasons: splitLines(vehicle.sourceNotes),
    warnings: [
      ...splitLines(vehicle.incompatibilities),
      ...knownIssues,
    ].slice(0, 5),
  };
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

export async function findVehicleKnowledgeResult(vehicle) {
  if (!isFirebaseConfigured || !vehicle?.publicVehicleId) {
    return null;
  }

  const vehicleSnapshot = await getDoc(doc(db, 'vehicles', vehicle.publicVehicleId));

  if (!vehicleSnapshot.exists()) {
    return null;
  }

  const status = vehicleSnapshot.data()?.status;

  if (!PUBLIC_VEHICLE_STATUSES.includes(status)) {
    return null;
  }

  return toVehicleKnowledgeResult(vehicleSnapshot, vehicle);
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
