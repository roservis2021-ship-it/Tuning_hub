import type { Firestore } from 'firebase/firestore';
import { aiConversationPath, diagnosticEvidencePath, modificationPlanPath, notificationPreferencesPath, premiumCollections, userNotificationsPath, userVehicleSubcollectionPath } from '../firestore/premiumCollections';
import type {
  AIConversation, DiagnosticEvidence, DiagnosticSession, EngineMaster, InstalledModification,
  MaintenanceDefinition, MaintenanceRecord, MaintenanceTask, ModificationDefinition, ModificationPlan, ProjectGoal,
  ResearchJob, Subscription, TechnicalSource, TransmissionMaster, UserProfile, UserVehicle,
  VehicleIssue, VehicleMaster,
  TechnicalClaim, ResearchContradiction, ResearchReviewTask, VehicleResearchResult, PublishedResearchRevision, NotificationPreferences, UserNotification,
} from '../models';
import {
  aiConversationSchema, diagnosticEvidenceSchema, diagnosticSessionSchema, engineMasterSchema,
  installedModificationSchema, maintenanceDefinitionSchema, maintenanceRecordSchema, maintenanceTaskSchema,
  modificationDefinitionSchema, modificationPlanSchema, projectGoalSchema, researchJobSchema,
  subscriptionSchema, technicalSourceSchema, transmissionMasterSchema, userProfileSchema,
  userVehicleSchema, vehicleIssueSchema, vehicleMasterSchema,
  technicalClaimSchema, researchContradictionSchema, researchReviewTaskSchema, vehicleResearchResultSchema, publishedResearchRevisionSchema, notificationPreferencesSchema, userNotificationSchema,
} from '../schemas/premiumSchemas';
import { createFirestoreRepository } from './firestoreRepository';

export function createPremiumRepositories(firestore: Firestore) {
  return {
    userProfiles: createFirestoreRepository<UserProfile>(firestore, premiumCollections.userProfiles, userProfileSchema),
    subscriptions: createFirestoreRepository<Subscription>(firestore, premiumCollections.subscriptions, subscriptionSchema),
    userVehicles: createFirestoreRepository<UserVehicle>(firestore, premiumCollections.userVehicles, userVehicleSchema),
    vehicleMasters: createFirestoreRepository<VehicleMaster>(firestore, premiumCollections.vehicleMasters, vehicleMasterSchema),
    engineMasters: createFirestoreRepository<EngineMaster>(firestore, premiumCollections.engineMasters, engineMasterSchema),
    transmissionMasters: createFirestoreRepository<TransmissionMaster>(firestore, premiumCollections.transmissionMasters, transmissionMasterSchema),
    maintenanceDefinitions: createFirestoreRepository<MaintenanceDefinition>(firestore, premiumCollections.maintenanceDefinitions, maintenanceDefinitionSchema),
    modificationDefinitions: createFirestoreRepository<ModificationDefinition>(firestore, premiumCollections.modificationDefinitions, modificationDefinitionSchema),
    vehicleIssues: createFirestoreRepository<VehicleIssue>(firestore, premiumCollections.vehicleIssues, vehicleIssueSchema),
    researchJobs: createFirestoreRepository<ResearchJob>(firestore, premiumCollections.researchJobs, researchJobSchema),
    technicalSources: createFirestoreRepository<TechnicalSource>(firestore, premiumCollections.technicalSources, technicalSourceSchema),
    technicalClaims: createFirestoreRepository<TechnicalClaim>(firestore, premiumCollections.technicalClaims, technicalClaimSchema),
    researchContradictions: createFirestoreRepository<ResearchContradiction>(firestore, premiumCollections.researchContradictions, researchContradictionSchema),
    researchReviewTasks: createFirestoreRepository<ResearchReviewTask>(firestore, premiumCollections.researchReviewTasks, researchReviewTaskSchema),
    vehicleResearchResults: createFirestoreRepository<VehicleResearchResult>(firestore, premiumCollections.vehicleResearchResults, vehicleResearchResultSchema),
    publishedResearchRevisions: createFirestoreRepository<PublishedResearchRevision>(firestore, premiumCollections.publishedResearchRevisions, publishedResearchRevisionSchema),
  };
}

export function createUserVehicleRepositories(firestore: Firestore, userVehicleId: string) {
  return {
    maintenanceRecords: createFirestoreRepository<MaintenanceRecord>(firestore, userVehicleSubcollectionPath(userVehicleId, 'maintenanceRecords'), maintenanceRecordSchema),
    maintenanceTasks: createFirestoreRepository<MaintenanceTask>(firestore, userVehicleSubcollectionPath(userVehicleId, 'maintenanceTasks'), maintenanceTaskSchema),
    installedModifications: createFirestoreRepository<InstalledModification>(firestore, userVehicleSubcollectionPath(userVehicleId, 'installedModifications'), installedModificationSchema),
    projectGoals: createFirestoreRepository<ProjectGoal>(firestore, userVehicleSubcollectionPath(userVehicleId, 'projectGoals'), projectGoalSchema),
    diagnosticSessions: createFirestoreRepository<DiagnosticSession>(firestore, userVehicleSubcollectionPath(userVehicleId, 'diagnosticSessions'), diagnosticSessionSchema),
  };
}

export function createNotificationRepositories(firestore: Firestore, uid: string) {
  return {
    preferences: createFirestoreRepository<NotificationPreferences>(firestore, notificationPreferencesPath(uid), notificationPreferencesSchema),
    notifications: createFirestoreRepository<UserNotification>(firestore, userNotificationsPath(uid), userNotificationSchema),
  };
}

export function createDiagnosticEvidenceRepository(firestore: Firestore, userVehicleId: string, diagnosticSessionId: string) {
  return createFirestoreRepository<DiagnosticEvidence>(firestore, diagnosticEvidencePath(userVehicleId, diagnosticSessionId), diagnosticEvidenceSchema);
}

export function createProjectRepositories(firestore: Firestore, projectId: string) {
  return {
    modificationPlans: createFirestoreRepository<ModificationPlan>(firestore, modificationPlanPath(projectId), modificationPlanSchema),
    conversations: createFirestoreRepository<AIConversation>(firestore, aiConversationPath(projectId), aiConversationSchema),
  };
}
