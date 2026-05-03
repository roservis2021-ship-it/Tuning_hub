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

function normalizeMileageKm(value) {
  const mileageKm = Number(value);

  return Number.isFinite(mileageKm) && mileageKm >= 0 ? Math.round(mileageKm) : null;
}

function getMileageContext(value) {
  const mileageKm = normalizeMileageKm(value);

  if (mileageKm === null) {
    return {
      label: 'kilometraje no indicado',
      warning:
        'Al no indicar kilometraje, conviene verificar historial, diagnosis y desgaste antes de subir potencia.',
      stageNote: 'Stage 0 debe confirmar el estado real de la base antes de recomendar una Stage 1.',
      reliabilityPenalty: 0,
    };
  }

  if (mileageKm < 60000) {
    return {
      label: `${mileageKm.toLocaleString('es-ES')} km`,
      warning: 'Aunque el kilometraje es bajo, hay que comprobar mantenimiento y estado antes de modificar.',
      stageNote: 'Base poco rodada: Stage 0 puede ser ligera si el historial esta claro.',
      reliabilityPenalty: 0,
    };
  }

  if (mileageKm < 140000) {
    return {
      label: `${mileageKm.toLocaleString('es-ES')} km`,
      warning:
        'Con kilometraje medio, revisar fluidos, frenos, bujias/calentadores y embrague antes de Stage 1.',
      stageNote: 'Stage 0 debe cerrar mantenimiento pendiente antes de buscar mas par.',
      reliabilityPenalty: 4,
    };
  }

  if (mileageKm < 220000) {
    return {
      label: `${mileageKm.toLocaleString('es-ES')} km`,
      warning:
        'Con kilometraje alto, prioriza diagnosis, fugas, turbo, embrague/transmision y refrigeracion antes de potencia.',
      stageNote: 'Stage 0 debe ser serio y puede limitar la agresividad del Stage 1.',
      reliabilityPenalty: 9,
    };
  }

  return {
    label: `${mileageKm.toLocaleString('es-ES')} km`,
    warning:
      'Con kilometraje muy alto, cualquier Stage 1 debe depender de una inspeccion mecanica completa.',
    stageNote: 'Conviene una build conservadora y centrada en fiabilidad antes que en cifras.',
    reliabilityPenalty: 14,
  };
}

function createPart(name, priceEuro, explanation) {
  return {
    name,
    priceEuro,
    explanation,
  };
}

function createRecommendedPart(part, priority = 'media', impact = 'fiabilidad') {
  return {
    name: part.name,
    reason: part.explanation,
    priority,
    impact,
    estimatedPriceEuro: part.priceEuro,
  };
}

function createStages(goal, priority, powertrain, usageNote, basePowerCv, vehicle) {
  const aggression = priority.aggression ?? 1;
  const turboAggressive = vehicle.aspiration === 'turbo' && aggression >= 1.2;
  const mileageContext = getMileageContext(vehicle.mileageKm);
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
      label: 'STAGE 0',
      focus: 'Mantenimiento base',
      objective: 'Dejar la base sana antes de gastar en potencia.',
      parts: [
        createPart('Revision completa de fluidos y filtros', 220, 'Evita construir la build sobre una base con mantenimiento dudoso.'),
        createPart('Chequeo de frenos, neumaticos y fugas', 180, 'Detecta limites reales antes de subir par o ritmo.'),
        createPart('Diagnosis electronica y logs basicos', 90, 'Permite ver fallos ocultos antes de reprogramar o comprar piezas.'),
      ],
      note: `Primero se valida que el coche esta sano. ${mileageContext.stageNote}`,
      whyThisStage: 'Sin esta base, una reprogramacion o una pieza cara puede esconder fallos previos y acabar saliendo mas cara.',
      bestFor: 'Cualquier usuario que quiera una build fiable y no solo una lista de piezas.',
      watchouts: [
        'No reprogramar si hay fallos de admision, encendido, inyeccion, turbo o refrigeracion.',
        'Confirmar referencias por VIN si la generacion o el codigo motor no estan claros.',
      ],
      gainCv: 0,
      powerAfterCv: basePowerCv,
      estimatedTorqueNm: 0,
      costRangeEuro: '300-600 €',
      reliability: 'alta',
      difficulty: 'baja',
      legalImpact: 'Sin impacto legal si se mantiene configuracion de serie.',
      detailLevel: 'full',
      premiumLocked: false,
      installOrder: ['Diagnosis', 'Fluidos y filtros', 'Revision de frenos/neumaticos', 'Prueba y logs'],
      dependencies: [],
    },
    {
      label: 'STAGE 1',
      focus: priority.aggression > 1.2 ? 'Base seria con margen real' : 'Base fiable de calle',
      objective: 'Ganar respuesta y rendimiento util sin comprometer el uso de calle.',
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
      whyThisStage:
        priority.aggression > 1.2
          ? 'La primera etapa deja una base con respuesta clara, pero ya pensando en que el coche va a seguir creciendo.'
          : 'La primera etapa ordena la build y mejora lo que mas se nota en uso real sin disparar complejidad.',
      bestFor:
        vehicle.usage === 'diario'
          ? 'Usuarios que quieren notar el coche mas vivo sin convertirlo en una fuente de dolores de cabeza.'
          : 'Quien quiere empezar el proyecto con una base util y bien escogida.',
      watchouts: [
        'Revisar mantenimiento previo, estado de admision y posibles fugas antes de reprogramar.',
        'Si la base no esta sana, esta etapa puede rendir peor de lo esperado.',
      ],
      gainCv: stageGains[0],
      powerAfterCv: stageOnePower,
      estimatedTorqueNm: Math.round(stageGains[0] * (vehicle.powertrain === 'diesel' ? 2.3 : 1.6)),
      costRangeEuro: '700-1.500 €',
      reliability: 'alta',
      difficulty: 'media',
      legalImpact: 'Puede requerir homologacion segun pieza, ruido o emisiones.',
      detailLevel: 'full',
      premiumLocked: false,
      installOrder: ['Mantenimiento validado', 'Piezas de soporte', 'Calibracion', 'Prueba final'],
      dependencies: ['Stage 0 completado'],
    },
    {
      label: 'STAGE 2',
      focus: `${priority.stageFocus} con mas flujo`,
      objective: 'Subir el nivel con soporte termico, chasis o flujo segun plataforma.',
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
      whyThisStage:
        priority.aggression > 1.2
          ? 'Aqui ya se atan flujo, temperatura y hardware para que la subida de nivel sea creible.'
          : 'Esta etapa hace que la build gane consistencia y aguante mejor un uso mas exigente.',
      bestFor:
        vehicle.usage === 'finde'
          ? 'Coches de fin de semana donde el usuario ya quiere algo realmente serio.'
          : 'Usuarios que quieren una build con mas pegada y un comportamiento mas redondo.',
      watchouts: [
        'A partir de este punto conviene vigilar temperaturas, embrague y frenos con mas atencion.',
        'Las piezas deben elegirse por plataforma y no por receta universal.',
      ],
      gainCv: stageGains[1],
      powerAfterCv: stageTwoPower,
      estimatedTorqueNm: Math.round(stageGains[1] * (vehicle.powertrain === 'diesel' ? 2.5 : 1.7)),
      costRangeEuro: '1.200-2.800 €',
      reliability: priority.aggression > 1.2 ? 'media' : 'alta',
      difficulty: 'media',
      legalImpact: 'Revisar homologacion, emisiones y ruido antes de circular.',
      detailLevel: 'summary',
      premiumLocked: true,
      installOrder: [],
      dependencies: ['Stage 1 completado', 'Temperaturas y transmision revisadas'],
    },
    {
      label: 'STAGE 3',
      focus: priority.aggression > 1.2 ? 'Cierre serio al limite razonable' : 'Refinado final y soporte',
      objective: 'Cerrar el proyecto con soporte real y sin perseguir potencia sin control.',
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
      whyThisStage:
        priority.aggression > 1.2
          ? 'La tercera etapa no busca vender humo: busca cerrar una receta potente con el soporte minimo para que tenga sentido.'
          : 'La tercera etapa afina detalles, refuerza soportes y deja el conjunto mas completo.',
      bestFor:
        vehicle.usage === 'proyecto'
          ? 'Proyectos donde el usuario quiere rematar el coche y asumir mas coste y mantenimiento.'
          : 'Usuarios que aceptan mas compromiso a cambio de cerrar el proyecto con sentido.',
      watchouts: [
        'Aqui ya puede haber mas compromiso en ITV, ruido, mantenimiento o confort.',
        'No todas las plataformas justifican una etapa 3 igual de agresiva.',
      ],
      gainCv: stageGains[2],
      powerAfterCv: stageThreePower,
      estimatedTorqueNm: Math.round(stageGains[2] * (vehicle.powertrain === 'diesel' ? 2.6 : 1.8)),
      costRangeEuro: '1.800-4.500 €',
      reliability: priority.aggression > 1.2 ? 'exigente' : 'media',
      difficulty: 'alta',
      legalImpact: 'Alta probabilidad de requerir homologacion y validacion especifica para ITV.',
      detailLevel: 'summary',
      premiumLocked: true,
      installOrder: [],
      dependencies: ['Stage 2 validado', 'Frenos, neumaticos y refrigeracion acordes'],
    },
  ];
}

export function generateBuildRecommendation(vehicle) {
  const powertrain = POWERTRAINS[vehicle.powertrain] ?? POWERTRAINS.gasolina;
  const goal = GOALS[vehicle.goal] ?? GOALS.calle;
  const priority = PRIORITIES[vehicle.priority] ?? PRIORITIES.equilibrio;
  const mileageContext = getMileageContext(vehicle.mileageKm);

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
  const recommendedParts = [
    createRecommendedPart(stages[0].parts[0], 'alta', 'fiabilidad'),
    createRecommendedPart(stages[0].parts[1], 'alta', 'fiabilidad'),
    createRecommendedPart(stages[1].parts[0], 'media', 'rendimiento'),
    createRecommendedPart(stages[1].parts[2], priority.aggression > 1.2 ? 'alta' : 'media', 'rendimiento'),
  ].slice(0, 5);
  const stageOne = stages[1];
  const possibleTorqueNm = stageOne.estimatedTorqueNm || 0;
  const fallbackRisks = [
    'Montar piezas sin orden puede forzar turbo y mezcla.',
    'Comprar piezas sin codigo motor puede salir caro.',
    'Reprogramar sin diagnosis puede romper embrague o subir temperatura.',
  ];

  return {
    title: `${vehicle.brand} ${vehicleDescriptor}: build ${goal.label}`,
    summary: `Configuracion pensada para ${usageLabel}, con ${drivetrainLabel}, ${mileageContext.label}, objetivo en ${vehicle.priority} y una hoja de ruta clara desde mantenimiento hasta Stage 3.`,
    source: 'fallback',
    accessTier: 'free',
    technicalProfile: {
      platform: vehicle.generation || 'Plataforma por confirmar',
      engineFamily: vehicle.engine || 'Familia de motor por confirmar',
      engineCode: 'No confirmado',
      groupCompatibilities: ['Compatible probable, verificar con referencia OEM o VIN'],
      realLimitations: [
        'Estado de mantenimiento previo',
        mileageContext.warning,
        'Temperatura, frenos, neumaticos y transmision segun uso',
      ],
      reliablePowerLimitCv: finalPowerCv,
    },
    freeBuild: {
      vehicleSheet: {
        engineCode: 'No confirmado',
        powerCv: basePowerCv,
        torqueNm: 0,
        engine: vehicle.engine || 'Motor por confirmar',
        infoText:
          'Esta build es orientativa porque no se ha podido confirmar el codigo motor exacto. Antes de comprar piezas, verifica la referencia OEM o el VIN.',
      },
      preInstallation: {
        title: 'Antes de modificar',
        intro:
          'Primero hay que confirmar que la base esta sana y que la variante exacta coincide con las piezas que se quieren montar.',
        items: [
          'Confirmar codigo motor por VIN, ficha tecnica o etiqueta del vano motor.',
          'Hacer diagnosis y revisar fallos activos antes de modificar.',
          'Revisar fluidos, filtros, bujias/calentadores y estado de admision.',
          mileageContext.warning,
          'Comprobar frenos, neumaticos y posibles fugas antes de subir ritmo.',
        ],
      },
      modifications: {
        potentialText:
          'Sin codigo motor confirmado, la recomendacion debe mantenerse conservadora. El potencial real dependera de la variante exacta, kilometraje, aspiracion, traccion y estado mecanico.',
        possiblePowerCv: stageOne.powerAfterCv,
        possibleTorqueNm,
        parts: recommendedParts.slice(0, 4).map((part) => ({
          name: part.name,
          reason: part.reason,
          estimatedPriceEuro: part.estimatedPriceEuro,
        })),
      },
      risks: fallbackRisks,
      premiumOffer: {
        title: 'Plan optimizado con codigo motor verificado',
        intro:
          'El plan optimizado parte de la variante exacta para ordenar piezas, evitar incompatibilidades y no gastar dos veces.',
        benefits: [
          'Plan completo de instalaciones',
          'Orden exacto de instalacion',
          'Piezas recomendadas para tu motor',
          'Errores especificos de tu motor',
        ],
        cta: 'Obtener plan optimizado',
        finalReinforcement:
          'Sin confirmar el codigo motor, cualquier build debe tratarse como orientativa.',
      },
    },
    vehicleDiagnosis: {
      strengths: [
        'Base valida para una mejora progresiva si el mantenimiento esta al dia.',
        mileageContext.stageNote,
        'Permite ordenar piezas por impacto real y presupuesto.',
      ],
      weaknesses: [
        'La variante exacta debe validarse antes de comprar piezas caras.',
        'Las etapas altas pueden exigir soporte de frenos, temperatura o transmision.',
      ],
      mechanicalRisks: [
        'Gastar en potencia sin revisar fugas, consumibles o diagnosis previa.',
        'Montar piezas universales sin comprobar referencia OEM o VIN.',
      ],
      reliablePowerLimit: `${finalPowerCv} CV orientativos con soporte adecuado.`,
    },
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
    reliabilityIndex: Math.min(
      94,
      Math.max(45, Math.round(72 * goal.reliabilityMod + priority.score - mileageContext.reliabilityPenalty)),
    ),
    executionTime: vehicle.usage === 'diario' ? '1 a 2 semanas' : '2 a 4 semanas',
    ownerProfile:
      priority.aggression > 1.2
        ? 'Encaja con alguien que disfruta afinando el coche, acepta mas coste y quiere una build claramente seria.'
        : 'Encaja con un usuario que quiere una mejora bien pensada, disfrutable y sin perder demasiado sentido practico.',
    drivability:
      vehicle.usage === 'diario'
        ? 'Mantiene una conduccion utilizable en calle, aunque las etapas altas pueden volverlo mas exigente.'
        : 'La conduccion gana caracter y sensacion de proyecto, con menos concesiones cuanto mas avances.',
    maintenanceLevel:
      priority.aggression > 1.2
        ? 'Medio-alto: exige revisar consumibles, temperaturas y soporte mecanico con disciplina.'
        : 'Medio: requiere mantener la base al dia, pero sin convertirse en un coche imposible de sostener.',
    legalNote:
      priority.aggression > 1.2
        ? 'Varias piezas pueden requerir homologacion o no ser adecuadas para una ITV tranquila si se montan tal cual.'
        : 'Conviene revisar homologacion, emisiones y ruido antes de cerrar la receta definitiva.',
    stages,
    recommendedParts,
    conversionTrigger:
      'El error mas caro suele ser comprar una pieza de potencia antes de confirmar mantenimiento, referencias y limites de transmision.',
    premiumUpsell:
      'Desbloquea el plan optimizado para ver el orden exacto de instalacion, dependencias entre piezas y como repartir el presupuesto sin comprar dos veces.',
    conclusion: {
      recommendedStage: 'STAGE 1',
      why: 'Es el mejor equilibrio entre coste, sensacion real y fiabilidad para empezar.',
      whatToAvoid: 'Evita saltar a Stage 2 o Stage 3 sin diagnosis, frenos/neumaticos y compatibilidad por VIN.',
    },
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
      mileageContext.warning,
      'Si hay reprogramacion o cambios de emisiones, hay que revisar homologacion e ITV.',
      'Esta build es una recomendacion de respaldo porque no habia una coincidencia especifica en base de datos ni una respuesta disponible de IA.',
    ],
  };
}
