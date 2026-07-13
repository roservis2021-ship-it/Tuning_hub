import type { InstalledModification, ModificationDefinition, ProjectGoal, UserVehicle, VehicleMaster } from '../models';

export type ModificationArea = 'mechanical' | 'chassis_brakes' | 'transmission' | 'aesthetic';
export type ModificationRouteStatus = 'completed' | 'current' | 'later' | 'blocked';

export interface ModificationRouteStep {
  definition: ModificationDefinition;
  area: ModificationArea;
  order: number;
  status: ModificationRouteStatus;
  rationale: string;
  missingPrerequisiteIds: string[];
  blockedReasons: string[];
}

export interface ModificationRouteResult {
  steps: ModificationRouteStep[];
  completed: ModificationRouteStep[];
  current?: ModificationRouteStep;
  later: ModificationRouteStep[];
  blocked: ModificationRouteStep[];
  estimatedFinalPowerCv?: { minimum: number; maximum: number };
  estimatedFinalTorqueNm?: { minimum: number; maximum: number };
}

const CATEGORY_PRIORITY: Record<ModificationDefinition['category'], number> = {
  brakes: 0, chassis: 1, wheels: 2, drivetrain: 3, intake_exhaust: 4, engine: 5, ecu: 6, exterior: 7, interior: 8,
};

export function modificationArea(category: ModificationDefinition['category']): ModificationArea {
  if (['chassis', 'brakes', 'wheels'].includes(category)) return 'chassis_brakes';
  if (category === 'drivetrain') return 'transmission';
  if (['exterior', 'interior'].includes(category)) return 'aesthetic';
  return 'mechanical';
}

function isTrusted(definition: ModificationDefinition): boolean {
  return ['approved', 'published'].includes(definition.provenance.reviewStatus)
    && ['high', 'verified'].includes(definition.provenance.confidence.level);
}

export function calculateModificationRoute(definitions: ModificationDefinition[], installed: InstalledModification[], goal: ProjectGoal, vehicle: UserVehicle, master: VehicleMaster | null): ModificationRouteResult {
  const installedIds = new Set(installed.filter((item) => item.active).map((item) => item.modificationId).filter((id): id is string => id !== undefined));
  const candidates = definitions.filter((definition) => isTrusted(definition)
    && definition.applicableGoalTypes?.includes(goal.type)
    && vehicle.variantId !== undefined && definition.compatibleVariantIds.includes(vehicle.variantId)
    && !definition.incompatibleModificationIds.some((id) => installedIds.has(id)));
  const candidateIds = new Set(candidates.map((item) => item.id));
  const sorted = topologicalSort(candidates, installedIds);
  let currentAssigned = false;
  const steps = sorted.map((definition, index): ModificationRouteStep => {
    const missingPrerequisiteIds = definition.prerequisiteModificationIds.filter((id) => !installedIds.has(id));
    const unknownPrerequisites = missingPrerequisiteIds.filter((id) => !candidateIds.has(id));
    const critical = ['high', 'specialist_required'].includes(definition.riskLevel);
    const blockedReasons = [
      ...(unknownPrerequisites.length ? ['Faltan requisitos previos aprobados dentro del catálogo aplicable.'] : []),
      ...(critical && missingPrerequisiteIds.length ? ['Una modificación crítica no puede recomendarse hasta completar todos sus requisitos previos.'] : []),
      ...(critical && vehicle.condition !== 'good' ? ['El estado declarado del vehículo requiere revisión antes de una modificación crítica.'] : []),
    ];
    let status: ModificationRouteStatus = installedIds.has(definition.id) ? 'completed' : blockedReasons.length ? 'blocked' : 'later';
    if (status === 'later' && !currentAssigned && missingPrerequisiteIds.every((id) => installedIds.has(id))) { status = 'current'; currentAssigned = true; }
    const prerequisiteNames = definition.prerequisiteModificationIds.map((id) => candidates.find((item) => item.id === id)?.title).filter((name): name is string => Boolean(name));
    const rationale = prerequisiteNames.length
      ? `Se sitúa después de ${prerequisiteNames.join(', ')} porque son requisitos técnicos declarados en su definición.`
      : `Se ordena por prioridad de ${areaLabel(modificationArea(definition.category))} y por sus dependencias aprobadas.`;
    return { definition, area: modificationArea(definition.category), order: index + 1, status, rationale, missingPrerequisiteIds, blockedReasons };
  });
  const gains = steps.filter((step) => step.status !== 'blocked');
  const powerGain = sumRanges(gains.map((step) => step.definition.estimatedPowerGainCv));
  const torqueGain = sumRanges(gains.map((step) => step.definition.estimatedTorqueGainNm));
  const stockPower = master?.power.stockPowerCv;
  const stockTorque = master?.stockTorqueNm;
  return {
    steps, completed: steps.filter((step) => step.status === 'completed'), current: steps.find((step) => step.status === 'current'),
    later: steps.filter((step) => step.status === 'later'), blocked: steps.filter((step) => step.status === 'blocked'),
    ...(stockPower !== undefined && powerGain ? { estimatedFinalPowerCv: { minimum: stockPower + powerGain.minimum, maximum: stockPower + powerGain.maximum } } : {}),
    ...(stockTorque !== undefined && torqueGain ? { estimatedFinalTorqueNm: { minimum: stockTorque + torqueGain.minimum, maximum: stockTorque + torqueGain.maximum } } : {}),
  };
}

function topologicalSort(definitions: ModificationDefinition[], installedIds: Set<string>): ModificationDefinition[] {
  const remaining = [...definitions].sort((a, b) => CATEGORY_PRIORITY[a.category] - CATEGORY_PRIORITY[b.category] || a.title.localeCompare(b.title));
  const ordered: ModificationDefinition[] = []; const resolved = new Set(installedIds);
  while (remaining.length) {
    const availableIndex = remaining.findIndex((item) => item.prerequisiteModificationIds.every((id) => resolved.has(id) || !remaining.some((candidate) => candidate.id === id)));
    const index = availableIndex >= 0 ? availableIndex : 0;
    const item = remaining.splice(index, 1)[0]; if (!item) break; ordered.push(item); resolved.add(item.id);
  }
  return ordered;
}

function sumRanges(ranges: ({ minimum: number; maximum: number } | undefined)[]): { minimum: number; maximum: number } | undefined {
  const defined = ranges.filter((range): range is { minimum: number; maximum: number } => range !== undefined);
  return defined.length ? defined.reduce((total, range) => ({ minimum: total.minimum + range.minimum, maximum: total.maximum + range.maximum }), { minimum: 0, maximum: 0 }) : undefined;
}

function areaLabel(area: ModificationArea): string {
  return { mechanical: 'mecánica', chassis_brakes: 'chasis y frenos', transmission: 'transmisión', aesthetic: 'estética' }[area];
}
