// Gjetter kategori ut fra navnet. Enkel ordliste, ingen nettverk.
// Lengste treff vinner, så «treningssko» blir Sko og ikke Trening,
// og «skolesekk» blir Vesker (sekk) og ikke Sko.
// Ord med = foran må stå som et helt ord (for korte ord som «tv» og «ski»).

const KEYWORDS = {
  klaer: [
    'genser', 'bukse', 'jeans', 'skjorte', 't-skjorte', 'topp', 'kjole', 'skjørt', 'cardigan',
    'strikk', 'hettegenser', 'hoodie', 'shorts', 'tights', 'strømpe', 'sokker', 'undertøy', '=bh',
    'truse', 'pysjamas', 'blazer', 'bluse', 'leggings', 'vest', 'body', 'ullundertøy', 'joggebukse',
  ],
  yttertoy: [
    'jakke', 'kåpe', 'frakk', 'parkas', 'dunjakke', 'regnjakke', 'vinterjakke', 'skalljakke',
    'anorakk', 'boblejakke', 'vindjakke', 'regntøy', 'regnbukse', 'skallbukse',
  ],
  sko: [
    'sko', 'støvler', 'støvletter', 'sneakers', 'joggesko', 'sandaler', 'tøfler', 'boots', 'pumps',
    'loafers', 'gummistøvler', 'treningssko', 'løpesko', 'fjellsko', 'klatresko',
  ],
  fest: [
    'festkjole', 'ballkjole', 'gallakjole', 'brudekjole', 'aftenkjole', 'cocktailkjole', 'dress',
    'smoking', 'bunad', 'festantrekk', 'dressjakke', 'paljett',
  ],
  vesker: [
    'veske', '=bag', 'sekk', 'ryggsekk', 'lommebok', 'belte', 'skjerf', '=lue', 'votter', 'hansker',
    'smykke', 'øredobber', 'halskjede', 'armbånd', 'solbriller', 'briller', 'caps', 'hatt', 'paraply',
    'tote', 'clutch', 'håndveske', 'skulderveske', 'ørepynt',
  ],
  elektronikk: [
    'mobil', 'telefon', 'iphone', 'ipad', 'nettbrett', '=pc', 'laptop', 'macbook', 'computer', '=tv',
    'høyttaler', 'hodetelefoner', 'ørepropper', 'airpods', 'kamera', 'lader', 'skjerm', 'tastatur',
    'playstation', '=ps5', 'xbox', 'nintendo', 'smartklokke', 'apple', 'kindle', 'lesebrett', 'router',
    'powerbank', 'konsoll', 'drone', 'projektor', 'gopro', 'robotstøvsuger', 'støvsuger', 'garmin',
    'elektronikk', 'headset', 'webkamera', 'printer', 'skriver',
  ],
  kjokken: [
    'kjøkken', 'kjele', 'panne', 'stekepanne', 'gryte', 'kniv', 'kokekniv', 'blender', 'kaffemaskin',
    'kaffetrakter', 'espressomaskin', 'airfryer', 'mikser', 'kjøkkenmaskin', 'vannkoker', 'brødrister',
    'tallerken', 'kopp', 'krus', 'glass', 'bestikk', 'servise', 'skjærebrett', 'termos', 'matboks',
    '=wok', 'vaffeljern', 'kokebok', 'sous vide', 'stavmikser', 'kjøkkenvekt', 'bakebolle', 'ostehøvel',
  ],
  trening: [
    'trening', 'yoga', 'yogamatte', 'manualer', 'kettlebell', 'vekter', 'racersykkel', 'terrengsykkel', 'landeveissykkel',
    'treningssykkel', 'spinningsykkel', 'grussykkel', 'stisykkel', 'sykkelbukse', 'sykkelsko', '=ski', 'langrenn',
    'slalåm', 'skøyter', 'tennis', 'racket', 'golf', 'sports-bh', 'sportsbh', 'telt', 'sovepose',
    'hodelykt', 'pulsklokke', 'fotball', 'svømme', 'klatre', 'sykkelhjelm', 'hjelm', 'padel',
    'treningsmatte', 'treningsklokke', 'løpevest', 'staver', 'fjellski', 'topptur',
  ],
  mobler: [
    'sofa', 'stol', 'bord', 'seng', 'madrass', 'hylle', 'kommode', 'lampe', 'teppe', 'gardin', 'pute',
    'speil', 'skap', 'bokhylle', 'lenestol', 'puff', 'sengetøy', 'dyne', 'sengesett', 'potte', 'vase',
    'plakat', 'maleri', 'lysestake', 'interiør', 'kurv', 'krakk', 'garderobe', 'møbel', 'pledd',
    'håndkle', 'stue', 'soverom', 'skrivebord', 'spisebord',
  ],
  hudpleie: [
    'krem', 'serum', 'sminke', 'mascara', 'leppestift', 'foundation', 'concealer', 'parfyme', 'sjampo',
    'balsam', 'hudpleie', 'solkrem', 'neglelakk', 'hårføner', 'føner', 'rettetang', 'krølltang',
    'hårbørste', 'ansiktsrens', 'toner', 'primer', 'pudder', 'rouge', 'highlighter', 'eyeliner',
    'barberhøvel', 'epilator', 'dagkrem', 'nattkrem', 'leppepomade', 'øyenskygge', 'airwrap', 'dyson',
  ],
  hobby: [
    'garn', 'strikkepinner', 'maling', 'pensel', 'lerret', 'symaskin', 'puslespill', 'spill',
    'brettspill', 'lego', '=bok', 'bøker', 'gitar', 'piano', 'instrument', 'frø', 'fiskestang',
    'tegneblokk', 'perler', 'modell', 'hobby', 'akvarell', 'keramikk', 'leire', 'heklenål', 'stoff',
  ],
  reise: [
    'koffert', 'trillekoffert', 'reiseveske', 'kabinkoffert', 'bagasje', 'reise', 'nakkepute',
    'reiseadapter', 'toalettmappe', 'pakkekuber', 'duffel', 'weekendbag',
  ],
  abonnement: [
    'abonnement', 'netflix', 'spotify', '=hbo', 'disney', 'viaplay', 'strømmetjeneste', 'medlemskap',
    'treningssenter', '=sats', '=app', 'icloud', 'chatgpt', 'avis', 'magasin', 'youtube', 'storytel',
    'podimo', 'tidal', '=gym', '=evo', 'elixia', 'lisens', 'premium', 'måned for måned',
  ],
  transport: [
    'sykkel', 'elsykkel', 'el-sykkel', 'elsparkesykkel', 'sparkesykkel', 'sykkelvogn', 'lastesykkel',
    'bysykkel', 'hverdagssykkel', 'sykkellås', 'sykkelstativ', 'sykkelveske', '=bil', 'elbil',
    'bilstol', 'bilsete', 'moped', 'scooter', 'motorsykkel', 'vinterdekk', 'sommerdekk', 'piggdekk',
    '=dekk', 'takboks', 'skateboard', 'transport', 'el-scooter', 'elscooter',
  ],
};

const words = (s) => s.split(/[^a-zæøåäöü0-9-]+/i).filter(Boolean);

/**
 * Returnerer kategori-id eller null. `categories` er dagens liste, så
 * gjetningen bare foreslår kategorier som finnes. Egne kategorier treffes
 * på navnet sitt.
 */
export function guessCategory(name, categories) {
  const text = String(name || '').toLowerCase().trim();
  if (text.length < 2) return null;
  const textWords = words(text);
  const exists = new Set(categories.map((c) => c.id));

  let best = null;
  let bestLen = 0;
  const consider = (id, kw) => {
    if (!exists.has(id)) return;
    const whole = kw.startsWith('=');
    const k = whole ? kw.slice(1) : kw;
    const hit = whole ? textWords.includes(k) : text.includes(k);
    if (hit && k.length > bestLen) { best = id; bestLen = k.length; }
  };

  for (const [id, list] of Object.entries(KEYWORDS)) list.forEach((kw) => consider(id, kw));
  // Kategorinavnet selv (også egne kategorier), f.eks. «Transport».
  for (const c of categories) {
    const n = c.name.toLowerCase();
    if (n.length >= 3) consider(c.id, n);
  }
  return best;
}
