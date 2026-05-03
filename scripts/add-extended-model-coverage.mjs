import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const projectRoot = path.resolve(path.dirname(__filename), '..');
const catalogPath = path.join(projectRoot, 'src', 'data', 'vehicleCatalog.json');

const fallbackGeneration = 'Generación por confirmar';
const coverage = {
  Abarth: ['Punto Evo', '600e'],
  Acura: ['ILX', 'Integra', 'Legend', 'MDX', 'NSX', 'RDX', 'RL', 'RLX', 'RSX', 'TL', 'TLX', 'TSX', 'ZDX'],
  Aiways: ['U5', 'U6'],
  Aixam: ['City', 'Coupe', 'Crossover', 'Crossline', 'Minauto', 'Scouty'],
  'Alfa Romeo': ['145', '146', '147', '155', '156', '164', '166', '4C', '8C Competizione', 'GT', 'GTV', 'Spider'],
  Alpine: ['A110', 'A290', 'GTA', 'A310', 'A610'],
  'Aston Martin': ['Cygnet', 'DB7', 'DB9', 'DB11', 'DB12', 'DBS', 'DBX', 'Rapide', 'V8 Vantage', 'V12 Vantage', 'Vanquish', 'Virage'],
  Audi: ['A2', 'A7', 'A8', 'Q4 e-tron', 'Q7', 'Q8', 'R8', 'RS4', 'RS5', 'RS6', 'RS7', 'S1', 'S4', 'S5', 'S6', 'S7', 'S8', 'SQ5', 'SQ7', 'e-tron GT'],
  BAIC: ['X35', 'X55', 'X7', 'EU5', 'BJ40'],
  Bentley: ['Arnage', 'Azure', 'Bentayga', 'Brooklands', 'Continental GT', 'Continental Flying Spur', 'Flying Spur', 'Mulsanne'],
  BMW: ['Serie 6', 'Serie 7', 'Serie 8', 'i3', 'i4', 'i5', 'i7', 'i8', 'iX', 'iX1', 'iX3', 'X2', 'X4', 'X6', 'X7', 'XM', 'Z3', 'M2', 'M3', 'M4', 'M5', 'M8'],
  Borgward: ['BX3', 'BX5', 'BX6', 'BX7'],
  BYD: ['Atto 2', 'Atto 3', 'Dolphin', 'Han', 'Seal', 'Seal U', 'Tang', 'Song Plus', 'Qin Plus', 'Yuan Plus'],
  Cadillac: ['ATS', 'BLS', 'CTS', 'CT4', 'CT5', 'CT6', 'DTS', 'Eldorado', 'Escalade', 'SRX', 'STS', 'XT4', 'XT5', 'XT6', 'XTS'],
  Chery: ['Arrizo 5', 'Arrizo 8', 'Tiggo 2', 'Tiggo 3', 'Tiggo 4', 'Tiggo 7', 'Tiggo 8', 'Omoda 5'],
  Chevrolet: ['Aveo', 'Blazer', 'Bolt', 'Camaro', 'Captiva', 'Corvette', 'Cruze', 'Epica', 'Evanda', 'Kalos', 'Lacetti', 'Malibu', 'Matiz', 'Nubira', 'Orlando', 'Spark', 'Tahoe', 'Trax', 'Volt'],
  Chrysler: ['200', '300C', 'Crossfire', 'Grand Voyager', 'Neon', 'PT Cruiser', 'Sebring', 'Voyager'],
  Citroen: ['AX', 'Berlingo', 'C-Crosser', 'C-Elysée', 'C-Zero', 'C3 Aircross', 'C3 Picasso', 'C4 Aircross', 'C4 Cactus', 'C4 Picasso', 'C5 Aircross', 'C6', 'C8', 'Nemo', 'SpaceTourer', 'Xantia', 'XM', 'ZX'],
  Cupra: ['Ateca', 'Born', 'Tavascan', 'Terramar'],
  Dacia: ['Dokker', 'Lodgy', 'Logan MCV', 'Logan Pick-Up', 'Solenza'],
  Daewoo: ['Espero', 'Kalos', 'Lacetti', 'Lanos', 'Leganza', 'Matiz', 'Nexia', 'Nubira', 'Tacuma'],
  Daihatsu: ['Applause', 'Charade', 'Copen', 'Cuore', 'Feroza', 'Materia', 'Move', 'Rocky', 'Sirion', 'Terios', 'Trevis', 'YRV'],
  Dodge: ['Avenger', 'Caliber', 'Challenger', 'Charger', 'Durango', 'Journey', 'Magnum', 'Neon', 'Nitro', 'Ram', 'Viper'],
  DR: ['DR 1.0', 'DR 3.0', 'DR 4.0', 'DR 5.0', 'DR 6.0', 'DR 7.0', 'F35'],
  'DS Automobiles': ['DS 3', 'DS 3 Crossback', 'DS 4', 'DS 5', 'DS 7', 'DS 9', 'Nº8'],
  Ferrari: ['296 GTB', '360 Modena', '430 Scuderia', '456', '458 Italia', '488 GTB', '550 Maranello', '575M', '599 GTB', '612 Scaglietti', '812 Superfast', 'California', 'F12berlinetta', 'F8 Tributo', 'FF', 'GTC4Lusso', 'Portofino', 'Purosangue', 'Roma', 'SF90 Stradale'],
  Fiat: ['500L', '500X', '600', 'Barchetta', 'Brava', 'Cinquecento', 'Croma', 'Doblo', 'Ducato', 'Freemont', 'Grande Punto', 'Idea', 'Linea', 'Marea', 'Multipla', 'Palio', 'Qubo', 'Scudo', 'Sedici', 'Seicento', 'Stilo', 'Ulysse'],
  Fisker: ['Karma', 'Ocean', 'Pear'],
  Ford: ['B-Max', 'Bronco', 'C-Max', 'Cougar', 'EcoSport', 'Edge', 'Explorer', 'Fusion', 'Galaxy', 'Ka', 'Maverick', 'Mustang', 'Mustang Mach-E', 'Probe', 'S-Max', 'StreetKa', 'Tourneo Connect', 'Tourneo Courier', 'Tourneo Custom'],
  Genesis: ['G70', 'G80', 'G90', 'GV60', 'GV70', 'GV80'],
  GMC: ['Acadia', 'Canyon', 'Hummer EV', 'Sierra', 'Terrain', 'Yukon'],
  'Great Wall': ['Coolbear', 'Florid', 'Hover', 'Ora 03', 'Poer', 'Steed', 'Wingle'],
  Honda: ['Accord', 'CR-V', 'CR-Z', 'City', 'Concerto', 'e', 'FR-V', 'HR-V', 'Insight', 'Integra', 'Jazz', 'Legend', 'Logo', 'NSX', 'Prelude', 'Stream'],
  Hummer: ['H2', 'H3'],
  Hyundai: ['Accent', 'Atos', 'Bayon', 'Coupe', 'Elantra', 'Genesis Coupe', 'Getz', 'Ioniq', 'Ioniq 5', 'Ioniq 6', 'Kona', 'Matrix', 'Nexo', 'Santa Fe', 'Sonata', 'Terracan', 'Trajet', 'Tucson', 'i10', 'i40', 'ix20', 'ix35'],
  Infiniti: ['EX', 'FX', 'G', 'M', 'Q30', 'Q50', 'Q60', 'Q70', 'QX30', 'QX50', 'QX60', 'QX70'],
  Isuzu: ['D-Max', 'Gemini', 'MU-X', 'Trooper'],
  Iveco: ['Daily'],
  Jaguar: ['E-Pace', 'F-Pace', 'F-Type', 'I-Pace', 'S-Type', 'X-Type', 'XE', 'XF', 'XJ', 'XK'],
  Jeep: ['Avenger', 'Cherokee', 'Commander', 'Compass', 'Gladiator', 'Grand Cherokee', 'Patriot', 'Renegade', 'Wrangler'],
  Kia: ['Carens', 'Carnival', 'Ceed', 'Cerato', 'EV3', 'EV5', 'EV6', 'EV9', 'Magentis', 'Niro', 'Opirus', 'Optima', 'Picanto', 'ProCeed', 'Rio', 'Sephia', 'Shuma', 'Sorento', 'Soul', 'Sportage', 'Stinger', 'Stonic', 'Venga', 'XCeed'],
  KTM: ['X-Bow'],
  Lada: ['Granta', 'Kalina', 'Niva', 'Priora', 'Vesta'],
  Lamborghini: ['Aventador', 'Gallardo', 'Huracan', 'Murcielago', 'Revuelto', 'Urus'],
  Lancia: ['Delta', 'Flavia', 'Kappa', 'Lybra', 'Musa', 'Phedra', 'Thema', 'Thesis', 'Voyager', 'Ypsilon'],
  'Land Rover': ['Defender', 'Discovery', 'Discovery Sport', 'Freelander', 'Range Rover', 'Range Rover Evoque', 'Range Rover Sport', 'Range Rover Velar'],
  Lexus: ['CT', 'ES', 'GS', 'GX', 'IS', 'LBX', 'LC', 'LM', 'LS', 'NX', 'RC', 'RX', 'RZ', 'SC', 'UX'],
  Lincoln: ['Aviator', 'Continental', 'Corsair', 'MKC', 'MKS', 'MKT', 'MKX', 'MKZ', 'Navigator', 'Nautilus'],
  Lotus: ['Elise', 'Emira', 'Esprit', 'Europa', 'Evora', 'Exige', 'Eletre'],
  Lucid: ['Air', 'Gravity'],
  LynkAndCo: ['01', '02', '03', '05', '08'],
  Maserati: ['3200 GT', 'Coupe', 'Ghibli', 'GranCabrio', 'GranTurismo', 'Grecale', 'Levante', 'MC20', 'Quattroporte', 'Spyder'],
  Mazda: ['2', '3', '5', '6', '121', '323', '626', 'CX-3', 'CX-30', 'CX-5', 'CX-7', 'CX-60', 'CX-80', 'Demio', 'MX-30', 'MX-6', 'Premacy', 'Tribute', 'Xedos 6', 'Xedos 9'],
  McLaren: ['540C', '570S', '600LT', '650S', '675LT', '720S', '750S', 'Artura', 'GT', 'MP4-12C', 'P1', 'Senna'],
  'Mercedes-Benz': ['AMG GT', 'Clase B', 'Clase E', 'Clase G', 'Clase M', 'Clase R', 'Clase S', 'CL', 'CLC', 'CLK', 'CLS', 'EQA', 'EQB', 'EQC', 'EQE', 'EQS', 'GL', 'GLA', 'GLB', 'GLC', 'GLE', 'GLK', 'GLS', 'SL', 'SLC', 'SLK', 'Viano', 'Vito'],
  MG: ['3', '4', '5', 'Cyberster', 'EHS', 'HS', 'Marvel R', 'MGF', 'TF', 'ZR', 'ZS', 'ZT'],
  MINI: ['Clubman', 'Countryman', 'Coupe', 'Paceman', 'Roadster'],
  Mitsubishi: ['3000GT', 'ASX', 'Carisma', 'Colt', 'Eclipse', 'Eclipse Cross', 'Galant', 'Grandis', 'i-MiEV', 'L200', 'Lancer', 'Montero', 'Outlander', 'Pajero', 'Space Star'],
  Morgan: ['3 Wheeler', '4/4', 'Aero 8', 'Plus Four', 'Plus Six', 'Roadster'],
  Nissan: ['Almera', 'Ariya', 'Cube', 'Juke', 'Leaf', 'Micra', 'Murano', 'Navara', 'Note', 'Pathfinder', 'Patrol', 'Primera', 'Pulsar', 'Qashqai', 'Sunny', 'Terrano', 'X-Trail'],
  Opel: ['Adam', 'Agila', 'Ampera', 'Antara', 'Calibra', 'Cascada', 'Combo', 'Crossland', 'Frontera', 'Grandland', 'Karl', 'Meriva', 'Mokka', 'Omega', 'Signum', 'Speedster', 'Tigra', 'Vectra', 'Vivaro', 'Zafira'],
  Pagani: ['Huayra', 'Utopia', 'Zonda'],
  Peugeot: ['1007', '107', '108', '2008', '3008', '301', '306', '307', '4007', '4008', '407', '5008', '508', '607', '807', 'Bipper', 'Expert', 'Partner', 'Rifter'],
  Polestar: ['1', '2', '3', '4', '5'],
  Pontiac: ['Firebird', 'G8', 'Solstice', 'Trans Am', 'Vibe'],
  Porsche: ['718 Boxster', '718 Cayman', 'Boxster', 'Carrera GT', 'Cayman', 'Panamera', 'Taycan'],
  Renault: ['Arkana', 'Austral', 'Avantime', 'Captur', 'Espace', 'Fluence', 'Kadjar', 'Kangoo', 'Koleos', 'Laguna', 'Latitude', 'Modus', 'Rafale', 'Safrane', 'Scenic', 'Talisman', 'Trafic', 'Twingo', 'Vel Satis', 'Zoe'],
  Rivian: ['R1S', 'R1T'],
  Rover: ['25', '45', '75', 'Streetwise'],
  Saab: ['9-3', '9-5', '900', '9000'],
  SEAT: ['Alhambra', 'Altea', 'Arona', 'Arosa', 'Ateca', 'Cordoba', 'Exeo', 'Mii', 'Tarraco'],
  Skoda: ['Citigo', 'Enyaq', 'Kamiq', 'Karoq', 'Kodiaq', 'Kushaq', 'Praktik', 'Rapid', 'Roomster', 'Scala', 'Yeti'],
  Smart: ['#1', '#3', 'Forfour', 'Fortwo', 'Roadster'],
  SsangYong: ['Actyon', 'Korando', 'Kyron', 'Musso', 'Rexton', 'Rodius', 'Tivoli', 'Torres', 'XLV'],
  Subaru: ['Ascent', 'BRZ', 'Forester', 'Justy', 'Legacy', 'Levorg', 'Outback', 'SVX', 'Solterra', 'Tribeca', 'WRX', 'XV'],
  Suzuki: ['Across', 'Alto', 'Baleno', 'Cappuccino', 'Celerio', 'Grand Vitara', 'Ignis', 'Jimny', 'Kizashi', 'Liana', 'S-Cross', 'Samurai', 'Splash', 'Swift', 'SX4', 'Vitara', 'Wagon R+'],
  Tesla: ['Model 3', 'Model S', 'Model X', 'Model Y', 'Roadster'],
  Toyota: ['Auris', 'Aygo', 'bZ4X', 'Camry', 'C-HR', 'Corolla Cross', 'GR Yaris', 'Highlander', 'Hilux', 'iQ', 'Land Cruiser', 'MR2', 'Prius', 'Prius+', 'Proace', 'RAV4', 'Starlet', 'Urban Cruiser', 'Verso'],
  Vauxhall: ['Adam', 'Astra', 'Corsa', 'Grandland', 'Insignia', 'Mokka', 'Vectra', 'Vivaro', 'Zafira'],
  Volkswagen: ['Amarok', 'Beetle', 'Bora', 'Caddy', 'CC', 'Corrado', 'Eos', 'Fox', 'ID.5', 'ID.7', 'Jetta', 'Lupo', 'New Beetle', 'Phaeton', 'Sharan', 'Taigo', 'Touran', 'T-Cross', 'Tayron', 'Transporter', 'Vento'],
  Volvo: ['240', '440', '460', '480', '740', '760', '850', '940', '960', 'C30', 'C40', 'C70', 'EX30', 'EX40', 'EX90', 'S40', 'S60', 'S70', 'S80', 'S90', 'V40', 'V50', 'V60', 'V70', 'V90', 'XC40', 'XC60', 'XC70', 'XC90'],
  Wiesmann: ['MF3', 'MF4', 'MF5', 'Project Thunderball'],
};

function normalize(value) {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

function addUnique(list, value) {
  if (value && !list.includes(value)) {
    list.push(value);
  }
}

function hasModel(models, model) {
  const key = normalize(model);
  return models.some((currentModel) => normalize(currentModel) === key);
}

const catalog = JSON.parse(await readFile(catalogPath, 'utf8'));
let addedModels = 0;

for (const [brand, models] of Object.entries(coverage)) {
  addUnique(catalog.brands, brand);
  catalog.models[brand] ??= [];
  catalog.variants[brand] ??= {};

  for (const model of models) {
    if (hasModel(catalog.models[brand], model)) {
      continue;
    }

    catalog.models[brand].push(model);
    catalog.variants[brand][model] = {
      genericVehicle: true,
      generations: [fallbackGeneration],
      engines: [],
      generationEngines: {},
      generationEngineMeta: {},
    };

    addedModels += 1;
  }
}

await writeFile(catalogPath, `${JSON.stringify(catalog, null, 2)}\n`, 'utf8');
console.log(`Modelos añadidos: ${addedModels}`);
