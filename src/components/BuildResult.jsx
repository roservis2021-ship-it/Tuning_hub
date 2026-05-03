import { useMemo, useState } from 'react';
import freeBuildFichaBg from '../assets/free-build-ficha.png';
import freeBuildModificacionesBg from '../assets/free-build-modificaciones.png';
import freeBuildPreinstalacionBg from '../assets/free-build-preinstalacion.png';
import freeBuildPremiumBg from '../assets/free-build-premium.png';
import freeBuildRiesgosBg from '../assets/free-build-riesgos.png';
import { getPartVisual } from '../services/partVisuals';
import { getVehicleImage } from '../services/vehicleVisuals';

function formatPriceEuro(value) {
  const numericValue = Number(value);
  return Number.isFinite(numericValue) && numericValue > 0
    ? new Intl.NumberFormat('es-ES', {
        style: 'currency',
        currency: 'EUR',
        maximumFractionDigits: 0,
      }).format(numericValue)
    : 'Por confirmar';
}

function formatCv(value) {
  const numericValue = Number(value);
  return Number.isFinite(numericValue) && numericValue > 0 ? `${numericValue} CV` : 'Por confirmar';
}

function formatNm(value) {
  const numericValue = Number(value);
  return Number.isFinite(numericValue) && numericValue > 0 ? `${numericValue} Nm` : 'Por confirmar';
}

function formatGain(value, unit) {
  const numericValue = Number(value);
  return Number.isFinite(numericValue) ? `+${numericValue} ${unit}` : 'Por confirmar';
}

function normalizeLabel(value) {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

function normalizePart(part) {
  if (typeof part === 'string') {
    return {
      key: part,
      name: part,
      priceEuro: null,
      explanation: 'Modificacion incluida en esta etapa.',
      visual: getPartVisual(part),
    };
  }

  const name = part?.name || 'Modificacion';

  return {
    key: `${name}-${part?.priceEuro ?? 'price'}`,
    name,
    priceEuro: Number(part?.priceEuro) || null,
    explanation: part?.explanation || 'Modificacion incluida en esta etapa.',
    visual: getPartVisual(name),
  };
}

function normalizeRecommendedPart(part) {
  const name = part?.name || 'Pieza recomendada';

  return {
    key: `${name}-${part?.estimatedPriceEuro ?? part?.priceEuro ?? 'price'}`,
    name,
    reason: part?.reason || part?.explanation || 'Pieza recomendada para esta build.',
    priceEuro: Number(part?.estimatedPriceEuro ?? part?.priceEuro) || null,
    visual: getPartVisual(name),
  };
}

function getVehicleName(vehicle, result) {
  const identity = result?.vehicleIdentity || {};

  return [
    identity.canonicalBrand || vehicle?.brand,
    identity.canonicalModel || vehicle?.model,
    identity.canonicalGeneration || vehicle?.generation,
    identity.canonicalEngine || vehicle?.engine,
  ]
    .filter(Boolean)
    .join(' ');
}

function getStageTitle(stage) {
  const label = stage?.label || 'STAGE';
  const focus = stage?.focus || stage?.objective || 'Preparacion';
  return `${label} - ${focus}`.toUpperCase();
}

function getStageSubtitle(stage) {
  if (stage?.label === 'STAGE 0') {
    return 'Mantenimiento';
  }

  if (stage?.label === 'STAGE 1') {
    return 'Mejora diaria';
  }

  if (stage?.label === 'STAGE 2') {
    return 'Intermedio';
  }

  if (stage?.label === 'STAGE 3') {
    return 'Avanzado';
  }

  return stage?.focus || 'Stage';
}

function getStageIcon(stageLabel) {
  if (stageLabel === 'STAGE 0') return 'car';
  if (stageLabel === 'STAGE 1') return 'boost';
  if (stageLabel === 'STAGE 2') return 'road';
  return 'lock';
}

function IconBadge({ type }) {
  return (
    <span className={`build-dashboard-icon build-dashboard-icon--${type}`} aria-hidden="true">
      {type === 'car' && (
        <svg viewBox="0 0 24 24">
          <path d="M4 13l2-5h12l2 5M5 13h14v5H5z" />
          <path d="M7 18v2M17 18v2M7 13h.01M17 13h.01" />
        </svg>
      )}
      {type === 'boost' && (
        <svg viewBox="0 0 24 24">
          <path d="M4 19h16" />
          <path d="M6 16l4-4 3 3 5-7" />
          <path d="M15 8h3v3" />
        </svg>
      )}
      {type === 'road' && (
        <svg viewBox="0 0 24 24">
          <path d="M8 21l2-18M16 21L14 3" />
          <path d="M12 6v2M12 11v2M12 16v2" />
        </svg>
      )}
      {type === 'lock' && (
        <svg viewBox="0 0 24 24">
          <path d="M7 11V8a5 5 0 0110 0v3" />
          <path d="M6 11h12v9H6z" />
        </svg>
      )}
      {type === 'engine' && (
        <svg viewBox="0 0 24 24">
          <path d="M4 10h3l2-3h5l2 3h4v7h-3l-2 2H8l-2-2H4z" />
          <path d="M10 7V4M14 7V4M20 13h2M2 13h2" />
        </svg>
      )}
      {type === 'gauge' && (
        <svg viewBox="0 0 24 24">
          <path d="M4 15a8 8 0 1116 0" />
          <path d="M12 15l5-5" />
          <path d="M8 17h8" />
        </svg>
      )}
      {type === 'fuel' && (
        <svg viewBox="0 0 24 24">
          <path d="M6 3h8v18H6z" />
          <path d="M14 8h3l2 2v8a2 2 0 01-4 0v-4h-1" />
          <path d="M8 7h4" />
        </svg>
      )}
      {type === 'calendar' && (
        <svg viewBox="0 0 24 24">
          <path d="M5 5h14v15H5zM5 9h14M8 3v4M16 3v4" />
        </svg>
      )}
      {type === 'shield' && (
        <svg viewBox="0 0 24 24">
          <path d="M12 3l7 3v5c0 5-3 8-7 10-4-2-7-5-7-10V6z" />
          <path d="M9 12l2 2 4-5" />
        </svg>
      )}
      {type === 'cart' && (
        <svg viewBox="0 0 24 24">
          <path d="M4 5h2l2 10h9l2-7H7" />
          <path d="M9 20h.01M17 20h.01" />
        </svg>
      )}
    </span>
  );
}

function WarningIcon() {
  return (
    <span className="free-build-warning-icon" aria-hidden="true">
      <svg viewBox="0 0 24 24">
        <path d="M12 3L2.5 20h19L12 3z" />
        <path d="M12 9v5" />
        <path d="M12 17h.01" />
      </svg>
    </span>
  );
}

function getStagePriceRange(stage) {
  if (stage?.costRangeEuro) {
    return stage.costRangeEuro;
  }

  const total = (stage?.parts || []).reduce((sum, part) => sum + (normalizePart(part).priceEuro || 0), 0);

  if (!total) {
    return 'Por confirmar';
  }

  return `${formatPriceEuro(Math.round(total * 0.9))} - ${formatPriceEuro(Math.round(total * 1.1))}`;
}

function splitPriceRange(stage) {
  const range = getStagePriceRange(stage);
  return range.replaceAll('EUR', '€');
}

function InfoItem({ icon, label, value }) {
  return (
    <div className="build-dashboard-info-item">
      <IconBadge type={icon} />
      <div>
        <span>{label}</span>
        <strong>{value || 'Por confirmar'}</strong>
      </div>
    </div>
  );
}

function BulletList({ title, items, tone = 'ok' }) {
  const cleanItems = (items || []).filter(Boolean).slice(0, 5);

  if (!cleanItems.length) {
    return null;
  }

  return (
    <article className="build-dashboard-card build-dashboard-list-card">
      <h3>{title}</h3>
      <ul className={`build-dashboard-bullets build-dashboard-bullets--${tone}`}>
        {cleanItems.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </article>
  );
}

function getInstallOrder(stage) {
  if (Array.isArray(stage?.installOrder) && stage.installOrder.length) {
    return stage.installOrder.map((name) => ({
      name,
      note: '',
      visual: getPartVisual(name),
    }));
  }

  const parts = (stage?.parts || []).map(normalizePart);
  const ecuParts = parts.filter((part) => normalizeLabel(part.name).includes('repro') || normalizeLabel(part.name).includes('ecu'));
  const nonEcuParts = parts.filter((part) => !ecuParts.includes(part));

  return [...nonEcuParts, ...ecuParts].map((part, index, collection) => ({
    name: part.name,
    note:
      collection.length > 1 && index === collection.length - 1 && ecuParts.includes(part)
        ? 'Ajuste final'
        : '',
    visual: part.visual,
  }));
}

function BuildResult({ result, vehicle, buildMeta, onBack, onOpenOptimizedPlan }) {
  const stages = Array.isArray(result?.stages) ? result.stages : [];
  const initialStageIndex = Math.max(
    0,
    stages.findIndex((stage) => stage.label === 'STAGE 1'),
  );
  const [activeStageIndex, setActiveStageIndex] = useState(initialStageIndex);
  const [activeFreeSlide, setActiveFreeSlide] = useState(0);
  const [touchStartX, setTouchStartX] = useState(null);
  const activeStage = stages[activeStageIndex] || stages[0];
  const identity = result?.vehicleIdentity || {};
  const technicalProfile = result?.technicalProfile || {};
  const diagnosis = result?.vehicleDiagnosis || {};
  const vehicleName = getVehicleName(vehicle, result);
  const heroImage = getVehicleImage(vehicle || {});
  const stageParts = (activeStage?.parts || []).map(normalizePart);
  const recommendedParts = useMemo(() => {
    const aiParts = (result?.recommendedParts || []).map(normalizeRecommendedPart);
    const stageFallback = stageParts.map((part) => ({
      key: part.key,
      name: part.name,
      reason: part.explanation,
      priceEuro: part.priceEuro,
      visual: part.visual,
    }));

    return (aiParts.length ? aiParts : stageFallback).slice(0, 4);
  }, [result?.recommendedParts, stageParts]);
  const isPremiumLockedStage = Boolean(activeStage?.premiumLocked);
  const salesBlock = result?.premiumSalesBlock || {};
  const basePower = result?.basePowerCv || identity.factoryPowerCv;
  const stagePower = activeStage?.powerAfterCv || result?.finalPowerCv;
  const stageTorque = activeStage?.estimatedTorqueNm;
  const reliableLimit = technicalProfile.reliablePowerLimitCv || result?.finalPowerCv;

  function goToFreeSlide(index) {
    setActiveFreeSlide(Math.min(Math.max(index, 0), 4));
  }

  function handleFreeTouchEnd(event) {
    if (touchStartX === null) {
      return;
    }

    const deltaX = event.changedTouches[0].clientX - touchStartX;
    setTouchStartX(null);

    if (Math.abs(deltaX) < 44) {
      return;
    }

    goToFreeSlide(activeFreeSlide + (deltaX < 0 ? 1 : -1));
  }

  if (!result) {
    return (
      <section className="build-dashboard">
        <article className="build-dashboard-card">
          <h2>Aqui aparecera tu build</h2>
          <p>Completa el formulario para generar una preparacion especifica para tu coche.</p>
        </article>
      </section>
    );
  }

  const stageOne = stages.find((stage) => stage.label === 'STAGE 1') || activeStage || stages[0];
  const stageOneParts = (stageOne?.parts || []).map(normalizePart).slice(0, 4);
  const freeBuild = result?.freeBuild || {};
  const freeVehicleSheet = freeBuild.vehicleSheet || {};
  const freePreInstallation = freeBuild.preInstallation || {};
  const freeModifications = freeBuild.modifications || {};
  const freePremiumOffer = freeBuild.premiumOffer || {};
  const stageOnePower = stageOne?.powerAfterCv || result?.finalPowerCv;
  const stageOneTorque = stageOne?.estimatedTorqueNm;
  const stockTorque = identity.factoryTorqueNm || result?.baseTorqueNm || null;
  const vehicleInfoText =
    freeVehicleSheet.infoText ||
    result?.summary ||
    `${vehicleName || 'Este coche'} tiene potencial de mejora si se parte de una base sana y se prioriza compatibilidad, temperatura y mantenimiento antes de buscar cifras.`;
  const preInstallItems = [
    ...(freePreInstallation.items || []),
    ...(stages.find((stage) => stage.label === 'STAGE 0')?.parts || []).map((part) => normalizePart(part).name),
    ...(diagnosis.mechanicalRisks || []).map((risk) => `Revisar: ${risk}`),
    'Comprobar historial de mantenimiento y estado de fluidos',
    'Verificar fugas, sensores, admision, escape y temperatura de trabajo',
    'No aumentar potencia si hay fallos activos o mantenimientos pendientes',
  ].filter(Boolean).slice(0, 6);
  const potentialText = freeModifications.potentialText || (
    technicalProfile.reliablePowerLimitCv || stageOnePower
      ? `Con los datos indicados, el margen razonable ronda ${formatCv(stageOnePower)} en una primera configuracion conservadora, siempre condicionado por kilometraje, traccion, aspiracion y estado mecanico.`
      : 'El potencial exacto depende de confirmar codigo de motor, estado mecanico, kilometraje y compatibilidades por referencia OEM o VIN.'
  );
  const freeModificationParts = (freeModifications.parts || []).map(normalizeRecommendedPart);
  const modificationParts = (freeModificationParts.length ? freeModificationParts : recommendedParts.length ? recommendedParts : stageOneParts).slice(0, 4);
  const defaultRiskItems = [
    'Montar piezas sin orden puede forzar turbo y mezcla.',
    'Subir par sin revisar embrague puede salir caro.',
    'Comprar piezas sin referencias puede generar doble gasto.',
  ];
  const cleanRiskItem = (item) => {
    const text = String(item);
    return text
      .replace(/\bEl plan premium\b.*$/i, '')
      .replace(/\bPremium\b.*$/i, '')
      .replace(/\bplan completo\b.*$/i, '')
      .trim();
  };
  const isUsefulRisk = (item) => {
    const text = cleanRiskItem(item);
    const lower = text.toLowerCase();
    if (!text || text.length > 95) return false;
    if (
      lower.includes('se recomienda') ||
      lower.includes('es esencial') ||
      lower.includes('talleres especializados') ||
      lower.includes('piezas de calidad') ||
      lower.includes('mantenimientos periodicos') ||
      lower.includes('combustibles de alta calidad')
    ) {
      return false;
    }
    return (
      lower.includes('sin ') ||
      lower.includes('puede') ||
      lower.includes('romper') ||
      lower.includes('forzar') ||
      lower.includes('salir caro') ||
      lower.includes('doble gasto') ||
      lower.includes('temperatura') ||
      lower.includes('embrague') ||
      lower.includes('turbo')
    );
  };
  const freeRiskItemsLimited = [
    ...(freeBuild.risks || []).filter(isUsefulRisk).map(cleanRiskItem),
    ...defaultRiskItems,
  ].slice(0, 3);
  const premiumBenefits = (freePremiumOffer.benefits?.length ? freePremiumOffer.benefits : salesBlock.benefits || [
    'Plan completo de instalaciones',
    'Orden exacto de instalacion',
    'Piezas recomendadas para tu configuracion',
    'Errores especificos de tu motor',
  ]).filter(Boolean).slice(0, 4);
  const freeSlides = [
    'Ficha',
    'Preinstalacion',
    'Modificaciones',
    'Riesgos',
    'Plan optimizado',
  ];

  return (
    <section className="free-build">
      <header className="free-build-topbar">
        <button type="button" className="build-dashboard-back" onClick={onBack}>
          <span aria-hidden="true">&lt;</span>
          Volver
        </button>
        <button type="button" className="build-dashboard-change" onClick={onBack}>
          <IconBadge type="car" />
          Cambiar vehiculo
        </button>
      </header>

      <section
        className="free-build-slider"
        onTouchStart={(event) => setTouchStartX(event.touches[0].clientX)}
        onTouchEnd={handleFreeTouchEnd}
      >
        <div
          className="free-build-track"
          style={{ transform: `translateX(-${activeFreeSlide * 100}%)` }}
        >
          <article className="free-build-slide free-build-slide--hero">
            <img className="free-build-slide__bg" src={freeBuildFichaBg} alt="" />
            <div className="free-build-slide__shade" />
            <div className="free-build-slide__content">
              <span className="free-build-eyebrow">Ficha del vehiculo</span>
              <h1>{vehicleName || result.title}</h1>
              {(result?.source === 'fallback' || buildMeta?.aiErrorMessage) && (
                <p className="free-build-alert">
                  Build orientativa: no se ha podido generar una build optimizada con IA. Confirma codigo motor por VIN para afinar piezas y resultados.
                </p>
              )}
              <dl className="free-build-specs">
                <div>
                  <dt>Codigo de motor</dt>
                  <dd>{freeVehicleSheet.engineCode || technicalProfile.engineCode || identity.canonicalEngine || 'Por confirmar'}</dd>
                </div>
                <div>
                  <dt>Potencia</dt>
                  <dd>{formatCv(freeVehicleSheet.powerCv || basePower)}</dd>
                </div>
                <div>
                  <dt>Torque</dt>
                  <dd>{formatNm(freeVehicleSheet.torqueNm || stockTorque)}</dd>
                </div>
                <div>
                  <dt>Motor</dt>
                  <dd>{freeVehicleSheet.engine || identity.canonicalEngine || vehicle?.engine || 'Por confirmar'}</dd>
                </div>
              </dl>
              <p>{vehicleInfoText}</p>
            </div>
          </article>

          <article className="free-build-slide">
            <img className="free-build-slide__bg" src={freeBuildPreinstalacionBg} alt="" />
            <div className="free-build-slide__shade" />
            <div className="free-build-slide__content">
              <span className="free-build-eyebrow">Preinstalacion</span>
              <h2>{freePreInstallation.title || 'Antes de modificar'}</h2>
              <p>
                {freePreInstallation.intro ||
                  'Antes de montar piezas conviene asegurar que la base esta sana. Una modificacion sobre mantenimiento pendiente suele ocultar fallos y acabar costando mas.'}
              </p>
              <ul className="free-build-checks">
                {preInstallItems.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
          </article>

          <article className="free-build-slide">
            <img className="free-build-slide__bg" src={freeBuildModificacionesBg} alt="" />
            <div className="free-build-slide__shade" />
            <div className="free-build-slide__content">
              <span className="free-build-eyebrow">Modificaciones recomendadas</span>
              <h2>Potencial y piezas con sentido</h2>
              <p>{potentialText}</p>
              <div className="free-build-result">
                <div>
                  <IconBadge type="gauge" />
                  <span>Potencia posible</span>
                  <strong>{formatCv(freeModifications.possiblePowerCv || stageOnePower)}</strong>
                </div>
                <div>
                  <IconBadge type="boost" />
                  <span>Torque posible</span>
                  <strong>{formatNm(freeModifications.possibleTorqueNm || stageOneTorque)}</strong>
                </div>
              </div>
              <div className="free-build-parts">
                {modificationParts.map((part) => (
                  <article key={part.key} className="free-build-part">
                    {part.visual ? <img src={part.visual.imageSrc} alt={part.name} /> : <IconBadge type="cart" />}
                    <div>
                      <strong>{part.name}</strong>
                      <p>{part.reason || part.explanation}</p>
                      <span>{formatPriceEuro(part.priceEuro)}</span>
                    </div>
                  </article>
                ))}
              </div>
            </div>
          </article>

          <article className="free-build-slide free-build-slide--warning">
            <img className="free-build-slide__bg" src={freeBuildRiesgosBg} alt="" />
            <div className="free-build-slide__shade" />
            <div className="free-build-slide__content">
              <span className="free-build-eyebrow">Riesgos</span>
              <h2>Lo que puede salir caro</h2>
              <p>
                Estos fallos aparecen cuando se modifica sin orden, sin verificar piezas o sin
                revisar la base. Son errores comunes que pueden acabar en averias o doble gasto.
              </p>
              <div className="free-build-error-list">
                {freeRiskItemsLimited.map((item, index) => (
                  <article key={item}>
                    <WarningIcon />
                    <p>{item}</p>
                  </article>
                ))}
              </div>
            </div>
          </article>

          <article className="free-build-slide free-build-slide--premium">
            <img className="free-build-slide__bg" src={freeBuildPremiumBg} alt="" />
            <div className="free-build-slide__shade" />
            <div className="free-build-slide__content">
              <span className="free-build-eyebrow">Plan optimizado</span>
              <h2>Comienza tu proyecto con claridad</h2>
              <p>
                El plan optimizado te da el plan de ejecucion completo para comprar mejor,
                instalar en orden y evitar errores especificos de tu motor.
              </p>
              <ul className="free-build-checks">
                {premiumBenefits.map((benefit) => (
                  <li key={benefit}>{benefit}</li>
                ))}
              </ul>
              <div className="free-build-plan-price" aria-label="Oferta plan optimizado">
                <span>Oferta</span>
                <strong>3,99 €</strong>
                <del>6,99 €</del>
              </div>
              <button type="button" onClick={onOpenOptimizedPlan}>
                {freePremiumOffer.cta || salesBlock.cta || 'Obtener plan optimizado'}
              </button>
              <small>
                {freePremiumOffer.finalReinforcement ||
                  salesBlock.finalReinforcement ||
                  'En esta build, el orden de instalacion marca la diferencia entre mejorar el coche o gastar dos veces.'}
              </small>
            </div>
          </article>
        </div>
      </section>

      {activeFreeSlide !== 4 && (
        <div className="free-build-inline-cta">
          <button
            type="button"
            onClick={onOpenOptimizedPlan}
          >
            Obtener plan optimizado
          </button>
        </div>
      )}

      <nav className="free-build-nav" aria-label="Secciones de la build free">
        {freeSlides.map((slide, index) => (
          <button
            key={slide}
            type="button"
            className={index === activeFreeSlide ? 'free-build-nav__dot free-build-nav__dot--active' : 'free-build-nav__dot'}
            onClick={() => goToFreeSlide(index)}
            aria-label={`Ver ${slide}`}
          />
        ))}
      </nav>
    </section>
  );

  return (
    <section className="build-dashboard">
      <header className="build-dashboard-topbar">
        <button type="button" className="build-dashboard-back" onClick={onBack}>
          <span aria-hidden="true">&lt;</span>
          Volver
        </button>
        <h1>
          Build: <strong>{vehicleName || result.title}</strong>
        </h1>
        <button type="button" className="build-dashboard-change" onClick={onBack}>
          <IconBadge type="car" />
          Cambiar vehiculo
        </button>
      </header>

      <section className="build-dashboard-hero-grid">
        <article className="build-dashboard-photo-card">
          <img src={heroImage} alt={vehicleName || 'Vehiculo'} />
        </article>

        <article className="build-dashboard-card build-dashboard-spec-card">
          <InfoItem
            icon="engine"
            label="Motor"
            value={technicalProfile.engineCode || identity.canonicalEngine || vehicle?.engine}
          />
          <InfoItem
            icon="road"
            label="Traccion"
            value={identity.drivetrain || vehicle?.drivetrain}
          />
          <InfoItem
            icon="gauge"
            label="Potencia stock"
            value={`${formatCv(basePower)} / ${formatNm(stageTorque ? Math.max(0, stageTorque - 80) : null)}`}
          />
          <InfoItem
            icon="calendar"
            label="Produccion"
            value={identity.productionYears || vehicle?.generation}
          />
          <InfoItem
            icon="fuel"
            label="Combustible"
            value={identity.powertrain || vehicle?.powertrain}
          />
          <InfoItem
            icon="shield"
            label="Plataforma"
            value={technicalProfile.platform}
          />
        </article>

        <article className="build-dashboard-card build-dashboard-goal-card">
          <span className="build-dashboard-card-label">Objetivo de la build</span>
          <div className="build-dashboard-goal-title">
            <IconBadge type="gauge" />
            <strong>{result.ownerProfile || activeStage?.bestFor || 'Daily - Alto rendimiento'}</strong>
          </div>
          <ul>
            <li>Potencia objetivo: {formatCv(reliableLimit)}</li>
            <li>Par objetivo: {formatNm(stageTorque)}</li>
            <li>Fiabilidad: {activeStage?.reliability || 'Alta'}</li>
            <li>Uso: {vehicle?.usage || 'Diario'} / {vehicle?.goal || 'calle'}</li>
            <li>
              Presupuesto total estimado: <strong>{formatPriceEuro(result.estimatedBudget)}</strong>
            </li>
          </ul>
        </article>
      </section>

      <section className="build-dashboard-tabs-row">
        <div className="build-dashboard-tabs">
          {stages.map((stage, index) => (
            <button
              key={stage.label || index}
              type="button"
              className={`build-dashboard-tab ${index === activeStageIndex ? 'build-dashboard-tab--active' : ''}`}
              onClick={() => setActiveStageIndex(index)}
            >
              <IconBadge type={getStageIcon(stage.label)} />
              <span>
                <strong>{stage.label || `STAGE ${index}`}</strong>
                <small>{getStageSubtitle(stage)}</small>
              </span>
            </button>
          ))}
        </div>

        <button type="button" className="build-dashboard-compare">
          <IconBadge type="road" />
          <span>
            <strong>Comparativa rapida</strong>
            <small>Incluida en el plan optimizado</small>
          </span>
          <em>&gt;</em>
        </button>
      </section>

      <section className="build-dashboard-stage-card">
        <div className="build-dashboard-stage-main">
          <h2>{getStageTitle(activeStage)}</h2>
          <p>{activeStage?.note || activeStage?.objective || result.summary}</p>

          {isPremiumLockedStage ? (
            <article className="build-dashboard-locked-stage">
              <IconBadge type="lock" />
              <div>
                <strong>Stage avanzado incluido en el plan optimizado</strong>
                <p>
                  Esta parte necesita orden, dependencias y compatibilidades para no gastar dinero
                  en piezas que no trabajan bien juntas.
                </p>
              </div>
            </article>
          ) : (
            <div className="build-dashboard-parts-table">
              <div className="build-dashboard-parts-head">
                <span>Pieza</span>
                <span>Funcion</span>
                <span>Tipo recomendado</span>
                <span>Precio aprox.</span>
              </div>

              {stageParts.slice(0, 4).map((part) => (
                <div className="build-dashboard-parts-row" key={part.key}>
                  <strong>{part.name}</strong>
                  <span>{part.explanation}</span>
                  <span>{part.visual?.label || 'Compatible probable'}</span>
                  <em>{formatPriceEuro(part.priceEuro)}</em>
                </div>
              ))}

              <div className="build-dashboard-parts-total">
                <strong>Coste estimado</strong>
                <em>{splitPriceRange(activeStage)}</em>
              </div>
            </div>
          )}
        </div>

        <aside className="build-dashboard-stage-side">
          <article className="build-dashboard-card build-dashboard-gains-card">
            <h3>Ganancias estimadas</h3>
            <div className="build-dashboard-gain-grid">
              <div>
                <IconBadge type="gauge" />
                <strong>{formatGain(activeStage?.gainCv, 'CV')}</strong>
                <span>Potencia</span>
              </div>
              <div>
                <IconBadge type="boost" />
                <strong>{formatNm(stageTorque)}</strong>
                <span>Par motor</span>
              </div>
            </div>
          </article>

          <article className="build-dashboard-card build-dashboard-result-mini">
            <div>
              <span>Potencia estimada</span>
              <strong>{formatCv(stagePower)}</strong>
            </div>
            <div>
              <span>Par estimado</span>
              <strong>{formatNm(stageTorque)}</strong>
            </div>
          </article>

          <article className="build-dashboard-card build-dashboard-quality-card">
            <div>
              <IconBadge type="shield" />
              <span>Fiabilidad</span>
              <strong>{activeStage?.reliability || 'Alta'}</strong>
              <small>Con mantenimiento adecuado</small>
            </div>
            <div>
              <IconBadge type="boost" />
              <span>Dificultad de instalacion</span>
              <strong>{activeStage?.difficulty || 'Media'}</strong>
              <small>{activeStage?.difficulty === 'baja' ? 'Apto taller general' : 'Recomendado taller'}</small>
            </div>
          </article>
        </aside>
      </section>

      <section className="build-dashboard-card build-dashboard-install-card build-dashboard-install-card--locked">
        <IconBadge type="lock" />
        <div>
          <h3>Orden de instalacion recomendado</h3>
          <p>
            El orden exacto no se muestra en la build free. En este tipo de preparacion, montar
            piezas en mal orden puede provocar perdida de rendimiento o gasto innecesario.
          </p>
        </div>
      </section>

      <section className="build-dashboard-three-cols">
        <BulletList
          title="Requisitos y consideraciones"
          items={[
            ...(activeStage?.dependencies || []),
            ...(diagnosis.strengths || []),
            activeStage?.legalImpact,
          ].slice(0, 5)}
          tone="ok"
        />
        <BulletList
          title="Riesgo detectado"
          items={[
            result?.conversionTrigger,
            ...(activeStage?.watchouts || []),
            ...(diagnosis.mechanicalRisks || []),
            ...(result?.warnings || []),
          ].slice(0, 5)}
          tone="warn"
        />
        <BulletList
          title="Que desbloquea el plan"
          items={[
            'Orden exacto de instalacion paso a paso',
            'Piezas compatibles entre si',
            'Dependencias criticas antes de comprar',
            'Evolucion por presupuesto',
          ]}
          tone="next"
        />
      </section>

      <section className="build-dashboard-shop-row">
        <article className="build-dashboard-card build-dashboard-products-card">
          <h3>Piezas recomendadas para este stage</h3>
          <div className="build-dashboard-products-grid">
            {recommendedParts.map((part) => (
              <article key={part.key} className="build-dashboard-product">
                {part.visual ? <img src={part.visual.imageSrc} alt={part.name} /> : <IconBadge type="cart" />}
                <strong>{part.name}</strong>
                <span>{part.reason}</span>
                <em>{formatPriceEuro(part.priceEuro)}</em>
                <button type="button">Ver producto</button>
              </article>
            ))}
          </div>
        </article>

        <article className="build-dashboard-card build-dashboard-why-card">
          <h3>Por que estas piezas?</h3>
          <ul className="build-dashboard-bullets build-dashboard-bullets--next">
            <li>Mejor relacion coste / impacto</li>
            <li>Compatibles con la base indicada</li>
            <li>Ordenadas para evitar gastos inutiles</li>
            <li>Fiabilidad antes que cifras irreales</li>
          </ul>
          <button type="button" className="build-dashboard-outline-button">
            <IconBadge type="cart" />
            Ver todas las piezas
          </button>
        </article>
      </section>

      <section className="build-dashboard-bottom-row">
        <article className="build-dashboard-final-card">
          <IconBadge type="gauge" />
          <div>
            <span>Resultado final {activeStage?.label}</span>
            <strong>
              {formatCv(stagePower)}
              <br />
              {formatNm(stageTorque)}
            </strong>
            <p>{result?.conclusion?.why || activeStage?.bestFor || 'Mejora notable manteniendo una ruta coherente.'}</p>
          </div>
        </article>

        <article className="build-dashboard-card build-dashboard-premium-card">
          <IconBadge type="lock" />
          <div>
            <span>{salesBlock.title || 'Como hacer esta build correctamente'}</span>
            <p>
              {salesBlock.intro ||
                result?.premiumUpsell ||
                'El plan optimizado incluye el orden exacto, compatibilidades y ajustes para evitar errores caros.'}
            </p>
            {Array.isArray(salesBlock.benefits) && salesBlock.benefits.length ? (
              <ul className="build-dashboard-bullets build-dashboard-bullets--ok">
                {salesBlock.benefits.map((benefit) => (
                  <li key={benefit}>{benefit}</li>
                ))}
              </ul>
            ) : null}
            <strong className="build-dashboard-premium-price">
              Acceso completo: <span>3,99 €</span> <del>6,99 €</del>
            </strong>
            <button type="button" onClick={onOpenOptimizedPlan}>
              {salesBlock.cta || 'Obtener plan optimizado'}
            </button>
            <small>
              {salesBlock.finalReinforcement ||
                'En esta build, el orden de las modificaciones marca la diferencia entre ganar rendimiento o perder dinero.'}
            </small>
          </div>
        </article>
      </section>
    </section>
  );
}

export default BuildResult;
