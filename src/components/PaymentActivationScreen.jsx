import { useEffect, useState } from 'react';
import { useAuth } from '../features/premium/auth/AuthContext';
import { getCheckoutSessionStatus } from '../services/stripeCheckoutService';
import { PostPaymentAccount } from '../features/premium/auth/PostPaymentAccount';

const MAX_CHECKS = 8;

function PaymentActivationScreen({ sessionId, purchaseId, claimToken, checkoutType = 'plan_action', cancelled = false, onActivated, onRetry, onBack }) {
  const { refreshAccess } = useAuth();
  const [state, setState] = useState(cancelled ? 'cancelled' : 'checking');
  const [message, setMessage] = useState('Stripe ha recibido el pago. Estamos activando tu acceso de forma segura.');
  const [retryKey, setRetryKey] = useState(0);

  useEffect(() => {
    if (!sessionId || cancelled) return undefined;
    let active = true;
    let timerId;
    let checks = 0;

    async function checkActivation() {
      try {
        const status = await getCheckoutSessionStatus(sessionId, claimToken);
        if (!active) return;
        const activated = checkoutType === 'extra_build' ? status.purchaseStatus === 'active' : status.entitlementActive;
        if (activated) {
          await refreshAccess();
          if (active) {
            setState('active');
            onActivated(status);
          }
          return;
        }
        if (status.requiresAccount) {
          setState('account_required');
          setMessage('El pago está confirmado. Crea tu cuenta para guardar el garaje y activar Premium.');
          return;
        }
        if (['failed', 'expired', 'cancelled'].includes(status.purchaseStatus) || status.activationStatus === 'expired') {
          setState('incomplete');
          setMessage('El pago no se completó o la sesión ha caducado. No se ha activado Premium.');
          return;
        }
        checks += 1;
        if (checks >= MAX_CHECKS) {
          setState('processing');
          setMessage('El pago está confirmado, pero la activación sigue procesándose. Puedes volver a comprobarla sin pagar otra vez.');
          return;
        }
        timerId = window.setTimeout(checkActivation, 1800);
      } catch (error) {
        if (active) {
          setState('error');
          setMessage(error?.message || 'No se pudo comprobar el pago en este momento.');
        }
      }
    }

    checkActivation();
    return () => { active = false; window.clearTimeout(timerId); };
  }, [cancelled, checkoutType, claimToken, onActivated, refreshAccess, retryKey, sessionId]);

  const isLoading = state === 'checking';
  return <section className="payment-result-screen"><article className={`payment-result-card payment-result-card--${state}`}><span className={isLoading ? 'premium-access-state__loader' : 'payment-result-card__icon'}>{isLoading ? '' : state === 'active' ? '✓' : state === 'account_required' ? 'TH' : '!'}</span><p className="auth-card__eyebrow">Activación Premium</p><h1>{state === 'cancelled' ? 'Pago cancelado' : state === 'incomplete' ? 'Pago incompleto' : state === 'error' ? 'No pudimos verificarlo' : state === 'processing' ? 'Activación en proceso' : state === 'account_required' ? 'Pago confirmado' : state === 'active' ? 'Premium activado' : 'Validando tu pago'}</h1><p>{state === 'cancelled' ? 'Has salido del pago antes de completarlo. No se ha realizado ninguna activación.' : message}</p>{state === 'account_required' ? <PostPaymentAccount purchaseId={purchaseId} claimToken={claimToken} onClaimed={() => { onActivated({ checkoutType }); }} /> : <div>{state === 'processing' || state === 'error' ? <button type="button" onClick={() => { setState('checking'); setMessage('Volvemos a comprobar el pago de forma segura.'); setRetryKey((value) => value + 1); }}>Comprobar de nuevo</button> : null}{state === 'cancelled' || state === 'incomplete' ? <button type="button" onClick={onRetry}>Intentar el pago de nuevo</button> : null}{!isLoading ? <button className="secondary" type="button" onClick={onBack}>Volver</button> : null}</div>}<small>No guardamos datos de tarjeta. El pago se procesa directamente en Stripe.</small></article></section>;
}

export default PaymentActivationScreen;
