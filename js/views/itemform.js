// Ark for å redigere eller slette en lagret ting.

import { store } from '../store.js';
import { evaluate, FREQ, VERDICT, expectedUsesSoFar, actualCpu, altPerUse } from '../calc.js';
import { esc, kr, num, parseNum, formatTyping, formatInput } from '../format.js';
import { openSheet, closeSheet, toast } from '../ui.js';
import { addDays } from '../stats.js';
import { STATUS_LABEL, statusKey, lifeOptions, freqOptions, categoryOptions, shareOptions, displayName } from './shared.js';

/** Faktisk bruk sammenlignet med anslaget så langt. */
function usageHtml(it) {
  const r = evaluate(it, store.category(it.categoryId), null);
  const expected = expectedUsesSoFar(it);
  const actual = it.actualUses || 0;
  const now = actualCpu(it);
  let trend = '';
  if (expected >= 3) {
    const ratio = actual / expected;
    trend = ratio >= 1 ? 'Du bruker den mer enn du anslo 👏'
      : ratio >= 0.7 ? 'Omtrent som du anslo'
        : 'Du bruker den mindre enn du anslo';
  }
  return `
    <div class="usage-row">
      <button type="button" class="step" data-use="-1" aria-label="Én bruk mindre">−</button>
      <div class="usage-num"><b>${num(actual)}</b><small>ganger brukt</small></div>
      <button type="button" class="step step--accent" data-use="1" aria-label="Én bruk til">+</button>
    </div>
    <dl class="stats stats--tight">
      <div><dt>Per bruk nå</dt><dd>${now != null ? kr(now) : '–'}</dd><small>anslått ${kr(r.grossCpu)} totalt</small></div>
      <div><dt>Anslått så langt</dt><dd>${num(expected)} bruk</dd><small>av ${num(r.uses)} i hele levetiden</small></div>
      ${r.alt > 0 ? `<div class="wide"><dt>Spart mot alternativet så langt</dt><dd>${kr(actual * r.alt)}</dd>
        <small>${actual * r.alt >= r.net ? 'Kjøpet har tjent seg inn 🎉' : `${kr(r.net - actual * r.alt)} igjen til det har tjent seg inn`}</small></div>` : ''}
    </dl>
    ${trend ? `<p class="note" style="margin-top:10px">${trend}</p>` : ''}`;
}

export function openItemEditor(item) {
  const startKey = statusKey(item);

  const html = `
    <div class="sheet-top">
      <h2>Rediger</h2>
      <button type="button" class="btn btn--ghost" data-close>Lukk</button>
    </div>

    <div class="preview" id="e-preview"></div>

    ${item.status === 'bought' ? `
      <h3 class="section-title" style="margin-top:4px">Faktisk bruk</h3>
      <div class="card" id="e-usage">${usageHtml(item)}</div>
      <h3 class="section-title">Detaljer</h3>` : ''}

    <div class="card form">
      <input id="e-name" class="field field--left" placeholder="Navn" value="${esc(item.name)}" autocomplete="off" aria-label="Navn">
      <label class="row-field"><span>Pris</span>
        <span class="num-input"><input id="e-price" inputmode="decimal" value="${formatInput(item.price)}" autocomplete="off"><span>kr</span></span></label>
      <label class="row-field"><span>Kategori</span><select id="e-cat" class="select">${categoryOptions(item.categoryId)}</select></label>
      <label class="row-field"><span>Levetid</span><select id="e-life" class="select">${lifeOptions(item.lifespanMonths)}</select></label>
      <label class="row-field"><span>Hvor ofte</span><select id="e-freq" class="select">${freqOptions(item.frequency)}</select></label>
      <label class="row-field"><span>Antall ganger<small id="e-per"></small></span>
        <span class="num-input"><input id="e-times" inputmode="numeric" placeholder="1" value="${item.times || ''}" autocomplete="off"><span>×</span></span></label>
      <label class="row-field"><span>FINN-verdi</span>
        <span class="num-input"><input id="e-resale" inputmode="decimal" placeholder="0" value="${formatInput(item.resale)}" autocomplete="off"><span>kr</span></span></label>
      <label class="row-field"><span>Alternativet koster<small>Per gang</small></span>
        <span class="num-input"><input id="e-alt" inputmode="decimal" placeholder="0" value="${formatInput(item.altCost)}" autocomplete="off"><span>kr</span></span></label>
      <label class="row-field"><span>Erstatter det</span><select id="e-share" class="select">${shareOptions(item.altShare ?? 1)}</select></label>
    </div>

    <h3 class="section-title">Status</h3>
    <div class="seg seg--4" id="e-status" role="radiogroup" aria-label="Status">
      ${Object.entries(STATUS_LABEL).map(([k, l]) => `<button type="button" role="radio" data-s="${k}" aria-checked="${k === startKey}">${l}</button>`).join('')}
    </div>

    <div class="actions">
      <button type="button" class="btn btn--danger" data-del>Slett</button>
      <button type="button" class="btn is-suggested" data-save>Lagre</button>
    </div>`;

  openSheet(html, {
    label: 'Rediger',
    onMount(sheet) {
      const $ = (s) => sheet.querySelector(s);
      let key = startKey;

      const read = () => ({
        name: $('#e-name').value.trim(),
        price: parseNum($('#e-price').value),
        resale: parseNum($('#e-resale').value),
        categoryId: $('#e-cat').value,
        lifespanMonths: Number($('#e-life').value),
        frequency: $('#e-freq').value,
        times: Number($('#e-times').value) || null,
        altCost: parseNum($('#e-alt').value),
        altShare: Number($('#e-share').value),
      });

      const update = () => {
        const f = read();
        $('#e-per').textContent = f.frequency === 'once' ? 'Totalt' : FREQ[f.frequency].per;
        const cat = store.category(f.categoryId);
        const r = evaluate(f, cat, store.settings.hourlyWage);
        const p = $('#e-preview');
        p.className = `preview v-${r.verdict}`;
        p.innerHTML = f.price > 0
          ? `<span class="pill">${VERDICT[r.verdict].label}</span>${r.pays
            ? `<b>Sparer ${kr(-r.cpu)}</b><span class="muted">per bruk</span>`
            : `<b>${kr(r.cpu)}</b><span class="muted">per bruk</span>`}`
          : '<span class="muted">Legg inn en pris</span>';
        $('#e-share').closest('.row-field').hidden = !(f.altCost > 0);
      };

      ['#e-price', '#e-resale', '#e-alt'].forEach((s) => $(s).addEventListener('input', (e) => {
        e.target.value = formatTyping(e.target.value); update();
      }));
      $('#e-times').addEventListener('input', (e) => {
        e.target.value = e.target.value.replace(/\D/g, '').replace(/^0+/, '').slice(0, 4); update();
      });
      ['#e-name', '#e-cat', '#e-life', '#e-freq', '#e-share'].forEach((s) => $(s).addEventListener('input', update));

      $('#e-status').addEventListener('click', (e) => {
        const b = e.target.closest('[data-s]');
        if (!b) return;
        key = b.dataset.s;
        sheet.querySelectorAll('[data-s]').forEach((x) => x.setAttribute('aria-checked', String(x === b)));
      });

      $('#e-usage')?.addEventListener('click', (e) => {
        const b = e.target.closest('[data-use]');
        if (!b) return;
        const updated = store.addUse(item.id, Number(b.dataset.use));
        if (updated) $('#e-usage').innerHTML = usageHtml(updated);
      });

      $('[data-save]').addEventListener('click', () => {
        const f = read();
        if (!(f.price > 0)) { toast('Prisen må være over 0 kr'); return; }
        const status = key === 'treat' ? 'bought' : key;
        let { decidedAt, waitUntil } = item;
        if (key !== startKey) {
          decidedAt = status === 'saved' ? null : new Date().toISOString();
          waitUntil = status === 'saved' ? addDays(store.settings.waitDays) : null;
        }
        store.updateItem(item.id, { ...f, status, treat: key === 'treat', decidedAt, waitUntil });
        closeSheet();
        toast('Lagret');
      });

      $('[data-del]').addEventListener('click', () => {
        const name = displayName(item, store.category(item.categoryId));
        if (!confirm(`Slette «${name}»? Dette kan ikke angres.`)) return;
        store.deleteItem(item.id);
        closeSheet();
        toast('Slettet');
      });

      update();
    },
  });
}
