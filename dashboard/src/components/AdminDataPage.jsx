import { useEffect, useMemo, useState } from 'react';
import { listAdminRecords } from '../services/adminApi';

const LABELS = { users: 'Usuarios', subscriptions: 'Suscripciones', diagnostics: 'Diagnósticos reportados', aiUsage: 'Consumo de IA' };
const TITLES = { users: ['displayName', 'email', 'id'], subscriptions: ['type', 'status', 'userId'], diagnostics: ['summary', 'status', 'vehicleId'], aiUsage: ['feature', 'model', 'userId'] };
function valueOf(record, keys) { return keys.map((key) => record[key]).find((value) => value !== undefined && value !== '') || record.id; }
function secondary(record) { return record.email || record.userId || record.vehicleId || record.id; }

export default function AdminDataPage({ resource }) {
  const [records, setRecords] = useState([]); const [query, setQuery] = useState(''); const [loading, setLoading] = useState(true); const [error, setError] = useState('');
  async function load() { setLoading(true); setError(''); try { setRecords((await listAdminRecords(resource)).records || []); } catch (caught) { setError(caught.message); } finally { setLoading(false); } }
  useEffect(() => { load(); }, [resource]);
  const filtered = useMemo(() => records.filter((record) => JSON.stringify(record).toLowerCase().includes(query.toLowerCase())), [records, query]);
  return <div className="page resource-page"><div className="page-heading"><div><p className="eyebrow">Operaciones privadas</p><h1>{LABELS[resource]}</h1><p>Vista protegida y minimizada desde el backend.</p></div></div><div className="toolbar"><div className="search-box"><span>⌕</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={`Buscar en ${LABELS[resource].toLowerCase()}…`} /></div><button onClick={load}>↻ Actualizar</button></div><div className="data-panel admin-readonly"><div className="data-head"><span>Registro</span><span>Estado</span><span>Referencia</span><span>Acceso</span></div>{loading ? <div className="empty-state">Cargando datos protegidos…</div> : error ? <div className="empty-state"><h3>No se pudo cargar</h3><p>{error}</p></div> : filtered.map((record) => <div className="data-row" key={record.path || record.id}><div className="record-title"><span>•</span><div><strong>{String(valueOf(record, TITLES[resource]))}</strong><small>{secondary(record)}</small></div></div><span className={`status-pill ${record.status || 'draft'}`}>{record.status || 'Registrado'}</span><span className="muted">{record.id}</span><span className="readonly-label">Solo lectura</span></div>)}</div></div>;
}
