// Lagring i localStorage. All data ligger bare på denne enheten.

import { FREQ } from './calc.js';

const KEY = 'kjop-eller-dropp:v1';
const STATUSES = ['saved', 'bought', 'dropped'];

// defLife/defFreq: forslag til levetid (mnd) og frekvens når kategorien velges.
export const DEFAULT_CATEGORIES = [
  { id: 'klaer',      emoji: '👕', name: 'Klær',               buyBelow: 20,  dropAbove: 50,  defLife: 36,  defFreq: 'weekly' },
  { id: 'yttertoy',   emoji: '🧥', name: 'Yttertøy',           buyBelow: 15,  dropAbove: 40,  defLife: 48,  defFreq: 'weekly' },
  { id: 'sko',        emoji: '👟', name: 'Sko',                buyBelow: 15,  dropAbove: 40,  defLife: 24,  defFreq: 'weekly' },
  { id: 'fest',       emoji: '👗', name: 'Festantrekk',        buyBelow: 100, dropAbove: 300, defLife: 60,  defFreq: 'yearly' },
  { id: 'vesker',     emoji: '👜', name: 'Vesker og tilbehør', buyBelow: 10,  dropAbove: 30,  defLife: 48,  defFreq: 'weekly' },
  { id: 'elektronikk',emoji: '💻', name: 'Elektronikk',        buyBelow: 5,   dropAbove: 20,  defLife: 48,  defFreq: 'daily' },
  { id: 'kjokken',    emoji: '🍳', name: 'Kjøkken',            buyBelow: 5,   dropAbove: 20,  defLife: 60,  defFreq: 'weekly' },
  { id: 'trening',    emoji: '🏃', name: 'Trening',            buyBelow: 15,  dropAbove: 50,  defLife: 36,  defFreq: 'weekly' },
  { id: 'mobler',     emoji: '🛋️', name: 'Møbler og interiør', buyBelow: 3,   dropAbove: 10,  defLife: 120, defFreq: 'daily' },
  { id: 'hudpleie',   emoji: '💄', name: 'Hudpleie og sminke', buyBelow: 5,   dropAbove: 15,  defLife: 6,   defFreq: 'daily' },
  { id: 'hobby',      emoji: '🎨', name: 'Hobby',              buyBelow: 20,  dropAbove: 60,  defLife: 36,  defFreq: 'weekly' },
  { id: 'reise',      emoji: '🧳', name: 'Reise og bagasje',   buyBelow: 10,  dropAbove: 30,  defLife: 72,  defFreq: 'yearly' },
  { id: 'abonnement', emoji: '🔁', name: 'Abonnement',         buyBelow: 10,  dropAbove: 30,  defLife: 12,  defFreq: 'weekly' },
  { id: 'transport',  emoji: '🚲', name: 'Transport',          buyBelow: 5,   dropAbove: 20,  defLife: 60,  defFreq: 'daily' },
  { id: 'annet',      emoji: '📦', name: 'Annet',              buyBelow: 10,  dropAbove: 30,  defLife: 24,  defFreq: 'weekly' },
];
const DEFAULT_BY_ID = Object.fromEntries(DEFAULT_CATEGORIES.map((c) => [c.id, c]));

const DEFAULT_IDS = DEFAULT_CATEGORIES.map((c) => c.id);

function fresh() {
  return {
    version: 1,
    // knownDefaults: hvilke standardkategorier denne enheten har fått tilbud om.
    // Nye standardkategorier legges til én gang; sletter du en, kommer den ikke tilbake.
    settings: {
      hourlyWage: null, treatBudget: null, lastExport: null, knownDefaults: [...DEFAULT_IDS],
      exportSnoozedUntil: null, // «Senere» på eksportpåminnelsen
      waitDays: 30, // tenketid for «Lagre til senere»
      goal: null,   // sparemål: { name, amount, startAt }
    },
    categories: structuredClone(DEFAULT_CATEGORIES),
    items: [],
  };
}

function normalize(d) {
  const base = fresh();
  const settings = { ...base.settings, ...(d.settings || {}) };
  let categories = Array.isArray(d.categories) && d.categories.length ? d.categories : base.categories;

  // Data fra før knownDefaults fantes: regn de som finnes som «kjent».
  const known = new Set(Array.isArray(d.settings?.knownDefaults)
    ? d.settings.knownDefaults
    : categories.map((c) => c.id));
  const missing = DEFAULT_CATEGORIES.filter((c) => !known.has(c.id) && !categories.some((x) => x.id === c.id));
  if (missing.length) {
    // Sett nye standardkategorier inn foran «Annet», så Annet blir sist.
    const at = categories.findIndex((c) => c.id === 'annet');
    categories = [...categories];
    categories.splice(at < 0 ? categories.length : at, 0, ...structuredClone(missing));
  }
  settings.knownDefaults = [...new Set([...known, ...DEFAULT_IDS])];

  categories = categories.map(cleanCategory).filter(Boolean);
  if (!categories.some((c) => c.id === 'annet')) {
    categories.push(structuredClone(DEFAULT_CATEGORIES.find((c) => c.id === 'annet')));
  }
  const items = (Array.isArray(d.items) ? d.items : []).map(cleanItem).filter(Boolean);
  settings.waitDays = [7, 14, 30].includes(Number(settings.waitDays)) ? Number(settings.waitDays) : 30;
  settings.goal = cleanGoal(settings.goal);
  settings.lastExport = isoOrNull(settings.lastExport);
  settings.exportSnoozedUntil = isoOrNull(settings.exportSnoozedUntil);
  return { version: 1, settings, categories, items };
}

function cleanGoal(g) {
  if (!g || typeof g !== 'object') return null;
  const amount = numOr(g.amount, 0);
  if (!(amount > 0)) return null;
  return { name: str(g.name, 60) || 'Sparemål', amount, startAt: isoOrNull(g.startAt) || new Date().toISOString() };
}

// Vasker data (særlig fra importerte filer) så bare kjente felt med riktig type blir med.
const str = (v, max) => (typeof v === 'string' ? v.slice(0, max) : '');
const numOr = (v, fallback) => (Number.isFinite(Number(v)) && v !== null && v !== '' ? Number(v) : fallback);
const isoOrNull = (v) => (typeof v === 'string' && !Number.isNaN(Date.parse(v)) ? v : null);

function cleanCategory(c) {
  if (!c || typeof c !== 'object' || !str(c.id, 64) || !str(c.name, 60)) return null;
  return {
    id: str(c.id, 64),
    emoji: str(c.emoji, 16) || '📦',
    name: str(c.name, 60),
    buyBelow: Math.max(0, numOr(c.buyBelow, 10)),
    dropAbove: Math.max(0, numOr(c.dropAbove, 30)),
    // Eldre data mangler forslagene; hent dem fra standardkategorien med samme id.
    defLife: Math.min(120, Math.max(0, Math.round(numOr(c.defLife, DEFAULT_BY_ID[c.id]?.defLife ?? 24)))),
    defFreq: FREQ[c.defFreq] ? c.defFreq : (DEFAULT_BY_ID[c.id]?.defFreq ?? 'weekly'),
  };
}

function cleanItem(it) {
  if (!it || typeof it !== 'object' || !str(it.id, 64)) return null;
  const price = numOr(it.price, NaN);
  if (!(price >= 0)) return null;
  const times = Math.round(numOr(it.times, 0));
  return {
    id: str(it.id, 64),
    name: str(it.name, 200),
    price,
    resale: Math.max(0, numOr(it.resale, 0)),
    altCost: Math.max(0, numOr(it.altCost, 0)),     // alternativkost per gang (f.eks. buss)
    altShare: [1, 0.75, 0.5, 0.25].includes(Number(it.altShare)) ? Number(it.altShare) : 1,
    categoryId: str(it.categoryId, 64) || 'annet',
    lifespanMonths: Math.min(120, Math.max(0, Math.round(numOr(it.lifespanMonths, 24)))),
    frequency: FREQ[it.frequency] ? it.frequency : 'weekly',
    times: times > 0 ? times : null,
    status: STATUSES.includes(it.status) ? it.status : 'saved',
    treat: it.status === 'bought' && it.treat === true,
    createdAt: isoOrNull(it.createdAt) || new Date().toISOString(),
    decidedAt: isoOrNull(it.decidedAt),
    waitUntil: isoOrNull(it.waitUntil),          // tenketid for lagrede ting
    waited: it.waited === true,                  // avgjort etter at tenketiden var over
    actualUses: Math.max(0, Math.round(numOr(it.actualUses, 0))), // registrert bruk
    lastUsedAt: isoOrNull(it.lastUsedAt),
    stillUsing: ['yes', 'sometimes', 'no'].includes(it.stillUsing) ? it.stillUsing : null, // svar på oppfølging
    followUpAt: isoOrNull(it.followUpAt),        // neste gang appen spør
  };
}

function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return normalize(JSON.parse(raw));
  } catch (e) {
    console.warn('Klarte ikke å lese lagrede data', e);
  }
  return fresh();
}

let state = load();
const listeners = new Set();

function commit() {
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch (e) {
    console.error('Klarte ikke å lagre', e);
    alert('Klarte ikke å lagre. Er lagringen full, eller er privat surfing på?');
  }
  listeners.forEach((fn) => fn(state));
}

export function uid() {
  if (globalThis.crypto?.randomUUID) return crypto.randomUUID();
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 10);
}

export const store = {
  get settings() { return state.settings; },
  get categories() { return state.categories; },
  get items() { return state.items; },

  category(id) {
    return state.categories.find((c) => c.id === id)
      || state.categories.find((c) => c.id === 'annet')
      || state.categories[0];
  },

  subscribe(fn) {
    listeners.add(fn);
    return () => listeners.delete(fn);
  },

  updateSettings(patch) {
    state.settings = { ...state.settings, ...patch };
    commit();
  },

  addItem(item) {
    state.items.push(item);
    commit();
  },

  updateItem(id, patch) {
    state.items = state.items.map((it) => (it.id === id ? { ...it, ...patch } : it));
    commit();
  },

  /** Registrer bruk (+1) eller angre (−1). Returnerer oppdatert ting. */
  addUse(id, delta = 1) {
    let out = null;
    state.items = state.items.map((it) => {
      if (it.id !== id) return it;
      out = {
        ...it,
        actualUses: Math.max(0, (it.actualUses || 0) + delta),
        lastUsedAt: delta > 0 ? new Date().toISOString() : it.lastUsedAt,
        // Bruker du den igjen, er «bruker den ikke» ikke lenger sant.
        stillUsing: delta > 0 && it.stillUsing === 'no' ? null : it.stillUsing,
      };
      return out;
    });
    commit();
    return out;
  },

  deleteItem(id) {
    state.items = state.items.filter((it) => it.id !== id);
    commit();
  },

  addCategory(cat) {
    const at = state.categories.findIndex((c) => c.id === 'annet');
    state.categories.splice(at < 0 ? state.categories.length : at, 0, cat);
    commit();
  },

  updateCategory(id, patch) {
    state.categories = state.categories.map((c) => (c.id === id ? { ...c, ...patch } : c));
    commit();
  },

  /** Sletter en kategori. Ting i den flyttes til Annet. Annet kan ikke slettes. */
  deleteCategory(id) {
    if (id === 'annet') return;
    state.categories = state.categories.filter((c) => c.id !== id);
    state.items = state.items.map((it) => (it.categoryId === id ? { ...it, categoryId: 'annet' } : it));
    commit();
  },

  exportJSON() {
    return JSON.stringify({ app: 'kjop-eller-dropp', exportedAt: new Date().toISOString(), ...state }, null, 2);
  },

  markExported() {
    state.settings = { ...state.settings, lastExport: new Date().toISOString(), exportSnoozedUntil: null };
    commit();
  },

  /** Kaster feil hvis fila ikke ser ut som en eksport fra denne appen. */
  parseImport(text) {
    let d;
    try { d = JSON.parse(text); } catch { throw new Error('Fila er ikke gyldig JSON.'); }
    if (!d || typeof d !== 'object' || !Array.isArray(d.items) || !Array.isArray(d.categories)) {
      throw new Error('Fila ser ikke ut som en eksport fra Kjøp eller dropp.');
    }
    return normalize(d);
  },

  replaceAll(clean) {
    state = clean;
    commit();
  },

  /** Ber Safari om å ikke rydde bort dataene våre. Ingen garanti, derfor eksport. */
  async requestPersist() {
    try {
      if (navigator.storage?.persist && !(await navigator.storage.persisted())) {
        await navigator.storage.persist();
      }
    } catch { /* ikke støttet */ }
  },
};
