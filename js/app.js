// Oppstart, fanebytte og merke på Lagret-fanen når tenketid er over.

import { store } from './store.js';
import { dueItems, exportReminderDue, EXPORT_EVERY_DAYS, addDays } from './stats.js';
import * as kalkulator from './views/kalkulator.js';
import * as sammenlign from './views/sammenlign.js';
import * as lagret from './views/lagret.js';
import * as spart from './views/spart.js';
import * as innstillinger from './views/innstillinger.js';

const VIEWS = { kalkulator, sammenlign, lagret, spart, innstillinger };
const mounted = new Set();

function show() {
  const name = location.hash.slice(1);
  const current = VIEWS[name] ? name : 'kalkulator';

  for (const key of Object.keys(VIEWS)) {
    document.getElementById(`view-${key}`).hidden = key !== current;
  }
  document.querySelectorAll('.tabbar a').forEach((a) => {
    if (a.dataset.tab === current) a.setAttribute('aria-current', 'page');
    else a.removeAttribute('aria-current');
  });

  const el = document.getElementById(`view-${current}`);
  if (!mounted.has(current)) {
    VIEWS[current].mount(el);
    mounted.add(current);
  }
  VIEWS[current].show?.();
  window.scrollTo(0, 0);
}

function updateBadge() {
  const n = dueItems(store.items, store.settings.waitDays).length;
  const tab = document.querySelector('.tabbar a[data-tab="lagret"]');
  let badge = tab.querySelector('.tab-badge');
  if (!n) { badge?.remove(); tab.removeAttribute('aria-description'); return; }
  if (!badge) {
    badge = document.createElement('span');
    badge.className = 'tab-badge';
    tab.append(badge);
  }
  badge.textContent = n;
  tab.setAttribute('aria-description', `${n} ting venter på svar`);
}

// Bytt fane uten å fylle opp historikken.
document.querySelector('.tabbar').addEventListener('click', (e) => {
  const a = e.target.closest('a[data-tab]');
  if (!a) return;
  e.preventDefault();
  history.replaceState(null, '', `#${a.dataset.tab}`);
  show();
});

window.addEventListener('hashchange', show);
// Når appen åpnes igjen fra hjemskjermen kan tenketid ha gått ut: oppdater uten å scrolle.
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState !== 'visible') return;
  updateBadge();
  updateBackupNotice();
  const current = VIEWS[location.hash.slice(1)] ? location.hash.slice(1) : 'kalkulator';
  if (mounted.has(current)) VIEWS[current].show?.();
});
// ---------- Eksportpåminnelse ----------
// iOS kan rydde bort data fra nettsider som ikke er brukt på en stund. Mas litt når kopien er gammel.
function updateBackupNotice() {
  const box = document.getElementById('backup');
  const due = exportReminderDue(store.items, store.settings);
  box.hidden = !due;
  if (!due) return;
  document.getElementById('backup-why').textContent = store.settings.lastExport
    ? `Det er over ${EXPORT_EVERY_DAYS} dager siden sist.`
    : 'Dataene finnes bare på denne telefonen.';
}
document.getElementById('backup-now').addEventListener('click', () => innstillinger.exportData());
document.getElementById('backup-later').addEventListener('click', () => {
  store.updateSettings({ exportSnoozedUntil: addDays(7) });
});

store.subscribe(updateBadge);
store.subscribe(updateBackupNotice);
show();
updateBadge();
updateBackupNotice();

// ---------- Offline (service worker) ----------
// Ikke på localhost under utvikling (da ville gamle filer ligge i cachen), med mindre ?sw står i adressen.
const isDev = ['localhost', '127.0.0.1'].includes(location.hostname) && !new URLSearchParams(location.search).has('sw');

if ('serviceWorker' in navigator && !isDev) {
  window.addEventListener('load', async () => {
    try {
      const reg = await navigator.serviceWorker.register('sw.js');
      const offer = (worker) => {
        const bar = document.getElementById('update');
        bar.hidden = false;
        document.getElementById('update-btn').onclick = () => worker.postMessage('skipWaiting');
      };
      if (reg.waiting && navigator.serviceWorker.controller) offer(reg.waiting);
      reg.addEventListener('updatefound', () => {
        const w = reg.installing;
        w?.addEventListener('statechange', () => {
          if (w.state === 'installed' && navigator.serviceWorker.controller) offer(w);
        });
      });
      // Se etter ny versjon når appen åpnes igjen.
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') reg.update().catch(() => {});
      });
    } catch (e) {
      console.warn('Service worker ble ikke registrert', e);
    }
  });

  let reloading = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (reloading) return;
    reloading = true;
    location.reload();
  });
}
