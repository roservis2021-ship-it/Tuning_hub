import { z } from 'zod';

const requiredText = z.string().trim().min(1);
const id = requiredText.max(200);
const optionalId = z.preprocess((value) => value === null ? undefined : value, id.optional());
const nonNegative = z.number().nonnegative();
const positiveInteger = z.number().int().positive();
const year = z.number().int().min(1886).max(2200);

export const dateSchema = z.preprocess((value) => {
  if (value instanceof Date) return value;
  if (typeof value === 'string' || typeof value === 'number') return new Date(value);
  if (isDateLike(value)) {
    return value.toDate();
  }
  return value;
}, z.date());

function isDateLike(value: unknown): value is { toDate: () => Date } {
  if (typeof value !== 'object' || value === null || !('toDate' in value)) return false;
  return typeof value.toDate === 'function';
}

export const reviewStatusSchema = z.enum([
  'draft', 'ai_draft', 'in_review', 'changes_requested', 'approved', 'rejected',
  'published', 'archived', 'superseded',
]);

export const confidenceAssessmentSchema = z.object({
  level: z.enum(['unverified', 'low', 'medium', 'high', 'verified']),
  rationale: requiredText,
  assessedBy: z.enum(['ai', 'editor', 'source_import', 'system']),
  assessedAt: dateSchema,
}).strict();

const metadata = {
  id,
  schemaVersion: positiveInteger,
  createdAt: dateSchema,
  updatedAt: dateSchema,
};

const provenanceSchema = z.object({
  sourceIds: z.array(id),
  confidence: confidenceAssessmentSchema,
  reviewStatus: reviewStatusSchema,
  researchedAt: dateSchema.optional(),
  reviewedAt: dateSchema.optional(),
  reviewedBy: id.optional(),
}).strict();

const moneySchema = z.object({ amount: nonNegative, currency: z.string().regex(/^[A-Z]{3}$/) }).strict();
const powerProfileSchema = z.object({
  stockPowerCv: nonNegative.optional(),
  estimatedPowerCv: nonNegative.optional(),
  userDeclaredPowerCv: nonNegative.optional(),
}).strict();

export const userProfileSchema = z.object({
  ...metadata, displayName: requiredText, emailNormalized: z.email().transform((value) => value.toLowerCase()),
  locale: requiredText, timezone: requiredText, status: z.enum(['active', 'disabled', 'deleted']),
  onboardingCompleted: z.boolean(), lastSeenAt: dateSchema.optional(),
}).strict();

export const notificationCategorySchema = z.enum(['maintenance', 'research', 'diagnostics', 'vehicle_alerts']);
export const notificationEventTypeSchema = z.enum(['maintenance_mileage_upcoming', 'maintenance_date_upcoming', 'maintenance_overdue', 'vehicle_research_completed', 'diagnostic_available', 'important_vehicle_alert']);
export const notificationPreferencesSchema = z.object({
  ...metadata, ownerId: id, timezone: requiredText,
  categories: z.object({ maintenance: z.boolean(), research: z.boolean(), diagnostics: z.boolean(), vehicle_alerts: z.boolean() }).strict(),
  channels: z.object({ in_app: z.boolean(), push: z.boolean(), email: z.boolean() }).strict(),
  quietHours: z.object({ start: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/), end: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/) }).strict().optional(),
}).strict();

export const userNotificationSchema = z.object({
  ...metadata, ownerId: id, category: notificationCategorySchema, type: notificationEventTypeSchema,
  title: requiredText.max(120), body: requiredText.max(180), deepLink: requiredText.max(500).optional(),
  relatedEntityType: requiredText, relatedEntityId: id, readAt: dateSchema.optional(), expiresAt: dateSchema.optional(),
}).strict();

export const subscriptionSchema = z.object({
  ...metadata, userId: id, type: z.enum(['premium_project', 'premium_subscription', 'extra_build']),
  billingMode: z.enum(['one_time', 'subscription']),
  status: z.enum(['active', 'pending', 'past_due', 'expired', 'revoked', 'cancelled']),
  sourcePurchaseId: id, projectId: id.optional(), userVehicleId: id.optional(), startsAt: dateSchema,
  expiresAt: dateSchema.optional(), usageLimits: z.record(z.string(), nonNegative), usageCounters: z.record(z.string(), nonNegative),
}).strict();

const vehicleSnapshotSchema = z.object({
  brand: requiredText, model: requiredText, generation: requiredText, variant: requiredText,
  market: requiredText.optional(),
  engineCode: requiredText.optional(), transmissionCode: requiredText.optional(),
}).strict();

export const userVehicleSchema = z.object({
  ...metadata, ownerId: id, variantId: optionalId, variantSnapshot: vehicleSnapshotSchema,
  variantResolutionStatus: z.enum(['unresolved', 'probable', 'confirmed', 'rejected']), nickname: requiredText.optional(),
  year, mileageKm: nonNegative, color: requiredText.optional(), protectedVinReference: requiredText.optional(),
  registrationCountry: z.string().length(2).optional(), primaryUse: z.enum(['daily', 'weekend', 'track', 'competition', 'show', 'mixed']),
  condition: z.enum(['unknown', 'needs_inspection', 'service_due', 'good', 'project']), power: powerProfileSchema,
  currentGoalId: id.optional(), activeProjectId: id.optional(), researchJobId: id.optional(), profileCompleteness: z.number().min(0).max(100), archivedAt: dateSchema.optional(),
}).strict();

export const vehicleMasterSchema = z.object({
  ...metadata, brandId: id, modelId: id, generationId: id, engineId: id, transmissionId: id.optional(), displayName: requiredText,
  market: requiredText, productionStartYear: year, productionEndYear: year.optional(), bodyStyle: requiredText.optional(),
  driveLayout: z.enum(['fwd', 'rwd', 'awd', '4wd']).optional(), power: z.object({ stockPowerCv: nonNegative.optional() }).strict(),
  stockTorqueNm: nonNegative.optional(), chassisCode: requiredText.optional(),
  suspension: z.object({ front: requiredText.optional(), rear: requiredText.optional() }).strict().optional(),
  brakes: z.object({ front: requiredText.optional(), rear: requiredText.optional() }).strict().optional(),
  wheelFitment: z.object({ pcd: requiredText.optional(), hubBoreMm: nonNegative.optional(), offsetRange: requiredText.optional(), compatibleSizes: z.array(requiredText).optional() }).strict().optional(),
  strengths: z.array(requiredText).optional(), weaknesses: z.array(requiredText).optional(), knownRiskIds: z.array(id).optional(),
  tuningHubRating: z.number().min(0).max(10).optional(), normalizedLookupKey: requiredText.optional(), provenance: provenanceSchema,
}).strict();

export const engineMasterSchema = z.object({
  ...metadata, manufacturer: requiredText, code: requiredText, family: requiredText.optional(),
  fuel: z.enum(['petrol', 'diesel', 'hybrid', 'electric', 'other']),
  induction: z.enum(['naturally_aspirated', 'turbo', 'supercharged', 'twincharged', 'electric']),
  displacementCc: nonNegative.optional(), cylinders: positiveInteger.optional(), stockPowerCv: nonNegative.optional(), stockTorqueNm: nonNegative.optional(),
  markets: z.array(requiredText), productionStartYear: year.optional(), productionEndYear: year.optional(),
  documentedLimitNotes: requiredText.optional(), provenance: provenanceSchema,
  architecture: requiredText.optional(), injection: requiredText.optional(), timingSystem: requiredText.optional(), ecu: requiredText.optional(),
  oil: z.object({ recommendedViscosity: requiredText.optional(), capacityLitres: nonNegative.optional(), approvals: z.array(requiredText).optional() }).strict().optional(),
}).strict();

export const transmissionMasterSchema = z.object({
  ...metadata, manufacturer: requiredText, code: requiredText, family: requiredText.optional(),
  type: z.enum(['manual', 'automatic', 'dct', 'cvt']), gears: positiveInteger,
  driveLayout: z.enum(['fwd', 'rwd', 'awd', '4wd']), factoryTorqueRatingNm: nonNegative.optional(), knownIssueIds: z.array(id),
  serviceRequirementIds: z.array(id), compatibleVariantIds: z.array(id), provenance: provenanceSchema,
}).strict();

export const maintenanceDefinitionSchema = z.object({
  ...metadata, title: requiredText, description: requiredText, applicableVariantIds: z.array(id), applicableEngineIds: z.array(id),
  intervalKm: positiveInteger.optional(), intervalMonths: positiveInteger.optional(), severity: z.enum(['routine', 'important', 'critical']),
  estimatedCost: moneySchema.optional(), prerequisiteForModificationIds: z.array(id), provenance: provenanceSchema,
}).strict().refine((value) => value.intervalKm !== undefined || value.intervalMonths !== undefined, { message: 'At least one maintenance interval is required' });

const maintenancePartSchema = z.object({
  name: requiredText, manufacturer: requiredText.optional(), partNumber: requiredText.optional(), quantity: nonNegative.optional(),
}).strict();

export const maintenanceRecordSchema = z.object({
  ...metadata, ownerId: id, userVehicleId: id, maintenanceDefinitionId: id.optional(), type: z.enum(['service', 'inspection', 'repair', 'replacement', 'other']),
  title: requiredText, performedAt: dateSchema, mileageKm: nonNegative.optional(), workshop: requiredText.optional(), cost: moneySchema.optional(),
  parts: z.array(maintenancePartSchema), notes: requiredText.optional(), sourceMediaIds: z.array(id),
  verificationStatus: z.enum(['user_declared', 'documented', 'professional_verified']),
}).strict();

export const maintenanceTaskSchema = z.object({
  ...metadata, ownerId: id, userVehicleId: id, maintenanceDefinitionId: id, title: requiredText,
  intervalKm: positiveInteger.optional(), intervalMonths: positiveInteger.optional(), severity: z.enum(['routine', 'important', 'critical']),
  status: z.enum(['up_to_date', 'upcoming', 'overdue', 'urgent', 'insufficient_information']),
  lastPerformedAt: dateSchema.optional(), lastPerformedMileageKm: nonNegative.optional(), nextDueAt: dateSchema.optional(), nextDueMileageKm: nonNegative.optional(),
  reminder: z.object({ byTime: z.boolean(), byMileage: z.boolean(), nextReminderAt: dateSchema.optional(), nextReminderMileageKm: nonNegative.optional() }).strict(),
  recommendationStatus: z.enum(['approved_definition', 'pending_review']), adaptationReasons: z.array(requiredText),
}).strict().refine((value) => value.intervalKm !== undefined || value.intervalMonths !== undefined, { message: 'At least one maintenance interval is required' });

export const modificationDefinitionSchema = z.object({
  ...metadata, title: requiredText, category: z.enum(['engine', 'ecu', 'intake_exhaust', 'drivetrain', 'chassis', 'brakes', 'wheels', 'exterior', 'interior']),
  description: requiredText, compatibleVariantIds: z.array(id), prerequisiteModificationIds: z.array(id), incompatibleModificationIds: z.array(id),
  estimatedPowerGainCv: z.object({ minimum: nonNegative, maximum: nonNegative }).strict().refine((v) => v.maximum >= v.minimum).optional(),
  estimatedCost: moneySchema.optional(), legalImpact: z.enum(['none_known', 'documentation', 'homologation', 'track_only', 'unknown']),
  riskLevel: z.enum(['low', 'medium', 'high', 'specialist_required']),
  applicableGoalTypes: z.array(z.enum(['reliability', 'street_performance', 'aesthetic', 'track', 'custom'])).optional(),
  partsAndSpecifications: z.array(requiredText).optional(), prerequisiteChecks: z.array(requiredText).optional(), expectedResult: requiredText.optional(),
  estimatedTorqueGainNm: z.object({ minimum: nonNegative, maximum: nonNegative }).strict().refine((v) => v.maximum >= v.minimum).optional(),
  impacts: z.object({ response: requiredText.optional(), cooling: requiredText.optional(), transmission: requiredText.optional(), reliability: requiredText.optional() }).strict().optional(),
  technicalWarnings: z.array(requiredText).optional(), provenance: provenanceSchema,
}).strict();

export const installedModificationSchema = z.object({
  ...metadata, ownerId: id, userVehicleId: id, modificationId: id.optional(), customName: requiredText.optional(), manufacturer: requiredText.optional(),
  partNumber: requiredText.optional(), installedAt: dateSchema.optional(), mileageKm: nonNegative.optional(), installedBy: requiredText.optional(), cost: moneySchema.optional(),
  tuneRequired: z.boolean(), tuneDetails: requiredText.optional(), estimatedPowerAfterCv: nonNegative.optional(), userDeclaredPowerAfterCv: nonNegative.optional(),
  homologationStatus: z.enum(['not_required', 'pending', 'approved', 'rejected', 'unknown']), documentMediaIds: z.array(id),
  compatibilityStatus: z.enum(['confirmed', 'probable', 'incompatible', 'unknown']), confidence: confidenceAssessmentSchema,
  reviewStatus: reviewStatusSchema, active: z.boolean(),
}).strict().refine((value) => value.modificationId !== undefined || value.customName !== undefined, { message: 'Modification id or custom name is required' });

export const projectGoalSchema = z.object({
  ...metadata, ownerId: id, userVehicleId: id, type: z.enum(['reliability', 'street_performance', 'aesthetic', 'track', 'custom']),
  title: requiredText, targetPowerCv: z.preprocess((value) => value === null ? undefined : value, nonNegative.optional()), targetTorqueNm: nonNegative.optional(), budget: moneySchema.optional(), targetDate: dateSchema.optional(),
  usageConstraints: z.array(requiredText), comfortPriority: z.number().min(0).max(10), legalRoadUseRequired: z.boolean(),
  feasibility: z.enum(['pending_evaluation', 'realistic', 'conditional', 'not_recommended']), status: z.enum(['draft', 'active', 'completed', 'abandoned']),
}).strict();

const modificationPlanStepSchema = z.object({
  id, order: positiveInteger, title: requiredText, rationale: requiredText, modificationDefinitionIds: z.array(id), prerequisiteStepIds: z.array(id),
  estimatedCost: moneySchema.optional(), estimatedPowerCv: nonNegative.optional(), risks: z.array(requiredText),
  status: z.enum(['proposed', 'approved', 'in_progress', 'completed', 'skipped']), provenance: provenanceSchema,
}).strict();

export const modificationPlanSchema = z.object({
  ...metadata, ownerId: id, projectId: id, userVehicleId: id, goalId: id, versionNumber: positiveInteger, contextVersion: positiveInteger,
  status: z.enum(['generating', 'draft', 'delivered', 'superseded', 'failed']), generatedBy: z.enum(['ai', 'human', 'hybrid']),
  researchJobId: id.optional(), summary: requiredText, steps: z.array(modificationPlanStepSchema), deliveredAt: dateSchema.optional(),
}).strict();

export const vehicleIssueSchema = z.object({
  ...metadata, scope: z.enum(['master_known_issue', 'user_vehicle_issue']), ownerId: id.optional(), userVehicleId: id.optional(),
  applicableVariantIds: z.array(id), title: requiredText, symptoms: z.array(requiredText), possibleCauses: z.array(requiredText),
  severity: z.enum(['low', 'medium', 'high', 'safety_critical']), status: z.enum(['known', 'suspected', 'monitoring', 'resolved', 'workshop_required']),
  obdCodes: z.array(requiredText), provenance: provenanceSchema,
}).strict().superRefine((value, context) => {
  if (value.scope === 'user_vehicle_issue' && (!value.ownerId || !value.userVehicleId)) context.addIssue({ code: 'custom', message: 'Private issues require owner and vehicle' });
});

export const diagnosticSessionSchema = z.object({
  ...metadata, ownerId: id, userVehicleId: id, vehicleIssueId: id.optional(), title: requiredText, symptoms: z.array(requiredText),
  severityDeclared: z.enum(['low', 'medium', 'high', 'urgent']), startedAt: dateSchema, mileageKm: nonNegative.optional(),
  status: z.enum(['open', 'monitoring', 'resolved', 'workshop_required']), evidenceIds: z.array(id), obdCodes: z.array(requiredText),
  observations: requiredText.optional(), researchJobId: id.optional(), professionalAssessment: requiredText.optional(),
  professionalAssessmentVerified: z.boolean(), resolution: requiredText.optional(),
  context: z.object({ occurrence: requiredText, engineTemperature: z.enum(['cold', 'hot', 'both', 'unknown']), drivingPhases: z.array(z.enum(['starting', 'accelerating', 'braking', 'turning', 'cruising'])), speedOrRpm: requiredText.optional(), warningLights: requiredText.optional(), smoke: requiredText.optional(), odors: requiredText.optional(), vibrations: requiredText.optional(), recentChanges: requiredText.optional(), relatedModifications: requiredText.optional() }).strict().optional(),
  assessment: z.object({
    symptomSummary: requiredText,
    hypotheses: z.array(z.object({ title: requiredText, explanation: requiredText, confidence: z.enum(['unverified', 'low', 'medium', 'high']), supportingEvidenceIds: z.array(id), supportingEvidence: z.array(requiredText) }).strict()),
    confidence: z.enum(['unverified', 'low', 'medium', 'high']), additionalQuestions: z.array(requiredText), firstChecks: z.array(requiredText),
    severity: z.enum(['low', 'medium', 'high', 'urgent', 'unknown']), drivingAdvice: z.enum(['stop_now', 'do_not_drive_until_inspected', 'only_if_necessary_with_caution', 'insufficient_information']),
    stopConditions: z.array(requiredText), professionalInspectionRecommendation: requiredText, providerId: id, generatedAt: dateSchema, reviewStatus: z.enum(['ai_draft', 'in_review', 'approved']),
  }).strict().optional(),
}).strict().refine((value) => !value.professionalAssessmentVerified || value.professionalAssessment !== undefined, { message: 'A verified assessment requires assessment text' });

export const diagnosticEvidenceSchema = z.object({
  ...metadata, ownerId: id, userVehicleId: id, diagnosticSessionId: id, type: z.enum(['image', 'audio', 'document', 'obd_snapshot', 'text']),
  purpose: requiredText, storagePath: requiredText.optional(), contentType: requiredText.optional(), sizeBytes: nonNegative.optional(), durationSeconds: nonNegative.optional(),
  checksum: requiredText.optional(), textContent: requiredText.optional(), uploadStatus: z.enum(['pending', 'uploaded', 'failed', 'deleted']),
  analysisStatus: z.enum(['not_requested', 'queued', 'processing', 'completed', 'failed']), retentionClass: z.enum(['project', 'temporary', 'legal']), deletedAt: dateSchema.optional(),
}).strict().superRefine((value, context) => {
  if (value.type === 'text' && !value.textContent) context.addIssue({ code: 'custom', message: 'Text evidence requires text content' });
  if (value.type !== 'text' && !value.storagePath) context.addIssue({ code: 'custom', message: 'File evidence requires a storage path' });
});

export const aiConversationSchema = z.object({
  ...metadata, ownerId: id, projectId: id, userVehicleId: id, title: requiredText, status: z.enum(['active', 'archived', 'escalated']),
  summary: requiredText.optional(), summaryVersion: z.number().int().nonnegative(), lastMessageAt: dateSchema.optional(), messageCount: z.number().int().nonnegative(),
}).strict();

const researchAmbiguitySchema = z.object({ field: requiredText, severity: z.enum(['high', 'critical']), message: requiredText }).strict();
const vehicleResearchRequestSchema = z.object({ brand: requiredText, model: requiredText, generation: z.string(), variant: z.string(), year: year.nullable(), market: z.string(), engineCode: z.string(), transmissionCode: z.string(), lookupKey: requiredText, precision: z.enum(['exact', 'probable', 'ambiguous']), ambiguities: z.array(researchAmbiguitySchema) }).strict();
export const researchJobSchema = z.object({
  ...metadata, ownerId: id.optional(), ownerIds: z.array(id).optional(), projectId: id.optional(), projectIds: z.array(id).optional(), userVehicleId: id.optional(), userVehicleIds: z.array(id).optional(), purpose: z.enum(['premium_plan', 'diagnostic_assessment', 'advisor_reply', 'master_data_research']),
  targetType: requiredText, targetId: id, model: requiredText.optional(), promptVersion: requiredText.optional(), contextHash: requiredText,
  status: z.enum(['queued', 'running', 'validating', 'completed', 'failed', 'cancelled']), sourceIds: z.array(id), confidence: confidenceAssessmentSchema.optional(),
  reviewStatus: reviewStatusSchema, errorCode: requiredText.optional(), startedAt: dateSchema.optional(), completedAt: dateSchema.optional(),
  stage: z.enum(['queued', 'normalizing', 'identifying', 'ambiguity_check', 'collecting_sources', 'contrasting', 'structuring', 'persisting_sources', 'scoring_confidence', 'detecting_contradictions', 'awaiting_human_review', 'approved', 'publishing', 'published', 'failed']).optional(),
  normalizedRequest: vehicleResearchRequestSchema.optional(),
  ambiguities: z.array(researchAmbiguitySchema).optional(), resultId: id.optional(), reviewTaskId: id.optional(), connectorIds: z.array(id).optional(), reopenCount: z.number().int().nonnegative().optional(), collectedSourceCount: z.number().int().nonnegative().optional(), excludedClaimCount: z.number().int().nonnegative().optional(), contradictionCount: z.number().int().nonnegative().optional(), publishedRevisionId: id.optional(), reviewedBy: id.optional(), reviewedAt: dateSchema.optional(), errorMessage: requiredText.optional(),
}).strict();

export const technicalSourceSchema = z.object({
  ...metadata, title: requiredText, type: z.enum(['manufacturer_manual', 'parts_catalogue', 'regulation', 'technical_database', 'specialist', 'community_forum', 'other']),
  publisher: requiredText.optional(), url: z.url().optional(), documentStoragePath: requiredText.optional(), market: requiredText.optional(),
  publishedAt: dateSchema.optional(), accessedAt: dateSchema, status: z.enum(['pending_review', 'accepted', 'rejected', 'archived']), notes: requiredText.optional(), connectorId: id.optional(), trustTier: z.enum(['primary', 'secondary', 'community']).optional(), reviewedBy: id.optional(), reviewedAt: dateSchema.optional(),
}).strict().refine((value) => value.url !== undefined || value.documentStoragePath !== undefined, { message: 'A source requires a URL or stored document' });

const researchCategorySchema = z.enum(['identification', 'engine', 'transmission', 'chassis', 'brakes', 'wheels', 'tyres', 'fluids', 'maintenance', 'strengths', 'weaknesses', 'issues', 'risks', 'modifications', 'compatibilities', 'reasonable_limits', 'year_market_differences']);
const claimValueSchema = z.union([requiredText, z.number(), z.boolean(), z.array(requiredText), z.array(z.number())]);
export const technicalClaimSchema = z.object({ ...metadata, entityType: z.literal('vehicle_master'), entityKey: requiredText, category: researchCategorySchema, fieldPath: requiredText, value: claimValueSchema, unit: requiredText.optional(), scope: z.object({ generation: z.string(), market: z.string(), year: year.nullable(), engineCode: z.string() }).strict(), sourceIds: z.array(id).min(1), confidence: confidenceAssessmentSchema, contradictionIds: z.array(id), reviewStatus: reviewStatusSchema, reviewedBy: id.optional(), reviewedAt: dateSchema.optional() }).strict();
export const researchContradictionSchema = z.object({ ...metadata, jobLookupKey: requiredText, fieldKey: requiredText, values: z.array(z.object({ value: requiredText, sourceKeys: z.array(requiredText).min(1) }).strict()).min(2), status: z.enum(['open', 'resolved', 'accepted_difference']), detectedAt: dateSchema, resolvedBy: id.optional(), resolvedAt: dateSchema.optional(), resolution: requiredText.optional() }).strict();
export const researchReviewTaskSchema = z.object({ ...metadata, type: z.literal('vehicle_research'), jobId: id, resultId: id, status: z.enum(['open', 'approved', 'changes_requested', 'rejected']), priority: z.enum(['normal', 'high']), ambiguityCount: z.number().int().nonnegative(), contradictionCount: z.number().int().nonnegative(), blockingIssueCount: z.number().int().nonnegative(), requiredRole: z.literal('reviewer'), reviewedBy: id.optional(), reviewedAt: dateSchema.optional(), decisionNotes: requiredText.optional() }).strict();
export const publishedResearchRevisionSchema = z.object({ ...metadata, entityType: z.literal('vehicle_research'), entityKey: requiredText, jobId: id, resultId: id, claimIds: z.array(id), sourceIds: z.array(id), status: z.enum(['published', 'superseded', 'withdrawn']), publishedBy: id, publishedAt: dateSchema }).strict();
export const vehicleResearchResultSchema = z.object({ ...metadata, jobId: id, normalizedRequest: vehicleResearchRequestSchema, claimIds: z.array(id), sourceIds: z.array(id), contradictionIds: z.array(id), excludedClaims: z.array(z.object({ sourceKey: requiredText, category: researchCategorySchema, fieldPath: requiredText, reason: z.literal('scope_mismatch') }).strict()), blockingIssues: z.array(requiredText), categories: z.array(researchCategorySchema), status: z.enum(['awaiting_human_review', 'approved', 'published']), reviewedBy: id.optional(), reviewedAt: dateSchema.optional(), publishedRevisionId: id.optional() }).strict();

export const premiumSchemas = {
  userProfiles: userProfileSchema,
  subscriptions: subscriptionSchema,
  userVehicles: userVehicleSchema,
  vehicleMasters: vehicleMasterSchema,
  engineMasters: engineMasterSchema,
  transmissionMasters: transmissionMasterSchema,
  maintenanceDefinitions: maintenanceDefinitionSchema,
  maintenanceRecords: maintenanceRecordSchema,
  modificationDefinitions: modificationDefinitionSchema,
  installedModifications: installedModificationSchema,
  projectGoals: projectGoalSchema,
  modificationPlans: modificationPlanSchema,
  vehicleIssues: vehicleIssueSchema,
  diagnosticSessions: diagnosticSessionSchema,
  diagnosticEvidence: diagnosticEvidenceSchema,
  aiConversations: aiConversationSchema,
  researchJobs: researchJobSchema,
  technicalSources: technicalSourceSchema,
  technicalClaims: technicalClaimSchema,
  researchContradictions: researchContradictionSchema,
  researchReviewTasks: researchReviewTaskSchema,
  vehicleResearchResults: vehicleResearchResultSchema,
  publishedResearchRevisions: publishedResearchRevisionSchema,
} as const;

export type PremiumSchemaName = keyof typeof premiumSchemas;
