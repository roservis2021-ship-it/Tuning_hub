import { useEffect, useState } from 'react';
import CarForm from '../components/CarForm';
import BuildResult from '../components/BuildResult';
import PremiumPlan from '../components/PremiumPlan';
import StripeCheckoutScreen from '../components/StripeCheckoutScreen';
import { generateBuildRecommendation } from '../services/buildRecommender';
import { logUserSearch } from '../services/firebaseBuildLibraryService';
import { generateAiBuild } from '../services/aiBuildService';
import {
  createCheckoutSession,
  getCheckoutSessionStatus,
} from '../services/stripeCheckoutService';
import {
  initAnalytics,
  trackBuildError,
  trackBuildResult,
  trackBuildSearch,
} from '../services/analyticsService';
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

const PENDING_CHECKOUT_STORAGE_KEY = 'tuningHubPendingCheckout';

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
  const [currentScreen, setCurrentScreen] = useState('landing');
  const [loadingStepIndex, setLoadingStepIndex] = useState(0);
  const [loadingProgress, setLoadingProgress] = useState(8);
  const [buildMeta, setBuildMeta] = useState(null);

  useEffect(() => {
    initAnalytics().catch(() => {
      // Analytics no debe interrumpir la app.
    });
  }, []);

  useEffect(() => {
    const searchParams = new URLSearchParams(window.location.search);
    const checkoutStatus = searchParams.get('checkout');

    if (!checkoutStatus) {
      return;
    }

    async function restoreCheckout() {
      try {
        const storedCheckout = JSON.parse(
          window.sessionStorage.getItem(PENDING_CHECKOUT_STORAGE_KEY) || '{}',
        );

        if (!storedCheckout.result || !storedCheckout.vehicle) {
          setCurrentScreen('landing');
          return;
        }

        if (checkoutStatus === 'success') {
          const sessionId = searchParams.get('session_id');
          const sessionStatus = await getCheckoutSessionStatus(sessionId);

          if (!sessionStatus.paid) {
            setResult(storedCheckout.result);
            setVehicle(storedCheckout.vehicle);
            setBuildMeta(storedCheckout.buildMeta || null);
            setCurrentScreen('build');
            return;
          }

          window.sessionStorage.removeItem(PENDING_CHECKOUT_STORAGE_KEY);
          setResult(storedCheckout.result);
          setVehicle(storedCheckout.vehicle);
          setBuildMeta(storedCheckout.buildMeta || null);
          setCurrentScreen('premium');
        } else {
          setResult(storedCheckout.result);
          setVehicle(storedCheckout.vehicle);
          setBuildMeta(storedCheckout.buildMeta || null);
          setCurrentScreen('build');
        }
      } catch (error) {
        setCurrentScreen('landing');
      }
    }

    window.history.replaceState({}, '', window.location.pathname);
    restoreCheckout();
  }, []);

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
    let aiErrorMessage = '';
    let strictVerificationFailed = false;
    setVehicle(vehicleData);
    setCurrentScreen('loading');
    setBuildMeta(null);

    trackBuildSearch(vehicleData).catch(() => {
      // Analytics no debe bloquear el flujo principal.
    });

    try {
      nextResult = await generateAiBuild(vehicleData);
    } catch (error) {
      if (error?.code === 'VEHICLE_VERIFICATION_FAILED') {
        strictVerificationFailed = true;
        aiErrorMessage =
          error.message ||
          'No se pudo verificar al 100% la variante exacta, asi que hemos mostrado una build orientativa.';
        trackBuildError(error.message, error.code).catch(() => {});
      } else {
        aiErrorMessage = error?.message || 'La IA no estuvo disponible en este intento.';
        trackBuildError(aiErrorMessage, error?.code || 'AI_BUILD_FAILED').catch(() => {});
      }
    }

    if (!nextResult) {
      nextResult = generateBuildRecommendation(vehicleData);
      nextResult.aiFallbackReason = aiErrorMessage || 'La IA no ha podido generar una build optimizada.';
      if (aiErrorMessage) {
        nextResult.warnings = [aiErrorMessage, ...nextResult.warnings];
      }
    }

    setLoadingProgress(100);
    setResult(nextResult);
    setBuildMeta({
      source: nextResult.source,
      aiErrorMessage,
      strictVerificationFailed,
    });
    setCurrentScreen('build');

    trackBuildResult(nextResult, vehicleData).catch(() => {
      // Analytics no debe bloquear la experiencia principal.
    });

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

  function handleStartBuild() {
    setCurrentScreen('form');
  }

  async function handleOpenOptimizedPlan() {
    if (!result) {
      return;
    }

    const vehicleName = [
      result?.vehicleIdentity?.canonicalBrand || vehicle?.brand,
      result?.vehicleIdentity?.canonicalModel || vehicle?.model,
      result?.vehicleIdentity?.canonicalGeneration || vehicle?.generation,
      result?.vehicleIdentity?.canonicalEngine || vehicle?.engine,
    ]
      .filter(Boolean)
      .join(' ');

    window.sessionStorage.setItem(
      PENDING_CHECKOUT_STORAGE_KEY,
      JSON.stringify({
        result,
        vehicle,
        buildMeta,
      }),
    );

    try {
      const checkoutSession = await createCheckoutSession({
        vehicleName,
        buildId: result.id,
      });

      window.location.href = checkoutSession.url;
    } catch (error) {
      alert(error.message || 'No se pudo abrir el pago seguro de Stripe.');
    }
  }

  return (
    <main className="layout">
      {currentScreen === 'landing' ? (
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
              Descubre una guia especifica para modificar <span>correctamente</span> tu coche
            </h1>
            <p>
              Descubre que piezas montar, cuales evitar y el orden <span>correcto</span> para no
              dañar tu coche.
            </p>
            <button className="hero__cta" type="button" onClick={handleStartBuild}>
              Modifica tu coche
            </button>
          </div>
        </section>
      ) : currentScreen === 'form' ? (
        <>
          <section className="screen-shell" id="vehicle-form-section">
            <CarForm onSubmit={handleBuildSearch} />
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
      ) : currentScreen === 'premium' ? (
        <section className="screen-shell">
          <PremiumPlan
            result={result}
            vehicle={vehicle}
            onBack={() => setCurrentScreen('build')}
          />
        </section>
      ) : currentScreen === 'checkout' ? (
        <section className="screen-shell">
          <StripeCheckoutScreen
            result={result}
            vehicleName={[
              result?.vehicleIdentity?.canonicalBrand || vehicle?.brand,
              result?.vehicleIdentity?.canonicalModel || vehicle?.model,
              result?.vehicleIdentity?.canonicalGeneration || vehicle?.generation,
              result?.vehicleIdentity?.canonicalEngine || vehicle?.engine,
            ]
              .filter(Boolean)
              .join(' ')}
            onBack={() => setCurrentScreen('build')}
          />
        </section>
      ) : (
        <section className="screen-shell">
          <BuildResult
            result={result}
            vehicle={vehicle}
            buildMeta={buildMeta}
            onBack={handleBackToForm}
            onOpenOptimizedPlan={handleOpenOptimizedPlan}
          />
        </section>
      )}
    </main>
  );
}

export default HomePage;
