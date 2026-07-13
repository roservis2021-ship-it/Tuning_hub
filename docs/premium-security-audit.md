# Auditoría de seguridad de Tuning Hub Premium

Fecha: 13 de julio de 2026.

## Alcance y conclusión

Se revisaron Firebase Auth, Firestore, Storage, backend, Stripe, rutas Premium, dashboard, contexto de IA, evidencias multimedia, límites de consumo, logs y borrado. No se encontraron secretos reales versionados ni claves privadas dentro de los archivos rastreados por Git. Las claves de OpenAI, Stripe y Firebase Admin permanecen en variables de backend; las variables `VITE_FIREBASE_*` y la clave publicable de Stripe son identificadores públicos por diseño y no conceden privilegios por sí solas.

Las correcciones de esta auditoría reducen los riesgos críticos verificables, pero no convierten por sí solas el producto en una plataforma certificada. Antes de producción deben resolverse las decisiones de la sección final.

## Hallazgos corregidos

### Aislamiento entre usuarios — crítico

`userVehicles` permitía al propietario cambiar `activeProjectId`. El backend usa Admin SDK y podía seguir esa referencia hacia un proyecto distinto si se conocía su ID. Aunque varias operaciones comprobaban la conversación, la creación del chat no verificaba explícitamente el propietario del proyecto.

Corrección:

- El navegador ya no puede crear vehículos Premium ni modificar referencias estructurales como `activeProjectId`, `variantId`, `researchJobId` u `ownerId`.
- Las actualizaciones del usuario se limitan a campos personales previstos, con kilometraje acotado.
- El Especialista IA valida conjuntamente propietario, vehículo y proyecto antes de leer contexto o crear conversaciones.
- La creación y eliminación del vehículo principal quedan reservadas al backend para evitar documentos huérfanos o referencias cruzadas.

### Reglas genéricas de subcolecciones — alto

La regla comodín de `userVehicles` autorizaba cualquier subcolección de primer nivel si contenía un `ownerId` válido. Se sustituyó por reglas explícitas para mantenimiento, tareas, modificaciones, objetivos y diagnósticos.

Una sesión de diagnóstico creada por el usuario debe empezar con `professionalAssessmentVerified == false`. El cliente no puede convertir posteriormente una evaluación en profesional verificada. Las modificaciones declaradas tampoco pueden autoasignarse estados `approved` o `published`.

### Inyección de instrucciones en IA — alto

El contexto del vehículo y el resumen de conversación se interpolaban dentro del mensaje `developer`. Un texto declarado por el usuario podía intentar convertirse en instrucción de mayor prioridad.

Corrección:

- Las reglas estables permanecen en `developer`.
- Contexto, resumen, historial y pregunta se marcan como datos no confiables y se envían en mensajes de usuario separados.
- Se prohíbe explícitamente ejecutar instrucciones contenidas en esos bloques.
- El contexto se limita a 60 KB.
- Las referencias que devuelve el modelo siguen filtrándose contra IDs presentes en el contexto interno aprobado.
- Los errores del proveedor ya no incluyen el cuerpo de respuesta en mensajes enviados al cliente.

Esta defensa reduce el riesgo, pero ningún prompt elimina totalmente la inyección. Las acciones con efecto real deben seguir validándose fuera del modelo.

### Abuso de endpoints y costes de IA — alto

Se añadió limitación de frecuencia por ruta para generación gratuita, asesor Premium, Especialista y checkout. Los usuarios autenticados se identifican mediante un hash del token; los visitantes mediante la dirección transmitida por el proxy. Las respuestas 429 incluyen `Retry-After`.

El Especialista conserva además su contador diario transaccional en Firestore, evitando carreras entre solicitudes concurrentes. La memoria del limitador HTTP está acotada para evitar crecimiento ilimitado.

### CORS y cabeceras — medio

El backend devolvía `Access-Control-Allow-Origin: *`. Ahora solo refleja orígenes incluidos en `API_ALLOWED_ORIGINS`, con excepciones locales durante desarrollo. Se añadieron `nosniff`, `no-store`, `Referrer-Policy` y cabeceras restrictivas de métodos.

Firebase Hosting añade protección de tipo, política de referencia, permisos de cámara/micrófono y aislamiento compatible con ventanas de pago.

### Fotografías y audios — alto

Correcciones:

- Fotografías: JPEG, PNG o WebP; máximo inferior a 10 MB.
- Audio: WebM, MP3, MP4/M4A, WAV u OGG; máximo inferior a 20 MB.
- La extensión debe coincidir con el MIME declarado.
- El cliente comprueba firmas binarias básicas antes de subir.
- Storage exige MIME exacto, metadatos de propietario/vehículo/sesión y nombre seguro.
- Un objeto subido no puede sobrescribirse; solo su propietario puede leerlo o eliminarlo.
- Las imágenes editoriales dejan de aceptar cualquier `image/*`.

La comprobación del navegador mejora errores accidentales, pero no es una frontera contra un cliente malicioso. Véase la decisión pendiente sobre análisis antivirus y cuarentena.

### Suscripciones y cuentas suspendidas — alto

Las rutas Premium ya verificaban tokens Firebase revocados y entitlements creados por webhook/claim seguro. Ahora también rechazan cuentas cuyo perfil no esté `active`, aunque conserven un entitlement vigente. La respuesta de sesión no presenta Premium activo a una cuenta deshabilitada.

El navegador sigue sin poder escribir entitlements, compras, eventos de facturación o clientes Stripe. Los webhooks verifican firma, antigüedad, importe, moneda, compra previa e idempotencia.

### Datos persistidos en el navegador — medio

El plan del asesor heredado se guardaba en `localStorage` con una clave global. Se trasladó a `sessionStorage`, separado por UID, para reducir exposición en equipos compartidos y evitar mezclar planes entre cuentas. La experiencia Premium canónica debe terminar de migrarlo a Firestore privado.

### Formularios públicos de búsqueda — medio

La colección `searches` necesita escritura anónima para la experiencia gratuita. Antes aceptaba documentos arbitrarios. Ahora solo admite el conjunto de campos esperado, longitudes acotadas, booleanos válidos y timestamp de servidor. El spam automatizado sigue requiriendo App Check o traslado al backend.

### Publicación automática de builds generadas — alto

La ruta gratuita guardaba directamente en la colección pública `builds` el resultado generado a partir de texto anónimo. Aunque existía validación estructural, esto permitía contaminar conocimiento reutilizable mediante prompt injection. La ruta ahora devuelve el resultado solo a quien lo solicitó y no lo publica. Para reutilizar una build generada deberá pasar por una colección privada de candidatos y revisión editorial, que queda como evolución del pipeline de investigación.

## Estado por área

| Área | Estado después de la corrección |
|---|---|
| Firestore | Propiedad por UID, colecciones sensibles solo backend y subcolecciones explícitas. |
| Storage | Privado por UID para diagnóstico; MIME, tamaño, metadatos y no sobrescritura. |
| Roles | Custom claims verificadas en backend/reglas; publicación reservada a editor/admin. |
| Suscripciones | Stripe webhook idempotente y entitlement confiable; cuentas inactivas bloqueadas. |
| Rutas Premium | Token revocado + entitlement + perfil activo. |
| Administración | API y Firestore repiten autorización; UI no es la frontera de seguridad. |
| Claves | Sin secretos reales rastreados; secretos únicamente backend. |
| IA | Contexto mínimo, propiedad comprobada, límites diarios y separación de instrucciones/datos. |
| Multimedia | Privado, eliminable, límites estrictos y firma básica. |
| Logs | No se registran prompts, tokens ni evidencias; quedan eventos técnicos y auditoría editorial. |
| Separación de usuarios | Reforzada en reglas y nuevamente en servicios Admin SDK. |

## Decisiones obligatorias del propietario

### 1. Antivirus, cuarentena y análisis multimedia

Storage no puede verificar el contenido real, solo tamaño, MIME y metadatos. Para aceptar archivos de producción hay que elegir entre:

- subida a una ruta de cuarentena y análisis asíncrono con un proveedor antimalware;
- subida mediada por backend con validación de firma y transcodificación;
- mantener subida directa asumiendo explícitamente el riesgo.

Recomendación: cuarentena privada y publicación interna solo tras análisis. No enviar audio o fotografías al proveedor de IA hasta definir consentimiento, retención y contrato de tratamiento.

### 2. Rate limiting distribuido y Firebase App Check

El limitador HTTP actual es por proceso. Un reinicio o varias instancias de Render reparten el contador. Para producción debe elegirse Redis/Upstash, Cloud Armor/API Gateway u otro almacén compartido. Firebase App Check debe evaluarse para `searches`, Auth, Firestore y Storage; sin él, un atacante puede automatizar clientes válidos aunque las reglas limiten el esquema.

### 3. Conservación y eliminación de datos

El usuario puede eliminar fotografías y audios individuales. Falta decidir:

- plazo de conservación de diagnósticos, chats, prompts resumidos, consumo IA y logs;
- borrado completo de cuenta y cascada sobre proyectos, vehículos, Storage y copias de seguridad;
- conservación obligatoria de compras/facturas y eventos de fraude;
- periodo de recuperación y procedimiento de exportación.

No debe implementarse un borrado total irreversible hasta acordar estas obligaciones legales y operativas. Recomendación inicial: evidencias temporales 30 días, evidencias de proyecto hasta eliminación, logs técnicos 30–90 días y facturación según obligación fiscal aplicable.

### 4. Tratamiento por proveedores de IA

El Especialista envía texto del historial declarado, mantenimientos, modificaciones, síntomas y diagnósticos resumidos. Actualmente no envía bytes de audio o fotografía. Deben aprobarse:

- base jurídica y consentimiento específico;
- proveedor/modelo, región y condiciones de retención;
- política para datos especialmente sensibles introducidos por error;
- opción de exclusión y borrado.

### 5. CSP y dominios definitivos

No se añadió una Content Security Policy estricta porque faltan los dominios definitivos de backend, Firebase, Stripe, analítica y futuros proveedores multimedia. Cuando estén cerrados, debe desplegarse primero `Content-Security-Policy-Report-Only`, corregir violaciones y después hacerla obligatoria.

### 6. Renovaciones de Stripe

El flujo de pago único está protegido. Antes de activar renovaciones reales hay que probar importes y estados específicos de eventos `customer.subscription.*`, facturas fallidas, reintentos y periodos de gracia. No debe habilitarse la renovación solo porque el modelo de datos contenga `billingMode: subscription`.

## Pruebas añadidas

- Ventana deslizante y respuesta al superar límites.
- CORS permitido y denegado.
- Regresión estática de reglas Firestore/Storage críticas.
- Separación del contexto inyectado respecto al mensaje `developer`.
- MIME declarado frente a firma binaria real.

## Despliegue coordinado

Los cambios deben desplegarse juntos:

1. Backend con `API_ALLOWED_ORIGINS` configurado.
2. Reglas Firestore.
3. Reglas Storage.
4. Hosting y frontend.

Desplegar solo las reglas Storage antes del frontend actualizado puede rechazar audios cuyo MIME incluya parámetros de códec. El frontend ahora normaliza ese valor antes de subir.
