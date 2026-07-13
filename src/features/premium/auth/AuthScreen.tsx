import { useState, type SyntheticEvent } from 'react';
import { getAuthErrorMessage, loginAccount, registerAccount, requestPasswordReset } from './authService';

type AuthMode = 'login' | 'register' | 'reset';

export function AuthScreen({ onBack, allowRegistration = false }: { onBack?: () => void; allowRegistration?: boolean }) {
  const [mode, setMode] = useState<AuthMode>('login');
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  async function handleSubmit(event: SyntheticEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError('');
    setMessage('');
    try {
      if (mode === 'register') await registerAccount({ displayName, email, password });
      else if (mode === 'reset') {
        await requestPasswordReset(email);
        setMessage('Te hemos enviado un enlace para restablecer la contraseña.');
      } else await loginAccount({ email, password });
    } catch (caught) {
      setError(getAuthErrorMessage(caught));
    } finally {
      setBusy(false);
    }
  }

  function changeMode(nextMode: AuthMode) {
    setMode(nextMode);
    setError('');
    setMessage('');
  }

  return (
    <section className="auth-shell" aria-labelledby="auth-title">
      <article className="auth-card">
        <div className="auth-card__brand" aria-label="Tuning Hub"><span>TUNING</span><strong>HUB</strong></div>
        <span className="auth-card__eyebrow">Tu garaje Premium</span>
        <h1 id="auth-title">{mode === 'register' ? 'Crea tu cuenta' : mode === 'reset' ? 'Recupera el acceso' : 'Bienvenido de nuevo'}</h1>
        <p>{mode === 'register' ? 'Guarda tu vehículo, tu historial y la evolución de tu proyecto.' : mode === 'reset' ? 'Recibirás un enlace seguro en tu correo.' : 'Continúa con el proyecto de tu coche desde cualquier dispositivo.'}</p>

        <form onSubmit={(event) => { void handleSubmit(event); }} noValidate>
          {mode === 'register' ? <label><span>Nombre</span><input value={displayName} onChange={(event) => { setDisplayName(event.target.value); }} autoComplete="name" required minLength={2} /></label> : null}
          <label><span>Correo electrónico</span><input type="email" value={email} onChange={(event) => { setEmail(event.target.value); }} autoComplete="email" required /></label>
          {mode !== 'reset' ? <label><span>Contraseña</span><input type="password" value={password} onChange={(event) => { setPassword(event.target.value); }} autoComplete={mode === 'register' ? 'new-password' : 'current-password'} required minLength={8} /><small>Mínimo 8 caracteres.</small></label> : null}
          {error ? <p className="auth-feedback auth-feedback--error" role="alert">{error}</p> : null}
          {message ? <p className="auth-feedback auth-feedback--success" role="status">{message}</p> : null}
          <button className="auth-card__submit" disabled={busy}>{busy ? 'Procesando…' : mode === 'register' ? 'Crear cuenta' : mode === 'reset' ? 'Enviar enlace' : 'Iniciar sesión'}</button>
        </form>

        <div className="auth-card__actions">
          {mode === 'login' ? <><button type="button" onClick={() => { changeMode('reset'); }}>He olvidado mi contraseña</button>{allowRegistration ? <button type="button" onClick={() => { changeMode('register'); }}>Crear una cuenta</button> : null}</> : <button type="button" onClick={() => { changeMode('login'); }}>Volver al inicio de sesión</button>}
        </div>
        {onBack ? <button className="auth-card__back" type="button" onClick={onBack}>← Volver a Tuning Hub</button> : null}
      </article>
      <aside className="auth-benefits" aria-label="Ventajas de tu cuenta">
        <span>PROYECTO VIVO</span><h2>Tu coche no empieza de cero cada vez.</h2>
        <ul><li>Historial y estado real del vehículo</li><li>Plan actualizado con el siguiente paso</li><li>Acceso protegido a tu especialista IA</li></ul>
      </aside>
    </section>
  );
}
