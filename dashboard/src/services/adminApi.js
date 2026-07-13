import { auth } from '../firebase';

const hostname = globalThis.location?.hostname || '';
const API_BASE = (import.meta.env.VITE_API_BASE_URL || (hostname === 'localhost' || hostname === '127.0.0.1' ? 'http://127.0.0.1:8787' : '')).replace(/\/$/, '');

async function request(path, options = {}) {
  const token = await auth.currentUser?.getIdToken();
  if (!token) throw new Error('La sesión administrativa ha caducado.');
  const response = await globalThis.fetch(`${API_BASE}${path}`, { ...options, headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', ...options.headers } });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.error || 'La operación administrativa no se pudo completar.');
  return payload;
}

export const listResearchJobs = () => request('/api/admin/vehicle-research');
export const getResearchDetail = (jobId) => request(`/api/admin/vehicle-research/${encodeURIComponent(jobId)}`);
export const runResearchAction = (jobId, action, payload = {}) => request(`/api/admin/vehicle-research/${encodeURIComponent(jobId)}/${action}`, { method: 'POST', body: JSON.stringify(payload) });
export const reviewClaim = (jobId, claimId, action, payload = {}) => request(`/api/admin/vehicle-research/${encodeURIComponent(jobId)}/claims/${encodeURIComponent(claimId)}/${action}`, { method: 'POST', body: JSON.stringify(payload) });
export const listAdminRecords = (resource) => request(`/api/admin/resources/${resource}`);
