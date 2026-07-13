export const premiumCollections = {
  userProfiles: 'users',
  subscriptions: 'entitlements',
  userVehicles: 'userVehicles',
  vehicleMasters: 'vehicles',
  engineMasters: 'engines',
  transmissionMasters: 'transmissions',
  maintenanceDefinitions: 'maintenance',
  modificationDefinitions: 'modifications',
  vehicleIssues: 'knownIssues',
  researchJobs: 'aiRuns',
  technicalSources: 'sources',
  technicalClaims: 'technicalClaims',
  researchContradictions: 'researchContradictions',
  researchReviewTasks: 'reviewTasks',
  vehicleResearchResults: 'vehicleResearchResults',
  publishedResearchRevisions: 'publishedRevisions',
  notificationDeliveries: 'notificationDeliveries',
  notificationJobs: 'notificationJobs',
} as const;

export function userNotificationsPath(uid: string): string {
  if (uid.trim().length === 0 || uid.includes('/')) throw new TypeError('A valid user id is required');
  return `users/${uid}/notifications`;
}

export function notificationPreferencesPath(uid: string): string {
  if (uid.trim().length === 0 || uid.includes('/')) throw new TypeError('A valid user id is required');
  return `users/${uid}/notificationPreferences`;
}

export const userVehicleSubcollections = {
  maintenanceRecords: 'maintenanceHistory',
  maintenanceTasks: 'maintenanceTasks',
  installedModifications: 'installedModifications',
  projectGoals: 'goals',
  diagnosticSessions: 'diagnosticCases',
} as const;

export function userVehicleSubcollectionPath(
  userVehicleId: string,
  name: keyof typeof userVehicleSubcollections,
): string {
  if (userVehicleId.trim().length === 0 || userVehicleId.includes('/')) {
    throw new TypeError('A valid user vehicle id is required');
  }
  return `userVehicles/${userVehicleId}/${userVehicleSubcollections[name]}`;
}

export function diagnosticEvidencePath(userVehicleId: string, diagnosticSessionId: string): string {
  if ([userVehicleId, diagnosticSessionId].some((value) => value.trim().length === 0 || value.includes('/'))) {
    throw new TypeError('Valid vehicle and diagnostic session ids are required');
  }
  return `userVehicles/${userVehicleId}/diagnosticCases/${diagnosticSessionId}/evidence`;
}

export function modificationPlanPath(projectId: string): string {
  if (projectId.trim().length === 0 || projectId.includes('/')) throw new TypeError('A valid project id is required');
  return `premiumProjects/${projectId}/planVersions`;
}

export function aiConversationPath(projectId: string): string {
  if (projectId.trim().length === 0 || projectId.includes('/')) throw new TypeError('A valid project id is required');
  return `premiumProjects/${projectId}/conversations`;
}
