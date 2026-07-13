import { deleteObject, ref, uploadBytes, type FirebaseStorage } from 'firebase/storage';
import type { Firestore } from 'firebase/firestore';
import type { DiagnosticContext, DiagnosticEvidence, DiagnosticSession } from '../models';
import { createDiagnosticEvidenceRepository, createUserVehicleRepositories } from '../repositories/premiumRepositories';
import type { DiagnosticAnalysisProvider, DiagnosticVehicleContext } from './diagnosticProvider';
import { notifyDiagnosticAvailable } from '../notifications/notificationClient';

const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
const MAX_AUDIO_BYTES = 20 * 1024 * 1024;
const ALLOWED_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);
const ALLOWED_AUDIO_TYPES = new Set(['audio/webm', 'audio/mpeg', 'audio/mp4', 'audio/wav', 'audio/ogg']);
const EXTENSIONS: Record<string, string[]> = { 'image/jpeg': ['jpg', 'jpeg'], 'image/png': ['png'], 'image/webp': ['webp'], 'audio/webm': ['webm'], 'audio/mpeg': ['mp3', 'mpeg'], 'audio/mp4': ['m4a', 'mp4'], 'audio/wav': ['wav'], 'audio/ogg': ['ogg', 'oga'] };

export interface DiagnosticFileInput { blob: Blob; name: string; type: 'image' | 'audio'; durationSeconds?: number; }
export interface CreateDiagnosticInput {
  symptoms: string;
  severityDeclared: DiagnosticSession['severityDeclared'];
  context: DiagnosticContext;
  files: DiagnosticFileInput[];
}

export async function createDiagnosticSession(firestore: Firestore, storage: FirebaseStorage, provider: DiagnosticAnalysisProvider, vehicleContext: DiagnosticVehicleContext, input: CreateDiagnosticInput): Promise<DiagnosticSession> {
  const now = new Date(); const sessionId = crypto.randomUUID();
  const sessions = createUserVehicleRepositories(firestore, vehicleContext.vehicle.id).diagnosticSessions;
  const evidenceRepository = createDiagnosticEvidenceRepository(firestore, vehicleContext.vehicle.id, sessionId);
  const evidence: DiagnosticEvidence[] = [];
  const text = input.symptoms.trim();
  if (!text && input.files.length === 0) throw new Error('Añade texto, audio o fotografía para iniciar el análisis.');
  const baseSession: DiagnosticSession = {
    id: sessionId, schemaVersion: 1, createdAt: now, updatedAt: now, ownerId: vehicleContext.vehicle.ownerId, userVehicleId: vehicleContext.vehicle.id,
    title: text ? text.slice(0, 100) : 'Diagnóstico con evidencia multimedia', symptoms: text ? [text] : ['Evidencia multimedia sin descripción textual'],
    severityDeclared: input.severityDeclared, startedAt: now, mileageKm: vehicleContext.vehicle.mileageKm, status: 'open', evidenceIds: [], obdCodes: [],
    professionalAssessmentVerified: false, context: input.context,
  };
  await sessions.save(baseSession);
  if (text) {
    const item: DiagnosticEvidence = { id: crypto.randomUUID(), schemaVersion: 1, createdAt: now, updatedAt: now, ownerId: baseSession.ownerId, userVehicleId: baseSession.userVehicleId, diagnosticSessionId: sessionId, type: 'text', purpose: 'Descripción del síntoma', textContent: text, uploadStatus: 'uploaded', analysisStatus: 'queued', retentionClass: 'project' };
    await evidenceRepository.save(item); evidence.push(item);
  }
  for (const file of input.files) evidence.push(await uploadEvidence(storage, evidenceRepository, baseSession, file));
  const assessment = await provider.analyze({ symptoms: text || 'Evidencia multimedia pendiente de interpretación profesional.', severityDeclared: input.severityDeclared, context: input.context, evidence, vehicleContext });
  const completedEvidence = evidence.map((item) => ({ ...item, analysisStatus: 'completed' as const, updatedAt: new Date() }));
  await Promise.all(completedEvidence.map((item) => evidenceRepository.save(item)));
  const completed: DiagnosticSession = { ...baseSession, updatedAt: new Date(), evidenceIds: evidence.map((item) => item.id), assessment, status: ['high', 'urgent'].includes(assessment.severity) ? 'workshop_required' : 'monitoring' };
  await sessions.save(completed);
  await notifyDiagnosticAvailable(completed.userVehicleId, completed.id).catch(() => undefined);
  return completed;
}

export async function deleteDiagnosticEvidence(firestore: Firestore, storage: FirebaseStorage, session: DiagnosticSession, evidence: DiagnosticEvidence): Promise<{ session: DiagnosticSession; evidence: DiagnosticEvidence }> {
  if (evidence.ownerId !== session.ownerId || evidence.diagnosticSessionId !== session.id) throw new Error('La evidencia no pertenece a esta sesión.');
  if (evidence.storagePath) await deleteObject(ref(storage, evidence.storagePath));
  const now = new Date();
  const deleted: DiagnosticEvidence = { ...evidence, uploadStatus: 'deleted', analysisStatus: 'not_requested', deletedAt: now, updatedAt: now };
  const updatedSession: DiagnosticSession = { ...session, evidenceIds: session.evidenceIds.filter((id) => id !== evidence.id), updatedAt: now };
  await createDiagnosticEvidenceRepository(firestore, session.userVehicleId, session.id).save(deleted);
  await createUserVehicleRepositories(firestore, session.userVehicleId).diagnosticSessions.save(updatedSession);
  return { session: updatedSession, evidence: deleted };
}

async function uploadEvidence(storage: FirebaseStorage, repository: ReturnType<typeof createDiagnosticEvidenceRepository>, session: DiagnosticSession, file: DiagnosticFileInput): Promise<DiagnosticEvidence> {
  validateDiagnosticFile(file);
  await validateDiagnosticFileSignature(file);
  const evidenceId = crypto.randomUUID(); const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_').slice(-100) || `${file.type}.bin`;
  const storagePath = `users/${session.ownerId}/vehicles/${session.userVehicleId}/diagnostics/${session.id}/${evidenceId}-${safeName}`;
  const now = new Date();
  const evidence: DiagnosticEvidence = { id: evidenceId, schemaVersion: 1, createdAt: now, updatedAt: now, ownerId: session.ownerId, userVehicleId: session.userVehicleId, diagnosticSessionId: session.id, type: file.type, purpose: file.type === 'image' ? 'Fotografía del síntoma' : 'Audio del síntoma', storagePath, contentType: file.blob.type, sizeBytes: file.blob.size, ...(file.durationSeconds !== undefined ? { durationSeconds: file.durationSeconds } : {}), uploadStatus: 'pending', analysisStatus: 'queued', retentionClass: 'project' };
  await repository.save(evidence);
  try { await uploadBytes(ref(storage, storagePath), file.blob, { contentType: file.blob.type, customMetadata: { ownerId: session.ownerId, userVehicleId: session.userVehicleId, diagnosticSessionId: session.id } }); const uploaded = { ...evidence, uploadStatus: 'uploaded' as const, updatedAt: new Date() }; await repository.save(uploaded); return uploaded; }
  catch (error) { await repository.save({ ...evidence, uploadStatus: 'failed', analysisStatus: 'failed', updatedAt: new Date() }); throw error; }
}

export function validateDiagnosticFile(file: DiagnosticFileInput): void {
  const maximum = file.type === 'image' ? MAX_IMAGE_BYTES : MAX_AUDIO_BYTES;
  if (file.blob.size <= 0 || file.blob.size >= maximum) throw new Error(file.type === 'image' ? 'Cada fotografía debe ocupar menos de 10 MB.' : 'Cada audio debe ocupar menos de 20 MB.');
  if (file.type === 'image' && !ALLOWED_TYPES.has(file.blob.type)) throw new Error('La fotografía debe ser JPEG, PNG o WebP.');
  if (file.type === 'audio' && !ALLOWED_AUDIO_TYPES.has(file.blob.type)) throw new Error('El audio debe ser WebM, MP3, MP4/M4A, WAV u OGG.');
  const extension = file.name.toLowerCase().split('.').pop() ?? '';
  if (!EXTENSIONS[file.blob.type]?.includes(extension)) throw new Error('La extensión del archivo no coincide con su tipo declarado.');
}

export async function validateDiagnosticFileSignature(file: DiagnosticFileInput): Promise<void> {
  const bytes = new Uint8Array(await file.blob.slice(0, 16).arrayBuffer());
  const ascii = String.fromCharCode(...bytes);
  const valid = file.blob.type === 'image/jpeg' ? bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff
    : file.blob.type === 'image/png' ? bytes.slice(0, 8).every((value, index) => value === [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a][index])
      : file.blob.type === 'image/webp' ? ascii.startsWith('RIFF') && ascii.slice(8, 12) === 'WEBP'
        : file.blob.type === 'audio/webm' ? bytes[0] === 0x1a && bytes[1] === 0x45 && bytes[2] === 0xdf && bytes[3] === 0xa3
          : file.blob.type === 'audio/mpeg' ? ascii.startsWith('ID3') || (bytes[0] === 0xff && ((bytes[1] ?? 0) & 0xe0) === 0xe0)
            : file.blob.type === 'audio/wav' ? ascii.startsWith('RIFF') && ascii.slice(8, 12) === 'WAVE'
              : file.blob.type === 'audio/ogg' ? ascii.startsWith('OggS')
                : file.blob.type === 'audio/mp4' ? ascii.slice(4, 8) === 'ftyp'
                  : false;
  if (!valid) throw new Error('El contenido real del archivo no coincide con el formato permitido.');
}
