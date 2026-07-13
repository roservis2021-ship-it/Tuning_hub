import { describe, expect, it } from 'vitest';
import { mapGoalType, mapVehicleUse, validatePremiumOnboarding } from './onboarding.mjs';

const validPayload = {
  brand: 'BMW', model: '330Ci', generation: 'E46', variant: '3.0', year: 2003, mileageKm: 180000, market: 'EU',
  majorAccidents: false, seriousBreakdowns: false, engineReplaced: false, transmissionReplaced: false, historyContext: '',
  hasModifications: true, modificationCategories: ['intake', 'brakes'], otherModifications: '', primaryUse: 'weekend',
  objective: 'stage_1', otherObjective: '', wantsAestheticRecommendations: true, aestheticStyle: 'OEM+', consentAccepted: true,
};

describe('Premium onboarding validation', () => {
  it('accepts declared data without adding technical specifications', () => {
    const result = validatePremiumOnboarding(validPayload);
    expect(result).toMatchObject({ brand: 'BMW', modificationCategories: ['intake', 'brakes'], objective: 'stage_1' });
    expect(result).not.toHaveProperty('registrationOrVin');
    expect(result).not.toHaveProperty('stockPowerCv');
  });

  it('requires consent and validates conditional answers', () => {
    expect(() => validatePremiumOnboarding({ ...validPayload, consentAccepted: false })).toThrow();
    expect(() => validatePremiumOnboarding({ ...validPayload, objective: 'custom_power' })).toThrow();
    expect(() => validatePremiumOnboarding({ ...validPayload, hasModifications: true, modificationCategories: [] })).toThrow();
  });

  it('normalizes supported use and goal values', () => {
    expect(mapVehicleUse('drift')).toBe('competition');
    expect(mapVehicleUse('travel')).toBe('weekend');
    expect(mapGoalType('oem_plus')).toBe('aesthetic');
    expect(mapGoalType('stage_2')).toBe('street_performance');
  });
});
