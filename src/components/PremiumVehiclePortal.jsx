import { useMemo, useState } from 'react';
import workshopImage from '../assets/vehicles/bmw-330ci-e46-premium-workshop.png';
import { getVehicleImage } from '../services/vehicleVisuals';
import { askPremiumAdvisor, generatePremiumAdvisorPlan, getStoredPremiumAdvisorPlan } from '../services/premiumAdvisorService';

const PROFILE_KEY = 'th-premium-vehicle-profile';
const initialProfile = { mileageKm: '', year: '2001', color: 'Schwarz II', use: 'calle', condition: 'bueno', objective: 'street-performance', maintenanceHistory: 'parcial', incidentHistory: 'sin-incidencias', modifications: ['serie'] };
const NAV_ITEMS = [['vehicle', 'Vehículo', 'V'], ['maintenance', 'Mantenimiento', 'M'], ['modifications', 'Modificaciones', '+'], ['risks', 'Fallos y riesgos', '!'], ['legal', 'Homologaciones', 'H']];
const USE_LABELS = { calle: 'Uso diario y carretera', mixto: 'Calle y conducción deportiva', circuito: 'Uso orientado a circuito' };
const CONDITION_LABELS = { excelente: 'Excelente, historial completo', bueno: 'Buen estado general', revisar: 'Necesita una revisión de base' };
const OBJECTIVE_LABELS = { 'street-performance': 'Street Performance', fiabilidad: 'Fiabilidad y mantenimiento', estetica: 'Proyecto estético', circuito: 'Preparación deportiva' };
const MAINTENANCE_HISTORY_LABELS = { completo: 'Historial completo con facturas', parcial: 'Conozco parte del historial', desconocido: 'No conozco el historial' };
const INCIDENT_HISTORY_LABELS = { 'sin-incidencias': 'Sin averías o accidentes importantes', averias: 'Ha tenido averías importantes', accidente: 'Ha sufrido algún accidente', ambos: 'Averías y accidentes anteriores' };
const MODIFICATION_LABELS = { serie: 'Completamente de serie', motor: 'Motor o electrónica', admision: 'Admisión o escape', suspension: 'Suspensión', frenos: 'Frenos', llantas: 'Llantas o neumáticos', estetica: 'Modificaciones estéticas', interior: 'Interior' };

function loadProfile() {
  if (typeof window === 'undefined') return null;
  try {
    const saved = JSON.parse(window.localStorage.getItem(PROFILE_KEY));
    return saved ? { ...initialProfile, ...saved, modifications: Array.isArray(saved.modifications) ? saved.modifications : ['serie'] } : null;
  } catch { return null; }
}

function ChoiceGroup({ label, name, value, options, onChange }) {
  return <fieldset className="thv-choice-group"><legend>{label}</legend><div>{Object.entries(options).map(([key, text]) => <label key={key} className={value === key ? 'is-selected' : ''}><input type="radio" name={name} value={key} checked={value === key} onChange={onChange} /><span><i />{text}</span></label>)}</div></fieldset>;
}

function ModificationGroup({ value, onChange }) {
  return <fieldset className="thv-choice-group thv-modification-group"><legend>Modificaciones instaladas <small>Puedes elegir varias</small></legend><div>{Object.entries(MODIFICATION_LABELS).map(([key, text]) => <label key={key} className={value.includes(key) ? 'is-selected' : ''}><input type="checkbox" value={key} checked={value.includes(key)} onChange={() => onChange(key)} /><span><i>{value.includes(key) ? '✓' : ''}</i>{text}</span></label>)}</div></fieldset>;
}

const SECTION_COPY = {
  maintenance: ['Mantenimiento', 'La base fiable de tu proyecto', 'Acciones ordenadas según el estado, kilometraje e historial de tu vehículo.'],
  modifications: ['Modificaciones', 'Una evolución coherente', 'Motor, chasis y estética coordinados con tu objetivo y con lo que ya está instalado.'],
  risks: ['Fallos, averías y riesgos', 'Anticiparse antes de reparar', 'Riesgos específicos que conviene vigilar, con su causa, consecuencia y prevención.'],
  legal: ['Homologaciones', 'Tu proyecto dentro de la legalidad', 'Orientación inicial sobre reformas, documentación y puntos que debe confirmar un homologador.'],
};

function PriorityBadge({ value }) { return <b className={`thv-priority is-${value}`}>{value}</b>; }

function ActionCards({ actions = [], empty = 'No hay acciones propuestas en este bloque.' }) {
  return <div className="thv-action-list">{actions.length ? actions.map((action, index) => <article key={`${action.title}-${index}`}>
    <header><span>{String(index + 1).padStart(2, '0')}</span><PriorityBadge value={action.priority} /></header>
    <h3>{action.title}</h3><p>{action.reason}</p>
    <div><small>Siguiente acción</small><strong>{action.nextStep}</strong></div>
    <footer><span>≈ {Number(action.estimatedCostEuro || 0).toLocaleString('es-ES')} €</span><em>{action.confidence}</em></footer>
  </article>) : <p className="thv-empty">{empty}</p>}</div>;
}

function AdvisorSection({ section, plan }) {
  const [eyebrow, title, description] = SECTION_COPY[section];
  return <div className={`thv-section-page thv-section-${section}`}>
    <header className="thv-section-heading"><span>{eyebrow}</span><h1>{title}</h1><p>{description}</p><div><i>IA</i><strong>Generado para tu vehículo</strong><small>Revisar cuando cambie el proyecto</small></div></header>
    {section === 'maintenance' ? <><section className="thv-section-summary"><span>Diagnóstico del asesor</span><h2>{plan.maintenance?.status || 'Pendiente de evaluación'}</h2><p>{plan.realisticObjective}</p></section><ActionCards actions={plan.maintenance?.actions} /></> : null}
    {section === 'modifications' ? <><section className="thv-section-summary thv-project-vision"><span>Visión del proyecto</span><h2>{plan.modifications?.project?.realisticHorizon || 'Construir antes de exigir'}</h2><p>{plan.modifications?.project?.vision || plan.modifications?.strategy}</p></section>
      {plan.modifications?.project?.phases?.length ? <section className="thv-project-roadmap"><header><div><span>Plan de evolución</span><h2>El horizonte de tu build</h2></div><p>Cada fase prepara la siguiente. Puedes detenerte donde el coche ya cumpla tu objetivo.</p></header><div>{plan.modifications.project.phases.map((phase,index) => <article key={`${phase.name}-${index}`}><header><i>{String(index+1).padStart(2,'0')}</i><span>{phase.horizon}</span><b>≈ {Number(phase.estimatedTotalEuro || 0).toLocaleString('es-ES')} €</b></header><h3>{phase.name}</h3><strong>{phase.objective}</strong><p>{phase.rationale}</p><div className="thv-project-parts">{phase.parts.map((part) => <div key={part.name}><header><span>{part.category}</span><b>{Number(part.estimatedCostEuro || 0).toLocaleString('es-ES')} €</b></header><h4>{part.name}</h4><p>{part.benefit}</p><dl><div><dt>Por qué</dt><dd>{part.rationale}</dd></div><div><dt>Compatibilidad</dt><dd>{part.compatibility}</dd></div><div><dt>Legalidad</dt><dd>{part.legalImpact}</dd></div></dl></div>)}</div><footer><small>Resultado esperado</small><strong>{phase.expectedResult}</strong><small>Antes de empezar</small><ul>{phase.prerequisites.map((item)=><li key={item}>{item}</li>)}</ul></footer></article>)}</div></section> : null}
      {plan.modifications?.project ? <div className="thv-project-specials"><section><span>Reprogramación</span><h2>{plan.modifications.project.reprogramming.recommendation}</h2><b>{plan.modifications.project.reprogramming.expectedGain}</b><p>{plan.modifications.project.reprogramming.rationale}</p><ul>{plan.modifications.project.reprogramming.prerequisites.map((item)=><li key={item}>{item}</li>)}</ul></section><section><span>Dirección estética</span><h2>{plan.modifications.project.aesthetics.concept}</h2><p>{plan.modifications.project.aesthetics.rationale}</p><ul>{plan.modifications.project.aesthetics.changes.map((item)=><li key={item}>{item}</li>)}</ul></section></div> : null}
      <section className="thv-mod-group"><header><span>Acciones técnicas inmediatas</span><b>Según tu estado actual</b></header><ActionCards actions={[...(plan.modifications?.block || []),...(plan.modifications?.chassis || []),...(plan.modifications?.aesthetics || [])]} /></section>
      {plan.modifications?.faqs?.length ? <section className="thv-faq"><header><span>Preguntas frecuentes</span><h2>Antes de tomar una decisión grande</h2><p>Turbo, swaps y compatibilidades explicados para tu vehículo, no de forma genérica.</p></header><div>{plan.modifications.faqs.map((faq,index)=><details key={`${faq.question}-${index}`} open={index===0}><summary><i>{String(index+1).padStart(2,'0')}</i><strong>{faq.question}</strong><span>+</span></summary><div><p>{faq.answer}</p><h4>Por qué</h4><p>{faq.rationale}</p><small>Qué debes comprobar: {faq.verification}</small></div></details>)}</div></section> : null}
    </> : null}
    {section === 'risks' ? <div className="thv-risk-list">{(plan.risks || []).map((risk,index) => <article key={`${risk.title}-${index}`}><header><i>!</i><PriorityBadge value={risk.severity} /></header><h2>{risk.title}</h2><dl><div><dt>Causa</dt><dd>{risk.cause}</dd></div><div><dt>Consecuencia</dt><dd>{risk.consequence}</dd></div><div><dt>Cómo prevenirlo</dt><dd>{risk.prevention}</dd></div></dl><footer>{risk.confidence}</footer></article>)}</div> : null}
    {section === 'legal' ? <><div className="thv-legal-notice"><i>i</i><p>Esta información es orientativa. La necesidad definitiva de homologación depende de la pieza, referencias, montaje y normativa aplicable.</p></div><div className="thv-legal-list">{(plan.legal || []).map((item,index) => <article key={`${item.modification}-${index}`}><header><span>Reforma {String(index + 1).padStart(2,'0')}</span><b>{item.confidence}</b></header><h2>{item.modification}</h2><p>{item.likelyRequirement}</p><div><strong>Documentación prevista</strong><ul>{item.documents.map((document) => <li key={document}>{document}</li>)}</ul></div><footer>{item.warning}</footer></article>)}</div></> : null}
  </div>;
}

function AdvisorChat({ vehicle, result, profile, plan }) {
  const [isOpen, setIsOpen] = useState(false);
  const [question, setQuestion] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [messages, setMessages] = useState([{ role: 'assistant', content: `Estoy siguiendo tu ${vehicle?.brand || 'vehículo'} ${vehicle?.model || ''}. Pregúntame sobre el siguiente paso, una pieza, un riesgo o una homologación.` }]);
  const suggestions = ['¿Qué debería hacer primero?', '¿Es segura mi configuración actual?', '¿Qué debo revisar antes de modificar?'];
  async function sendQuestion(text = question) {
    const cleanQuestion = text.trim();
    if (!cleanQuestion || isSending) return;
    const previousMessages = messages;
    setMessages([...previousMessages, { role: 'user', content: cleanQuestion }]);
    setQuestion(''); setIsSending(true);
    try {
      const answer = await askPremiumAdvisor({ vehicle, result, profile, plan, question: cleanQuestion, history: previousMessages });
      setMessages((current) => [...current, { role: 'assistant', content: answer }]);
    } catch {
      setMessages((current) => [...current, { role: 'assistant', content: 'No he podido responder ahora. Tu ficha y tu plan siguen guardados; inténtalo de nuevo en unos segundos.' }]);
    } finally { setIsSending(false); }
  }
  return <><button className="thv-chat-launcher" type="button" onClick={() => setIsOpen(true)}><i>IA</i><span><strong>Pregunta a tu asesor</strong><small>Resuelve una duda sobre tu proyecto</small></span></button>
    {isOpen ? <aside className="thv-chat-panel">
      <header><div><i>IA</i><span><strong>Tu asesor Tuning Hub</strong><small><b /> Conoce tu proyecto</small></span></div><button type="button" onClick={() => setIsOpen(false)}>×</button></header>
      <div className="thv-chat-context"><span>{vehicle?.brand} {vehicle?.model}</span><b>{OBJECTIVE_LABELS[profile.objective]}</b></div>
      <div className="thv-chat-messages">{messages.map((message,index) => <article key={index} className={`is-${message.role}`}><i>{message.role === 'assistant' ? 'IA' : 'Tú'}</i><p>{message.content}</p></article>)}{isSending ? <article className="is-assistant is-typing"><i>IA</i><p><b /><b /><b /></p></article> : null}</div>
      {messages.length === 1 ? <div className="thv-chat-suggestions">{suggestions.map((suggestion) => <button key={suggestion} type="button" onClick={() => sendQuestion(suggestion)}>{suggestion}</button>)}</div> : null}
      <form onSubmit={(event) => { event.preventDefault(); sendQuestion(); }}><input value={question} onChange={(event) => setQuestion(event.target.value)} placeholder="Escribe tu duda…" maxLength="1200" /><button type="submit" disabled={!question.trim() || isSending}>→</button></form>
      <footer>Las decisiones mecánicas y legales deben verificarse con un profesional.</footer>
    </aside> : null}</>;
}

function PremiumVehiclePortal({ vehicle, result, onBack }) {
  const storedProfile = useMemo(loadProfile, []);
  const [profile, setProfile] = useState(storedProfile || initialProfile);
  const [isConfigured, setIsConfigured] = useState(Boolean(storedProfile));
  const [isEditing, setIsEditing] = useState(false);
  const [advisorPlan, setAdvisorPlan] = useState(getStoredPremiumAdvisorPlan);
  const [advisorStatus, setAdvisorStatus] = useState(advisorPlan ? 'ready' : 'idle');
  const [activeSection, setActiveSection] = useState('vehicle');
  const brand = vehicle?.brand || result?.vehicleIdentity?.canonicalBrand || 'BMW';
  const model = vehicle?.model || result?.vehicleIdentity?.canonicalModel || '330Ci';
  const generation = vehicle?.generation || result?.vehicleIdentity?.canonicalGeneration || 'E46';
  const engine = vehicle?.engine || result?.vehicleIdentity?.canonicalEngine || 'M54B30 3.0 231 CV';
  const power = result?.basePowerCv || 231;
  const torque = result?.vehicleIdentity?.factoryTorqueNm || 300;
  const transmission = vehicle?.transmission === 'automatico' ? 'Automático' : 'Manual';
  const drivetrain = vehicle?.drivetrain === 'fwd' ? 'Delantera' : vehicle?.drivetrain === 'awd' ? 'Integral' : 'Trasera';
  const vehicleName = [brand, model, generation].filter(Boolean).join(' ');
  const vehicleImage = brand === 'BMW' && model === '330Ci' ? workshopImage : getVehicleImage(vehicle);
  const readiness = profile.condition === 'excelente' ? 86 : profile.condition === 'bueno' ? 72 : 46;

  function change(event) { const { name, value } = event.target; setProfile((current) => ({ ...current, [name]: value })); }
  function toggleModification(modification) {
    setProfile((current) => {
      if (modification === 'serie') return { ...current, modifications: ['serie'] };
      const withoutSeries = current.modifications.filter((item) => item !== 'serie');
      const modifications = withoutSeries.includes(modification) ? withoutSeries.filter((item) => item !== modification) : [...withoutSeries, modification];
      return { ...current, modifications: modifications.length ? modifications : ['serie'] };
    });
  }
  async function saveProfile(event) {
    event.preventDefault();
    if (!profile.mileageKm) return;
    window.localStorage.setItem(PROFILE_KEY, JSON.stringify(profile));
    setIsConfigured(true); setIsEditing(false); window.scrollTo({ top: 0, behavior: 'smooth' });
    setAdvisorStatus('working');
    try {
      const plan = await generatePremiumAdvisorPlan({ vehicle, result, profile });
      setAdvisorPlan(plan);
      setAdvisorStatus('ready');
    } catch {
      setAdvisorStatus('unavailable');
    }
  }

  if (!isConfigured || isEditing) return <section className="thv-intake">
    <header className="thv-intake-topbar"><button type="button" onClick={isEditing ? () => setIsEditing(false) : onBack}>← Volver</button><span>Tuning Hub Premium · Área Vehículo</span></header>
    <div className="thv-intake-layout">
      <aside style={{ '--vehicle-image': `url(${vehicleImage})` }}><div><span>Tu punto de partida</span><h1>{vehicleName}</h1><p>Cuanto mejor conozcamos el coche, más preciso será el acompañamiento durante el proyecto.</p></div></aside>
      <form onSubmit={saveProfile}>
        <div className="thv-form-heading"><span>Perfil del vehículo</span><h2>Vamos a conocer tu coche.</h2><p>Estos datos construirán la ficha viva de tu proyecto. Podrás corregirlos cuando quieras.</p></div>
        <div className="thv-form-row"><label><span>Kilometraje actual</span><div><input name="mileageKm" type="number" min="0" placeholder="148000" value={profile.mileageKm} onChange={change} required /><b>km</b></div></label><label><span>Año</span><input name="year" type="number" min="1950" max="2030" value={profile.year} onChange={change} /></label></div>
        <label className="thv-text-field"><span>Color</span><input name="color" value={profile.color} onChange={change} placeholder="Color del vehículo" /></label>
        <ChoiceGroup label="Uso principal" name="use" value={profile.use} options={USE_LABELS} onChange={change} />
        <ChoiceGroup label="Estado actual" name="condition" value={profile.condition} options={CONDITION_LABELS} onChange={change} />
        <div className="thv-form-divider"><span>Historial del vehículo</span><p>Nos ayuda a detectar incertidumbres antes de recomendar cualquier cambio.</p></div>
        <ChoiceGroup label="Historial de mantenimiento" name="maintenanceHistory" value={profile.maintenanceHistory} options={MAINTENANCE_HISTORY_LABELS} onChange={change} />
        <ChoiceGroup label="Averías y accidentes anteriores" name="incidentHistory" value={profile.incidentHistory} options={INCIDENT_HISTORY_LABELS} onChange={change} />
        <div className="thv-form-divider"><span>Configuración actual</span><p>Indica todo lo que ya está instalado en el vehículo.</p></div>
        <ModificationGroup value={profile.modifications} onChange={toggleModification} />
        <ChoiceGroup label="Objetivo principal" name="objective" value={profile.objective} options={OBJECTIVE_LABELS} onChange={change} />
        <button className="thv-primary-button" type="submit">{isEditing ? 'Guardar cambios' : 'Crear ficha del vehículo'} <span>→</span></button>
      </form>
    </div>
  </section>;

  return <section className="thv-shell">
    <aside className="thv-sidebar">
      <button className="thv-brand" type="button" onClick={onBack}><i>TH</i><span><strong>Tuning Hub</strong><small>Premium</small></span></button>
      <nav aria-label="Áreas del plan Premium">{NAV_ITEMS.map(([id, label, icon]) => <button key={id} type="button" className={id === activeSection ? 'is-active' : ''} disabled={id !== 'vehicle' && !advisorPlan} onClick={() => setActiveSection(id)}><i>{icon}</i><span>{label}</span>{id !== 'vehicle' && !advisorPlan ? <small>Necesita análisis</small> : null}</button>)}</nav>
      <div className={`thv-companion is-${advisorStatus}`}><i>●</i><div><strong>Asesor IA Premium</strong><span>{advisorStatus === 'working' ? 'Analizando tu proyecto…' : advisorStatus === 'ready' ? 'Plan personalizado preparado' : advisorStatus === 'unavailable' ? 'Pendiente de conexión' : 'Listo para analizar'}</span></div></div>
    </aside>
    <main className="thv-main">
      <header className="thv-mobile-header"><button type="button" onClick={onBack}>TH</button><strong>{NAV_ITEMS.find(([id]) => id === activeSection)?.[1]}</strong><span>Premium</span></header>
      {activeSection === 'vehicle' ? <>
      <section className="thv-hero" style={{ '--vehicle-image': `url(${vehicleImage})` }}>
        <div className="thv-hero-copy"><span>Mi vehículo · {profile.year}</span><h1>{brand} <strong>{model}</strong></h1><p>{generation} · {engine}</p><div><b>{OBJECTIVE_LABELS[profile.objective]}</b><em>Seguimiento activo</em></div></div>
        <div className="thv-hero-status"><span>Preparación del proyecto</span><strong>{readiness}<small>/100</small></strong><p>{readiness >= 70 ? 'Buena base para empezar' : 'Revisión inicial recomendada'}</p></div>
      </section>
      <section className="thv-context-bar">
        <div><i>01</i><span><small>Estado actual</small><strong>{CONDITION_LABELS[profile.condition]}</strong></span></div><div><i>02</i><span><small>Uso principal</small><strong>{USE_LABELS[profile.use]}</strong></span></div><div><i>03</i><span><small>Objetivo</small><strong>{OBJECTIVE_LABELS[profile.objective]}</strong></span></div><button type="button" onClick={() => setIsEditing(true)}>Editar perfil</button>
      </section>
      <div className="thv-dashboard">
        {advisorPlan ? <section className="thv-card thv-advisor-result">
          <header><div><span>Asesor IA Premium</span><h2>Análisis personalizado</h2></div><b>Plan actualizado</b></header>
          <p>{advisorPlan.advisorSummary}</p>
          <div className="thv-advisor-next"><i>→</i><span><small>Siguiente paso recomendado</small><strong>{advisorPlan.immediateNextStep}</strong></span></div>
          <footer><span><b>{advisorPlan.maintenance?.actions?.length || 0}</b> acciones de mantenimiento</span><span><b>{advisorPlan.risks?.length || 0}</b> riesgos detectados</span><span><b>{advisorPlan.legal?.length || 0}</b> puntos legales</span></footer>
        </section> : null}
        <section className="thv-card thv-identity"><header><div><span>Ficha técnica</span><h2>Identidad del vehículo</h2></div><b>Datos verificados</b></header><dl>
          <div><dt>Marca</dt><dd>{brand}</dd></div><div><dt>Modelo</dt><dd>{model}</dd></div><div><dt>Generación</dt><dd>{generation}</dd></div><div><dt>Año</dt><dd>{profile.year}</dd></div><div><dt>Motor</dt><dd>{engine}</dd></div><div><dt>Potencia de origen</dt><dd>{power} CV</dd></div><div><dt>Par de origen</dt><dd>{torque} Nm</dd></div><div><dt>Transmisión</dt><dd>{transmission}</dd></div><div><dt>Tracción</dt><dd>{drivetrain}</dd></div><div><dt>Color</dt><dd>{profile.color || 'Sin indicar'}</dd></div>
        </dl></section>
        <section className="thv-card thv-next-step"><span>Tu próxima decisión</span><i>→</i><h2>{advisorPlan?.immediateNextStep || 'Completar la línea base del vehículo'}</h2><p>{advisorPlan ? 'Este paso tiene prioridad porque condiciona la seguridad, la compatibilidad y el orden del resto del proyecto.' : 'Completa el análisis para recibir una recomendación específica.'}</p><ul>{(advisorPlan?.questionsToResolve || ['Registrar mantenimiento reciente','Añadir modificaciones instaladas','Documentar averías anteriores']).slice(0,3).map((item) => <li key={item}>{item}</li>)}</ul><small>Actualizado según tu ficha y objetivo</small></section>
        <section className="thv-card thv-health"><header><div><span>Conocimiento del proyecto</span><h2>Calidad de la información</h2></div><strong>{profile.maintenanceHistory === 'completo' ? '92%' : '78%'}</strong></header><div className="thv-progress"><i style={{ width: profile.maintenanceHistory === 'completo' ? '92%' : '78%' }} /></div><div className="thv-health-list"><p className="is-done"><i>✓</i><span>Identificación y motorización</span><b>Completo</b></p><p className="is-done"><i>✓</i><span>Kilometraje y uso</span><b>Completo</b></p><p className={profile.maintenanceHistory === 'completo' ? 'is-done' : ''}><i>{profile.maintenanceHistory === 'completo' ? '✓' : '!'}</i><span>Historial: {MAINTENANCE_HISTORY_LABELS[profile.maintenanceHistory]}</span><b>{profile.maintenanceHistory === 'completo' ? 'Completo' : 'Mejorable'}</b></p><p className="is-done"><i>✓</i><span>{profile.modifications.includes('serie') ? 'Vehículo de serie' : `${profile.modifications.length} tipos de modificación`}</span><b>Registrado</b></p></div></section>
        <section className="thv-card thv-mileage"><span>Kilometraje registrado</span><strong>{Number(profile.mileageKm).toLocaleString('es-ES')} <small>km</small></strong><p>Será la referencia para calcular mantenimientos, desgaste y riesgos específicos.</p><div><span>Última actualización</span><b>Hoy</b></div></section>
      </div>
      </> : advisorPlan ? <AdvisorSection section={activeSection} plan={advisorPlan} /> : null}
    </main>
    <nav className="thv-bottom-nav" aria-label="Áreas Premium">{NAV_ITEMS.map(([id, label, icon]) => <button key={id} className={id === activeSection ? 'is-active' : ''} disabled={id !== 'vehicle' && !advisorPlan} onClick={() => setActiveSection(id)}><i>{icon}</i><span>{label.split(' ')[0]}</span></button>)}</nav>
    {advisorPlan ? <AdvisorChat vehicle={vehicle} result={result} profile={profile} plan={advisorPlan} /> : null}
  </section>;
}

export default PremiumVehiclePortal;
