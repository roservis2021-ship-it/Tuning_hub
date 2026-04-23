import alloyWheel from '../assets/parts/alloy-wheel.png';
import brakeKit from '../assets/parts/brake-kit.png';
import catbackExhaust from '../assets/parts/catback-exhaust.png';
import clutchKit from '../assets/parts/clutch-kit.png';
import coiloverKit from '../assets/parts/coilover-kit.png';
import downpipe from '../assets/parts/downpipe.png';
import ecuModule from '../assets/parts/ecu-module.png';
import fuelPump from '../assets/parts/fuel-pump.png';
import intakeKit from '../assets/parts/intake-kit.png';
import intercooler from '../assets/parts/intercooler.png';
import performanceTire from '../assets/parts/performance-tire.png';
import turbocharger from '../assets/parts/turbocharger.png';

const PART_VISUALS = [
  {
    key: 'ecu',
    label: 'Repro ECU',
    imageSrc: ecuModule,
    patterns: ['repro', 'ecu', 'centralita', 'mapa motor', 'stage 1'],
  },
  {
    key: 'intake',
    label: 'Admision',
    imageSrc: intakeKit,
    patterns: ['admision', 'admission', 'intake', 'filtro', 'airbox', 'cai'],
  },
  {
    key: 'intercooler',
    label: 'Intercooler',
    imageSrc: intercooler,
    patterns: ['intercooler'],
  },
  {
    key: 'downpipe',
    label: 'Downpipe',
    imageSrc: downpipe,
    patterns: ['downpipe'],
  },
  {
    key: 'exhaust',
    label: 'Escape',
    imageSrc: catbackExhaust,
    patterns: ['escape', 'cat-back', 'cat back', 'exhaust', 'silencioso'],
  },
  {
    key: 'coilover',
    label: 'Suspension',
    imageSrc: coiloverKit,
    patterns: ['roscada', 'coilover', 'suspension', 'amortiguador', 'muelles'],
  },
  {
    key: 'brakes',
    label: 'Frenos',
    imageSrc: brakeKit,
    patterns: ['freno', 'disco', 'pastilla', 'latiguillo', 'caliper', 'pinza'],
  },
  {
    key: 'clutch',
    label: 'Embrague',
    imageSrc: clutchKit,
    patterns: ['embrague', 'clutch', 'volante motor', 'flywheel'],
  },
  {
    key: 'turbo',
    label: 'Turbo',
    imageSrc: turbocharger,
    patterns: ['turbo', 'k03', 'k04', 'hybrid turbo', 'turbocharger'],
  },
  {
    key: 'wheel',
    label: 'Llantas',
    imageSrc: alloyWheel,
    patterns: ['llanta', 'wheel', 'rim'],
  },
  {
    key: 'tire',
    label: 'Neumaticos',
    imageSrc: performanceTire,
    patterns: ['neumatico', 'neumatico', 'tire', 'tyre', 'semi slick'],
  },
  {
    key: 'fuel-pump',
    label: 'Bomba gasolina',
    imageSrc: fuelPump,
    patterns: ['bomba', 'fuel pump', 'high flow pump', 'bomba de alta'],
  },
];

function normalizePartName(value) {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

export function getPartVisual(partName) {
  const normalized = normalizePartName(partName);
  return PART_VISUALS.find((visual) => visual.patterns.some((pattern) => normalized.includes(pattern))) ?? null;
}
