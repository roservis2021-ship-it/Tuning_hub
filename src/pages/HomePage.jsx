import { useEffect, useState } from 'react';
import CarForm from '../components/CarForm';
import BuildResult from '../components/BuildResult';
import { generateBuildRecommendation } from '../services/buildRecommender';
import { findMatchingBuild, logUserSearch } from '../services/firebaseBuildLibraryService';
import { generateAiBuild } from '../services/aiBuildService';
import heroBanner from '../assets/hero-banner.jpeg';

const LOADING_STEPS = [
  {
    title: 'Analizando vehiculo',
    copy: 'Comprobamos marca, generacion, motor y tipo de base para entender de que coche partimos.',
  },
  {
    title: 'Buscando mejores accesorios',
    copy: 'Cruzamos configuracion, uso y prioridad para decidir una ruta de mejora coherente.',
  },
  {
    title: 'Preparando stages',
    copy: 'Ordenamos la build por etapas para que el resultado sea claro, utilizable y progresivo.',
  },
  {
    title: 'Ajustando recomendacion final',
    copy: 'Pulimos advertencias, piezas clave y una propuesta pensada para calle y uso real.',
  },
];

function LoadingScreen({ vehicle, stepIndex, progress }) {
  const activeStep = LOADING_STEPS[Math.min(stepIndex, LOADING_STEPS.length - 1)];

  return (
    <section className="loading-screen">
      <article className="loading-card">
        <span className="section-heading__eyebrow">Generando build</span>
        <h2>{activeStep.title}</h2>
        <p>{activeStep.copy}</p>

        <div className="loading-orbit" aria-hidden="true">
          <span className="loading-orbit__ring loading-orbit__ring--outer" />
          <span className="loading-orbit__ring loading-orbit__ring--middle" />
          <span className="loading-orbit__ring loading-orbit__ring--inner" />
          <span className="loading-orbit__core" />
        </div>

        {vehicle && (
          <p className="loading-card__vehicle">
            {vehicle.brand} {vehicle.model} {vehicle.generation} {vehicle.engine}
          </p>
        )}

        <div className="loading-progress">
          <div className="loading-progress__bar">
            <span style={{ width: `${progress}%` }} />
          </div>
          <strong>{progress}%</strong>
        </div>

        <div className="loading-steps">
          {LOADING_STEPS.map((step, index) => (
            <article
              key={step.title}
              className={`loading-step ${
                index === stepIndex
                  ? 'loading-step--active'
                  : index < stepIndex
                    ? 'loading-step--done'
                    : ''
              }`}
            >
              <span>{index + 1}</span>
              <div>
                <strong>{step.title}</strong>
                <p>{step.copy}</p>
              </div>
            </article>
          ))}
        </div>
      </article>
    </section>
  );
}

function HomePage() {
  const [result, setResult] = useState(null);
  const [vehicle, setVehicle] = useState(null);
  const [currentScreen, setCurrentScreen] = useState('form');
  const [loadingStepIndex, setLoadingStepIndex] = useState(0);
  const [loadingProgress, setLoadingProgress] = useState(8);

  useEffect(() => {
    if (currentScreen !== 'loading') {
      return undefined;
    }

    const progressMarks = [18, 42, 68, 92];
    setLoadingStepIndex(0);
    setLoadingProgress(progressMarks[0]);

    const intervalId = window.setInterval(() => {
      setLoadingStepIndex((currentStep) => {
        const nextStep = Math.min(currentStep + 1, LOADING_STEPS.length - 1);
        setLoadingProgress(progressMarks[nextStep] ?? 92);
        return nextStep;
      });
    }, 1600);

    return () => window.clearInterval(intervalId);
  }, [currentScreen]);

  async function handleBuildSearch(vehicleData) {
    let nextResult = null;
    setVehicle(vehicleData);
    setCurrentScreen('loading');

    try {
      nextResult = await findMatchingBuild(vehicleData);
    } catch (error) {
      nextResult = null;
    }

    if (!nextResult) {
      try {
        nextResult = await generateAiBuild(vehicleData);
      } catch (error) {
        nextResult = null;
      }
    }

    if (!nextResult) {
      nextResult = generateBuildRecommendation(vehicleData);
    }

    setLoadingProgress(100);
    setResult(nextResult);
    setCurrentScreen('build');

    try {
      await logUserSearch(
        vehicleData,
        nextResult.source === 'database' ? nextResult.id : null,
        nextResult.source === 'database',
      );
    } catch (error) {
      // El log no debe bloquear la experiencia principal del usuario.
    }
  }

  function handleBackToForm() {
    setCurrentScreen('form');
  }

  return (
    <main className="layout">
      {currentScreen === 'form' ? (
        <>
          <section
            className="hero hero--mobile"
            style={{ '--hero-banner': `url(${heroBanner})` }}
          >
            <div className="hero__copy">
              <div className="brand-logo-wordmark" aria-label="Tuning Hub">
                <span className="brand-logo-wordmark__arc" aria-hidden="true" />
                <span className="brand-logo-wordmark__text">
                  <span className="brand-logo-wordmark__tuning">TUNING</span>
                  <span className="brand-logo-wordmark__hub">HUB</span>
                </span>
              </div>
              <span className="hero__tagline">Recomendaciones reales para coches reales</span>
              <h1>
                Mejora tu coche con <span>recomendaciones reales</span>
              </h1>
              <p>
                Basadas en motores, no en suposiciones. Selecciona tu coche y obten una guia
                clara para mejorar potencia, fiabilidad y coste.
              </p>
              <button
                className="hero__cta"
                type="button"
                onClick={() => {
                  const formCard = document.querySelector('.panel--form');
                  formCard?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                }}
              >
                Empieza con tu coche
              </button>
            </div>
          </section>

          <section className="screen-shell">
            <div className="screen-steps screen-steps--reference">
              <span className="screen-step screen-step--active">1. Tu vehiculo</span>
              <span className="screen-step">2. Configuracion</span>
            </div>

            <CarForm onSubmit={handleBuildSearch} />

            <section className="example-card">
              <span className="example-card__eyebrow">Ejemplo real</span>
              <div className="example-card__grid">
                <div>
                  <h3>Golf 1.9 TDI</h3>
                  <ul className="example-list example-list--checks">
                    <li>+30 hp en Stage 1</li>
                    <li>Bajo coste de entrada</li>
                    <li>Fiabilidad alta si la base esta sana</li>
                  </ul>
                </div>
                <div>
                  <h4>Recomendado</h4>
                  <ul className="example-list">
                    <li>Repro</li>
                    <li>Suspension</li>
                    <li>Frenos</li>
                  </ul>
                </div>
              </div>
            </section>

            <section className="info-card">
              <span className="info-card__eyebrow">Como funciona</span>
              <p>Seleccionas tu coche, comprobamos la configuracion y te devolvemos una build dividida por STAGES.</p>
            </section>
          </section>
        </>
      ) : currentScreen === 'loading' ? (
        <section className="screen-shell">
          <LoadingScreen
            vehicle={vehicle}
            stepIndex={loadingStepIndex}
            progress={loadingProgress}
          />
        </section>
      ) : (
        <section className="screen-shell">
          <BuildResult result={result} vehicle={vehicle} onBack={handleBackToForm} />
        </section>
      )}
    </main>
  );
}

export default HomePage;
