// Biter som brukes i flere faner.

import { store } from '../store.js';
import { evaluate, FREQ, VERDICT, actualCpu } from '../calc.js';
import { esc, kr, formatInput, lifespanText } from '../format.js';
import { isDue, daysLeft, goalProgress } from '../stats.js';
import { toast } from '../ui.js';

export const STATUS_LABEL = { saved: 'Senere', bought: 'Kjøpt', treat: 'Unnet', dropped: 'Droppet' };

export const statusKey = (it) => (it.status === 'bought' && it.treat ? 'treat' : it.status);

export function evalItem(it) {
  const cat = store.category(it.categoryId);
  return { cat, r: evaluate(it, cat, store.settings.hourlyWage) };
}

export const displayName = (it, cat) => it.name?.trim() || cat.name;

function statusTag(it) {
  const key = statusKey(it);
  if (key === 'saved') {
    const wd = store.settings.waitDays;
    if (isDue(it, wd)) return '<span class="tag tag--due">Klar til å avgjøre</span>';
    const d = daysLeft(it, wd);
    return `<span class="tag">Venter · ${d} ${d === 1 ? 'dag' : 'dager'}</span>`;
  }
  return `<span class="tag tag--${key}">${STATUS_LABEL[key]}</span>`;
}

/** En rad i en liste. `data-id` brukes til å åpne/plukke. Med `plus` får kjøpte ting en +1-knapp. */
export function itemRow(it, { showStatus = true, plus = false } = {}) {
  const { cat, r } = evalItem(it);
  const used = it.status === 'bought' && it.actualUses > 0 ? ` · ${it.actualUses}× brukt` : '';
  const row = `
    <button type="button" class="item v-${r.verdict}" data-id="${esc(it.id)}">
      <span class="item-emoji" aria-hidden="true">${esc(cat.emoji)}</span>
      <span class="item-main">
        <span class="item-name">${esc(displayName(it, cat))}</span>
        <span class="item-meta">${esc(`${cat.name} · ${kr(it.price)}${used}`)}${showStatus ? ` ${statusTag(it)}` : ''}</span>
      </span>
      <span class="item-cpu"><b>${kr(r.cpu)}</b><small>${VERDICT[r.verdict].label}</small></span>
    </button>`;
  if (!plus || it.status !== 'bought') return row;
  return `<div class="item-wrap">${row}
    <button type="button" class="plus" data-use="${esc(it.id)}" aria-label="Registrer bruk av ${esc(displayName(it, cat))}">+1</button></div>`;
}

/** +1 bruk med tilbakemelding. */
export function registerUse(id) {
  const it = store.addUse(id, 1);
  if (!it) return;
  const cat = store.category(it.categoryId);
  toast(`${displayName(it, cat)}: ${it.actualUses} bruk · ${kr(actualCpu(it))} per bruk nå`);
}

/** Melding etter at noe er droppet, med sparemål hvis det finnes. */
export function droppedToast(price, prefix = 'Droppet!') {
  const goal = store.settings.goal;
  const p = goalProgress(store.items, goal);
  if (p?.done) toast(`${prefix} Sparemålet «${goal.name}» er nådd 🎉`);
  else if (p) toast(`${prefix} ${kr(price)} nærmere ${goal.name}`);
  else toast(`${prefix} ${kr(price)} spart`);
}

export const lifeOptions = (selected) => Array.from({ length: 121 }, (_, m) =>
  `<option value="${m}"${m === selected ? ' selected' : ''}>${lifespanText(m)}</option>`).join('');

export const freqOptions = (selected) => Object.entries(FREQ).map(([k, f]) =>
  `<option value="${k}"${k === selected ? ' selected' : ''}>${f.label}</option>`).join('');

export const categoryOptions = (selected) => store.categories.map((c) =>
  `<option value="${esc(c.id)}"${c.id === selected ? ' selected' : ''}>${esc(c.emoji)} ${esc(c.name)}</option>`).join('');

export { formatInput };
