import { useMemo, useState, type ReactNode } from 'react';
import { GarageHeader } from './GarageHeader';
import { GarageModuleContent } from './GarageModules';
import { GarageNavigation } from './GarageNavigation';
import { GarageSpecialist } from './GarageSpecialist';
import { GarageStatePanel } from './GarageStatePanel';
import { deriveGarageViewState } from './garageState';
import type { GarageData, GarageModuleId } from './garageTypes';
import type { VehicleModuleData } from '../vehicle/vehicleModuleTypes';
import type { Firestore } from 'firebase/firestore';
import type { MaintenanceModuleData } from '../maintenance/maintenanceModuleData';
import type { ModificationModuleData } from '../modifications/modificationModuleData';
import type { FirebaseStorage } from 'firebase/storage';
import type { IssuesModuleData } from '../issues/issuesModuleData';

export function PremiumGarageLayout({ data, vehicleData, vehicleLoading = false, vehicleError, maintenanceData, maintenanceLoading = false, maintenanceError, modificationData, modificationLoading = false, modificationError, issuesData, issuesLoading = false, issuesError, firestore, storage, onMaintenanceUpdated, onModificationRecalculate, onIssuesRefresh, onMileageUpdate, onBack, emptyAction }: { data: GarageData; vehicleData?: VehicleModuleData | null; vehicleLoading?: boolean; vehicleError?: string | null; maintenanceData?: MaintenanceModuleData | null; maintenanceLoading?: boolean; maintenanceError?: string | null; modificationData?: ModificationModuleData | null; modificationLoading?: boolean; modificationError?: string | null; issuesData?: IssuesModuleData | null; issuesLoading?: boolean; issuesError?: string | null; firestore: Firestore; storage: FirebaseStorage; onMaintenanceUpdated: (data: MaintenanceModuleData) => void; onModificationRecalculate: () => Promise<void>; onIssuesRefresh: () => Promise<void>; onMileageUpdate?: (mileageKm: number) => Promise<void>; onBack?: () => void; emptyAction?: () => void }) {
  const [activeModule, setActiveModule] = useState<GarageModuleId>('vehicle');
  const [advisorOpen, setAdvisorOpen] = useState(false);
  const state = useMemo(() => deriveGarageViewState(data), [data]);

  if (state === 'loading') return <main className="premium-garage premium-garage--state"><GarageStatePanel state="loading" /></main>;
  if (!data.activeVehicle) return <main className="premium-garage premium-garage--state"><GarageStatePanel state="no_vehicle" onAction={emptyAction} /></main>;

  const vehicle = data.activeVehicle;
  return <main className="premium-garage"><GarageHeader vehicle={vehicle} state={state} onBack={onBack} onMileageUpdate={onMileageUpdate} /><div className="premium-garage__body"><aside className="premium-garage__sidebar"><GarageNavigation activeModule={activeModule} onNavigate={setActiveModule} /><GarageSidebarStatus state={state} /></aside><div className="premium-garage__content"><GarageModuleContent module={activeModule} state={state} vehicleData={vehicleData} vehicleLoading={vehicleLoading} vehicleError={vehicleError} maintenanceData={maintenanceData} maintenanceLoading={maintenanceLoading} maintenanceError={maintenanceError} modificationData={modificationData} modificationLoading={modificationLoading} modificationError={modificationError} issuesData={issuesData} issuesLoading={issuesLoading} issuesError={issuesError} firestore={firestore} storage={storage} onMaintenanceUpdated={onMaintenanceUpdated} onModificationRecalculate={onModificationRecalculate} onIssuesRefresh={onIssuesRefresh} onOpenAdvisor={() => { setAdvisorOpen(true); }} /></div></div><GarageNavigation mobile activeModule={activeModule} onNavigate={setActiveModule} /><GarageSpecialist vehicle={vehicle} state={state} activeModule={activeModule} forceOpen={advisorOpen} onClose={() => { setAdvisorOpen(false); }} /></main>;
}

function GarageSidebarStatus({ state }: { state: ReturnType<typeof deriveGarageViewState> }) {
  const content: Record<typeof state, ReactNode> = {
    loading: null, no_vehicle: null,
    research_pending: <><i className="pending" /><span><strong>Investigación pendiente</strong><small>Sin datos técnicos publicados</small></span></>,
    incomplete: <><i className="incomplete" /><span><strong>Ficha incompleta</strong><small>Revisa la información</small></span></>,
    ready: <><i className="ready" /><span><strong>Garaje preparado</strong><small>Contexto disponible</small></span></>,
  };
  return <div className={`garage-sidebar-status garage-sidebar-status--${state}`}>{content[state]}</div>;
}
