const MODIFICATION_CATEGORIES = new Set(['engine', 'intake', 'exhaust', 'turbo', 'cooling', 'fuel', 'electronics', 'transmission', 'suspension', 'brakes', 'wheels_tyres', 'aesthetic']);
const USES = new Set(['daily', 'weekend', 'travel', 'track', 'drift', 'rally', 'show', 'mixed']);
const OBJECTIVES = new Set(['reliability', 'maintenance', 'stage_1', 'stage_2', 'stage_3', 'custom_power', 'track', 'drift', 'rally', 'show_car', 'oem_plus', 'other']);

function text(value, maximum, required = false) {
  const normalized = typeof value === 'string' ? value.trim().slice(0, maximum) : '';
  if (required && !normalized) throw new Error('Faltan datos obligatorios del onboarding.');
  return normalized;
}

export function validatePremiumOnboarding(payload) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) throw new Error('El onboarding no es válido.');
  const year = Number(payload.year);
  const mileageKm = Number(payload.mileageKm);
  if (!Number.isInteger(year) || year < 1886 || year > new Date().getFullYear() + 1) throw new Error('El año no es válido.');
  if (!Number.isInteger(mileageKm) || mileageKm < 0 || mileageKm > 2_000_000) throw new Error('El kilometraje no es válido.');
  if (!USES.has(payload.primaryUse) || !OBJECTIVES.has(payload.objective)) throw new Error('El uso o el objetivo no es válido.');
  if (payload.consentAccepted !== true) throw new Error('Es necesario aceptar el tratamiento de datos.');
  const hasModifications = payload.hasModifications === true;
  const modificationCategories = Array.isArray(payload.modificationCategories)
    ? [...new Set(payload.modificationCategories.filter((category) => MODIFICATION_CATEGORIES.has(category)))]
    : [];
  const otherModifications = text(payload.otherModifications, 1_000);
  if (hasModifications && modificationCategories.length === 0 && !otherModifications) throw new Error('Describe al menos una modificación actual.');
  const customPowerCv = payload.objective === 'custom_power' ? Number(payload.customPowerCv) : null;
  if (payload.objective === 'custom_power' && (!Number.isInteger(customPowerCv) || customPowerCv <= 0 || customPowerCv > 3_000)) throw new Error('La potencia objetivo no es válida.');
  const otherObjective = text(payload.otherObjective, 500);
  if (payload.objective === 'other' && !otherObjective) throw new Error('Describe el objetivo personalizado.');
  const wantsAestheticRecommendations = payload.wantsAestheticRecommendations === true;
  const aestheticStyle = text(payload.aestheticStyle, 120);
  if (wantsAestheticRecommendations && !aestheticStyle) throw new Error('Selecciona un estilo estético.');

  return {
    brand: text(payload.brand, 80, true), model: text(payload.model, 80, true), generation: text(payload.generation, 80, true),
    variant: text(payload.variant, 120, true), year, mileageKm, market: text(payload.market, 80),
    majorAccidents: payload.majorAccidents === true, seriousBreakdowns: payload.seriousBreakdowns === true,
    engineReplaced: payload.engineReplaced === true, transmissionReplaced: payload.transmissionReplaced === true,
    historyContext: text(payload.historyContext, 2_000), hasModifications, modificationCategories, otherModifications,
    primaryUse: payload.primaryUse, objective: payload.objective, customPowerCv, otherObjective,
    wantsAestheticRecommendations, aestheticStyle, consentAccepted: true,
  };
}

export function mapVehicleUse(primaryUse) {
  if (primaryUse === 'track') return 'track';
  if (primaryUse === 'drift' || primaryUse === 'rally') return 'competition';
  if (primaryUse === 'show') return 'show';
  if (primaryUse === 'mixed') return 'mixed';
  if (primaryUse === 'weekend' || primaryUse === 'travel') return 'weekend';
  return 'daily';
}

export function mapGoalType(objective) {
  if (objective === 'reliability' || objective === 'maintenance') return 'reliability';
  if (objective === 'track' || objective === 'drift' || objective === 'rally') return 'track';
  if (objective === 'show_car' || objective === 'oem_plus') return 'aesthetic';
  if (objective === 'other') return 'custom';
  return 'street_performance';
}
