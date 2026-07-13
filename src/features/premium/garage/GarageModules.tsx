import type { GarageModuleId, GarageViewState } from './garageTypes';
import { VehicleModule } from '../vehicle/VehicleModule';
import type { VehicleModuleData } from '../vehicle/vehicleModuleTypes';
import type { Firestore } from 'firebase/firestore';
import { MaintenanceModule } from '../maintenance/MaintenanceModule';
import type { MaintenanceModuleData } from '../maintenance/maintenanceModuleData';
import { ModificationsModule } from '../modifications/ModificationsModule';
import type { ModificationModuleData } from '../modifications/modificationModuleData';
import type { FirebaseStorage } from 'firebase/storage';
import { IssuesModule } from '../issues/IssuesModule';
import type { IssuesModuleData } from '../issues/issuesModuleData';

export function GarageModuleContent({ module, state, vehicleData, vehicleLoading = false, vehicleError, maintenanceData, maintenanceLoading = false, maintenanceError, modificationData, modificationLoading = false, modificationError, issuesData, issuesLoading = false, issuesError, firestore, storage, onMaintenanceUpdated, onModificationRecalculate, onIssuesRefresh, onOpenAdvisor }: { module: GarageModuleId; state: GarageViewState; vehicleData?: VehicleModuleData | null; vehicleLoading?: boolean; vehicleError?: string | null; maintenanceData?: MaintenanceModuleData | null; maintenanceLoading?: boolean; maintenanceError?: string | null; modificationData?: ModificationModuleData | null; modificationLoading?: boolean; modificationError?: string | null; issuesData?: IssuesModuleData | null; issuesLoading?: boolean; issuesError?: string | null; firestore: Firestore; storage: FirebaseStorage; onMaintenanceUpdated: (data: MaintenanceModuleData) => void; onModificationRecalculate: () => Promise<void>; onIssuesRefresh: () => Promise<void>; onOpenAdvisor: () => void }) {
  if (module === 'vehicle') return <VehicleModule data={vehicleData ?? null} loading={vehicleLoading} error={vehicleError} />;
  if (module === 'maintenance') return <MaintenanceModule data={maintenanceData ?? null} loading={maintenanceLoading} error={maintenanceError} firestore={firestore} onUpdated={onMaintenanceUpdated} />;
  if (module === 'modifications') return <ModificationsModule data={modificationData ?? null} loading={modificationLoading} error={modificationError} firestore={firestore} onRecalculate={onModificationRecalculate} />;
  if (module === 'issues') return <IssuesModule data={issuesData ?? null} loading={issuesLoading} error={issuesError} firestore={firestore} storage={storage} onRefresh={onIssuesRefresh} />;
  return <AdvisorModule state={state} onOpen={onOpenAdvisor} />;
}

function AdvisorModule({ state, onOpen }: { state: GarageViewState; onOpen(): void }) {
  return <section className="garage-module"><ModuleHeading eyebrow="Copiloto del proyecto" title="Especialista IA" copy="Consultas contextualizadas con tu vehículo y evolución" /><article className="garage-advisor-card"><span>IA</span><div><h2>Pregunta con el contexto de tu garaje</h2><p>{state === 'ready' ? 'El especialista utilizará únicamente información disponible y conocimiento validado.' : 'Puedes preguntar, pero las respuestas marcarán claramente qué información sigue pendiente de investigación.'}</p><button type="button" onClick={onOpen}>Abrir especialista</button></div></article></section>;
}

function ModuleHeading({ eyebrow, title, copy }: { eyebrow: string; title: string; copy: string }) { return <header className="garage-module-heading"><span>{eyebrow}</span><h1>{title}</h1><p>{copy}</p></header>; }
