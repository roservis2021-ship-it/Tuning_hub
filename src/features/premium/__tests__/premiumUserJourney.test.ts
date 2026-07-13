import { describe, expect, it } from 'vitest';
import type { DiagnosticEvidence, InstalledModification, MaintenanceTask, ModificationDefinition, ProjectGoal, UserVehicle, VehicleMaster } from '../models';
import { decideRouteAccess } from '../auth/routeAccess';
import { deriveGarageViewState } from '../garage/garageState';
import { ConservativeKnownIssuesProvider } from '../issues/diagnosticProvider';
import { completeMaintenanceTask } from '../maintenance/maintenanceService';
import { calculateModificationRoute } from '../modifications/modificationRoute';
import { premiumOnboardingSchema, validateOnboardingStep } from '../onboarding/onboardingSchema';
import { applyVehicleMileage } from '../vehicle/vehicleMileageService';

const now = new Date('2026-07-13T10:00:00.000Z');
const metadata = { schemaVersion: 1, createdAt: now, updatedAt: now };
const provenance = { sourceIds: ['source-approved'], confidence: { level: 'verified' as const, rationale: 'Fixture aprobada', assessedBy: 'editor' as const, assessedAt: now }, reviewStatus: 'published' as const };

describe('recorrido crítico Premium de extremo a extremo en memoria', () => {
  it('conserva el proyecto desde activación hasta regreso de sesión', async () => {
    expect(decideRouteAccess({ area: 'premium', authStatus: 'unauthenticated', accessStatus: 'free', roles: [] })).toBe('sign_in');
    expect(decideRouteAccess({ area: 'premium', authStatus: 'authenticated', accessStatus: 'free', roles: [] })).toBe('subscription_required');
    expect(decideRouteAccess({ area: 'premium', authStatus: 'authenticated', accessStatus: 'premium', roles: [] })).toBe('allow');

    const onboarding = {
      brand: 'BMW', model: '330Ci', generation: 'E46', variant: '3.0', year: 2003, mileageKm: 180_000, market: 'EU',
      majorAccidents: false, seriousBreakdowns: false, engineReplaced: false, transmissionReplaced: false, historyContext: '',
      hasModifications: true, modificationCategories: ['cooling' as const], otherModifications: '', primaryUse: 'weekend' as const,
      objective: 'stage_1' as const, otherObjective: '', wantsAestheticRecommendations: true, aestheticStyle: 'OEM+', consentAccepted: true as const,
    };
    for (let step = 0; step < 7; step += 1) expect(validateOnboardingStep(step, onboarding)).toEqual([]);
    expect(premiumOnboardingSchema.parse(onboarding).brand).toBe('BMW');

    let vehicle: UserVehicle = {
      ...metadata, id: 'vehicle-1', ownerId: 'user-1', variantId: 'variant-1',
      variantSnapshot: { brand: 'BMW', model: '330Ci', generation: 'E46', variant: '3.0', market: 'EU' },
      variantResolutionStatus: 'confirmed', year: 2003, mileageKm: 180_000, primaryUse: 'weekend', condition: 'good', power: {}, currentGoalId: 'goal-1', profileCompleteness: 100,
    };
    expect(deriveGarageViewState({ activeVehicle: { ...vehicle.variantSnapshot, id: vehicle.id, year: vehicle.year, mileageKm: vehicle.mileageKm, variantResolutionStatus: 'confirmed', profileCompleteness: 100 }, loading: false })).toBe('ready');

    const task: MaintenanceTask = { ...metadata, id: 'task-1', ownerId: 'user-1', userVehicleId: vehicle.id, maintenanceDefinitionId: 'oil', title: 'Servicio aprobado', intervalKm: 10_000, intervalMonths: 12, severity: 'important', status: 'upcoming', reminder: { byTime: true, byMileage: true }, recommendationStatus: 'approved_definition', adaptationReasons: [] };
    const maintenance = completeMaintenanceTask(task, { performedAt: now, mileageKm: 180_100, notes: 'Aceite y filtro', reminderByTime: true, reminderByMileage: true }, now, 'record-1');
    expect(maintenance.record.mileageKm).toBe(180_100);
    expect(maintenance.task.nextDueMileageKm).toBe(190_100);

    vehicle = applyVehicleMileage(vehicle, 180_250, new Date('2026-07-13T11:00:00.000Z'));
    expect(vehicle.mileageKm).toBe(180_250);
    expect(() => applyVehicleMileage(vehicle, 170_000)).toThrow(/inferior/);

    let goal: ProjectGoal = { ...metadata, id: 'goal-1', ownerId: 'user-1', userVehicleId: vehicle.id, type: 'street_performance', title: 'Stage 1', usageConstraints: [], comfortPriority: 6, legalRoadUseRequired: true, feasibility: 'realistic', status: 'active' };
    goal = { ...goal, type: 'reliability', title: 'Fiabilidad', updatedAt: new Date('2026-07-13T11:05:00.000Z') };
    expect(goal.type).toBe('reliability');

    const master: VehicleMaster = { ...metadata, id: 'variant-1', brandId: 'bmw', modelId: '330ci', generationId: 'e46', engineId: 'm54b30', displayName: 'BMW 330Ci E46', market: 'EU', productionStartYear: 2000, power: { stockPowerCv: 231 }, stockTorqueNm: 300, provenance };
    const definition: ModificationDefinition = { ...metadata, id: 'cooling', title: 'Revisión de refrigeración', category: 'engine', description: 'Base documentada', compatibleVariantIds: ['variant-1'], prerequisiteModificationIds: [], incompatibleModificationIds: [], legalImpact: 'none_known', riskLevel: 'low', applicableGoalTypes: ['reliability'], provenance };
    const initialRoute = calculateModificationRoute([definition], [], goal, vehicle, master);
    expect(initialRoute.current?.definition.id).toBe('cooling');
    const installed: InstalledModification = { ...metadata, id: 'installed-cooling', ownerId: 'user-1', userVehicleId: vehicle.id, modificationId: 'cooling', installedAt: now, mileageKm: vehicle.mileageKm, tuneRequired: false, homologationStatus: 'not_required', documentMediaIds: [], compatibilityStatus: 'confirmed', confidence: provenance.confidence, reviewStatus: 'draft', active: true };
    expect(calculateModificationRoute([definition], [installed], goal, vehicle, master).completed).toHaveLength(1);

    const textEvidence: DiagnosticEvidence = { ...metadata, id: 'evidence-text', ownerId: 'user-1', userVehicleId: vehicle.id, diagnosticSessionId: 'diagnostic-1', type: 'text', purpose: 'Síntoma', textContent: 'Vibración al acelerar', uploadStatus: 'uploaded', analysisStatus: 'queued', retentionClass: 'project' };
    const imageEvidence: DiagnosticEvidence = { ...metadata, id: 'evidence-image', ownerId: 'user-1', userVehicleId: vehicle.id, diagnosticSessionId: 'diagnostic-1', type: 'image', purpose: 'Fotografía simulada', storagePath: `users/user-1/vehicles/${vehicle.id}/diagnostics/diagnostic-1/photo.jpg`, contentType: 'image/jpeg', sizeBytes: 1_024, uploadStatus: 'uploaded', analysisStatus: 'queued', retentionClass: 'project' };
    const diagnosis = await new ConservativeKnownIssuesProvider().analyze({ symptoms: 'Vibración al acelerar', severityDeclared: 'medium', context: { occurrence: 'Intermitente', engineTemperature: 'hot', drivingPhases: ['accelerating'] }, evidence: [textEvidence, imageEvidence], vehicleContext: { vehicle, master, installedModifications: [installed], knownIssues: [] } });
    expect(diagnosis.confidence).toBe('unverified');
    expect(diagnosis.drivingAdvice).toBe('insufficient_information');
    expect(diagnosis.professionalInspectionRecommendation).toContain('no sustituye');

    const persisted = JSON.stringify({ userId: 'user-1', entitlement: 'active', vehicle, maintenance, goal, installed, diagnosis, conversation: [{ role: 'user', content: '¿Cuál es mi siguiente paso?' }, { role: 'assistant', content: 'Necesito confirmar los datos técnicos aprobados.' }] });
    const restored = JSON.parse(persisted) as { entitlement: string; vehicle: { mileageKm: number }; conversation: unknown[] };
    expect(restored).toMatchObject({ entitlement: 'active', vehicle: { mileageKm: 180_250 } });
    expect(restored.conversation).toHaveLength(2);
    expect(decideRouteAccess({ area: 'premium', authStatus: 'unauthenticated', accessStatus: 'free', roles: [] })).toBe('sign_in');
    expect(decideRouteAccess({ area: 'admin', authStatus: 'authenticated', accessStatus: 'premium', roles: [] })).toBe('forbidden');
  });

  it('representa estados de datos incompletos, sin vehículo e investigación pendiente', () => {
    expect(deriveGarageViewState({ activeVehicle: null, loading: false })).toBe('no_vehicle');
    expect(deriveGarageViewState({ activeVehicle: { brand: 'BMW', model: '330Ci', generation: 'E46', variant: '3.0', variantResolutionStatus: 'unresolved', profileCompleteness: 100 }, loading: false })).toBe('research_pending');
    expect(deriveGarageViewState({ activeVehicle: { brand: 'BMW', model: '330Ci', generation: '', variant: '', variantResolutionStatus: 'confirmed', profileCompleteness: 40 }, loading: false })).toBe('incomplete');
  });
});
