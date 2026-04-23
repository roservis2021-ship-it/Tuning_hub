import { useState } from 'react';
import {
  EUROPEAN_CAR_BRANDS,
  EUROPEAN_CAR_MODELS,
  EUROPEAN_CAR_VARIANTS,
} from '../data/europeanCars';

const initialForm = {
  brand: '',
  model: '',
  customModel: '',
  generation: '',
  customGeneration: '',
  engine: '',
  customEngine: '',
  powertrain: 'gasolina',
  aspiration: 'turbo',
  transmission: 'automatico',
  drivetrain: 'awd',
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

function CarForm({ onSubmit }) {
  const [formData, setFormData] = useState(initialForm);
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const availableModels = formData.brand ? EUROPEAN_CAR_MODELS[formData.brand] ?? [] : [];
  const selectedModelKey =
    formData.model && formData.model !== '__custom__' ? formData.model : null;
  const selectedVariantData =
    formData.brand && selectedModelKey
      ? EUROPEAN_CAR_VARIANTS[formData.brand]?.[selectedModelKey] ?? null
      : null;
  const availableGenerations = selectedVariantData?.generations ?? [];
  const isCustomModel = formData.model === '__custom__';
  const isCustomGeneration = formData.generation === '__custom__';
  const isCustomEngine = formData.engine === '__custom__';
  const canChooseVehicleDetails = Boolean(formData.brand && (selectedModelKey || isCustomModel));
  const availableEngines =
    selectedVariantData?.generationEngines?.[formData.generation] ??
    selectedVariantData?.engines ??
    [];

  function handleChange(event) {
    const { name, value } = event.target;

    setFormData((currentData) => ({
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
              customModel: value === '__custom__' ? currentData.customModel : '',
              generation: '',
              customGeneration: '',
              engine: '',
              customEngine: '',
            }
          : name === 'generation'
            ? {
                generation: value,
                customGeneration: value === '__custom__' ? currentData.customGeneration : '',
                engine: '',
                customEngine: '',
              }
            : name === 'engine'
              ? {
                  engine: value,
                  customEngine: value === '__custom__' ? currentData.customEngine : '',
                  powertrain:
                    value !== '__custom__' && currentData.generation
                      ? selectedVariantData?.generationEngineMeta?.[currentData.generation]?.[value]
                          ?.powertrain ?? currentData.powertrain
                      : currentData.powertrain,
                }
              : {}),
      [name]: value,
    }));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setError('');
    const selectedModel = isCustomModel ? formData.customModel.trim() : formData.model.trim();
    const selectedGeneration = isCustomGeneration
      ? formData.customGeneration.trim()
      : formData.generation.trim();
    const selectedEngine = isCustomEngine
      ? formData.customEngine.trim()
      : formData.engine.trim();

    if (!formData.brand.trim() || !selectedModel) {
      setError('Selecciona al menos la marca y el modelo para continuar.');
      return;
    }

    if (!selectedGeneration || !selectedEngine) {
      setError('Indica la generacion y el motor para que la build sea precisa.');
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
        brand: formData.brand.trim(),
        model: selectedModel,
        generation: selectedGeneration,
        engine: selectedEngine,
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
        <div className="panel-tabs">
          <span className="panel-tab panel-tab--active">1. Tu vehiculo</span>
          <span className="panel-tab">2. Configuracion</span>
        </div>
        <h2>Tu vehiculo</h2>
      </div>

      <form className="car-form" onSubmit={handleSubmit}>
        <div className="form-row">
          <label className="form-field">
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
              <option value="__custom__">Otro modelo / escribir manualmente</option>
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
            <select
              name="generation"
              value={formData.generation}
              onChange={handleChange}
              disabled={!canChooseVehicleDetails}
            >
              <option value="">
                {canChooseVehicleDetails ? 'Generacion / fase' : 'Selecciona primero una marca y un modelo'}
              </option>
              {availableGenerations.map((generation) => (
                <option key={generation} value={generation}>
                  {generation}
                </option>
              ))}
              <option value="__custom__">Otra generacion / escribir manualmente</option>
            </select>
          </label>

          <label className="form-field">
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
              <option value="__custom__">Otro motor / escribir manualmente</option>
            </select>
          </label>
        </div>

        {isCustomGeneration && (
          <label className="form-field">
            <input
              name="customGeneration"
              type="text"
              placeholder="Ejemplo: 8P o Golf IV"
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

        <div className="form-row form-row--triple">
          <label className="form-field">
            <select name="powertrain" value={formData.powertrain} onChange={handleChange}>
              <option value="gasolina">Gasolina</option>
              <option value="diesel">Diesel</option>
              <option value="hibrido">Hibrido</option>
              <option value="electrico">Electrico</option>
            </select>
          </label>

          <label className="form-field">
            <select name="aspiration" value={formData.aspiration} onChange={handleChange}>
              <option value="turbo">Turbo</option>
              <option value="atmosferico">Atmosferico</option>
            </select>
          </label>

          <label className="form-field">
            <select name="transmission" value={formData.transmission} onChange={handleChange}>
              <option value="manual">Manual</option>
              <option value="automatico">Automatico</option>
            </select>
          </label>
        </div>

        <div className="form-row form-row--triple">
          <label className="form-field">
            <select name="drivetrain" value={formData.drivetrain} onChange={handleChange}>
              <option value="fwd">Delantera</option>
              <option value="rwd">Trasera</option>
              <option value="awd">Total</option>
            </select>
          </label>

          <label className="form-field">
            <select name="usage" value={formData.usage} onChange={handleChange}>
              <option value="diario">Diario</option>
              <option value="finde">Finde</option>
              <option value="proyecto">Proyecto</option>
            </select>
          </label>
        </div>

        <label className="form-field">
          <select name="priority" value={formData.priority} onChange={handleChange}>
            <option value="equilibrio">Equilibrio general</option>
            <option value="potencia">Potencia</option>
            <option value="fiabilidad">Fiabilidad</option>
            <option value="estetica">Estetica</option>
            <option value="radical">Maximo rendimiento / al limite</option>
          </select>
        </label>

        {error && <p className="form-error">{error}</p>}

        <div className="form-submit-bar">
          <button className="primary-button primary-button--block" type="submit" disabled={isSubmitting}>
            {isSubmitting ? 'Preparando tu build...' : 'Siguiente'}
          </button>
        </div>
      </form>
    </section>
  );
}

export default CarForm;
