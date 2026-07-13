# Informe de pruebas E2E de Tuning Hub Premium

Fecha: 13 de julio de 2026.

## Alcance y entorno

- Navegador: Google Chrome mediante Playwright.
- Resoluciones: móvil Pixel 7, tablet 820 × 1180 y escritorio 1440 × 900.
- Frontend: Vite local aislado en `127.0.0.1:5174`.
- Backend: servicio local aislado en `127.0.0.1:8788`.
- Datos del recorrido completo: fixtures sintéticos tipados y persistencia simulada en memoria.
- No se realizó un cargo real, no se creó una cuenta remota y no se enviaron fotografías ni prompts a proveedores externos.

Esta separación permite probar de forma repetible la lógica del proyecto sin contaminar Firebase ni generar consumo de Stripe u OpenAI. La validación de un alta real contra Firebase y Stripe debe ejecutarse en un proyecto de staging con emuladores o credenciales de prueba separadas antes de producción.

## Recorrido funcional cubierto

| Paso | Resultado | Cobertura |
| --- | --- | --- |
| Usuario nuevo y registro | Correcto a nivel de estados y validación | La cuenta solo puede crearse en el flujo posterior al pago; el acceso normal ya no muestra registro. |
| Activación Premium simulada | Correcto | Se comprueban `free`, `subscription_required` y `premium` sin conceder acceso desde el cliente. |
| Onboarding | Correcto | Siete pasos, consentimiento y creación de datos válidos. |
| Creación de vehículo y garaje | Correcto | Vehículo exacto, estado listo y estados alternativos. |
| Ficha del vehículo | Correcto | El garaje carga la identidad confirmada sin inventar datos. |
| Registro de mantenimiento | Correcto | Historial, fecha, kilometraje, próxima fecha y próximo kilometraje. |
| Actualización de kilometraje | Corregido y probado | Se persiste, se propaga a módulos y se rechazan retrocesos o valores inválidos. |
| Cambio de objetivo | Correcto | La ruta se recalcula con el objetivo activo. |
| Instalación de modificación | Correcto | La pieza actual pasa a completada y respeta compatibilidad/requisitos. |
| Diagnóstico de texto | Correcto | Resultado conservador, incertidumbre y recomendación profesional. |
| Fotografía simulada | Correcto a nivel de arquitectura | Evidencia privada tipada, ruta de Storage y metadatos; sin subir un archivo real. |
| Especialista IA | Correcto a nivel de conversación persistente | Historial separado por vehículo; no se consumió el proveedor externo. |
| Cierre, regreso y persistencia | Correcto en el harness | El estado serializado recupera vehículo, kilometraje, proyecto y conversación. |

## Casos de resiliencia y acceso

- Usuario sin Premium: bloqueado con `subscription_required`.
- Usuario sin vehículo: estado `no_vehicle`.
- Datos incompletos: estado `incomplete`.
- Investigación pendiente: estado `research_pending`.
- Sesión expirada o ausente: regreso obligatorio a inicio de sesión.
- Error de red durante recuperación: mensaje claro y formulario conservado.
- Administración sin credenciales: backend responde `401`.
- Premium sin rol administrativo: decisión `forbidden`.
- Responsive: sin desbordamiento horizontal en móvil, tablet y escritorio.

## Errores encontrados y corregidos

1. El acceso general permitía crear una cuenta antes del pago. Se ocultó el registro fuera del componente posterior a la confirmación de compra.
2. El garaje mostraba kilometraje, pero no permitía actualizarlo. Se añadió edición validada, persistencia y sincronización de contexto.
3. Firestore conservaba un comodín genérico de lectura bajo proyectos Premium. Se sustituyó por reglas explícitas para `planVersions`, `conversations` y `messages`.
4. La primera ejecución E2E reutilizaba un preview antiguo en el puerto 5173. La suite ahora levanta un servidor aislado en el puerto 5174.
5. La ejecución paralela de tres navegadores era inestable en el entorno local. La suite se ejecuta secuencialmente para ser determinista.

## Resultado de automatización

- Playwright: 12/12 pruebas superadas.
- Vitest: 68/68 pruebas superadas en 19 archivos.
- TypeScript: sin errores.
- ESLint: sin errores.
- Build Vite: correcto.

## Pendiente para una prueba remota real

Antes de aceptar pagos de producción debe existir un entorno de staging con Firebase Auth, Firestore, Storage y Stripe en modo test. Allí se debe repetir el recorrido creando y eliminando un usuario temporal, procesando un webhook firmado de Stripe, subiendo una imagen de prueba privada y verificando la persistencia después de una nueva sesión de navegador. Esta ejecución no debe hacerse contra datos de producción.
