import type { VehicleModuleData, VehicleTechnicalField } from './vehicleModuleTypes';

export function VehicleModule({ data, loading, error }: { data: VehicleModuleData | null; loading: boolean; error?: string | null }) {
  if (loading) return <VehicleModuleSkeleton />;
  if (!data) return <section className="vehicle-module"><header className="garage-module-heading"><span>Ficha central</span><h1>Vehículo</h1><p>No hay un vehículo disponible.</p></header><div className="vehicle-module-message"><strong>Información no disponible</strong><p>{error ?? 'Añade un vehículo para construir su ficha.'}</p></div></section>;
  const { vehicle } = data;
  return <section className="vehicle-module"><header className="garage-module-heading"><span>Ficha central</span><h1>Vehículo</h1><p>Datos declarados y conocimiento técnico validado</p></header><article className="vehicle-module-hero">{vehicle.imageUrl ? <img src={vehicle.imageUrl} alt={`${vehicle.brand} ${vehicle.model} ${vehicle.generation}`} /> : null}<div><span>{data.masterDataConfirmed ? 'Ficha maestra confirmada' : 'Identidad declarada'}</span><h2>{vehicle.brand} {vehicle.model}</h2><p>{[vehicle.generation, vehicle.variant, vehicle.year].filter(Boolean).join(' · ')}</p>{data.sourceCount > 0 ? <small>{data.sourceCount} {data.sourceCount === 1 ? 'fuente técnica vinculada' : 'fuentes técnicas vinculadas'}</small> : <small>Investigación técnica pendiente</small>}</div></article><div className="vehicle-highlights">{data.highlights.map((field) => <TechnicalValue key={field.key} field={field} prominent />)}</div><div className="vehicle-technical-cards">{data.cards.map((card) => <details key={card.id} open={card.defaultOpen}><summary><div><span>{card.title}</span><small>{card.description}</small></div><i aria-hidden="true">+</i></summary><div className="vehicle-technical-card__body">{card.fields.map((field) => <TechnicalValue key={field.key} field={field} />)}</div></details>)}</div><footer className="vehicle-module-note"><span>i</span><p>Los datos pendientes no se completan automáticamente. Las fuentes detalladas y notas editoriales permanecen en las áreas internas de revisión.</p></footer></section>;
}

function TechnicalValue({ field, prominent = false }: { field: VehicleTechnicalField; prominent?: boolean }) {
  return <article className={`vehicle-technical-value vehicle-technical-value--${field.status} ${prominent ? 'vehicle-technical-value--prominent' : ''}`}><header><span>{field.label}</span><StatusBadge status={field.status} /></header>{field.value !== undefined ? Array.isArray(field.value) ? <ul>{field.value.map((value) => <li key={value}>{value}</li>)}</ul> : <strong>{field.value}{field.unit ? ` ${field.unit}` : ''}</strong> : <p>Pendiente de verificar</p>}</article>;
}

function StatusBadge({ status }: { status: VehicleTechnicalField['status'] }) {
  const labels = { confirmed: 'Confirmado', declared: 'Declarado', pending: 'Pendiente' };
  return <small className={`vehicle-data-status vehicle-data-status--${status}`}>{labels[status]}</small>;
}

export function VehicleModuleSkeleton() {
  return <section className="vehicle-module vehicle-module--loading" aria-label="Cargando ficha del vehículo" aria-busy="true"><div className="vehicle-skeleton vehicle-skeleton--title" /><div className="vehicle-skeleton vehicle-skeleton--hero" /><div className="vehicle-skeleton-grid">{Array.from({ length: 5 }, (_, index) => <div className="vehicle-skeleton vehicle-skeleton--value" key={index} />)}</div>{Array.from({ length: 4 }, (_, index) => <div className="vehicle-skeleton vehicle-skeleton--card" key={index} />)}</section>;
}
