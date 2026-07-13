import { describe, expect, it } from 'vitest';
import type { InstalledModification, ModificationDefinition, ProjectGoal, UserVehicle, VehicleMaster } from '../models';
import { calculateModificationRoute } from '../modifications/modificationRoute';

const now = new Date('2026-07-12T10:00:00.000Z');
const metadata = { schemaVersion: 1, createdAt: now, updatedAt: now };
const provenance = { sourceIds: ['source-1'], confidence: { level: 'verified' as const, rationale: 'Reviewed fixture', assessedBy: 'editor' as const, assessedAt: now }, reviewStatus: 'published' as const };
const vehicle: UserVehicle = { ...metadata, id: 'vehicle-1', ownerId: 'user-1', variantId: 'variant-1', variantSnapshot: { brand: 'Brand', model: 'Model', generation: 'G1', variant: 'Sport' }, variantResolutionStatus: 'confirmed', year: 2020, mileageKm: 60_000, primaryUse: 'daily', condition: 'good', power: {}, currentGoalId: 'goal-1', profileCompleteness: 100 };
const goal: ProjectGoal = { ...metadata, id: 'goal-1', ownerId: 'user-1', userVehicleId: 'vehicle-1', type: 'street_performance', title: 'Street', usageConstraints: [], comfortPriority: 5, legalRoadUseRequired: true, feasibility: 'realistic', status: 'active' };
const master: VehicleMaster = { ...metadata, id: 'variant-1', brandId: 'brand-1', modelId: 'model-1', generationId: 'generation-1', engineId: 'engine-1', displayName: 'Model Sport', market: 'EU', productionStartYear: 2020, power: { stockPowerCv: 200 }, stockTorqueNm: 300, provenance };

function definition(id: string, overrides: Partial<ModificationDefinition> = {}): ModificationDefinition {
  return { ...metadata, id, title: id, category: 'engine', description: `Description ${id}`, compatibleVariantIds: ['variant-1'], prerequisiteModificationIds: [], incompatibleModificationIds: [], legalImpact: 'documentation', riskLevel: 'low', applicableGoalTypes: ['street_performance'], provenance, ...overrides };
}

function installed(modificationId: string): InstalledModification {
  return { ...metadata, id: `installed-${modificationId}`, ownerId: 'user-1', userVehicleId: 'vehicle-1', modificationId, tuneRequired: false, homologationStatus: 'unknown', documentMediaIds: [], compatibilityStatus: 'confirmed', confidence: provenance.confidence, reviewStatus: 'draft', active: true };
}

describe('personalized modification route', () => {
  it('orders prerequisites before dependent modifications and advances after installation', () => {
    const base = definition('cooling', { category: 'engine' });
    const dependent = definition('ecu', { category: 'ecu', prerequisiteModificationIds: ['cooling'] });
    const initial = calculateModificationRoute([dependent, base], [], goal, vehicle, master);
    expect(initial.steps.map((step) => step.definition.id)).toEqual(['cooling', 'ecu']);
    expect(initial.current?.definition.id).toBe('cooling');
    expect(initial.later.map((step) => step.definition.id)).toContain('ecu');
    const recalculated = calculateModificationRoute([dependent, base], [installed('cooling')], goal, vehicle, master);
    expect(recalculated.completed.map((step) => step.definition.id)).toContain('cooling');
    expect(recalculated.current?.definition.id).toBe('ecu');
  });

  it('never recommends a critical modification with missing requirements or an unsafe declared state', () => {
    const critical = definition('critical', { riskLevel: 'specialist_required', prerequisiteModificationIds: ['missing'] });
    const result = calculateModificationRoute([critical], [], goal, { ...vehicle, condition: 'needs_inspection' }, master);
    expect(result.current).toBeUndefined();
    expect(result.blocked[0]).toMatchObject({ status: 'blocked', missingPrerequisiteIds: ['missing'] });
    expect(result.blocked[0]?.blockedReasons).toContain('Una modificación crítica no puede recomendarse hasta completar todos sus requisitos previos.');
  });

  it('filters by exact vehicle and goal and only calculates documented ranges', () => {
    const valid = definition('valid', { estimatedPowerGainCv: { minimum: 10, maximum: 20 }, estimatedTorqueGainNm: { minimum: 15, maximum: 25 } });
    const wrongGoal = definition('aesthetic', { applicableGoalTypes: ['aesthetic'] });
    const wrongVehicle = definition('other-car', { compatibleVariantIds: ['variant-2'] });
    const result = calculateModificationRoute([valid, wrongGoal, wrongVehicle], [], goal, vehicle, master);
    expect(result.steps.map((step) => step.definition.id)).toEqual(['valid']);
    expect(result.estimatedFinalPowerCv).toEqual({ minimum: 210, maximum: 220 });
    expect(result.estimatedFinalTorqueNm).toEqual({ minimum: 315, maximum: 325 });
  });
});
