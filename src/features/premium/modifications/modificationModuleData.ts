import { collection, doc, getDoc, getDocs, limit, query, where, type Firestore } from 'firebase/firestore';
import { z } from 'zod';
import type { InstalledModification, ModificationDefinition, ProjectGoal, UserVehicle, VehicleMaster } from '../models';
import { createFirestoreConverter, decodeFirestoreValue } from '../firestore/firestoreCodec';
import { premiumCollections } from '../firestore/premiumCollections';
import { modificationDefinitionSchema } from '../schemas/premiumSchemas';
import { createPremiumRepositories, createUserVehicleRepositories } from '../repositories/premiumRepositories';
import { calculateModificationRoute, type ModificationRouteResult } from './modificationRoute';

const projectContextSchema = z.object({
  ownerId: z.string().min(1),
  onboardingSnapshot: z.object({
    history: z.object({ majorAccidents: z.boolean(), seriousBreakdowns: z.boolean(), engineReplaced: z.boolean(), transmissionReplaced: z.boolean(), context: z.string() }).loose(),
    modifications: z.object({ hasModifications: z.boolean(), categories: z.array(z.string()), other: z.string() }).loose(),
    use: z.string(),
    aesthetic: z.object({ requested: z.boolean(), style: z.string() }).loose(),
  }).loose(),
}).loose();

export interface ModificationPersonalContext {
  seriousHistory: boolean;
  historySummary?: string;
  declaredModificationCategories: string[];
  declaredOtherModifications?: string;
  use: string;
  wantsAestheticRecommendations: boolean;
  aestheticStyle?: string;
}

export interface ModificationModuleData {
  vehicle: UserVehicle;
  master: VehicleMaster | null;
  goal: ProjectGoal;
  installed: InstalledModification[];
  context: ModificationPersonalContext;
  route: ModificationRouteResult;
}

export async function loadModificationModuleData(firestore: Firestore, ownerId: string): Promise<ModificationModuleData | null> {
  const premium = createPremiumRepositories(firestore);
  const vehicle = await premium.userVehicles.getLatestByOwner(ownerId);
  if (!vehicle) return null;
  const repositories = createUserVehicleRepositories(firestore, vehicle.id);
  const [rawMaster, goals, installed, definitions, projectContext] = await Promise.all([
    vehicle.variantId ? premium.vehicleMasters.getById(vehicle.variantId) : Promise.resolve(null), repositories.projectGoals.list(50), repositories.installedModifications.list(200),
    listApprovedDefinitions(firestore, vehicle.variantId), loadProjectContext(firestore, vehicle.activeProjectId, ownerId),
  ]);
  const goal = goals.find((item) => item.id === vehicle.currentGoalId) ?? goals.find((item) => item.status === 'active');
  if (!goal) return null;
  const master = rawMaster && ['approved', 'published'].includes(rawMaster.provenance.reviewStatus) && ['high', 'verified'].includes(rawMaster.provenance.confidence.level) ? rawMaster : null;
  return { vehicle, master, goal, installed, context: projectContext, route: calculateModificationRoute(definitions, installed, goal, vehicle, master) };
}

export async function markModificationInstalled(firestore: Firestore, data: ModificationModuleData, definition: ModificationDefinition): Promise<void> {
  const now = new Date();
  const repositories = createUserVehicleRepositories(firestore, data.vehicle.id);
  const existing = data.installed.find((item) => item.modificationId === definition.id);
  await repositories.installedModifications.save({
    id: existing?.id ?? `definition-${definition.id}`, schemaVersion: 1, createdAt: existing?.createdAt ?? now, updatedAt: now,
    ownerId: data.vehicle.ownerId, userVehicleId: data.vehicle.id, modificationId: definition.id, installedAt: now, mileageKm: data.vehicle.mileageKm,
    tuneRequired: definition.category === 'ecu', homologationStatus: 'unknown', documentMediaIds: [], compatibilityStatus: 'confirmed',
    confidence: { level: 'high', rationale: 'Definición aprobada para la variante; instalación declarada por el usuario.', assessedBy: 'system', assessedAt: now },
    reviewStatus: 'draft', active: true,
  });
}

export async function updateModificationGoal(firestore: Firestore, goal: ProjectGoal, type: ProjectGoal['type']): Promise<void> {
  const repositories = createUserVehicleRepositories(firestore, goal.userVehicleId);
  await repositories.projectGoals.save({ ...goal, type, title: goalLabel(type), feasibility: 'pending_evaluation', updatedAt: new Date() });
}

async function listApprovedDefinitions(firestore: Firestore, variantId: string | undefined): Promise<ModificationDefinition[]> {
  if (!variantId) return [];
  const reference = collection(firestore, premiumCollections.modificationDefinitions).withConverter(createFirestoreConverter(modificationDefinitionSchema));
  const snapshot = await getDocs(query(reference, where('compatibleVariantIds', 'array-contains', variantId), where('provenance.reviewStatus', 'in', ['approved', 'published']), limit(100)));
  return snapshot.docs.map((document) => document.data());
}

async function loadProjectContext(firestore: Firestore, projectId: string | undefined, ownerId: string): Promise<ModificationPersonalContext> {
  if (!projectId) return { seriousHistory: false, declaredModificationCategories: [], use: 'unknown', wantsAestheticRecommendations: false };
  const snapshot = await getDoc(doc(firestore, 'premiumProjects', projectId));
  if (!snapshot.exists()) return { seriousHistory: false, declaredModificationCategories: [], use: 'unknown', wantsAestheticRecommendations: false };
  const parsed = projectContextSchema.parse(decodeFirestoreValue(snapshot.data()));
  if (parsed.ownerId !== ownerId) throw new Error('Project ownership mismatch');
  const history = parsed.onboardingSnapshot.history; const aesthetic = parsed.onboardingSnapshot.aesthetic; const modifications = parsed.onboardingSnapshot.modifications;
  return {
    seriousHistory: history.majorAccidents || history.seriousBreakdowns || history.engineReplaced || history.transmissionReplaced,
    ...(history.context ? { historySummary: history.context } : {}), declaredModificationCategories: modifications.categories,
    ...(modifications.other ? { declaredOtherModifications: modifications.other } : {}), use: parsed.onboardingSnapshot.use,
    wantsAestheticRecommendations: aesthetic.requested, ...(aesthetic.style ? { aestheticStyle: aesthetic.style } : {}),
  };
}

function goalLabel(type: ProjectGoal['type']): string {
  return { reliability: 'Fiabilidad', street_performance: 'Prestaciones para calle', aesthetic: 'Proyecto estético', track: 'Preparación para circuito', custom: 'Objetivo personalizado' }[type];
}
