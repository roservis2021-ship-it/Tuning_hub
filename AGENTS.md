# AGENTS.md — Tuning Hub

Este documento define el contexto permanente y las reglas de trabajo para cualquier agente de Codex que opere en este repositorio. Se aplica a todo el árbol salvo que exista un `AGENTS.md` más específico en una carpeta descendiente.

## 1. Visión del producto

Tuning Hub es una plataforma web que ayuda a propietarios de vehículos a planificar modificaciones de forma realista, compatible, segura y ordenada. La aplicación debe reducir la incertidumbre antes de comprar piezas o modificar el coche.

El producto no debe limitarse a mostrar una lista genérica de accesorios. Debe explicar:

- Qué vehículo y variante se está analizando.
- Qué mantenimiento debe realizarse antes de modificar.
- Qué piezas o trabajos tienen sentido para el objetivo declarado.
- En qué orden deben ejecutarse.
- Qué dependencias, riesgos, incompatibilidades y requisitos legales existen.
- Qué datos están confirmados, cuáles son probables y cuáles requieren verificación.

La prioridad del producto es la confianza del usuario. Seguridad, fiabilidad, compatibilidad, legalidad y claridad prevalecen sobre cifras llamativas o recomendaciones agresivas.

## 2. Objetivo del Plan Premium

Premium debe ser un acompañante durante y después del proyecto del usuario. Debe conocer el vehículo, su estado particular, su historial, las modificaciones ya instaladas, el uso previsto, el presupuesto y el objetivo.

La experiencia Premium debe:

- Mantener una ficha viva del vehículo y del proyecto.
- Mostrar siempre el siguiente paso más útil y explicar por qué tiene prioridad.
- Crear una ruta de evolución realista por fases.
- Advertir sobre riesgos mecánicos, incompatibilidades y costes evitables.
- Diferenciar recomendaciones generales del modelo y circunstancias particulares del usuario.
- Actualizar el plan cuando cambie el vehículo o se complete una acción.
- Resolver dudas mediante un especialista IA contextualizado.
- Conservar historial, decisiones y evolución entre sesiones y dispositivos cuando exista infraestructura de usuario.

Premium es un producto de seguimiento, no una página estática ni una generación aislada de IA.

## 3. Arquitectura real actual

El repositorio contiene dos aplicaciones React/Vite y un backend Node.js:

### Aplicación pública

- Entrada: `src/main.jsx`.
- Aplicación raíz: `src/App.jsx`.
- Flujo principal: `src/pages/HomePage.jsx`.
- La navegación actual no usa un router; depende de `currentScreen` dentro de `HomePage`.
- El formulario consulta primero Firestore y utiliza el backend/OpenAI cuando no encuentra una build válida.
- El resultado gratuito, checkout y Premium viven en el mismo flujo de pantalla.
- Existe una experiencia Premium general en `src/components/PremiumPlan.jsx`.
- Existe un prototipo Premium personalizado en `src/components/PremiumVehiclePortal.jsx`.

### Dashboard administrativo THKB

- Ubicación: `dashboard/`.
- Aplicación React/Vite separada.
- Usa Firebase Auth con email/contraseña.
- Gestiona vehículos, motores, mantenimiento, fallos, modificaciones, compatibilidades, fuentes e imágenes.
- Usa Firestore y Firebase Storage directamente desde el navegador autenticado.

### Backend

- Entrada actual: `server/app.mjs`.
- Servidor HTTP nativo de Node.js, sin Express.
- Despliegue previsto en Render mediante `render.yaml`.
- Integra Firebase Admin, OpenAI Responses API y Stripe mediante API REST.
- Contiene generación de builds, asesor Premium, chat, checkout y verificación de sesiones.
- Actualmente es un archivo monolítico; cualquier ampliación importante debe favorecer una separación progresiva por rutas, servicios, esquemas y repositorios.

### Firebase

- Firestore, Storage, Auth, Analytics y Hosting están presentes.
- Reglas: `firebase/firestore.rules` y `firebase/storage.rules`.
- Configuración de hosting: `firebase.json` y `.firebaserc`.
- La web pública y el dashboard se despliegan como sitios de Hosting separados.
- No hay Firebase Functions en la arquitectura actual; el backend se ejecuta en Render.

### Pagos

- Stripe Checkout alojado e integrado.
- Productos actuales: Plan de Acción y build adicional.
- El flujo actual consulta el estado de la sesión al volver del checkout.
- No existe todavía un sistema completo de webhook, compra persistente y entitlement por usuario. No considerar el desbloqueo actual suficiente para un Premium multiusuario en producción.

## 4. Tecnologías utilizadas

- JavaScript y JSX con módulos ES.
- React 19.
- React DOM 19.
- Vite 7.
- Node.js.
- Firebase Web SDK 12.
- Firebase Admin SDK 13.
- Firestore.
- Firebase Storage.
- Firebase Authentication en el dashboard.
- Firebase Analytics.
- Firebase Hosting.
- OpenAI Responses API.
- Stripe Checkout.
- Render para el backend.

No asumir que están instalados React Router, TypeScript, Express, Tailwind, una librería de estado, una librería de esquemas, un framework de tests o Firebase Functions. Verificar `package.json` y el código antes de utilizarlos.

## 5. Convenciones de carpetas y archivos

Respetar la estructura existente mientras se migra de forma gradual:

- `src/components/`: componentes compartidos o componentes heredados todavía no organizados por dominio.
- `src/pages/`: pantallas de nivel superior.
- `src/services/`: acceso a API, Firebase y lógica de integración.
- `src/firebase/`: inicialización del SDK Firebase público.
- `src/data/`: catálogos estáticos y datos locales.
- `src/assets/`: imágenes, SVG y recursos visuales.
- `src/styles/`: estilos globales.
- `dashboard/src/`: aplicación administrativa independiente.
- `server/`: backend Node.js.
- `firebase/`: reglas y seeds de Firebase.
- `scripts/`: importadores, migraciones y utilidades operativas.

Para nuevas áreas Premium, preferir organización por funcionalidad:

```text
src/features/premium/
  layout/
  vehicle/
  maintenance/
  modifications/
  issues/
  advisor/
  services/
  hooks/
  schemas/
```

Para nuevas responsabilidades del backend, preferir:

```text
server/
  config/
  middleware/
  routes/
  services/
  repositories/
  schemas/
```

No realizar una reorganización masiva de archivos como efecto secundario de una tarea pequeña.

## 6. Convenciones de nombres

- Componentes React: `PascalCase.jsx` o `PascalCase.tsx`.
- Hooks: `useNombre.js` o `useNombre.ts`.
- Servicios y utilidades: `camelCase.js` o `camelCase.ts`.
- Constantes globales: `UPPER_SNAKE_CASE`.
- Funciones y variables: `camelCase`.
- Clases CSS nuevas: prefijo de dominio y estilo kebab-case, por ejemplo `premium-project-card`.
- Colecciones Firestore: plural y `camelCase`, manteniendo compatibilidad con colecciones existentes.
- Campos Firestore: `camelCase`.
- Endpoints: sustantivos y acciones explícitas bajo `/api/`.

No crear dos nombres para la misma entidad. Antes de añadir una colección, campo, servicio o normalizador, buscar si ya existe una variante equivalente.

## 7. Reglas para componentes

- Un componente debe tener una responsabilidad principal clara.
- Separar presentación, estado, acceso a datos y transformación de respuestas.
- No añadir nuevas áreas extensas dentro de `HomePage.jsx`, `BuildResult.jsx` o `PremiumVehiclePortal.jsx` si pueden vivir como componentes de dominio.
- No realizar llamadas a OpenAI, Stripe o Firebase directamente desde componentes visuales; usar servicios o hooks.
- Representar explícitamente estados de carga, vacío, error, éxito y datos desactualizados.
- No mostrar un porcentaje, estado verificado o éxito si no deriva de datos reales.
- Mantener accesibilidad básica: elementos semánticos, etiquetas, foco visible, botones reales y textos alternativos.
- Evitar estilos inline salvo valores dinámicos simples como progreso o imágenes CSS.
- No duplicar transformadores o fallbacks entre componentes.
- Mantener compatibilidad con los datos históricos mientras exista contenido antiguo en Firestore.

## 8. Reglas de TypeScript

El proyecto actual es JavaScript/JSX. No afirmar que TypeScript ya está configurado.

Cuando una tarea autorice introducir TypeScript:

- Añadir primero la configuración mínima y scripts necesarios.
- Permitir migración incremental; no renombrar todo el repositorio en una sola tarea.
- Usar tipos explícitos para límites externos: respuestas API, documentos Firestore, planes Premium, pagos y props públicas.
- Evitar `any`; usar `unknown` y validación cuando el dato procede de red, almacenamiento o IA.
- Definir un modelo canónico por entidad y reutilizarlo.
- No usar type assertions para ocultar datos inválidos.
- Mantener tipos de cliente y servidor alineados mediante esquemas o contratos compartidos cuando sea viable.
- La adopción de TypeScript no debe romper los scripts JavaScript existentes ni bloquear despliegues parciales.

## 9. Reglas de Firebase

- Separar datos públicos de datos privados y Premium.
- Todo documento de usuario o proyecto debe incluir propietario o estar anidado bajo su UID.
- Las reglas de Firestore son parte de la implementación, no un paso posterior.
- No confiar en que ocultar un campo en React protege el dato.
- No guardar contenido Premium dentro de documentos con lectura pública.
- Usar timestamps de servidor para creación y actualización.
- Evitar colecciones duplicadas como `brands` y `catalog_brands` sin un plan de migración explícito.
- Documentar índices necesarios para consultas nuevas.
- Mantener las operaciones administrativas restringidas mediante Auth y roles/custom claims, no mediante lógica visual.
- Storage debe validar propietario/rol, tamaño, MIME y ruta.
- No almacenar secretos ni credenciales de servicio en el frontend, Firestore o Storage.
- Los scripts destructivos de seed o reset requieren revisión explícita del destino y autorización del usuario.

## 10. Reglas de seguridad

- Nunca incluir secretos OpenAI, Stripe o Firebase Admin en variables `VITE_*`.
- Nunca registrar claves, tokens, sesiones completas o datos sensibles.
- Autenticar y autorizar endpoints Premium y de IA antes de producción.
- Añadir rate limiting, límites de body y validación de entrada a endpoints con coste.
- Restringir CORS a orígenes permitidos en producción.
- Verificar compras mediante webhook de Stripe y persistir entitlements idempotentes.
- No confiar en `localStorage` o `sessionStorage` para permisos, pagos o propiedad.
- No aceptar el origen de retorno de Stripe sin validarlo contra una allowlist.
- No permitir que un usuario consulte una compra, proyecto o conversación ajena.
- Minimizar el contexto enviado a modelos de IA y no enviar datos personales innecesarios.
- Tratar las salidas de IA como datos no confiables: validar esquema, rangos y coherencia antes de guardar o mostrar.
- Rotar cualquier clave que se haya expuesto y mantener cuentas de servicio fuera de Git.

## 11. Reglas de datos técnicos

- Está prohibido inventar códigos de motor, potencia, par, compatibilidades, referencias OEM, costes, intervalos, fallos conocidos o requisitos legales.
- Toda afirmación técnica debe clasificarse como confirmada, probable o pendiente de verificación.
- Si no hay certeza, usar una indicación explícita como: `Compatible probable; verificar con VIN o referencia OEM`.
- No mezclar generaciones, mercados, transmisiones o variantes de motor.
- Diferenciar CV/PS, HP/BHP y kW cuando se realicen conversiones.
- No prometer ganancias irreales, especialmente en motores atmosféricos.
- No recomendar eliminación de sistemas anticontaminación para uso en vía pública.
- Los requisitos de ITV u homologación son orientativos hasta confirmarlos con normativa vigente y un profesional competente.
- Una respuesta de IA no sustituye una diagnosis, inspección mecánica o proyecto de homologación.

## 12. Separación de datos del modelo y datos del usuario

Mantener dos dominios independientes:

### Conocimiento del modelo de vehículo

- Marca, modelo, generación y variante.
- Motor, transmisión, tracción y especificaciones de fábrica.
- Fallos conocidos y mantenimiento general.
- Compatibilidades e incompatibilidades documentadas.
- Límites fiables orientativos.
- Piezas y reformas técnicamente aplicables.
- Fuentes y nivel de confianza.

### Estado particular del usuario

- UID y propiedad del vehículo.
- VIN, matrícula u otros identificadores privados cuando sean necesarios y estén protegidos.
- Kilometraje actual.
- Historial de mantenimiento y facturas.
- Averías, síntomas y accidentes.
- Modificaciones instaladas y referencias concretas.
- Uso, objetivo, presupuesto y preferencias.
- Progreso, decisiones, conversaciones y compras.

El conocimiento compartido del modelo puede reutilizarse entre usuarios. Los datos particulares nunca deben sobrescribir la ficha canónica del modelo ni quedar visibles para otros usuarios.

## 13. Diseño responsive y sistema visual

La interfaz es mobile-first.

Orden obligatorio de diseño y validación:

1. Móvil.
2. Tablet.
3. Escritorio.

Toda nueva experiencia debe funcionar como mínimo en:

- Móvil estrecho: aproximadamente 320–430 px.
- Tablet: aproximadamente 768–1024 px.
- Escritorio: desde 1280 px.

Reglas:

- No depender de hover para acciones esenciales.
- Mantener objetivos táctiles cómodos y navegación accesible con una mano.
- Evitar texto ilegible, tarjetas excesivamente densas y desplazamiento horizontal accidental.
- Probar formularios largos, modales, chat y barras fijas con teclado móvil y safe areas.
- No ocultar información crítica por breakpoint.
- Las tablas deben transformarse o desplazarse de forma controlada en móvil.
- Mantener rendimiento aceptable: imágenes optimizadas, carga diferida y componentes razonables.

Sistema visual principal:

- Fondo negro o negro carbón.
- Superficies gris oscuro.
- Rojo/naranja rojizo como acento de acción y marca.
- Blanco para texto principal.
- Gris para texto secundario.
- Verde o ámbar solo para estados semánticos como correcto, advertencia o progreso.

No introducir una paleta visual ajena sin una decisión de diseño documentada. Favorecer contraste alto, jerarquía clara, bordes sutiles y uso moderado del rojo.

## 14. Verificación obligatoria

Después de cada modificación de código:

1. Ejecutar lint.
2. Ejecutar build.
3. Ejecutar pruebas relevantes.
4. Revisar `git diff --check`.
5. Verificar visualmente los breakpoints afectados cuando haya cambios de interfaz.

Actualmente puede no existir un script de lint o tests. En ese caso:

- No inventar comandos.
- Comprobar primero `package.json`.
- Ejecutar todos los comandos realmente disponibles.
- Informar claramente qué verificación falta por no estar configurada.
- Si la tarea lo permite, proponer o añadir la infraestructura ausente como trabajo separado.

No declarar una tarea verificada si solo se compiló una parte y quedan rutas críticas sin probar.

## 15. Compatibilidad y preservación

- No eliminar funciones, rutas, componentes, campos, colecciones o estilos existentes sin una justificación técnica explícita.
- Antes de retirar algo, buscar referencias y determinar si existen datos históricos o despliegues que dependan de ello.
- Preferir migraciones graduales y adaptadores de compatibilidad.
- No modificar datos seed, reglas o esquemas como efecto secundario no solicitado.
- Preservar cambios del usuario en un árbol de trabajo sucio.
- No usar operaciones destructivas de Git para limpiar cambios ajenos.

## 16. Documentación de decisiones

Documentar decisiones técnicas importantes cuando afecten a:

- Modelo de datos.
- Seguridad o permisos.
- Autenticación.
- Pagos y entitlements.
- Contratos de API.
- Esquemas de OpenAI.
- Migraciones.
- Navegación.
- Arquitectura de carpetas.
- Dependencias nuevas.
- Cambios de diseño global.

Usar comentarios solo para explicar decisiones no evidentes. Las decisiones duraderas deben registrarse en documentación técnica o ADR dentro de `docs/` cuando se cree esa estructura.

## 17. Módulos Premium

### 1. Vehículo

Ficha central del proyecto. Combina datos canónicos del modelo con el estado particular del usuario. Debe mostrar identidad, motor, especificaciones, kilometraje, uso, historial, modificaciones actuales, calidad de la información y objetivo.

### 2. Mantenimiento

Plan preventivo y correctivo priorizado. Debe indicar qué revisar, por qué, cuándo, coste orientativo, dependencia con futuras modificaciones y evidencia disponible. El mantenimiento base siempre precede a una mejora que pueda aumentar carga mecánica.

### 3. Modificaciones

Proyecto de evolución por fases. Incluye bloque/motor, electrónica y reprogramación, chasis, frenos, ruedas, estética e interior. Cada propuesta debe estar argumentada con beneficio, coste, compatibilidad, requisitos previos, dificultad, impacto legal y resultado esperado.

### 4. Fallas y averías

En la interfaz pública puede denominarse `Fallos y averías` para mantener el español usado en España. Reúne fallos conocidos del modelo y problemas particulares del usuario. Debe explicar síntomas, causa probable, gravedad, consecuencia, prevención, comprobación y coste orientativo sin presentar diagnósticos inciertos como hechos.

### 5. Especialista IA

Copiloto contextual del proyecto. Responde usando la ficha, el plan, el progreso y el conocimiento verificado disponible. Debe dar una respuesta directa, argumentarla, proponer el siguiente paso y reconocer incertidumbre. No debe inventar datos ni sustituir a un taller, ingeniero u homologador.

## 18. Prioridades para trabajo futuro

Antes de considerar Premium listo para producción:

1. Autenticación en la aplicación pública.
2. Propiedad persistente de vehículos y proyectos.
3. Separación de contenido público y Premium.
4. Webhook Stripe y entitlements persistentes.
5. Autenticación y rate limiting del backend.
6. Persistencia segura del plan y conversaciones.
7. Generalización de Premium a todos los vehículos.
8. División progresiva de los archivos monolíticos.
9. Tests, lint y CI.

No ampliar el alcance visual de Premium ignorando estas bases cuando la tarea esté destinada a producción.
