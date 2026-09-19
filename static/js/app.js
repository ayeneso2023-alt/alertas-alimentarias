/**
 * app.js - Global Food Safety & Food Fraud Intelligence Dashboard
 * Lógica de cliente, reactividad de filtros, gráficos interactivos con Chart.js y tabla de alertas.
 */

// Estado global de la aplicación
let allAlerts = [];
let filteredAlerts = [];
let currentPage = 1;
let pageSize = 25;
let countryChartMode = 'notif'; // 'notif' or 'origin'

// Instancias de Chart.js
let chartMonthlyInstance = null;
let chartTypesInstance = null;
let chartCountriesInstance = null;

// Inicialización con datos precargados si están disponibles
if (window.INITIAL_ALERTS_DATA && Array.isArray(window.INITIAL_ALERTS_DATA) && window.INITIAL_ALERTS_DATA.length > 0) {
  allAlerts = [...window.INITIAL_ALERTS_DATA];
}

document.addEventListener('DOMContentLoaded', async () => {
  // Renderizado instantáneo si ya tenemos datos
  if (allAlerts.length > 0) {
    populateFilterOptions();
    applyFilters();
  }

  if (window.lucide) {
    window.lucide.createIcons();
  }

  await fetchInitialData();
  setupEventListeners();
});

async function fetchInitialData() {
  const ts = Date.now();
  const endpoints = [
    `/api/alerts?t=${ts}`,
    `data/alerts.json?t=${ts}`,
    `./data/alerts.json?t=${ts}`,
    `static/data/alerts.json?t=${ts}`,
    'data/alerts.json',
    'static/data/alerts.json'
  ];
  let loaded = false;

  for (const ep of endpoints) {
    try {
      const res = await fetch(ep, {
        cache: 'no-store',
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache'
        }
      });
      if (res.ok) {
        const fetchedData = await res.json();
        if (Array.isArray(fetchedData) && fetchedData.length > 0) {
          allAlerts = fetchedData;
          loaded = true;
          console.log(`[INFO] Datos actualizados desde ${ep} (${allAlerts.length} alertas)`);
          populateFilterOptions();
          applyFilters();
          break;
        }
      }
    } catch (e) {
      // Intenta siguiente endpoint si fetch falla
    }
  }

  if (!loaded && allAlerts.length === 0 && window.INITIAL_ALERTS_DATA) {
    allAlerts = window.INITIAL_ALERTS_DATA;
    populateFilterOptions();
    applyFilters();
  }
}

function populateFilterOptions() {
  const yearSelect = document.getElementById('filterYear');
  const countrySelect = document.getElementById('filterCountry');
  const monthSelect = document.getElementById('filterMonth');

  const years = new Set(['2026', '2025', '2024']);
  const countries = new Set();
  const months = new Set();

  allAlerts.forEach(a => {
    const y = (a.fecha_notificacion || a.mes_ano || '').substring(0, 4);
    if (['2024', '2025', '2026'].includes(y)) years.add(y);
    if (a.pais_notificador) countries.add(a.pais_notificador);
    if (a.pais_origen) countries.add(a.pais_origen);
    
    const m = a.mes_ano || (a.fecha_notificacion ? a.fecha_notificacion.substring(0, 7) : null);
    if (m) months.add(m);
  });

  // Populate years (2026, 2025, 2024)
  if (yearSelect) {
    const currentYear = yearSelect.value || 'all';
    yearSelect.innerHTML = `
      <option value="all">Todos los años (2024 - 2026)</option>
      <option value="2026">2026</option>
      <option value="2025">2025</option>
      <option value="2024">2024</option>
    `;
    if (currentYear) yearSelect.value = currentYear;
  }

  // Populate countries
  const sortedCountries = Array.from(countries).sort();
  countrySelect.innerHTML = '<option value="all">Todos los países</option>';
  sortedCountries.forEach(c => {
    const opt = document.createElement('option');
    opt.value = c;
    opt.textContent = c;
    countrySelect.appendChild(opt);
  });

  // Populate months
  updateMonthOptions();
}

function onYearChange() {
  updateMonthOptions();
  applyFilters();
}

function updateMonthOptions() {
  const yearSelect = document.getElementById('filterYear');
  const monthSelect = document.getElementById('filterMonth');
  if (!monthSelect) return;

  const selectedYear = yearSelect ? yearSelect.value : 'all';
  const currentMonthVal = monthSelect.value;
  const months = new Set();

  allAlerts.forEach(a => {
    const m = a.mes_ano || (a.fecha_notificacion ? a.fecha_notificacion.substring(0, 7) : null);
    if (m) {
      if (selectedYear === 'all' || m.startsWith(selectedYear)) {
        months.add(m);
      }
    }
  });

  const sortedMonths = Array.from(months).sort().reverse();
  monthSelect.innerHTML = '<option value="all">Todos los meses</option>';
  sortedMonths.forEach(m => {
    const opt = document.createElement('option');
    opt.value = m;
    const [year, month] = m.split('-');
    const dateObj = new Date(parseInt(year), parseInt(month) - 1, 1);
    const monthName = dateObj.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' });
    opt.textContent = monthName.charAt(0).toUpperCase() + monthName.slice(1);
    monthSelect.appendChild(opt);
  });

  if (currentMonthVal && (selectedYear === 'all' || currentMonthVal.startsWith(selectedYear))) {
    monthSelect.value = currentMonthVal;
  }
}

// ---------------- MOTOR DE BÚSQUEDA MULTILINGÜE Y SINÓNIMOS ----------------
// Permite que la búsqueda de producto, lote, motivo o país funcione
// en cualquier idioma (Español, Inglés, Alemán, Francés, Italiano, Portugués, etc.)
// Ej. Buscar "vino", "wine", "wein", "vin", "vinho" encuentra todas las alertas vinícolas.

function normalizeSearchText(str) {
  if (!str) return '';
  return str.toString()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9\s_-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

const MULTILINGUAL_SYNONYM_GROUPS = [
  // Vinos y Bebidas Alcohólicas
  ['vino', 'vinos', 'wine', 'wines', 'wein', 'weine', 'vin', 'vins', 'vinho', 'vinhos', 'wijn', 'wijnen', 'wino'],
  ['vino blanco', 'white wine', 'weisswein', 'weißwein', 'vin blanc', 'vino bianco', 'vinho branco', 'witte wijn'],
  ['vino tinto', 'red wine', 'rotwein', 'vin rouge', 'vino rosso', 'vinho tinto', 'rode wijn'],
  ['vino rosado', 'rose wine', 'rosé wine', 'rosewein', 'roséwein', 'vin rosé', 'vino rosato', 'vinho rosé'],
  ['vino espumoso', 'sparkling wine', 'schaumwein', 'sekt', 'vin pétillant', 'champagne', 'prosecco', 'cava'],
  ['vino de cocina', 'cooking wine', 'kochwein', 'vin de cuisine'],
  ['cerveza', 'cervezas', 'beer', 'beers', 'bier', 'biere', 'bière', 'birra', 'birre', 'cerveja', 'cervejas'],
  ['licor', 'licores', 'liquor', 'liqueur', 'liqueurs', 'likör', 'likor', 'spirit', 'spirits', 'spirituose', 'spirituosen', 'destilado'],
  ['sidra', 'cider', 'cidre', 'apfelwein', 'sidro'],
  ['bebida', 'bebidas', 'beverage', 'beverages', 'drink', 'drinks', 'getränk', 'getrank', 'getränke', 'boisson', 'boissons', 'bevanda', 'bevande'],
  ['zumo', 'jugo', 'zumos', 'jugos', 'juice', 'juices', 'saft', 'säfte', 'jus', 'succo', 'succos', 'suco', 'sucos'],

  // Aceites y Grasas
  ['aceite', 'aceites', 'oil', 'oils', 'öl', 'öle', 'oel', 'oele', 'huile', 'huiles', 'olio', 'olii', 'azeite', 'azeites', 'olie'],
  ['aceite de oliva', 'olive oil', 'olivenöl', 'olivenoel', 'huile d olive', 'olio d oliva', 'azeite de oliva', 'olijfolie', 'aove', 'evoo'],
  ['girasol', 'aceite de girasol', 'sunflower', 'sunflower oil', 'sonnenblume', 'sonnenblumenöl', 'tournesol', 'girasole'],
  ['palma', 'aceite de palma', 'palm oil', 'palmfett', 'huile de palme', 'olio di palma', 'dende'],
  ['colza', 'canola', 'rapeseed', 'rapeseed oil', 'raps', 'rapsöl', 'huile de colza'],
  ['orujo', 'pomace', 'pomace oil', 'trester', 'tresteröl', 'sansa', 'olio di sansa', 'bagaço'],

  // Miel y Endulzantes
  ['miel', 'mieles', 'honey', 'honeys', 'honig', 'miele', 'mel'],
  ['sirope', 'jarabe', 'syrup', 'syrups', 'sirup', 'sirop', 'sciroppo', 'xarope'],
  ['azucar', 'azúcar', 'sugar', 'zucker', 'sucre', 'zucchero', 'acucar', 'açúcar'],
  ['jalea real', 'royal jelly', 'gelée royale', 'gelee royale', 'weiselfuttersaft', 'pappa reale', 'geleia real'],

  // Pescados y Mariscos
  ['pescado', 'pescados', 'fish', 'fishes', 'fisch', 'fische', 'poisson', 'poissons', 'pesce', 'pesci', 'peixe', 'peixes', 'vis', 'ryba'],
  ['atun', 'atún', 'tuna', 'tunas', 'thunfisch', 'thon', 'tonno', 'atum'],
  ['salmon', 'salmón', 'salmon', 'salmons', 'lachs', 'saumon', 'salmone', 'salmão', 'salmao'],
  ['marisco', 'mariscos', 'seafood', 'shellfish', 'meeresfrüchte', 'meeresfruechte', 'fruits de mer', 'frutti di mare', 'frutos do mar'],
  ['gamba', 'gambas', 'langostino', 'langostinos', 'shrimp', 'shrimps', 'prawn', 'prawns', 'garnele', 'garnelen', 'crevette', 'crevettes', 'gambero', 'gamberi', 'camarão'],
  ['mejillon', 'mejillón', 'mejillones', 'mussel', 'mussels', 'muschel', 'muscheln', 'moule', 'moules', 'cozza', 'cozze', 'mexilhão'],
  ['almeja', 'almejas', 'clam', 'clams', 'muschel', 'palourde', 'vongola', 'vongole', 'amêijoa'],
  ['calamar', 'calamares', 'squid', 'squids', 'tintenfisch', 'calmar', 'calamaro', 'calamari', 'lula'],
  ['pulpo', 'pulpos', 'octopus', 'octopuses', 'oktopus', 'kraken', 'poulpe', 'polpo', 'polpi', 'polvo'],
  ['bacalao', 'cod', 'kabeljau', 'dorsch', 'morue', 'cabillaud', 'merluzzo', 'bacalhau'],
  ['anchoa', 'anchoas', 'anchovy', 'anchovies', 'sardelle', 'sardellen', 'anchois', 'acciuga', 'acciughe', 'anchova'],
  ['sardina', 'sardinas', 'sardine', 'sardines', 'sardine', 'sardina', 'sardinha'],
  ['merluza', 'hake', 'seehecht', 'merlu', 'nasello', 'pescada'],

  // Carnes y Aves
  ['carne', 'carnes', 'meat', 'meats', 'fleisch', 'viande', 'viandes', 'carni', 'vlees', 'mieso'],
  ['pollo', 'pollos', 'chicken', 'chickens', 'huhn', 'hähnchen', 'haehnchen', 'hühnerfleisch', 'poulet', 'frango'],
  ['cerdo', 'cerdos', 'porcino', 'pork', 'swine', 'pig', 'schwein', 'schweinefleisch', 'porc', 'maiale', 'porco', 'varkensvlees'],
  ['ternera', 'vaca', 'buey', 'res', 'vacuno', 'bovino', 'beef', 'bovine', 'cattle', 'rind', 'rindfleisch', 'boeuf', 'bœuf', 'manzo', 'rundvlees'],
  ['pavo', 'turkey', 'truthahn', 'putenfleisch', 'dinde', 'tacchino', 'peru'],
  ['cordero', 'lamb', 'mutton', 'lamm', 'lammfleisch', 'agneau', 'agnello', 'cordeiro'],
  ['embutido', 'embutidos', 'salchicha', 'salchichas', 'sausage', 'sausages', 'wurst', 'würstchen', 'saucisse', 'salsiccia', 'enchido'],
  ['jamon', 'jamón', 'ham', 'schinken', 'jambon', 'prosciutto', 'presunto'],

  // Lácteos y Quesos
  ['queso', 'quesos', 'cheese', 'cheeses', 'käse', 'kaese', 'fromage', 'fromages', 'formaggio', 'formaggi', 'queijo', 'queijos', 'kaas', 'ser'],
  ['leche', 'milk', 'milch', 'lait', 'latte', 'leite', 'melk', 'mleko'],
  ['yogur', 'yogurt', 'yoghurt', 'joghurt', 'yaourt', 'iogurte'],
  ['mantequilla', 'butter', 'beurre', 'burro', 'manteiga', 'boter'],
  ['nata', 'crema de leche', 'cream', 'sahne', 'crème', 'creme', 'panna', 'natas', 'room'],

  // Frutas, Verduras y Hortalizas
  ['fruta', 'frutas', 'fruit', 'fruits', 'frucht', 'früchte', 'fruechte', 'obst', 'frutto', 'frutti'],
  ['verdura', 'verduras', 'hortaliza', 'hortalizas', 'vegetal', 'vegetales', 'vegetable', 'vegetables', 'gemüse', 'gemuese', 'légume', 'legumes', 'groente'],
  ['manzana', 'manzanas', 'apple', 'apples', 'apfel', 'äpfel', 'aepfel', 'pomme', 'pommes', 'mela', 'mele', 'maçã', 'maca'],
  ['fresa', 'fresas', 'fresón', 'strawberry', 'strawberries', 'erdbeere', 'erdbeeren', 'fraise', 'fraises', 'fragola', 'fragole', 'morango'],
  ['platano', 'plátano', 'plátanos', 'banana', 'bananas', 'banane', 'bananen'],
  ['naranja', 'naranjas', 'orange', 'oranges', 'arancia', 'arance'],
  ['limon', 'limón', 'limones', 'lemon', 'lemons', 'zitrone', 'zitronen', 'citron', 'limone', 'limão'],
  ['tomate', 'tomates', 'tomato', 'tomatoes', 'tomate', 'tomaten', 'pomodoro', 'pomodori'],
  ['pimiento', 'pimientos', 'pepper', 'peppers', 'paprika', 'poivron', 'poivrons', 'peperone', 'peperoni', 'pimento'],
  ['cebolla', 'cebollas', 'onion', 'onions', 'zwiebel', 'zwiebeln', 'oignon', 'cipolla', 'cebola'],
  ['ajo', 'ajos', 'garlic', 'knoblauch', 'ail', 'aglio', 'alho'],
  ['patata', 'patatas', 'papa', 'papas', 'potato', 'potatoes', 'kartoffel', 'kartoffeln', 'pomme de terre', 'batata'],
  ['lechuga', 'lettuce', 'salat', 'laitue', 'lattuga', 'alface'],
  ['espinaca', 'espinacas', 'spinach', 'spinat', 'épinard', 'spinaci', 'espinafre'],
  ['zanahoria', 'zanahorias', 'carrot', 'carrots', 'karotte', 'karotten', 'möhre', 'carotte', 'carota', 'cenoura'],
  ['uva', 'uvas', 'grape', 'grapes', 'weintraube', 'weintrauben', 'raisin', 'raisins', 'uva', 'uve', 'druif'],
  ['higo', 'higos', 'fig', 'figs', 'feige', 'feigen', 'figue', 'fico', 'fichi', 'figo'],
  ['datil', 'dátil', 'dátiles', 'date', 'dates', 'dattel', 'datteln', 'datte', 'dattero'],

  // Frutos Secos y Semillas
  ['fruto seco', 'frutos secos', 'nut', 'nuts', 'nuss', 'nüsse', 'nuesse', 'noix', 'noce', 'noci', 'noz', 'nozes', 'noten'],
  ['almendra', 'almendras', 'almond', 'almonds', 'mandel', 'mandeln', 'amande', 'amandes', 'mandorla', 'mandorle', 'amêndoa'],
  ['avellana', 'avellanas', 'hazelnut', 'hazelnuts', 'haselnuss', 'haselnüsse', 'noisette', 'noisettes', 'nocciola', 'nocciole', 'avelã'],
  ['nuez', 'nueces', 'walnut', 'walnuts', 'walnuss', 'walnüsse', 'noix'],
  ['cacahuete', 'cacahuetes', 'maní', 'mani', 'peanut', 'peanuts', 'groundnut', 'erdnuss', 'erdnüsse', 'cacahuète', 'arachide', 'arachidi', 'amendoim'],
  ['pistacho', 'pistachos', 'pistachio', 'pistachios', 'pistazie', 'pistazien', 'pistache', 'pistacchio', 'pistacchi'],
  ['anacardo', 'anacardos', 'cashew', 'cashews', 'kaschunuss', 'anacardier', 'anacardio', 'caju'],
  ['sesamo', 'sésamo', 'ajonjoli', 'ajonjolí', 'sesame', 'sesam', 'sésame', 'sesamo'],

  // Cereales y Harinas
  ['cereal', 'cereales', 'grain', 'grains', 'getreide', 'céréale', 'céréales', 'cereale', 'cereali'],
  ['trigo', 'wheat', 'weizen', 'blé', 'ble', 'grano', 'trigo'],
  ['arroz', 'rice', 'reis', 'riz', 'riso', 'arroz'],
  ['maiz', 'maíz', 'corn', 'maize', 'mais', 'milho'],
  ['avena', 'oat', 'oats', 'hafer', 'avoine', 'avena', 'aveia'],
  ['cebada', 'barley', 'gerste', 'orge', 'orzo', 'cevada'],
  ['centeno', 'rye', 'roggen', 'seigle', 'segale', 'centeio'],
  ['harina', 'harinas', 'flour', 'flours', 'mehl', 'farine', 'farina', 'farinha'],
  ['pan', 'bread', 'brot', 'pain', 'pane', 'pão'],
  ['pasta', 'pastas', 'noodles', 'nudeln', 'pâtes', 'pates', 'massa'],

  // Especias y Condimentos
  ['especia', 'especias', 'condimento', 'condimentos', 'spice', 'spices', 'seasoning', 'gewürz', 'gewürze', 'épice', 'épices', 'spezia', 'spezie', 'especiaria'],
  ['pimienta', 'pepper', 'black pepper', 'pfeffer', 'poivre', 'pepe', 'pimenta'],
  ['pimenton', 'pimentón', 'paprika', 'paprikapulver', 'poivron moulu'],
  ['canela', 'cinnamon', 'zimt', 'cannelle', 'cannella'],
  ['curcuma', 'cúrcuma', 'turmeric', 'kurkuma'],
  ['jengibre', 'ginger', 'ingwer', 'gingembre', 'zenzero', 'gengibre'],
  ['comino', 'cumin', 'kreuzkümmel', 'cumino'],
  ['oregano', 'orégano', 'origan', 'origano'],
  ['azafran', 'azafrán', 'saffron', 'safran', 'zafferano', 'açafrão'],

  // Peligros / Contaminantes / Patógenos / Alérgenos
  ['sulfito', 'sulfitos', 'sulphite', 'sulphites', 'sulfite', 'sulfites', 'sulfit', 'schwefeldioxid', 'dióxido de azufre', 'dioxido de azufre', 'sulfur dioxide', 'dioxyde de soufre', 'anidride solforosa', 'dioxido de enxofre', 'so2'],
  ['gluten', 'gluten free', 'sin gluten', 'celiaquia', 'celiac', 'coeliac', 'zöliakie'],
  ['listeria', 'listeriosis', 'listeria monocytogenes', 'listerien'],
  ['salmonella', 'salmonela', 'salmonellen'],
  ['escherichia coli', 'e coli', 'e. coli', 'stec', 'vtec', 'coliformes'],
  ['plomo', 'lead', 'blei', 'plomb', 'piombo', 'chumbo', 'pb'],
  ['mercurio', 'mercury', 'quecksilber', 'mercure', 'hg'],
  ['cadmio', 'cadmium', 'kadmium', 'cd'],
  ['arsenico', 'arsénico', 'arsenic', 'arsen', 'arsenico', 'as'],
  ['pesticida', 'pesticidas', 'plaguicida', 'plaguicidas', 'pesticide', 'pesticides', 'pestizid', 'pestizide', 'fitosanitario'],
  ['micotoxina', 'micotoxinas', 'mycotoxin', 'mycotoxins', 'mykotoxin', 'mykotoxine'],
  ['aflatoxina', 'aflatoxinas', 'aflatoxin', 'aflatoxins'],
  ['ocratoxina', 'ocratoxinas', 'ochratoxin', 'ochratoxins'],
  ['cristal', 'vidrio', 'cristales', 'glass', 'glas', 'verre', 'vetro', 'vidro', 'scherben'],
  ['metal', 'metales', 'metalico', 'metálico', 'metallic', 'metall', 'métal', 'metallo'],
  ['plastico', 'plástico', 'plastic', 'plastics', 'plastik', 'plastique', 'plastica'],
  ['cuerpo extraño', 'cuerpos extraños', 'foreign body', 'foreign bodies', 'foreign object', 'foreign objects', 'fremdkörper', 'corps étranger', 'corpo estraneo'],
  ['fraude', 'food fraud', 'lebensmittelbetrug', 'adulteracion', 'adulteración', 'adulteration', 'falsificacion', 'falsificación', 'counterfeit', 'tampering', 'mislabeling', 'falso etiquetado'],

  // Países Clave
  ['espana', 'españa', 'spain', 'spanien', 'espagne', 'spagna', 'espanha'],
  ['ucrania', 'ukraine', 'ukraina', 'ucrânia'],
  ['alemania', 'germany', 'deutschland', 'allemagne', 'germania'],
  ['francia', 'france', 'frankreich'],
  ['italia', 'italy', 'italien', 'italie'],
  ['china', 'chine'],
  ['reino unido', 'united kingdom', 'uk', 'grossbritannien', 'royaume-uni'],
  ['estados unidos', 'united states', 'usa', 'us', 'vereinigte staaten', 'etats-unis'],
  ['polonia', 'poland', 'polen', 'pologne', 'polonia'],
  ['paises bajos', 'países bajos', 'holanda', 'netherlands', 'holland', 'niederlande', 'pays-bas'],
  ['belgica', 'bélgica', 'belgium', 'belgien', 'belgique'],
  ['portugal'],
  ['turquia', 'turquía', 'turkey', 'türkiye', 'turkei', 'turquie'],
  ['marruecos', 'morocco', 'marokko', 'maroc'],
  ['india', 'inde', 'indien'],
  ['suiza', 'switzerland', 'schweiz', 'suisse', 'svizzera'],
  ['austria', 'österreich', 'oesterreich', 'autriche'],
  ['grecia', 'greece', 'griechenland', 'grèce'],
  ['dinamarca', 'denmark', 'dänemark', 'daenemark', 'danemark', 'danimarca'],
  ['suecia', 'sweden', 'schweden', 'suède'],
  ['irlanda', 'ireland', 'irland', 'irlande']
];

// Mapa indexado de sinónimos
const SYNONYM_MAP = new Map();
MULTILINGUAL_SYNONYM_GROUPS.forEach(group => {
  const normGroup = Array.from(new Set(group.map(w => normalizeSearchText(w)).filter(Boolean)));
  normGroup.forEach(word => {
    if (!SYNONYM_MAP.has(word)) SYNONYM_MAP.set(word, new Set());
    normGroup.forEach(syn => SYNONYM_MAP.get(word).add(syn));
  });
});

function getMultilingualSynonymsForQuery(rawQuery) {
  const normQuery = normalizeSearchText(rawQuery);
  if (!normQuery) return [];
  const tokens = normQuery.split(/\s+/).filter(Boolean);
  const foundSyns = new Set();
  tokens.forEach(t => {
    if (SYNONYM_MAP.has(t)) {
      SYNONYM_MAP.get(t).forEach(s => {
        if (s !== t) foundSyns.add(s);
      });
    }
  });
  return Array.from(foundSyns);
}

function matchesMultilingualSearch(alert, rawQuery) {
  if (!rawQuery || !rawQuery.trim()) return true;

  const targetNorm = normalizeSearchText([
    alert.producto,
    alert.descripcion,
    alert.empresa_responsable,
    alert.subtipo_peligro,
    alert.categoria_alimento,
    alert.pais_notificador,
    alert.pais_origen,
    alert.id,
    alert.id_original,
    alert.lotes_afectados
  ].join(' '));

  const targetPadded = ' ' + targetNorm + ' ';
  const queryNorm = normalizeSearchText(rawQuery);

  // Coincidencia literal directa
  if (targetNorm.includes(queryNorm)) return true;

  const tokens = queryNorm.split(/\s+/).filter(Boolean);
  if (tokens.length === 0) return true;

  return tokens.every(token => {
    if (SYNONYM_MAP.has(token)) {
      const syns = SYNONYM_MAP.get(token);
      return Array.from(syns).some(syn => {
        if (syn.includes(' ')) {
          return targetNorm.includes(syn);
        }
        const re = new RegExp('(^|\\s)' + syn.replace(/[.*+?^${}()|[\\]\\\\]/g, '\\$&') + '($|\\s)', 'i');
        return re.test(targetPadded);
      });
    }
    return targetNorm.includes(token);
  });
}

function applyFilters() {
  const searchVal = document.getElementById('searchInput').value.trim();
  const categoryVal = document.getElementById('filterCategory').value;
  const typeVal = document.getElementById('filterType').value;
  const countryVal = document.getElementById('filterCountry').value;
  const yearSelect = document.getElementById('filterYear');
  const yearVal = yearSelect ? yearSelect.value : 'all';
  const monthVal = document.getElementById('filterMonth').value;

  filteredAlerts = allAlerts.filter(a => {
    // Multilingual Search match (español, inglés, alemán, francés, etc.)
    if (searchVal && !matchesMultilingualSearch(a, searchVal)) {
      return false;
    }

    // Year match (2024, 2025, 2026)
    const aDate = a.fecha_notificacion || a.mes_ano || '';
    const aYear = aDate.substring(0, 4);
    if (!['2024', '2025', '2026'].includes(aYear)) {
      return false;
    }
    if (yearVal !== 'all' && aYear !== yearVal) {
      return false;
    }

    // Category match
    if (categoryVal !== 'all') {
      if (categoryVal === 'Bebidas y Licores') {
        const cat = (a.categoria_alimento || '').toLowerCase();
        const prod = (a.producto || '').toLowerCase();
        const isDrink = cat.includes('bebida') || cat.includes('licor') || cat.includes('vino') || prod.includes('wine') || prod.includes('vino');
        if (!isDrink) return false;
      } else if (a.categoria_alimento !== categoryVal) {
        return false;
      }
    }

    // Type match
    if (typeVal !== 'all' && a.tipo_alerta !== typeVal) {
      return false;
    }

    // Country match
    if (countryVal !== 'all') {
      if (a.pais_notificador !== countryVal && a.pais_origen !== countryVal) {
        return false;
      }
    }

    // Month match
    if (monthVal !== 'all') {
      const aMonth = a.mes_ano || aDate.substring(0, 7);
      if (aMonth !== monthVal) return false;
    }

    return true;
  });

  currentPage = 1;
  updateKPIs();
  renderCharts();
  renderSummaryPanels();
  renderTable();
  updateFilterBadges();
  
  if (window.lucide) {
    window.lucide.createIcons();
  }
}

function resetFilters() {
  document.getElementById('searchInput').value = '';
  document.getElementById('filterCategory').value = 'all';
  document.getElementById('filterType').value = 'all';
  document.getElementById('filterCountry').value = 'all';
  if (document.getElementById('filterYear')) {
    document.getElementById('filterYear').value = 'all';
  }
  updateMonthOptions();
  document.getElementById('filterMonth').value = 'all';
  applyFilters();
}

function updateKPIs() {
  const total = filteredAlerts.length;
  let fraud = 0;
  let microbio = 0;
  let critical = 0;
  const countries = new Set();

  filteredAlerts.forEach(a => {
    if (a.tipo_alerta === 'Fraude / EMA') fraud++;
    if (a.tipo_alerta === 'Microbiológico' || a.tipo_alerta === 'Alérgeno') microbio++;
    if ((a.gravedad || '').includes('Crítica') || (a.gravedad || '').includes('Alta')) critical++;
    if (a.pais_notificador) countries.add(a.pais_notificador);
    if (a.pais_origen) countries.add(a.pais_origen);
  });

  const fraudPct = total > 0 ? Math.round((fraud / total) * 100) : 0;

  document.getElementById('kpiTotalAlerts').textContent = total.toLocaleString();
  document.getElementById('kpiFraudAlerts').textContent = `${fraud} (${fraudPct}%)`;
  document.getElementById('kpiMicrobioAlerts').textContent = microbio.toLocaleString();
  document.getElementById('kpiCountries').textContent = countries.size.toString();
  document.getElementById('kpiCriticalAlerts').textContent = critical.toLocaleString();

  document.getElementById('filterResultsCount').textContent = `Mostrando ${total} de ${allAlerts.length} alertas globales`;
}

function updateFilterBadges() {
  const chipsContainer = document.getElementById('activeChips');
  chipsContainer.innerHTML = '';

  const active = [];
  const cat = document.getElementById('filterCategory').value;
  const typ = document.getElementById('filterType').value;
  const cou = document.getElementById('filterCountry').value;
  const mon = document.getElementById('filterMonth').value;
  const sea = document.getElementById('searchInput').value.trim();

  if (sea) {
    const syns = getMultilingualSynonymsForQuery(sea);
    const synHint = syns.length > 0 
      ? ` (multilingüe: ${syns.slice(0, 3).join(', ')}${syns.length > 3 ? '...' : ''})` 
      : '';
    active.push({ label: `Búsqueda: "${sea}"${synHint}`, reset: () => document.getElementById('searchInput').value = '' });
  }
  if (cat !== 'all') active.push({ label: `Alimento: ${cat}`, reset: () => document.getElementById('filterCategory').value = 'all' });
  if (typ !== 'all') active.push({ label: `Tipo: ${typ}`, reset: () => document.getElementById('filterType').value = 'all' });
  if (cou !== 'all') active.push({ label: `País: ${cou}`, reset: () => document.getElementById('filterCountry').value = 'all' });
  if (mon !== 'all') active.push({ label: `Mes: ${mon}`, reset: () => document.getElementById('filterMonth').value = 'all' });

  if (active.length > 0) {
    chipsContainer.classList.remove('hidden');
    active.forEach(item => {
      const chip = document.createElement('span');
      chip.className = 'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-indigo-500/20 text-indigo-300 border border-indigo-500/30';
      chip.innerHTML = `${item.label} <button class="hover:text-white font-bold ml-1">✕</button>`;
      chip.querySelector('button').onclick = () => {
        item.reset();
        applyFilters();
      };
      chipsContainer.appendChild(chip);
    });
  } else {
    chipsContainer.classList.add('hidden');
  }
}

// ---------------- CHARTS RENDERING ----------------

function renderCharts() {
  renderMonthlyChart();
  renderTypesChart();
  renderCountriesChart();
}

function renderMonthlyChart() {
  const ctx = document.getElementById('chartMonthly').getContext('2d');
  
  // Aggregate by month and type
  const monthsMap = {};
  filteredAlerts.forEach(a => {
    const m = a.mes_ano || (a.fecha_notificacion ? a.fecha_notificacion.substring(0, 7) : '2026-00');
    if (!monthsMap[m]) {
      monthsMap[m] = { 'Fraude / EMA': 0, 'Microbiológico': 0, 'Alérgeno': 0, 'Químico': 0, 'Físico': 0, 'Otros': 0 };
    }
    const t = a.tipo_alerta || 'Otros';
    if (monthsMap[m][t] !== undefined) {
      monthsMap[m][t]++;
    } else {
      monthsMap[m]['Otros']++;
    }
  });

  const sortedMonths = Object.keys(monthsMap).sort();
  const labels = sortedMonths.map(m => {
    const [y, mon] = m.split('-');
    const d = new Date(parseInt(y), parseInt(mon) - 1, 1);
    return d.toLocaleDateString('es-ES', { month: 'short', year: 'numeric' });
  });

  const datasetFraud = sortedMonths.map(m => monthsMap[m]['Fraude / EMA']);
  const datasetMicro = sortedMonths.map(m => monthsMap[m]['Microbiológico']);
  const datasetAller = sortedMonths.map(m => monthsMap[m]['Alérgeno']);
  const datasetChem = sortedMonths.map(m => monthsMap[m]['Químico']);
  const datasetPhys = sortedMonths.map(m => monthsMap[m]['Físico']);

  if (chartMonthlyInstance) chartMonthlyInstance.destroy();

  chartMonthlyInstance = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: labels,
      datasets: [
        {
          label: 'Fraude / EMA',
          data: datasetFraud,
          backgroundColor: '#f97316',
          borderRadius: 4
        },
        {
          label: 'Microbiológico',
          data: datasetMicro,
          backgroundColor: '#ef4444',
          borderRadius: 4
        },
        {
          label: 'Alérgenos',
          data: datasetAller,
          backgroundColor: '#eab308',
          borderRadius: 4
        },
        {
          label: 'Químico',
          data: datasetChem,
          backgroundColor: '#a855f7',
          borderRadius: 4
        },
        {
          label: 'Físico',
          data: datasetPhys,
          backgroundColor: '#06b6d4',
          borderRadius: 4
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        x: {
          stacked: true,
          grid: { color: 'rgba(51, 65, 85, 0.25)' },
          ticks: { color: '#94a3b8', font: { family: 'Plus Jakarta Sans', size: 11 } }
        },
        y: {
          stacked: true,
          beginAtZero: true,
          grid: { color: 'rgba(51, 65, 85, 0.25)' },
          ticks: { color: '#94a3b8', font: { family: 'JetBrains Mono', size: 11 }, precision: 0 }
        }
      },
      plugins: {
        legend: {
          position: 'top',
          labels: { color: '#cbd5e1', font: { family: 'Plus Jakarta Sans', size: 11 }, boxWidth: 12 }
        },
        tooltip: {
          backgroundColor: '#0f172a',
          titleColor: '#ffffff',
          bodyColor: '#cbd5e1',
          borderColor: '#334155',
          borderWidth: 1,
          padding: 10
        }
      }
    }
  });
}

function renderTypesChart() {
  const ctx = document.getElementById('chartTypes').getContext('2d');

  const typesCount = {};
  filteredAlerts.forEach(a => {
    const t = a.tipo_alerta || 'Otros';
    typesCount[t] = (typesCount[t] || 0) + 1;
  });

  const labels = Object.keys(typesCount);
  const data = Object.values(typesCount);

  // Colors according to severity tokens
  const colorMap = {
    'Fraude / EMA': '#f97316',
    'Microbiológico': '#ef4444',
    'Alérgeno': '#eab308',
    'Químico': '#a855f7',
    'Físico': '#06b6d4',
    'Etiquetado / Regulatorio': '#3b82f6',
    'Otros': '#64748b'
  };
  const backgroundColors = labels.map(l => colorMap[l] || '#6366f1');

  if (chartTypesInstance) chartTypesInstance.destroy();

  chartTypesInstance = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: labels,
      datasets: [{
        data: data,
        backgroundColor: backgroundColors,
        borderWidth: 2,
        borderColor: '#0f172a'
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: 'right',
          labels: { color: '#cbd5e1', font: { family: 'Plus Jakarta Sans', size: 11 }, boxWidth: 12 }
        },
        tooltip: {
          backgroundColor: '#0f172a',
          titleColor: '#ffffff',
          bodyColor: '#cbd5e1',
          borderColor: '#334155',
          borderWidth: 1,
          padding: 10
        }
      },
      cutout: '65%'
    }
  });
}

function renderCountriesChart() {
  const ctx = document.getElementById('chartCountries').getContext('2d');

  const counts = {};
  filteredAlerts.forEach(a => {
    const country = countryChartMode === 'notif' ? (a.pais_notificador || 'Desconocido') : (a.pais_origen || 'Desconocido');
    counts[country] = (counts[country] || 0) + 1;
  });

  const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 10);
  const labels = sorted.map(item => item[0]);
  const data = sorted.map(item => item[1]);

  if (chartCountriesInstance) chartCountriesInstance.destroy();

  const barColor = countryChartMode === 'notif' ? '#6366f1' : '#ec4899';

  chartCountriesInstance = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: labels,
      datasets: [{
        label: countryChartMode === 'notif' ? 'Alertas Emitidas (País Notificador)' : 'Incidentes Originados (País de Origen)',
        data: data,
        backgroundColor: barColor,
        borderRadius: 6
      }]
    },
    options: {
      indexAxis: 'y',
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        x: {
          beginAtZero: true,
          grid: { color: 'rgba(51, 65, 85, 0.25)' },
          ticks: { color: '#94a3b8', font: { family: 'JetBrains Mono', size: 11 }, precision: 0 }
        },
        y: {
          grid: { display: false },
          ticks: { color: '#cbd5e1', font: { family: 'Plus Jakarta Sans', size: 12 } }
        }
      },
      plugins: {
        legend: {
          position: 'top',
          labels: { color: '#cbd5e1', font: { family: 'Plus Jakarta Sans', size: 11 } }
        },
        tooltip: {
          backgroundColor: '#0f172a',
          titleColor: '#ffffff',
          bodyColor: '#cbd5e1',
          borderColor: '#334155',
          borderWidth: 1
        }
      }
    }
  });
}

function setCountryChartMode(mode) {
  countryChartMode = mode;
  const btnNotif = document.getElementById('btnViewNotif');
  const btnOrigin = document.getElementById('btnViewOrigin');

  if (mode === 'notif') {
    btnNotif.className = 'px-3 py-1 rounded-lg bg-indigo-600 text-white font-medium';
    btnOrigin.className = 'px-3 py-1 rounded-lg text-slate-400 hover:text-white font-medium';
  } else {
    btnOrigin.className = 'px-3 py-1 rounded-lg bg-pink-600 text-white font-medium';
    btnNotif.className = 'px-3 py-1 rounded-lg text-slate-400 hover:text-white font-medium';
  }
  renderCountriesChart();
}

// ---------------- SUMMARY PANELS ----------------

function renderSummaryPanels() {
  // 1. Top Countries
  const countryCounts = {};
  filteredAlerts.forEach(a => {
    const c = a.pais_notificador || 'Desconocido';
    countryCounts[c] = (countryCounts[c] || 0) + 1;
  });
  const topCountries = Object.entries(countryCounts).sort((a, b) => b[1] - a[1]).slice(0, 4);
  const containerCountries = document.getElementById('summaryTopCountries');
  containerCountries.innerHTML = topCountries.map(([name, count]) => `
    <div class="flex items-center justify-between py-1 border-b border-slate-800/60 last:border-none">
      <span class="text-slate-200">${name}</span>
      <span class="px-2 py-0.5 rounded font-mono text-xs bg-indigo-500/10 text-indigo-400 font-bold">${count} alertas</span>
    </div>
  `).join('') || '<div class="text-slate-500">Sin datos</div>';

  // 2. Vulnerable Fraud Categories
  const fraudCats = {};
  filteredAlerts.filter(a => a.tipo_alerta === 'Fraude / EMA').forEach(a => {
    const cat = a.categoria_alimento || 'Otros';
    fraudCats[cat] = (fraudCats[cat] || 0) + 1;
  });
  const topFraud = Object.entries(fraudCats).sort((a, b) => b[1] - a[1]).slice(0, 4);
  const containerFraud = document.getElementById('summaryFraudCategories');
  containerFraud.innerHTML = topFraud.map(([name, count]) => `
    <div class="flex items-center justify-between py-1 border-b border-slate-800/60 last:border-none">
      <span class="text-slate-200">${name}</span>
      <span class="px-2 py-0.5 rounded font-mono text-xs bg-orange-500/15 text-orange-400 font-bold">${count} casos</span>
    </div>
  `).join('') || '<div class="text-slate-500">No hay casos de fraude bajo los filtros activos</div>';

  // 3. Highlighted Seizures / Quantities
  const highlights = filteredAlerts.filter(a => a.cantidad_afectada && a.cantidad_afectada !== 'En evaluación' && a.cantidad_afectada !== 'Distribución minorista').slice(0, 4);
  const containerVolumes = document.getElementById('summaryVolumes');
  containerVolumes.innerHTML = highlights.map(a => `
    <div class="py-1 border-b border-slate-800/60 last:border-none">
      <div class="flex items-center justify-between">
        <span class="font-medium text-slate-200 truncate w-44" title="${a.producto}">${a.producto}</span>
        <span class="font-mono text-emerald-400 text-[11px] font-bold">${a.cantidad_afectada}</span>
      </div>
      <div class="text-[11px] text-slate-400">${a.pais_notificador} • ${a.tipo_alerta}</div>
    </div>
  `).join('') || '<div class="text-slate-500">Sin datos de volumen</div>';
}

// ---------------- TABLE RENDERING & PAGINATION ----------------

function renderTable() {
  const tbody = document.getElementById('alertsTableBody');
  tbody.innerHTML = '';

  const total = filteredAlerts.length;
  if (total === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="8" class="text-center py-8 text-slate-500">
          No se encontraron alertas alimentarias ni casos de fraude con los filtros seleccionados.
        </td>
      </tr>
    `;
    updatePaginationControls(0);
    return;
  }

  const startIdx = (currentPage - 1) * pageSize;
  const endIdx = Math.min(startIdx + pageSize, total);
  const pageItems = filteredAlerts.slice(startIdx, endIdx);

  pageItems.forEach(item => {
    const tr = document.createElement('tr');
    tr.className = 'hover:bg-slate-800/40 transition-colors';

    // Severity badge style
    let sevBadge = 'badge-info';
    const grav = item.gravedad || 'Media';
    if (grav.includes('Crítica') || grav.includes('Alta')) sevBadge = 'badge-critical';
    else if (grav.includes('Media')) sevBadge = 'badge-allergen';

    // Type badge style
    let typeBadge = 'badge-info';
    if (item.tipo_alerta === 'Fraude / EMA') typeBadge = 'badge-fraud';
    else if (item.tipo_alerta === 'Microbiológico') typeBadge = 'badge-critical';
    else if (item.tipo_alerta === 'Alérgeno') typeBadge = 'badge-allergen';
    else if (item.tipo_alerta === 'Químico') typeBadge = 'badge-chemical';
    else if (item.tipo_alerta === 'Físico') typeBadge = 'badge-physical';

    tr.innerHTML = `
      <td class="py-3 px-4 whitespace-nowrap text-slate-400 font-mono text-[11px]">
        ${item.fecha_notificacion || 'N/A'}
      </td>
      <td class="py-3 px-4 whitespace-nowrap font-mono text-[11px] text-indigo-300">
        ${item.id_original || item.id}
      </td>
      <td class="py-3 px-4">
        <div class="font-semibold text-slate-100">${escapeHtml(item.producto)}</div>
        <div class="text-[11px] text-slate-400">${item.categoria_alimento || 'Otros'} • ${escapeHtml(item.empresa_responsable || '')}</div>
      </td>
      <td class="py-3 px-4">
        <span class="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium ${typeBadge}">
          ${item.tipo_alerta}
        </span>
        <div class="text-[11px] text-slate-400 mt-1 truncate max-w-xs" title="${escapeHtml(item.subtipo_peligro || '')}">
          ${escapeHtml(item.subtipo_peligro || '')}
        </div>
      </td>
      <td class="py-3 px-4 whitespace-nowrap text-xs">
        <div class="flex items-center space-x-1.5">
          <span class="text-slate-200 font-medium">${item.pais_notificador || 'N/A'}</span>
          <span class="text-slate-500">➔</span>
          <span class="text-slate-400">${item.pais_origen || 'N/A'}</span>
        </div>
      <td class="py-3 px-4 whitespace-nowrap">
        <span class="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold ${sevBadge}" title="${item.decision_rasff ? 'Decisión oficial RASFF: ' + escapeHtml(item.decision_rasff) : ''}">
          ${item.decision_rasff && item.decision_rasff.toLowerCase().includes('potential') ? 'Riesgo Potencial' : (item.gravedad || 'Media')}
        </span>
      </td>
      <td class="py-3 px-4 whitespace-nowrap font-mono text-[11px] text-emerald-400">
        ${item.cantidad_afectada || 'En evaluación'}
      </td>
      <td class="py-3 px-4 text-right whitespace-nowrap">
        <button onclick="openModal('${item.id}')"
                class="bg-slate-800 hover:bg-slate-700 text-indigo-300 hover:text-white px-3 py-1.5 rounded-lg text-xs font-semibold border border-slate-700 transition-all">
          Ver Ficha
        </button>
      </td>
    `;
    tbody.appendChild(tr);
  });

  updatePaginationControls(total);
}

function updatePaginationControls(total) {
  const startIdx = total === 0 ? 0 : (currentPage - 1) * pageSize + 1;
  const endIdx = Math.min(currentPage * pageSize, total);
  document.getElementById('paginationInfo').textContent = `Mostrando ${startIdx} - ${endIdx} de ${total} registros`;

  const totalPages = Math.ceil(total / pageSize) || 1;
  const controls = document.getElementById('paginationControls');
  controls.innerHTML = '';

  // Prev Button
  const prevBtn = document.createElement('button');
  prevBtn.className = `px-2.5 py-1 rounded border border-slate-800 ${currentPage === 1 ? 'text-slate-600 cursor-not-allowed' : 'text-slate-300 hover:bg-slate-800'}`;
  prevBtn.textContent = '◀ Anterior';
  prevBtn.disabled = currentPage === 1;
  prevBtn.onclick = () => { if (currentPage > 1) { currentPage--; renderTable(); } };
  controls.appendChild(prevBtn);

  // Page Indicator
  const pageSpan = document.createElement('span');
  pageSpan.className = 'px-3 py-1 text-xs text-slate-300 font-mono';
  pageSpan.textContent = `${currentPage} / ${totalPages}`;
  controls.appendChild(pageSpan);

  // Next Button
  const nextBtn = document.createElement('button');
  nextBtn.className = `px-2.5 py-1 rounded border border-slate-800 ${currentPage >= totalPages ? 'text-slate-600 cursor-not-allowed' : 'text-slate-300 hover:bg-slate-800'}`;
  nextBtn.textContent = 'Siguiente ▶';
  nextBtn.disabled = currentPage >= totalPages;
  nextBtn.onclick = () => { if (currentPage < totalPages) { currentPage++; renderTable(); } };
  controls.appendChild(nextBtn);
}

function changePageSize(size) {
  pageSize = parseInt(size, 10);
  currentPage = 1;
  renderTable();
}

// ---------------- MODAL SHEET ----------------

function openModal(alertId) {
  const item = allAlerts.find(a => a.id === alertId);
  if (!item) return;

  document.getElementById('modalTitle').textContent = item.producto;
  document.getElementById('modalRef').textContent = `ID de Referencia: ${item.id_original || item.id}`;
  document.getElementById('modalSeverityBadge').textContent = item.decision_rasff ? `${item.gravedad} (Decisión RASFF: ${item.decision_rasff})` : (item.gravedad || 'MEDIA');
  document.getElementById('modalTypeBadge').textContent = item.tipo_alerta || 'GENERAL';
  document.getElementById('modalSourceBadge').textContent = item.fuente_origen || 'OFICIAL';

  document.getElementById('modalDesc').textContent = item.descripcion || 'Sin descripción disponible.';
  document.getElementById('modalHazard').textContent = item.subtipo_peligro || 'No especificado';
  document.getElementById('modalFraudMechanism').textContent = item.tipo_fraude !== 'No Aplica' ? item.tipo_fraude : 'N/A (Alerta de Seguridad Sanitaria)';
  document.getElementById('modalCompany').textContent = item.empresa_responsable || 'No informada';
  document.getElementById('modalCountries').textContent = `${item.pais_notificador || 'N/A'} (Notifica) ➔ ${item.pais_origen || 'N/A'} (Origen)`;
  document.getElementById('modalLots').textContent = item.lotes_afectados || 'No detallado';
  document.getElementById('modalQuantity').textContent = item.cantidad_afectada || 'En evaluación regulatoria';
  document.getElementById('modalDistribution').textContent = item.distribucion_geografica || 'No especificada';
  document.getElementById('modalDate').textContent = item.fecha_notificacion || 'N/A';

  const linkBtn = document.getElementById('modalOfficialLink');
  if (item.fuente_url) {
    linkBtn.href = item.fuente_url;
    linkBtn.classList.remove('hidden');
  } else {
    linkBtn.classList.add('hidden');
  }

  document.getElementById('alertModal').classList.remove('hidden');
  if (window.lucide) window.lucide.createIcons();
}

function closeModal() {
  document.getElementById('alertModal').classList.add('hidden');
}

// ---------------- LIVE SYNC ----------------

async function triggerLiveSync() {
  const btn = document.getElementById('btnSync');
  const icon = document.getElementById('syncIcon');
  const badgeText = document.getElementById('lastUpdatedText');

  btn.disabled = true;
  btn.classList.add('opacity-75');
  icon.classList.add('animate-spin');
  badgeText.textContent = 'Verificando alertas y feeds en vivo...';

  // 1. Si estamos en entorno local, prueba /api/sync
  let localSyncDone = false;
  if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
    try {
      const res = await fetch('/api/sync', { method: 'POST' });
      if (res.ok) {
        await fetchInitialData();
        localSyncDone = true;
      }
    } catch (e) {
      // Ignora y continúa
    }
  }

  // 2. En GitHub Pages o modo web
  if (!localSyncDone) {
    try {
      const cacheBuster = Date.now();
      const endpoints = [
        `data/alerts.json?v=${cacheBuster}`,
        `static/data/alerts.json?v=${cacheBuster}`,
        `./data/alerts.json?v=${cacheBuster}`
      ];
      for (const ep of endpoints) {
        try {
          const r = await fetch(ep);
          if (r.ok) {
            const data = await r.json();
            if (Array.isArray(data) && data.length > 0) {
              allAlerts = data;
              populateFilterOptions();
              applyFilters();
              break;
            }
          }
        } catch (_) {}
      }
    } catch (_) {}
  }

  // Feedback visual
  await new Promise(r => setTimeout(r, 700));

  const now = new Date().toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
  badgeText.textContent = `Sincronizado con bases oficiales • ${now} (${allAlerts.length} alertas)`;

  btn.disabled = false;
  btn.classList.remove('opacity-75');
  icon.classList.remove('animate-spin');
  if (window.lucide) window.lucide.createIcons();
}

// ---------------- EXPORT MENU ----------------

function toggleExportMenu() {
  const menu = document.getElementById('exportMenu');
  menu.classList.toggle('hidden');
}

function exportData(format) {
  toggleExportMenu();
  if (format === 'json') {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(filteredAlerts, null, 2));
    const a = document.createElement('a');
    a.setAttribute("href", dataStr);
    a.setAttribute("download", `alertas_alimentarias_food_fraud_${new Date().toISOString().slice(0, 10)}.json`);
    document.body.appendChild(a);
    a.click();
    a.remove();
  } else if (format === 'csv') {
    if (filteredAlerts.length === 0) return;
    const headers = [
      'ID', 'Fecha', 'Mes', 'Fuente', 'Pais_Notificador', 'Pais_Origen',
      'Producto', 'Categoria', 'Tipo_Alerta', 'Subtipo_Peligro', 'Tipo_Fraude',
      'Gravedad', 'Cantidad_Afectada', 'Lotes', 'Empresa', 'URL'
    ];
    
    const rows = filteredAlerts.map(a => [
      `"${(a.id || '').replace(/"/g, '""')}"`,
      `"${a.fecha_notificacion || ''}"`,
      `"${a.mes_ano || ''}"`,
      `"${a.fuente_origen || ''}"`,
      `"${(a.pais_notificador || '').replace(/"/g, '""')}"`,
      `"${(a.pais_origen || '').replace(/"/g, '""')}"`,
      `"${(a.producto || '').replace(/"/g, '""')}"`,
      `"${(a.categoria_alimento || '').replace(/"/g, '""')}"`,
      `"${(a.tipo_alerta || '').replace(/"/g, '""')}"`,
      `"${(a.subtipo_peligro || '').replace(/"/g, '""')}"`,
      `"${(a.tipo_fraude || '').replace(/"/g, '""')}"`,
      `"${(a.gravedad || '').replace(/"/g, '""')}"`,
      `"${(a.cantidad_afectada || '').replace(/"/g, '""')}"`,
      `"${(a.lotes_afectados || '').replace(/"/g, '""')}"`,
      `"${(a.empresa_responsable || '').replace(/"/g, '""')}"`,
      `"${a.fuente_url || ''}"`
    ]);

    const csvContent = "\uFEFF" + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.setAttribute("href", url);
    a.setAttribute("download", `alertas_alimentarias_food_fraud_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(a);
    a.click();
    a.remove();
  }
}

// Helper: Escape HTML to avoid XSS
function escapeHtml(str) {
  if (!str) return '';
  return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
}

function setupEventListeners() {
  // Close modal with ESC key
  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeModal();
  });

  // Close export menu on outside click
  window.addEventListener('click', (e) => {
    const menu = document.getElementById('exportMenu');
    const btn = document.getElementById('btnExportMenu');
    if (menu && !menu.contains(e.target) && !btn.contains(e.target)) {
      menu.classList.add('hidden');
    }
  });
}
