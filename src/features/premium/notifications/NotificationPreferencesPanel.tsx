import { useEffect, useState } from 'react';
import { loadNotificationPreferences, saveNotificationPreferences, type NotificationPreferencesInput } from './notificationClient';

const categoryLabels: [keyof NotificationPreferencesInput['categories'], string][] = [
  ['maintenance', 'Mantenimiento'], ['research', 'Investigación del vehículo'],
  ['diagnostics', 'Diagnósticos'], ['vehicle_alerts', 'Avisos importantes'],
];

export function NotificationPreferencesPanel() {
  const [preferences, setPreferences] = useState<NotificationPreferencesInput | null>(null);
  const [message, setMessage] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    void loadNotificationPreferences().then((value) => { setPreferences(value); }).catch((error: unknown) => {
      setMessage(error instanceof Error ? error.message : 'No se pudieron cargar los avisos.');
    });
  }, []);

  if (!preferences) return <section className="notification-preferences"><h2>Notificaciones</h2><p>{message || 'Cargando preferencias…'}</p></section>;

  function category(key: keyof NotificationPreferencesInput['categories'], enabled: boolean) {
    setPreferences((current) => current ? { ...current, categories: { ...current.categories, [key]: enabled } } : current);
  }

  async function save() {
    if (!preferences) return;
    setSaving(true); setMessage('');
    try { setPreferences(await saveNotificationPreferences(preferences)); setMessage('Preferencias guardadas.'); }
    catch (error) { setMessage(error instanceof Error ? error.message : 'No se pudieron guardar.'); }
    finally { setSaving(false); }
  }

  return <section className="notification-preferences">
    <header><div><span className="auth-card__eyebrow">Avisos privados</span><h2>Notificaciones</h2></div><strong>{preferences.timezone}</strong></header>
    <p>El texto visible nunca incluye detalles mecánicos sensibles. Encontrarás la información completa al entrar en tu garaje.</p>
    <div className="notification-preferences__categories">{categoryLabels.map(([key, label]) => <label key={key}><span>{label}</span><input type="checkbox" checked={preferences.categories[key]} onChange={(event) => { category(key, event.target.checked); }} /></label>)}</div>
    <div className="notification-preferences__channels">
      <label><input type="checkbox" checked={preferences.channels.in_app} onChange={(event) => { setPreferences({ ...preferences, channels: { ...preferences.channels, in_app: event.target.checked } }); }} />Dentro de Tuning Hub</label>
      <label><input type="checkbox" checked={preferences.channels.push} onChange={(event) => { setPreferences({ ...preferences, channels: { ...preferences.channels, push: event.target.checked } }); }} />Push</label>
      <label><input type="checkbox" checked={preferences.channels.email} onChange={(event) => { setPreferences({ ...preferences, channels: { ...preferences.channels, email: event.target.checked } }); }} />Correo</label>
    </div>
    {message ? <p className="auth-feedback">{message}</p> : null}
    <button type="button" disabled={saving} onClick={() => { void save(); }}>{saving ? 'Guardando…' : 'Guardar avisos'}</button>
  </section>;
}
