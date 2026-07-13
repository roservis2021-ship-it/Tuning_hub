# Recordatorios y notificaciones

El sistema separa cuatro responsabilidades: detección de eventos, cola idempotente, preferencias y entrega por canal. La entrega `in_app` está implementada; `push` y `email` usan el mismo contrato de adaptador y permanecen desactivados hasta configurar proveedor y consentimiento.

## Ejecución programada

Un programador externo debe llamar periódicamente:

```text
POST /api/internal/notifications/process
Authorization: Bearer <NOTIFICATION_SCHEDULER_SECRET>
```

El secreto solo existe en backend. Una ejecución busca tareas de mantenimiento, crea trabajos deterministas y procesa la cola. Los trabajos se deduplican por usuario, evento, entidad, vencimiento y canal. Cada entrega queda registrada en `notificationDeliveries`; los errores transitorios tienen un máximo de tres intentos con espera incremental.

## Privacidad

Los mensajes visibles son genéricos. No contienen síntomas, averías, códigos, kilometraje exacto, piezas ni resultados del diagnóstico. El detalle requiere abrir la sesión autenticada en Tuning Hub.

## Preferencias y zona horaria

Las preferencias viven en `users/{uid}/notificationPreferences/default`. El usuario puede activar las categorías de mantenimiento, investigación, diagnóstico y avisos del vehículo, además de cada canal. `quietHours` se interpreta en la zona IANA guardada en el perfil; durante ese intervalo el trabajo se aplaza sin consumir un intento.

## Proveedores futuros

Un proveedor implementa `send({ event, notificationId, now })` y devuelve opcionalmente `providerMessageId`. Push y correo no deben modificar el cálculo de vencimientos, la deduplicación ni el contenido privado. Los webhooks del proveedor deberán actualizar el registro de entrega, nunca la notificación original.
