// Innstillinger: timelønn, kvote, sparemål, tenketid, kategorier og eksport/import.

import { store, uid } from '../store.js';
import { esc, kr, formatInput, formatTyping, parseNum, dateLong } from '../format.js';
import { openSheet, closeSheet, toast } from '../ui.js';
import { lifeOptions, freqOptions } from './shared.js';
import { exportStale } from '../stats.js';

let el;

export function mount(root) {
  el = root;
  el.innerHTML = `
    <h1 class="page-title">Innstillinger</h1>

    <h2 class="section-title">Penger</h2>
    <div class="card form">
      <label class="row-field">
        <span>Timelønn etter skatt<small>Gjør om pris til arbeidstid</small></span>
        <span class="num-input"><input id="s-wage" inputmode="decimal" placeholder="0" autocomplete="off" enterkeyhint="done"><span>kr/t</span></span>
      </label>
      <label class="row-field">
        <span>Unne seg per måned<small>Til kjøp du unner deg likevel</small></span>
        <span class="num-input"><input id="s-treat" inputmode="decimal" placeholder="0" autocomplete="off" enterkeyhint="done"><span>kr</span></span>
      </label>
    </div>

    <h2 class="section-title">Sparemål</h2>
    <div class="card form">
      <input id="s-goal-name" class="field field--left" placeholder="Hva sparer du til? F.eks. Japan-tur" autocomplete="off" aria-label="Navn på sparemål" maxlength="60">
      <label class="row-field">
        <span>Beløp<small id="s-goal-from">Teller det du dropper fra nå</small></span>
        <span class="num-input"><input id="s-goal-amount" inputmode="decimal" placeholder="0" autocomplete="off" enterkeyhint="done"><span>kr</span></span>
      </label>
    </div>
    <button type="button" class="btn btn--ghost btn--block" id="s-goal-reset" hidden>Start målet på nytt fra i dag</button>

    <h2 class="section-title">Tenketid</h2>
    <div class="card">
      <p class="hint" style="margin:0 0 10px">Når du trykker «Lagre til senere», spør appen deg igjen etter</p>
      <div class="seg seg--3" id="s-wait" role="radiogroup" aria-label="Tenketid">
        ${[7, 14, 30].map((d) => `<button type="button" role="radio" data-wait="${d}">${d} dager</button>`).join('')}
      </div>
    </div>

    <h2 class="section-title">Kategorier og grenser</h2>
    <div class="card card--list" id="s-cats"></div>
    <button type="button" class="btn btn--block" id="s-add" style="margin-top:10px">+ Ny kategori</button>

    <h2 class="section-title">Sikkerhetskopi</h2>
    <div class="card">
      <p style="margin:0 0 6px">Alt lagres bare på denne telefonen. iOS kan rydde bort data fra nettsider som ikke er brukt på en stund, så eksporter en kopi innimellom og legg den i Filer eller iCloud.</p>
      <p class="muted" id="s-last" style="margin:0 0 14px;font-size:14px"></p>
      <div class="actions" style="margin-top:0">
        <button type="button" class="btn" id="s-export">Eksporter</button>
        <button type="button" class="btn" id="s-import">Importer</button>
      </div>
      <input type="file" id="s-file" accept="application/json,.json" hidden>
    </div>
    <p class="empty" style="padding:24px 16px 0;font-size:13px" id="s-foot"></p>`;

  bindMoney('#s-wage', 'hourlyWage', 'Timelønn');
  bindMoney('#s-treat', 'treatBudget', 'Kvote');

  // Sparemål: lagres når et felt forlates. Tomt beløp fjerner målet.
  const gName = el.querySelector('#s-goal-name');
  const gAmount = el.querySelector('#s-goal-amount');
  gAmount.addEventListener('input', () => { gAmount.value = formatTyping(gAmount.value); });
  const saveGoal = () => {
    const amount = parseNum(gAmount.value);
    const name = gName.value.trim() || 'Sparemål';
    const old = store.settings.goal;
    if (!(amount > 0)) {
      if (old) { store.updateSettings({ goal: null }); toast('Sparemål fjernet'); }
      return;
    }
    if (old && old.amount === amount && old.name === name) return;
    store.updateSettings({ goal: { name, amount, startAt: old?.startAt || new Date().toISOString() } });
    toast(old ? 'Sparemål oppdatert' : 'Sparemål lagt til');
  };
  gName.addEventListener('change', () => { if (parseNum(gAmount.value) > 0) saveGoal(); });
  gAmount.addEventListener('change', saveGoal);
  el.querySelector('#s-goal-reset').addEventListener('click', () => {
    const g = store.settings.goal;
    if (!g || !confirm(`Starte «${g.name}» på nytt? Det du har spart mot målet hittil teller ikke lenger med.`)) return;
    store.updateSettings({ goal: { ...g, startAt: new Date().toISOString() } });
    toast('Sparemålet starter på nytt fra i dag');
  });

  el.querySelector('#s-wait').addEventListener('click', (e) => {
    const b = e.target.closest('[data-wait]');
    if (!b) return;
    store.updateSettings({ waitDays: Number(b.dataset.wait) });
    toast(`Tenketid: ${b.dataset.wait} dager`);
  });

  el.querySelector('#s-cats').addEventListener('click', (e) => {
    const row = e.target.closest('[data-cat]');
    if (row) openCategoryEditor(store.categories.find((c) => c.id === row.dataset.cat));
  });
  el.querySelector('#s-add').addEventListener('click', () => openCategoryEditor(null));
  el.querySelector('#s-export').addEventListener('click', exportData);
  el.querySelector('#s-import').addEventListener('click', () => el.querySelector('#s-file').click());
  el.querySelector('#s-file').addEventListener('change', importData);

  store.subscribe(() => { if (!el.hidden) render(); });
}

export function show() { render(); }

function bindMoney(sel, key, label) {
  const input = el.querySelector(sel);
  input.addEventListener('input', () => { input.value = formatTyping(input.value); });
  input.addEventListener('change', () => {
    const v = parseNum(input.value);
    store.updateSettings({ [key]: v > 0 ? v : null });
    toast(v > 0 ? `${label} lagret` : `${label} fjernet`);
  });
}

function render() {
  const s = store.settings;
  const wage = el.querySelector('#s-wage');
  const treat = el.querySelector('#s-treat');
  if (document.activeElement !== wage) wage.value = formatInput(s.hourlyWage);
  if (document.activeElement !== treat) treat.value = formatInput(s.treatBudget);

  const gName = el.querySelector('#s-goal-name');
  const gAmount = el.querySelector('#s-goal-amount');
  if (document.activeElement !== gName) gName.value = s.goal?.name ?? '';
  if (document.activeElement !== gAmount) gAmount.value = formatInput(s.goal?.amount);
  el.querySelector('#s-goal-from').textContent = s.goal
    ? `Teller det du har droppet siden ${dateLong(new Date(s.goal.startAt))}`
    : 'Teller det du dropper fra nå';
  el.querySelector('#s-goal-reset').hidden = !s.goal;

  el.querySelectorAll('[data-wait]').forEach((b) =>
    b.setAttribute('aria-checked', String(Number(b.dataset.wait) === s.waitDays)));

  el.querySelector('#s-cats').innerHTML = store.categories.map((c) => `
    <button type="button" class="mini-row" data-cat="${esc(c.id)}">
      <span aria-hidden="true">${esc(c.emoji)}</span>
      <span class="mini-name">${esc(c.name)}<small>Kjøp under ${kr(c.buyBelow)} · Dropp over ${kr(c.dropAbove)}</small></span>
      <span class="chev" aria-hidden="true">›</span>
    </button>`).join('');

  const last = s.lastExport ? new Date(s.lastExport) : null;
  const stale = exportStale(store.items, s);
  const lastEl = el.querySelector('#s-last');
  lastEl.textContent = last ? `Sist eksportert ${dateLong(last)}.` : 'Ikke eksportert ennå.';
  lastEl.classList.toggle('warn', Boolean(stale));
  if (stale) lastEl.textContent += ' Det er lurt å ta en ny kopi nå.';

  el.querySelector('#s-foot').textContent =
    `${store.items.length} ting og ${store.categories.length} kategorier lagret på denne enheten.`;
}

// ---------- Kategorier ----------

function firstGrapheme(s) {
  s = s.trim();
  if (!s) return '';
  if (globalThis.Intl?.Segmenter) {
    const seg = new Intl.Segmenter('nb', { granularity: 'grapheme' }).segment(s)[Symbol.iterator]().next();
    return seg.value?.segment ?? s;
  }
  return Array.from(s)[0];
}

function openCategoryEditor(cat) {
  const isNew = !cat;
  const c = cat || { emoji: '🏷️', name: '', buyBelow: 10, dropAbove: 30, defLife: 24, defFreq: 'weekly' };
  const usedBy = cat ? store.items.filter((i) => i.categoryId === cat.id).length : 0;

  openSheet(`
    <div class="sheet-top">
      <h2>${isNew ? 'Ny kategori' : 'Rediger kategori'}</h2>
      <button type="button" class="btn btn--ghost" data-close>Lukk</button>
    </div>
    <div class="card form">
      <div class="cat-head">
        <input id="k-emoji" class="emoji-input" value="${esc(c.emoji)}" aria-label="Emoji" autocomplete="off">
        <input id="k-name" class="field field--left" placeholder="Navn" value="${esc(c.name)}" autocomplete="off" aria-label="Navn">
      </div>
      <label class="row-field">
        <span><b class="k">Kjøp</b> under<small>kr per bruk</small></span>
        <span class="num-input"><input id="k-buy" inputmode="decimal" value="${formatInput(c.buyBelow)}" autocomplete="off"><span>kr</span></span>
      </label>
      <label class="row-field">
        <span><b class="d">Dropp</b> over<small>kr per bruk</small></span>
        <span class="num-input"><input id="k-drop" inputmode="decimal" value="${formatInput(c.dropAbove)}" autocomplete="off"><span>kr</span></span>
      </label>
      <label class="row-field">
        <span>Forslag levetid<small>Fylles inn i kalkulatoren</small></span>
        <select id="k-life" class="select">${lifeOptions(c.defLife)}</select>
      </label>
      <label class="row-field">
        <span>Forslag hvor ofte</span>
        <select id="k-freq" class="select">${freqOptions(c.defFreq)}</select>
      </label>
    </div>
    <p class="muted" style="font-size:14px;margin:10px 4px 0">Alt mellom de to grensene blir «Tenk deg om». Tips: trykk på emoji-feltet og bytt til emoji-tastaturet.</p>
    <div class="actions">
      ${!isNew && cat.id !== 'annet'
        ? '<button type="button" class="btn btn--danger" data-del>Slett</button>'
        : '<span></span>'}
      <button type="button" class="btn is-suggested" data-save>${isNew ? 'Legg til' : 'Lagre'}</button>
    </div>
    ${cat?.id === 'annet' ? '<p class="muted" style="font-size:13px;text-align:center">Annet kan ikke slettes, den fanger opp alt som ikke passer andre steder.</p>' : ''}`, {
    label: isNew ? 'Ny kategori' : 'Rediger kategori',
    onMount(sheet) {
      const $ = (s) => sheet.querySelector(s);
      ['#k-buy', '#k-drop'].forEach((s) => $(s).addEventListener('input', (e) => { e.target.value = formatTyping(e.target.value); }));
      $('#k-emoji').addEventListener('focus', (e) => e.target.select());

      $('[data-save]').addEventListener('click', () => {
        const next = {
          defLife: Number($('#k-life').value),
          defFreq: $('#k-freq').value,
          emoji: firstGrapheme($('#k-emoji').value) || '🏷️',
          name: $('#k-name').value.trim().slice(0, 60),
          buyBelow: parseNum($('#k-buy').value),
          dropAbove: parseNum($('#k-drop').value),
        };
        if (!next.name) { toast('Gi kategorien et navn'); return; }
        if (!(next.buyBelow > 0)) { toast('Kjøp-grensen må være over 0 kr'); return; }
        if (!(next.dropAbove >= next.buyBelow)) { toast('Dropp-grensen må være minst like høy som Kjøp-grensen'); return; }
        if (isNew) store.addCategory({ id: uid(), ...next });
        else store.updateCategory(cat.id, next);
        closeSheet();
        toast(isNew ? 'Kategori lagt til' : 'Kategori lagret');
      });

      $('[data-del]')?.addEventListener('click', () => {
        const extra = usedBy ? ` ${usedBy} ting i denne kategorien flyttes til Annet.` : '';
        if (!confirm(`Slette «${cat.name}»?${extra} Dette kan ikke angres.`)) return;
        store.deleteCategory(cat.id);
        closeSheet();
        toast('Kategori slettet');
      });
    },
  });
}

// ---------- Eksport / import ----------

export async function exportData() {
  const d = new Date();
  const stamp = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const name = `kjop-eller-dropp-${stamp}.json`;
  const file = new File([store.exportJSON()], name, { type: 'application/json' });

  try {
    if (navigator.canShare?.({ files: [file] })) {
      await navigator.share({ files: [file], title: 'Kjøp eller dropp – sikkerhetskopi' });
    } else {
      const a = document.createElement('a');
      a.href = URL.createObjectURL(file);
      a.download = name;
      document.body.append(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(a.href), 2000);
    }
    store.markExported();
    toast('Eksportert');
  } catch (e) {
    if (e?.name !== 'AbortError') toast('Eksporten feilet');
  }
}

async function importData(e) {
  const input = e.target;
  const file = input.files?.[0];
  input.value = '';
  if (!file) return;
  try {
    if (file.size > 5_000_000) throw new Error('Fila er for stor til å være en eksport herfra.');
    const clean = store.parseImport(await file.text());
    const ok = confirm(`Importere ${clean.items.length} ting og ${clean.categories.length} kategorier?\n\nDette erstatter alt som er lagret nå. Eksporter først hvis du vil ha en kopi av det du har.`);
    if (!ok) return;
    store.replaceAll(clean);
    toast('Importert');
  } catch (err) {
    alert(err.message || 'Klarte ikke å lese fila.');
  }
}
