import { createHash } from 'node:crypto';

const ROUTE_LIMITS = [
  [/^\/api\/generate-build$/, 8, 10 * 60_000],
  [/^\/api\/(generate-premium-advisor-plan|premium-advisor-chat)$/, 20, 10 * 60_000],
  [/^\/api\/premium\/specialist\/turns$/, 30, 10 * 60_000],
  [/^\/api\/(create-checkout-session|create-embedded-checkout-session)$/, 20, 10 * 60_000],
  [/^\/api\/(premium\/claim-purchase|checkout-session-status)$/, 30, 10 * 60_000],
];

export class SlidingWindowRateLimiter {
  constructor(maximumKeys = 10_000) { this.maximumKeys = maximumKeys; this.entries = new Map(); }
  consume(key, limit, windowMs, now = Date.now()) {
    const threshold = now - windowMs; const previous = this.entries.get(key) || []; const active = previous.filter((time) => time > threshold);
    if (active.length >= limit) return { allowed: false, retryAfterSeconds: Math.max(1, Math.ceil((active[0] + windowMs - now) / 1000)) };
    active.push(now); this.entries.set(key, active); this.prune(now, windowMs); return { allowed: true, remaining: limit - active.length };
  }
  prune(now, windowMs) { if (this.entries.size <= this.maximumKeys) return; for (const [key, values] of this.entries) { if (!values.some((time) => time > now - windowMs)) this.entries.delete(key); if (this.entries.size <= this.maximumKeys) break; } while (this.entries.size > this.maximumKeys) this.entries.delete(this.entries.keys().next().value); }
}

export function enforceRequestRateLimit(request, response, pathname, limiter, now = Date.now()) {
  const rule = ROUTE_LIMITS.find(([pattern]) => pattern.test(pathname)); if (!rule) return;
  const [, limit, windowMs] = rule; const identity = requestIdentity(request); const result = limiter.consume(`${identity}:${pathname}`, limit, windowMs, now);
  response.setHeader('X-RateLimit-Limit', String(limit)); response.setHeader('X-RateLimit-Remaining', String(result.remaining || 0));
  if (!result.allowed) { response.setHeader('Retry-After', String(result.retryAfterSeconds)); const error = new Error('Demasiadas solicitudes. Inténtalo de nuevo más tarde.'); error.statusCode = 429; throw error; }
}

export function applyHttpSecurityHeaders(request, response, configuredOrigins, nodeEnv = 'development') {
  const allowed = allowedOrigins(configuredOrigins, nodeEnv); const origin = String(request.headers.origin || '').replace(/\/$/, '');
  if (origin && allowed.has(origin)) response.setHeader('Access-Control-Allow-Origin', origin);
  response.setHeader('Vary', 'Origin'); response.setHeader('Access-Control-Allow-Methods', 'GET,POST,PATCH,DELETE,OPTIONS'); response.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization'); response.setHeader('Access-Control-Max-Age', '600');
  response.setHeader('X-Content-Type-Options', 'nosniff'); response.setHeader('Referrer-Policy', 'no-referrer'); response.setHeader('Cache-Control', 'no-store');
  return !origin || allowed.has(origin);
}

function allowedOrigins(configured, nodeEnv) { const result = new Set(String(configured || '').split(',').map((value) => value.trim().replace(/\/$/, '')).filter(Boolean)); if (nodeEnv !== 'production') { result.add('http://localhost:5173'); result.add('http://127.0.0.1:5173'); result.add('http://localhost:5174'); result.add('http://127.0.0.1:5174'); } return result; }
function requestIdentity(request) { const authorization = String(request.headers.authorization || ''); if (authorization.startsWith('Bearer ')) return `auth:${createHash('sha256').update(authorization.slice(7)).digest('hex').slice(0, 24)}`; const forwarded = String(request.headers['x-forwarded-for'] || '').split(',').map((value) => value.trim()).filter(Boolean); const address = String(request.headers['x-real-ip'] || '') || forwarded.at(-1) || request.socket?.remoteAddress || 'unknown'; return `ip:${createHash('sha256').update(address).digest('hex').slice(0, 24)}`; }
