import { describe, expect, it } from 'vitest';
import { userVehicleFixture } from './fixtures';
import { applyVehicleMileage } from '../vehicle/vehicleMileageService';

describe('actualización de kilometraje', () => {
  it('acepta avances y conserva la separación del resto de datos del vehículo', () => {
    const updated = applyVehicleMileage(userVehicleFixture, 50_500, new Date('2026-07-13T12:00:00.000Z'));
    expect(updated).toMatchObject({ id: userVehicleFixture.id, mileageKm: 50_500, variantId: userVehicleFixture.variantId });
  });

  it('rechaza retrocesos, decimales y valores fuera de rango', () => {
    expect(() => applyVehicleMileage(userVehicleFixture, 49_999)).toThrow(/inferior/);
    expect(() => applyVehicleMileage(userVehicleFixture, 50_000.5)).toThrow();
    expect(() => applyVehicleMileage(userVehicleFixture, 2_000_001)).toThrow();
  });
});
