# Capa de datos Premium

Estado: implementación inicial de contratos, sin interfaz ni cambios de reglas Firebase.

## Decisiones

- Los modelos canónicos viven en `src/features/premium/models` y usan `Date` para todas las fechas.
- La frontera Firestore convierte `Date` a `Timestamp` al escribir y realiza la conversión inversa antes de validar lecturas.
- Toda entrada procedente de formularios, red, IA o Firestore se considera `unknown` hasta pasar un esquema Zod estricto.
- Los datos técnicos compartidos incluyen `sourceIds`, confianza y estado de revisión mediante `TechnicalProvenance`.
- La potencia de fábrica (`stockPowerCv`), la estimada (`estimatedPowerCv`) y la declarada por el usuario (`userDeclaredPowerCv`) son campos independientes.
- Los repositorios reciben una instancia de Firestore por inyección. No importan la configuración Firebase global, lo que permite reutilizarlos en cliente, emulador o pruebas.
- Las rutas respetan `docs/premium-architecture.md`: maestros en colecciones superiores y estado particular en subcolecciones del vehículo o proyecto.
- Los datos mock se limitan a `__tests__`; no se añaden fallbacks técnicos ficticios a producción.

## Alcance pendiente

Esta capa no concede permisos por sí misma. Antes de usarla desde la aplicación pública deben implementarse autenticación, reglas de propietario, índices, Storage privado y autorización del backend según la arquitectura Premium.
