import { doc, runTransaction, type Firestore } from 'firebase/firestore';
import type { MaintenanceDefinition, MaintenanceRecord, MaintenanceTask, MaintenanceTaskStatus, UserVehicle } from '../models';
import { maintenanceRecordSchema, maintenanceTaskSchema } from '../schemas/premiumSchemas';
import { userVehicleSubcollectionPath } from '../firestore/premiumCollections';
import { encodeFirestoreDocument } from '../firestore/firestoreCodec';

const DAY_MS = 86_400_000;

export interface MaintenanceDueContext {
  now: Date;
  currentMileageKm?: number;
  nextDueAt?: Date;
  nextDueMileageKm?: number;
  intervalMonths?: number;
  intervalKm?: number;
  severity: MaintenanceTask['severity'];
}

export interface CompleteMaintenanceInput {
  performedAt: Date;
  mileageKm: number;
  notes?: string;
  reminderByTime: boolean;
  reminderByMileage: boolean;
}

export interface MaintenanceCompletion {
  record: MaintenanceRecord;
  task: MaintenanceTask;
}

export function addMonthsClamped(date: Date, months: number): Date {
  const result = new Date(date.getTime());
  const day = result.getUTCDate();
  result.setUTCDate(1);
  result.setUTCMonth(result.getUTCMonth() + months);
  const lastDay = new Date(Date.UTC(result.getUTCFullYear(), result.getUTCMonth() + 1, 0)).getUTCDate();
  result.setUTCDate(Math.min(day, lastDay));
  return result;
}

export function calculateMaintenanceStatus(context: MaintenanceDueContext): MaintenanceTaskStatus {
  const timeRemainingDays = context.nextDueAt ? Math.ceil((context.nextDueAt.getTime() - context.now.getTime()) / DAY_MS) : undefined;
  const distanceRemainingKm = context.nextDueMileageKm !== undefined && context.currentMileageKm !== undefined
    ? context.nextDueMileageKm - context.currentMileageKm : undefined;
  if (timeRemainingDays === undefined && distanceRemainingKm === undefined) return 'insufficient_information';
  const overdue = (timeRemainingDays !== undefined && timeRemainingDays < 0) || (distanceRemainingKm !== undefined && distanceRemainingKm < 0);
  if (overdue) return context.severity === 'critical' ? 'urgent' : 'overdue';
  const timeWindowDays = Math.max(30, Math.round(((context.intervalMonths ?? 0) * 30) * 0.1));
  const distanceWindowKm = Math.max(1_000, Math.round((context.intervalKm ?? 0) * 0.1));
  if ((timeRemainingDays !== undefined && timeRemainingDays <= timeWindowDays)
    || (distanceRemainingKm !== undefined && distanceRemainingKm <= distanceWindowKm)) return 'upcoming';
  return 'up_to_date';
}

export function createTaskFromDefinition(definition: MaintenanceDefinition, vehicle: UserVehicle, now: Date, adaptationReasons: string[]): MaintenanceTask {
  return maintenanceTaskSchema.parse({
    id: `definition-${definition.id}`, schemaVersion: 1, createdAt: now, updatedAt: now,
    ownerId: vehicle.ownerId, userVehicleId: vehicle.id, maintenanceDefinitionId: definition.id, title: definition.title,
    intervalKm: definition.intervalKm, intervalMonths: definition.intervalMonths, severity: definition.severity,
    status: 'insufficient_information', reminder: { byTime: true, byMileage: true },
    recommendationStatus: 'approved_definition', adaptationReasons,
  });
}

export function completeMaintenanceTask(task: MaintenanceTask, input: CompleteMaintenanceInput, now: Date, recordId: string): MaintenanceCompletion {
  const trimmedNotes = input.notes?.trim();
  const nextDueAt = task.intervalMonths ? addMonthsClamped(input.performedAt, task.intervalMonths) : undefined;
  const nextDueMileageKm = task.intervalKm ? input.mileageKm + task.intervalKm : undefined;
  const record = maintenanceRecordSchema.parse({
    id: recordId, schemaVersion: 1, createdAt: now, updatedAt: now, ownerId: task.ownerId, userVehicleId: task.userVehicleId,
    maintenanceDefinitionId: task.maintenanceDefinitionId, type: 'service', title: task.title, performedAt: input.performedAt,
    mileageKm: input.mileageKm, notes: trimmedNotes === '' ? undefined : trimmedNotes, parts: [], sourceMediaIds: [], verificationStatus: 'user_declared',
  });
  const updatedTask = maintenanceTaskSchema.parse({
    ...task, updatedAt: now, status: 'up_to_date', lastPerformedAt: input.performedAt, lastPerformedMileageKm: input.mileageKm,
    nextDueAt, nextDueMileageKm,
    reminder: {
      byTime: input.reminderByTime, byMileage: input.reminderByMileage,
      nextReminderAt: input.reminderByTime ? nextDueAt : undefined,
      nextReminderMileageKm: input.reminderByMileage ? nextDueMileageKm : undefined,
    },
  });
  return { record, task: updatedTask };
}

export async function persistMaintenanceCompletion(firestore: Firestore, task: MaintenanceTask, input: CompleteMaintenanceInput): Promise<MaintenanceCompletion> {
  const now = new Date();
  const recordId = `${task.id}-${String(now.getTime())}`;
  const completion = completeMaintenanceTask(task, input, now, recordId);
  const recordsPath = userVehicleSubcollectionPath(task.userVehicleId, 'maintenanceRecords');
  const tasksPath = userVehicleSubcollectionPath(task.userVehicleId, 'maintenanceTasks');
  await runTransaction(firestore, (transaction) => {
    transaction.set(doc(firestore, recordsPath, completion.record.id), encodeFirestoreDocument(completion.record));
    transaction.set(doc(firestore, tasksPath, completion.task.id), encodeFirestoreDocument(completion.task));
    return Promise.resolve();
  });
  return completion;
}
