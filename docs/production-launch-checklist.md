# Checklist de lanzamiento — Tuning Hub Premium

Fecha de preparación: 13 de julio de 2026. Este documento no autoriza un despliegue.

## 1. Puertas obligatorias

- [ ] Rama y commit de lanzamiento identificados.
- [ ] `npm ci` ejecutado desde un entorno limpio.
- [x] `npm run check:secrets` sin hallazgos, incluido el historial Git.
- [x] `npm run typecheck` correcto.
- [x] `npm run lint` correcto.
- [x] `npm test` correcto: 71 pruebas.
- [x] `npm run test:e2e` correcto: 12 casos en móvil, tablet y escritorio.
- [x] `npm run build` correcto.
- [x] Build del dashboard administrativo correcto.
- [x] `git diff --check` correcto.
- [ ] Reglas Firestore y Storage compiladas/verificadas con Firebase CLI contra staging.
- [x] Reglas e índices de Firestore compilados con Firebase CLI en `dry-run`.
- [ ] Firebase Storage inicializado en el proyecto y bucket privado confirmado.
- [ ] Índices de `firebase/firestore.indexes.json` creados y en estado `Ready`.
- [ ] Ningún secreto presente en Git, bundles, mapas de fuentes ni variables `VITE_*`.

## 2. Infraestructura y configuración

- [ ] Entorno de staging separado de producción.
- [ ] `NODE_ENV=production` y puerta de configuración del backend superada.
- [ ] `PUBLIC_APP_URL`, CORS y orígenes de Stripe contienen únicamente HTTPS explícito.
- [ ] Credencial Firebase Admin almacenada como secreto del proveedor, nunca como archivo versionado.
- [ ] Stripe usa claves live solo en producción y webhook live con firma verificada.
- [ ] OpenAI usa proyecto/API key con presupuesto y alertas propios de producción.
- [ ] `NOTIFICATION_SCHEDULER_SECRET` generado con alta entropía.
- [ ] Dominios, TLS, DNS y URLs de retorno de Stripe verificados.
- [ ] `autoDeploy` de Render permanece desactivado hasta aprobación del propietario.

## 3. Datos, migraciones y backup

- [ ] Export completo de Firestore creado antes de índices, reglas o migraciones de datos.
- [ ] Backup de objetos de Storage o política de versionado/retención confirmada.
- [ ] IDs de exportación, bucket, proyecto, fecha y commit registrados en el ticket de lanzamiento.
- [ ] Migraciones ejecutadas primero en staging con conteos antes/después.
- [ ] Toda migración es reanudable e idempotente y dispone de modo `--dry-run`.
- [ ] No se elimina ningún campo antiguo en el mismo lanzamiento que introduce su sustituto.
- [ ] Ventana de compatibilidad definida para clientes o documentos antiguos.

Comando orientativo de backup, que debe completarse con el proyecto y bucket correctos y ejecutarse por una persona autorizada:

```text
gcloud firestore export gs://<bucket-backups>/<fecha>-<commit>
```

No automatizar este comando desde la aplicación ni utilizar un bucket sin política de retención y acceso restringido.

## 4. Rendimiento y costes

- [ ] Comparar tamaños de `dist/assets` con la referencia del lanzamiento anterior.
- [ ] Portada comprobada sin descargar Stripe, Premium ni imágenes de builds antes de necesitarlos.
- [ ] Caché de Hosting comprobada: assets con hash inmutables e `index.html` revalidable.
- [ ] Firestore Offline/Persistent Cache comprobada en Chrome, Safari e iOS.
- [ ] Lecturas por apertura del garaje medidas en staging.
- [ ] Límites diarios de IA, tokens máximos y rate limiting confirmados.
- [ ] Alertas presupuestarias configuradas en Firebase/Google Cloud, OpenAI, Stripe y Render.
- [ ] Política de retención para audios, imágenes, `aiRuns`, `aiUsage`, notificaciones y logs aprobada.

## 5. Observabilidad y soporte

- [ ] Health check `/api/health` monitorizado desde una región externa.
- [ ] Logs JSON ingeridos y consultables por `requestId`, estado y duración.
- [ ] Alertas para tasa 5xx, latencia, fallos de webhook, colas de notificación y errores de IA.
- [ ] APM/error tracking del frontend elegido y configurado sin enviar VIN, matrícula, prompts completos ni evidencias.
- [ ] Paneles de consumo de IA y Firebase revisados por el propietario.
- [ ] Runbook y responsables de guardia definidos.

## 6. Lanzamiento gradual

- [ ] Desplegar primero backend compatible con cliente anterior.
- [ ] Ejecutar smoke tests del backend y webhook en staging.
- [ ] Desplegar reglas e índices únicamente cuando estén listos y probados.
- [ ] Desplegar frontend a un canal de preview y ejecutar E2E.
- [ ] Promover a producción con un porcentaje/ventana controlada cuando el proveedor lo permita.
- [ ] Vigilar errores, latencia, lecturas, almacenamiento y tokens durante al menos una hora.

## 7. Rollback

1. Detener promociones y procesos de migración.
2. Revertir frontend al artefacto Hosting anterior, no reconstruir desde una rama mutable.
3. Revertir backend al commit/imagen anterior manteniendo compatibilidad de esquema.
4. Restaurar reglas anteriores solo si no reabren una vulnerabilidad; priorizar una regla de denegación temporal.
5. No restaurar Firestore sobre producción sin confirmar alcance, RPO/RTO y pérdida de escrituras posteriores.
6. Si una migración escribió datos incorrectos, ejecutar su compensación idempotente; usar el backup solo como último recurso.
7. Rotar claves si el incidente implica exposición y conservar evidencias de auditoría.
8. Documentar cronología, impacto y acciones preventivas.

## Riesgos pendientes que requieren decisión

- No existe todavía un proveedor APM/error tracking configurado para frontend y backend.
- Firebase Storage no está inicializado actualmente en el proyecto `tuning-hub-2`; sus reglas no pueden validarse ni publicarse hasta crear y configurar el bucket. Firestore Rules e índices sí superan el `dry-run` de Firebase CLI.
- La auditoría compatible de npm eliminó las vulnerabilidades altas; permanecen 8 moderadas transitivas de Firebase Admin. Resolverlas exige un cambio mayor de su árbol de dependencias y una regresión específica antes de producción; no debe utilizarse `npm audit fix --force` sin plan de migración.
- El script de lint actual cubre Premium, pagos y servicios de Stripe, pero no todo el JavaScript heredado. Debe ampliarse de forma gradual sin ocultar la deuda existente.
- No existe una política aprobada de retención y borrado automático para evidencias multimedia y logs de IA.
- Las imágenes PNG de catálogo pesan aproximadamente 1,3–2,3 MB cada una; la carga es diferida, pero deben convertirse a WebP/AVIF y generar tamaños responsive antes de una campaña con tráfico elevado.
- El backend principal continúa siendo monolítico; aumenta el radio de impacto y dificulta rollbacks parciales.
- La navegación pública continúa siendo estado interno sin URLs indexables por pantalla; el SEO solo puede cubrir correctamente la landing hasta introducir rutas públicas reales o prerenderizado.
- La prueba de pago, webhook, Auth, Storage y persistencia completa debe repetirse en staging con Stripe test y Firebase separado.
- Los backups y alertas presupuestarias dependen de configuración externa y no pueden verificarse únicamente desde el repositorio.
- Debe definirse el RPO/RTO aceptable por el propietario antes de aprobar producción.
