import { useEffect, useState } from 'react';
import { loadDashboardStats, loadRecentActivity } from '../services/repository';

const cards = [
  ['brands', 'Marcas', '◆'], ['models', 'Modelos', 'M'], ['generations', 'Generaciones', 'G'],
  ['vehicles', 'Versiones', 'V'], ['engines', 'Motores', 'E'], ['images', 'Imágenes', '▧'],
  ['rules', 'Reglas', '⌘'], ['verified', 'Fichas verificadas', '✓'], ['pending', 'Fichas pendientes', '…'],
];

export default function DashboardPage({ onNavigate }) {
  const [stats, setStats] = useState({});
  const [activity, setActivity] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([loadDashboardStats(), loadRecentActivity()])
      .then(([nextStats, nextActivity]) => { setStats(nextStats); setActivity(nextActivity); })
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="page dashboard-page">
      <div className="page-heading">
        <div><p className="eyebrow">Tuning Hub Knowledge Base</p><h1>Buenos días, Rober.</h1><p>Este es el estado actual del cerebro de la plataforma.</p></div>
        <button className="primary" onClick={() => onNavigate('vehicles', true)}>+ Crear vehículo</button>
      </div>
      <div className="stats-grid">
        {cards.map(([key, label, icon]) => (
          <article className="stat-card" key={key}>
            <div className="stat-icon">{icon}</div><span>{label}</span><strong>{loading ? '—' : stats[key] || 0}</strong>
          </article>
        ))}
      </div>
      <div className="dashboard-columns">
        <section className="panel">
          <header><div><h2>Actividad reciente</h2><p>Últimos cambios realizados en la THKB</p></div></header>
          <div className="activity-list">
            {!activity.length ? <div className="empty-compact">Aún no hay actividad registrada.</div> : activity.map((item) => (
              <div className="activity-item" key={item.id}>
                <span className={`activity-dot ${item.action}`}></span>
                <div><strong>{item.action === 'create' ? 'Registro creado' : item.action === 'delete' ? 'Registro eliminado' : 'Registro actualizado'}</strong><span>{item.resource} · {item.recordId}</span></div>
                <time>{item.user}</time>
              </div>
            ))}
          </div>
        </section>
        <section className="panel quick-panel">
          <header><div><h2>Acciones rápidas</h2><p>Continúa alimentando la base</p></div></header>
          <button onClick={() => onNavigate('engines', true)}><span>E</span><div><strong>Crear motor</strong><small>Ficha técnica maestra</small></div>›</button>
          <button onClick={() => onNavigate('sources', true)}><span>↗</span><div><strong>Añadir fuente</strong><small>Documentar evidencia</small></div>›</button>
          <button onClick={() => onNavigate('rules', true)}><span>⌘</span><div><strong>Crear regla</strong><small>Añadir inteligencia</small></div>›</button>
        </section>
      </div>
    </div>
  );
}
