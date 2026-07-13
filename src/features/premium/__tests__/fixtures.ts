import type { TechnicalProvenance, UserVehicle } from '../models';

export const fixedDate = new Date('2026-07-12T12:00:00.000Z');

export const reviewedProvenance: TechnicalProvenance = {
  sourceIds: ['source-manual'],
  confidence: {
    level: 'verified',
    rationale: 'Checked against the referenced manufacturer document.',
    assessedBy: 'editor',
    assessedAt: fixedDate,
  },
  reviewStatus: 'approved',
  researchedAt: fixedDate,
  reviewedAt: fixedDate,
  reviewedBy: 'reviewer-1',
};

export const userVehicleFixture: UserVehicle = {
  id: 'vehicle-1',
  schemaVersion: 1,
  ownerId: 'user-1',
  variantId: 'variant-1',
  variantSnapshot: {
    brand: 'Test brand',
    model: 'Test model',
    generation: 'Test generation',
    variant: 'Test variant',
  },
  variantResolutionStatus: 'confirmed',
  year: 2020,
  mileageKm: 50_000,
  primaryUse: 'daily',
  condition: 'good',
  power: {
    stockPowerCv: 200,
    estimatedPowerCv: 220,
    userDeclaredPowerCv: 215,
  },
  profileCompleteness: 90,
  createdAt: fixedDate,
  updatedAt: fixedDate,
};
