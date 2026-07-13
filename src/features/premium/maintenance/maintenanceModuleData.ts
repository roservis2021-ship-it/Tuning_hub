import { collection, getDocs, query, where, type Firestore } from 'firebase/firestore';
import type { InstalledModification, MaintenanceDefinition, MaintenanceRecord, MaintenanceTask, UserVehicle } from '../models';
import { createPremiumRepositories, createUserVehicleRepositories } from '../repositories/premiumRepositories';
import { calculateMaintenanceStatus, completeMaintenanceTask, createTaskFromDefinition } from './maintenanceService';
import { createFirestoreConverter } from '../firestore/firestoreCodec';
import { maintenanceDefinitionSchema } from '../schemas/premiumSchemas';
import { premiumCollections } from '../firestore/premiumCollections';

export interface MaintenanceModuleData {
  vehicle: UserVehicle;
  tasks: MaintenanceTask[];
  history: MaintenanceRecord[];
  nextTask?: MaintenanceTask;
  overallStatus: MaintenanceTask['status'];
  approvedPlan: boolean;
}

function isApproved(definition: MaintenanceDefinition): boolean {
  return ['approved', 'published'].includes(definition.provenance.reviewStatus)
    && ['high', 'verified'].includes(definition.provenance.confidence.level);
}

function adaptationReasons(vehicle: UserVehicle, modifications: InstalledModification[], definition: MaintenanceDefinition): string[] {
  const reasons: string[] = [];
  if (['track', 'competition'].includes(vehicle.primaryUse)) reasons.push('Uso exigente declarado; revisar el intervalo con un especialista.');
  const installedIds = new Set(modifications.filter((item) => item.active).map((item) => item.modificationId).filter((id): id is string => Boolean(id)));
  if (definition.prerequisiteForModificationIds.some((id) => installedIds.has(id))) reasons.push('Tarea relacionada con una modificación instalada.');
  return reasons;
}

function statusPriority(status: MaintenanceTask['status']): number {
  return { urgent: 0, overdue: 1, upcoming: 2, insufficient_information: 3, up_to_date: 4 }[status];
}

export async function loadMaintenanceModuleData(firestore: Firestore, ownerId: string, now = new Date()): Promise<MaintenanceModuleData | null> {
  const premium = createPremiumRepositories(firestore);
  const vehicle = await premium.userVehicles.getLatestByOwner(ownerId);
  if (!vehicle) return null;
  const vehicleRepositories = createUserVehicleRepositories(firestore, vehicle.id);
  const [master, definitions, storedTasks, history, modifications] = await Promise.all([
    vehicle.variantId ? premium.vehicleMasters.getById(vehicle.variantId) : Promise.resolve(null),
    listApprovedDefinitions(firestore), vehicleRepositories.maintenanceTasks.list(200),
    vehicleRepositories.maintenanceRecords.list(200), vehicleRepositories.installedModifications.list(100),
  ]);
  const applicable = definitions.filter((definition) => isApproved(definition)
    && ((!definition.applicableVariantIds.length && !definition.applicableEngineIds.length)
      || (vehicle.variantId !== undefined && definition.applicableVariantIds.includes(vehicle.variantId))
      || (master?.engineId !== undefined && definition.applicableEngineIds.includes(master.engineId))));
  const tasksByDefinition = new Map(storedTasks.map((task) => [task.maintenanceDefinitionId, task]));
  const tasks = applicable.map((definition) => {
    const stored = tasksByDefinition.get(definition.id);
    const latestRecord = history.filter((record) => record.maintenanceDefinitionId === definition.id).sort((a, b) => b.performedAt.getTime() - a.performedAt.getTime())[0];
    const base = stored ?? createTaskFromDefinition(definition, vehicle, now, adaptationReasons(vehicle, modifications, definition));
    const existing = !stored && latestRecord?.mileageKm !== undefined
      ? completeMaintenanceTask(base, { performedAt: latestRecord.performedAt, mileageKm: latestRecord.mileageKm, notes: latestRecord.notes, reminderByTime: Boolean(base.intervalMonths), reminderByMileage: Boolean(base.intervalKm) }, now, 'derived').task
      : base;
    return { ...existing, status: calculateMaintenanceStatus({
      now, currentMileageKm: vehicle.mileageKm, nextDueAt: existing.nextDueAt, nextDueMileageKm: existing.nextDueMileageKm,
      intervalMonths: existing.intervalMonths, intervalKm: existing.intervalKm, severity: existing.severity,
    }) };
  }).sort((a, b) => statusPriority(a.status) - statusPriority(b.status));
  const overallStatus = tasks[0]?.status ?? 'insufficient_information';
  return {
    vehicle, tasks, history: history.sort((a, b) => b.performedAt.getTime() - a.performedAt.getTime()),
    ...(tasks[0] ? { nextTask: tasks[0] } : {}), overallStatus, approvedPlan: applicable.length > 0,
  };
}

async function listApprovedDefinitions(firestore: Firestore): Promise<MaintenanceDefinition[]> {
  const reference = collection(firestore, premiumCollections.maintenanceDefinitions).withConverter(createFirestoreConverter(maintenanceDefinitionSchema));
  const snapshot = await getDocs(query(reference, where('provenance.reviewStatus', 'in', ['approved', 'published'])));
  return snapshot.docs.map((document) => document.data());
}
