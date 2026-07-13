import { NotificationPreferencesPanel } from '../notifications/NotificationPreferencesPanel';
import { useAuth } from './AuthContext';
import { AuthScreen } from './AuthScreen';

export function AccountPanel({ onBack }: { onBack: () => void }) {
  const auth = useAuth();
  if (auth.authStatus === 'loading') return <section className="premium-access-state"><article><span className="premium-access-state__loader" /><h1>Cargando tu cuenta</h1></article></section>;
  if (!auth.user) return <AuthScreen onBack={onBack} />;

  return <section className="account-shell"><article className="account-card"><header><div><span className="auth-card__eyebrow">Mi cuenta</span><h1>{auth.profile?.displayName ?? auth.user.displayName ?? 'Tu garaje'}</h1><p>{auth.user.email}</p></div><span className={`account-card__status account-card__status--${auth.accessStatus}`}>{auth.accessStatus === 'premium' ? 'Premium activo' : auth.accessStatus === 'error' ? 'Verificación pendiente' : 'Plan gratuito'}</span></header><dl><div><dt>Perfil</dt><dd>{auth.profile?.onboardingCompleted ? 'Completo' : 'Pendiente de completar'}</dd></div><div><dt>Suscripción</dt><dd>{auth.subscriptionType?.replaceAll('_', ' ') ?? 'Sin suscripción activa'}</dd></div><div><dt>Sesión</dt><dd>Protegida con Firebase</dd></div></dl><NotificationPreferencesPanel />{auth.error ? <p className="auth-feedback auth-feedback--error">{auth.error}</p> : null}<footer><button type="button" onClick={() => void auth.refreshAccess()}>Actualizar acceso</button><button className="secondary" type="button" onClick={() => void auth.logout()}>Cerrar sesión</button><button className="link" type="button" onClick={onBack}>Volver</button></footer></article></section>;
}
