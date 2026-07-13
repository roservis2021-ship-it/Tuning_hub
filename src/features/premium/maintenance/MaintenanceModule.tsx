import { useState, type SyntheticEvent } from 'react';
import type { Firestore } from 'firebase/firestore';
import type { MaintenanceTask } from '../models';
import type { MaintenanceModuleData } from './maintenanceModuleData';
import { persistMaintenanceCompletion } from './maintenanceService';

const STATUS_LABELS: Record<MaintenanceTask['status'], string> = {
  up_to_date: 'Al día', upcoming: 'Próximo', overdue: 'Vencido', urgent: 'Urgente', insufficient_information: 'Sin información suficiente',
};

export function MaintenanceModule({ data, loading, error, firestore, onUpdated }: { data: MaintenanceModuleData | null; loading: boolean; error?: string | null; firestore: Firestore; onUpdated: (data: MaintenanceModuleData) => void }) {
  if (loading) return <MaintenanceSkeleton />;
  if (error) return <MaintenanceState title="No se pudo cargar mantenimiento" copy={error} />;
  if (!data) return <MaintenanceState title="Sin vehículo" copy="Completa el onboarding para preparar un plan de mantenimiento." />;
  const next = data.nextTask;
  return <section className="garage-module maintenance-module">
    <header className="garage-module-heading"><span>Mantenimiento personalizado</span><h1>Cuida la base</h1><p>Seguimiento preventivo según tu vehículo, historial, uso y modificaciones documentadas.</p></header>
    <div className="maintenance-overview">
      <article className={`maintenance-status maintenance-status--${data.overallStatus}`}><span>Estado general</span><strong>{STATUS_LABELS[data.overallStatus]}</strong><p>{data.approvedPlan ? 'Plan basado únicamente en definiciones técnicas aprobadas.' : 'Todavía no existe un plan técnico aprobado para esta variante.'}</p></article>
      <article className="maintenance-next"><span>Próximo mantenimiento</span><strong>{next?.title ?? 'Pendiente de investigación'}</strong>{next && <DueSummary task={next} mileageKm={data.vehicle.mileageKm} />}</article>
    </div>
    <section className="maintenance-section"><header><div><span>Plan recomendado</span><h2>Prioridades actuales</h2></div><b>{data.tasks.length} tareas</b></header>
      {data.tasks.length ? <div className="maintenance-plan">{data.tasks.map((task) => <MaintenanceTaskCard key={task.id} task={task} mileageKm={data.vehicle.mileageKm} firestore={firestore} onCompleted={(completedTask, record) => { onUpdated(applyCompletion(data, completedTask, record)); }} />)}</div> : <MaintenanceState title="Sin información suficiente" copy="No mostraremos intervalos genéricos ni propuestas de IA sin revisión." />}
    </section>
    <section className="maintenance-section"><header><div><span>Registro</span><h2>Historial</h2></div></header>{data.history.length ? <div className="maintenance-history">{data.history.map((record) => <article key={record.id}><time>{formatDate(record.performedAt)}</time><div><strong>{record.title}</strong>{record.notes && <p>{record.notes}</p>}<small>{record.mileageKm !== undefined ? `${formatNumber(record.mileageKm)} km · ` : ''}{record.verificationStatus === 'user_declared' ? 'Declarado por el usuario' : 'Documentado'}</small></div></article>)}</div> : <p className="maintenance-empty-copy">Todavía no hay mantenimientos registrados.</p>}</section>
  </section>;
}

function MaintenanceTaskCard({ task, mileageKm, firestore, onCompleted }: { task: MaintenanceTask; mileageKm: number; firestore: Firestore; onCompleted: (task: MaintenanceTask, record: Awaited<ReturnType<typeof persistMaintenanceCompletion>>['record']) => void }) {
  const [open, setOpen] = useState(false); const [saving, setSaving] = useState(false); const [formError, setFormError] = useState<string | null>(null);
  async function submit(event: SyntheticEvent<HTMLFormElement, SubmitEvent>) {
    event.preventDefault(); const form = new FormData(event.currentTarget); const dateValue = form.get('date'); const mileageValue = form.get('mileage'); const notesValue = form.get('notes');
    if (typeof dateValue !== 'string' || typeof mileageValue !== 'string' || (notesValue !== null && typeof notesValue !== 'string')) { setFormError('Revisa los datos introducidos.'); return; }
    const performedAt = new Date(`${dateValue}T12:00:00`); const performedMileage = Number(mileageValue);
    if (Number.isNaN(performedAt.getTime()) || !Number.isFinite(performedMileage) || performedMileage < 0) { setFormError('Revisa la fecha y el kilometraje.'); return; }
    setSaving(true); setFormError(null);
    try { const result = await persistMaintenanceCompletion(firestore, task, { performedAt, mileageKm: performedMileage, notes: notesValue ?? '', reminderByTime: form.get('reminderTime') === 'on', reminderByMileage: form.get('reminderMileage') === 'on' }); onCompleted(result.task, result.record); setOpen(false); }
    catch { setFormError('No se pudo guardar. Comprueba tu conexión e inténtalo de nuevo.'); } finally { setSaving(false); }
  }
  return <article className={`maintenance-task maintenance-task--${task.status}`}><header><div><span>{STATUS_LABELS[task.status]}</span><h3>{task.title}</h3></div><button type="button" onClick={() => { setOpen(!open); }}>{open ? 'Cerrar' : 'Marcar realizado'}</button></header><DueSummary task={task} mileageKm={mileageKm} />{task.adaptationReasons.map((reason) => <p className="maintenance-adaptation" key={reason}>{reason}</p>)}
    {open && <form className="maintenance-completion-form" onSubmit={(event) => { void submit(event); }}><label>Fecha<input name="date" type="date" required defaultValue={new Date().toISOString().slice(0, 10)} /></label><label>Kilometraje<input name="mileage" type="number" min="0" step="1" required defaultValue={mileageKm} /></label><label className="maintenance-form-notes">Notas<textarea name="notes" placeholder="Trabajo realizado, taller o contexto relevante" /></label><label className="maintenance-check"><input name="reminderTime" type="checkbox" defaultChecked={Boolean(task.intervalMonths)} />Recordatorio por tiempo</label><label className="maintenance-check"><input name="reminderMileage" type="checkbox" defaultChecked={Boolean(task.intervalKm)} />Recordatorio por kilometraje</label>{formError && <p className="maintenance-form-error">{formError}</p>}<button type="submit" disabled={saving}>{saving ? 'Guardando…' : 'Guardar mantenimiento'}</button></form>}
  </article>;
}

function DueSummary({ task, mileageKm }: { task: MaintenanceTask; mileageKm: number }) { const days = task.nextDueAt ? Math.ceil((task.nextDueAt.getTime() - Date.now()) / 86_400_000) : undefined; const km = task.nextDueMileageKm !== undefined ? task.nextDueMileageKm - mileageKm : undefined; return <div className="maintenance-due">{km !== undefined && <span><small>Distancia restante</small><b>{km < 0 ? `${formatNumber(Math.abs(km))} km vencido` : `${formatNumber(km)} km`}</b></span>}{days !== undefined && <span><small>Tiempo restante</small><b>{days < 0 ? `${String(Math.abs(days))} días vencido` : `${String(days)} días`}</b></span>}</div>; }
function MaintenanceState({ title, copy }: { title: string; copy: string }) { return <article className="garage-empty-module"><span>M</span><h2>{title}</h2><p>{copy}</p></article>; }
function MaintenanceSkeleton() { return <section className="maintenance-skeleton" aria-label="Cargando mantenimiento"><span /><span /><span /><span /></section>; }
function formatDate(date: Date) { return new Intl.DateTimeFormat('es-ES', { dateStyle: 'medium' }).format(date); }
function formatNumber(value: number) { return new Intl.NumberFormat('es-ES').format(Math.round(value)); }
function applyCompletion(data: MaintenanceModuleData, completedTask: MaintenanceTask, record: MaintenanceModuleData['history'][number]): MaintenanceModuleData {
  const priority: Record<MaintenanceTask['status'], number> = { urgent: 0, overdue: 1, upcoming: 2, insufficient_information: 3, up_to_date: 4 };
  const tasks = data.tasks.map((item) => item.id === completedTask.id ? completedTask : item).sort((a, b) => priority[a.status] - priority[b.status]);
  return { ...data, tasks, history: [record, ...data.history], ...(tasks[0] ? { nextTask: tasks[0] } : {}), overallStatus: tasks[0]?.status ?? 'insufficient_information' };
}
