import { describe, expect, it } from 'vitest';
import { analyzeResearchClaims, collectResearchSources, enforceVehicleScope, normalizeVehicleResearchRequest, publishApprovedVehicleResearch } from './vehicleResearch.mjs';

const request = normalizeVehicleResearchRequest({ brand: 'BMW', model: 'Serie 3', generation: 'E46', variant: '330Ci', year: 2002, market: 'EU', engineCode: 'M54B30' });
const source = (overrides = {}) => ({ sourceKey: 'manufacturer-1', title: 'Manual oficial', type: 'manufacturer_manual', publisher: 'Fabricante', url: 'https://example.test/manual', trustTier: 'primary', accessedAt: new Date('2026-07-12'), claims: [{ category: 'engine', fieldPath: 'displacementCc', value: 2979, unit: 'cc', generation: 'E46', market: 'EU', engineCode: 'M54B30' }], ...overrides });

describe('vehicle research pipeline with simulated connectors', () => {
  it('normalizes identity and reports critical ambiguity', () => {
    const ambiguous = normalizeVehicleResearchRequest({ brand: ' BMW ', model: 'Serie 3' });
    expect(ambiguous.lookupKey).toContain('bmw|serie 3');
    expect(ambiguous.precision).toBe('ambiguous');
    expect(ambiguous.ambiguities.map((item) => item.field)).toContain('generation');
  });

  it('collects structured output from simulated connectors and rejects mixed scope', async () => {
    const connector = { id: 'simulated-official', collect: async () => [source({ claims: [...source().claims, { category: 'engine', fieldPath: 'stockPowerCv', value: 231, generation: 'E90', market: 'US', engineCode: 'N52B30' }] })] };
    const collected = await collectResearchSources([connector], request);
    const scoped = enforceVehicleScope(collected, request);
    expect(scoped.sources[0].claims).toHaveLength(1);
    expect(scoped.excludedClaims).toEqual([{ sourceKey: 'manufacturer-1', category: 'engine', fieldPath: 'stockPowerCv', reason: 'scope_mismatch' }]);
  });

  it('stores reliable disagreement as a contradiction and blocks review', () => {
    const first = source(); const second = source({ sourceKey: 'database-2', title: 'Base técnica', type: 'technical_database', publisher: 'Proveedor técnico', trustTier: 'secondary', claims: [{ ...source().claims[0], value: 3000 }] });
    const sourceMap = new Map([['manufacturer-1', 'source-1'], ['database-2', 'source-2']]);
    const result = analyzeResearchClaims([first, second], sourceMap, request, new Date('2026-07-12'));
    expect(result.contradictions).toHaveLength(1);
    expect(result.blockingIssues[0]).toContain('Contradicción');
    expect(result.claims[0].reviewStatus).toBe('in_review');
  });

  it('does not treat a forum as sufficient proof for a critical specification', () => {
    const forum = source({ type: 'community_forum', trustTier: 'community', sourceKey: 'forum-1' });
    const result = analyzeResearchClaims([forum], new Map([['forum-1', 'source-forum']]), request, new Date('2026-07-12'));
    expect(result.claims[0].confidence.level).toBe('unverified');
    expect(result.blockingIssues[0]).toContain('solo está respaldado');
  });

  it('refuses publication when the job has not been approved', async () => {
    const db = fakeFirestore({ 'aiRuns/job-1': { stage: 'awaiting_human_review', reviewStatus: 'in_review' } });
    await expect(publishApprovedVehicleResearch({ db, jobId: 'job-1', publisherId: 'reviewer-1' })).rejects.toThrow('aprobada');
  });
});

function fakeFirestore(initial) {
  const documents = new Map(Object.entries(initial)); let autoId = 0;
  const makeReference = (path) => ({ path });
  return {
    collection(name) { return { doc(id) { return makeReference(`${name}/${id || `auto-${autoId += 1}`}`); } }; },
    async runTransaction(callback) { return callback({ async get(reference) { const data = documents.get(reference.path); return { exists: data !== undefined, data: () => data }; }, set(reference, value, options) { documents.set(reference.path, options?.merge ? { ...documents.get(reference.path), ...value } : value); } }); },
  };
}
