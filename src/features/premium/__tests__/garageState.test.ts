import { describe, expect, it } from 'vitest';
import { GARAGE_MODULES, deriveGarageViewState } from '../garage/garageState';
import { confirmedVehicleFixture, readyGarageFixture, unresolvedVehicleFixture } from './garageFixtures';

describe('Premium garage shell', () => {
  it('contains every required module without duplicates', () => {
    expect(GARAGE_MODULES.map((module) => module.id)).toEqual(['vehicle', 'maintenance', 'modifications', 'issues', 'advisor']);
    expect(new Set(GARAGE_MODULES.map((module) => module.id)).size).toBe(GARAGE_MODULES.length);
  });

  it('resolves loading and empty garage states first', () => {
    expect(deriveGarageViewState({ activeVehicle: null, loading: true })).toBe('loading');
    expect(deriveGarageViewState({ activeVehicle: null, loading: false })).toBe('no_vehicle');
  });

  it('does not present declared identity as researched knowledge', () => {
    expect(deriveGarageViewState({ activeVehicle: unresolvedVehicleFixture, loading: false })).toBe('research_pending');
  });

  it('distinguishes incomplete and ready confirmed vehicles', () => {
    expect(deriveGarageViewState({ activeVehicle: { ...confirmedVehicleFixture, profileCompleteness: 60 }, loading: false })).toBe('incomplete');
    expect(deriveGarageViewState(readyGarageFixture)).toBe('ready');
  });
});
