// Kalkulator: pris, navn, kategori, levetid, frekvens, FINN-verdi -> resultat.

import { store, uid } from '../store.js';
import { evaluate, FREQ, VERDICT } from '../calc.js';
import { kr, num, parseNum, formatTyping, dateLong, lifespanText, hoursText, workdayText, esc } from '../format.js';
import { openSheet, closeSheet, toast } from '../ui.js';
import { guessCategory } from '../guess.js';
import { treatUsedThisMonth, monthName, addDays } from '../stats.js';
import { droppedToast } from './shared.js';

const MAX_MONTHS = 120;
let el;
let state;

const $ = (sel) => el.querySelector(sel);

function defaultCategoryId() {
  return store.categories.find((c) => c.id === 'annet')?.id ?? store.categories[0]?.id;
}

// categoryMode: 'default' (Annet), 'guessed' (fra navnet) eller 'manual' (valgt selv)
// touchedLife/touchedFreq: har du endret levetid/frekvens selv? Da overstyrer ikke kategoriforslaget.
function freshState() {
  const cat = store.category(defaultCategoryId());
  return {
    price: 0, name: '', resale: 0, times: 0,
    lifespanMonths: cat?.defLife ?? 24, frequency: cat?.defFreq ?? 'weekly',
    touchedLife: false, touchedFreq: false,
    categoryId: defaultCategoryId(), categoryMode: 'default',
  };
}

/** Bruk kategoriens forslag til levetid og frekvens, så lenge du ikke har endret dem selv. */
function applyCategoryDefaults() {
  const cat = store.category(state.categoryId);
  if (!cat) return;
  if (!state.touchedLife) { state.lifespanMonths = cat.defLife; syncLife(); }
  if (!state.touchedFreq) { state.frequency = cat.defFreq; syncFreq(); }
}

function applyGuess() {
  if (state.categoryMode === 'manual') return;
  const guess = guessCategory(state.name, store.categories);
  const next = guess || defaultCategoryId();
  const mode = guess ? 'guessed' : 'default';
  if (next === state.categoryId && mode === state.categoryMode) return;
  state.categoryId = next;
  state.categoryMode = mode;
  renderChips(true);
  applyCategoryDefaults();
}

export function mount(root) {
  el = root;
  state = freshState();

  el.innerHTML = `
    <label class="price" for="c-price">
      <span class="eyebrow">Hva koster det?</span>
      <span class="price-row">
        <input id="c-price" inputmode="decimal" placeholder="0" autocomplete="off" enterkeyhint="next" aria-label="Pris i kroner">
        <span class="unit">kr</span>
      </span>
    </label>

    <input id="c-name" class="field" placeholder="Hva er det? F.eks. regnjakke" autocomplete="off" autocapitalize="sentences" enterkeyhint="done" aria-label="Navn">

    <div class="chips" id="c-chips" role="radiogroup" aria-label="Kategori"></div>
    <p class="limits" id="c-limits"></p>

    <div class="card">
      <div class="life-head">
        <div>
          <h2 class="label">Levetid</h2>
          <p class="hint">Hvor lenge du regner med å bruke den</p>
        </div>
        <output class="life-out" id="c-life-out" for="c-life"></output>
      </div>
      <div class="slider-row">
        <button type="button" class="step" data-step="-1" aria-label="En måned kortere">−</button>
        <input type="range" id="c-life" min="0" max="${MAX_MONTHS}" step="1" aria-label="Levetid i måneder">
        <button type="button" class="step" data-step="1" aria-label="En måned lengre">+</button>
      </div>
      <div class="range-ends"><span>0 mnd</span><span>10 år</span></div>

      <hr>

      <h2 class="label">Hvor ofte</h2>
      <div class="seg" id="c-freq" role="radiogroup" aria-label="Hvor ofte">
        ${Object.entries(FREQ).map(([k, f]) => `<button type="button" role="radio" data-freq="${k}">${f.label}</button>`).join('')}
      </div>
      <label class="row-field" style="margin-top:8px">
        <span>Antall ganger<small id="c-times-per"></small></span>
        <span class="num-input"><input id="c-times" inputmode="numeric" placeholder="1" autocomplete="off" enterkeyhint="done"><span>×</span></span>
      </label>

      <hr>

      <label class="row-field">
        <span>Kan selges brukt for<small>FINN-verdi, trekkes fra prisen</small></span>
        <span class="num-input"><input id="c-resale" inputmode="decimal" placeholder="0" autocomplete="off" enterkeyhint="done"><span>kr</span></span>
      </label>
    </div>

    <button type="button" class="primary" id="c-go" disabled>Er det verdt det?</button>
  `;

  // Pris
  const price = $('#c-price');
  price.addEventListener('input', () => {
    price.value = formatTyping(price.value);
    state.price = parseNum(price.value);
    sizePrice();
    updateGo();
  });
  price.addEventListener('keydown', (e) => { if (e.key === 'Enter') $('#c-name').focus(); });

  // Navn
  const name = $('#c-name');
  name.addEventListener('input', () => { state.name = name.value; applyGuess(); });
  name.addEventListener('keydown', (e) => { if (e.key === 'Enter') name.blur(); });

  // Kategori
  $('#c-chips').addEventListener('click', (e) => {
    const chip = e.target.closest('.chip');
    if (!chip) return;
    state.categoryId = chip.dataset.id;
    state.categoryMode = 'manual';
    renderChips();
    applyCategoryDefaults();
  });

  // Levetid
  const life = $('#c-life');
  life.addEventListener('input', () => { state.lifespanMonths = Number(life.value); state.touchedLife = true; syncLife(); });
  el.querySelectorAll('[data-step]').forEach((b) => b.addEventListener('click', () => {
    state.lifespanMonths = Math.min(MAX_MONTHS, Math.max(0, state.lifespanMonths + Number(b.dataset.step)));
    state.touchedLife = true;
    syncLife();
  }));

  // Frekvens
  $('#c-freq').addEventListener('click', (e) => {
    const b = e.target.closest('[data-freq]');
    if (!b) return;
    state.frequency = b.dataset.freq;
    state.touchedFreq = true;
    syncFreq();
  });
  const times = $('#c-times');
  times.addEventListener('input', () => {
    times.value = times.value.replace(/\D/g, '').replace(/^0+/, '').slice(0, 4);
    state.times = Number(times.value) || 0;
  });

  // FINN
  const resale = $('#c-resale');
  resale.addEventListener('input', () => {
    resale.value = formatTyping(resale.value);
    state.resale = parseNum(resale.value);
  });

  $('#c-go').addEventListener('click', showResult);

  store.subscribe(() => {
    if (!store.categories.some((c) => c.id === state.categoryId)) {
      state.categoryId = defaultCategoryId();
      state.categoryMode = 'default';
    }
    renderChips();
  });

  syncAll();
}

function syncAll() {
  $('#c-price').value = state.price ? formatTyping(String(state.price).replace('.', ',')) : '';
  $('#c-name').value = state.name;
  $('#c-times').value = state.times || '';
  $('#c-resale').value = state.resale ? formatTyping(String(state.resale).replace('.', ',')) : '';
  sizePrice();
  renderChips(true);
  syncLife();
  syncFreq();
  updateGo();
}

function sizePrice() {
  const input = $('#c-price');
  const len = Math.max(1, input.value.length);
  input.classList.toggle('long', len > 7);
  input.style.width = `${len * 0.62 + 0.15}em`;
}

function updateGo() {
  $('#c-go').disabled = !(state.price > 0);
}

function renderChips(scrollToSelected = false) {
  const wrap = $('#c-chips');
  const keep = wrap.scrollLeft;
  // Annet først, siden den er standardvalget. Resten i vanlig rekkefølge.
  const ordered = [...store.categories].sort((a, b) => (b.id === 'annet') - (a.id === 'annet'));
  wrap.innerHTML = ordered.map((c) => `
    <button type="button" class="chip" role="radio" aria-checked="${c.id === state.categoryId}" data-id="${esc(c.id)}">
      <span aria-hidden="true">${esc(c.emoji)}</span>${esc(c.name)}
    </button>`).join('');
  wrap.scrollLeft = keep;

  if (scrollToSelected) {
    const chip = wrap.querySelector('[aria-checked="true"]');
    if (chip) {
      const target = chip.offsetLeft - (wrap.clientWidth - chip.offsetWidth) / 2;
      wrap.scrollTo({ left: Math.max(0, target), behavior: el.offsetParent ? 'smooth' : 'auto' });
    }
  }

  const cat = store.category(state.categoryId);
  const guessed = state.categoryMode === 'guessed'
    ? `<span class="guessed">Gjettet ut fra navnet – trykk for å endre</span>` : '';
  $('#c-limits').innerHTML = cat
    ? `${guessed}<b class="k">Kjøp</b> under ${kr(cat.buyBelow)} · <b class="d">Dropp</b> over ${kr(cat.dropAbove)} per bruk`
    : '';
}

function syncLife() {
  const life = $('#c-life');
  life.value = state.lifespanMonths;
  life.style.setProperty('--p', `${(state.lifespanMonths / MAX_MONTHS) * 100}%`);
  $('#c-life-out').textContent = lifespanText(state.lifespanMonths);
}

function syncFreq() {
  el.querySelectorAll('[data-freq]').forEach((b) => {
    b.setAttribute('aria-checked', String(b.dataset.freq === state.frequency));
  });
  $('#c-times-per').textContent = state.frequency === 'once'
    ? 'Totalt i hele levetiden'
    : `${FREQ[state.frequency].per[0].toUpperCase()}${FREQ[state.frequency].per.slice(1)} (tom = 1)`;
}

// ---------- Resultat ----------

function worthText(r) {
  const w = r.worth;
  if (w.kind === 'now') return { main: 'Med en gang', sub: 'Den koster deg ingenting netto' };
  if (w.kind === 'uses') return { main: `Etter ${num(w.needed)} bruk`, sub: '' };
  if (w.kind === 'date') return { main: dateLong(w.date), sub: `etter ${num(w.needed)} bruk` };
  if (w.needed) return { main: 'Når ikke grensen', sub: `trenger ${num(w.needed)} bruk, får ${num(r.uses)}` };
  return { main: 'Når ikke grensen', sub: '' };
}

function whyText(r, cat) {
  if (r.verdict === 'kjop') return `Under kjøpsgrensen på ${kr(cat.buyBelow)} per bruk for ${cat.name}.`;
  if (r.verdict === 'dropp') return `Over droppgrensen på ${kr(cat.dropAbove)} per bruk for ${cat.name}.`;
  return `Mellom ${kr(cat.buyBelow)} og ${kr(cat.dropAbove)} per bruk for ${cat.name}.`;
}

function freqSummary() {
  const f = FREQ[state.frequency];
  const n = state.times > 0 ? state.times : 1;
  if (state.frequency === 'once') return `${n} ${n === 1 ? 'gang' : 'ganger'} totalt`;
  if (n === 1) return f.label.toLowerCase();
  return `${n} ganger ${f.per}`;
}

// «Unn meg det» vises bare når vurderingen ikke er Kjøp og en kvote er satt.
function treatLeft() {
  const budget = store.settings.treatBudget;
  return budget > 0 ? budget - treatUsedThisMonth(store.items) : null;
}

function treatButton(r) {
  if (r.verdict === 'kjop' || treatLeft() == null) return '';
  return '<button type="button" class="btn btn--wide btn--treat" data-act="treat">Unn meg det</button>';
}

function treatNote(r) {
  const left = treatLeft();
  if (r.verdict === 'kjop' || left == null) return '';
  const after = left - r.price;
  const text = after >= 0
    ? `Igjen å unne deg i ${monthName()}: ${kr(left)}. Etter dette: ${kr(after)}.`
    : `Igjen å unne deg i ${monthName()}: ${kr(Math.max(0, left))}. Dette går ${kr(-after)} over kvoten.`;
  return `<p class="note">${text}</p>`;
}

function showResult() {
  if (!(state.price > 0)) return;
  const cat = store.category(state.categoryId);
  const wage = store.settings.hourlyWage;
  const r = evaluate(state, cat, wage);
  const v = VERDICT[r.verdict];
  const worth = worthText(r);
  const title = state.name.trim() || `${cat.emoji} ${cat.name}`;

  const hoursCell = r.hours != null
    ? `<dd>${hoursText(r.hours)}</dd><small>${workdayText(r.hours) ? `${workdayText(r.hours)} · ` : 'med '}${kr(wage)}/t</small>`
    : `<dd>–</dd><small><a href="#innstillinger">Legg inn timelønn</a></small>`;

  const html = `
    <div class="sheet-top">
      <h2>${esc(title)}</h2>
      <button type="button" class="btn btn--ghost" data-close>Lukk</button>
    </div>

    <div class="verdict verdict--${r.verdict}">
      <span class="badge">${v.label}</span>
      <span class="cpu-num">${kr(r.cpu)}</span>
      <span class="cpu-lbl">per bruk</span>
      <p class="verdict-why">${esc(whyText(r, cat))}</p>
    </div>

    <dl class="stats">
      <div><dt>Bruk totalt</dt><dd>${num(r.uses)}</dd><small>${esc(freqSummary())}, ${esc(lifespanText(state.lifespanMonths))}</small></div>
      <div><dt>Per måned</dt><dd>${r.perMonth != null ? kr(r.perMonth) : '–'}</dd><small>${r.perMonth != null ? 'over levetiden' : 'levetid er 0'}</small></div>
      <div><dt>Verdt det fra</dt><dd class="sm">${esc(worth.main)}</dd><small>${esc(worth.sub)}</small></div>
      <div><dt>Arbeidstid</dt>${hoursCell}</div>
    </dl>

    ${r.resale > 0 ? `<p class="note">Regnet med ${kr(r.net)}: pris ${kr(r.price)} minus ${kr(r.resale)} fra FINN.</p>` : ''}

    <div class="actions">
      <button type="button" class="btn ${r.verdict === 'kjop' ? 'is-suggested' : ''}" data-act="bought">Jeg kjøpte det</button>
      <button type="button" class="btn ${r.verdict === 'dropp' ? 'is-suggested' : ''}" data-act="dropped">Jeg droppet det</button>
      ${treatButton(r)}
      <button type="button" class="btn btn--wide ${r.verdict === 'tenk' ? 'is-suggested' : ''}" data-act="saved">Lagre til senere</button>
    </div>
    ${treatNote(r)}`;

  openSheet(html, {
    label: `Resultat for ${title}`,
    onMount(sheet) {
      sheet.querySelectorAll('[data-act]').forEach((b) => {
        b.addEventListener('click', () => record(b.dataset.act, r, cat));
      });
    },
  });
}

function record(action, r, cat) {
  const now = new Date().toISOString();
  const status = action === 'treat' ? 'bought' : action;
  const leftBefore = treatLeft();
  store.addItem({
    id: uid(),
    name: state.name.trim(),
    price: r.price,
    resale: r.resale,
    categoryId: cat.id,
    lifespanMonths: state.lifespanMonths,
    frequency: state.frequency,
    times: state.times > 0 ? state.times : null,
    status,
    treat: action === 'treat',
    createdAt: now,
    decidedAt: status === 'saved' ? null : now,
    waitUntil: status === 'saved' ? addDays(store.settings.waitDays) : null,
  });
  store.requestPersist();
  closeSheet();

  const msg = {
    bought: 'Registrert som kjøpt',
    dropped: null, // eget varsel med sparemål
    saved: `Lagret. Jeg spør deg igjen om ${store.settings.waitDays} dager`,
    treat: (leftBefore ?? 0) - r.price >= 0
      ? `Unnet! Igjen i ${monthName()}: ${kr((leftBefore ?? 0) - r.price)}`
      : `Unnet – ${kr(r.price - (leftBefore ?? 0))} over kvoten i ${monthName()}`,
  }[action];
  if (action === 'dropped') droppedToast(r.price);
  else toast(msg);

  state = freshState();
  syncAll();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}
