import { getVehicleImage } from '../services/vehicleVisuals';

function VehiclePreview({ vehicle, compact = false }) {
  if (!vehicle?.brand || !vehicle?.model) {
    return null;
  }

  const imageSrc = getVehicleImage(vehicle);
  const vehicleName = [vehicle.brand, vehicle.model, vehicle.generation, vehicle.engine]
    .filter(Boolean)
    .join(' ');

  return (
    <article className={`vehicle-preview ${compact ? 'vehicle-preview--compact' : ''}`}>
      <img src={imageSrc} alt={vehicleName} className="vehicle-preview__image" />
      <div className="vehicle-preview__copy">
        <span className="vehicle-preview__eyebrow">Vista previa del vehiculo</span>
        <strong>{vehicleName}</strong>
      </div>
    </article>
  );
}

export default VehiclePreview;
