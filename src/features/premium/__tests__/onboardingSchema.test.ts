import { describe, expect, it } from 'vitest';
import { premiumOnboardingSchema, validateOnboardingStep } from '../onboarding/onboardingSchema';

const validOnboarding = {
  brand: 'BMW', model: '330Ci', generation: 'E46', variant: '3.0', year: 2003, mileageKm: 180000,
  market: 'EU', majorAccidents: false, seriousBreakdowns: false, engineReplaced: false,
  transmissionReplaced: false, historyContext: '', hasModifications: true, modificationCategories: ['intake'],
  otherModifications: '', primaryUse: 'weekend', objective: 'stage_1', otherObjective: '',
  wantsAestheticRecommendations: true, aestheticStyle: 'OEM+', consentAccepted: true,
} as const;

describe('Premium onboarding steps', () => {
  it('validates each step while ignoring fields from the other steps', () => {
    expect(validateOnboardingStep(0, validOnboarding)).toEqual([]);
    expect(validateOnboardingStep(2, validOnboarding)).toEqual([]);
    expect(validateOnboardingStep(6, validOnboarding)).toEqual([]);
  });

  it('requires modification detail only when the user declares modifications', () => {
    expect(validateOnboardingStep(2, { ...validOnboarding, modificationCategories: [] })).not.toEqual([]);
    expect(validateOnboardingStep(2, { ...validOnboarding, hasModifications: false, modificationCategories: [] })).toEqual([]);
  });

  it('requires explicit consent before final submission', () => {
    expect(premiumOnboardingSchema.safeParse(validOnboarding).success).toBe(true);
    expect(premiumOnboardingSchema.safeParse({ ...validOnboarding, consentAccepted: false }).success).toBe(false);
  });
});
