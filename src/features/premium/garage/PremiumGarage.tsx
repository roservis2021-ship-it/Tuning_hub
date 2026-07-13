import { useEffect, useState } from 'react';
import { getVehicleImage } from '../../../services/vehicleVisuals';
import { db, storage } from '../../../firebase/config';
import { useAuth } from '../auth/AuthContext';
import { loadVehicleModuleData } from '../vehicle/vehicleModuleData';
import type { VehicleModuleData } from '../vehicle/vehicleModuleTypes';
import { loadMaintenanceModuleData, type MaintenanceModuleData } from '../maintenance/maintenanceModuleData';
import { loadModificationModuleData, type ModificationModuleData } from '../modifications/modificationModuleData';
import { loadIssuesModuleData, type IssuesModuleData } from '../issues/issuesModuleData';
import { PremiumGarageLayout } from './PremiumGarageLayout';
import type { GarageVehicleIdentity } from './garageTypes';
import { updateVehicleMileage } from '../vehicle/vehicleMileageService';

interface SourceVehicle {
  brand?: string;
  model?: string;
  generation?: string;
  engine?: string;
  year?: string | number;
  mileageKm?: string | number;
  market?: string;
}

export function PremiumGarage({ vehicle, onBack }: { vehicle?: SourceVehicle | null; onBack?: () => void }) {
  const { user } = useAuth();
  const fallbackIdentity = createGarageVehicleIdentity(vehicle);
  const [vehicleData, setVehicleData] = useState<VehicleModuleData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [maintenanceData, setMaintenanceData] = useState<MaintenanceModuleData | null>(null);
  const [maintenanceLoading, setMaintenanceLoading] = useState(true);
  const [maintenanceError, setMaintenanceError] = useState<string | null>(null);
  const [modificationData, setModificationData] = useState<ModificationModuleData | null>(null);
  const [modificationLoading, setModificationLoading] = useState(true);
  const [modificationError, setModificationError] = useState<string | null>(null);
  const [issuesData, setIssuesData] = useState<IssuesModuleData | null>(null);
  const [issuesLoading, setIssuesLoading] = useState(true);
  const [issuesError, setIssuesError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    if (!user) { setLoading(false); return undefined; }
    loadVehicleModuleData(db, user.uid)
      .then((data) => {
        if (!active) return;
        setVehicleData(data ? { ...data, vehicle: { ...data.vehicle, imageUrl: getVehicleImage(data.vehicle) } } : null);
        setError(null);
      })
      .catch(() => { if (active) setError('No se pudo recuperar la ficha del vehículo.'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [user]);

  async function reloadModifications() {
    if (!user) return;
    setModificationLoading(true);
    try { setModificationData(await loadModificationModuleData(db, user.uid)); setModificationError(null); }
    catch { setModificationError('No se pudo recuperar la ruta de modificaciones.'); }
    finally { setModificationLoading(false); }
  }

  useEffect(() => { void reloadModifications(); }, [user]);

  async function reloadIssues() {
    if (!user) return;
    setIssuesLoading(true);
    try { setIssuesData(await loadIssuesModuleData(db, user.uid)); setIssuesError(null); }
    catch { setIssuesError('No se pudo recuperar el historial de diagnósticos.'); }
    finally { setIssuesLoading(false); }
  }

  useEffect(() => { void reloadIssues(); }, [user]);

  useEffect(() => {
    let active = true;
    if (!user) { setMaintenanceLoading(false); return undefined; }
    loadMaintenanceModuleData(db, user.uid).then((data) => { if (active) { setMaintenanceData(data); setMaintenanceError(null); } })
      .catch(() => { if (active) setMaintenanceError('No se pudo recuperar el plan de mantenimiento.'); })
      .finally(() => { if (active) setMaintenanceLoading(false); });
    return () => { active = false; };
  }, [user]);

  const activeVehicle = vehicleData?.vehicle ?? fallbackIdentity;

  async function saveMileage(mileageKm: number) {
    if (!user || !vehicleData?.vehicle.id) throw new Error('No hay un vehículo activo para actualizar.');
    await updateVehicleMileage(db, user.uid, vehicleData.vehicle.id, mileageKm);
    setVehicleData((current) => current ? { ...current, vehicle: { ...current.vehicle, mileageKm } } : current);
    setMaintenanceData((current) => current ? { ...current, vehicle: { ...current.vehicle, mileageKm } } : current);
    setModificationData((current) => current ? { ...current, vehicle: { ...current.vehicle, mileageKm } } : current);
    setIssuesData((current) => current ? { ...current, vehicleContext: { ...current.vehicleContext, vehicle: { ...current.vehicleContext.vehicle, mileageKm } } } : current);
  }

  return <PremiumGarageLayout data={{ activeVehicle, loading: loading && !activeVehicle }} vehicleData={vehicleData} vehicleLoading={loading} vehicleError={error} maintenanceData={maintenanceData} maintenanceLoading={maintenanceLoading} maintenanceError={maintenanceError} modificationData={modificationData} modificationLoading={modificationLoading} modificationError={modificationError} issuesData={issuesData} issuesLoading={issuesLoading} issuesError={issuesError} firestore={db} storage={storage} onMaintenanceUpdated={setMaintenanceData} onModificationRecalculate={reloadModifications} onIssuesRefresh={reloadIssues} onMileageUpdate={saveMileage} onBack={onBack} />;
}

export function createGarageVehicleIdentity(vehicle?: SourceVehicle | null): GarageVehicleIdentity | null {
  if (!vehicle?.brand || !vehicle.model) return null;
  const year = Number(vehicle.year);
  const mileageKm = Number(vehicle.mileageKm);
  const completedFields = [vehicle.brand, vehicle.model, vehicle.generation, vehicle.engine, Number.isFinite(year), Number.isFinite(mileageKm)].filter(Boolean).length;
  return {
    brand: vehicle.brand, model: vehicle.model, generation: vehicle.generation ?? '', variant: vehicle.engine ?? '',
    ...(Number.isInteger(year) && year > 1885 ? { year } : {}),
    ...(Number.isFinite(mileageKm) && mileageKm >= 0 ? { mileageKm: Math.round(mileageKm) } : {}),
    ...(vehicle.market ? { market: vehicle.market } : {}), imageUrl: getVehicleImage(vehicle),
    variantResolutionStatus: 'unresolved', profileCompleteness: Math.round((completedFields / 6) * 100),
  };
}
