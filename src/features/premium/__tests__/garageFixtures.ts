import type { GarageData, GarageVehicleIdentity } from '../garage/garageTypes';

export const unresolvedVehicleFixture: GarageVehicleIdentity = {
  id: 'vehicle-test', brand: 'Test brand', model: 'Test model', generation: 'Generation', variant: 'Declared variant',
  year: 2020, mileageKm: 50_000, market: 'EU', variantResolutionStatus: 'unresolved', profileCompleteness: 75,
};

export const confirmedVehicleFixture: GarageVehicleIdentity = {
  ...unresolvedVehicleFixture, variantResolutionStatus: 'confirmed', profileCompleteness: 100,
};

export const readyGarageFixture: GarageData = { activeVehicle: confirmedVehicleFixture, loading: false };
