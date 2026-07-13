import { describe, expect, it } from 'vitest';
import type { DiagnosticAnalysisInput } from '../issues/diagnosticProvider';
import { ConservativeKnownIssuesProvider } from '../issues/diagnosticProvider';
import { validateDiagnosticFile, validateDiagnosticFileSignature } from '../issues/diagnosticService';
import type { UserVehicle, VehicleIssue } from '../models';

const now = new Date('2026-07-12T10:00:00.000Z');
const vehicle: UserVehicle = { id: 'vehicle-1', schemaVersion: 1, createdAt: now, updatedAt: now, ownerId: 'user-1', variantId: 'variant-1', variantSnapshot: { brand: 'Brand', model: 'Model', generation: 'G1', variant: 'Sport' }, variantResolutionStatus: 'confirmed', year: 2020, mileageKm: 50_000, primaryUse: 'daily', condition: 'good', power: {}, profileCompleteness: 100 };
const knownIssue: VehicleIssue = { id: 'issue-1', schemaVersion: 1, createdAt: now, updatedAt: now, scope: 'master_known_issue', applicableVariantIds: ['variant-1'], title: 'Fallo de presión documentado', symptoms: ['testigo presión intermitente', 'vibración al acelerar'], possibleCauses: [], severity: 'high', status: 'known', obdCodes: [], provenance: { sourceIds: ['source-1'], confidence: { level: 'verified', rationale: 'Reviewed', assessedBy: 'editor', assessedAt: now }, reviewStatus: 'published' } };

function input(overrides: Partial<DiagnosticAnalysisInput> = {}): DiagnosticAnalysisInput {
  return { symptoms: 'Vibración al acelerar y testigo de presión intermitente', severityDeclared: 'medium', context: { occurrence: 'Intermitente', engineTemperature: 'hot', drivingPhases: ['accelerating'], warningLights: 'presión' }, evidence: [], vehicleContext: { vehicle, master: null, installedModifications: [], knownIssues: [knownIssue] }, ...overrides };
}

describe('conservative diagnostic provider', () => {
  it('returns ordered hypotheses as an unapproved draft and never declares driving safe', async () => {
    const result = await new ConservativeKnownIssuesProvider().analyze(input());
    expect(result.hypotheses[0]?.title).toBe(knownIssue.title);
    expect(result.confidence).not.toBe('high');
    expect(result.reviewStatus).toBe('ai_draft');
    expect(result.drivingAdvice).toBe('do_not_drive_until_inspected');
    expect(result.professionalInspectionRecommendation).toContain('no sustituye');
  });

  it('requires immediate stopping when urgency is declared', async () => {
    const result = await new ConservativeKnownIssuesProvider().analyze(input({ severityDeclared: 'urgent' }));
    expect(result.severity).toBe('urgent');
    expect(result.drivingAdvice).toBe('stop_now');
    expect(result.stopConditions.length).toBeGreaterThan(0);
  });

  it('does not invent a cause when no approved issue matches', async () => {
    const result = await new ConservativeKnownIssuesProvider().analyze(input({ symptoms: 'Síntoma sin coincidencia', context: { occurrence: 'Una vez', engineTemperature: 'unknown', drivingPhases: ['cruising'] }, vehicleContext: { vehicle, master: null, installedModifications: [], knownIssues: [] } }));
    expect(result.hypotheses).toEqual([]);
    expect(result.confidence).toBe('unverified');
    expect(result.drivingAdvice).toBe('insufficient_information');
  });
});

describe('diagnostic evidence validation', () => {
  it('accepts private image and audio formats and rejects unsupported content', () => {
    expect(() => { validateDiagnosticFile({ blob: new Blob(['image'], { type: 'image/jpeg' }), name: 'photo.jpg', type: 'image' }); }).not.toThrow();
    expect(() => { validateDiagnosticFile({ blob: new Blob(['audio'], { type: 'audio/webm' }), name: 'sound.webm', type: 'audio' }); }).not.toThrow();
    expect(() => { validateDiagnosticFile({ blob: new Blob(['bad'], { type: 'text/plain' }), name: 'bad.txt', type: 'image' }); }).toThrow('JPEG');
  });

  it('rejects spoofed MIME types by checking the file signature', async () => {
    const validJpeg = new Blob([new Uint8Array([0xff, 0xd8, 0xff, 0xe0])], { type: 'image/jpeg' });
    await expect(validateDiagnosticFileSignature({ blob: validJpeg, name: 'photo.jpg', type: 'image' })).resolves.toBeUndefined();
    const spoofed = new Blob(['not an image'], { type: 'image/jpeg' });
    await expect(validateDiagnosticFileSignature({ blob: spoofed, name: 'photo.jpg', type: 'image' })).rejects.toThrow('contenido real');
  });
});
