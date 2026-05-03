import { useState } from 'react';
import {
  EUROPEAN_CAR_BRANDS,
  EUROPEAN_CAR_MODELS,
  EUROPEAN_CAR_VARIANTS,
} from '../data/europeanCars';

const CUSTOM_VALUE = '__custom__';
const UNKNOWN_GENERATION_LABEL = 'Generación por confirmar';
const UNKNOWN_YEAR_TEXT = 'años no confirmados';
const UNKNOWN_ENGINE_MARKERS = ['exacto por confirmar', 'versión exacta por confirmar'];
const GENERIC_ENGINES = [
  'Gasolina - motor exacto por confirmar',
  'Diésel - motor exacto por confirmar',
  'Híbrido - versión exacta por confirmar',
  'Eléctrico - versión exacta por confirmar',
];
const GENERIC_ENGINE_META = {
  'Gasolina - motor exacto por confirmar': { powertrain: 'gasolina', aspiration: 'turbo' },
  'Diésel - motor exacto por confirmar': { powertrain: 'diesel', aspiration: 'turbo' },
  'Híbrido - versión exacta por confirmar': { powertrain: 'hibrido', aspiration: 'turbo' },
  'Eléctrico - versión exacta por confirmar': { powertrain: 'electrico', aspiration: 'atmosferico' },
};

function FieldIcon({ type }) {
  const icons = {
    brand: (
      <>
        <path d="M7 16h10" />
        <path d="M5 16l1.6-5.2A2.5 2.5 0 0 1 9 9h6a2.5 2.5 0 0 1 2.4 1.8L19 16" />
        <path d="M7 16v2" />
        <path d="M17 16v2" />
        <path d="M8 13h.01" />
        <path d="M16 13h.01" />
      </>
    ),
    model: (
      <>
        <path d="M4 15h16" />
        <path d="M6 15l2-5h8l2 5" />
        <path d="M8 18h.01" />
        <path d="M16 18h.01" />
        <path d="M9 10V7h6v3" />
      </>
    ),
    generation: (
      <>
        <path d="M7 7h10" />
        <path d="M7 12h10" />
        <path d="M7 17h10" />
        <path d="M4 7h.01" />
        <path d="M4 12h.01" />
        <path d="M4 17h.01" />
      </>
    ),
    engine: (
      <>
        <path d="M6 12h12v6H6z" />
        <path d="M9 12V9h5v3" />
        <path d="M4 14H2" />
        <path d="M22 14h-2" />
        <path d="M8 18v2" />
        <path d="M16 18v2" />
      </>
    ),
    mileage: (
      <>
        <path d="M5 15a7 7 0 0 1 14 0" />
        <path d="M12 15l4-4" />
        <path d="M8 19h8" />
        <path d="M7 13h.01" />
        <path d="M17 13h.01" />
      </>
    ),
    fuel: (
      <>
        <path d="M7 20V5a1 1 0 0 1 1-1h7a1 1 0 0 1 1 1v15" />
        <path d="M6 20h11" />
        <path d="M9 8h4" />
        <path d="M16 8l3 3v6a2 2 0 0 0 2 2" />
      </>
    ),
    aspiration: (
      <>
        <path d="M4 13c4-5 8-5 12 0" />
        <path d="M7 16c3-3 6-3 9 0" />
        <path d="M18 8v8" />
        <path d="M21 11l-3-3-3 3" />
      </>
    ),
    transmission: (
      <>
        <path d="M7 5v14" />
        <path d="M17 5v14" />
        <path d="M7 12h10" />
        <path d="M7 5h4" />
        <path d="M17 19h-4" />
      </>
    ),
    drivetrain: (
      <>
        <path d="M6 6h4v4H6z" />
        <path d="M14 6h4v4h-4z" />
        <path d="M6 14h4v4H6z" />
        <path d="M14 14h4v4h-4z" />
        <path d="M10 8h4" />
        <path d="M10 16h4" />
      </>
    ),
    usage: (
      <>
        <path d="M5 18h14" />
        <path d="M7 18l2-8h6l2 8" />
        <path d="M9 10l3-4 3 4" />
      </>
    ),
    objective: (
      <>
        <path d="M12 20a8 8 0 1 0-8-8" />
        <path d="M12 16a4 4 0 1 0-4-4" />
        <path d="M12 12l7-7" />
        <path d="M18 5h3v3" />
      </>
    ),
  };

  return (
    <svg className="form-field-icon" viewBox="0 0 24 24" aria-hidden="true">
      {icons[type]}
    </svg>
  );
}

function FieldLabel({ icon, children }) {
  return (
    <span className="form-field-label">
      <FieldIcon type={icon} />
      <span>{children}</span>
    </span>
  );
}

const initialForm = {
  brand: '',
  model: '',
  customModel: '',
  generation: '',
  customGeneration: '',
  engine: '',
  customEngine: '',
  mileageKm: '',
  powertrain: 'gasolina',
  aspiration: 'turbo',
  transmission: 'manual',
  drivetrain: 'fwd',
  usage: 'diario',
  priority: 'equilibrio',
};

function resolveGoalFromForm({ priority, usage }) {
  if (priority === 'estetica') {
    return 'stance';
  }

  if (priority === 'radical') {
    return usage === 'proyecto' ? 'radical' : usage === 'finde' ? 'tandas' : 'calle';
  }

  if (priority === 'potencia') {
    return usage === 'diario' ? 'calle' : 'tandas';
  }

  return 'calle';
}

function normalizeForMatch(value) {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

function isUnknownGeneration(generation) {
  return normalizeForMatch(generation).includes('generacion por confirmar');
}

function isUnknownEngine(engine) {
  const normalizedEngine = normalizeForMatch(engine);
  return UNKNOWN_ENGINE_MARKERS.some((marker) => normalizedEngine.includes(normalizeForMatch(marker)));
}

function getGenerationLabel(generation) {
  if (!generation || generation.includes('(') || isUnknownGeneration(generation)) {
    return generation;
  }

  return `${generation} (${UNKNOWN_YEAR_TEXT})`;
}

function getSubmissionGeneration(generation) {
  return isUnknownGeneration(generation) ? UNKNOWN_GENERATION_LABEL : getGenerationLabel(generation);
}

function parseMileageKm(value) {
  const mileageKm = Number(value);

  return Number.isFinite(mileageKm) && mileageKm >= 0 ? Math.round(mileageKm) : null;
}

function getEngineMeta(variantData, generation, engine) {
  if (variantData?.genericVehicle) {
    return GENERIC_ENGINE_META[engine] ?? null;
  }

  return variantData?.generationEngineMeta?.[generation]?.[engine] ?? null;
}

function CarForm({ onSubmit }) {
  const [formData, setFormData] = useState(initialForm);
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const availableModels = formData.brand ? EUROPEAN_CAR_MODELS[formData.brand] ?? [] : [];
  const selectedModelKey =
    formData.model && formData.model !== CUSTOM_VALUE ? formData.model : null;
  const selectedVariantData =
    formData.brand && selectedModelKey
      ? EUROPEAN_CAR_VARIANTS[formData.brand]?.[selectedModelKey] ?? null
      : null;
  const availableGenerations = selectedVariantData?.genericVehicle
    ? [UNKNOWN_GENERATION_LABEL]
    : selectedVariantData?.generations ?? [];
  const isCustomModel = formData.model === CUSTOM_VALUE;
  const isCustomGeneration = formData.generation === CUSTOM_VALUE;
  const isCustomEngine = formData.engine === CUSTOM_VALUE;
  const canChooseVehicleDetails = Boolean(formData.brand && (selectedModelKey || isCustomModel));
  const availableEngines =
    selectedVariantData?.genericVehicle
      ? GENERIC_ENGINES
      : selectedVariantData?.generationEngines?.[formData.generation] ??
        selectedVariantData?.engines ??
    [];

  function handleChange(event) {
    const { name, value } = event.target;

    setFormData((currentData) => {
      const engineMeta =
        name === 'engine' && value !== CUSTOM_VALUE && currentData.generation
          ? getEngineMeta(selectedVariantData, currentData.generation, value)
          : null;

      return {
        ...currentData,
        ...(name === 'brand'
          ? {
              brand: value,
              model: '',
              customModel: '',
              generation: '',
              customGeneration: '',
              engine: '',
              customEngine: '',
            }
          : name === 'model'
            ? {
                model: value,
                customModel: value === CUSTOM_VALUE ? currentData.customModel : '',
                generation: '',
                customGeneration: '',
                engine: '',
                customEngine: '',
              }
            : name === 'generation'
              ? {
                  generation: value,
                  customGeneration: value === CUSTOM_VALUE ? currentData.customGeneration : '',
                  engine: '',
                  customEngine: '',
                }
              : name === 'engine'
                ? {
                    engine: value,
                    customEngine: value === CUSTOM_VALUE ? currentData.customEngine : '',
                    powertrain: engineMeta?.powertrain ?? currentData.powertrain,
                    aspiration: engineMeta?.aspiration ?? currentData.aspiration,
                  }
                : {}),
        [name]: value,
      };
    });
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setError('');

    const selectedModel = isCustomModel ? formData.customModel.trim() : formData.model.trim();
    const selectedGeneration = isCustomGeneration
      ? formData.customGeneration.trim()
      : formData.generation.trim();
    const selectedGenerationWithYears = isCustomGeneration
      ? selectedGeneration
      : getSubmissionGeneration(selectedGeneration);
    const selectedEngine = isCustomEngine ? formData.customEngine.trim() : formData.engine.trim();
    const mileageKm = formData.mileageKm ? parseMileageKm(formData.mileageKm) : null;

    if (!formData.brand.trim() || !selectedModel) {
      setError('Selecciona al menos la marca y el modelo para continuar.');
      return;
    }

    if (!selectedGeneration || !selectedEngine) {
      setError('Indica la generacion y el motor para que la build sea precisa.');
      return;
    }

    if (formData.mileageKm && mileageKm === null) {
      setError('El kilometraje debe ser un numero valido en kilometros.');
      return;
    }

    try {
      setIsSubmitting(true);
      await onSubmit({
        ...formData,
        goal: resolveGoalFromForm({
          priority: formData.priority,
          usage: formData.usage,
        }),
        budget: 'medio',
        accessTier: 'free',
        brand: formData.brand.trim(),
        model: selectedModel,
        generation: selectedGenerationWithYears,
        year: '',
        engine: selectedEngine,
        mileageKm,
        needsVehicleConfirmation:
          isUnknownGeneration(selectedGenerationWithYears) || isUnknownEngine(selectedEngine),
      });
    } catch (submitError) {
      setError(
        submitError?.message ||
          'No hemos podido generar la build en este momento. Intentalo de nuevo en unos segundos.',
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <section className="panel panel--form">
      <div className="section-heading">
        <h2>Tu vehiculo</h2>
      </div>

      <form className="car-form" onSubmit={handleSubmit}>
        <div className="form-row">
          <label className="form-field">
            <FieldLabel icon="brand">Marca</FieldLabel>
            <select name="brand" value={formData.brand} onChange={handleChange}>
              <option value="">Elige tu marca</option>
              {EUROPEAN_CAR_BRANDS.map((brand) => (
                <option key={brand} value={brand}>
                  {brand}
                </option>
              ))}
            </select>
          </label>

          <label className="form-field">
            <FieldLabel icon="model">Modelo</FieldLabel>
            <select
              name="model"
              value={formData.model}
              onChange={handleChange}
              disabled={!formData.brand}
            >
              <option value="">
                {formData.brand ? 'Modelo' : 'Selecciona primero una marca'}
              </option>
              {availableModels.map((model) => (
                <option key={model} value={model}>
                  {model}
                </option>
              ))}
              <option value={CUSTOM_VALUE}>Otro modelo / escribir manualmente</option>
            </select>
          </label>
        </div>

        {isCustomModel && (
          <label className="form-field">
            <input
              name="customModel"
              type="text"
              placeholder="Escribe el modelo exacto"
              value={formData.customModel}
              onChange={handleChange}
            />
          </label>
        )}

        <div className="form-row">
          <label className="form-field">
            <FieldLabel icon="generation">Generacion</FieldLabel>
            <select
              name="generation"
              value={formData.generation}
              onChange={handleChange}
              disabled={!canChooseVehicleDetails}
            >
              <option value="">
                {canChooseVehicleDetails
                  ? 'Generacion / fase'
                  : 'Selecciona primero una marca y un modelo'}
              </option>
              {availableGenerations.map((generation) => (
                <option key={generation} value={generation}>
                  {getGenerationLabel(generation)}
                </option>
              ))}
              <option value={CUSTOM_VALUE}>Otra generacion / escribir manualmente</option>
            </select>
          </label>

          <label className="form-field">
            <FieldLabel icon="engine">Motor</FieldLabel>
            <select
              name="engine"
              value={formData.engine}
              onChange={handleChange}
              disabled={!canChooseVehicleDetails}
            >
              <option value="">
                {canChooseVehicleDetails ? 'Motor' : 'Selecciona primero una marca y un modelo'}
              </option>
              {availableEngines.map((engine) => (
                <option key={engine} value={engine}>
                  {engine}
                </option>
              ))}
              <option value={CUSTOM_VALUE}>Otro motor / escribir manualmente</option>
            </select>
          </label>
        </div>

        {isCustomGeneration && (
          <label className="form-field">
            <input
              name="customGeneration"
              type="text"
              placeholder="Ejemplo: Golf MK4 (1998-2002)"
              value={formData.customGeneration}
              onChange={handleChange}
            />
          </label>
        )}

        {isCustomEngine && (
          <label className="form-field">
            <input
              name="customEngine"
              type="text"
              placeholder="Ejemplo: 2.0 TFSI o 1.9 TDI"
              value={formData.customEngine}
              onChange={handleChange}
            />
          </label>
        )}

        <div className="form-row form-row--quad">
          <label className="form-field">
            <FieldLabel icon="mileage">Kilometraje</FieldLabel>
            <input
              name="mileageKm"
              type="number"
              min="0"
              step="1000"
              inputMode="numeric"
              placeholder="Ejemplo: 145000"
              value={formData.mileageKm}
              onChange={handleChange}
            />
          </label>

          <label className="form-field">
            <FieldLabel icon="fuel">Combustible</FieldLabel>
            <select name="powertrain" value={formData.powertrain} onChange={handleChange}>
              <option value="gasolina">Gasolina</option>
              <option value="diesel">Diesel</option>
              <option value="hibrido">Hibrido</option>
              <option value="electrico">Electrico</option>
            </select>
          </label>

          <label className="form-field">
            <FieldLabel icon="aspiration">Aspiracion</FieldLabel>
            <select name="aspiration" value={formData.aspiration} onChange={handleChange}>
              <option value="turbo">Turbo</option>
              <option value="atmosferico">Atmosferico</option>
              <option value="compresor">Compresor</option>
            </select>
          </label>

          <label className="form-field">
            <FieldLabel icon="transmission">Transmision</FieldLabel>
            <select name="transmission" value={formData.transmission} onChange={handleChange}>
              <option value="manual">Manual</option>
              <option value="automatico">Automatico</option>
            </select>
          </label>
        </div>

        <div className="form-row form-row--triple">
          <label className="form-field">
            <FieldLabel icon="drivetrain">Traccion</FieldLabel>
            <select name="drivetrain" value={formData.drivetrain} onChange={handleChange}>
              <option value="fwd">Delantera</option>
              <option value="rwd">Trasera</option>
              <option value="awd">Total</option>
            </select>
          </label>

          <label className="form-field">
            <FieldLabel icon="usage">Uso</FieldLabel>
            <select name="usage" value={formData.usage} onChange={handleChange}>
              <option value="diario">Diario</option>
              <option value="finde">Finde</option>
              <option value="proyecto">Proyecto</option>
            </select>
          </label>

          <label className="form-field">
            <FieldLabel icon="objective">Objetivo</FieldLabel>
            <select name="priority" value={formData.priority} onChange={handleChange}>
              <option value="equilibrio">Equilibrio general</option>
              <option value="potencia">Potencia</option>
              <option value="fiabilidad">Fiabilidad</option>
              <option value="estetica">Estetica</option>
              <option value="radical">Maximo rendimiento / al limite</option>
            </select>
          </label>
        </div>

        {error && <p className="form-error">{error}</p>}

        <div className="form-submit-bar">
          <button className="primary-button primary-button--block" type="submit" disabled={isSubmitting}>
            {isSubmitting ? 'Preparando tu build...' : 'Ver modificaciones'}
          </button>
        </div>
      </form>
    </section>
  );
}

export default CarForm;
