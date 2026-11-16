// Felles UI: varsel nederst (toast) og ark som glir opp (sheet).

let toastTimer;
export function toast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), 2800);
}

let current = null;

export function openSheet(html, { label = 'Resultat', onMount } = {}) {
  closeSheet(true);
  const back = document.createElement('div');
  back.className = 'sheet-backdrop';
  const sheet = document.createElement('div');
  sheet.className = 'sheet';
  sheet.setAttribute('role', 'dialog');
  sheet.setAttribute('aria-modal', 'true');
  sheet.setAttribute('aria-label', label);
  sheet.innerHTML = `<div class="grabber" aria-hidden="true"></div>${html}`;
  document.body.append(back, sheet);

  back.addEventListener('click', () => closeSheet());
  sheet.addEventListener('click', (e) => {
    if (e.target.closest('a[href^="#"], [data-close]')) closeSheet();
  });
  document.body.classList.add('sheet-open');

  sheet.offsetHeight; // start animasjonen fra utgangsposisjon
  back.classList.add('open');
  sheet.classList.add('open');
  current = { back, sheet };
  onMount?.(sheet);
  return sheet;
}

export function closeSheet(instant = false) {
  if (!current) return;
  const { back, sheet } = current;
  current = null;
  document.body.classList.remove('sheet-open');
  if (instant) { back.remove(); sheet.remove(); return; }
  back.classList.remove('open');
  sheet.classList.remove('open');
  setTimeout(() => { back.remove(); sheet.remove(); }, 300);
}

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') closeSheet();
});
