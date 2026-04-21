const POWERTRAINS = {
  gasolina: {
    powerMod: 1,
    budgetBias: 1,
    basePowerGain: 34,
    launchGain: 8,
    note: 'Base ideal para stage 1 rapido y respuesta mas viva.',
  },
  diesel: {
    powerMod: 0.92,
    budgetBias: 0.94,
    basePowerGain: 28,
    launchGain: 5,
    note: 'Conviene priorizar par motor, admision limpia y refrigeracion.',
  },
  hibrido: {
    powerMod: 0.7,
    budgetBias: 1.08,
    basePowerGain: 18,
    launchGain: 10,
    note: 'Mejor resultado con chasis, ruedas y respuesta del conjunto.',
  },
  electrico: {
    powerMod: 0.58,
    budgetBias: 1.18,
    basePowerGain: 14,
    launchGain: 13,
    note: 'En EV la mejora real viene de peso, frenos, neumaticos y gestion termica.',
  },
};

const GOALS = {
  calle: {
    label: 'Street balance',
    costMod: 0.85,
    reliabilityMod: 1.18,
    stages: [
      'Filtro de alto flujo y admision sellada',
      'Escape cat-back homologado',
      'Llantas ligeras y neumatico UHP',
    ],
  },
  tandas: {
    label: 'Track day',
    costMod: 1.22,
    reliabilityMod: 0.98,
    stages: [
      'Pastillas deportivas, latiguillos y liquido DOT alto',
      'Coilovers regulables y alineado especifico',
      'Intercooler o mejora termica segun plataforma',
    ],
  },
  drag: {
    label: 'Launch and pull',
    costMod: 1.3,
    reliabilityMod: 0.9,
    stages: [
      'Mapa motor centrado en par y salida',
      'Soportes reforzados y mejora de transmision',
      'Neumatico de maxima traccion y ajuste de peso',
    ],
  },
  stance: {
    label: 'Show stance',
    costMod: 1.05,
    reliabilityMod: 1.02,
    stages: [
      'Suspension regulable o air ride',
      'Fitment de llanta, separadores y alturas',
      'Detalle exterior y acabado premium',
    ],
  },
};

const PRIORITIES = {
  potencia: {
    score: 17,
    budget: 1.18,
    stageFocus: 'Powertrain',
    bonusPart: 'ECU tune o calibracion de entrega',
  },
  fiabilidad: {
    score: 15,
    budget: 1.08,
    stageFocus: 'Cooling & longevity',
    bonusPart: 'Mantenimiento cero: bujias, fluidos y manguitos',
  },
  estetica: {
    score: 12,
    budget: 1.1,
    stageFocus: 'Exterior & presence',
    bonusPart: 'Kit visual discreto y detalles OEM+',
  },
  equilibrio: {
    score: 14,
    budget: 1,
    stageFocus: 'Balanced setup',
    bonusPart: 'Setup mixto de chasis y respuesta',
  },
};

function createStages(goal, priority, powertrain, usageNote, basePowerCv) {
  const stageGains =
    powertrain.basePowerGain >= 30 ? [18, 12, 8] : powertrain.basePowerGain >= 24 ? [16, 10, 6] : [10, 7, 4];
  const stageOnePower = basePowerCv + stageGains[0];
  const stageTwoPower = stageOnePower + stageGains[1];
  const stageThreePower = stageTwoPower + stageGains[2];

  return [
    {
      label: 'STAGE 1',
      focus: 'Base fiable de calle',
      parts: [
        'Admision de alto flujo',
        'Reprogramacion ECU stage 1',
        goal.stages[0],
        priority.bonusPart,
      ],
      note: `${powertrain.note} ${usageNote}`,
      gainCv: stageGains[0],
      powerAfterCv: stageOnePower,
    },
    {
      label: 'STAGE 2',
      focus: `${priority.stageFocus} con mas flujo`,
      parts: [
        'Downpipe de alto flujo',
        'Intercooler o mejora termica',
        'Escape libre o cat-back deportivo',
        goal.stages[1],
      ],
      note: 'Esta etapa consolida la build para que no sea solo vistosa, sino utilizable.',
      gainCv: stageGains[1],
      powerAfterCv: stageTwoPower,
    },
    {
      label: 'STAGE 3',
      focus: 'Refinado final y soporte',
      parts: [
        'Bomba o soporte de combustible segun plataforma',
        'Frenada y neumaticos acordes al nivel final',
        'Ajuste fino de geometria y pesos',
        goal.stages[2],
      ],
      note: 'La ultima capa busca que el coche quede coherente y presentable para entregar al usuario.',
      gainCv: stageGains[2],
      powerAfterCv: stageThreePower,
    },
  ];
}

export function generateBuildRecommendation(vehicle) {
  const powertrain = POWERTRAINS[vehicle.powertrain];
  const goal = GOALS[vehicle.goal];
  const priority = PRIORITIES[vehicle.priority];

  const usageLabel = {
    diario: 'uso diario',
    finde: 'uso de fin de semana',
    proyecto: 'proyecto en evolucion',
  }[vehicle.usage];

  const drivetrainLabel = {
    fwd: 'traccion delantera',
    rwd: 'traccion trasera',
    awd: 'traccion total',
  }[vehicle.drivetrain];

  const usageNote =
    vehicle.usage === 'diario'
      ? 'Al ser un coche de diario, la build evita piezas que penalicen confort o mantenimiento.'
      : vehicle.usage === 'finde'
        ? 'Como coche de finde, admite una puesta a punto mas agresiva sin perder demasiada usabilidad.'
        : 'Al tratarse de un proyecto, la build deja espacio a futuras fases y a una presentacion mas aspiracional.';

  const vehicleDescriptor = [vehicle.model, vehicle.generation, vehicle.engine]
    .filter(Boolean)
    .join(' ');
  const basePowerCv =
    vehicle.powertrain === 'diesel'
      ? 105
      : vehicle.aspiration === 'turbo'
        ? 150
        : 125;
  const stages = createStages(goal, priority, powertrain, usageNote, basePowerCv);
  const finalPowerCv = stages[stages.length - 1]?.powerAfterCv ?? basePowerCv;

  return {
    title: `${vehicle.brand} ${vehicleDescriptor}: build ${goal.label}`,
    summary: `Configuracion pensada para ${usageLabel}, con ${drivetrainLabel}, prioridad en ${vehicle.priority} y una hoja de ruta clara de tres etapas.`,
    source: 'fallback',
    basePowerCv,
    finalPowerCv,
    expectedGain: vehicle.powertrain === 'diesel' ? '+25 hp / +55 Nm' : '+30 hp / +40 Nm',
    estimatedBudget: Math.round(520 * goal.costMod * priority.budget * powertrain.budgetBias),
    reliabilityIndex: Math.min(94, Math.round(72 * goal.reliabilityMod + priority.score)),
    executionTime: vehicle.usage === 'diario' ? '1 a 2 semanas' : '2 a 4 semanas',
    stages,
    reasons: [
      `La build se apoya en un ${vehicle.powertrain} ${vehicle.transmission} con enfoque realista para un ${vehicle.year}.`,
      vehicle.generation
        ? `La fase "${vehicle.generation}" ayuda a acotar mejor plataforma, piezas compatibles y tono de la build.`
        : 'La fase no se ha especificado, asi que la build se mantiene algo mas generalista.',
      `La prioridad "${vehicle.priority}" empuja las piezas hacia ${priority.stageFocus.toLowerCase()} en vez de montar mods sin coherencia.`,
      'La build esta planteada para evolucionar el coche por STAGES, sin saltarse la base mecanica ni el soporte necesario.',
    ],
    warnings: [
      'Antes de vender la build como definitiva, conviene validar compatibilidades reales por plataforma y motorizacion exacta.',
      'Si hay reprogramacion o cambios de emisiones, hay que revisar homologacion e ITV.',
      'Esta build es una recomendacion de respaldo porque no habia una coincidencia especifica en base de datos ni una respuesta disponible de IA.',
    ],
  };
}
