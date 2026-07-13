import type { DiagnosticAssessment, DiagnosticContext, DiagnosticEvidence, InstalledModification, UserVehicle, VehicleIssue, VehicleMaster } from '../models';

export interface DiagnosticVehicleContext {
  vehicle: UserVehicle;
  master: VehicleMaster | null;
  installedModifications: InstalledModification[];
  knownIssues: VehicleIssue[];
  declaredHistory?: {
    majorAccidents: boolean;
    seriousBreakdowns: boolean;
    engineReplaced: boolean;
    transmissionReplaced: boolean;
    context?: string;
  };
}

export interface DiagnosticAnalysisInput {
  symptoms: string;
  severityDeclared: 'low' | 'medium' | 'high' | 'urgent';
  context: DiagnosticContext;
  evidence: DiagnosticEvidence[];
  vehicleContext: DiagnosticVehicleContext;
}

export interface DiagnosticAnalysisProvider {
  readonly id: string;
  analyze(input: DiagnosticAnalysisInput): Promise<DiagnosticAssessment>;
}

export class ConservativeKnownIssuesProvider implements DiagnosticAnalysisProvider {
  readonly id = 'known-issues-conservative-v1';

  analyze(input: DiagnosticAnalysisInput): Promise<DiagnosticAssessment> {
    const searchable = normalize([input.symptoms, input.context.occurrence, input.context.warningLights, input.context.smoke, input.context.odors, input.context.vibrations, input.context.recentChanges].filter(Boolean).join(' '));
    const evidenceIds = input.evidence.filter((item) => item.type === 'text').map((item) => item.id);
    const ranked = input.vehicleContext.knownIssues.map((issue) => {
      const terms = tokenize(`${issue.title} ${issue.symptoms.join(' ')}`);
      const matches = terms.filter((term) => searchable.includes(term));
      return { issue, matches };
    }).filter((item) => item.matches.length > 0).sort((a, b) => b.matches.length - a.matches.length).slice(0, 5);
    const uncertainRisk = [input.context.smoke, input.context.odors, input.context.warningLights].some((value) => Boolean(value))
      || Boolean(input.vehicleContext.declaredHistory?.seriousBreakdowns);
    const severity = input.severityDeclared === 'urgent' ? 'urgent' : input.severityDeclared === 'high' || uncertainRisk ? 'high' : input.severityDeclared;
    const hypotheses = ranked.map(({ issue, matches }) => ({
      title: issue.title,
      explanation: 'Coincide parcialmente con un fallo conocido documentado para la variante. La coincidencia no confirma que sea la avería de este vehículo.',
      confidence: matches.length >= 3 ? 'medium' as const : 'low' as const,
      supportingEvidenceIds: evidenceIds,
      supportingEvidence: matches.map((term) => `Coincidencia contextual: ${term}`),
    }));
    return Promise.resolve({
      symptomSummary: input.symptoms,
      hypotheses,
      confidence: hypotheses.length ? (hypotheses.some((item) => item.confidence === 'medium') ? 'medium' : 'low') : 'unverified',
      additionalQuestions: buildAdditionalQuestions(input.context, input.evidence),
      firstChecks: ['Leer y registrar códigos OBD sin borrar la memoria de averías.', 'Solicitar una inspección visual profesional antes de desmontar o sustituir componentes.'],
      severity,
      drivingAdvice: severity === 'urgent' ? 'stop_now' : severity === 'high' ? 'do_not_drive_until_inspected' : 'insufficient_information',
      stopConditions: ['Testigo rojo de aceite, frenos o temperatura.', 'Humo intenso, olor a combustible o indicio de incendio.', 'Pérdida de frenado, dirección, potencia súbita o ruido que aumente rápidamente.'],
      professionalInspectionRecommendation: 'Este resultado es orientativo y no sustituye una diagnosis presencial. Un profesional debe comprobar el vehículo antes de reparar, modificar o continuar circulando si persiste la duda.',
      providerId: this.id, generatedAt: new Date(), reviewStatus: 'ai_draft',
    });
  }
}

function buildAdditionalQuestions(context: DiagnosticContext, evidence: DiagnosticEvidence[]): string[] {
  const questions: string[] = [];
  if (!context.speedOrRpm) questions.push('¿A qué velocidad o revoluciones aparece exactamente?');
  if (!context.warningLights) questions.push('¿Se enciende algún testigo y permanece encendido?');
  if (!context.recentChanges) questions.push('¿Se realizó mantenimiento, reparación o modificación justo antes del síntoma?');
  if (!evidence.some((item) => item.type === 'audio')) questions.push('¿Puedes grabar el sonido desde una posición segura sin acercarte a elementos móviles?');
  return questions;
}

function normalize(value: string): string { return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase(); }
function tokenize(value: string): string[] { return [...new Set(normalize(value).split(/[^a-z0-9]+/).filter((term) => term.length >= 4))]; }
