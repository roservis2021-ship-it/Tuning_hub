export const recordStatuses = [
  ['draft', 'Borrador'],
  ['needs_verification', 'Necesita verificación'],
  ['verified', 'Verificado'],
  ['published', 'Publicado'],
  ['archived', 'Archivado'],
];

const text = (key, label, options = {}) => ({ key, label, type: 'text', ...options });
const number = (key, label, options = {}) => ({ key, label, type: 'number', ...options });
const area = (key, label, options = {}) => ({ key, label, type: 'textarea', wide: true, ...options });
const select = (key, label, values, options = {}) => ({ key, label, type: 'select', values, ...options });
const image = (key, label, options = {}) => ({ key, label, type: 'image', wide: true, ...options });

export const resources = {
  brands: {
    label: 'Marcas', singular: 'marca', icon: '◆', titleField: 'name',
    fields: [text('name', 'Nombre', { required: true }), text('slug', 'Slug'), text('country', 'País'), text('aliases', 'Alias'), area('notes', 'Notas')],
  },
  models: {
    label: 'Modelos', singular: 'modelo', icon: 'M', titleField: 'name',
    fields: [text('name', 'Nombre', { required: true }), text('brandId', 'ID de marca', { relation: 'brands' }), text('aliases', 'Alias'), area('description', 'Descripción')],
  },
  generations: {
    label: 'Generaciones', singular: 'generación', icon: 'G', titleField: 'name',
    fields: [text('name', 'Generación / código', { required: true }), text('modelId', 'ID de modelo', { relation: 'models' }), number('yearStart', 'Año inicial'), number('yearEnd', 'Año final'), text('platform', 'Plataforma'), area('notes', 'Notas')],
  },
  engines: {
    label: 'Motores', singular: 'motor', icon: 'E', titleField: 'code',
    fields: [
      text('code', 'Código motor', { required: true }), text('family', 'Familia'), text('manufacturer', 'Fabricante'),
      select('fuel', 'Combustible', ['Gasolina', 'Diésel', 'Híbrido', 'Eléctrico']), number('displacementCc', 'Cilindrada (cc)'),
      text('configuration', 'Configuración'), select('induction', 'Sobrealimentación', ['Atmosférico', 'Turbo', 'Biturbo', 'Compresor']),
      text('compression', 'Compresión'), number('powerCv', 'Potencia (CV)'), number('torqueNm', 'Par (Nm)'),
      number('reliableLimitCv', 'Límite fiable (CV)'), area('commonProblems', 'Problemas comunes'),
      area('maintenance', 'Mantenimiento'), area('stage1', 'Stage 1'), area('stage2', 'Stage 2'), area('stage3', 'Stage 3'),
    ],
  },
  vehicles: {
    label: 'Vehículos', singular: 'vehículo', icon: 'V', titleField: 'version',
    fields: [
      text('brand', 'Marca', { required: true, section: 'Identidad del vehículo' }),
      text('model', 'Modelo', { required: true, section: 'Identidad del vehículo' }),
      text('generation', 'Generación', { section: 'Identidad del vehículo' }),
      text('body', 'Carrocería', { section: 'Identidad del vehículo' }),
      text('version', 'Versión', { required: true, section: 'Identidad del vehículo' }),
      number('yearStart', 'Año inicial', { section: 'Identidad del vehículo' }),
      number('yearEnd', 'Año final', { section: 'Identidad del vehículo' }),
      text('market', 'Mercado', { section: 'Identidad del vehículo' }),
      text('aliases', 'Alias de búsqueda', { section: 'Identidad del vehículo' }),
      area('description', 'Descripción pública', { section: 'Identidad del vehículo' }),

      text('engineCode', 'Código motor', { required: true, section: 'Motor y especificaciones' }),
      text('engineFamily', 'Familia de motor', { section: 'Motor y especificaciones' }),
      select('fuel', 'Combustible', ['Gasolina', 'Diésel', 'Híbrido', 'Eléctrico'], { section: 'Motor y especificaciones' }),
      number('displacementCc', 'Cilindrada (cc)', { section: 'Motor y especificaciones' }),
      text('engineConfiguration', 'Configuración', { section: 'Motor y especificaciones' }),
      select('induction', 'Sobrealimentación', ['Atmosférico', 'Turbo', 'Biturbo', 'Compresor'], { section: 'Motor y especificaciones' }),
      text('compression', 'Compresión', { section: 'Motor y especificaciones' }),
      number('powerCv', 'Potencia de serie (CV)', { section: 'Motor y especificaciones' }),
      number('torqueNm', 'Par de serie (Nm)', { section: 'Motor y especificaciones' }),
      number('weightKg', 'Peso (kg)', { section: 'Motor y especificaciones' }),
      select('drivetrain', 'Tracción', ['Delantera', 'Trasera', 'Total'], { section: 'Motor y especificaciones' }),
      text('gearbox', 'Caja de cambios', { section: 'Motor y especificaciones' }),
      number('reliableLimitCv', 'Límite fiable (CV)', { section: 'Motor y especificaciones' }),
      area('engineTechnicalNotes', 'Notas técnicas del motor', { section: 'Motor y especificaciones' }),

      area('maintenanceItems', 'Mantenimiento recomendado — un elemento por línea', { section: 'Mantenimiento previo' }),
      area('maintenanceIntervals', 'Intervalos y prioridades', { section: 'Mantenimiento previo' }),
      area('preStageRequirements', 'Requisitos antes de Stage 1 / 2 / 3', { section: 'Mantenimiento previo' }),
      area('maintenanceCosts', 'Costes orientativos', { section: 'Mantenimiento previo' }),

      area('knownIssues', 'Fallos conocidos — uno por línea', { section: 'Fallos y puntos débiles' }),
      area('issueSymptoms', 'Síntomas', { section: 'Fallos y puntos débiles' }),
      area('issueSolutions', 'Soluciones recomendadas', { section: 'Fallos y puntos débiles' }),
      area('issueSeverityAndCosts', 'Gravedad y coste aproximado', { section: 'Fallos y puntos débiles' }),

      area('recommendedMods', 'Modificaciones recomendadas — una por línea', { section: 'Plan de modificaciones' }),
      area('modInstallOrder', 'Orden recomendado de instalación', { section: 'Plan de modificaciones' }),
      area('modCostsAndGains', 'Coste y ganancia estimada', { section: 'Plan de modificaciones' }),
      area('tuningRequirements', 'Repro, homologación y dificultad', { section: 'Plan de modificaciones' }),
      area('stage1Plan', 'Stage 1', { section: 'Plan de modificaciones' }),
      area('stage2Plan', 'Stage 2', { section: 'Plan de modificaciones' }),
      area('stage3Plan', 'Stage 3', { section: 'Plan de modificaciones' }),

      area('compatibilities', 'Piezas y motores compatibles', { section: 'Compatibilidades y reglas' }),
      area('incompatibilities', 'Incompatibilidades', { section: 'Compatibilidades y reglas' }),
      area('knowledgeRules', 'Reglas SI / ENTONCES aplicables', { section: 'Compatibilidades y reglas' }),

      image('mainImageUrl', 'Imagen principal', { section: 'Imágenes' }),
      image('stockImageUrl', 'Imagen stock', { section: 'Imágenes' }),
      image('modifiedImageUrl', 'Imagen modificada', { section: 'Imágenes' }),
      image('engineImageUrl', 'Imagen del motor', { section: 'Imágenes' }),
      area('additionalImages', 'Imágenes adicionales — una URL por línea', { section: 'Imágenes' }),
      area('imageCredits', 'Fuentes y créditos de imágenes', { section: 'Imágenes' }),

      area('premiumSummary', 'Resumen del Plan Premium', { section: 'Plan Premium' }),
      area('premiumInstallOrder', 'Orden exacto de instalación', { section: 'Plan Premium' }),
      area('premiumDependencies', 'Dependencias y requisitos', { section: 'Plan Premium' }),
      area('premiumParts', 'Piezas concretas recomendadas', { section: 'Plan Premium' }),
      area('premiumMistakes', 'Errores que debe evitar el usuario', { section: 'Plan Premium' }),
      area('premiumEvolution', 'Estrategia de evolución y conclusión', { section: 'Plan Premium' }),

      area('researchSources', 'Fuentes — una URL por línea', { section: 'Fuentes y verificación' }),
      area('sourceNotes', 'Qué dato respalda cada fuente', { section: 'Fuentes y verificación' }),
      select('confidenceLevel', 'Nivel de confianza', ['Bajo', 'Medio', 'Alto', 'Oficial'], { section: 'Fuentes y verificación' }),
      area('verificationNotes', 'Notas de verificación', { section: 'Fuentes y verificación' }),
      area('notes', 'Notas internas', { section: 'Fuentes y verificación' }),
    ],
  },
  images: {
    label: 'Imágenes', singular: 'imagen', icon: '▧', titleField: 'name',
    fields: [
      text('name', 'Nombre', { required: true }), text('vehicleId', 'ID de vehículo', { relation: 'vehicles' }),
      select('imageType', 'Tipo', ['Principal', 'Stock', 'Modificada', 'Garaje Premium', 'Motor', 'Interior', 'Frontal', 'Trasera', 'Lateral', 'Detalle']),
      text('url', 'URL / ruta'), text('thumbnailUrl', 'Miniatura'), text('source', 'Fuente'), area('notes', 'Notas'),
    ],
  },
  maintenance: {
    label: 'Mantenimiento', singular: 'tarea', icon: '⌁', titleField: 'item',
    fields: [
      text('item', 'Elemento', { required: true }), text('engineId', 'ID de motor', { relation: 'engines' }),
      select('priority', 'Prioridad', ['Baja', 'Media', 'Alta', 'Crítica']), text('interval', 'Intervalo'),
      number('costEuro', 'Coste estimado (€)'), select('requiredBeforeStage', 'Necesario antes de', ['Ninguno', 'Stage 1', 'Stage 2', 'Stage 3']),
      area('description', 'Descripción'),
    ],
  },
  knownIssues: {
    label: 'Fallos conocidos', singular: 'fallo', icon: '!', titleField: 'title',
    fields: [
      text('title', 'Nombre del fallo', { required: true }), text('engineId', 'ID de motor', { relation: 'engines' }), text('category', 'Categoría'),
      select('severity', 'Gravedad', ['Baja', 'Media', 'Alta', 'Crítica']), number('estimatedCostEuro', 'Coste aproximado (€)'),
      area('description', 'Descripción'), area('symptoms', 'Síntomas'), area('solution', 'Solución'),
    ],
  },
  modifications: {
    label: 'Mods recomendadas', singular: 'modificación', icon: '+', titleField: 'name',
    fields: [
      text('name', 'Nombre', { required: true }), text('engineId', 'ID de motor', { relation: 'engines' }), text('category', 'Categoría'),
      number('costEuro', 'Coste (€)'), text('estimatedGain', 'Ganancia'), select('requiresTune', 'Necesita repro', ['No', 'Sí']),
      select('requiresHomologation', 'Necesita homologación', ['No', 'Sí']), select('difficulty', 'Dificultad', ['Baja', 'Media', 'Alta']),
      number('recommendedOrder', 'Orden recomendado'), area('description', 'Descripción'),
    ],
  },
  rules: {
    label: 'Reglas', singular: 'regla', icon: '⌘', titleField: 'name',
    fields: [
      text('name', 'Nombre', { required: true }), select('entityType', 'Entidad', ['Motor', 'Vehículo', 'Generación']),
      text('entityId', 'ID de entidad'), area('conditions', 'Condiciones (SI / Y)'), area('actions', 'Acciones (ENTONCES)'),
      select('priority', 'Prioridad', ['Baja', 'Media', 'Alta', 'Crítica']),
    ],
  },
  compatibilities: {
    label: 'Compatibilidades', singular: 'compatibilidad', icon: '↔', titleField: 'name',
    fields: [text('name', 'Nombre', { required: true }), text('sourceEntityId', 'Entidad origen'), text('targetEntityId', 'Entidad destino'), select('compatibility', 'Compatibilidad', ['Directa', 'Con adaptación', 'No compatible']), area('requirements', 'Requisitos y notas')],
  },
  sources: {
    label: 'Fuentes', singular: 'fuente', icon: '↗', titleField: 'title',
    fields: [
      text('title', 'Fuente', { required: true }), text('url', 'URL'), text('entityType', 'Tipo de entidad'), text('entityId', 'ID relacionado'),
      text('sourceDate', 'Fecha de la fuente'), select('confidence', 'Confianza', ['Baja', 'Media', 'Alta', 'Oficial']),
      select('verification', 'Verificación', ['Pendiente', 'Verificada', 'Descartada']), area('notes', 'Notas'),
    ],
  },
};

export const sidebarGroups = [
  { label: 'Base de conocimiento', items: ['vehicles', 'engines', 'generations', 'models', 'brands'] },
  { label: 'Contenido técnico', items: ['images', 'maintenance', 'knownIssues', 'modifications'] },
  { label: 'Inteligencia', items: ['rules', 'compatibilities', 'sources'] },
];

export function emptyRecord(resourceKey) {
  const config = resources[resourceKey];
  return Object.fromEntries([
    ...config.fields.map((field) => [field.key, '']),
    ['status', resourceKey === 'vehicles' ? 'published' : 'draft'],
  ]);
}
