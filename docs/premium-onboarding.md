# Onboarding Premium

## Objetivo

El onboarding recoge exclusivamente información declarada por el propietario para crear el primer contexto de su garaje. No resuelve automáticamente la variante, no inventa potencia, compatibilidades, mantenimiento ni fallos conocidos.

## Experiencia

El formulario contiene seis pasos y un resumen final:

1. Identificación del vehículo.
2. Estado e historial.
3. Modificaciones declaradas.
4. Uso principal.
5. Objetivo.
6. Preferencias estéticas.
7. Resumen y consentimiento.

Cada paso se valida antes de avanzar. El borrador se guarda por UID en el dispositivo y se elimina después de una creación confirmada. La matrícula y el VIN no se solicitan ni persisten en esta fase; se añadirán únicamente si existe una finalidad y protección definidas.

## Persistencia final

`POST /api/premium/onboarding` requiere token Firebase y entitlement Premium activo. Una transacción crea o actualiza:

- `userVehicles/{userVehicleId}` con identidad declarada y resolución `unresolved`.
- `userVehicles/{userVehicleId}/goals/{goalId}` con viabilidad `pending_evaluation`.
- `premiumProjects/{projectId}` en estado `generating` y con el snapshot declarado del onboarding.
- `users/{uid}` con referencias activas y `onboardingCompleted`.
- El entitlement con el alcance del vehículo y proyecto.

Las categorías de modificaciones se conservan como declaraciones dentro del snapshot. No se crean piezas instaladas concretas hasta que el usuario aporte detalle suficiente.

La operación es idempotente para el usuario: si el onboarding ya se completó, devuelve las referencias activas existentes en vez de crear otro garaje por un reintento de red.

## Preparación visual

Después de guardar se muestra la secuencia:

1. Identificando vehículo.
2. Consultando ficha técnica.
3. Preparando mantenimiento.
4. Analizando objetivo.
5. Generando ruta.
6. Configurando especialista IA.
7. Garaje listo.

Esta secuencia representa el estado de preparación. No implica que las fichas técnicas o recomendaciones extensas ya hayan sido publicadas.
