import type { EntityMetadata } from './common';

export interface DiagnosticContext {
  occurrence: string;
  engineTemperature: 'cold' | 'hot' | 'both' | 'unknown';
  drivingPhases: ('starting' | 'accelerating' | 'braking' | 'turning' | 'cruising')[];
  speedOrRpm?: string;
  warningLights?: string;
  smoke?: string;
  odors?: string;
  vibrations?: string;
  recentChanges?: string;
  relatedModifications?: string;
}

export interface DiagnosticHypothesis {
  title: string;
  explanation: string;
  confidence: 'unverified' | 'low' | 'medium' | 'high';
  supportingEvidenceIds: string[];
  supportingEvidence: string[];
}

export interface DiagnosticAssessment {
  symptomSummary: string;
  hypotheses: DiagnosticHypothesis[];
  confidence: 'unverified' | 'low' | 'medium' | 'high';
  additionalQuestions: string[];
  firstChecks: string[];
  severity: 'low' | 'medium' | 'high' | 'urgent' | 'unknown';
  drivingAdvice: 'stop_now' | 'do_not_drive_until_inspected' | 'only_if_necessary_with_caution' | 'insufficient_information';
  stopConditions: string[];
  professionalInspectionRecommendation: string;
  providerId: string;
  generatedAt: Date;
  reviewStatus: 'ai_draft' | 'in_review' | 'approved';
}

export interface DiagnosticSession extends EntityMetadata {
  ownerId: string;
  userVehicleId: string;
  vehicleIssueId?: string;
  title: string;
  symptoms: string[];
  severityDeclared: 'low' | 'medium' | 'high' | 'urgent';
  startedAt: Date;
  mileageKm?: number;
  status: 'open' | 'monitoring' | 'resolved' | 'workshop_required';
  evidenceIds: string[];
  obdCodes: string[];
  observations?: string;
  researchJobId?: string;
  professionalAssessment?: string;
  professionalAssessmentVerified: boolean;
  resolution?: string;
  context?: DiagnosticContext;
  assessment?: DiagnosticAssessment;
}
