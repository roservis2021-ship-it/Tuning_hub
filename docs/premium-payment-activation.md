# Activación de Tuning Hub Premium

Estado: implementación inicial para pago único, preparada para renovaciones.

## Flujo confiable

1. El usuario puede iniciar el checkout Premium como invitado; todavía no se crea ninguna cuenta.
2. El cliente solicita un checkout indicando únicamente contexto visual como vehículo o build.
3. El backend selecciona el producto y precio configurados, valida el origen contra `STRIPE_ALLOWED_ORIGINS` y genera un secreto de reclamación de un solo uso.
4. El backend crea `purchases/{purchaseId}` en estado `pending` y genera la sesión Stripe con la compra y producto en metadata creada por servidor.
5. Stripe procesa el pago sin que Tuning Hub reciba ni almacene datos completos de tarjeta.
6. Stripe llama a `POST /api/stripe/webhook`. La firma se valida sobre el cuerpo sin transformar usando `STRIPE_WEBHOOK_SECRET`.
7. Una transacción Firestore comprueba `billingEvents/{eventId}`, la compra interna, usuario, producto, importe y moneda.
8. Para una compra invitada, el webhook activa la compra pero todavía no crea un entitlement.
9. La página de retorno verifica la compra con el secreto temporal y, solo cuando el pago está confirmado, muestra registro o acceso a una cuenta existente.
10. El endpoint autenticado de reclamación vincula la compra una sola vez y crea `entitlements/premium_{uid}`. Después se desbloquea el onboarding.

## Estados

- `pending`: checkout creado o método de pago todavía en procesamiento.
- `active`: pago confirmado y acceso concedido.
- `cancelled`: renovación/suscripción futura cancelada.
- `expired`: checkout o entitlement caducado.
- `failed`: creación o pago fallido.

Para pagos únicos, un evento tardío de fallo o expiración no revoca un entitlement que ya quedó activo. Los eventos de suscripción sí pueden cambiar el estado en futuras renovaciones.

## Idempotencia

- Stripe recibe una clave idempotente al crear clientes y sesiones.
- Cada intento tiene un `purchaseId` generado por backend.
- Cada evento se procesa una vez mediante `billingEvents/{stripeEventId}`.
- El entitlement Premium usa `premium_{uid}` y se actualiza en lugar de duplicarse.
- Una cuenta con Premium activo no puede iniciar otro checkout Premium.

## Eventos

Procesados actualmente:

- `checkout.session.completed`
- `checkout.session.async_payment_succeeded`
- `checkout.session.async_payment_failed`
- `checkout.session.expired`
- `customer.subscription.updated`
- `customer.subscription.deleted`

El plan actual usa `mode=payment`. El modelo conserva `billingMode`, `stripeSubscriptionId` y estados de renovación para migrar posteriormente a precios recurrentes sin cambiar la frontera de autorización.

## Configuración

```text
STRIPE_SECRET_KEY=sk_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_ALLOWED_ORIGINS=https://dominio-produccion.com,http://localhost:5173
PUBLIC_APP_URL=https://dominio-produccion.com
STRIPE_ACTION_PLAN_PRICE_ID=price_...
```

El endpoint webhook debe configurarse en Stripe y escuchar los eventos anteriores. Stripe recomienda completar pedidos desde webhooks porque el usuario puede no regresar a la URL de éxito; también indica usar `async_payment_succeeded` y `async_payment_failed` para métodos diferidos. Referencias: [Checkout fulfillment](https://docs.stripe.com/checkout/fulfillment), [Checkout Sessions](https://docs.stripe.com/payments/checkout-sessions), [metadata](https://docs.stripe.com/metadata).

## Límites actuales

- No se despliega automáticamente el webhook ni las reglas Firestore.
- No se almacenan PAN, CVC ni objetos completos de métodos de pago.
- Reembolsos y disputas requieren una fase posterior con política de revocación explícita.
