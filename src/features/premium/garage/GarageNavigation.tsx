import { GARAGE_MODULES } from './garageState';
import type { GarageModuleId } from './garageTypes';

export function GarageNavigation({ activeModule, onNavigate, mobile = false }: { activeModule: GarageModuleId; onNavigate(module: GarageModuleId): void; mobile?: boolean }) {
  return <nav className={mobile ? 'garage-navigation garage-navigation--mobile' : 'garage-navigation'} aria-label="Módulos del garaje Premium">{GARAGE_MODULES.map((module) => <button key={module.id} type="button" className={module.id === activeModule ? 'active' : ''} aria-current={module.id === activeModule ? 'page' : undefined} onClick={() => { onNavigate(module.id); }}><i aria-hidden="true">{module.icon}</i><span>{mobile ? module.shortLabel : module.label}</span></button>)}</nav>;
}
