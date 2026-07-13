import { describe, expect, it } from 'vitest';
import type { MaintenanceTask } from '../models';
import { addMonthsClamped, calculateMaintenanceStatus, completeMaintenanceTask } from '../maintenance/maintenanceService';

const now = new Date('2026-07-12T10:00:00.000Z');
const task: MaintenanceTask = {
  id: 'task-1', schemaVersion: 1, createdAt: now, updatedAt: now, ownerId: 'user-1', userVehicleId: 'vehicle-1',
  maintenanceDefinitionId: 'definition-1', title: 'Approved service', intervalKm: 10_000, intervalMonths: 12, severity: 'important',
  status: 'upcoming', reminder: { byTime: true, byMileage: true }, recommendationStatus: 'approved_definition', adaptationReasons: [],
};

describe('maintenance scheduling', () => {
  it('clamps month calculations without overflowing short months', () => {
    expect(addMonthsClamped(new Date('2026-01-31T12:00:00.000Z'), 1).toISOString()).toBe('2026-02-28T12:00:00.000Z');
  });

  it('distinguishes every due state without requiring UI logic', () => {
    expect(calculateMaintenanceStatus({ now, severity: 'routine' })).toBe('insufficient_information');
    expect(calculateMaintenanceStatus({ now, severity: 'routine', currentMileageKm: 10_000, nextDueMileageKm: 20_000, intervalKm: 10_000 })).toBe('up_to_date');
    expect(calculateMaintenanceStatus({ now, severity: 'routine', currentMileageKm: 19_500, nextDueMileageKm: 20_000, intervalKm: 10_000 })).toBe('upcoming');
    expect(calculateMaintenanceStatus({ now, severity: 'important', currentMileageKm: 20_001, nextDueMileageKm: 20_000 })).toBe('overdue');
    expect(calculateMaintenanceStatus({ now, severity: 'critical', currentMileageKm: 20_001, nextDueMileageKm: 20_000 })).toBe('urgent');
  });

  it('creates history and calculates both next due values and reminders', () => {
    const result = completeMaintenanceTask(task, { performedAt: new Date('2026-07-10T12:00:00.000Z'), mileageKm: 50_000, notes: 'Completed', reminderByTime: true, reminderByMileage: true }, now, 'record-1');
    expect(result.record).toMatchObject({ id: 'record-1', mileageKm: 50_000, verificationStatus: 'user_declared' });
    expect(result.task).toMatchObject({ status: 'up_to_date', nextDueMileageKm: 60_000 });
    expect(result.task.nextDueAt?.toISOString()).toBe('2027-07-10T12:00:00.000Z');
    expect(result.task.reminder.nextReminderMileageKm).toBe(60_000);
    expect(result.task.reminder.nextReminderAt?.toISOString()).toBe('2027-07-10T12:00:00.000Z');
  });
});
