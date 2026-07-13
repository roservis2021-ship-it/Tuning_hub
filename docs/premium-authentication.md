# Base de autenticación Premium

## Fronteras de confianza

- Firebase Authentication gestiona registro, inicio de sesión, recuperación, persistencia y cierre de sesión.
- El navegador conserva únicamente la sesión administrada por Firebase. No se guardan contraseñas, tokens ni permisos en `localStorage`.
- El perfil privado vive en `users/{uid}` y no contiene roles editables por el usuario.
- El estado Premium procede de `entitlements`, escrito únicamente por servidor. El endpoint `GET /api/auth/session` verifica el ID token y devuelve solo un resumen del entitlement activo.
- Los endpoints del especialista Premium vuelven a verificar token y entitlement en backend. La protección visual no se considera una medida de seguridad.
- Los roles administrativos proceden de custom claims (`admin`, `role` o `roles`). Premium y administración son permisos independientes.
- En el flujo de venta Premium para usuarios nuevos, la cuenta se crea únicamente después de que el webhook haya confirmado el pago. Un secreto temporal de un solo uso vincula después la compra a esa cuenta.

## Estados del cliente

La aplicación diferencia restauración de sesión, usuario no autenticado, autenticado gratuito, Premium verificado y error de verificación. Mientras el backend no pueda confirmar el entitlement no se muestra contenido Premium.

## Operación necesaria

Antes de desplegar las reglas nuevas debe asignarse el custom claim apropiado a las cuentas actuales del dashboard. El pago todavía necesita el webhook idempotente definido en `premium-architecture.md` para crear o revocar entitlements; el cliente nunca realiza esa escritura.
