import audiA18XWorkshop from '../assets/vehicles/audi-a1-8x-workshop.png';
import audiA1GbWorkshop from '../assets/vehicles/audi-a1-gb-workshop.png';
import audiA38LWorkshop from '../assets/vehicles/audi-a3-8l-workshop.png';
import audiA38PWorkshop from '../assets/vehicles/audi-a3-8p-workshop.png';
import audiA38VWorkshop from '../assets/vehicles/audi-a3-8v-workshop.png';
import audiA38YWorkshop from '../assets/vehicles/audi-a3-8y-workshop.png';
import audiA4B5Workshop from '../assets/vehicles/audi-a4-b5-workshop.png';
import audiA4B6Workshop from '../assets/vehicles/audi-a4-b6-workshop.png';
import audiA4B7Workshop from '../assets/vehicles/audi-a4-b7-workshop.png';
import audiA4B8Workshop from '../assets/vehicles/audi-a4-b8-workshop.png';
import audiA4B9Workshop from '../assets/vehicles/audi-a4-b9-workshop.png';

const BRAND_THEMES = {
  Audi: { start: '#7c8a99', end: '#1f242b' },
  BMW: { start: '#4aa8ff', end: '#0f1824' },
  Volkswagen: { start: '#4f7cff', end: '#0b1430' },
  'Mercedes-Benz': { start: '#c9d3de', end: '#202832' },
  Cupra: { start: '#c89964', end: '#241813' },
  SEAT: { start: '#ef4c3e', end: '#261012' },
  Skoda: { start: '#72d08b', end: '#132319' },
  Renault: { start: '#ffce47', end: '#2a210d' },
  Peugeot: { start: '#cfd5dd', end: '#1e232b' },
  Opel: { start: '#ffd44f', end: '#302509' },
  Mini: { start: '#d8b589', end: '#2d2013' },
  Volvo: { start: '#82a8c5', end: '#13202a' },
  'Ford Europe': { start: '#4f8fff', end: '#0f1d36' },
};

const DEFAULT_THEME = { start: '#ff7a1a', end: '#151c25' };

const VEHICLE_PHOTOS = {
  'audi|a1|8x': audiA18XWorkshop,
  'audi|a1|gb': audiA1GbWorkshop,
  'audi|a3|8l': audiA38LWorkshop,
  'audi|a3|8p': audiA38PWorkshop,
  'audi|a3|8v': audiA38VWorkshop,
  'audi|a3|8y': audiA38YWorkshop,
  'audi|a4|b5': audiA4B5Workshop,
  'audi|a4|b6': audiA4B6Workshop,
  'audi|a4|b7': audiA4B7Workshop,
  'audi|a4|b8': audiA4B8Workshop,
  'audi|a4|b9': audiA4B9Workshop,
};

function normalizeVehicleToken(value) {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function buildVehiclePhotoKey({ brand, model, generation }) {
  return [brand, model, generation].map(normalizeVehicleToken).join('|');
}

export function getVehiclePhoto(vehicle) {
  if (!vehicle?.brand || !vehicle?.model || !vehicle?.generation) {
    return null;
  }

  return VEHICLE_PHOTOS[buildVehiclePhotoKey(vehicle)] ?? null;
}

function escapeSvg(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function inferBodyStyle(model = '') {
  const normalized = model.toLowerCase();

  if (
    normalized.includes('q') ||
    normalized.includes('x') ||
    normalized.includes('xc') ||
    normalized.includes('sport') ||
    normalized.includes('kuga') ||
    normalized.includes('tiguan') ||
    normalized.includes('touareg') ||
    normalized.includes('formentor') ||
    normalized.includes('ateca') ||
    normalized.includes('arona') ||
    normalized.includes('kodiaq') ||
    normalized.includes('kamiq') ||
    normalized.includes('captur') ||
    normalized.includes('austral') ||
    normalized.includes('duster') ||
    normalized.includes('jogger') ||
    normalized.includes('defender') ||
    normalized.includes('discovery') ||
    normalized.includes('evoque') ||
    normalized.includes('velar') ||
    normalized.includes('stelvio') ||
    normalized.includes('tonale')
  ) {
    return 'suv';
  }

  if (
    normalized.includes('tt') ||
    normalized.includes('z4') ||
    normalized.includes('boxster') ||
    normalized.includes('cayman') ||
    normalized.includes('spider') ||
    normalized.includes('coupe') ||
    normalized.includes('brera') ||
    normalized.includes('rcz') ||
    normalized.includes('f-type')
  ) {
    return 'coupe';
  }

  if (
    normalized.includes('a4') ||
    normalized.includes('a5') ||
    normalized.includes('a6') ||
    normalized.includes('serie 3') ||
    normalized.includes('serie 5') ||
    normalized.includes('clase c') ||
    normalized.includes('clase e') ||
    normalized.includes('giulia') ||
    normalized.includes('s40') ||
    normalized.includes('s60') ||
    normalized.includes('s90') ||
    normalized.includes('passat') ||
    normalized.includes('arteon') ||
    normalized.includes('octavia') ||
    normalized.includes('superb') ||
    normalized.includes('laguna') ||
    normalized.includes('mondeo')
  ) {
    return 'sedan';
  }

  return 'hatch';
}

function createSilhouette(bodyStyle) {
  if (bodyStyle === 'suv') {
    return `
      <path d="M85 224 L126 172 Q142 156 170 154 L274 147 Q327 145 357 170 L420 224 Z" fill="rgba(255,255,255,0.15)" />
      <path d="M103 224 L139 180 Q149 169 169 167 L270 160 Q317 158 345 180 L394 224" fill="none" stroke="rgba(255,255,255,0.78)" stroke-width="6" stroke-linejoin="round" />
    `;
  }

  if (bodyStyle === 'coupe') {
    return `
      <path d="M76 224 L132 194 Q163 154 216 154 L275 158 Q310 161 337 181 L402 224 Z" fill="rgba(255,255,255,0.14)" />
      <path d="M92 224 L142 194 Q171 166 216 166 L272 170 Q304 172 331 190 L380 224" fill="none" stroke="rgba(255,255,255,0.82)" stroke-width="6" stroke-linejoin="round" />
    `;
  }

  if (bodyStyle === 'sedan') {
    return `
      <path d="M72 224 L124 194 Q149 164 194 162 L286 162 Q332 163 367 190 L423 224 Z" fill="rgba(255,255,255,0.14)" />
      <path d="M92 224 L138 194 Q162 174 194 174 L286 174 Q327 176 357 194 L398 224" fill="none" stroke="rgba(255,255,255,0.8)" stroke-width="6" stroke-linejoin="round" />
    `;
  }

  return `
    <path d="M78 224 L128 188 Q154 164 197 162 L272 162 Q314 164 349 190 L416 224 Z" fill="rgba(255,255,255,0.14)" />
    <path d="M94 224 L140 190 Q163 176 197 175 L272 175 Q310 177 343 194 L393 224" fill="none" stroke="rgba(255,255,255,0.8)" stroke-width="6" stroke-linejoin="round" />
  `;
}

function createFallbackSvg({ brand, model, generation, engine }) {
  const theme = BRAND_THEMES[brand] ?? DEFAULT_THEME;
  const title = [brand, model].filter(Boolean).join(' ');
  const subtitle = [generation, engine].filter(Boolean).join('  |  ') || 'Build visual';
  const silhouette = createSilhouette(inferBodyStyle(model));

  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 320" role="img" aria-label="${escapeSvg(title)}">
      <defs>
        <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="${theme.start}" />
          <stop offset="100%" stop-color="${theme.end}" />
        </linearGradient>
      </defs>

      <rect width="512" height="320" rx="28" fill="url(#bg)" />
      <circle cx="408" cy="78" r="88" fill="rgba(255,255,255,0.08)" />
      <circle cx="98" cy="32" r="94" fill="rgba(255,122,26,0.12)" />
      <rect x="0" y="236" width="512" height="84" fill="rgba(4,7,11,0.32)" />
      <path d="M0 250 H512" stroke="rgba(255,255,255,0.08)" stroke-width="2" />

      ${silhouette}

      <circle cx="162" cy="224" r="28" fill="#0e131a" stroke="rgba(255,255,255,0.32)" stroke-width="4" />
      <circle cx="356" cy="224" r="28" fill="#0e131a" stroke="rgba(255,255,255,0.32)" stroke-width="4" />
      <circle cx="162" cy="224" r="10" fill="rgba(255,255,255,0.25)" />
      <circle cx="356" cy="224" r="10" fill="rgba(255,255,255,0.25)" />

      <text x="34" y="58" fill="rgba(255,255,255,0.72)" font-size="18" font-family="Trebuchet MS, Segoe UI, sans-serif" letter-spacing="2">TUNING HUB</text>
      <text x="34" y="266" fill="#ffffff" font-size="30" font-weight="700" font-family="Trebuchet MS, Segoe UI, sans-serif">${escapeSvg(title)}</text>
      <text x="34" y="292" fill="rgba(255,255,255,0.72)" font-size="16" font-family="Trebuchet MS, Segoe UI, sans-serif">${escapeSvg(subtitle)}</text>
    </svg>
  `;

  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
}

export function getVehicleImage(vehicle) {
  return getVehiclePhoto(vehicle) ?? createFallbackSvg(vehicle ?? {});
}
