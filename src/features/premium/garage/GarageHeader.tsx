import { useState, type SyntheticEvent } from 'react';
import type { GarageVehicleIdentity, GarageViewState } from './garageTypes';

interface GarageHeaderProps {
  vehicle: GarageVehicleIdentity;
  state: GarageViewState;
  onBack?: () => void;
  onMileageUpdate?: (mileageKm: number) => Promise<void>;
}

export function GarageHeader({ vehicle, state, onBack, onMileageUpdate }: GarageHeaderProps) {
  const [editingMileage, setEditingMileage] = useState(false);
  const [savingMileage, setSavingMileage] = useState(false);
  const [mileageError, setMileageError] = useState('');
  const title = [vehicle.brand, vehicle.model].filter(Boolean).join(' ');
  const subtitle = [vehicle.generation, vehicle.variant].filter(Boolean).join(' · ');

  async function saveMileage(event: SyntheticEvent<HTMLFormElement>) {
    event.preventDefault();
    const value = Number(new FormData(event.currentTarget).get('mileage'));
    if (!Number.isInteger(value) || value < (vehicle.mileageKm ?? 0) || value > 2_000_000) {
      setMileageError('Introduce un kilometraje válido, igual o superior al actual.');
      return;
    }
    if (!onMileageUpdate) return;
    setSavingMileage(true);
    setMileageError('');
    try {
      await onMileageUpdate(value);
      setEditingMileage(false);
    } catch (error) {
      setMileageError(error instanceof Error ? error.message : 'No se pudo actualizar el kilometraje.');
    } finally {
      setSavingMileage(false);
    }
  }

  return <header className="garage-header"><div className="garage-header__top">{onBack ? <button type="button" onClick={onBack} aria-label="Volver"><span aria-hidden="true">←</span></button> : <span />}<div className="garage-wordmark"><span>TUNING</span><strong>HUB</strong><small>Premium</small></div>{onMileageUpdate ? <button type="button" className="garage-header__menu" aria-label="Actualizar kilometraje" onClick={() => { setEditingMileage((current) => !current); setMileageError(''); }}>km</button> : <span />}</div><div className="garage-vehicle"><div className="garage-vehicle__image">{vehicle.imageUrl ? <img src={vehicle.imageUrl} alt={`${title} ${vehicle.generation}`} /> : <span aria-hidden="true">TH</span>}<i className={`garage-vehicle__status garage-vehicle__status--${state}`} /></div><div className="garage-vehicle__identity"><span>Vehículo activo</span><h1>{title || 'Vehículo sin identificar'}</h1><p>{subtitle || 'Versión pendiente'}</p><div>{vehicle.year ? <span>{vehicle.year}</span> : null}{vehicle.mileageKm !== undefined ? <span>{vehicle.mileageKm.toLocaleString('es-ES')} km</span> : null}{vehicle.market ? <span>{vehicle.market}</span> : null}</div></div></div>{editingMileage ? <form className="garage-mileage-form" onSubmit={(event) => { void saveMileage(event); }}><label>Actualizar kilometraje<input name="mileage" type="number" min={vehicle.mileageKm ?? 0} max="2000000" step="1" defaultValue={vehicle.mileageKm} required /></label><button type="submit" disabled={savingMileage}>{savingMileage ? 'Guardando…' : 'Guardar'}</button><button type="button" className="secondary" onClick={() => { setEditingMileage(false); setMileageError(''); }}>Cancelar</button>{mileageError ? <p role="alert">{mileageError}</p> : null}</form> : null}</header>;
}
