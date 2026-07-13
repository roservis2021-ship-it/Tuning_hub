import { describe, expect, it } from 'vitest';
import type { EngineMaster, TransmissionMaster, UserVehicle, VehicleIssue, VehicleMaster } from '../models';
import { buildVehicleModuleData } from '../vehicle/vehicleModuleData';

const now = new Date('2026-07-12T10:00:00.000Z');
const metadata = { schemaVersion: 1, createdAt: now, updatedAt: now };
const approvedProvenance = {
  sourceIds: ['source-1'],
  confidence: { level: 'verified' as const, rationale: 'Validated test fixture', assessedBy: 'editor' as const, assessedAt: now },
  reviewStatus: 'published' as const,
};

const userVehicle: UserVehicle = {
  ...metadata,
  id: 'user-vehicle-1',
  ownerId: 'user-1',
  variantId: 'variant-1',
  variantSnapshot: { brand: 'Example', model: 'Model', generation: 'G1', variant: 'Sport', market: 'EU' },
  variantResolutionStatus: 'confirmed',
  year: 2020,
  mileageKm: 42_000,
  primaryUse: 'daily',
  condition: 'good',
  power: { userDeclaredPowerCv: 230 },
  profileCompleteness: 100,
};

const master: VehicleMaster = {
  ...metadata,
  id: 'variant-1',
  brandId: 'brand-1',
  modelId: 'model-1',
  generationId: 'generation-1',
  engineId: 'engine-1',
  transmissionId: 'transmission-1',
  displayName: 'Example Model Sport',
  market: 'EU',
  productionStartYear: 2020,
  driveLayout: 'rwd',
  power: { stockPowerCv: 250 },
  stockTorqueNm: 320,
  wheelFitment: { pcd: '5x100', compatibleSizes: ['225/45 R18'] },
  strengths: ['Balanced chassis'],
  weaknesses: ['Limited cooling margin'],
  knownRiskIds: ['risk-1'],
  tuningHubRating: 8.4,
  provenance: approvedProvenance,
};

const engine: EngineMaster = {
  ...metadata,
  id: 'engine-1', manufacturer: 'Example', code: 'ENG-1', fuel: 'petrol', induction: 'turbo', displacementCc: 1998,
  markets: ['EU'], architecture: 'Inline four', injection: 'Direct', oil: { recommendedViscosity: '5W-30', capacityLitres: 5.2 },
  provenance: approvedProvenance,
};

const transmission: TransmissionMaster = {
  ...metadata,
  id: 'transmission-1', manufacturer: 'Example', code: 'TR-1', type: 'automatic', gears: 8, driveLayout: 'rwd',
  knownIssueIds: [], serviceRequirementIds: [], compatibleVariantIds: ['variant-1'], provenance: approvedProvenance,
};

const risk: VehicleIssue = {
  ...metadata,
  id: 'risk-1', scope: 'master_known_issue', applicableVariantIds: ['variant-1'], title: 'Cooling degradation', symptoms: [], possibleCauses: [],
  severity: 'medium', status: 'known', obdCodes: [], provenance: approvedProvenance,
};

describe('vehicle module data', () => {
  it('prioritises published master data and labels it as confirmed', () => {
    const result = buildVehicleModuleData(userVehicle, master, engine, transmission, [risk]);
    const power = result.highlights.find((field) => field.key === 'power');
    const riskField = result.cards.find((card) => card.id === 'assessment')?.fields.find((field) => field.key === 'risks');

    expect(power).toMatchObject({ value: 250, unit: 'CV', status: 'confirmed' });
    expect(riskField).toMatchObject({ value: ['Cooling degradation'], status: 'confirmed' });
    expect(result.sourceCount).toBe(1);
    expect(result.masterDataConfirmed).toBe(true);
  });

  it('does not expose unreviewed technical values or invent missing values', () => {
    const draftMaster: VehicleMaster = {
      ...master,
      stockTorqueNm: 999,
      provenance: { ...approvedProvenance, reviewStatus: 'ai_draft', confidence: { ...approvedProvenance.confidence, level: 'unverified' } },
    };
    const result = buildVehicleModuleData(userVehicle, draftMaster, null, null, []);
    const torque = result.highlights.find((field) => field.key === 'torque');
    const oil = result.cards.find((card) => card.id === 'oil');

    expect(result.highlights.find((field) => field.key === 'power')).toMatchObject({ value: 230, status: 'declared' });
    expect(torque).toMatchObject({ status: 'pending' });
    expect(torque).not.toHaveProperty('value');
    expect(oil?.fields.every((field) => field.status === 'pending' && field.value === undefined)).toBe(true);
    expect(result.masterDataConfirmed).toBe(false);
  });
});
