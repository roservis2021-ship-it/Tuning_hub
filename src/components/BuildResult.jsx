import VehiclePreview from './VehiclePreview';

function StageCard({ stage }) {
  return (
    <article className="build-stage-card">
      <div className="build-stage-card__header">
        <span className="build-stage-card__badge">{stage.label}</span>
        <strong>{stage.focus}</strong>
      </div>

      <ul className="build-stage-card__list">
        {stage.parts.map((part) => (
          <li key={part}>{part}</li>
        ))}
      </ul>

      <p className="build-stage-card__note">{stage.note}</p>
    </article>
  );
}

function BuildResult({ result, vehicle, onBack }) {
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

  const vehicleName = [vehicle?.brand, vehicle?.model, vehicle?.generation, vehicle?.engine]
    .filter(Boolean)
    .join(' ');

  return (
    <section className="build-screen">
      <div className="build-topbar">
        <button className="secondary-button secondary-button--dark" type="button" onClick={onBack}>
          Cambiar vehiculo
        </button>
      </div>

      <article className="build-card build-card--hero">
        <div className="build-card__copy">
          <div className="brand-logo-wordmark brand-logo-wordmark--build" aria-label="Tuning Hub">
            <span className="brand-logo-wordmark__arc" aria-hidden="true" />
            <span className="brand-logo-wordmark__text">
              <span className="brand-logo-wordmark__tuning">TUNING</span>
              <span className="brand-logo-wordmark__hub">HUB</span>
            </span>
          </div>
          <p className="build-card__kicker">Recomendacion basada en experiencia real para este motor</p>
          <h1>{vehicleName}</h1>
          <p className="build-card__summary">{result.summary}</p>
        </div>

        <div className="build-card__visual">
          <VehiclePreview vehicle={vehicle} />
        </div>
      </article>

      <article className="build-card build-card--stats">
        <h2>Setup optimo recomendado</h2>
        <div className="build-stats">
          <div className="build-stat">
            <span>Ganancia estimada</span>
            <strong>+55 hp / +90 Nm</strong>
          </div>
          <div className="build-stat">
            <span>Coste aproximado</span>
            <strong>400 - 600 EUR</strong>
          </div>
          <div className="build-stat">
            <span>Fiabilidad</span>
            <strong>Media alta</strong>
          </div>
        </div>
        <p className="build-card__footnote">
          Esta estimacion asume que el coche esta en buen estado y con mantenimiento al dia.
        </p>
      </article>

      <section className="build-section">
        <div className="build-section__heading">
          <span className="section-heading__eyebrow">Modificaciones recomendadas</span>
          <h2>{result.title}</h2>
        </div>

        <div className="build-stages">
          {result.stages.map((stage) => (
            <StageCard key={stage.label} stage={stage} />
          ))}
        </div>
      </section>

      <section className="build-insights">
        <article className="build-info-card">
          <span>Por que te la recomendamos</span>
          <ul>
            {result.reasons.map((reason) => (
              <li key={reason}>{reason}</li>
            ))}
          </ul>
        </article>

        <article className="build-info-card">
          <span>Advertencias</span>
          <ul>
            {result.warnings.map((warning) => (
              <li key={warning}>{warning}</li>
            ))}
          </ul>
        </article>
      </section>
    </section>
  );
}

export default BuildResult;
