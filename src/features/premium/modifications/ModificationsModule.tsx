import { useState } from 'react';
import type { Firestore } from 'firebase/firestore';
import type { ProjectGoal } from '../models';
import type { ModificationArea, ModificationRouteStep } from './modificationRoute';
import type { ModificationModuleData } from './modificationModuleData';
import { markModificationInstalled, updateModificationGoal } from './modificationModuleData';

const AREA_LABELS: Record<ModificationArea, string> = { mechanical: 'Modificaciones mecánicas', chassis_brakes: 'Chasis y frenos', transmission: 'Transmisión', aesthetic: 'Estética' };
const STATUS_LABELS: Record<ModificationRouteStep['status'], string> = { completed: 'Completada', current: 'Modificación actual', later: 'Posterior', blocked: 'Bloqueada' };
const ROUTE_AREAS: ModificationArea[] = ['mechanical', 'chassis_brakes', 'transmission', 'aesthetic'];
const GOALS: { value: ProjectGoal['type']; label: string }[] = [
  { value: 'reliability', label: 'Fiabilidad' }, { value: 'street_performance', label: 'Prestaciones para calle' },
  { value: 'track', label: 'Circuito' }, { value: 'aesthetic', label: 'Estética' }, { value: 'custom', label: 'Personalizado' },
];

export function ModificationsModule({ data, loading, error, firestore, onRecalculate }: { data: ModificationModuleData | null; loading: boolean; error?: string | null; firestore: Firestore; onRecalculate: () => Promise<void> }) {
  const [savingId, setSavingId] = useState<string | null>(null); const [actionError, setActionError] = useState<string | null>(null);
  if (loading) return <ModificationSkeleton />;
  if (error) return <ModificationEmpty title="No se pudo cargar la ruta" copy={error} />;
  if (!data) return <ModificationEmpty title="Ruta pendiente" copy="Necesitamos un vehículo y un objetivo activos para preparar la ruta." />;
  async function install(step: ModificationRouteStep) { if (!data || step.status !== 'current') return; setSavingId(step.definition.id); setActionError(null); try { await markModificationInstalled(firestore, data, step.definition); await onRecalculate(); } catch { setActionError('No se pudo registrar la pieza instalada.'); } finally { setSavingId(null); } }
  async function changeGoal(value: ProjectGoal['type']) { if (!data || value === data.goal.type) return; setSavingId('goal'); setActionError(null); try { await updateModificationGoal(firestore, data.goal, value); await onRecalculate(); } catch { setActionError('No se pudo actualizar el objetivo.'); } finally { setSavingId(null); } }
  return <section className="garage-module modifications-module">
    <header className="garage-module-heading"><span>Proyecto personalizado</span><h1>Ruta de preparación</h1><p>Un orden técnico recalculable según el coche, su estado, el objetivo y lo que ya está instalado.</p></header>
    <div className="modification-context">
      <article><span>Punto de partida</span><h2>{data.vehicle.variantSnapshot.brand} {data.vehicle.variantSnapshot.model}</h2><dl><div><dt>Versión</dt><dd>{data.vehicle.variantSnapshot.variant}</dd></div><div><dt>Kilometraje</dt><dd>{formatNumber(data.vehicle.mileageKm)} km</dd></div><div><dt>Estado declarado</dt><dd>{conditionLabel(data.vehicle.condition)}</dd></div><div><dt>Uso</dt><dd>{data.context.use}</dd></div>{data.context.seriousHistory && <div><dt>Historial</dt><dd>Requiere revisión previa</dd></div>}{data.installed.length > 0 && <div><dt>Instaladas</dt><dd>{String(data.installed.filter((item) => item.active).length)}</dd></div>}</dl></article>
      <article><span>Objetivo</span><label>Objetivo activo<select value={data.goal.type} disabled={savingId === 'goal'} onChange={(event) => { const value = event.target.value; if (isGoalType(value)) void changeGoal(value); }}>{GOALS.map((goal) => <option key={goal.value} value={goal.value}>{goal.label}</option>)}</select></label><p>{data.goal.title}</p>{data.context.wantsAestheticRecommendations && data.context.aestheticStyle && <small>Preferencia estética: {data.context.aestheticStyle}</small>}</article>
    </div>
    {data.context.seriousHistory && <div className="modification-global-warning"><strong>Preparación condicionada</strong><span>El historial declarado exige una inspección antes de recomendar pasos críticos.</span></div>}
    <section className="modification-route-summary"><article><span>Completadas</span><strong>{String(data.route.completed.length)}</strong></article><article><span>Actual</span><strong>{data.route.current?.definition.title ?? 'Pendiente'}</strong></article><article><span>Posteriores</span><strong>{String(data.route.later.length)}</strong></article><article><span>Bloqueadas</span><strong>{String(data.route.blocked.length)}</strong></article></section>
    {actionError && <p className="modification-action-error">{actionError}</p>}
    {data.route.steps.length ? ROUTE_AREAS.map((area) => { const steps = data.route.steps.filter((step) => step.area === area); return steps.length ? <RouteArea key={area} area={area} steps={steps} savingId={savingId} onInstall={(step) => { void install(step); }} /> : null; }) : <ModificationEmpty title="Sin ruta técnica aprobada" copy="No hay modificaciones validadas para este vehículo y objetivo. No mostraremos propuestas genéricas o borradores de IA." />}
    <FinalResult data={data} />
  </section>;
}

function RouteArea({ area, steps, savingId, onInstall }: { area: ModificationArea; steps: ModificationRouteStep[]; savingId: string | null; onInstall: (step: ModificationRouteStep) => void }) {
  return <section className="modification-area"><header><span>{AREA_LABELS[area]}</span><b>{String(steps.length)} pasos</b></header><div>{steps.map((step) => <article className={`modification-step modification-step--${step.status}`} key={step.definition.id}><header><i>{String(step.order).padStart(2, '0')}</i><div><span>{STATUS_LABELS[step.status]}</span><h3>{step.definition.title}</h3></div></header><p>{step.definition.description}</p><dl><Detail label="Por qué sigue este orden" values={[step.rationale]} /><Detail label="Piezas y especificaciones compatibles" values={step.definition.partsAndSpecifications} /><Detail label="Requisitos previos" values={step.definition.prerequisiteChecks} /><Detail label="Resultado esperado" values={step.definition.expectedResult ? [step.definition.expectedResult] : undefined} /><Detail label="Respuesta" values={step.definition.impacts?.response ? [step.definition.impacts.response] : undefined} /><Detail label="Refrigeración" values={step.definition.impacts?.cooling ? [step.definition.impacts.cooling] : undefined} /><Detail label="Transmisión" values={step.definition.impacts?.transmission ? [step.definition.impacts.transmission] : undefined} /><Detail label="Fiabilidad" values={step.definition.impacts?.reliability ? [step.definition.impacts.reliability] : undefined} /><Detail label="Advertencias técnicas" values={[...(step.definition.technicalWarnings ?? []), ...step.blockedReasons]} /></dl>{step.definition.estimatedPowerGainCv && <p className="modification-estimate">Potencia estimada: +{formatRange(step.definition.estimatedPowerGainCv)} CV</p>}{step.definition.estimatedTorqueGainNm && <p className="modification-estimate">Par estimado: +{formatRange(step.definition.estimatedTorqueGainNm)} Nm</p>}{step.status === 'current' && <button type="button" disabled={savingId !== null} onClick={() => { onInstall(step); }}>{savingId === step.definition.id ? 'Recalculando…' : 'Marcar pieza como instalada'}</button>}{step.status === 'blocked' && <strong className="modification-blocked-label">No recomendada hasta resolver requisitos</strong>}</article>)}</div></section>;
}

function Detail({ label, values }: { label: string; values?: string[] }) { return values?.length ? <div><dt>{label}</dt><dd>{values.map((value) => <span key={value}>{value}</span>)}</dd></div> : null; }
function FinalResult({ data }: { data: ModificationModuleData }) { const power = data.route.estimatedFinalPowerCv; const torque = data.route.estimatedFinalTorqueNm; return <section className="modification-final"><span>Resultado final previsto</span><h2>{data.route.blocked.length ? 'Condicionado por requisitos pendientes' : data.route.steps.length ? 'Ruta técnicamente ordenada' : 'Pendiente de validación'}</h2>{power && <p>Potencia final estimada: {formatRange(power)} CV</p>}{torque && <p>Par final estimado: {formatRange(torque)} Nm</p>}<small>Las estimaciones solo aparecen cuando la ficha de serie y las ganancias están respaldadas por datos aprobados.</small></section>; }
function ModificationEmpty({ title, copy }: { title: string; copy: string }) { return <article className="garage-empty-module"><span>+</span><h2>{title}</h2><p>{copy}</p></article>; }
function ModificationSkeleton() { return <section className="modification-skeleton" aria-label="Cargando ruta de modificaciones"><span /><span /><span /><span /></section>; }
function formatNumber(value: number) { return new Intl.NumberFormat('es-ES').format(value); }
function formatRange(range: { minimum: number; maximum: number }) { return range.minimum === range.maximum ? formatNumber(range.minimum) : `${formatNumber(range.minimum)}–${formatNumber(range.maximum)}`; }
function conditionLabel(condition: ModificationModuleData['vehicle']['condition']) { return { unknown: 'Sin información suficiente', needs_inspection: 'Requiere inspección', service_due: 'Mantenimiento pendiente', good: 'Correcto declarado', project: 'Proyecto en curso' }[condition]; }
function isGoalType(value: string): value is ProjectGoal['type'] { return GOALS.some((goal) => goal.value === value); }
