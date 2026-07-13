# Módulo Vehículo Premium

## Decisión de datos

El módulo combina el `UserVehicle` del propietario con `VehicleMaster`, `EngineMaster`, `TransmissionMaster` y los `VehicleIssue` conocidos. La identidad y los valores aportados por el usuario se etiquetan como **declarados**. Un dato maestro solo se presenta como **confirmado** cuando su procedencia está aprobada o publicada y su confianza es alta o verificada.

Los datos técnicos en borrador, no revisados o ausentes no se usan para rellenar la interfaz. El campo se mantiene visible como **pendiente de investigación**, sin asignarle un valor. Las fuentes se contabilizan en la interfaz del cliente, pero sus identificadores y detalles quedan reservados para las áreas internas de revisión.

## Extensiones de modelo

Los datos opcionales de chasis, suspensión, frenos, ajuste de ruedas, aceite y valoración se han incorporado a los modelos maestros y a sus esquemas de validación. Continúan siendo opcionales para mantener compatibilidad con documentos existentes y evitar asumir información que todavía no esté disponible.

## Acceso

El cliente obtiene el vehículo activo mediante los repositorios Premium existentes. Las reglas de Firestore permiten a usuarios autenticados leer documentos maestros técnicos solamente cuando están aprobados o publicados; las escrituras siguen limitadas a roles editoriales.
