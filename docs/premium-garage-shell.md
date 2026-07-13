# Estructura principal del garaje Premium

## Alcance

Esta fase introduce el shell responsive del garaje y no desarrolla todavía el contenido exhaustivo de mantenimiento, modificaciones, averías o especialista IA.

## Componentes

- `PremiumGarageLayout`: estructura general y coordinación de estados.
- `GarageHeader`: vehículo activo, imagen e identidad declarada.
- `GarageNavigation`: navegación común con presentación lateral o inferior.
- `GarageModuleContent`: punto de entrada de cada módulo.
- `GarageStatePanel`: carga, ausencia, investigación pendiente e información incompleta.
- `GarageSpecialist`: acceso flotante persistente y panel accesible.

## Estados

El shell resuelve en este orden:

1. `loading`.
2. `no_vehicle`.
3. `research_pending` cuando la identidad sigue sin confirmación editorial.
4. `incomplete` cuando la ficha confirmada tiene menos del 80 % de completitud.
5. `ready`.

Una identidad declarada durante el onboarding no se presenta como conocimiento técnico confirmado. El garaje puede navegar mientras muestra que la investigación está pendiente.

## Responsive

- Móvil: cabecera compacta, una columna, navegación inferior fija y especialista sobre la safe area.
- Tablet: navegación lateral, contenido flexible y especialista en panel flotante.
- Escritorio: ancho máximo controlado, sidebar ampliada y panel contextual.

Los datos mock utilizados para validar estados viven únicamente en `src/features/premium/__tests__/garageFixtures.ts`. La aplicación recibe el vehículo real del flujo Premium.

## Compatibilidad

El portal Premium específico anterior no se elimina. El flujo principal utiliza ahora el shell genérico para que cualquier marca o variante pueda entrar en el mismo sistema de módulos.
