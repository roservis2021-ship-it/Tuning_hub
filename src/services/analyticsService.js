import { logEvent, setUserProperties } from 'firebase/analytics';
import { getFirebaseAnalytics } from '../firebase/config';

let analyticsPromise = null;

async function getAnalyticsInstance() {
  if (!analyticsPromise) {
    analyticsPromise = getFirebaseAnalytics();
  }

  return analyticsPromise;
}

export async function initAnalytics() {
  const analytics = await getAnalyticsInstance();

  if (!analytics) {
    return null;
  }

  setUserProperties(analytics, {
    app_context: 'tuning_hub',
    app_platform: 'web',
  });

  return analytics;
}

export async function trackBuildSearch(vehicle) {
  const analytics = await getAnalyticsInstance();

  if (!analytics) {
    return;
  }

  const searchTerm = [vehicle.brand, vehicle.model, vehicle.generation, vehicle.engine]
    .filter(Boolean)
    .join(' ');

  logEvent(analytics, 'search', {
    search_term: searchTerm || 'vehiculo',
    content_type: 'vehicle_build',
    brand: vehicle.brand || '',
    model: vehicle.model || '',
    generation: vehicle.generation || '',
    engine: vehicle.engine || '',
    powertrain: vehicle.powertrain || '',
  });
}

export async function trackBuildResult(result, vehicle) {
  const analytics = await getAnalyticsInstance();

  if (!analytics) {
    return;
  }

  logEvent(analytics, 'build_result_viewed', {
    estimated_budget: Number(result?.estimatedBudget) || 0,
    vehicle_name: [vehicle?.brand, vehicle?.model, vehicle?.generation, vehicle?.engine]
      .filter(Boolean)
      .join(' '),
    result_source: result?.source || 'unknown',
    powertrain: vehicle?.powertrain || 'unknown',
  });
}

export async function trackBuildError(errorMessage, code = 'unknown') {
  const analytics = await getAnalyticsInstance();

  if (!analytics) {
    return;
  }

  logEvent(analytics, 'exception', {
    description: errorMessage || 'build_error',
    fatal: false,
    error_code: code,
  });
}
