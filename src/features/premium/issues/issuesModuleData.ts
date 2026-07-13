import { collection, doc, getDoc, getDocs, limit, query, where, type Firestore } from 'firebase/firestore';
import { z } from 'zod';
import type { DiagnosticEvidence, DiagnosticSession, InstalledModification, UserVehicle, VehicleIssue, VehicleMaster } from '../models';
import { createFirestoreConverter, decodeFirestoreValue } from '../firestore/firestoreCodec';
import { premiumCollections } from '../firestore/premiumCollections';
import { vehicleIssueSchema } from '../schemas/premiumSchemas';
import { createDiagnosticEvidenceRepository, createPremiumRepositories, createUserVehicleRepositories } from '../repositories/premiumRepositories';
import type { DiagnosticVehicleContext } from './diagnosticProvider';

export interface IssuesModuleData {
  vehicleContext: DiagnosticVehicleContext;
  sessions: DiagnosticSession[];
  evidenceBySession: Record<string, DiagnosticEvidence[]>;
}

export async function loadIssuesModuleData(firestore: Firestore, ownerId: string): Promise<IssuesModuleData | null> {
  const premium = createPremiumRepositories(firestore);
  const vehicle = await premium.userVehicles.getLatestByOwner(ownerId);
  if (!vehicle) return null;
  const repositories = createUserVehicleRepositories(firestore, vehicle.id);
  const [rawMaster, installedModifications, sessions, knownIssues, declaredHistory] = await Promise.all([
    vehicle.variantId ? premium.vehicleMasters.getById(vehicle.variantId) : Promise.resolve(null), repositories.installedModifications.list(200), repositories.diagnosticSessions.list(100), listKnownIssues(firestore, vehicle),
    loadDeclaredHistory(firestore, vehicle.activeProjectId, ownerId),
  ]);
  const master = isTrustedMaster(rawMaster) ? rawMaster : null;
  const orderedSessions = sessions.sort((a, b) => b.startedAt.getTime() - a.startedAt.getTime());
  const evidenceEntries = await Promise.all(orderedSessions.map(async (session) => [session.id, await createDiagnosticEvidenceRepository(firestore, vehicle.id, session.id).list(100)] as const));
  return { vehicleContext: { vehicle, master, installedModifications, knownIssues, ...(declaredHistory ? { declaredHistory } : {}) }, sessions: orderedSessions, evidenceBySession: Object.fromEntries(evidenceEntries) };
}

async function listKnownIssues(firestore: Firestore, vehicle: UserVehicle): Promise<VehicleIssue[]> {
  if (!vehicle.variantId) return [];
  const reference = collection(firestore, premiumCollections.vehicleIssues).withConverter(createFirestoreConverter(vehicleIssueSchema));
  const snapshot = await getDocs(query(reference, where('applicableVariantIds', 'array-contains', vehicle.variantId), where('provenance.reviewStatus', 'in', ['approved', 'published']), limit(100)));
  return snapshot.docs.map((document) => document.data()).filter((issue) => ['high', 'verified'].includes(issue.provenance.confidence.level));
}

function isTrustedMaster(master: VehicleMaster | null): master is VehicleMaster {
  return master !== null && ['approved', 'published'].includes(master.provenance.reviewStatus) && ['high', 'verified'].includes(master.provenance.confidence.level);
}

export function activeInstalledModifications(items: InstalledModification[]): InstalledModification[] { return items.filter((item) => item.active); }

const historyDocumentSchema = z.object({ ownerId: z.string().min(1), onboardingSnapshot: z.object({ history: z.object({ majorAccidents: z.boolean(), seriousBreakdowns: z.boolean(), engineReplaced: z.boolean(), transmissionReplaced: z.boolean(), context: z.string() }).loose() }).loose() }).loose();

async function loadDeclaredHistory(firestore: Firestore, projectId: string | undefined, ownerId: string): Promise<DiagnosticVehicleContext['declaredHistory'] | undefined> {
  if (!projectId) return undefined;
  const snapshot = await getDoc(doc(firestore, 'premiumProjects', projectId)); if (!snapshot.exists()) return undefined;
  const parsed = historyDocumentSchema.parse(decodeFirestoreValue(snapshot.data())); if (parsed.ownerId !== ownerId) throw new Error('Project ownership mismatch');
  const history = parsed.onboardingSnapshot.history;
  return { majorAccidents: history.majorAccidents, seriousBreakdowns: history.seriousBreakdowns, engineReplaced: history.engineReplaced, transmissionReplaced: history.transmissionReplaced, ...(history.context ? { context: history.context } : {}) };
}
