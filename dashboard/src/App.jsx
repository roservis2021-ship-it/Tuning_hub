import { useEffect, useState } from 'react';
import {
  browserLocalPersistence,
  onAuthStateChanged,
  setPersistence,
  signInWithEmailAndPassword,
  signOut,
} from 'firebase/auth';
import { auth, firebaseReady } from './firebase';
import DashboardPage from './components/DashboardPage';
import ResourcePage from './components/ResourcePage';
import Sidebar from './components/Sidebar';
import AdminDataPage from './components/AdminDataPage';
import ResearchReviewPage from './components/ResearchReviewPage';
import { resources } from './config/resources';

function Login({ onSubmit, error, busy }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  return (
    <main className="login-shell">
      <form className="login-card" onSubmit={(event) => onSubmit(event, email, password)}>
        <div className="login-brand"><div className="brand-mark">TH</div><span>Tuning Hub Knowledge Base</span></div>
        <p className="eyebrow">Acceso privado</p>
        <h1>El cerebro de<br />Tuning Hub.</h1>
        <p>Crea, verifica y conecta el conocimiento técnico que alimenta toda la plataforma.</p>
        <label><span>Email</span><input type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} required /></label>
        <label><span>Contraseña</span><input type="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} required /></label>
        {error ? <p className="error">{error}</p> : null}
        <button className="primary" disabled={busy}>{busy ? 'Verificando…' : 'Entrar a THKB'}</button>
      </form>
    </main>
  );
}

function PlaceholderPage({ type }) {
  const content = type === 'analytics'
    ? ['Analytics', 'Las métricas de cobertura, calidad y uso de la base de conocimiento vivirán aquí.']
    : ['Configuración', 'Preferencias del sistema, usuarios, importaciones y copias de seguridad.'];
  return <div className="page placeholder-page"><p className="eyebrow">Próximo módulo</p><h1>{content[0]}</h1><p>{content[1]}</p><div className="placeholder-visual">THKB <span>→</span> {content[0]}</div></div>;
}

export default function App() {
  const [user, setUser] = useState(null);
  const [roles, setRoles] = useState([]);
  const [authLoading, setAuthLoading] = useState(true);
  const [authError, setAuthError] = useState('');
  const [accessDenied, setAccessDenied] = useState(false);
  const [busy, setBusy] = useState(false);
  const [activePage, setActivePage] = useState('dashboard');
  const [createOnOpen, setCreateOnOpen] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    let unsubscribe = () => {};
    let isMounted = true;

    setPersistence(auth, browserLocalPersistence)
      .catch(() => {
        // Si el navegador limita el almacenamiento, seguimos con la persistencia por defecto.
      })
      .finally(() => {
        if (!isMounted) return;
        unsubscribe = onAuthStateChanged(auth, async (nextUser) => {
          if (!nextUser) {
            setUser(null);
            setAccessDenied(false);
            setAuthLoading(false);
            return;
          }
          try {
            const token = await nextUser.getIdTokenResult();
            const claimedRoles = new Set(Array.isArray(token.claims.roles) ? token.claims.roles : []);
            if (token.claims.admin === true) claimedRoles.add('admin');
            if (['admin', 'editor', 'reviewer'].includes(token.claims.role)) claimedRoles.add(token.claims.role);
            const resolvedRoles = [...claimedRoles].filter((role) => ['admin', 'editor', 'reviewer'].includes(role));
            const authorized = resolvedRoles.length > 0;
            setUser(authorized ? nextUser : null);
            setRoles(authorized ? resolvedRoles : []);
            if (authorized && resolvedRoles.includes('reviewer') && !resolvedRoles.some((role) => ['admin', 'editor'].includes(role))) setActivePage('research');
            setAccessDenied(!authorized);
          } catch {
            setUser(null);
            setAccessDenied(true);
          } finally {
            setAuthLoading(false);
          }
        });
      });

    return () => {
      isMounted = false;
      unsubscribe();
    };
  }, []);

  async function handleLogin(event, email, password) {
    event.preventDefault();
    setBusy(true);
    setAuthError('');
    try {
      await signInWithEmailAndPassword(auth, email, password);
    } catch {
      setAuthError('Acceso denegado. Revisa el email y la contraseña.');
    } finally {
      setBusy(false);
    }
  }

  function navigate(page, create = false) {
    setActivePage(page);
    setCreateOnOpen(create);
    setSidebarOpen(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  if (authLoading) return <main className="center-message"><div className="loader"></div>Conectando con THKB…</main>;
  if (!firebaseReady) return <main className="center-message">Faltan las variables de Firebase.</main>;
  if (accessDenied) return <main className="center-message">Esta cuenta no tiene el rol de administrador o editor necesario.<button className="primary" onClick={() => signOut(auth)}>Cerrar sesión</button></main>;
  if (!user) return <Login onSubmit={handleLogin} error={authError} busy={busy} />;

  return (
    <div className="app-shell">
      <Sidebar activePage={activePage} onNavigate={navigate} user={user} roles={roles} onSignOut={() => signOut(auth)} open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      {sidebarOpen ? <button className="sidebar-backdrop" onClick={() => setSidebarOpen(false)} aria-label="Cerrar menú" /> : null}
      <main className="main-content">
        <div className="mobile-bar"><button onClick={() => setSidebarOpen(true)}>☰</button><strong>THKB</strong><span>{resources[activePage]?.label || 'Dashboard'}</span></div>
        {activePage === 'dashboard' ? <DashboardPage onNavigate={navigate} /> : activePage === 'research' ? <ResearchReviewPage roles={roles} /> :
          ['users', 'subscriptions', 'diagnostics', 'aiUsage'].includes(activePage) ? <AdminDataPage resource={activePage} /> :
          resources[activePage] ? <ResourcePage resourceKey={activePage} user={user} canEdit={roles.includes('admin') || roles.includes('editor')} openNew={createOnOpen} onNewHandled={() => setCreateOnOpen(false)} /> :
            <PlaceholderPage type={activePage} />}
      </main>
    </div>
  );
}
