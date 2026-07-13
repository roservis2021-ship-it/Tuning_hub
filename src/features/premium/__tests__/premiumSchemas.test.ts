import { describe, expect, it } from 'vitest';
import { installedModificationSchema, maintenanceDefinitionSchema, technicalSourceSchema, userVehicleSchema } from '../schemas/premiumSchemas';
import { fixedDate, userVehicleFixture } from './fixtures';

describe('Premium input schemas', () => {
  it('keeps the three power origins separate and normalizes dates', () => {
    const parsed = userVehicleSchema.parse({
      ...userVehicleFixture,
      createdAt: fixedDate.toISOString(),
      updatedAt: fixedDate.getTime(),
    });

    expect(parsed.createdAt).toEqual(fixedDate);
    expect(parsed.updatedAt).toEqual(fixedDate);
    expect(parsed.power).toEqual({ stockPowerCv: 200, estimatedPowerCv: 220, userDeclaredPowerCv: 215 });
  });

  it('rejects unknown input fields', () => {
    expect(() => userVehicleSchema.parse({ ...userVehicleFixture, hiddenTechnicalClaim: 'invented' })).toThrow();
  });

  it('requires a traceable technical source location', () => {
    expect(() => technicalSourceSchema.parse({
      id: 'source-1', schemaVersion: 1, title: 'Untraceable source', type: 'other',
      accessedAt: fixedDate, status: 'pending_review', createdAt: fixedDate, updatedAt: fixedDate,
    })).toThrow();
  });

  it('requires an interval for maintenance definitions', () => {
    expect(() => maintenanceDefinitionSchema.parse({
      id: 'maintenance-1', schemaVersion: 1, title: 'Inspection', description: 'Inspect item',
      applicableVariantIds: [], applicableEngineIds: [], severity: 'routine', prerequisiteForModificationIds: [],
      provenance: { sourceIds: [], confidence: { level: 'unverified', rationale: 'Pending research', assessedBy: 'system', assessedAt: fixedDate }, reviewStatus: 'draft' },
      createdAt: fixedDate, updatedAt: fixedDate,
    })).toThrow();
  });

  it('requires a catalogue id or a custom name for installed modifications', () => {
    expect(() => installedModificationSchema.parse({
      id: 'installed-1', schemaVersion: 1, ownerId: 'user-1', userVehicleId: 'vehicle-1', tuneRequired: false,
      homologationStatus: 'unknown', documentMediaIds: [], compatibilityStatus: 'unknown',
      confidence: { level: 'unverified', rationale: 'User has not provided evidence', assessedBy: 'system', assessedAt: fixedDate },
      reviewStatus: 'draft', active: true, createdAt: fixedDate, updatedAt: fixedDate,
    })).toThrow();
  });
});
