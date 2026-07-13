import type { Firestore } from 'firebase/firestore';
import { createPremiumRepositories } from '../repositories/premiumRepositories';
import type { EngineMaster, TechnicalProvenance, TransmissionMaster, UserVehicle, VehicleIssue, VehicleMaster } from '../models';
import type { GarageVehicleIdentity } from '../garage/garageTypes';
import type { TechnicalFieldStatus, VehicleModuleData, VehicleTechnicalCard, VehicleTechnicalField } from './vehicleModuleTypes';

function trusted(provenance: TechnicalProvenance | undefined): boolean {
  return Boolean(provenance && ['approved', 'published'].includes(provenance.reviewStatus) && ['high', 'verified'].includes(provenance.confidence.level));
}

function technicalField(key: string, label: string, value: VehicleTechnicalField['value'], status: TechnicalFieldStatus, unit?: string): VehicleTechnicalField {
  return { key, label, status, ...(hasTechnicalValue(value) ? { value } : {}), ...(unit ? { unit } : {}) };
}

function confirmedOrPending(key: string, label: string, value: VehicleTechnicalField['value'], isTrusted: boolean, unit?: string): VehicleTechnicalField {
  const confirmed = isTrusted && hasTechnicalValue(value);
  return technicalField(key, label, confirmed ? value : undefined, confirmed ? 'confirmed' : 'pending', unit);
}

function hasTechnicalValue(value: VehicleTechnicalField['value']): boolean {
  return value !== undefined && value !== '' && (!Array.isArray(value) || value.length > 0);
}

function joinDefined(values: (string | undefined)[]): string | undefined {
  const result = values.filter((value): value is string => Boolean(value)).join(' ');
  return result || undefined;
}

export async function loadVehicleModuleData(firestore: Firestore, ownerId: string): Promise<VehicleModuleData | null> {
  const repositories = createPremiumRepositories(firestore);
  const userVehicle = await repositories.userVehicles.getLatestByOwner(ownerId);
  if (!userVehicle) return null;

  const master = userVehicle.variantId ? await repositories.vehicleMasters.getById(userVehicle.variantId) : null;
  const [engine, transmission] = await Promise.all([
    master?.engineId ? repositories.engineMasters.getById(master.engineId) : Promise.resolve(null),
    master?.transmissionId ? repositories.transmissionMasters.getById(master.transmissionId) : Promise.resolve(null),
  ]);
  const risks = master?.knownRiskIds?.length
    ? (await Promise.all(master.knownRiskIds.map((riskId) => repositories.vehicleIssues.getById(riskId)))).filter((issue): issue is VehicleIssue => issue !== null && trusted(issue.provenance))
    : [];
  return buildVehicleModuleData(userVehicle, master, engine, transmission, risks);
}

export function buildVehicleModuleData(userVehicle: UserVehicle, master: VehicleMaster | null, engine: EngineMaster | null, transmission: TransmissionMaster | null, risks: VehicleIssue[]): VehicleModuleData {
  const masterTrusted = trusted(master?.provenance);
  const engineTrusted = trusted(engine?.provenance);
  const transmissionTrusted = trusted(transmission?.provenance);
  const snapshot = userVehicle.variantSnapshot;
  const vehicle: GarageVehicleIdentity = {
    id: userVehicle.id, brand: snapshot.brand, model: snapshot.model, generation: snapshot.generation, variant: snapshot.variant,
    year: userVehicle.year, mileageKm: userVehicle.mileageKm, ...(snapshot.market ? { market: snapshot.market } : {}),
    variantResolutionStatus: userVehicle.variantResolutionStatus, profileCompleteness: userVehicle.profileCompleteness,
  };
  const stockPower = masterTrusted ? master?.power.stockPowerCv : undefined;
  const declaredPower = userVehicle.power.userDeclaredPowerCv;
  const powerField = stockPower !== undefined
    ? technicalField('power', 'Potencia', stockPower, 'confirmed', 'CV')
    : technicalField('power', 'Potencia', declaredPower, declaredPower !== undefined ? 'declared' : 'pending', 'CV');

  const highlights = [
    powerField,
    confirmedOrPending('torque', 'Par', master?.stockTorqueNm, masterTrusted, 'Nm'),
    technicalField('engine', 'Motor', engineTrusted ? joinDefined([engine?.manufacturer, engine?.code]) : snapshot.variant, engineTrusted ? 'confirmed' : 'declared'),
    confirmedOrPending('transmission', 'Transmisión', transmission ? joinDefined([transmission.manufacturer, transmission.code, transmission.type]) : undefined, transmissionTrusted),
    confirmedOrPending('drive', 'Tracción', transmission?.driveLayout ?? master?.driveLayout, transmissionTrusted || masterTrusted),
  ];

  const cards: VehicleTechnicalCard[] = [
    { id: 'identity', title: 'Identidad', description: 'Datos principales del vehículo activo.', defaultOpen: true, fields: [
      technicalField('brand', 'Marca', snapshot.brand, 'declared'), technicalField('model', 'Modelo', snapshot.model, 'declared'),
      technicalField('generation', 'Generación', snapshot.generation, 'declared'), technicalField('variant', 'Versión', snapshot.variant, 'declared'),
      technicalField('year', 'Año', userVehicle.year, 'declared'),
    ] },
    { id: 'engine', title: 'Motor y gestión', description: 'Arquitectura, alimentación y control del motor.', defaultOpen: true, fields: [
      confirmedOrPending('engine-name', 'Motor', engine ? joinDefined([engine.manufacturer, engine.family]) : undefined, engineTrusted),
      confirmedOrPending('engine-code', 'Código motor', engine?.code, engineTrusted),
      confirmedOrPending('displacement', 'Cilindrada', engine?.displacementCc, engineTrusted, 'cc'),
      confirmedOrPending('fuel', 'Combustible', engine?.fuel, engineTrusted), confirmedOrPending('induction', 'Aspiración', engine?.induction, engineTrusted),
      confirmedOrPending('architecture', 'Arquitectura', engine?.architecture, engineTrusted), confirmedOrPending('injection', 'Inyección', engine?.injection, engineTrusted),
      confirmedOrPending('timing', 'Distribución', engine?.timingSystem, engineTrusted), confirmedOrPending('ecu', 'Centralita', engine?.ecu, engineTrusted),
    ] },
    { id: 'transmission', title: 'Transmisión', description: 'Caja de cambios y sistema de tracción.', fields: [
      confirmedOrPending('transmission-code', 'Transmisión', transmission ? joinDefined([transmission.manufacturer, transmission.code, transmission.type]) : undefined, transmissionTrusted),
      confirmedOrPending('gears', 'Número de velocidades', transmission?.gears, transmissionTrusted),
      confirmedOrPending('drive-layout', 'Tracción', transmission?.driveLayout ?? master?.driveLayout, transmissionTrusted || masterTrusted),
    ] },
    { id: 'chassis', title: 'Chasis, suspensión y frenos', description: 'Base dinámica documentada para esta variante.', fields: [
      confirmedOrPending('chassis-code', 'Chasis', master?.chassisCode, masterTrusted),
      confirmedOrPending('suspension-front', 'Suspensión delantera', master?.suspension?.front, masterTrusted),
      confirmedOrPending('suspension-rear', 'Suspensión trasera', master?.suspension?.rear, masterTrusted),
      confirmedOrPending('brakes-front', 'Frenos delanteros', master?.brakes?.front, masterTrusted),
      confirmedOrPending('brakes-rear', 'Frenos traseros', master?.brakes?.rear, masterTrusted),
    ] },
    { id: 'wheels', title: 'Llantas y ajuste', description: 'Anclaje y medidas documentadas.', fields: [
      confirmedOrPending('pcd', 'PCD', master?.wheelFitment?.pcd, masterTrusted),
      confirmedOrPending('hub', 'Buje', master?.wheelFitment?.hubBoreMm, masterTrusted, 'mm'),
      confirmedOrPending('offset', 'ET compatible', master?.wheelFitment?.offsetRange, masterTrusted),
      confirmedOrPending('sizes', 'Medidas compatibles', master?.wheelFitment?.compatibleSizes, masterTrusted),
    ] },
    { id: 'oil', title: 'Aceite', description: 'Especificación aplicable al motor verificado.', fields: [
      confirmedOrPending('oil-viscosity', 'Aceite recomendado', engine?.oil?.recommendedViscosity, engineTrusted),
      confirmedOrPending('oil-capacity', 'Capacidad', engine?.oil?.capacityLitres, engineTrusted, 'L'),
      confirmedOrPending('oil-approvals', 'Homologaciones', engine?.oil?.approvals, engineTrusted),
    ] },
    { id: 'assessment', title: 'Valoración Tuning Hub', description: 'Fortalezas, debilidades y riesgos respaldados.', fields: [
      confirmedOrPending('strengths', 'Puntos fuertes', master?.strengths, masterTrusted),
      confirmedOrPending('weaknesses', 'Puntos débiles', master?.weaknesses, masterTrusted),
      confirmedOrPending('risks', 'Riesgos conocidos', risks.map((risk) => risk.title), masterTrusted && risks.length > 0),
      confirmedOrPending('rating', 'Valoración Tuning Hub', master?.tuningHubRating, masterTrusted, '/ 10'),
    ] },
  ];
  const sourceIds = new Set([...(master?.provenance.sourceIds ?? []), ...(engine?.provenance.sourceIds ?? []), ...(transmission?.provenance.sourceIds ?? []), ...risks.flatMap((risk) => risk.provenance.sourceIds)]);
  return { vehicle, highlights, cards, sourceCount: sourceIds.size, masterDataConfirmed: masterTrusted };
}
