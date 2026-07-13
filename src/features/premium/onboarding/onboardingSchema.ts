import { z } from 'zod';

export const modificationCategorySchema = z.enum([
  'engine', 'intake', 'exhaust', 'turbo', 'cooling', 'fuel', 'electronics', 'transmission',
  'suspension', 'brakes', 'wheels_tyres', 'aesthetic',
]);

export const vehicleUseSchema = z.enum(['daily', 'weekend', 'travel', 'track', 'drift', 'rally', 'show', 'mixed']);
export const projectObjectiveSchema = z.enum([
  'reliability', 'maintenance', 'stage_1', 'stage_2', 'stage_3', 'custom_power',
  'track', 'drift', 'rally', 'show_car', 'oem_plus', 'other',
]);

const identificationSchema = z.object({
  brand: z.string().trim().min(1, 'Indica la marca.'),
  model: z.string().trim().min(1, 'Indica el modelo.'),
  generation: z.string().trim().min(1, 'Indica la generación.'),
  variant: z.string().trim().min(1, 'Indica la versión.'),
  year: z.number().int().min(1886, 'Indica un año válido.').max(new Date().getFullYear() + 1),
  mileageKm: z.number().int().nonnegative('El kilometraje no puede ser negativo.').max(2_000_000),
  market: z.string().trim().max(80),
}).strict();

const historySchema = z.object({
  majorAccidents: z.boolean(), seriousBreakdowns: z.boolean(), engineReplaced: z.boolean(),
  transmissionReplaced: z.boolean(), historyContext: z.string().trim().max(2_000),
}).strict();

const modificationsSchema = z.object({
  hasModifications: z.boolean(), modificationCategories: z.array(modificationCategorySchema),
  otherModifications: z.string().trim().max(1_000),
}).strict().refine((value) => !value.hasModifications || value.modificationCategories.length > 0 || value.otherModifications.length > 0, {
  message: 'Selecciona al menos una categoría o describe la modificación.', path: ['modificationCategories'],
});

const usageSchema = z.object({ primaryUse: vehicleUseSchema }).strict();
const objectiveStepSchema = z.object({
  objective: projectObjectiveSchema,
  customPowerCv: z.number().int().positive().max(3_000).optional(),
  otherObjective: z.string().trim().max(500),
}).strict().superRefine((value, context) => {
  if (value.objective === 'custom_power' && value.customPowerCv === undefined) context.addIssue({ code: 'custom', message: 'Indica la potencia objetivo.', path: ['customPowerCv'] });
  if (value.objective === 'other' && value.otherObjective.length === 0) context.addIssue({ code: 'custom', message: 'Describe tu objetivo.', path: ['otherObjective'] });
});

const aestheticSchema = z.object({
  wantsAestheticRecommendations: z.boolean(), aestheticStyle: z.string().trim().max(120),
}).strict().refine((value) => !value.wantsAestheticRecommendations || value.aestheticStyle.length > 0, {
  message: 'Selecciona un estilo estético.', path: ['aestheticStyle'],
});

const consentSchema = z.object({ consentAccepted: z.literal(true, { error: 'Debes aceptar el tratamiento de estos datos.' }) }).strict();

export const premiumOnboardingSchema = identificationSchema
  .and(historySchema)
  .and(modificationsSchema)
  .and(usageSchema)
  .and(objectiveStepSchema)
  .and(aestheticSchema)
  .and(consentSchema);

export type PremiumOnboardingInput = z.infer<typeof premiumOnboardingSchema>;

export const premiumOnboardingDraftSchema = z.object({
  brand: z.string(), model: z.string(), generation: z.string(), variant: z.string(), year: z.number(), mileageKm: z.number(),
  market: z.string(), majorAccidents: z.boolean(), seriousBreakdowns: z.boolean(),
  engineReplaced: z.boolean(), transmissionReplaced: z.boolean(), historyContext: z.string(), hasModifications: z.boolean(),
  modificationCategories: z.array(modificationCategorySchema), otherModifications: z.string(), primaryUse: vehicleUseSchema,
  objective: projectObjectiveSchema, customPowerCv: z.number().optional(), otherObjective: z.string(),
  wantsAestheticRecommendations: z.boolean(), aestheticStyle: z.string(), consentAccepted: z.boolean(),
}).strict();

export type PremiumOnboardingDraft = z.infer<typeof premiumOnboardingDraftSchema>;

export const onboardingStepSchemas = [
  identificationSchema, historySchema, modificationsSchema, usageSchema, objectiveStepSchema, aestheticSchema, consentSchema,
] as const;

const onboardingStepFields = [
  ['brand', 'model', 'generation', 'variant', 'year', 'mileageKm', 'market'],
  ['majorAccidents', 'seriousBreakdowns', 'engineReplaced', 'transmissionReplaced', 'historyContext'],
  ['hasModifications', 'modificationCategories', 'otherModifications'], ['primaryUse'],
  ['objective', 'customPowerCv', 'otherObjective'], ['wantsAestheticRecommendations', 'aestheticStyle'], ['consentAccepted'],
] as const;

export function validateOnboardingStep(stepIndex: number, value: unknown): string[] {
  const schema = onboardingStepSchemas[stepIndex];
  const fields = onboardingStepFields[stepIndex];
  if (!schema || !fields || !isRecord(value)) return ['Paso desconocido.'];
  const stepValue = Object.fromEntries(fields.map((field) => [field, value[field]]));
  const result = schema.safeParse(stepValue);
  return result.success ? [] : result.error.issues.map((issue) => issue.message);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
