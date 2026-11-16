// Sammenlign: to alternativer side om side, hvem gir lavest kostnad per bruk?

import { store } from '../store.js';
import { totalUses } from '../calc.js';
import { esc, kr, parseNum, formatTyping, formatInput } from '../format.js';
import { openSheet, closeSheet } from '../ui.js';
import { lifeOptions, freqOptions, itemRow } from './shared.js';

let el;
const blank = () => ({ name: '', price: 0, resale: 0, lifespanMonths: 24, frequency: 'weekly', times: 0 });
const opts = { a: blank(), b: blank() };

function cpuOf(o) {
  if (!(o.price > 0)) return null;
  const net = o.price - Math.min(o.price, o.resale || 0);
  const uses = totalUses(o);
  return { cpu: net / uses, uses, net };
}

function card(key) {
  return `
    <div class="cmp-card" id="cmp-${key}">
      <div class="cmp-head">
        <span class="cmp-letter">${key.toUpperCase()}</span>
        <button type="button" class="link" data-pick="${key}">Hent fra lagret</button>
      </div>
      <input class="field field--sm" data-k="name" placeholder="Navn" autocomplete="off" aria-label="Navn ${key.toUpperCase()}">
      <label class="cmp-price"><input data-k="price" inputmode="decimal" placeholder="0" autocomplete="off" aria-label="Pris ${key.toUpperCase()}"><span>kr</span></label>
      <label class="cmp-lbl">Levetid<select class="select" data-k="lifespanMonths">${lifeOptions(24)}</select></label>
      <label class="cmp-lbl">Hvor ofte<select class="select" data-k="frequency">${freqOptions('weekly')}</select></label>
      <div class="cmp-pair">
        <label class="cmp-lbl">Ganger<input class="mini" data-k="times" inputmode="numeric" placeholder="1" autocomplete="off"></label>
        <label class="cmp-lbl">FINN kr<input class="mini" data-k="resale" inputmode="decimal" placeholder="0" autocomplete="off"></label>
      </div>
      <div class="cmp-out" aria-live="polite"></div>
    </div>`;
}

export function mount(root) {
  el = root;
  el.innerHTML = `
    <h1 class="page-title">Sammenlign</h1>
    <p class="hint" style="margin:-10px 0 14px">Hvilken gir lavest kostnad per bruk?</p>
    <div class="cmp-grid">${card('a')}${card('b')}</div>
    <div class="card cmp-result" id="cmp-result"></div>
    <button type="button" class="btn btn--ghost btn--block" id="cmp-reset">Nullstill</button>`;

  el.addEventListener('input', (e) => {
    const input = e.target.closest('[data-k]');
    if (!input) return;
    const key = input.closest('.cmp-card').id.slice(4);
    const k = input.dataset.k;
    const o = opts[key];
    if (k === 'price' || k === 'resale') { input.value = formatTyping(input.value); o[k] = parseNum(input.value); }
    else if (k === 'times') { input.value = input.value.replace(/\D/g, '').replace(/^0+/, '').slice(0, 4); o.times = Number(input.value) || 0; }
    else if (k === 'lifespanMonths') o.lifespanMonths = Number(input.value);
    else o[k] = input.value;
    render();
  });

  el.addEventListener('click', (e) => {
    const pick = e.target.closest('[data-pick]');
    if (pick) pickFromSaved(pick.dataset.pick);
  });

  el.querySelector('#cmp-reset').addEventListener('click', () => {
    opts.a = blank(); opts.b = blank();
    fill('a'); fill('b'); render();
  });

  render();
}

function fill(key) {
  const o = opts[key];
  const c = el.querySelector(`#cmp-${key}`);
  c.querySelector('[data-k=name]').value = o.name;
  c.querySelector('[data-k=price]').value = formatInput(o.price);
  c.querySelector('[data-k=resale]').value = formatInput(o.resale);
  c.querySelector('[data-k=times]').value = o.times || '';
  c.querySelector('[data-k=lifespanMonths]').value = String(o.lifespanMonths);
  c.querySelector('[data-k=frequency]').value = o.frequency;
}

function pickFromSaved(key) {
  const items = [...store.items].sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
  const body = items.length
    ? `<div class="list">${items.map((it) => itemRow(it)).join('')}</div>`
    : '<p class="empty">Du har ikke lagret noe ennå.</p>';
  openSheet(`
    <div class="sheet-top"><h2>Hent til ${key.toUpperCase()}</h2><button type="button" class="btn btn--ghost" data-close>Lukk</button></div>
    ${body}`, {
    label: `Hent til ${key.toUpperCase()}`,
    onMount(sheet) {
      sheet.addEventListener('click', (e) => {
        const row = e.target.closest('.item');
        const it = row && store.items.find((i) => i.id === row.dataset.id);
        if (!it) return;
        opts[key] = {
          name: it.name || store.category(it.categoryId).name,
          price: it.price, resale: it.resale || 0,
          lifespanMonths: it.lifespanMonths, frequency: it.frequency, times: it.times || 0,
        };
        fill(key);
        render();
        closeSheet();
      });
    },
  });
}

function render() {
  const res = { a: cpuOf(opts.a), b: cpuOf(opts.b) };
  for (const key of ['a', 'b']) {
    const out = el.querySelector(`#cmp-${key} .cmp-out`);
    const r = res[key];
    out.innerHTML = r
      ? `<b>${kr(r.cpu)}</b><small>per bruk · ${Math.round(r.uses).toLocaleString('nb-NO')} bruk</small>`
      : '<small>Legg inn pris</small>';
  }

  const box = el.querySelector('#cmp-result');
  const ca = el.querySelector('#cmp-a');
  const cb = el.querySelector('#cmp-b');
  ca.classList.remove('is-winner'); cb.classList.remove('is-winner');

  if (!res.a || !res.b) {
    box.innerHTML = '<p class="muted" style="margin:0">Fyll inn pris på begge for å se hvem som vinner.</p>';
    return;
  }
  const label = (k) => esc(opts[k].name.trim() || k.toUpperCase());
  const diff = Math.abs(res.a.cpu - res.b.cpu);
  if (diff < 0.005) {
    box.innerHTML = '<p class="cmp-verdict">Like dyre per bruk</p>';
    return;
  }
  const win = res.a.cpu < res.b.cpu ? 'a' : 'b';
  const lose = win === 'a' ? 'b' : 'a';
  (win === 'a' ? ca : cb).classList.add('is-winner');
  const pct = Math.round((diff / res[lose].cpu) * 100);
  const priceDiff = opts[win].price - opts[lose].price;
  const priceText = priceDiff > 0
    ? `${label(win)} koster ${kr(priceDiff)} mer i kjøp, men lønner seg over tid.`
    : priceDiff < 0
      ? `${label(win)} er også ${kr(-priceDiff)} billigere i kjøp.`
      : 'De koster det samme i kjøp.';

  box.innerHTML = `
    <span class="eyebrow">Lavest per bruk</span>
    <p class="cmp-verdict">${label(win)}</p>
    <p class="cmp-diff"><b>${kr(diff)}</b> mindre per bruk (${pct} % billigere)</p>
    <p class="muted" style="margin:6px 0 0">${priceText}</p>`;
}
