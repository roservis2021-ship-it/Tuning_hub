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
  radical: {
    label: 'Max effort',
    costMod: 1.42,
    reliabilityMod: 0.82,
    stages: [
      'Mapa motor serio y soporte de transmision',
      'Flujo, refrigeracion y hardware de verdad',
      'Frenos, embrague y cierre de build al limite razonable',
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
    aggression: 1.12,
    stageFocus: 'Powertrain',
    bonusPart: 'ECU tune o calibracion de entrega',
  },
  fiabilidad: {
    score: 15,
    budget: 1.08,
    aggression: 0.9,
    stageFocus: 'Cooling & longevity',
    bonusPart: 'Mantenimiento cero: bujias, fluidos y manguitos',
  },
  estetica: {
    score: 12,
    budget: 1.1,
    aggression: 0.82,
    stageFocus: 'Exterior & presence',
    bonusPart: 'Kit visual discreto y detalles OEM+',
  },
  equilibrio: {
    score: 14,
    budget: 1,
    aggression: 1,
    stageFocus: 'Balanced setup',
    bonusPart: 'Setup mixto de chasis y respuesta',
  },
  radical: {
    score: 22,
    budget: 1.34,
    aggression: 1.34,
    stageFocus: 'Maximum attack',
    bonusPart: 'Hardware serio de soporte y calibracion agresiva',
  },
};

function createPart(name, priceEuro, explanation) {
  return {
    name,
    priceEuro,
    explanation,
  };
}

function createStages(goal, priority, powertrain, usageNote, basePowerCv, vehicle) {
  const aggression = priority.aggression ?? 1;
  const turboAggressive = vehicle.aspiration === 'turbo' && aggression >= 1.2;
  const stageGainsBase =
    powertrain.basePowerGain >= 30 ? [18, 12, 8] : powertrain.basePowerGain >= 24 ? [16, 10, 6] : [10, 7, 4];
  const stageGains = stageGainsBase.map((gain, index) =>
    Math.max(index === 0 ? 6 : 4, Math.round(gain * aggression)),
  );
  const stageOnePower = basePowerCv + stageGains[0];
  const stageTwoPower = stageOnePower + stageGains[1];
  const stageThreePower = stageTwoPower + stageGains[2];

  return [
    {
      label: 'STAGE 1',
      focus: priority.aggression > 1.2 ? 'Base seria con margen real' : 'Base fiable de calle',
      parts: [
        createPart('Admision de alto flujo', 180, 'Mejora la respuesta sin comprometer el uso diario.'),
        createPart('Reprogramacion ECU stage 1', 350, 'Ajuste comun y realista si la base esta sana.'),
        createPart(goal.stages[0], 420, 'Da coherencia al primer escalon de la build.'),
        createPart(
          priority.bonusPart,
          priority.aggression > 1.2 ? 420 : 220,
          priority.aggression > 1.2
            ? 'Refuerza el objetivo ambicioso sin perder la logica de la plataforma.'
            : 'Refuerza el enfoque principal sin irse a una receta extrema.',
        ),
      ],
      note: `${powertrain.note} ${usageNote}`,
      gainCv: stageGains[0],
      powerAfterCv: stageOnePower,
    },
    {
      label: 'STAGE 2',
      focus: `${priority.stageFocus} con mas flujo`,
      parts: [
        createPart('Downpipe de alto flujo', 320, 'Ayuda al conjunto si la plataforma tolera mas flujo.'),
        createPart('Intercooler o mejora termica', 550, 'Controla temperaturas cuando la exigencia sube.'),
        createPart(
          turboAggressive ? 'Turbo hibrido o mejora de soplado segun plataforma' : 'Escape libre o cat-back deportivo',
          turboAggressive ? 1200 : 650,
          turboAggressive
            ? 'Cuando el objetivo es serio, la plataforma puede pedir hardware de verdad y no solo perifericos.'
            : 'Mejora evacuacion y sonido con una solucion habitual.',
        ),
        createPart(goal.stages[1], 780, 'Prepara el coche para un uso mas serio sin perder coherencia.'),
      ],
      note:
        priority.aggression > 1.2
          ? 'Esta etapa deja claro que la build va en serio y ya exige soporte real.'
          : 'Esta etapa consolida la build para que no sea solo vistosa, sino utilizable.',
      gainCv: stageGains[1],
      powerAfterCv: stageTwoPower,
    },
    {
      label: 'STAGE 3',
      focus: priority.aggression > 1.2 ? 'Cierre serio al limite razonable' : 'Refinado final y soporte',
      parts: [
        createPart(
          'Bomba o soporte de combustible segun plataforma',
          priority.aggression > 1.2 ? 680 : 480,
          'Solo tiene sentido si el nivel final lo pide.',
        ),
        createPart(
          'Frenada y neumaticos acordes al nivel final',
          priority.aggression > 1.2 ? 1250 : 950,
          'Sube la seguridad y la capacidad real del coche.',
        ),
        createPart('Ajuste fino de geometria y pesos', 180, 'Afina el comportamiento para que el conjunto funcione mejor.'),
        createPart(goal.stages[2], 900, 'Completa la build con una mejora avanzada pero razonable.'),
      ],
      note:
        priority.aggression > 1.2
          ? 'La ultima capa cierra una build ya ambiciosa, pero con soporte y explicaciones honestas.'
          : 'La ultima capa busca que el coche quede coherente y presentable para entregar al usuario.',
      gainCv: stageGains[2],
      powerAfterCv: stageThreePower,
    },
  ];
}

export function generateBuildRecommendation(vehicle) {
  const powertrain = POWERTRAINS[vehicle.powertrain] ?? POWERTRAINS.gasolina;
  const goal = GOALS[vehicle.goal] ?? GOALS.calle;
  const priority = PRIORITIES[vehicle.priority] ?? PRIORITIES.equilibrio;

  const usageLabel = {
    diario: 'uso diario',
    finde: 'uso de fin de semana',
    proyecto: 'proyecto en evolucion',
  }[vehicle.usage] ?? 'uso general';

  const drivetrainLabel = {
    fwd: 'traccion delantera',
    rwd: 'traccion trasera',
    awd: 'traccion total',
  }[vehicle.drivetrain] ?? 'traccion no especificada';

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
  const stages = createStages(goal, priority, powertrain, usageNote, basePowerCv, vehicle);
  const finalPowerCv = stages[stages.length - 1]?.powerAfterCv ?? basePowerCv;

  return {
    title: `${vehicle.brand} ${vehicleDescriptor}: build ${goal.label}`,
    summary: `Configuracion pensada para ${usageLabel}, con ${drivetrainLabel}, objetivo en ${vehicle.priority} y una hoja de ruta clara de tres etapas.`,
    source: 'fallback',
    basePowerCv,
    finalPowerCv,
    expectedGain:
      priority.aggression > 1.2
        ? vehicle.powertrain === 'diesel'
          ? '+40 hp / +80 Nm'
          : '+55 hp / +70 Nm'
        : vehicle.powertrain === 'diesel'
          ? '+25 hp / +55 Nm'
          : '+30 hp / +40 Nm',
    estimatedBudget: Math.round(520 * goal.costMod * priority.budget * powertrain.budgetBias),
    reliabilityIndex: Math.min(94, Math.round(72 * goal.reliabilityMod + priority.score)),
    executionTime: vehicle.usage === 'diario' ? '1 a 2 semanas' : '2 a 4 semanas',
    stages,
    reasons: [
      `La build se apoya en un ${vehicle.powertrain} ${vehicle.transmission} con enfoque realista para esta plataforma.`,
      vehicle.generation
        ? `La fase "${vehicle.generation}" ayuda a acotar mejor plataforma, piezas compatibles y tono de la build.`
        : 'La fase no se ha especificado, asi que la build se mantiene algo mas generalista.',
      `El objetivo "${vehicle.priority}" empuja las piezas hacia ${priority.stageFocus.toLowerCase()} en vez de montar mods sin coherencia.`,
      'La build esta planteada para evolucionar el coche por STAGES, sin saltarse la base mecanica ni el soporte necesario.',
    ],
    warnings: [
      'Antes de vender la build como definitiva, conviene validar compatibilidades reales por plataforma y motorizacion exacta.',
      'Si hay reprogramacion o cambios de emisiones, hay que revisar homologacion e ITV.',
      'Esta build es una recomendacion de respaldo porque no habia una coincidencia especifica en base de datos ni una respuesta disponible de IA.',
    ],
  };
}
