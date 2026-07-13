import type { Firestore } from 'firebase/firestore';
import { z } from 'zod';
import type { UserVehicle } from '../models';
import { createPremiumRepositories } from '../repositories/premiumRepositories';

const mileageSchema = z.number().int().nonnegative().max(2_000_000);

export function applyVehicleMileage(vehicle: UserVehicle, nextMileageKm: number, now = new Date()): UserVehicle {
  const mileageKm = mileageSchema.parse(nextMileageKm);
  if (mileageKm < vehicle.mileageKm) throw new Error('El nuevo kilometraje no puede ser inferior al registrado.');
  return { ...vehicle, mileageKm, updatedAt: now };
}

export async function updateVehicleMileage(firestore: Firestore, ownerId: string, vehicleId: string, nextMileageKm: number): Promise<UserVehicle> {
  const repository = createPremiumRepositories(firestore).userVehicles;
  const vehicle = await repository.getById(vehicleId);
  if (vehicle?.ownerId !== ownerId) throw new Error('No se pudo verificar el vehículo activo.');
  const updated = applyVehicleMileage(vehicle, nextMileageKm);
  await repository.save(updated);
  return updated;
}
