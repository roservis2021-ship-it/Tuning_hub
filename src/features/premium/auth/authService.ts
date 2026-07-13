import {
  browserLocalPersistence,
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  sendPasswordResetEmail,
  setPersistence,
  signInWithEmailAndPassword,
  signOut,
  updateProfile,
  type NextOrObserver,
  type User,
} from 'firebase/auth';
import { doc, serverTimestamp, setDoc } from 'firebase/firestore';
import { z } from 'zod';
import { auth, db } from '../../../firebase/config';
import type { AuthCredentials, RegistrationInput } from './authTypes';

const credentialsSchema = z.object({ email: z.email(), password: z.string().min(8).max(128) }).strict();
const registrationSchema = credentialsSchema.extend({ displayName: z.string().trim().min(2).max(80) }).strict();

const sessionResponseSchema = z.object({
  profile: z.object({
    id: z.string(), schemaVersion: z.number().int().positive(), displayName: z.string(), emailNormalized: z.email(),
    locale: z.string(), timezone: z.string(), status: z.enum(['active', 'disabled', 'deleted']), onboardingCompleted: z.boolean(),
    createdAt: z.iso.datetime(), updatedAt: z.iso.datetime(), lastSeenAt: z.iso.datetime().optional(),
  }).nullable(),
  entitlement: z.object({
    type: z.enum(['premium_project', 'premium_subscription', 'extra_build']),
    expiresAt: z.iso.datetime().nullable(),
  }).nullable(),
  roles: z.array(z.enum(['admin', 'editor', 'reviewer'])),
}).strict();

export type TrustedSession = z.infer<typeof sessionResponseSchema>;

function resolveApiBaseUrl(): string {
  const configured = String(import.meta.env.VITE_API_BASE_URL ?? '').replace(/\/$/, '');
  if (typeof window !== 'undefined' && ['localhost', '127.0.0.1', '::1'].includes(window.location.hostname)) return 'http://127.0.0.1:8787';
  return configured;
}

export function configureAuthPersistence(): Promise<void> {
  return setPersistence(auth, browserLocalPersistence);
}

export function observeAuth(observer: NextOrObserver<User>): () => void {
  return onAuthStateChanged(auth, observer);
}

export async function registerAccount(input: RegistrationInput): Promise<void> {
  const validated = registrationSchema.parse(input);
  const credential = await createUserWithEmailAndPassword(auth, validated.email.toLowerCase(), validated.password);
  await updateProfile(credential.user, { displayName: validated.displayName });
  await setDoc(doc(db, 'users', credential.user.uid), {
    displayName: validated.displayName,
    emailNormalized: validated.email.toLowerCase(),
    locale: 'es-ES',
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'Atlantic/Canary',
    status: 'active',
    onboardingCompleted: false,
    schemaVersion: 1,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    lastSeenAt: serverTimestamp(),
  });
}

export async function loginAccount(input: AuthCredentials): Promise<void> {
  const validated = credentialsSchema.parse(input);
  await signInWithEmailAndPassword(auth, validated.email.toLowerCase(), validated.password);
}

export async function requestPasswordReset(email: string): Promise<void> {
  const validatedEmail = z.email().parse(email).toLowerCase();
  await sendPasswordResetEmail(auth, validatedEmail);
}

export function logoutAccount(): Promise<void> {
  return signOut(auth);
}

export async function loadTrustedSession(user: User): Promise<TrustedSession> {
  const token = await user.getIdToken();
  const response = await fetch(`${resolveApiBaseUrl()}/api/auth/session`, { headers: { Authorization: `Bearer ${token}` } });
  const payload: unknown = await response.json();
  if (!response.ok) throw new Error('No se pudo verificar tu acceso con el servidor.');
  return sessionResponseSchema.parse(payload);
}

export function getAuthErrorMessage(error: unknown): string {
  const code = typeof error === 'object' && error !== null && 'code' in error ? String(error.code) : '';
  const messages: Record<string, string> = {
    'auth/email-already-in-use': 'Ya existe una cuenta con este correo.',
    'auth/invalid-credential': 'El correo o la contraseña no son correctos.',
    'auth/invalid-email': 'Introduce un correo válido.',
    'auth/too-many-requests': 'Demasiados intentos. Espera unos minutos antes de continuar.',
    'auth/network-request-failed': 'No se pudo conectar. Revisa tu conexión e inténtalo de nuevo.',
    'auth/weak-password': 'La contraseña debe tener al menos 8 caracteres.',
  };
  if (error instanceof z.ZodError) return error.issues[0]?.message ?? 'Revisa los datos introducidos.';
  return messages[code] ?? (error instanceof Error ? error.message : 'Ha ocurrido un error inesperado.');
}
