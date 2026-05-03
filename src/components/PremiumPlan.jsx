import { useMemo, useState } from 'react';
import premiumSlideConfigBg from '../assets/premium-slide-config.svg';
import premiumSlideDecisionsBg from '../assets/premium-slide-decisions.svg';
import premiumSlideErrorsBg from '../assets/premium-slide-errors.svg';
import premiumSlideLimitationsBg from '../assets/premium-slide-limitations.svg';
import premiumSlideOrderBg from '../assets/premium-slide-order.svg';
import premiumSlidePdfBg from '../assets/premium-slide-pdf.svg';
import premiumSlideResultBg from '../assets/premium-slide-result.svg';
import premiumSlideSpecsBg from '../assets/premium-slide-specs.svg';
import premiumSlideSummaryBg from '../assets/premium-slide-summary.svg';

function formatCv(value) {
  const numberValue = Number(value);
  return Number.isFinite(numberValue) && numberValue > 0 ? `${numberValue} CV` : 'Por confirmar';
}

function formatNm(value) {
  const numberValue = Number(value);
  return Number.isFinite(numberValue) && numberValue > 0 ? `${numberValue} Nm` : 'Por confirmar';
}

function formatEuro(value) {
  const numberValue = Number(value);
  return Number.isFinite(numberValue) && numberValue > 0
    ? new Intl.NumberFormat('es-ES', {
        style: 'currency',
        currency: 'EUR',
        maximumFractionDigits: 0,
      }).format(numberValue)
    : 'Por confirmar';
}

function normalizeText(value) {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\x20-\x7E]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function displayText(value, fallback = 'Por confirmar') {
  if (value === null || value === undefined || value === '') {
    return fallback;
  }

  if (Array.isArray(value)) {
    const text = value.map((item) => displayText(item, '')).filter(Boolean).join(' / ');
    return text || fallback;
  }

  if (typeof value === 'object') {
    return (
      value.name ||
      value.label ||
      value.title ||
      value.value ||
      value.reason ||
      value.explanation ||
      fallback
    );
  }

  return String(value);
}

function normalizeList(items, fallback = []) {
  const source = Array.isArray(items) ? items : fallback;
  return source.map((item) => displayText(item, '')).filter(Boolean);
}

function pdfEscape(value) {
  return normalizeText(value).replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');
}

function buildPdf(lines) {
  const pageHeight = 842;
  let y = 800;
  const content = ['BT', '/F1 18 Tf', `1 0 0 1 50 ${y} Tm`, `(PLAN OPTIMIZADO) Tj`];

  y -= 34;
  content.push('/F1 12 Tf');
  for (const line of lines) {
    if (!line) {
      y -= 12;
      continue;
    }
    if (y < 54) {
      break;
    }
    content.push(`1 0 0 1 50 ${y} Tm (${pdfEscape(line).slice(0, 92)}) Tj`);
    y -= 16;
  }
  content.push('ET');

  const stream = content.join('\n');
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 ${pageHeight}] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>`,
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
    `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`,
  ];

  let pdf = '%PDF-1.4\n';
  const offsets = [0];
  objects.forEach((object, index) => {
    offsets.push(pdf.length);
    pdf += `${index + 1} 0 obj\n${object}\nendobj\n`;
  });
  const xrefOffset = pdf.length;
  pdf += `xref\n0 ${objects.length + 1}\n`;
  pdf += '0000000000 65535 f \n';
  offsets.slice(1).forEach((offset) => {
    pdf += `${String(offset).padStart(10, '0')} 00000 n \n`;
  });
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;

  return new Blob([pdf], { type: 'application/pdf' });
}

function buildPdfFileName(vehicleName) {
  return `plan-optimizado-${normalizeText(vehicleName).replace(/\s+/g, '-').toLowerCase() || 'vehiculo'}.pdf`;
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

function getPremiumPlanData(result, vehicle) {
  const premiumPlan = result?.premiumPlan || {};
  const freeBuild = result?.freeBuild || {};
  const identity = result?.vehicleIdentity || {};
  const technicalProfile = result?.technicalProfile || {};
  const diagnosis = result?.vehicleDiagnosis || {};
  const stages = Array.isArray(result?.stages) ? result.stages : [];
  const stageOne = stages.find((stage) => stage.label === 'STAGE 1') || stages[1] || {};
  const stageTwo = stages.find((stage) => stage.label === 'STAGE 2') || stages[2] || {};
  const recommendedParts = result?.recommendedParts || [];

  const installOrder = normalizeList(
    premiumPlan.installOrder,
    [
      'Revision completa del motor y diagnosis inicial',
      'Mantenimiento base: fluidos, filtros, bujias o calentadores',
      'Mejora de admision compatible con la variante exacta',
      'Mejora de escape o flujo segun normativa aplicable',
      'Control de temperatura y refrigeracion si el motor lo necesita',
      'Reprogramacion ajustada al estado real del coche',
    ],
  );

  const dependencies = normalizeList(
    premiumPlan.dependencies,
    [
      'No reprogramar antes de revisar fallos activos y mantenimiento pendiente',
      'No comprar piezas sin confirmar codigo motor, referencia OEM o VIN',
      'No subir par sin comprobar embrague, transmision y temperatura de trabajo',
    ],
  );

  const configuration = recommendedParts.length
    ? normalizeList(recommendedParts.slice(0, 5).map((part) => part.name || part.reason))
    : normalizeList((freeBuild.modifications?.parts || []).map((part) => part.name));

  const warnings = normalizeList(
    premiumPlan.specificWarnings,
    [
      'Reprogramar con fallos ocultos puede sacar averias que ya estaban presentes',
      'Montar piezas sin orden puede generar perdida de rendimiento y doble gasto',
      'Forzar temperatura o par sin soporte reduce fiabilidad',
    ],
  );

  const budgetPlan = Array.isArray(premiumPlan.budgetPlan) && premiumPlan.budgetPlan.length
    ? premiumPlan.budgetPlan
    : [
        { phase: 'Fase 1', budgetEuro: 300, objective: 'Diagnosis y mantenimiento base' },
        { phase: 'Fase 2', budgetEuro: 700, objective: 'Piezas de flujo y soporte' },
        { phase: 'Fase 3', budgetEuro: 450, objective: 'Ajuste electronico final' },
      ];

  return {
    vehicleName: displayText(getVehicleName(vehicle, result), 'Vehiculo seleccionado'),
    title: displayText(premiumPlan.title, `Plan optimizado ${getVehicleName(vehicle, result)}`),
    summary:
      displayText(
        premiumPlan.summary,
      'Plan de ejecucion pensado para ordenar la preparacion, evitar compras equivocadas y mantener una mejora realista.',
      ),
    targetGain: result?.expectedGain || '+40 - 60 CV',
    usage: displayText(vehicle?.usage, 'diario'),
    level: stageTwo?.label ? 'Stage 1 - 2' : 'Stage 1',
    installOrder,
    dependencies,
    configuration: configuration.length
      ? configuration
      : ['Admision compatible', 'Escape optimizado', 'Refrigeracion revisada', 'Reprogramacion ajustada'],
    warnings,
    result: {
      power: formatCv(stageOne.powerAfterCv || result?.finalPowerCv),
      torque: formatNm(stageOne.estimatedTorqueNm || freeBuild.modifications?.possibleTorqueNm),
      note: displayText(
        result?.conclusion?.why || stageOne.bestFor,
        'Mejora notable manteniendo una ruta coherente.',
      ),
    },
    decisions: normalizeList([
      result?.conclusion?.recommendedStage
        ? `Mejor punto de partida: ${result.conclusion.recommendedStage}`
        : 'Si buscas fiabilidad: empieza por mantenimiento y Stage 1 conservador',
      result?.conclusion?.whatToAvoid || 'Evita saltar a hardware avanzado sin soporte previo',
      vehicle?.mileageKm
        ? `Con ${vehicle.mileageKm.toLocaleString('es-ES')} km, prioriza revisar desgaste antes de subir potencia`
        : 'Si no conoces kilometraje real, prioriza diagnosis antes de comprar piezas',
    ]),
    limitations: normalizeList([
      ...(technicalProfile.realLimitations || []),
      ...(diagnosis.weaknesses || []),
    ]).slice(0, 4),
    advice: [
      'No acelerar fuerte en frio',
      'Controlar temperaturas en uso exigente',
      'Mantener revisiones y fluidos al dia',
      'Validar compatibilidad antes de comprar piezas',
    ],
    technicalSpecs: [
      ['Codigo de motor', freeBuild.vehicleSheet?.engineCode || technicalProfile.engineCode || 'Por confirmar'],
      ['Motor', freeBuild.vehicleSheet?.engine || identity.canonicalEngine || vehicle?.engine || 'Por confirmar'],
      ['Potencia serie', formatCv(freeBuild.vehicleSheet?.powerCv || result?.basePowerCv)],
      ['Par serie', formatNm(freeBuild.vehicleSheet?.torqueNm || identity.factoryTorqueNm)],
      ['Combustible', identity.powertrain || vehicle?.powertrain || 'Por confirmar'],
      ['Aspiracion', identity.aspiration || vehicle?.aspiration || 'Por confirmar'],
      ['Transmision', identity.transmission || vehicle?.transmission || 'Por confirmar'],
      ['Traccion', identity.drivetrain || vehicle?.drivetrain || 'Por confirmar'],
      ['Kilometraje', vehicle?.mileageKm ? `${vehicle.mileageKm.toLocaleString('es-ES')} km` : 'No indicado'],
      ['Limite fiable', technicalProfile.reliablePowerLimitCv ? `${technicalProfile.reliablePowerLimitCv} CV` : 'Por confirmar'],
    ].map(([label, value]) => [displayText(label), displayText(value)]),
    budgetPlan: budgetPlan.map((phase, index) => ({
      phase: displayText(phase?.phase, `Fase ${index + 1}`),
      budgetEuro: phase?.budgetEuro,
      objective: displayText(phase?.objective, 'Objetivo por definir'),
    })),
    conclusion:
      displayText(
        premiumPlan.evolutionStrategy || result?.conclusion?.why,
        'La clave es seguir el orden correcto, validar compatibilidades y ajustar la build al estado real del coche.',
      ),
  };
}

function PremiumIcon({ type }) {
  const icons = {
    order: '1',
    error: '!',
    config: '+',
    result: '%',
    decision: '>',
    limit: '!',
    advice: 'i',
    specs: '#',
    download: 'PDF',
  };

  return <span className={`premium-plan-icon premium-plan-icon--${type}`}>{icons[type]}</span>;
}

function PremiumList({ items, ordered = false, danger = false }) {
  const Tag = ordered ? 'ol' : 'ul';
  const safeItems = normalizeList(items);

  if (!safeItems.length) {
    return null;
  }

  return (
    <Tag className={danger ? 'premium-plan-list premium-plan-list--danger' : 'premium-plan-list'}>
      {safeItems.map((item, index) => (
        <li key={`${item}-${index}`}>{item}</li>
      ))}
    </Tag>
  );
}

function PremiumPlan({ result, vehicle, onBack }) {
  const [activeSlide, setActiveSlide] = useState(0);
  const [touchStartX, setTouchStartX] = useState(null);
  const [downloadState, setDownloadState] = useState({
    status: '',
    url: '',
    fileName: '',
  });
  const plan = useMemo(() => getPremiumPlanData(result, vehicle), [result, vehicle]);

  function goToSlide(index) {
    setActiveSlide(Math.min(Math.max(index, 0), 8));
  }

  function handleTouchEnd(event) {
    if (touchStartX === null) {
      return;
    }
    const deltaX = event.changedTouches[0].clientX - touchStartX;
    setTouchStartX(null);
    if (Math.abs(deltaX) < 44) {
      return;
    }
    goToSlide(activeSlide + (deltaX < 0 ? 1 : -1));
  }

  function handleDownloadPdf() {
    try {
      if (downloadState.url) {
        URL.revokeObjectURL(downloadState.url);
      }

      const lines = [
        plan.vehicleName,
        plan.summary,
        '',
        'ORDEN EXACTO DE INSTALACION',
        ...plan.installOrder.map((item, index) => `${index + 1}. ${item}`),
        '',
        'ERRORES CRITICOS A EVITAR',
        ...plan.warnings.map((item) => `- ${item}`),
        '',
        'CONFIGURACION RECOMENDADA',
        ...plan.configuration.map((item) => `- ${item}`),
        '',
        'RESULTADO REALISTA',
        `Potencia: ${plan.result.power}`,
        `Par motor: ${plan.result.torque}`,
        plan.result.note,
        '',
        'ESPECIFICACIONES TECNICAS',
        ...plan.technicalSpecs.map(([label, value]) => `${label}: ${value}`),
        '',
        'CONCLUSION',
        plan.conclusion,
      ];

      const blob = buildPdf(lines);
      const url = URL.createObjectURL(blob);
      const fileName = buildPdfFileName(plan.vehicleName);
      const link = document.createElement('a');

      link.href = url;
      link.download = fileName;
      link.type = 'application/pdf';
      link.rel = 'noopener';
      link.style.display = 'none';
      document.body.appendChild(link);
      link.dispatchEvent(new MouseEvent('click', {
        bubbles: true,
        cancelable: true,
        view: window,
      }));
      link.remove();

      setDownloadState({
        status: 'PDF generado. Si el navegador no lo descarga automaticamente, abrelo aqui.',
        url,
        fileName,
      });
    } catch (error) {
      setDownloadState({
        status: 'No se pudo generar el PDF en este intento. Vuelve a probar.',
        url: '',
        fileName: '',
      });
    }
  }

  const slides = [
    'Resumen',
    'Orden',
    'Errores',
    'Configuracion',
    'Resultado',
    'Decisiones',
    'Limitaciones',
    'Ficha',
    'PDF',
  ];

  return (
    <section className="premium-plan">
      <header className="premium-plan-topbar">
        <button type="button" className="build-dashboard-back" onClick={onBack}>
          <span aria-hidden="true">&lt;</span>
          Volver
        </button>
        <span>Plan optimizado</span>
      </header>

      <section
        className="premium-plan-slider"
        onTouchStart={(event) => setTouchStartX(event.touches[0].clientX)}
        onTouchEnd={handleTouchEnd}
      >
        <div className="premium-plan-track" style={{ transform: `translateX(-${activeSlide * 100}%)` }}>
          <article className="premium-plan-slide premium-plan-slide--hero">
            <img src={premiumSlideSummaryBg} alt="" />
            <div className="premium-plan-shade" />
            <div className="premium-plan-content">
              <span>Plan optimizado</span>
              <h1>{plan.vehicleName}</h1>
              <p>{plan.summary}</p>
              <div className="premium-plan-meta">
                <div>
                  <strong>Objetivo</strong>
                  <em>{plan.targetGain}</em>
                </div>
                <div>
                  <strong>Uso</strong>
                  <em>{plan.usage}</em>
                </div>
                <div>
                  <strong>Nivel</strong>
                  <em>{plan.level}</em>
                </div>
              </div>
            </div>
          </article>

          <article className="premium-plan-slide">
            <img src={premiumSlideOrderBg} alt="" />
            <div className="premium-plan-shade" />
            <div className="premium-plan-content">
              <PremiumIcon type="order" />
              <h2>Orden exacto de instalacion</h2>
              <PremiumList items={plan.installOrder} ordered />
            </div>
          </article>

          <article className="premium-plan-slide premium-plan-slide--danger">
            <img src={premiumSlideErrorsBg} alt="" />
            <div className="premium-plan-shade" />
            <div className="premium-plan-content">
              <PremiumIcon type="error" />
              <h2>Errores criticos a evitar</h2>
              <PremiumList items={plan.warnings} danger />
            </div>
          </article>

          <article className="premium-plan-slide">
            <img src={premiumSlideConfigBg} alt="" />
            <div className="premium-plan-shade" />
            <div className="premium-plan-content">
              <PremiumIcon type="config" />
              <h2>Configuracion recomendada</h2>
              <PremiumList items={plan.configuration} />
              <h3>Dependencias</h3>
              <PremiumList items={plan.dependencies.slice(0, 4)} />
            </div>
          </article>

          <article className="premium-plan-slide">
            <img src={premiumSlideResultBg} alt="" />
            <div className="premium-plan-shade" />
            <div className="premium-plan-content">
              <PremiumIcon type="result" />
              <h2>Resultado realista</h2>
              <div className="premium-plan-result">
                <div>
                  <span>Potencia</span>
                  <strong>{plan.result.power}</strong>
                </div>
                <div>
                  <span>Par motor</span>
                  <strong>{plan.result.torque}</strong>
                </div>
              </div>
              <p>{plan.result.note}</p>
            </div>
          </article>

          <article className="premium-plan-slide">
            <img src={premiumSlideDecisionsBg} alt="" />
            <div className="premium-plan-shade" />
            <div className="premium-plan-content">
              <PremiumIcon type="decision" />
              <h2>Decisiones clave</h2>
              <PremiumList items={plan.decisions} />
              <div className="premium-plan-budget">
                {plan.budgetPlan.map((phase) => (
                  <article key={phase.phase}>
                    <strong>{phase.phase}</strong>
                    <span>{formatEuro(phase.budgetEuro)}</span>
                    <p>{phase.objective}</p>
                  </article>
                ))}
              </div>
            </div>
          </article>

          <article className="premium-plan-slide">
            <img src={premiumSlideLimitationsBg} alt="" />
            <div className="premium-plan-shade" />
            <div className="premium-plan-content">
              <PremiumIcon type="limit" />
              <h2>Limitaciones y consejos</h2>
              <h3>Limitaciones del motor</h3>
              <PremiumList items={plan.limitations.length ? plan.limitations : plan.dependencies.slice(0, 3)} danger />
              <h3>Consejos clave</h3>
              <PremiumList items={plan.advice} />
            </div>
          </article>

          <article className="premium-plan-slide">
            <img src={premiumSlideSpecsBg} alt="" />
            <div className="premium-plan-shade" />
            <div className="premium-plan-content">
              <PremiumIcon type="specs" />
              <h2>Especificaciones tecnicas</h2>
              <dl className="premium-plan-specs">
                {plan.technicalSpecs.map(([label, value]) => (
                  <div key={label}>
                    <dt>{label}</dt>
                    <dd>{value}</dd>
                  </div>
                ))}
              </dl>
            </div>
          </article>

          <article className="premium-plan-slide premium-plan-slide--download">
            <img src={premiumSlidePdfBg} alt="" />
            <div className="premium-plan-shade" />
            <div className="premium-plan-content">
              <PremiumIcon type="download" />
              <h2>Ficha tecnica completa</h2>
              <p>
                Descarga un PDF con el resumen del vehiculo, orden de instalacion, errores,
                configuracion recomendada, resultado esperado y especificaciones tecnicas.
              </p>
              <button type="button" onClick={handleDownloadPdf}>
                Descargar ficha tecnica PDF
              </button>
              {downloadState.status && (
                <div className="premium-plan-download-status">
                  <span>{downloadState.status}</span>
                  {downloadState.url && (
                    <a href={downloadState.url} download={downloadState.fileName} target="_blank" rel="noreferrer">
                      Abrir PDF
                    </a>
                  )}
                </div>
              )}
              <small>{plan.conclusion}</small>
            </div>
          </article>
        </div>
      </section>

      <nav className="premium-plan-nav" aria-label="Secciones del plan optimizado">
        {slides.map((slide, index) => (
          <button
            key={slide}
            type="button"
            className={index === activeSlide ? 'premium-plan-dot premium-plan-dot--active' : 'premium-plan-dot'}
            onClick={() => goToSlide(index)}
            aria-label={`Ver ${slide}`}
          />
        ))}
      </nav>
    </section>
  );
}

export default PremiumPlan;
