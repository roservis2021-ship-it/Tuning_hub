import type { GarageViewState } from './garageTypes';

const STATE_COPY: Record<Exclude<GarageViewState, 'ready'>, { title: string; copy: string; action?: string }> = {
  loading: { title: 'Cargando tu garaje', copy: 'Estamos recuperando el vehículo activo y el estado de tu proyecto.' },
  no_vehicle: { title: 'Todavía no hay un vehículo', copy: 'Añade un vehículo para crear su historial, objetivo y ruta Premium.', action: 'Añadir vehículo' },
  research_pending: { title: 'Investigación en curso', copy: 'La identidad declarada está guardada. Estamos esperando una ficha maestra suficientemente fiable antes de mostrar datos técnicos.' },
  incomplete: { title: 'Información incompleta', copy: 'Faltan datos del vehículo o de su historial. Puedes seguir usando el garaje, pero algunas recomendaciones permanecerán pendientes.', action: 'Completar información' },
};

export function GarageStatePanel({ state, compact = false, onAction }: { state: Exclude<GarageViewState, 'ready'>; compact?: boolean; onAction?: () => void }) {
  const content = STATE_COPY[state];
  return <section className={`garage-state garage-state--${state} ${compact ? 'garage-state--compact' : ''}`} role={state === 'loading' ? 'status' : undefined}><span className={state === 'loading' ? 'premium-access-state__loader' : 'garage-state__icon'}>{state === 'research_pending' ? '…' : state === 'incomplete' ? 'i' : state === 'no_vehicle' ? '+' : ''}</span><div><p>{state === 'research_pending' ? 'Conocimiento pendiente' : 'Estado del garaje'}</p><h2>{content.title}</h2><span>{content.copy}</span>{content.action && onAction ? <button type="button" onClick={onAction}>{content.action}</button> : null}</div></section>;
}
