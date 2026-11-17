// Spart: sum av det du har droppet, balansen mot det du har kjøpt, kvote og graf.

import { store } from '../store.js';
import { esc, kr, num, hoursText, workdayText } from '../format.js';
import { actualCpu, altPerUse } from '../calc.js';
import { split, sumPrice, periodStart, savedPerMonth, treatUsedThisMonth, monthName, goalProgress, unusedItems } from '../stats.js';
import { displayName, evalItem } from './shared.js';
import { openItemEditor } from './itemform.js';

function goalCard() {
  const goal = store.settings.goal;
  if (!goal) return '';
  const p = goalProgress(store.items, goal);
  return `
    <div class="card goal">
      <div class="row-between"><span class="label">🎯 ${esc(goal.name)}</span><b>${Math.floor(p.pct)} %</b></div>
      <div class="meter meter--goal" role="img" aria-label="${kr(p.saved)} av ${kr(goal.amount)}"><span style="width:${p.pct}%"></span></div>
      <p class="muted" style="margin:0;font-size:14px">${p.done
        ? `Målet er nådd! ${kr(p.saved)} spart 🎉`
        : `${kr(p.saved)} av ${kr(goal.amount)} · ${kr(p.left)} igjen`}</p>
    </div>`;
}

/** Korte observasjoner på tvers av alt du har registrert. */
function insights() {
  const items = store.items;
  const out = [];
  const dropped = items.filter((i) => i.status === 'dropped');
  if (dropped.length >= 2) {
    const counts = {};
    dropped.forEach((i) => { counts[i.categoryId] = (counts[i.categoryId] || 0) + 1; });
    const [topId, n] = Object.entries(counts).sort((a, b) => b[1] - a[1])[0];
    if (n >= 2) {
      const cat = store.category(topId);
      out.push(`Du dropper oftest <b>${esc(cat.emoji)} ${esc(cat.name)}</b> (${n} av ${dropped.length})`);
    }
  }
  const bought = items.filter((i) => i.status === 'bought');
  // Median, og uten unnede kjøp, så ett dyrt unntak ikke drar tallet opp.
  const regular = bought.filter((i) => !i.treat).map((i) => evalItem(i).r.cpu).sort((a, b) => a - b);
  if (regular.length >= 2) {
    const m = regular.length % 2
      ? regular[(regular.length - 1) / 2]
      : (regular[regular.length / 2 - 1] + regular[regular.length / 2]) / 2;
    out.push(`Typisk kostnad per bruk på det du kjøper: <b>${kr(m)}</b> (anslått)`);
  }
  const used = bought.filter((i) => i.actualUses >= 3);
  if (used.length) {
    const best = used.reduce((a, b) => (actualCpu(a) <= actualCpu(b) ? a : b));
    out.push(`Beste kjøp så langt: <b>${esc(displayName(best, store.category(best.categoryId)))}</b>, ${kr(actualCpu(best))} per bruk`);
  }
  const altSaved = bought.reduce((s, i) => s + altPerUse(i) * (i.actualUses || 0), 0);
  if (altSaved > 0) {
    out.push(`Ting du har kjøpt har spart deg <b>${kr(altSaved)}</b> i alternativkostnader så langt`);
  }
  const waited = items.filter((i) => i.waited && i.status !== 'saved');
  if (waited.length) {
    const d = waited.filter((i) => i.status === 'dropped').length;
    out.push(`Av ${waited.length} ting du lot vente, droppet du <b>${d}</b>`);
  }
  if (!out.length) return '';
  return `
    <h3 class="section-title">Innsikt</h3>
    <div class="card card--list insights">${out.map((t) => `<p>${t}</p>`).join('')}</div>`;
}

const PERIODS = [['7', '7 dager'], ['30', '30 dager'], ['year', 'I år'], ['all', 'Totalt']];
let el;
let period = 'all';
let selectedBar = null;

export function mount(root) {
  el = root;
  el.innerHTML = `
    <h1 class="page-title">Spart</h1>
    <div class="chips" id="s-period" role="radiogroup" aria-label="Periode"></div>
    <div id="s-body"></div>`;

  el.querySelector('#s-period').addEventListener('click', (e) => {
    const b = e.target.closest('[data-p]');
    if (!b) return;
    period = b.dataset.p;
    render();
  });
  el.querySelector('#s-body').addEventListener('click', (e) => {
    const bar = e.target.closest('.bar');
    if (bar) { selectedBar = Number(bar.dataset.i) === selectedBar ? null : Number(bar.dataset.i); render(); return; }
    const row = e.target.closest('[data-id]');
    const it = row && store.items.find((i) => i.id === row.dataset.id);
    if (it) openItemEditor(it);
  });
  store.subscribe(() => { if (!el.hidden) render(); });
}

export function show() { render(); }

function miniList(title, list, note = '') {
  if (!list.length) return '';
  const sorted = [...list].sort((a, b) => (b.decidedAt || '').localeCompare(a.decidedAt || ''));
  const shown = sorted.slice(0, 8);
  return `
    <h3 class="section-title">${title}</h3>
    <div class="card card--list">
      ${note ? `<p class="muted mini-note">${note}</p>` : ''}
      ${shown.map((it) => {
        const cat = store.category(it.categoryId);
        return `<button type="button" class="mini-row" data-id="${esc(it.id)}">
          <span aria-hidden="true">${esc(cat.emoji)}</span>
          <span class="mini-name">${esc(displayName(it, cat))}${it.treat ? ' <span class="tag tag--treat">Unnet</span>' : ''}</span>
          <span class="mini-val">${kr(it.price)}</span></button>`;
      }).join('')}
      ${sorted.length > shown.length ? `<p class="muted mini-more">+ ${sorted.length - shown.length} til</p>` : ''}
    </div>`;
}

/** Kjøp du ikke bruker. Gjelder alt, uavhengig av valgt periode. */
function unusedList() {
  const list = unusedItems(store.items);
  if (!list.length) return '';
  const resale = list.reduce((s, i) => s + (i.resale || 0), 0);
  const note = resale > 0
    ? `Til sammen ${kr(resale)} i anslått FINN-verdi`
    : 'Kjøpt, men ikke brukt på en stund';
  return miniList('Ikke i bruk', list, note);
}

function render() {
  el.querySelector('#s-period').innerHTML = PERIODS.map(([k, l]) =>
    `<button type="button" class="chip" role="radio" data-p="${k}" aria-checked="${k === period}">${l}</button>`).join('');

  const body = el.querySelector('#s-body');
  const items = store.items;
  if (!items.some((i) => i.status !== 'saved')) {
    body.innerHTML = `
      <div class="empty-state">
        <div class="big" aria-hidden="true">🌱</div>
        <h2>Ingen beslutninger ennå</h2>
        <p>Når du trykker «Jeg droppet det» i kalkulatoren, havner beløpet her.</p>
        <a class="btn btn--inline" href="#kalkulator">Til kalkulatoren</a>
      </div>`;
    return;
  }

  const { dropped, bought, treats } = split(items, periodStart(period));
  const saved = sumPrice(dropped);
  const spent = sumPrice(bought);
  const treated = sumPrice(treats);
  const total = saved + spent + treated;
  const wage = store.settings.hourlyWage;
  const pct = (v) => (total ? (v / total) * 100 : 0);

  // Kvote denne måneden
  const budget = store.settings.treatBudget;
  const used = treatUsedThisMonth(items);
  const quota = budget > 0
    ? `<div class="card">
        <div class="row-between"><span class="label">Unne seg i ${monthName()}</span><b>${kr(Math.max(0, budget - used))} igjen</b></div>
        <div class="meter${used > budget ? ' over' : ''}" role="img" aria-label="Brukt ${kr(used)} av ${kr(budget)}">
          <span style="width:${Math.min(100, (used / budget) * 100)}%"></span></div>
        <p class="muted" style="margin:0;font-size:14px">${used > budget ? `Over kvoten med ${kr(used - budget)}` : `Brukt ${kr(used)} av ${kr(budget)}`}</p>
      </div>`
    : `<div class="card"><p class="muted" style="margin:0">Vil du ha en unne-seg-kvote? <a href="#innstillinger">Sett et månedsbeløp i Innstillinger</a>.</p></div>`;

  // Graf: spart per måned
  const months = savedPerMonth(items, 6);
  const max = Math.max(...months.map((m) => m.value), 1);
  const maxIdx = months.findIndex((m) => m.value === max);
  const sel = selectedBar != null ? months[selectedBar] : null;
  const bars = months.map((m, i) => {
    const h = m.value ? Math.max(4, Math.round((m.value / max) * 110)) : 0;
    const showVal = m.value && (i === maxIdx || m.current || i === selectedBar);
    return `<button type="button" class="bar${m.value ? '' : ' is-zero'}" data-i="${i}" aria-pressed="${i === selectedBar}"
        aria-label="${esc(m.long)}: ${kr(m.value)} spart">
      <span class="val">${showVal ? num(m.value) : ''}</span><i style="height:${h}px"></i></button>`;
  }).join('');

  const work = wage ? saved / wage : null;
  body.innerHTML = `
    ${goalCard()}
    <div class="card hero">
      <span class="eyebrow">Spart ved å droppe</span>
      <span class="hero-num">${kr(saved)}</span>
      <span class="muted">${dropped.length} ting droppet${work ? ` · ${hoursText(work)} arbeid` : ''}</span>
      ${workdayText(work) ? `<span class="muted" style="display:block;font-size:14px">Det er ${workdayText(work)} du slapp å jobbe for</span>` : ''}
    </div>

    <div class="card">
      <span class="label">Balansen</span>
      <div class="stack" role="img" aria-label="Spart ${kr(saved)}, kjøpt ${kr(spent)}, unnet ${kr(treated)}">
        ${saved ? `<span class="seg-saved" style="width:${pct(saved)}%"></span>` : ''}
        ${spent ? `<span class="seg-bought" style="width:${pct(spent)}%"></span>` : ''}
        ${treated ? `<span class="seg-treat" style="width:${pct(treated)}%"></span>` : ''}
      </div>
      <div class="tiles">
        <div><i class="sw seg-saved"></i><span>Spart</span><b>${kr(saved)}</b><small>${dropped.length} droppet</small></div>
        <div><i class="sw seg-bought"></i><span>Kjøpt</span><b>${kr(spent)}</b><small>${bought.length} ting</small></div>
        <div><i class="sw seg-treat"></i><span>Unnet</span><b>${kr(treated)}</b><small>${treats.length} ting</small></div>
      </div>
    </div>

    ${quota}

    <div class="card">
      <div class="row-between"><span class="label">Spart per måned</span><span class="muted" style="font-size:13px">Siste 6 måneder</span></div>
      <div class="bars">${bars}</div>
      <div class="bar-labels">${months.map((m) => `<span${m.current ? ' class="cur"' : ''}>${esc(m.short)}</span>`).join('')}</div>
      <p class="chart-cap">${sel ? `${esc(sel.long[0].toUpperCase() + sel.long.slice(1))}: <b>${kr(sel.value)}</b> spart` : '<span class="muted">Trykk på en måned for å se beløpet</span>'}</p>
    </div>

    ${insights()}
    ${store.settings.goal ? '' : '<p class="muted" style="font-size:14px;text-align:center;margin:16px 0 0">Sparer du til noe? <a href="#innstillinger">Sett et sparemål</a></p>'}
    ${unusedList()}
    ${miniList('Droppet', dropped)}
    ${miniList('Kjøpt', [...bought, ...treats])}`;
}
