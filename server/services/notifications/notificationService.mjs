import { createHash } from 'node:crypto';

export const NOTIFICATION_CATEGORIES = ['maintenance', 'research', 'diagnostics', 'vehicle_alerts'];
export const NOTIFICATION_CHANNELS = ['in_app', 'push', 'email'];
export const MAX_DELIVERY_ATTEMPTS = 3;
const DAY_MS = 86_400_000;

export function defaultNotificationPreferences(timezone = 'Atlantic/Canary') {
  validateTimezone(timezone);
  return { timezone, categories: { maintenance: true, research: true, diagnostics: true, vehicle_alerts: true }, channels: { in_app: true, push: false, email: false } };
}

export function calculateMaintenanceNotifications({ task, currentMileageKm, now }) {
  const events = [];
  const daysRemaining = task.nextDueAt ? Math.ceil((new Date(task.nextDueAt).getTime() - now.getTime()) / DAY_MS) : undefined;
  const kmRemaining = Number.isFinite(task.nextDueMileageKm) && Number.isFinite(currentMileageKm) ? task.nextDueMileageKm - currentMileageKm : undefined;
  const overdue = (daysRemaining !== undefined && daysRemaining < 0) || (kmRemaining !== undefined && kmRemaining < 0);
  if (overdue) return [maintenanceEvent('maintenance_overdue', task, dueMarker(task), 'Mantenimiento pendiente', 'Tienes una tarea de mantenimiento pendiente. Abre tu garaje para consultar los detalles.')];
  const dateWindow = Math.max(30, Math.round(Number(task.intervalMonths || 0) * 30 * 0.1));
  const mileageWindow = Math.max(1_000, Math.round(Number(task.intervalKm || 0) * 0.1));
  if (task.reminder?.byTime && daysRemaining !== undefined && daysRemaining <= dateWindow) events.push(maintenanceEvent('maintenance_date_upcoming', task, dateMarker(task.nextDueAt), 'Mantenimiento próximo', 'Se acerca una tarea de mantenimiento por fecha. Consulta tu garaje para ver la información privada.'));
  if (task.reminder?.byMileage && kmRemaining !== undefined && kmRemaining <= mileageWindow) events.push(maintenanceEvent('maintenance_mileage_upcoming', task, `km:${String(task.nextDueMileageKm)}`, 'Mantenimiento próximo', 'Se acerca una tarea de mantenimiento por kilometraje. Consulta tu garaje para ver la información privada.'));
  return events;
}

export function createNotificationEvent({ ownerId, category, type, relatedEntityType, relatedEntityId, occurrenceKey, deepLink }) {
  if (!NOTIFICATION_CATEGORIES.includes(category)) throw new TypeError('Categoría de notificación no válida.');
  const safeOwnerId = safeId(ownerId); const safeEntityId = safeId(relatedEntityId); const safeOccurrence = String(occurrenceKey || '').trim();
  if (!safeOccurrence || safeOccurrence.length > 300) throw new TypeError('La notificación necesita una clave de ocurrencia válida.');
  const copy = notificationCopy(type);
  return { ownerId: safeOwnerId, category, type, title: copy.title, body: copy.body, relatedEntityType: String(relatedEntityType || '').slice(0, 80), relatedEntityId: safeEntityId, occurrenceKey: safeOccurrence, ...(deepLink ? { deepLink: String(deepLink).slice(0, 500) } : {}) };
}

export function notificationDeduplicationKey(event, channel) {
  if (!NOTIFICATION_CHANNELS.includes(channel)) throw new TypeError('Canal no válido.');
  return createHash('sha256').update([event.ownerId, event.type, event.relatedEntityType, event.relatedEntityId, event.occurrenceKey, channel].join('|')).digest('hex');
}

export function isWithinQuietHours(now, timezone, quietHours) {
  if (!quietHours) return false; validateTimezone(timezone);
  const parts = new Intl.DateTimeFormat('en-GB', { timeZone: timezone, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(now);
  const hour = Number(parts.find((part) => part.type === 'hour')?.value); const minute = Number(parts.find((part) => part.type === 'minute')?.value);
  const current = hour * 60 + minute; const start = parseClock(quietHours.start); const end = parseClock(quietHours.end);
  return start === end || (start < end ? current >= start && current < end : current >= start || current < end);
}

export function nextAllowedDeliveryAt(now, timezone, quietHours) {
  if (!isWithinQuietHours(now, timezone, quietHours)) return now;
  for (let minutes = 15; minutes <= 24 * 60; minutes += 15) { const candidate = new Date(now.getTime() + minutes * 60_000); if (!isWithinQuietHours(candidate, timezone, quietHours)) return candidate; }
  return new Date(now.getTime() + DAY_MS);
}

export async function enqueueNotification({ db, event, now = new Date() }) {
  const baseKey = notificationDeduplicationKey(event, 'in_app').slice(0, 48); const reference = db.collection('notificationJobs').doc(baseKey);
  let duplicate = false;
  await db.runTransaction(async (transaction) => { const snapshot = await transaction.get(reference); if (snapshot.exists) { duplicate = true; return; } transaction.create(reference, { ...event, status: 'queued', attemptCount: 0, nextAttemptAt: now, schemaVersion: 1, createdAt: now, updatedAt: now }); });
  return { id: reference.id, duplicate };
}

export async function processNotificationJobs({ db, adapters = {}, now = new Date(), limit = 100 }) {
  const snapshot = await db.collection('notificationJobs').where('status', 'in', ['queued', 'retry']).limit(Math.min(Math.max(limit, 1), 200)).get();
  const results = [];
  for (const document of snapshot.docs) {
    const job = { id: document.id, ...document.data() }; const nextAttemptAt = toDate(job.nextAttemptAt);
    if (nextAttemptAt && nextAttemptAt > now) continue;
    results.push(await deliverJob({ db, job, adapters, now }));
  }
  return results;
}

export function createInAppNotificationAdapter(db) {
  return { id: 'in_app', async send({ event, notificationId, now }) { await db.collection('users').doc(event.ownerId).collection('notifications').doc(notificationId).set({ id: notificationId, ownerId: event.ownerId, category: event.category, type: event.type, title: event.title, body: event.body, deepLink: event.deepLink || null, relatedEntityType: event.relatedEntityType, relatedEntityId: event.relatedEntityId, schemaVersion: 1, createdAt: now, updatedAt: now }, { merge: true }); return { providerMessageId: notificationId }; } };
}

export function createUnavailableChannelAdapter(channel) { return { id: channel, available: false, async send() { throw channelError('provider_unavailable', `El proveedor ${channel} no está configurado.`); } }; }

export async function scanMaintenanceReminders({ db, now = new Date(), limit = 300 }) {
  const snapshot = await db.collectionGroup('maintenanceTasks').limit(Math.min(Math.max(limit, 1), 500)).get(); const vehicleCache = new Map(); const results = [];
  for (const document of snapshot.docs) {
    const task = document.data(); if (!task.ownerId || !task.userVehicleId) continue;
    let vehicle = vehicleCache.get(task.userVehicleId); if (!vehicle) { const vehicleSnapshot = await db.collection('userVehicles').doc(task.userVehicleId).get(); vehicle = vehicleSnapshot.exists ? vehicleSnapshot.data() : null; vehicleCache.set(task.userVehicleId, vehicle); }
    if (!vehicle || vehicle.ownerId !== task.ownerId) continue;
    for (const event of calculateMaintenanceNotifications({ task, currentMileageKm: vehicle.mileageKm, now })) results.push(await enqueueNotification({ db, event, now }));
  }
  return results;
}

async function deliverJob({ db, job, adapters, now }) {
  const profileSnapshot = await db.collection('users').doc(job.ownerId).get(); const preferenceSnapshot = await db.collection('users').doc(job.ownerId).collection('notificationPreferences').doc('default').get();
  const timezone = preferenceSnapshot.data()?.timezone || profileSnapshot.data()?.timezone || 'Atlantic/Canary'; const preferences = { ...defaultNotificationPreferences(timezone), ...preferenceSnapshot.data() };
  if (preferences.categories?.[job.category] === false) { await finishJob(db, job.id, 'skipped', now, { skipReason: 'category_disabled' }); return { id: job.id, status: 'skipped' }; }
  const allowedAt = nextAllowedDeliveryAt(now, timezone, preferences.quietHours); if (allowedAt > now) { await db.collection('notificationJobs').doc(job.id).set({ status: 'retry', nextAttemptAt: allowedAt, updatedAt: now }, { merge: true }); return { id: job.id, status: 'quiet_hours' }; }
  const event = job; const enabledChannels = NOTIFICATION_CHANNELS.filter((channel) => preferences.channels?.[channel] === true); const deliveries = [];
  for (const channel of enabledChannels) {
    const adapter = channel === 'in_app' ? createInAppNotificationAdapter(db) : adapters[channel] || createUnavailableChannelAdapter(channel);
    deliveries.push(await deliverChannel({ db, event, job, channel, adapter, now }));
  }
  const retryable = deliveries.some((item) => item.status === 'retry'); const failed = deliveries.some((item) => item.status === 'failed');
  await finishJob(db, job.id, retryable ? 'retry' : failed ? 'failed' : 'sent', now, retryable ? { attemptCount: Number(job.attemptCount || 0) + 1, nextAttemptAt: retryAt(now, Number(job.attemptCount || 0) + 1) } : {});
  return { id: job.id, status: retryable ? 'retry' : failed ? 'failed' : 'sent', deliveries };
}

async function deliverChannel({ db, event, job, channel, adapter, now }) {
  const key = notificationDeduplicationKey(event, channel); const reference = db.collection('notificationDeliveries').doc(key); const snapshot = await reference.get();
  if (snapshot.exists && ['sent', 'skipped'].includes(snapshot.data()?.status)) return { channel, status: 'duplicate' };
  if (adapter.available === false) { await reference.set(deliveryRecord(job, channel, key, 'skipped', now, { lastErrorCode: 'provider_unavailable' }), { merge: true }); return { channel, status: 'skipped' }; }
  const attemptCount = Number(snapshot.data()?.attemptCount || 0) + 1;
  try { const output = await adapter.send({ event, notificationId: job.id, now }); await reference.set(deliveryRecord(job, channel, key, 'sent', now, { attemptCount, sentAt: now, providerMessageId: output?.providerMessageId || null }), { merge: true }); return { channel, status: 'sent' }; }
  catch (error) { const status = attemptCount < MAX_DELIVERY_ATTEMPTS ? 'retry' : 'failed'; await reference.set(deliveryRecord(job, channel, key, status, now, { attemptCount, nextAttemptAt: status === 'retry' ? retryAt(now, attemptCount) : null, lastErrorCode: String(error.code || 'delivery_failed').slice(0, 100) }), { merge: true }); return { channel, status }; }
}

function maintenanceEvent(type, task, occurrenceKey, title, body) { return { ownerId: task.ownerId, category: 'maintenance', type, title, body, relatedEntityType: 'maintenance_task', relatedEntityId: task.id, occurrenceKey, deepLink: `/premium/garage/${task.userVehicleId}/maintenance` }; }
function notificationCopy(type) { const copy = { vehicle_research_completed: ['Tu vehículo está listo', 'La investigación de tu vehículo ha avanzado. Consulta el garaje para ver la información validada.'], diagnostic_available: ['Resultado disponible', 'Hay una actualización privada disponible en tu garaje.'], important_vehicle_alert: ['Aviso importante en tu garaje', 'Tienes un aviso importante relacionado con tu vehículo. Abre Tuning Hub para revisarlo.'] }[type]; if (!copy) throw new TypeError('Tipo de notificación no válido.'); return { title: copy[0], body: copy[1] }; }
function dueMarker(task) { return `${dateMarker(task.nextDueAt)}:${Number.isFinite(task.nextDueMileageKm) ? String(task.nextDueMileageKm) : 'no-km'}`; }
function dateMarker(value) { return value ? `date:${new Date(value).toISOString().slice(0, 10)}` : 'no-date'; }
function deliveryRecord(job, channel, key, status, now, extra = {}) { return { ownerId: job.ownerId, notificationId: job.id, channel, deduplicationKey: key, status, attemptCount: 0, schemaVersion: 1, createdAt: now, updatedAt: now, ...extra }; }
async function finishJob(db, id, status, now, extra = {}) { await db.collection('notificationJobs').doc(id).set({ status, completedAt: ['sent', 'failed', 'skipped'].includes(status) ? now : null, updatedAt: now, ...extra }, { merge: true }); }
function retryAt(now, attempt) { return new Date(now.getTime() + Math.min(60, 5 * 2 ** Math.max(attempt - 1, 0)) * 60_000); }
function parseClock(value) { if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(String(value))) throw new TypeError('Horario silencioso no válido.'); const [hour, minute] = value.split(':').map(Number); return hour * 60 + minute; }
function validateTimezone(value) { try { new Intl.DateTimeFormat('en', { timeZone: value }).format(); } catch { throw new TypeError('Zona horaria no válida.'); } }
function safeId(value) { const result = String(value || '').trim(); if (!result || result.includes('/') || result.length > 180) throw new TypeError('Identificador no válido.'); return result; }
function toDate(value) { if (!value) return null; return typeof value.toDate === 'function' ? value.toDate() : new Date(value); }
function channelError(code, message) { const error = new Error(message); error.code = code; return error; }
