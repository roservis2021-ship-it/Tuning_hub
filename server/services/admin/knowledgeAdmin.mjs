const ADMIN_RESOURCES = Object.freeze({
  users: { collection: 'users', roles: ['admin'], limit: 200 },
  subscriptions: { collection: 'entitlements', roles: ['admin'], limit: 200 },
  diagnostics: { collectionGroup: 'diagnosticCases', roles: ['admin', 'editor', 'reviewer'], limit: 200 },
  aiUsage: { collection: 'aiUsage', roles: ['admin'], limit: 200 },
});

export function allowedAdminResource(resource, roles) {
  const config = ADMIN_RESOURCES[resource];
  return Boolean(config && config.roles.some((role) => roles.includes(role)));
}

export async function listAdminResource({ db, resource, roles }) {
  const config = ADMIN_RESOURCES[resource];
  if (!config || !allowedAdminResource(resource, roles)) throw forbidden();
  const reference = config.collectionGroup ? db.collectionGroup(config.collectionGroup) : db.collection(config.collection);
  const snapshot = await reference.limit(config.limit).get();
  return snapshot.docs.map((document) => sanitizeRecord(resource, document));
}

export async function listVehicleResearchJobs({ db, limit = 100 }) {
  const snapshot = await db.collection('aiRuns').where('purpose', '==', 'master_data_research').limit(Math.min(Math.max(limit, 1), 200)).get();
  return snapshot.docs.map((document) => serialize({ id: document.id, ...document.data() }));
}

export async function getVehicleResearchDetail({ db, jobId }) {
  const jobSnapshot = await db.collection('aiRuns').doc(safeId(jobId)).get();
  if (!jobSnapshot.exists || jobSnapshot.data()?.purpose !== 'master_data_research') throw notFound('Investigación no encontrada.');
  const job = { id: jobSnapshot.id, ...jobSnapshot.data() };
  const resultSnapshot = job.resultId ? await db.collection('vehicleResearchResults').doc(job.resultId).get() : null;
  const result = resultSnapshot?.exists ? { id: resultSnapshot.id, ...resultSnapshot.data() } : null;
  const [claims, sources, contradictions, reviewTask, revisions] = await Promise.all([
    getDocuments(db, 'technicalClaims', result?.claimIds),
    getDocuments(db, 'sources', result?.sourceIds),
    getDocuments(db, 'researchContradictions', result?.contradictionIds),
    job.reviewTaskId ? getDocument(db, 'reviewTasks', job.reviewTaskId) : null,
    db.collection('publishedRevisions').where('jobId', '==', job.id).limit(50).get().then((snapshot) => snapshot.docs.map((document) => ({ id: document.id, ...document.data() }))),
  ]);
  return serialize({ job, result, claims, sources, contradictions, reviewTask, revisions });
}

export async function reviewResearchClaim({ db, jobId, claimId, reviewerId, action, notes, value }) {
  if (!['approve', 'reject', 'edit'].includes(action)) throw invalid('Acción de revisión no válida.');
  const jobReference = db.collection('aiRuns').doc(safeId(jobId));
  const claimReference = db.collection('technicalClaims').doc(safeId(claimId));
  const now = new Date();
  await db.runTransaction(async (transaction) => {
    const [jobSnapshot, claimSnapshot] = await Promise.all([transaction.get(jobReference), transaction.get(claimReference)]);
    if (!jobSnapshot.exists || !['awaiting_human_review', 'approved'].includes(jobSnapshot.data()?.stage)) throw invalid('La investigación no admite revisión de campos en este estado.');
    if (!claimSnapshot.exists || claimSnapshot.data()?.entityKey !== jobSnapshot.data()?.normalizedRequest?.lookupKey) throw notFound('Campo técnico no encontrado en esta investigación.');
    const previous = claimSnapshot.data();
    const versionReference = db.collection('technicalClaimVersions').doc();
    transaction.set(versionReference, { jobId, claimId, previous, action, actorId: reviewerId, createdAt: now, schemaVersion: 1 });
    const update = { reviewStatus: action === 'approve' ? 'approved' : action === 'reject' ? 'rejected' : 'in_review', reviewedBy: reviewerId, reviewedAt: now, reviewNotes: cleanText(notes, 1000), updatedAt: now };
    if (action === 'edit') {
      if (value === undefined) throw invalid('La edición requiere un valor.');
      update.value = validateClaimValue(value);
      update.editedBy = reviewerId;
      update.editedAt = now;
    }
    transaction.set(claimReference, update, { merge: true });
    transaction.set(jobReference, { stage: 'awaiting_human_review', status: 'validating', reviewStatus: 'in_review', updatedAt: now }, { merge: true });
  });
}

export async function rejectVehicleResearch({ db, jobId, reviewerId, reason }) {
  const reference = db.collection('aiRuns').doc(safeId(jobId));
  const now = new Date();
  await db.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(reference);
    if (!snapshot.exists || !['awaiting_human_review', 'approved'].includes(snapshot.data()?.stage)) throw invalid('La ficha no se puede rechazar desde su estado actual.');
    const job = snapshot.data();
    transaction.set(reference, { stage: 'rejected', status: 'rejected', reviewStatus: 'rejected', rejectedBy: reviewerId, rejectedAt: now, rejectionReason: cleanText(reason, 1000, true), updatedAt: now }, { merge: true });
    if (job.resultId) transaction.set(db.collection('vehicleResearchResults').doc(job.resultId), { status: 'rejected', updatedAt: now }, { merge: true });
    if (job.reviewTaskId) transaction.set(db.collection('reviewTasks').doc(job.reviewTaskId), { status: 'rejected', reviewedBy: reviewerId, reviewedAt: now, updatedAt: now }, { merge: true });
  });
}

export async function unpublishVehicleResearch({ db, jobId, actorId, reason }) {
  const reference = db.collection('aiRuns').doc(safeId(jobId));
  const now = new Date();
  return db.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(reference);
    if (!snapshot.exists || snapshot.data()?.stage !== 'published') throw invalid('Solo una ficha publicada se puede despublicar.');
    const job = snapshot.data();
    const projectionReference = db.collection('publishedVehicleResearch').doc(job.targetId);
    const revisionReference = db.collection('publishedRevisions').doc();
    transaction.set(revisionReference, { entityType: 'vehicle_research', entityKey: job.normalizedRequest.lookupKey, jobId, resultId: job.resultId, previousRevisionId: job.publishedRevisionId || null, status: 'obsolete', action: 'unpublish', reason: cleanText(reason, 1000, true), createdBy: actorId, createdAt: now, updatedAt: now, schemaVersion: 1 });
    transaction.set(projectionReference, { status: 'obsolete', unpublishedAt: now, unpublishedBy: actorId, revisionId: revisionReference.id, updatedAt: now }, { merge: true });
    transaction.set(reference, { stage: 'approved', status: 'completed', reviewStatus: 'approved', unpublishedAt: now, unpublishedBy: actorId, updatedAt: now }, { merge: true });
    if (job.resultId) transaction.set(db.collection('vehicleResearchResults').doc(job.resultId), { status: 'approved', updatedAt: now }, { merge: true });
    return { revisionId: revisionReference.id };
  });
}

async function getDocuments(db, collectionName, ids = []) { return Promise.all((ids || []).slice(0, 250).map((id) => getDocument(db, collectionName, id))).then((items) => items.filter(Boolean)); }
async function getDocument(db, collectionName, id) { const snapshot = await db.collection(collectionName).doc(safeId(id)).get(); return snapshot.exists ? { id: snapshot.id, ...snapshot.data() } : null; }
function safeId(value) { const result = String(value || '').trim(); if (!result || result.includes('/') || result.length > 180) throw invalid('Identificador no válido.'); return result; }
function cleanText(value, maximum, required = false) { const result = String(value || '').trim().slice(0, maximum); if (required && !result) throw invalid('Debes indicar un motivo.'); return result; }
function validateClaimValue(value) { if (typeof value === 'boolean') return value; if (typeof value === 'number' && Number.isFinite(value)) return value; if (typeof value === 'string') { const result = value.trim(); if (!result || result.length > 2_000) throw invalid('El valor técnico no es válido.'); return result; } if (Array.isArray(value) && value.length <= 100 && value.every((item) => (typeof item === 'string' && item.trim().length > 0 && item.length <= 500) || (typeof item === 'number' && Number.isFinite(item)))) return value; throw invalid('El valor técnico tiene un tipo o tamaño no permitido.'); }
function serialize(value) { return JSON.parse(JSON.stringify(value, (_key, item) => item && typeof item.toDate === 'function' ? item.toDate().toISOString() : item)); }
function sanitizeRecord(resource, document) { const data = serialize(document.data()); delete data.activationClaimHash; delete data.stripeCustomerId; delete data.paymentIntentId; delete data.checkoutSessionId; return { id: document.id, path: document.ref.path, resource, ...data }; }
function httpError(statusCode, message) { const error = new Error(message); error.statusCode = statusCode; return error; }
function forbidden() { return httpError(403, 'No tienes permiso para consultar este recurso.'); }
function notFound(message) { return httpError(404, message); }
function invalid(message) { return httpError(400, message); }
