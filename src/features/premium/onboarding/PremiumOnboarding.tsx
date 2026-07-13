import { useEffect, useMemo, useState, type ChangeEvent, type ReactNode } from 'react';
import { useAuth } from '../auth/AuthContext';
import {
  modificationCategorySchema, premiumOnboardingDraftSchema, premiumOnboardingSchema,
  validateOnboardingStep, type PremiumOnboardingDraft,
} from './onboardingSchema';
import { submitPremiumOnboarding } from './onboardingService';

const STEP_TITLES = ['Identificación', 'Estado e historial', 'Modificaciones actuales', 'Uso del vehículo', 'Objetivo', 'Estética', 'Resumen'];
const MODIFICATIONS = [
  ['engine', 'Motor'], ['intake', 'Admisión'], ['exhaust', 'Escape'], ['turbo', 'Turbo'], ['cooling', 'Refrigeración'],
  ['fuel', 'Combustible'], ['electronics', 'Electrónica'], ['transmission', 'Transmisión'], ['suspension', 'Suspensión'],
  ['brakes', 'Frenos'], ['wheels_tyres', 'Llantas y neumáticos'], ['aesthetic', 'Estética'],
] as const;
const USES = [['daily', 'Diario'], ['weekend', 'Fin de semana'], ['travel', 'Viajes'], ['track', 'Circuito'], ['drift', 'Drift'], ['rally', 'Rally'], ['show', 'Exposición'], ['mixed', 'Mixto']] as const;
const OBJECTIVES = [['reliability', 'Fiabilidad'], ['maintenance', 'Mantenimiento'], ['stage_1', 'Stage 1'], ['stage_2', 'Stage 2'], ['stage_3', 'Stage 3'], ['custom_power', 'Potencia personalizada'], ['track', 'Circuito'], ['drift', 'Drift'], ['rally', 'Rally'], ['show_car', 'Show car'], ['oem_plus', 'OEM+'], ['other', 'Otro']] as const;
const AESTHETIC_STYLES = ['OEM+', 'Deportivo discreto', 'Street', 'Track inspirado', 'Show car', 'Clásico restaurado', 'Personalizado'];
const PREPARATION_STEPS = ['Identificando vehículo', 'Consultando ficha técnica', 'Preparando mantenimiento', 'Analizando objetivo', 'Generando ruta', 'Configurando especialista IA', 'Garaje listo'];

interface PremiumOnboardingProps {
  initialVehicle?: { brand?: string; model?: string; generation?: string; engine?: string; year?: string | number; mileageKm?: string | number } | null;
  onComplete(): Promise<void>;
}

function createInitialDraft(initialVehicle: PremiumOnboardingProps['initialVehicle']): PremiumOnboardingDraft {
  const parsedYear = Number(initialVehicle?.year);
  const parsedMileage = Number(initialVehicle?.mileageKm);
  return {
    brand: initialVehicle?.brand ?? '', model: initialVehicle?.model ?? '', generation: initialVehicle?.generation ?? '',
    variant: initialVehicle?.engine ?? '', year: Number.isInteger(parsedYear) && parsedYear > 1885 ? parsedYear : new Date().getFullYear(),
    mileageKm: Number.isFinite(parsedMileage) && parsedMileage >= 0 ? Math.round(parsedMileage) : 0,
    market: '', majorAccidents: false, seriousBreakdowns: false, engineReplaced: false,
    transmissionReplaced: false, historyContext: '', hasModifications: false, modificationCategories: [], otherModifications: '',
    primaryUse: 'daily', objective: 'reliability', otherObjective: '', wantsAestheticRecommendations: false,
    aestheticStyle: '', consentAccepted: false,
  };
}

export function PremiumOnboarding({ initialVehicle, onComplete }: PremiumOnboardingProps) {
  const { user } = useAuth();
  const storageKey = `th-premium-onboarding-${user?.uid ?? 'anonymous'}`;
  const [draft, setDraft] = useState<PremiumOnboardingDraft>(() => {
    const initial = createInitialDraft(initialVehicle);
    try {
      const stored: unknown = JSON.parse(window.localStorage.getItem(storageKey) ?? 'null');
      const parsed = premiumOnboardingDraftSchema.safeParse(stored);
      return parsed.success ? parsed.data : initial;
    } catch { return initial; }
  });
  const [step, setStep] = useState(0);
  const [errors, setErrors] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [preparationIndex, setPreparationIndex] = useState(-1);

  useEffect(() => { window.localStorage.setItem(storageKey, JSON.stringify(draft)); }, [draft, storageKey]);

  useEffect(() => {
    if (preparationIndex < 0 || preparationIndex >= PREPARATION_STEPS.length - 1) return undefined;
    const timer = window.setTimeout(() => { setPreparationIndex((current) => current + 1); }, 850);
    return () => { window.clearTimeout(timer); };
  }, [preparationIndex]);

  const progress = Math.round(((step + 1) / STEP_TITLES.length) * 100);
  const summary = useMemo(() => ({
    vehicle: `${draft.brand} ${draft.model} ${draft.generation} ${draft.variant}`.trim(),
    historyAlerts: [draft.majorAccidents && 'Accidentes', draft.seriousBreakdowns && 'Averías graves', draft.engineReplaced && 'Motor reemplazado', draft.transmissionReplaced && 'Caja reemplazada'].filter(Boolean),
  }), [draft]);

  function updateField<K extends keyof PremiumOnboardingDraft>(field: K, value: PremiumOnboardingDraft[K]) {
    setDraft((current) => ({ ...current, [field]: value })); setErrors([]);
  }

  function toggleModification(value: string) {
    const parsed = modificationCategorySchema.safeParse(value);
    if (!parsed.success) return;
    updateField('modificationCategories', draft.modificationCategories.includes(parsed.data)
      ? draft.modificationCategories.filter((item) => item !== parsed.data)
      : [...draft.modificationCategories, parsed.data]);
  }

  function goNext() {
    const nextErrors = validateOnboardingStep(step, draft);
    if (nextErrors.length > 0) { setErrors(nextErrors); return; }
    setStep((current) => Math.min(current + 1, STEP_TITLES.length - 1));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  async function submit() {
    const parsed = premiumOnboardingSchema.safeParse(draft);
    if (!parsed.success) { setErrors(parsed.error.issues.map((issue) => issue.message)); return; }
    setSubmitting(true); setSubmitError('');
    try {
      await submitPremiumOnboarding(parsed.data);
      window.localStorage.removeItem(storageKey);
      setPreparationIndex(0);
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : 'No se pudo preparar el garaje.');
    } finally { setSubmitting(false); }
  }

  if (preparationIndex >= 0) {
    return <PreparationSequence activeIndex={preparationIndex} onReady={onComplete} />;
  }

  return (
    <section className="onboarding-shell">
      <header className="onboarding-header"><div><span>Configuración Premium</span><strong>Paso {step + 1} de {STEP_TITLES.length}</strong></div><div className="onboarding-progress" aria-label={`${progress}% completado`}><i style={{ width: `${progress}%` }} /></div><small>{progress}%</small></header>
      <article className="onboarding-card">
        <p className="auth-card__eyebrow">{STEP_TITLES[step]}</p>
        <h1>{step === 0 ? 'Empecemos por tu coche' : step === 1 ? '¿Qué ha vivido hasta ahora?' : step === 2 ? '¿Qué lleva instalado?' : step === 3 ? '¿Cómo utilizas el coche?' : step === 4 ? '¿Hacia dónde quieres llevarlo?' : step === 5 ? '¿Quieres trabajar su estética?' : 'Revisa tu punto de partida'}</h1>
        <p className="onboarding-card__intro">{step === 6 ? 'Solo utilizaremos estos datos para personalizar tu garaje y preparar el proyecto.' : 'No completaremos datos técnicos por nuestra cuenta. Si algo no está claro, quedará pendiente de verificar.'}</p>

        {step === 0 ? <div className="onboarding-fields onboarding-fields--two"><TextField label="Marca" value={draft.brand} onChange={(value) => updateField('brand', value)} /><TextField label="Modelo" value={draft.model} onChange={(value) => updateField('model', value)} /><TextField label="Generación" value={draft.generation} onChange={(value) => updateField('generation', value)} /><TextField label="Versión" value={draft.variant} onChange={(value) => updateField('variant', value)} /><NumberField label="Año" value={draft.year} onChange={(value) => updateField('year', value)} /><NumberField label="Kilometraje" value={draft.mileageKm} onChange={(value) => updateField('mileageKm', value)} /><TextField label="Mercado (si lo conoces)" value={draft.market} onChange={(value) => updateField('market', value)} /></div> : null}
        {step === 1 ? <div className="onboarding-fields"><ToggleQuestion label="¿Ha tenido accidentes importantes?" value={draft.majorAccidents} onChange={(value) => updateField('majorAccidents', value)} /><ToggleQuestion label="¿Ha sufrido averías graves?" value={draft.seriousBreakdowns} onChange={(value) => updateField('seriousBreakdowns', value)} /><ToggleQuestion label="¿Se ha reemplazado el motor?" value={draft.engineReplaced} onChange={(value) => updateField('engineReplaced', value)} /><ToggleQuestion label="¿Se ha reemplazado la caja de cambios?" value={draft.transmissionReplaced} onChange={(value) => updateField('transmissionReplaced', value)} /><TextArea label="Contexto adicional" value={draft.historyContext} onChange={(value) => updateField('historyContext', value)} placeholder="Trabajos importantes, síntomas actuales o cualquier detalle útil…" /></div> : null}
        {step === 2 ? <div className="onboarding-fields"><ToggleQuestion label="¿Tiene modificaciones actualmente?" value={draft.hasModifications} onChange={(value) => updateField('hasModifications', value)} />{draft.hasModifications ? <><ChoiceGrid>{MODIFICATIONS.map(([value, label]) => <ChoiceButton key={value} selected={draft.modificationCategories.includes(value)} onClick={() => { toggleModification(value); }}>{label}</ChoiceButton>)}</ChoiceGrid><TextArea label="Otras modificaciones" value={draft.otherModifications} onChange={(value) => updateField('otherModifications', value)} placeholder="Elementos no contemplados en la lista…" /></> : null}</div> : null}
        {step === 3 ? <ChoiceGrid>{USES.map(([value, label]) => <ChoiceButton key={value} selected={draft.primaryUse === value} onClick={() => updateField('primaryUse', value)}>{label}</ChoiceButton>)}</ChoiceGrid> : null}
        {step === 4 ? <div className="onboarding-fields"><ChoiceGrid>{OBJECTIVES.map(([value, label]) => <ChoiceButton key={value} selected={draft.objective === value} onClick={() => updateField('objective', value)}>{label}</ChoiceButton>)}</ChoiceGrid>{draft.objective === 'custom_power' ? <NumberField label="Potencia objetivo declarada (CV)" value={draft.customPowerCv ?? 0} onChange={(value) => updateField('customPowerCv', value || undefined)} /> : null}{draft.objective === 'other' ? <TextArea label="Describe tu objetivo" value={draft.otherObjective} onChange={(value) => updateField('otherObjective', value)} /> : null}</div> : null}
        {step === 5 ? <div className="onboarding-fields"><ToggleQuestion label="¿Quieres recomendaciones estéticas?" value={draft.wantsAestheticRecommendations} onChange={(value) => updateField('wantsAestheticRecommendations', value)} />{draft.wantsAestheticRecommendations ? <ChoiceGrid>{AESTHETIC_STYLES.map((style) => <ChoiceButton key={style} selected={draft.aestheticStyle === style} onClick={() => updateField('aestheticStyle', style)}>{style}</ChoiceButton>)}</ChoiceGrid> : null}</div> : null}
        {step === 6 ? <div className="onboarding-summary"><SummaryRow label="Vehículo" value={summary.vehicle} /><SummaryRow label="Año y kilometraje" value={`${draft.year} · ${draft.mileageKm.toLocaleString('es-ES')} km`} /><SummaryRow label="Historial destacado" value={summary.historyAlerts.length ? summary.historyAlerts.join(', ') : 'Sin incidencias importantes declaradas'} /><SummaryRow label="Modificaciones" value={draft.hasModifications ? `${draft.modificationCategories.length} categorías declaradas` : 'Vehículo declarado de serie'} /><SummaryRow label="Uso" value={draft.primaryUse} /><SummaryRow label="Objetivo" value={draft.objective.replaceAll('_', ' ')} /><label className="onboarding-consent"><input type="checkbox" checked={draft.consentAccepted} onChange={(event) => updateField('consentAccepted', event.target.checked)} /><span><strong>Consiento el tratamiento de estos datos</strong><small>Se usarán para crear mi vehículo, personalizar el proyecto y preparar las recomendaciones Premium. Podré corregirlos más adelante.</small></span></label></div> : null}

        {errors.length ? <div className="onboarding-errors" role="alert">{errors.map((error) => <p key={error}>{error}</p>)}</div> : null}
        {submitError ? <p className="onboarding-errors" role="alert">{submitError}</p> : null}
        <footer className="onboarding-footer">{step > 0 ? <button type="button" className="secondary" onClick={() => setStep((current) => current - 1)}>Anterior</button> : <span />}{step < STEP_TITLES.length - 1 ? <button type="button" onClick={goNext}>Continuar</button> : <button type="button" disabled={submitting} onClick={() => { void submit(); }}>{submitting ? 'Creando garaje…' : 'Crear mi garaje'}</button>}</footer>
      </article>
      <p className="onboarding-saved">Guardado automáticamente en este dispositivo</p>
    </section>
  );
}

function TextField({ label, value, onChange }: { label: string; value: string; onChange(value: string): void }) { return <label className="onboarding-field"><span>{label}</span><input value={value} onChange={(event) => onChange(event.target.value)} /></label>; }
function NumberField({ label, value, onChange }: { label: string; value: number; onChange(value: number): void }) { return <label className="onboarding-field"><span>{label}</span><input type="number" min="0" value={value} onChange={(event: ChangeEvent<HTMLInputElement>) => onChange(Number(event.target.value))} /></label>; }
function TextArea({ label, value, onChange, placeholder }: { label: string; value: string; onChange(value: string): void; placeholder?: string }) { return <label className="onboarding-field"><span>{label}</span><textarea value={value} placeholder={placeholder} onChange={(event) => onChange(event.target.value)} /></label>; }
function ToggleQuestion({ label, value, onChange }: { label: string; value: boolean; onChange(value: boolean): void }) { return <fieldset className="toggle-question"><legend>{label}</legend><button type="button" className={value ? 'selected' : ''} onClick={() => onChange(true)}>Sí</button><button type="button" className={!value ? 'selected' : ''} onClick={() => onChange(false)}>No</button></fieldset>; }
function ChoiceGrid({ children }: { children: ReactNode }) { return <div className="onboarding-choice-grid">{children}</div>; }
function ChoiceButton({ selected, onClick, children }: { selected: boolean; onClick(): void; children: ReactNode }) { return <button type="button" className={selected ? 'selected' : ''} onClick={onClick}>{selected ? <span>✓</span> : null}{children}</button>; }
function SummaryRow({ label, value }: { label: string; value: string }) { return <div><span>{label}</span><strong>{value}</strong></div>; }

function PreparationSequence({ activeIndex, onReady }: { activeIndex: number; onReady(): Promise<void> }) {
  const ready = activeIndex === PREPARATION_STEPS.length - 1;
  return <section className="garage-preparation"><article><div className={`garage-preparation__core ${ready ? 'ready' : ''}`}><span>{ready ? '✓' : activeIndex + 1}</span></div><p className="auth-card__eyebrow">Preparando tu experiencia</p><h1>{PREPARATION_STEPS[activeIndex]}</h1><div className="garage-preparation__steps">{PREPARATION_STEPS.map((label, index) => <div key={label} className={index < activeIndex ? 'done' : index === activeIndex ? 'active' : ''}><i /> <span>{label}</span></div>)}</div>{ready ? <button type="button" onClick={() => { void onReady(); }}>Entrar en mi garaje</button> : <p>Estamos organizando tus datos. No añadiremos información técnica sin verificar.</p>}</article></section>;
}
