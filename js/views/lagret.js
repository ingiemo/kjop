// Lagret: alle registrerte ting, søk og filter på vurdering, sortert på kostnad per bruk.
// Øverst: ting som er ferdige med tenketiden, og kjøp som er klare for «bruker du den fortsatt?».
// Kjøpte ting har +1 for faktisk bruk.

import { store } from '../store.js';
import { esc, kr, monthShort } from '../format.js';
import { dueItems, addDays, followUpItems, nextFollowUp } from '../stats.js';
import { toast } from '../ui.js';
import { evalItem, itemRow, displayName, registerUse, droppedToast } from './shared.js';
import { openItemEditor } from './itemform.js';

const FILTERS = [['all', 'Alle'], ['kjop', 'Kjøp'], ['tenk', 'Tenk deg om'], ['dropp', 'Dropp']];
const DAY = 864e5;
let el;
let query = '';
let filter = 'all';

export function mount(root) {
  el = root;
  el.innerHTML = `
    <h1 class="page-title">Lagret</h1>
    <div id="l-due"></div>
    <div id="l-follow"></div>
    <input type="search" id="l-q" class="field search" placeholder="Søk" autocomplete="off" enterkeyhint="search" aria-label="Søk i lagrede ting">
    <div class="chips" id="l-filter" role="radiogroup" aria-label="Filtrer på vurdering"></div>
    <div id="l-list" class="list"></div>`;

  el.querySelector('#l-q').addEventListener('input', (e) => { query = e.target.value.trim().toLowerCase(); render(); });
  el.querySelector('#l-filter').addEventListener('click', (e) => {
    const b = e.target.closest('[data-f]');
    if (!b) return;
    filter = b.dataset.f;
    render();
  });
  el.addEventListener('click', (e) => {
    const use = e.target.closest('[data-use]');
    if (use) { registerUse(use.dataset.use); return; }
    const due = e.target.closest('[data-due]');
    if (due) { decide(due.closest('[data-item]').dataset.item, due.dataset.due); return; }
    const ans = e.target.closest('[data-answer]');
    if (ans) { answer(ans.closest('[data-item]').dataset.item, ans.dataset.answer); return; }
    const row = e.target.closest('.item');
    const it = row && store.items.find((i) => i.id === row.dataset.id);
    if (it) openItemEditor(it);
  });
  store.subscribe(() => { if (!el.hidden) render(); });
}

export function show() { render(); }

function decide(id, action) {
  const it = store.items.find((i) => i.id === id);
  if (!it) return;
  const now = new Date().toISOString();
  const wd = store.settings.waitDays;
  if (action === 'wait') {
    store.updateItem(id, { waitUntil: addDays(wd) });
    toast(`Greit, jeg spør igjen om ${wd} dager`);
  } else if (action === 'bought') {
    store.updateItem(id, { status: 'bought', decidedAt: now, waited: true });
    toast('Registrert som kjøpt');
  } else {
    store.updateItem(id, { status: 'dropped', decidedAt: now, waited: true });
    droppedToast(it.price, 'Droppet etter tenketid!');
  }
}

/** Svar på «bruker du den fortsatt?». */
function answer(id, value) {
  const it = store.items.find((i) => i.id === id);
  if (!it) return;
  store.updateItem(id, { stillUsing: value, followUpAt: nextFollowUp(it, value) });
  if (value === 'yes') toast('Så bra! 👏');
  else if (value === 'sometimes') toast('Notert. Jeg spør igjen om en stund');
  else toast(it.resale > 0
    ? `Kanskje noe for FINN? Du anslo ${kr(it.resale)}`
    : 'Notert. Du finner den under «Ikke i bruk» i Spart');
}

const MAX_FOLLOW_UPS = 3; // ikke la en lang liste drukne resten av fanen

function renderFollowUp() {
  const list = followUpItems(store.items);
  const box = el.querySelector('#l-follow');
  if (!list.length) { box.innerHTML = ''; return; }
  const shown = list.slice(0, MAX_FOLLOW_UPS);
  box.innerHTML = `
    <div class="card due">
      <span class="label">Oppfølging</span>
      <p class="hint" style="margin:2px 0 4px">Bruker du ${shown.length === 1 ? 'denne' : 'disse'} fortsatt?</p>
      ${shown.map((it) => {
        const cat = store.category(it.categoryId);
        const n = it.actualUses || 0;
        const month = monthShort(it.decidedAt || it.createdAt);
        return `
          <div class="due-item" data-item="${esc(it.id)}">
            <div class="due-top">
              <span aria-hidden="true">${esc(cat.emoji)}</span>
              <b>${esc(displayName(it, cat))}</b>
              <span class="mini-val">${kr(it.price)}</span>
            </div>
            <small class="muted">${esc(`Kjøpt ${month} · ${n ? `${n}× brukt` : 'ingen bruk registrert'}`)}</small>
            <div class="due-actions">
              <button type="button" class="btn" data-answer="yes">Ja</button>
              <button type="button" class="btn" data-answer="sometimes">Av og til</button>
              <button type="button" class="btn" data-answer="no">Nei</button>
            </div>
          </div>`;
      }).join('')}
      ${list.length > shown.length ? `<p class="muted mini-more">+ ${list.length - shown.length} til etter disse</p>` : ''}
    </div>`;
}

function renderDue() {
  const due = dueItems(store.items, store.settings.waitDays);
  const box = el.querySelector('#l-due');
  if (!due.length) { box.innerHTML = ''; return; }
  box.innerHTML = `
    <div class="card due">
      <span class="label">Tenketiden er over</span>
      <p class="hint" style="margin:2px 0 4px">Vil du fortsatt ha ${due.length === 1 ? 'denne' : 'disse'}?</p>
      ${due.map((it) => {
        const { cat, r } = evalItem(it);
        const waited = Math.max(1, Math.round((Date.now() - new Date(it.createdAt)) / DAY));
        return `
          <div class="due-item" data-item="${esc(it.id)}">
            <div class="due-top">
              <span aria-hidden="true">${esc(cat.emoji)}</span>
              <b>${esc(displayName(it, cat))}</b>
              <span class="mini-val">${kr(it.price)}</span>
            </div>
            <small class="muted">Ventet i ${waited} ${waited === 1 ? 'dag' : 'dager'} · ${kr(r.cpu)} per bruk</small>
            <div class="due-actions">
              <button type="button" class="btn${r.verdict === 'kjop' ? ' is-suggested' : ''}" data-due="bought">Kjøp</button>
              <button type="button" class="btn${r.verdict === 'dropp' ? ' is-suggested' : ''}" data-due="dropped">Dropp</button>
              <button type="button" class="btn btn--ghost" data-due="wait">Vent mer</button>
            </div>
          </div>`;
      }).join('')}
    </div>`;
}

function render() {
  renderDue();
  renderFollowUp();
  const all = store.items.map((it) => ({ it, ...evalItem(it) }));
  const searched = all.filter(({ it, cat }) => !query
    || displayName(it, cat).toLowerCase().includes(query)
    || cat.name.toLowerCase().includes(query));
  const count = (f) => searched.filter((x) => f === 'all' || x.r.verdict === f).length;

  el.querySelector('#l-filter').innerHTML = FILTERS.map(([k, l]) => `
    <button type="button" class="chip" role="radio" data-f="${k}" aria-checked="${k === filter}">
      ${l}<span class="chip-count">${count(k)}</span>
    </button>`).join('');

  const rows = searched
    .filter((x) => filter === 'all' || x.r.verdict === filter)
    .sort((a, b) => a.r.cpu - b.r.cpu);

  const list = el.querySelector('#l-list');
  if (!store.items.length) {
    list.innerHTML = `
      <div class="empty-state">
        <div class="big" aria-hidden="true">🧾</div>
        <h2>Ingenting her ennå</h2>
        <p>Regn ut noe i kalkulatoren og trykk «Jeg kjøpte det», «Jeg droppet det» eller «Lagre til senere».</p>
        <a class="btn btn--inline" href="#kalkulator">Til kalkulatoren</a>
      </div>`;
    return;
  }
  if (!rows.length) {
    list.innerHTML = `<p class="empty">Ingen treff${query ? ` på «${esc(query)}»` : ''}.</p>`;
    return;
  }
  list.innerHTML = rows.map(({ it }) => itemRow(it, { plus: true })).join('');
}
