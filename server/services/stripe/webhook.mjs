import { createHmac, timingSafeEqual } from 'node:crypto';

const DEFAULT_TOLERANCE_SECONDS = 300;
const SUPPORTED_STATES = new Set(['pending', 'active', 'cancelled', 'expired', 'failed']);

function parseSignatureHeader(signatureHeader) {
  const values = String(signatureHeader || '').split(',').map((part) => part.trim());
  const timestamp = values.find((part) => part.startsWith('t='))?.slice(2);
  const signatures = values.filter((part) => part.startsWith('v1=')).map((part) => part.slice(3));
  if (!timestamp || signatures.length === 0) throw new Error('Falta una firma Stripe válida.');
  return { timestamp, signatures };
}

export function verifyStripeWebhook(rawBody, signatureHeader, secret, options = {}) {
  if (!secret) throw new Error('Falta STRIPE_WEBHOOK_SECRET.');
  const { timestamp, signatures } = parseSignatureHeader(signatureHeader);
  const timestampNumber = Number(timestamp);
  const nowSeconds = options.nowSeconds ?? Math.floor(Date.now() / 1000);
  const toleranceSeconds = options.toleranceSeconds ?? DEFAULT_TOLERANCE_SECONDS;
  if (!Number.isFinite(timestampNumber) || Math.abs(nowSeconds - timestampNumber) > toleranceSeconds) {
    throw new Error('La firma Stripe ha caducado.');
  }
  const expected = createHmac('sha256', secret).update(`${timestamp}.${rawBody}`, 'utf8').digest('hex');
  const expectedBuffer = Buffer.from(expected, 'hex');
  const valid = signatures.some((signature) => {
    if (!/^[a-f0-9]{64}$/i.test(signature)) return false;
    const receivedBuffer = Buffer.from(signature, 'hex');
    return receivedBuffer.length === expectedBuffer.length && timingSafeEqual(receivedBuffer, expectedBuffer);
  });
  if (!valid) throw new Error('La firma Stripe no coincide.');
  const event = JSON.parse(rawBody);
  if (!event?.id || !event?.type || !event?.data?.object) throw new Error('El evento Stripe está incompleto.');
  return event;
}

export function getPaymentTransition(event) {
  const object = event?.data?.object;
  if (!object) return null;
  const metadata = object.metadata || {};
  let status;

  if (event.type === 'checkout.session.completed') status = object.payment_status === 'paid' ? 'active' : 'pending';
  else if (event.type === 'checkout.session.async_payment_succeeded') status = 'active';
  else if (event.type === 'checkout.session.async_payment_failed') status = 'failed';
  else if (event.type === 'checkout.session.expired') status = 'expired';
  else if (event.type === 'customer.subscription.deleted') status = 'cancelled';
  else if (event.type === 'customer.subscription.updated') status = object.status === 'active' || object.status === 'trialing' ? 'active' : object.status === 'canceled' ? 'cancelled' : 'pending';
  else return null;

  if (!SUPPORTED_STATES.has(status)) throw new Error('Estado de pago no soportado.');
  const uid = String(metadata.uid || '');
  const purchaseId = String(metadata.purchaseId || object.id || '');
  const checkoutType = metadata.checkoutType === 'extra_build' ? 'extra_build' : 'plan_action';
  if (!purchaseId) throw new Error('El evento no contiene una referencia de compra válida.');

  return {
    eventId: String(event.id), eventType: String(event.type), uid, purchaseId, checkoutType,
    productCode: checkoutType === 'plan_action' ? 'premium_action_plan' : 'extra_build', status,
    stripeCheckoutSessionId: String(object.id || ''), stripePaymentIntentId: String(object.payment_intent || ''),
    stripeSubscriptionId: String(object.subscription || (event.type.startsWith('customer.subscription.') ? object.id : '') || ''),
    stripeCustomerId: String(object.customer || ''), amount: Number(object.amount_total || 0),
    currency: String(object.currency || 'eur').toLowerCase(), createdAtSeconds: Number(event.created || 0),
  };
}

export function entitlementIdFor(transition) {
  return transition.checkoutType === 'plan_action' ? `premium_${transition.uid}` : `extra_build_${transition.purchaseId}`;
}
