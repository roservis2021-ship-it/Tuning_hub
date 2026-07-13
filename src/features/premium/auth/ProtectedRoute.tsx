import type { ReactNode } from 'react';
import { useAuth } from './AuthContext';
import { AuthScreen } from './AuthScreen';
import { decideRouteAccess, type ProtectedArea } from './routeAccess';
import type { AdminRole } from './authTypes';

interface ProtectedRouteProps {
  area: ProtectedArea;
  requiredRole?: AdminRole;
  children: ReactNode;
  onBack?: () => void;
  onSubscriptionRequired?: () => void;
}

export function ProtectedRoute({ area, requiredRole, children, onBack, onSubscriptionRequired }: ProtectedRouteProps) {
  const auth = useAuth();
  const decision = decideRouteAccess({ area, requiredRole, authStatus: auth.authStatus, accessStatus: auth.accessStatus, roles: auth.roles });

  if (decision === 'loading') return <AccessState title="Comprobando tu cuenta" copy="Estamos verificando de forma segura tu sesión y acceso Premium." loading />;
  if (decision === 'sign_in') return <AuthScreen onBack={onBack} />;
  if (decision === 'error') return <AccessState title="No podemos verificar tu acceso" copy={auth.error ?? 'Inténtalo de nuevo en unos segundos.'} actionLabel="Reintentar" onAction={() => void auth.refreshAccess()} onBack={onBack} />;
  if (decision === 'subscription_required') return <AccessState title="Tu cuenta está lista" copy="No encontramos una suscripción Premium activa asociada a esta cuenta. El acceso solo se activa tras una confirmación de pago válida." actionLabel={onSubscriptionRequired ? 'Ver opciones Premium' : 'Comprobar de nuevo'} onAction={onSubscriptionRequired ?? (() => void auth.refreshAccess())} onBack={onBack} />;
  if (decision === 'forbidden') return <AccessState title="Acceso restringido" copy="Esta zona requiere un rol administrativo autorizado." onBack={onBack} />;
  return <>{children}</>;
}

function AccessState({ title, copy, loading = false, actionLabel, onAction, onBack }: { title: string; copy: string; loading?: boolean; actionLabel?: string; onAction?: () => void; onBack?: () => void }) {
  return <section className="premium-access-state"><article>{loading ? <span className="premium-access-state__loader" aria-hidden="true" /> : <span className="premium-access-state__lock" aria-hidden="true">TH</span>}<p className="auth-card__eyebrow">Acceso protegido</p><h1>{title}</h1><p>{copy}</p><div>{actionLabel && onAction ? <button type="button" onClick={onAction}>{actionLabel}</button> : null}{onBack ? <button className="secondary" type="button" onClick={onBack}>Volver</button> : null}</div></article></section>;
}
