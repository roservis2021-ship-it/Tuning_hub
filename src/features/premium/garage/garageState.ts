import type { GarageData, GarageModuleDefinition, GarageViewState } from './garageTypes';

export const GARAGE_MODULES: readonly GarageModuleDefinition[] = [
  { id: 'vehicle', label: 'Vehículo', shortLabel: 'Vehículo', icon: 'V' },
  { id: 'maintenance', label: 'Mantenimiento', shortLabel: 'Mant.', icon: 'M' },
  { id: 'modifications', label: 'Modificaciones', shortLabel: 'Mods', icon: '+' },
  { id: 'issues', label: 'Fallas y averías', shortLabel: 'Averías', icon: '!' },
  { id: 'advisor', label: 'Especialista IA', shortLabel: 'IA', icon: 'IA' },
] as const;

export function deriveGarageViewState(data: GarageData): GarageViewState {
  if (data.loading) return 'loading';
  if (!data.activeVehicle) return 'no_vehicle';
  if (data.activeVehicle.variantResolutionStatus === 'unresolved' || data.activeVehicle.variantResolutionStatus === 'probable') return 'research_pending';
  if (data.activeVehicle.profileCompleteness < 80) return 'incomplete';
  return 'ready';
}
