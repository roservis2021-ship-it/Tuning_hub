import { lazy, Suspense, useEffect, useMemo, useState } from 'react';
import { generateBuildRecommendation } from '../services/buildRecommender';
import { generateAiBuild } from '../services/aiBuildService';
import heroBanner from '../assets/hero-banner.jpeg';

const CarForm = lazy(() => import('../components/CarForm'));
const BuildResult = lazy(() => import('../components/BuildResult'));
const StripeCheckoutScreen = lazy(() => import('../components/StripeCheckoutScreen'));
const PaymentActivationScreen = lazy(() => import('../components/PaymentActivationScreen'));
const AccountPanel = lazy(() => import('../features/premium/auth/AccountPanel').then((module) => ({ default: module.AccountPanel })));
const ProtectedRoute = lazy(() => import('../features/premium/auth/ProtectedRoute').then((module) => ({ default: module.ProtectedRoute })));
const PremiumOnboardingGate = lazy(() => import('../features/premium/onboarding/PremiumOnboardingGate').then((module) => ({ default: module.PremiumOnboardingGate })));
const PremiumGarage = lazy(() => import('../features/premium/garage/PremiumGarage').then((module) => ({ default: module.PremiumGarage })));
const PremiumAuthBoundary = lazy(() => import('../features/premium/auth/PremiumAuthBoundary').then((module) => ({ default: module.PremiumAuthBoundary })));

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
const PENDING_EXTRA_BUILD_STORAGE_KEY = 'tuningHubPendingExtraBuild';
const BUILD_QUOTA_STORAGE_KEY = 'tuningHubBuildQuota';
const BUILD_QUOTA_WINDOW_MS = 60 * 60 * 1000;
const FREE_BUILD_LIMIT = 2;
const PREMIUM_TEST_PREVIEW = '330ci-qa-20260711';

const BMW_330CI_TEST_VEHICLE = {
  brand: 'BMW',
  model: '330Ci',
  generation: 'E46',
  engine: 'M54B30 3.0 231 CV',
  powertrain: 'gasolina',
  aspiration: 'atmosferico',
  transmission: 'manual',
  drivetrain: 'rwd',
  accessTier: 'premium',
};

const BMW_330CI_TEST_RESULT = {
  id: 'premium-preview-bmw-330ci-e46',
  source: 'premium_test',
  basePowerCv: 231,
  vehicleIdentity: {
    canonicalBrand: 'BMW',
    canonicalModel: '330Ci',
    canonicalGeneration: 'E46',
    canonicalEngine: 'M54B30 3.0 231 CV',
    factoryTorqueNm: 300,
  },
};

function getStoredJson(key, fallback = {}) {
  if (typeof window === 'undefined') {
    return fallback;
  }

  try {
    return JSON.parse(window.localStorage.getItem(key) || JSON.stringify(fallback));
  } catch (error) {
    return fallback;
  }
}

function getBuildQuota(now = Date.now()) {
  const storedQuota = getStoredJson(BUILD_QUOTA_STORAGE_KEY, null);

  if (
    !storedQuota ||
    !Number.isFinite(Number(storedQuota.windowStartedAt)) ||
    now - Number(storedQuota.windowStartedAt) >= BUILD_QUOTA_WINDOW_MS
  ) {
    return {
      windowStartedAt: now,
      used: 0,
    };
  }

  return {
    windowStartedAt: Number(storedQuota.windowStartedAt),
    used: Math.max(0, Number(storedQuota.used) || 0),
  };
}

function saveBuildQuota(quota) {
  if (typeof window === 'undefined') {
    return;
  }

  window.localStorage.setItem(BUILD_QUOTA_STORAGE_KEY, JSON.stringify(quota));
}

function getQuotaSnapshot(now = Date.now()) {
  const quota = getBuildQuota(now);
  const resetAt = quota.windowStartedAt + BUILD_QUOTA_WINDOW_MS;

  return {
    ...quota,
    resetAt,
    remaining: Math.max(0, FREE_BUILD_LIMIT - quota.used),
  };
}

function consumeFreeBuildSlot() {
  const quota = getBuildQuota();

  if (quota.used >= FREE_BUILD_LIMIT) {
    saveBuildQuota(quota);
    return {
      allowed: false,
      ...getQuotaSnapshot(),
    };
  }

  const nextQuota = {
    ...quota,
    used: quota.used + 1,
  };
  saveBuildQuota(nextQuota);

  return {
    allowed: true,
    ...getQuotaSnapshot(),
  };
}

function getVehicleNameFromData(vehicleData, result = null) {
  const identity = result?.vehicleIdentity || {};

  return [
    identity.canonicalBrand || vehicleData?.brand,
    identity.canonicalModel || vehicleData?.model,
    identity.canonicalGeneration || vehicleData?.generation,
    identity.canonicalEngine || vehicleData?.engine,
  ]
    .filter(Boolean)
    .join(' ');
}

function isBmw330Ci(vehicleData, buildResult = null) {
  const name = getVehicleNameFromData(vehicleData, buildResult).toLowerCase();
  return name.includes('bmw') && (name.includes('330ci') || name.includes('330 ci'));
}

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

function formatCooldownTime(milliseconds) {
  const safeMilliseconds = Math.max(0, milliseconds);
  const totalSeconds = Math.ceil(safeMilliseconds / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

function BuildLimitScreen({ vehicle, quotaInfo, onBack, onPayExtraBuild }) {
  const [now, setNow] = useState(Date.now());
  const resetAt = quotaInfo?.resetAt || now;
  const remainingTime = useMemo(() => formatCooldownTime(resetAt - now), [now, resetAt]);

  useEffect(() => {
    const timerId = window.setInterval(() => {
      setNow(Date.now());
    }, 1000);

    return () => window.clearInterval(timerId);
  }, []);

  return (
    <section className="build-limit-screen">
      <article className="build-limit-card">
        <span className="section-heading__eyebrow">Limite de builds free</span>
        <h2>Has usado tus 2 builds gratuitas</h2>
        <p>
          Para evitar generaciones sin control, puedes crear otra build ahora por 0,89 € o esperar
          a que se reinicie tu limite.
        </p>
        {vehicle ? (
          <strong className="build-limit-card__vehicle">
            {getVehicleNameFromData(vehicle)}
          </strong>
        ) : null}
        <div className="build-limit-card__timer">
          <span>Vuelves a tener 2 builds gratis en</span>
          <strong>{remainingTime}</strong>
        </div>
        <button type="button" onClick={onPayExtraBuild}>
          Generar build extra por 0,89 €
        </button>
        <button type="button" className="build-limit-card__secondary" onClick={onBack}>
          Volver al inicio
        </button>
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
  const [quotaInfo, setQuotaInfo] = useState(() => getQuotaSnapshot());
  const [checkoutContext, setCheckoutContext] = useState(null);
  const [paymentSessionId, setPaymentSessionId] = useState('');
  const [paymentPurchaseId, setPaymentPurchaseId] = useState('');
  const [paymentClaimToken, setPaymentClaimToken] = useState('');
  const [paymentCancelled, setPaymentCancelled] = useState(false);

  useEffect(() => {
    const initializeAnalytics = async () => {
      const { initAnalytics } = await import('../services/analyticsService');
      await initAnalytics();
    };

    initializeAnalytics().catch(() => {
      // Analytics no debe interrumpir la app.
    });
  }, []);

  useEffect(() => {
    const searchParams = new URLSearchParams(window.location.search);
    const premiumPreview = searchParams.get('premium_preview');

    if (premiumPreview === PREMIUM_TEST_PREVIEW) {
      setVehicle(BMW_330CI_TEST_VEHICLE);
      setResult(BMW_330CI_TEST_RESULT);
      setBuildMeta({ source: 'premium_test', simulatedPayment: true });
      setCurrentScreen('premium');
      return;
    }

    const checkoutStatus = searchParams.get('checkout');

    if (!checkoutStatus) {
      return;
    }

    function restoreCheckout() {
      let storedCheckout = {};

      try {
        storedCheckout = JSON.parse(
          window.sessionStorage.getItem(PENDING_CHECKOUT_STORAGE_KEY) || '{}',
        );

        if (storedCheckout.result && storedCheckout.vehicle) {
          setResult(storedCheckout.result); setVehicle(storedCheckout.vehicle); setBuildMeta(storedCheckout.buildMeta || null);
        }
        setCheckoutContext({ checkoutType: storedCheckout.checkoutType || 'plan_action' });
        setPaymentSessionId(searchParams.get('session_id') || '');
        setPaymentPurchaseId(searchParams.get('purchase_id') || '');
        setPaymentClaimToken(searchParams.get('claim_token') || '');
        setPaymentCancelled(checkoutStatus !== 'success');
        setCurrentScreen('paymentResult');
      } catch (error) {
        if (storedCheckout.result && storedCheckout.vehicle) {
          setResult(storedCheckout.result);
          setVehicle(storedCheckout.vehicle);
          setBuildMeta(storedCheckout.buildMeta || null);
          setCurrentScreen('build');
          return;
        }

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

  async function runBuildGeneration(vehicleData) {
    let nextResult = null;
    let aiErrorMessage = '';
    let strictVerificationFailed = false;
    setVehicle(vehicleData);
    setCurrentScreen('loading');
    setBuildMeta(null);

    const analytics = import('../services/analyticsService');
    analytics.then(({ trackBuildSearch }) => trackBuildSearch(vehicleData)).catch(() => {
      // Analytics no debe bloquear el flujo principal.
    });

    try {
      const { findVehicleKnowledgeResult } = await import('../services/firebaseBuildLibraryService');
      nextResult = await findVehicleKnowledgeResult(vehicleData);

      if (!nextResult) {
        nextResult = await generateAiBuild(vehicleData);
      }
    } catch (error) {
      if (error?.code === 'VEHICLE_VERIFICATION_FAILED') {
        strictVerificationFailed = true;
        aiErrorMessage =
          error.message ||
          'No se pudo verificar al 100% la variante exacta, asi que hemos mostrado una build orientativa.';
        analytics.then(({ trackBuildError }) => trackBuildError(error.message, error.code)).catch(() => {});
      } else {
        aiErrorMessage = error?.message || 'La IA no estuvo disponible en este intento.';
        analytics.then(({ trackBuildError }) => trackBuildError(aiErrorMessage, error?.code || 'AI_BUILD_FAILED')).catch(() => {});
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

    analytics.then(({ trackBuildResult }) => trackBuildResult(nextResult, vehicleData)).catch(() => {
      // Analytics no debe bloquear la experiencia principal.
    });

    try {
      const { logUserSearch } = await import('../services/firebaseBuildLibraryService');
      await logUserSearch(
        vehicleData,
        nextResult.source === 'database' || nextResult.source === 'thkb' ? nextResult.id : null,
        nextResult.source === 'database' || nextResult.source === 'thkb',
      );
    } catch (error) {
      // El log no debe bloquear la experiencia principal del usuario.
    }
  }

  async function handleBuildSearch(vehicleData) {
    const quotaResult = consumeFreeBuildSlot();
    setQuotaInfo(getQuotaSnapshot());

    if (!quotaResult.allowed) {
      setVehicle(vehicleData);
      setCurrentScreen('buildLimit');
      window.sessionStorage.setItem(
        PENDING_EXTRA_BUILD_STORAGE_KEY,
        JSON.stringify({ vehicle: vehicleData }),
      );
      return;
    }

    await runBuildGeneration(vehicleData);
  }

  function handleBackToForm() {
    setCurrentScreen('form');
  }

  function handleStartBuild() {
    setCurrentScreen('form');
  }

  function handleOpenOptimizedPlan() {
    if (!result) {
      return;
    }

    const vehicleName = getVehicleNameFromData(vehicle, result);

    window.sessionStorage.setItem(
      PENDING_CHECKOUT_STORAGE_KEY,
      JSON.stringify({
        checkoutType: 'plan_action',
        result,
        vehicle,
        buildMeta,
      }),
    );

    setCheckoutContext({
      checkoutType: 'plan_action',
      vehicleName,
      buildId: result.id,
    });
    setCurrentScreen('checkout');
  }

  function handleOpenExtraBuildCheckout() {
    if (!vehicle) {
      return;
    }

    window.sessionStorage.setItem(
      PENDING_CHECKOUT_STORAGE_KEY,
      JSON.stringify({
        checkoutType: 'extra_build',
      }),
    );
    window.sessionStorage.setItem(
      PENDING_EXTRA_BUILD_STORAGE_KEY,
      JSON.stringify({ vehicle }),
    );

    setCheckoutContext({
      checkoutType: 'extra_build',
      vehicleName: getVehicleNameFromData(vehicle),
      buildId: null,
    });
    setCurrentScreen('checkout');
  }

  async function handlePaymentActivated(sessionStatus) {
    const checkoutType = sessionStatus.checkoutType || checkoutContext?.checkoutType || 'plan_action';
    if (checkoutType === 'extra_build') {
      let storedExtraBuild = {};
      try { storedExtraBuild = JSON.parse(window.sessionStorage.getItem(PENDING_EXTRA_BUILD_STORAGE_KEY) || '{}'); } catch { storedExtraBuild = {}; }
      window.sessionStorage.removeItem(PENDING_CHECKOUT_STORAGE_KEY);
      window.sessionStorage.removeItem(PENDING_EXTRA_BUILD_STORAGE_KEY);
      if (storedExtraBuild.vehicle) {
        await runBuildGeneration(storedExtraBuild.vehicle);
        return;
      }
      setCurrentScreen('landing');
      return;
    }
    window.sessionStorage.removeItem(PENDING_CHECKOUT_STORAGE_KEY);
    setCurrentScreen(result && vehicle ? 'premium' : 'account');
  }

  return (
    <Suspense fallback={<section className="screen-shell"><div className="route-loading" role="status">Cargando Tuning Hub…</div></section>}>
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
            <button className="hero__account" type="button" onClick={() => setCurrentScreen('account')}>
              Mi cuenta
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
          <PremiumAuthBoundary>
          <ProtectedRoute area="premium" onBack={() => setCurrentScreen(result ? 'build' : 'landing')} onSubscriptionRequired={() => setCurrentScreen(result ? 'checkout' : 'landing')}>
            <PremiumOnboardingGate vehicle={vehicle}>
              <PremiumGarage vehicle={vehicle} onBack={() => setCurrentScreen('build')} />
            </PremiumOnboardingGate>
          </ProtectedRoute>
          </PremiumAuthBoundary>
        </section>
      ) : currentScreen === 'account' ? (
        <section className="screen-shell"><PremiumAuthBoundary><AccountPanel onBack={() => setCurrentScreen('landing')} /></PremiumAuthBoundary></section>
      ) : currentScreen === 'checkout' ? (
        <section className="screen-shell">
          <StripeCheckoutScreen
            checkoutType={checkoutContext?.checkoutType || 'plan_action'}
            buildId={checkoutContext?.buildId || result?.id}
            vehicleName={checkoutContext?.vehicleName || getVehicleNameFromData(vehicle, result)}
            onBack={() => setCurrentScreen(result ? 'build' : 'buildLimit')}
          />
        </section>
      ) : currentScreen === 'paymentResult' ? (
        <section className="screen-shell">
          <PremiumAuthBoundary>
          <PaymentActivationScreen
            sessionId={paymentSessionId}
            purchaseId={paymentPurchaseId}
            claimToken={paymentClaimToken}
            checkoutType={checkoutContext?.checkoutType || 'plan_action'}
            cancelled={paymentCancelled}
            onActivated={handlePaymentActivated}
            onRetry={() => setCurrentScreen('checkout')}
            onBack={() => setCurrentScreen(result ? 'build' : 'landing')}
          />
          </PremiumAuthBoundary>
        </section>
      ) : currentScreen === 'buildLimit' ? (
        <section className="screen-shell">
          <BuildLimitScreen
            vehicle={vehicle}
            quotaInfo={quotaInfo}
            onBack={() => setCurrentScreen('landing')}
            onPayExtraBuild={handleOpenExtraBuildCheckout}
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
    </Suspense>
  );
}

export default HomePage;
