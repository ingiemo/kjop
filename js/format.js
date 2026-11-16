// Tall, kroner og datoer i norsk format (nb-NO).

const NBSP = ' ';
const nf0 = new Intl.NumberFormat('nb-NO', { maximumFractionDigits: 0 });
const nf1 = new Intl.NumberFormat('nb-NO', { maximumFractionDigits: 1 });
const nf2 = new Intl.NumberFormat('nb-NO', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const dfLong = new Intl.DateTimeFormat('nb-NO', { day: 'numeric', month: 'long', year: 'numeric' });

/** 1234 -> «1 234 kr». Under 10 kr vises med øre: «3,50 kr». */
export function kr(n) {
  if (n == null || !Number.isFinite(n)) return '–';
  const small = Math.abs(n) < 10 && Math.round(n * 100) % 100 !== 0;
  return (small ? nf2 : nf0).format(n) + NBSP + 'kr';
}

export function num(n) {
  if (n == null || !Number.isFinite(n)) return '–';
  return nf0.format(n);
}

/** «1 234,5» / «1234.5» -> 1234.5 */
export function parseNum(s) {
  if (typeof s === 'number') return s;
  const t = String(s ?? '')
    .replace(/[\s  ]/g, '')
    .replace(',', '.')
    .replace(/[^0-9.]/g, '');
  const v = parseFloat(t);
  return Number.isFinite(v) ? v : 0;
}

/** Formaterer et beløp mens man skriver: tusenskille og maks to desimaler. */
export function formatTyping(s) {
  s = String(s ?? '').replace(/\./g, ',').replace(/[^\d,]/g, '');
  const i = s.indexOf(',');
  let int = i < 0 ? s : s.slice(0, i);
  const dec = i < 0 ? null : s.slice(i + 1).replace(/,/g, '').slice(0, 2);
  int = int.replace(/^0+(?=\d)/, '').slice(0, 9);
  const grouped = int.replace(/\B(?=(\d{3})+(?!\d))/g, NBSP);
  return dec === null ? grouped : (grouped || '0') + ',' + dec;
}

/** Tall som skal stå i et inputfelt (uten «kr»). */
export function formatInput(n) {
  if (!n) return '';
  return formatTyping(String(Math.round(n * 100) / 100).replace('.', ','));
}

export function dateLong(d) {
  return dfLong.format(d);
}

/** 26 -> «2 år og 2 mnd» */
export function lifespanText(months) {
  const y = Math.floor(months / 12);
  const m = months % 12;
  if (y === 0) return `${m} mnd`;
  if (m === 0) return `${y} år`;
  return `${y} år og ${m} mnd`;
}

/** 3.46 -> «3,5 timer», 0.4 -> «24 min» */
export function hoursText(h) {
  if (h == null || !Number.isFinite(h)) return '–';
  if (h < 1) return `${Math.max(1, Math.round(h * 60))} min`;
  const v = nf1.format(h);
  return `${v} ${v === '1' ? 'time' : 'timer'}`;
}

/** Arbeidstid i hverdagsmål, regnet med 7,5-timers dager. Tom tekst for korte tider. */
export function workdayText(h) {
  if (h == null || !Number.isFinite(h) || h < 3.75) return '';
  if (h < 6.5) return 'over en halv arbeidsdag';
  if (h < 9) return 'omtrent en arbeidsdag';
  if (h < 37.5) return `omtrent ${nf0.format(Math.round(h / 7.5))} arbeidsdager`;
  const w = h / 37.5;
  return `omtrent ${nf1.format(Math.round(w * 2) / 2)} arbeidsuke${w >= 1.25 ? 'r' : ''}`;
}

export function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  })[c]);
}
