import { useEffect, useMemo, useRef, useState } from 'react';
import { emptyRecord, recordStatuses, resources } from '../config/resources';
import { listRecords, removeRecord, saveRecord } from '../services/repository';
import { uploadVehicleImage } from '../services/imageStorage';

const ESSENTIAL_VEHICLE_FIELDS = new Set([
  'brand', 'model', 'generation', 'version', 'yearStart', 'yearEnd',
  'engineCode', 'fuel', 'displacementCc', 'induction', 'powerCv', 'torqueNm',
  'drivetrain', 'gearbox', 'reliableLimitCv',
  'maintenanceItems', 'knownIssues', 'recommendedMods',
  'stage1Plan', 'stage2Plan', 'stage3Plan',
  'premiumSummary', 'researchSources', 'confidenceLevel',
]);

function ImageUploadField({ field, value, vehicleId, onChange }) {
  const [progress, setProgress] = useState(0);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const inputRef = useRef(null);

  async function handleFile(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setError('El archivo seleccionado no es una imagen.');
      return;
    }
    if (file.size > 12 * 1024 * 1024) {
      setError('La imagen supera el límite de 12 MB.');
      return;
    }

    setUploading(true);
    setError('');
    setProgress(0);
    try {
      const url = await uploadVehicleImage({
        file,
        vehicleId,
        imageType: field.key,
        onProgress: setProgress,
      });
      onChange(url);
    } catch (uploadError) {
      setError(uploadError.message || 'No se pudo subir la imagen.');
    } finally {
      setUploading(false);
      event.target.value = '';
    }
  }

  return (
    <div className="image-upload">
      {value ? <div className="image-preview"><img src={value} alt="" /><div><strong>Imagen adjunta</strong><a href={value} target="_blank" rel="noreferrer">Abrir original ↗</a></div></div> : <div className="image-placeholder"><span>▧</span><div><strong>Sin imagen</strong><small>JPG, PNG o WebP · máximo 12 MB</small></div></div>}
      <input ref={inputRef} className="hidden-file-input" type="file" accept="image/jpeg,image/png,image/webp" onChange={handleFile} />
      <div className="image-upload-actions">
        <button type="button" onClick={() => inputRef.current?.click()} disabled={uploading}>{uploading ? `Subiendo ${progress}%` : value ? 'Cambiar imagen' : '+ Adjuntar imagen'}</button>
        {value ? <button type="button" className="danger-text" onClick={() => onChange('')}>Quitar</button> : null}
      </div>
      {uploading ? <div className="upload-progress"><i style={{ width: `${progress}%` }} /></div> : null}
      {error ? <small className="upload-error">{error}</small> : null}
    </div>
  );
}

function RecordEditor({ resourceKey, initialRecord, user, onClose, onSaved }) {
  const config = resources[resourceKey];
  const [record, setRecord] = useState(initialRecord || emptyRecord(resourceKey));
  const [saveState, setSaveState] = useState('Sin cambios');
  const [started, setStarted] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const timer = useRef(null);

  useEffect(() => {
    setRecord(initialRecord || emptyRecord(resourceKey));
    setStarted(false);
    setShowAdvanced(false);
    setSaveState('Sin cambios');
  }, [initialRecord, resourceKey]);

  useEffect(() => {
    if (!started || !record.id) return undefined;
    clearTimeout(timer.current);
    setSaveState('Cambios sin guardar');
    timer.current = setTimeout(async () => {
      setSaveState('Guardando…');
      const saved = await saveRecord(resourceKey, record, user.email);
      setRecord(saved);
      setSaveState('Guardado');
      onSaved(saved, false);
    }, 1200);
    return () => clearTimeout(timer.current);
  }, [record, started]);

  function change(key, value) {
    setStarted(true);
    setRecord((current) => ({ ...current, [key]: value }));
  }

  async function saveNow() {
    const missing = config.fields.find((field) => field.required && !record[field.key]);
    if (missing) { setSaveState(`Falta: ${missing.label}`); return; }
    clearTimeout(timer.current);
    setSaveState('Guardando…');
    const saved = await saveRecord(resourceKey, record, user.email);
    setRecord(saved);
    setSaveState('Guardado');
    onSaved(saved, true);
  }

  const availableFields = resourceKey === 'vehicles'
    ? config.fields.filter((field) => field.section !== 'Imágenes')
    : config.fields;
  const visibleFields = resourceKey === 'vehicles' && !showAdvanced
    ? availableFields.filter((field) => ESSENTIAL_VEHICLE_FIELDS.has(field.key))
    : availableFields;

  const sections = visibleFields.reduce((groups, field) => {
    const section = field.section || 'Información';
    if (!groups[section]) groups[section] = [];
    groups[section].push(field);
    return groups;
  }, {});

  function sectionId(name) {
    return `editor-section-${name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-')}`;
  }

  function goToSection(name) {
    document.getElementById(sectionId(name))?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  return (
    <div className="editor-overlay">
      <div className="editor">
        <header className="editor-header">
          <div><p className="eyebrow">{record.id ? 'Editar' : 'Nuevo registro'}</p><h2>{record[config.titleField] || (resourceKey === 'vehicles' ? 'Nuevo vehículo' : `Nuevo registro · ${config.singular}`)}</h2></div>
          <div className="editor-actions"><span className="save-state"><i></i>{saveState}</span><button onClick={onClose}>×</button></div>
        </header>
        <div className="editor-body">
          <div className="editor-status">
            <label>Estado<select value={record.status} onChange={(e) => change('status', e.target.value)}>{recordStatuses.map(([value,label])=><option key={value} value={value}>{label}</option>)}</select></label>
            <span>ID: {record.id || 'Se asignará al guardar'}</span>
          </div>
          {resourceKey === 'vehicles' ? (
            <>
              <div className="editor-view-switch">
                <div><strong>{showAdvanced ? 'Ficha completa' : 'Vista esencial'}</strong><span>{showAdvanced ? 'Todos los campos disponibles.' : 'Solo los datos que más valor aportan.'}</span></div>
                <button type="button" onClick={() => setShowAdvanced((current) => !current)}>
                  {showAdvanced ? 'Ver menos campos' : 'Completar ficha avanzada'}
                </button>
              </div>
              <nav className="editor-section-nav" aria-label="Secciones de la ficha">
                {Object.keys(sections).map((sectionName, index) => (
                  <button type="button" key={sectionName} onClick={() => goToSection(sectionName)}>
                    <span>{String(index + 1).padStart(2, '0')}</span>{sectionName}
                  </button>
                ))}
              </nav>
            </>
          ) : null}
          {Object.entries(sections).map(([sectionName, fields], sectionIndex) => (
            <section className="editor-section" id={sectionId(sectionName)} key={sectionName}>
              <header>
                <span>{String(sectionIndex + 1).padStart(2, '0')}</span>
                <div><h3>{sectionName}</h3><p>{resourceKey === 'vehicles' ? 'Toda esta información pertenece a la misma ficha del vehículo.' : `Datos de ${config.singular}.`}</p></div>
              </header>
              <div className="editor-grid">
                {fields.map((field) => (
                  <label key={field.key} className={field.wide ? 'wide' : ''}>
                    <span>{field.label}{field.required ? ' *' : ''}</span>
                    {field.type === 'image' ? <ImageUploadField field={field} value={record[field.key] || ''} vehicleId={record.id} onChange={(value)=>change(field.key,value)} /> :
                      field.type === 'textarea' ? <textarea rows="5" value={record[field.key] || ''} onChange={(e)=>change(field.key,e.target.value)} /> :
                      field.type === 'select' ? <select value={record[field.key] || ''} onChange={(e)=>change(field.key,e.target.value)}><option value="">Seleccionar…</option>{field.values.map(value=><option key={value}>{value}</option>)}</select> :
                      <input type={field.type} value={record[field.key] || ''} onChange={(e)=>change(field.key,e.target.value)} placeholder={field.relation ? `Referencia a ${field.relation}` : ''} />}
                    {field.relation ? <small>Relación por clave con la colección {field.relation}</small> : null}
                  </label>
                ))}
              </div>
            </section>
          ))}
        </div>
        <footer className="editor-footer"><button onClick={onClose}>Cancelar</button><button className="primary" onClick={saveNow}>Guardar registro</button></footer>
      </div>
    </div>
  );
}

export default function ResourcePage({ resourceKey, user, canEdit, openNew, onNewHandled }) {
  const config = resources[resourceKey];
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState('all');
  const [editing, setEditing] = useState(null);

  async function refresh() {
    setLoading(true);
    try { setRecords(await listRecords(resourceKey)); } finally { setLoading(false); }
  }

  useEffect(() => { refresh(); }, [resourceKey]);
  useEffect(() => { if (openNew && canEdit) { setEditing(emptyRecord(resourceKey)); onNewHandled(); } }, [openNew, resourceKey, canEdit]);

  const filtered = useMemo(() => records.filter((record) => {
    const matchesText = !query || (record.searchText || Object.values(record).join(' ')).toLowerCase().includes(query.toLowerCase());
    return matchesText && (status === 'all' || record.status === status);
  }), [records, query, status]);

  async function deleteItem(record) {
    if (!window.confirm(`¿Eliminar ${record[config.titleField] || config.singular}? Esta acción quedará registrada.`)) return;
    await removeRecord(resourceKey, record, user.email);
    refresh();
  }

  function duplicate(record) {
    const clone = { ...record };
    delete clone.id; delete clone.createdAt; delete clone.updatedAt;
    clone.status = 'draft';
    clone[config.titleField] = `${clone[config.titleField] || ''} (copia)`;
    setEditing(clone);
  }

  return (
    <div className="page resource-page">
      <div className="page-heading">
        <div><p className="eyebrow">Base de conocimiento</p><h1>{config.label}</h1><p>{records.length} registros en esta colección.</p></div>
        {canEdit ? <button className="primary" onClick={() => setEditing(emptyRecord(resourceKey))}>+ Crear {config.singular}</button> : null}
      </div>
      <div className="toolbar">
        <div className="search-box"><span>⌕</span><input value={query} onChange={(e)=>setQuery(e.target.value)} placeholder={`Buscar en ${config.label.toLowerCase()}…`} /></div>
        <select value={status} onChange={(e)=>setStatus(e.target.value)}><option value="all">Todos los estados</option>{recordStatuses.map(([value,label])=><option key={value} value={value}>{label}</option>)}</select>
        <button onClick={refresh}>↻ Actualizar</button>
      </div>
      <div className="data-panel">
        <div className="data-head"><span>Registro</span><span>Estado</span><span>Actualizado por</span><span>Acciones</span></div>
        {loading ? <div className="empty-state">Cargando conocimiento…</div> : !filtered.length ? (
          <div className="empty-state"><div className="empty-icon">{config.icon}</div><h3>No hay registros todavía</h3><p>Crea el primer registro de {config.label.toLowerCase()}.</p><button className="primary" onClick={()=>setEditing(emptyRecord(resourceKey))}>Crear registro</button></div>
        ) : filtered.map((record) => (
          <div className="data-row" key={record.id}>
            <button className="record-title" onClick={()=>canEdit && setEditing(record)}><span>{config.icon}</span><div><strong>{record[config.titleField] || 'Sin nombre'}</strong><small>{record.code || record.version || record.id}</small></div></button>
            <span className={`status-pill ${record.status}`}>{recordStatuses.find(([value])=>value===record.status)?.[1] || 'Borrador'}</span>
            <span className="muted">{record.updatedBy || '—'}</span>
            <div className="row-actions">{canEdit ? <><button onClick={()=>setEditing(record)} title="Editar">✎</button><button onClick={()=>duplicate(record)} title="Duplicar">⧉</button><button className="danger" onClick={()=>deleteItem(record)} title="Eliminar">×</button></> : <span className="readonly-label">Solo lectura</span>}</div>
          </div>
        ))}
      </div>
      {editing ? <RecordEditor resourceKey={resourceKey} initialRecord={editing} user={user} onClose={()=>setEditing(null)} onSaved={(saved, close)=>{ setRecords(current => [saved, ...current.filter(item=>item.id!==saved.id)]); if(close)setEditing(null); }} /> : null}
    </div>
  );
}
