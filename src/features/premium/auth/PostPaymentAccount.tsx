import { useState, type SyntheticEvent } from 'react';
import { claimPremiumPurchase } from '../../../services/stripeCheckoutService';
import { useAuth } from './AuthContext';
import { getAuthErrorMessage, loginAccount, registerAccount } from './authService';

interface PostPaymentAccountProps {
  purchaseId: string;
  claimToken: string;
  onClaimed: () => void;
}

export function PostPaymentAccount({ purchaseId, claimToken, onClaimed }: PostPaymentAccountProps) {
  const auth = useAuth();
  const [mode, setMode] = useState<'register' | 'login'>('register');
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function claim() {
    await claimPremiumPurchase({ purchaseId, claimToken });
    await auth.refreshAccess();
    onClaimed();
  }

  async function submit(event: SyntheticEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError('');
    try {
      if (mode === 'register') await registerAccount({ displayName, email, password });
      else await loginAccount({ email, password });
      await claim();
    } catch (caught) { setError(getAuthErrorMessage(caught)); } finally { setBusy(false); }
  }

  if (auth.user) {
    return <div className="post-payment-account"><h2>Activa Premium en tu cuenta</h2><p>El pago está confirmado. Vincúlalo a <strong>{auth.user.email}</strong>.</p>{error ? <p className="auth-feedback auth-feedback--error">{error}</p> : null}<button type="button" disabled={busy} onClick={() => { setBusy(true); setError(''); void claim().catch((caught: unknown) => { setError(getAuthErrorMessage(caught)); }).finally(() => { setBusy(false); }); }}>{busy ? 'Activando…' : 'Activar Premium'}</button></div>;
  }

  return <div className="post-payment-account"><h2>{mode === 'register' ? 'Crea tu cuenta Premium' : 'Usa una cuenta existente'}</h2><p>Tu pago ya está confirmado. Ahora crea la cuenta donde guardaremos tu garaje.</p><form onSubmit={(event) => { void submit(event); }}>{mode === 'register' ? <label><span>Nombre</span><input value={displayName} autoComplete="name" onChange={(event) => { setDisplayName(event.target.value); }} required /></label> : null}<label><span>Correo electrónico</span><input type="email" value={email} autoComplete="email" onChange={(event) => { setEmail(event.target.value); }} required /></label><label><span>Contraseña</span><input type="password" value={password} autoComplete={mode === 'register' ? 'new-password' : 'current-password'} onChange={(event) => { setPassword(event.target.value); }} minLength={8} required /></label>{error ? <p className="auth-feedback auth-feedback--error">{error}</p> : null}<button disabled={busy}>{busy ? 'Vinculando compra…' : mode === 'register' ? 'Crear cuenta y activar' : 'Entrar y activar'}</button></form><button className="post-payment-account__switch" type="button" onClick={() => { setMode((current) => current === 'register' ? 'login' : 'register'); setError(''); }}>{mode === 'register' ? 'Ya tengo una cuenta' : 'Crear una cuenta nueva'}</button></div>;
}
