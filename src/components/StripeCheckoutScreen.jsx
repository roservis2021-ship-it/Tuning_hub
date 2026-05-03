import { useEffect, useRef, useState } from 'react';
import {
  createCheckoutSession,
  createEmbeddedCheckoutSession,
} from '../services/stripeCheckoutService';

function waitForStripe() {
  return new Promise((resolve, reject) => {
    const startedAt = Date.now();

    function checkStripe() {
      if (window.Stripe) {
        resolve(window.Stripe);
        return;
      }

      if (Date.now() - startedAt > 8000) {
        reject(new Error('No se pudo cargar Stripe. Revisa la conexion e intentalo de nuevo.'));
        return;
      }

      window.setTimeout(checkStripe, 120);
    }

    checkStripe();
  });
}

function StripeCheckoutScreen({ result, vehicleName, onBack }) {
  const checkoutRef = useRef(null);
  const mountedCheckoutRef = useRef(null);
  const [error, setError] = useState('');
  const [fallbackReady, setFallbackReady] = useState(false);
  const [isOpeningHostedCheckout, setIsOpeningHostedCheckout] = useState(false);

  useEffect(() => {
    let isMounted = true;

    async function mountCheckout() {
      try {
        const publishableKey = import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY;

        if (!publishableKey) {
          throw new Error('Falta VITE_STRIPE_PUBLISHABLE_KEY en el frontend.');
        }

        const Stripe = await waitForStripe();
        const stripe = Stripe(publishableKey);

        const checkout = await stripe.initEmbeddedCheckout({
          fetchClientSecret: async () => {
            const session = await createEmbeddedCheckoutSession({
              vehicleName,
              buildId: result?.id,
            });

            return session.clientSecret;
          },
        });

        if (!isMounted || !checkoutRef.current) {
          checkout.destroy();
          return;
        }

        mountedCheckoutRef.current = checkout;
        checkout.mount(checkoutRef.current);
        window.setTimeout(() => {
          if (isMounted) {
            setFallbackReady(true);
          }
        }, 4200);
      } catch (checkoutError) {
        if (isMounted) {
          setError(checkoutError.message || 'No se pudo cargar la pasarela de pago.');
          setFallbackReady(true);
        }
      }
    }

    mountCheckout();

    return () => {
      isMounted = false;
      mountedCheckoutRef.current?.destroy();
      mountedCheckoutRef.current = null;
    };
  }, [result?.id, vehicleName]);

  async function handleOpenHostedCheckout() {
    setIsOpeningHostedCheckout(true);
    setError('');

    try {
      const session = await createCheckoutSession({
        vehicleName,
        buildId: result?.id,
      });

      window.location.href = session.url;
    } catch (checkoutError) {
      setError(checkoutError.message || 'No se pudo abrir el pago seguro de Stripe.');
      setIsOpeningHostedCheckout(false);
    }
  }

  return (
    <section className="checkout-screen">
      <header className="premium-plan-topbar">
        <button type="button" className="build-dashboard-back" onClick={onBack}>
          <span aria-hidden="true">&lt;</span>
          Volver
        </button>
        <span>Pago seguro</span>
      </header>

      <article className="checkout-screen__card">
        <span>Plan optimizado</span>
        <h1>Completa el pago</h1>
        <p>
          Pago unico de 3,99 €. Al finalizar, desbloquearemos el plan de ejecucion completo
          para tu coche.
        </p>
        {error ? (
          <div className="checkout-screen__error">
            <strong>No se pudo cargar Stripe</strong>
            <p>{error}</p>
          </div>
        ) : (
          <div className="checkout-screen__loading">Cargando pasarela segura...</div>
        )}
        <div ref={checkoutRef} className="checkout-screen__stripe" />
        {fallbackReady && (
          <div className="checkout-screen__fallback">
            <span>Si la pasarela no carga en este navegador, abre el pago seguro de Stripe.</span>
            <button type="button" onClick={handleOpenHostedCheckout} disabled={isOpeningHostedCheckout}>
              {isOpeningHostedCheckout ? 'Abriendo Stripe...' : 'Abrir pago seguro en Stripe'}
            </button>
          </div>
        )}
      </article>
    </section>
  );
}

export default StripeCheckoutScreen;
