import { useEffect, useMemo, useState } from 'react';
import VehiclePreview from './VehiclePreview';

function getSourceMeta(source) {
  if (source === 'database') {
    return 'Build validada para esta plataforma';
  }

  if (source === 'generated') {
    return 'Build generada para tu configuracion actual';
  }

  return 'Build de respaldo mientras ampliamos referencias';
}

function getPartDescription(part) {
  const normalized = part.toLowerCase();

  if (normalized.includes('repro') || normalized.includes('ecu')) {
    return 'Libera el potencial de la base con una calibracion coherente y utilizable.';
  }

  if (normalized.includes('admi') || normalized.includes('filtro')) {
    return 'Mejora la respiracion del conjunto y acompana mejor la respuesta del motor.';
  }

  if (normalized.includes('downpipe') || normalized.includes('escape')) {
    return 'Ayuda a que la plataforma respire mejor y prepara el siguiente salto.';
  }

  if (normalized.includes('intercooler') || normalized.includes('termica')) {
    return 'Controla temperaturas y hace que el rendimiento sea mas consistente.';
  }

  if (normalized.includes('embrague')) {
    return 'Soporte mecanico clave cuando el par empieza a subir de verdad.';
  }

  if (normalized.includes('freno')) {
    return 'La frenada tiene que crecer junto al proyecto para que todo tenga sentido.';
  }

  if (normalized.includes('llanta') || normalized.includes('neumatico')) {
    return 'Gran parte de la sensacion final del coche se gana aqui, no solo con potencia.';
  }

  return 'Pieza o accion recomendada para que esta etapa tenga sentido como conjunto.';
}

function buildShareText(vehicleName, result) {
  return [
    `Quiero empezar esta build para ${vehicleName}.`,
    '',
    `Build: ${result.title}`,
    `Ganancia estimada: ${result.expectedGain || 'Por definir'}`,
    '',
    ...result.stages.map((stage) => `${stage.label} - ${stage.focus}`),
  ].join('\n');
}

function getStageFeeling(index) {
  return [
    'Base solida y sensacion inmediata',
    'Mas caracter, mas presencia y mas empuje',
    'Proyecto rematado con identidad propia',
  ][index] ?? 'Evolucion clara del proyecto';
}

function getStageTheme(index) {
  return ['ignition', 'boost', 'redline'][index] ?? 'ignition';
}

function toNumber(value) {
  const numericValue = Number(value);
  return Number.isFinite(numericValue) && numericValue > 0 ? numericValue : null;
}

function formatCv(value) {
  const numericValue = toNumber(value);
  return Number.isFinite(numericValue) && numericValue > 0 ? `${numericValue} CV` : 'Por definir';
}

function inferFactoryPowerCv(vehicle) {
  const vehicleText = [vehicle?.brand, vehicle?.model, vehicle?.generation, vehicle?.engine]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
  const explicitPowerMatch = vehicleText.match(/(\d{2,3})\s*(cv|hp|bhp|ps)/);

  if (explicitPowerMatch) {
    return Number(explicitPowerMatch[1]);
  }

  const knownEnginePower = [
    [/1\.9\s*tdi.*(105|bkc|bxe|bls)/, 105],
    [/1\.9\s*tdi.*(110|asv|ahf)/, 110],
    [/1\.9\s*tdi.*(130|asz)/, 130],
    [/1\.9\s*tdi.*(150|arl)/, 150],
    [/1\.9\s*tdi/, 105],
    [/2\.0\s*tdi.*(140|bkd)/, 140],
    [/2\.0\s*tdi.*150/, 150],
    [/2\.0\s*tdi/, 140],
    [/1\.6\s*tdi/, 105],
    [/1\.8\s*t/, 150],
    [/2\.0\s*tfsi.*(s3|8p)/, 265],
    [/2\.0\s*tfsi.*(gti|a3|leon)/, 200],
    [/2\.0\s*tfsi/, 200],
    [/2\.0\s*tsi/, 200],
    [/1\.4\s*tsi/, 122],
    [/1\.4\s*t-?jet/, 135],
    [/1\.6\s*hdi/, 110],
    [/2\.0\s*hdi/, 136],
    [/1\.5\s*dci/, 105],
    [/2\.0\s*dci/, 150],
    [/320d/, 184],
    [/330d/, 245],
    [/335d/, 286],
    [/m140i|m135i/, 340],
  ];
  const match = knownEnginePower.find(([pattern]) => pattern.test(vehicleText));

  if (match) {
    return match[1];
  }

  if (vehicle?.powertrain === 'diesel') {
    return 110;
  }

  if (vehicle?.aspiration === 'turbo') {
    return 150;
  }

  return 120;
}

function getFallbackStageGains(result, vehicle) {
  const text = `${vehicle?.engine ?? ''} ${vehicle?.model ?? ''}`.toLowerCase();

  if (vehicle?.powertrain === 'diesel' || /tdi|hdi|jtd|dci|cdti/.test(text)) {
    return [25, 20, 15];
  }

  if (vehicle?.aspiration === 'atmosferico') {
    return [8, 6, 4];
  }

  if (/s3|cupra|gti|tfsi|tsi|1\.8t|2\.0t|t-jet/.test(text)) {
    return [45, 35, 25];
  }

  return [30, 25, 15];
}

function resolvePowerProfile(result, vehicle) {
  const rawStages = result.stages ?? [];
  const fallbackBase = inferFactoryPowerCv(vehicle);
  const fallbackGains = getFallbackStageGains(result, vehicle);
  const stages = rawStages.map((stage, index) => ({
    ...stage,
    gainCv: toNumber(stage.gainCv) ?? fallbackGains[index] ?? 10,
  }));
  const finalFromStage = toNumber(stages.at(-1)?.powerAfterCv);
  const totalStageGain = stages.reduce((total, stage) => total + (toNumber(stage.gainCv) ?? 0), 0);
  const baseFromResult = toNumber(result.basePowerCv);
  const finalFromResult = toNumber(result.finalPowerCv);
  const baseFromStages = finalFromStage && totalStageGain > 0 ? finalFromStage - totalStageGain : null;
  const basePowerCv = baseFromResult ?? baseFromStages ?? fallbackBase;
  let runningPower = basePowerCv;
  const stagesWithPower = stages.map((stage) => {
    const gainCv = toNumber(stage.gainCv) ?? 0;
    const powerAfterCv = toNumber(stage.powerAfterCv) ?? runningPower + gainCv;
    runningPower = powerAfterCv;

    return {
      ...stage,
      gainCv,
      powerAfterCv,
    };
  });
  const finalPowerCv = finalFromResult ?? finalFromStage ?? stagesWithPower.at(-1)?.powerAfterCv ?? basePowerCv;

  return {
    basePowerCv,
    finalPowerCv,
    stages: stagesWithPower,
  };
}

function AnimatedCvNumber({ from, value, animationKey }) {
  const safeFrom = toNumber(from) ?? toNumber(value) ?? 0;
  const safeValue = toNumber(value) ?? safeFrom;
  const [displayValue, setDisplayValue] = useState(safeFrom);

  useEffect(() => {
    setDisplayValue(safeFrom);

    const startValue = safeFrom;
    const targetValue = safeValue;
    const duration = 720;
    const startTime = window.performance.now();

    let frameId = 0;

    function tick(now) {
      const progress = Math.min((now - startTime) / duration, 1);
      const eased = 1 - (1 - progress) ** 3;
      setDisplayValue(Math.round(startValue + (targetValue - startValue) * eased));

      if (progress < 1) {
        frameId = window.requestAnimationFrame(tick);
      }
    }

    frameId = window.requestAnimationFrame(tick);

    return () => window.cancelAnimationFrame(frameId);
  }, [safeFrom, safeValue, animationKey]);

  return <strong>{formatCv(displayValue)}</strong>;
}

function CvProgress({ basePowerCv, previousPowerCv, currentPowerCv, finalPowerCv, gainCv, animationKey }) {
  const safeBase = toNumber(basePowerCv) ?? 0;
  const safePrevious = toNumber(previousPowerCv) ?? safeBase;
  const safeCurrent = toNumber(currentPowerCv) ?? safePrevious;
  const safeFinal = toNumber(finalPowerCv) ?? safeCurrent;
  const progress =
    safeFinal > safeBase ? Math.max(0, Math.min(100, ((safeCurrent - safeBase) / (safeFinal - safeBase)) * 100)) : 0;

  return (
    <section className="cv-progress-card">
      <div className="cv-progress-card__head">
        <span className="cv-progress-card__eyebrow">Progreso de potencia</span>
        <span className="cv-progress-card__gain">+{gainCv ?? 0} CV en esta etapa</span>
      </div>

      <div className="cv-progress-card__numbers">
        <div>
          <span>Base</span>
          <strong>{formatCv(safeBase)}</strong>
        </div>
        <div className="cv-progress-card__numbers-current">
          <span>Ahora</span>
          <AnimatedCvNumber from={safePrevious} value={safeCurrent} animationKey={animationKey} />
        </div>
        <div>
          <span>Final</span>
          <strong>{formatCv(safeFinal)}</strong>
        </div>
      </div>

      <div className="cv-progress-card__track" aria-hidden="true">
        <span className="cv-progress-card__track-base" />
        <span className="cv-progress-card__track-fill" style={{ width: `${progress}%` }} />
        <span className="cv-progress-card__track-glow" style={{ left: `${progress}%` }} />
      </div>
    </section>
  );
}

function BuildResult({ result, vehicle, onBack }) {
  const [activeStageIndex, setActiveStageIndex] = useState(0);

  if (!result) {
    return (
      <section className="build-screen">
        <div className="build-card build-card--empty">
          <span className="section-heading__eyebrow">Build optimizada</span>
          <h2>Aqui apareceran tus resultados</h2>
          <p>Completa los datos de tu coche para ver una propuesta organizada por etapas.</p>
        </div>
      </section>
    );
  }

  const powerProfile = resolvePowerProfile(result, vehicle);
  const stages = powerProfile.stages;
  const activeStage = stages[activeStageIndex] ?? null;
  const isFirstStage = activeStageIndex === 0;
  const isLastStage = activeStageIndex === stages.length - 1;
  const vehicleName = [vehicle?.brand, vehicle?.model, vehicle?.generation, vehicle?.engine]
    .filter(Boolean)
    .join(' ');
  const shareText = useMemo(() => buildShareText(vehicleName, result), [vehicleName, result]);
  const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(shareText)}`;
  const stageTheme = getStageTheme(activeStageIndex);
  const previousPowerCv =
    activeStageIndex === 0
      ? powerProfile.basePowerCv
      : toNumber(stages[activeStageIndex - 1]?.powerAfterCv) ?? powerProfile.basePowerCv;
  const activeStagePowerAfter =
    toNumber(activeStage?.powerAfterCv) ??
    ((previousPowerCv ?? 0) + (toNumber(activeStage?.gainCv) ?? 0));

  return (
    <section className="build-screen build-screen--story">
      <div className="build-topbar">
        <button className="secondary-button secondary-button--dark" type="button" onClick={onBack}>
          Cambiar vehiculo
        </button>
      </div>

      <article className="build-card build-card--hero build-card--hero-story">
        <div className="build-card__copy">
          <span className="section-heading__eyebrow">Tu build recomendada</span>
          <h1>{vehicleName}</h1>
          <p className="build-card__summary">
            {result.summary}
          </p>
          <p className="build-card__kicker">{getSourceMeta(result.source)}</p>
          {result.factoryPowerSourceUrl ? (
            <a
              className="factory-source-link"
              href={result.factoryPowerSourceUrl}
              target="_blank"
              rel="noreferrer"
            >
              CV de serie contrastados con {result.factoryPowerSourceTitle || 'fuente externa'}
            </a>
          ) : null}
        </div>

        <div className="build-card__visual">
          <VehiclePreview vehicle={vehicle} />
        </div>
      </article>

      <section className="stage-progress">
        {stages.map((stage, index) => (
          <button
            key={stage.label}
            type="button"
            className={`stage-progress__item ${
              index === activeStageIndex
                ? 'stage-progress__item--active'
                : index < activeStageIndex
                  ? 'stage-progress__item--done'
                  : ''
            }`}
            onClick={() => setActiveStageIndex(index)}
          >
            <span>{stage.label}</span>
            <strong>{stage.focus}</strong>
          </button>
        ))}
      </section>

      {activeStage ? (
        <article
          key={`${activeStage.label}-${activeStageIndex}`}
          className={`build-card build-card--stage-focus build-card--stage-focus-${stageTheme}`}
        >
          <div className="stage-motion" aria-hidden="true">
            <span className="stage-motion__gauge" />
            <span className="stage-motion__pulse" />
            <span className="stage-motion__spark stage-motion__spark--one" />
            <span className="stage-motion__spark stage-motion__spark--two" />
          </div>

          <div className="build-stage-focus__eyebrow">
            <span className="build-stage-focus__badge">{activeStage.label}</span>
            <span className="build-stage-focus__counter">
              Etapa {activeStageIndex + 1} de {stages.length}
            </span>
          </div>

          <div className="build-stage-focus__intro">
            <h2>{activeStage.focus}</h2>
            <p>{activeStage.note}</p>
          </div>

          <div className="build-stage-focus__stats">
            <article className="build-highlight">
              <span>CV de partida</span>
              <strong>{formatCv(previousPowerCv)}</strong>
            </article>
            <article className="build-highlight">
              <span>Ganas en esta etapa</span>
              <strong>+{activeStage.gainCv ?? 0} CV</strong>
            </article>
            <article className="build-highlight">
              <span>Terminas con</span>
              <strong>{formatCv(activeStagePowerAfter)}</strong>
            </article>
          </div>

          <CvProgress
            basePowerCv={powerProfile.basePowerCv}
            previousPowerCv={previousPowerCv}
            currentPowerCv={activeStagePowerAfter}
            finalPowerCv={powerProfile.finalPowerCv}
            gainCv={activeStage.gainCv}
            animationKey={activeStageIndex}
          />

          <div className="stage-parts">
            {activeStage.parts.map((part) => (
              <article key={part} className="stage-part-card">
                <span className="stage-part-card__tag">Pieza clave</span>
                <h3>{part}</h3>
                <p>{getPartDescription(part)}</p>
              </article>
            ))}
          </div>

          <div className="stage-story-cta">
            {!isFirstStage ? (
              <button
                className="secondary-button secondary-button--dark"
                type="button"
                onClick={() => setActiveStageIndex((current) => Math.max(0, current - 1))}
              >
                Etapa anterior
              </button>
            ) : (
              <span className="stage-story-cta__spacer" />
            )}

            {!isLastStage ? (
              <button
                className="primary-button"
                type="button"
                onClick={() => setActiveStageIndex((current) => Math.min(stages.length - 1, current + 1))}
              >
                Siguiente etapa
              </button>
            ) : (
              <a className="primary-button stage-story-cta__link" href={whatsappUrl} target="_blank" rel="noreferrer">
                Quiero empezar este proyecto
              </a>
            )}
          </div>
        </article>
      ) : null}

      <article className="build-card build-card--closing">
        <div className="build-section__heading">
          <span className="section-heading__eyebrow">Siguiente paso</span>
          <h2>¿No sabes por donde empezar?</h2>
        </div>
        <p className="build-card__summary">
          Ya tienes una progresion clara para tu coche. Si esta build encaja con lo que buscas, el siguiente paso es guardar la idea y preparar bien el arranque del Stage 1.
        </p>
        <div className="build-stage-focus__stats">
          <article className="build-highlight">
            <span>Potencia de partida</span>
            <strong>{formatCv(powerProfile.basePowerCv)}</strong>
          </article>
          <article className="build-highlight">
            <span>Ganancia total</span>
            <strong>{result.expectedGain || 'Por definir'}</strong>
          </article>
          <article className="build-highlight">
            <span>Potencia final</span>
            <strong>{formatCv(powerProfile.finalPowerCv)}</strong>
          </article>
        </div>
        <div className="build-actions build-actions--stack">
          <a className="primary-button build-actions__primary" href={whatsappUrl} target="_blank" rel="noreferrer">
            Quiero empezar este proyecto
          </a>
          <button className="secondary-button build-actions__secondary" type="button" onClick={() => setActiveStageIndex(0)}>
            Volver a Stage 1
          </button>
        </div>
      </article>
    </section>
  );
}

export default BuildResult;
