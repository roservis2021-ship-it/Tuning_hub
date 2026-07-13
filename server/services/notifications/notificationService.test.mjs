import { describe, expect, it } from 'vitest';
import { calculateMaintenanceNotifications, createNotificationEvent, enqueueNotification, isWithinQuietHours, nextAllowedDeliveryAt, notificationDeduplicationKey } from './notificationService.mjs';

const task = { id: 'oil-service', ownerId: 'user-1', userVehicleId: 'vehicle-1', intervalKm: 10_000, intervalMonths: 12, nextDueAt: new Date('2026-08-01T00:00:00.000Z'), nextDueMileageKm: 20_000, reminder: { byTime: true, byMileage: true } };

describe('cálculo de recordatorios', () => {
  it('detecta proximidad por fecha y kilometraje de forma independiente', () => {
    const events = calculateMaintenanceNotifications({ task, currentMileageKm: 19_200, now: new Date('2026-07-13T00:00:00.000Z') });
    expect(events.map((event) => event.type)).toEqual(['maintenance_date_upcoming', 'maintenance_mileage_upcoming']);
  });

  it('prioriza un único aviso vencido si cualquier límite ha pasado', () => {
    const events = calculateMaintenanceNotifications({ task, currentMileageKm: 20_001, now: new Date('2026-07-13T00:00:00.000Z') });
    expect(events).toHaveLength(1); expect(events[0].type).toBe('maintenance_overdue');
  });

  it('respeta horas silenciosas en la zona horaria del usuario', () => {
    const now = new Date('2026-07-13T22:30:00.000Z');
    expect(isWithinQuietHours(now, 'Atlantic/Canary', { start: '22:00', end: '08:00' })).toBe(true);
    expect(nextAllowedDeliveryAt(now, 'Atlantic/Canary', { start: '22:00', end: '08:00' }).getTime()).toBeGreaterThan(now.getTime());
  });
});

describe('deduplicación', () => {
  it('produce la misma clave para la misma ocurrencia y otra para un nuevo vencimiento', () => {
    const base = createNotificationEvent({ ownerId: 'user-1', category: 'diagnostics', type: 'diagnostic_available', relatedEntityType: 'diagnostic_session', relatedEntityId: 'case-1', occurrenceKey: 'revision-1' });
    expect(notificationDeduplicationKey(base, 'in_app')).toBe(notificationDeduplicationKey({ ...base }, 'in_app'));
    expect(notificationDeduplicationKey(base, 'in_app')).not.toBe(notificationDeduplicationKey({ ...base, occurrenceKey: 'revision-2' }, 'in_app'));
  });

  it('crea un solo trabajo incluso si el evento se encola dos veces', async () => {
    const db = fakeDb(); const event = createNotificationEvent({ ownerId: 'user-1', category: 'research', type: 'vehicle_research_completed', relatedEntityType: 'vehicle_research', relatedEntityId: 'job-1', occurrenceKey: 'revision-1' });
    expect((await enqueueNotification({ db, event })).duplicate).toBe(false);
    expect((await enqueueNotification({ db, event })).duplicate).toBe(true);
  });
});

function fakeDb() {
  const records = new Map();
  function reference(path) { return { path, async get() { return { exists: records.has(path), data: () => records.get(path) }; } }; }
  return { collection(name) { return { doc(id) { return reference(`${name}/${id}`); } }; }, async runTransaction(work) { return work({ get: (ref) => ref.get(), create(ref, value) { if (records.has(ref.path)) throw new Error('already-exists'); records.set(ref.path, value); } }); } };
}
