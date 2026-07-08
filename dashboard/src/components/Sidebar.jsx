import { resources, sidebarGroups } from '../config/resources';

export default function Sidebar({ activePage, onNavigate, user, onSignOut, open, onClose }) {
  return (
    <aside className={open ? 'sidebar open' : 'sidebar'}>
      <div className="sidebar-brand">
        <div className="brand-mark">TH</div>
        <div><strong>Tuning Hub</strong><span>Knowledge Base</span></div>
        <button className="mobile-close" onClick={onClose}>×</button>
      </div>
      <nav>
        <button className={activePage === 'dashboard' ? 'nav-item active' : 'nav-item'} onClick={() => onNavigate('dashboard')}>
          <span className="nav-icon">⌂</span>Dashboard
        </button>
        {sidebarGroups.map((group) => (
          <div className="nav-group" key={group.label}>
            <p>{group.label}</p>
            {group.items.map((key) => (
              <button key={key} className={activePage === key ? 'nav-item active' : 'nav-item'} onClick={() => onNavigate(key)}>
                <span className="nav-icon">{resources[key].icon}</span>{resources[key].label}
              </button>
            ))}
          </div>
        ))}
        <div className="nav-group">
          <p>Sistema</p>
          <button className={activePage === 'analytics' ? 'nav-item active' : 'nav-item'} onClick={() => onNavigate('analytics')}><span className="nav-icon">⌁</span>Analytics</button>
          <button className={activePage === 'settings' ? 'nav-item active' : 'nav-item'} onClick={() => onNavigate('settings')}><span className="nav-icon">⚙</span>Configuración</button>
        </div>
      </nav>
      <div className="sidebar-user">
        <div className="avatar">{user.email.slice(0, 1).toUpperCase()}</div>
        <div><strong>Administrador</strong><span>{user.email}</span></div>
        <button onClick={onSignOut} title="Cerrar sesión">↗</button>
      </div>
    </aside>
  );
}
