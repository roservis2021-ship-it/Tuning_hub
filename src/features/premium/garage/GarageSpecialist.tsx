import { useEffect, useState, type SyntheticEvent } from 'react';
import type { AIConversation, AIMessage, SpecialistReply } from '../models';
import { createConversation, listConversations, listMessages, sendSpecialistQuestion } from '../advisor/specialistService';
import type { GarageModuleId, GarageVehicleIdentity, GarageViewState } from './garageTypes';

const QUICK_SUGGESTIONS: Record<GarageModuleId, string[]> = {
  vehicle: ['¿Qué dato de mi ficha debería verificar primero?', 'Explícame los puntos débiles confirmados de mi vehículo.'],
  maintenance: ['¿Cuál es mi siguiente mantenimiento y por qué?', '¿Qué mantenimiento condiciona mi objetivo?'],
  modifications: ['¿Cuál es el siguiente paso de mi ruta?', '¿Qué requisito bloquea mi modificación actual?'],
  issues: ['Ayúdame a ordenar los síntomas registrados.', '¿Cuándo debería dejar de circular y acudir a un taller?'],
  advisor: ['¿Cuál es el próximo paso más útil de mi proyecto?', 'Resume las principales incertidumbres de mi garaje.'],
};

export function GarageSpecialist({ vehicle, state, activeModule, forceOpen = false, onClose }: { vehicle: GarageVehicleIdentity; state: GarageViewState; activeModule: GarageModuleId; forceOpen?: boolean; onClose?: () => void }) {
  const [open, setOpen] = useState(false); const [fullscreen, setFullscreen] = useState(false); const [conversations, setConversations] = useState<AIConversation[]>([]); const [conversationId, setConversationId] = useState<string | null>(null); const [messages, setMessages] = useState<AIMessage[]>([]); const [loading, setLoading] = useState(false); const [sending, setSending] = useState(false); const [error, setError] = useState<string | null>(null); const [remaining, setRemaining] = useState<number | null>(null); const [lastQuestion, setLastQuestion] = useState<string | null>(null);
  const visible = open || forceOpen; const vehicleId = vehicle.id;

  useEffect(() => {
    if (!visible || !vehicleId) return;
    let active = true;
    setLoading(true);
    listConversations(vehicleId).then(async (items) => {
      if (!active) return;
      const needsConversation = items.length === 0;
      const selected = needsConversation ? await createConversation(vehicleId) : requiredFirst(items);
      setConversations(needsConversation ? [selected] : items);
      setConversationId(selected.id);
      setMessages(await listMessages(vehicleId, selected.id));
      setError(null);
    }).catch((cause: unknown) => {
      if (active) setError(cause instanceof Error ? cause.message : 'No se pudo abrir el especialista.');
    }).finally(() => {
      if (active) setLoading(false);
    });
    return () => { active = false; };
  }, [visible, vehicleId]);

  async function selectConversation(id: string) { if (!vehicleId || id === conversationId) return; setLoading(true); setError(null); try { setConversationId(id); setMessages(await listMessages(vehicleId, id)); } catch (cause) { setError(cause instanceof Error ? cause.message : 'No se pudo cargar la conversación.'); } finally { setLoading(false); } }
  async function newConversation() { if (!vehicleId) return; setLoading(true); setError(null); try { const created = await createConversation(vehicleId); setConversations((items) => [created, ...items]); setConversationId(created.id); setMessages([]); } catch (cause) { setError(cause instanceof Error ? cause.message : 'No se pudo crear la conversación.'); } finally { setLoading(false); } }
  async function ask(question: string) { const normalized = question.trim(); if (!vehicleId || !conversationId || !normalized || sending) return; setSending(true); setError(null); setLastQuestion(normalized); const optimistic: AIMessage = { id: `pending-${String(Date.now())}`, schemaVersion: 1, createdAt: new Date(), updatedAt: new Date(), ownerId: 'current', role: 'user', content: normalized, module: activeModule }; setMessages((items) => [...items, optimistic]); try { const result = await sendSpecialistQuestion(vehicleId, conversationId, normalized, activeModule); setRemaining(result.remainingToday); setMessages(await listMessages(vehicleId, conversationId)); setConversations(await listConversations(vehicleId)); } catch (cause) { setMessages((items) => items.filter((item) => item.id !== optimistic.id)); setError(cause instanceof Error ? cause.message : 'El especialista no pudo responder.'); } finally { setSending(false); } }
  function close() { setOpen(false); setFullscreen(false); onClose?.(); }

  return <><button className="garage-specialist-fab" type="button" onClick={() => { setOpen(true); }} aria-label="Abrir especialista IA"><i>IA</i><span>Preguntar</span></button>{visible ? <aside className={`garage-specialist-panel${fullscreen ? ' garage-specialist-panel--fullscreen' : ''}`} aria-label="Especialista IA"><header><div><i>IA</i><span><strong>Especialista Tuning Hub</strong><small>{vehicle.brand} {vehicle.model} · contexto {activeModule}</small></span></div><nav><button type="button" onClick={() => { setFullscreen(!fullscreen); }} aria-label={fullscreen ? 'Reducir chat' : 'Abrir a pantalla completa'}>{fullscreen ? '↙' : '↗'}</button><button type="button" onClick={close} aria-label="Cerrar especialista">×</button></nav></header>
    <div className="specialist-conversation-bar"><select value={conversationId ?? ''} onChange={(event) => { void selectConversation(event.target.value); }} disabled={loading}>{conversations.map((conversation) => <option key={conversation.id} value={conversation.id}>{conversation.title}</option>)}</select><button type="button" onClick={() => { void newConversation(); }}>Nueva</button></div>
    <div className="garage-specialist-panel__body">{loading && !messages.length ? <p className="specialist-loading">Cargando contexto seguro…</p> : null}{!messages.length && !loading ? <article><i>IA</i><p>{state === 'ready' ? 'He conectado tu ficha, historial y proyecto. Pregunta por una decisión concreta o por el siguiente paso.' : 'Parte de la información sigue pendiente. Te indicaré qué falta antes de concluir.'}</p></article> : null}{messages.map((message) => <SpecialistMessage key={message.id} message={message} />)}{sending && <p className="specialist-loading">Contrastando el contexto del vehículo…</p>}</div>
    <div className="specialist-suggestions">{QUICK_SUGGESTIONS[activeModule].map((suggestion) => <button key={suggestion} type="button" disabled={sending} onClick={() => { void ask(suggestion); }}>{suggestion}</button>)}</div>
    {error && <div className="specialist-error"><span>{error}</span>{lastQuestion && <button type="button" disabled={sending} onClick={() => { void ask(lastQuestion); }}>Reintentar</button>}</div>}
    <SpecialistComposer disabled={!vehicleId || !conversationId || sending} remaining={remaining} onSubmit={ask} />
  </aside> : null}</>;
}

function SpecialistMessage({ message }: { message: AIMessage }) { const detail = message.structured; return <article className={`specialist-message specialist-message--${message.role}`}><i>{message.role === 'assistant' ? 'IA' : 'TÚ'}</i><div><p>{message.content}</p>{detail && <><small>Confianza: {confidenceLabel(detail.confidence)}{detail.uncertainty ? ` · ${detail.uncertainty}` : ''}</small>{detail.needsMoreData && detail.clarificationQuestions.length > 0 && <ul>{detail.clarificationQuestions.map((question) => <li key={question}>{question}</li>)}</ul>}<strong>Siguiente paso: {detail.nextStep}</strong>{detail.references.length > 0 && <footer>{detail.references.map((reference) => <span key={`${reference.type}-${reference.id}`}>{reference.label}</span>)}</footer>}</>}</div></article>; }
function SpecialistComposer({ disabled, remaining, onSubmit }: { disabled: boolean; remaining: number | null; onSubmit: (question: string) => Promise<void> }) { const [question, setQuestion] = useState(''); function submit(event: SyntheticEvent<HTMLFormElement, SubmitEvent>) { event.preventDefault(); const value = question.trim(); if (!value || disabled) return; setQuestion(''); void onSubmit(value); } return <form onSubmit={submit}><label htmlFor="garage-advisor-question">Tu consulta</label><div><input id="garage-advisor-question" value={question} onChange={(event) => { setQuestion(event.target.value); }} maxLength={1600} placeholder="Pregunta sobre tu vehículo o proyecto…" /><button type="submit" disabled={disabled || !question.trim()} aria-label="Enviar consulta">→</button></div><small>{remaining === null ? 'Las respuestas usan únicamente tu contexto Premium y datos aprobados.' : `${String(remaining)} consultas disponibles hoy.`}</small></form>; }
function confidenceLabel(value: SpecialistReply['confidence']) { return { unverified: 'no verificada', low: 'baja', medium: 'media', high: 'alta' }[value]; }
function requiredFirst(items: AIConversation[]): AIConversation { const first = items.at(0); if (first === undefined) throw new Error('No hay conversaciones disponibles.'); return first; }
