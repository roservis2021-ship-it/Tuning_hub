export interface VehicleVisualInput {
  brand?: string;
  model?: string;
  generation?: string;
  engine?: string;
}

export function getVehicleImage(vehicle?: VehicleVisualInput | null): string;
export function getVehiclePhoto(vehicle?: VehicleVisualInput | null): string | null;
