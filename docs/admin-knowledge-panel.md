# Panel privado de conocimiento

El dashboard THKB utiliza Firebase Authentication y custom claims. Los roles admitidos son `admin`, `editor` y `reviewer`; la interfaz adapta la navegación, pero la autorización efectiva se repite en Firestore, Storage y en la API del backend.

## Matriz de permisos

| Área | Reviewer | Editor | Admin |
|---|---:|---:|---:|
| Leer y revisar investigaciones | Sí | Sí | Sí |
| Aprobar/rechazar campos y fichas | Sí | Sí | Sí |
| Publicar/despublicar | No | Sí | Sí |
| Editar catálogo e imágenes | No | Sí | Sí |
| Consultar diagnósticos reportados | Sí | Sí | Sí |
| Consultar usuarios, suscripciones y consumo IA | No | No | Sí |

Los recursos operativos se sirven desde una lista cerrada en backend. La respuesta elimina identificadores de pago y datos de activación. El cliente nunca recibe secretos, datos de tarjeta ni rutas privadas de evidencias.

## Flujo editorial

1. El pipeline crea una investigación y sus afirmaciones técnicas.
2. Un revisor inspecciona valor, confianza, fuentes y contradicciones.
3. Cada edición crea un documento inmutable en `technicalClaimVersions`.
4. La ficha puede aprobarse solo desde el backend y el publicador vuelve a comprobar que todas las afirmaciones estén aprobadas.
5. Publicar crea una revisión y una proyección pública validada.
6. Despublicar conserva la revisión anterior, crea una revisión `obsolete` y retira la proyección sin borrar el historial.

Las transiciones administrativas se registran con UID y timestamps de servidor/Admin SDK. Para producción deben desplegarse conjuntamente el backend, las reglas de Firestore y las reglas de Storage.
