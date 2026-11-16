// Summer og perioder for Spart-fanen og unne-seg-kvoten.

const DAY = 864e5;
const monthShort = new Intl.DateTimeFormat('nb-NO', { month: 'short' });
const monthLong = new Intl.DateTimeFormat('nb-NO', { month: 'long' });

export const startOfMonth = (d = new Date()) => new Date(d.getFullYear(), d.getMonth(), 1);
export const monthName = (d = new Date()) => monthLong.format(d);

export function periodStart(key, now = new Date()) {
  if (key === '7') return new Date(now.getTime() - 7 * DAY);
  if (key === '30') return new Date(now.getTime() - 30 * DAY);
  if (key === 'year') return new Date(now.getFullYear(), 0, 1);
  return null; // totalt
}

const decidedSince = (i, from) => i.decidedAt && (!from || new Date(i.decidedAt) >= from);

export const sumPrice = (list) => list.reduce((s, i) => s + (i.price || 0), 0);

export function split(items, from) {
  const inPeriod = items.filter((i) => i.status !== 'saved' && decidedSince(i, from));
  return {
    dropped: inPeriod.filter((i) => i.status === 'dropped'),
    bought: inPeriod.filter((i) => i.status === 'bought' && !i.treat),
    treats: inPeriod.filter((i) => i.status === 'bought' && i.treat),
  };
}

export function treatUsedThisMonth(items, now = new Date()) {
  return sumPrice(split(items, startOfMonth(now)).treats);
}

// ---------- Tenketid ----------

export function waitEnd(it, waitDays) {
  if (it.waitUntil) return new Date(it.waitUntil);
  return new Date(new Date(it.createdAt).getTime() + waitDays * DAY);
}

export const isDue = (it, waitDays, now = new Date()) =>
  it.status === 'saved' && waitEnd(it, waitDays) <= now;

export const dueItems = (items, waitDays, now = new Date()) => items.filter((i) => isDue(i, waitDays, now));

export const daysLeft = (it, waitDays, now = new Date()) =>
  Math.max(0, Math.ceil((waitEnd(it, waitDays) - now) / DAY));

export const addDays = (days, from = new Date()) => new Date(from.getTime() + days * DAY).toISOString();

// ---------- Sparemål ----------

export function goalProgress(items, goal) {
  if (!goal) return null;
  const from = new Date(goal.startAt);
  const saved = sumPrice(items.filter((i) => i.status === 'dropped' && i.decidedAt && new Date(i.decidedAt) >= from));
  return { saved, left: Math.max(0, goal.amount - saved), pct: Math.min(100, (saved / goal.amount) * 100), done: saved >= goal.amount };
}

/** Spart per måned for de siste `count` månedene, eldste først. */
export function savedPerMonth(items, count = 6, now = new Date()) {
  const out = [];
  for (let k = count - 1; k >= 0; k--) {
    const from = new Date(now.getFullYear(), now.getMonth() - k, 1);
    const to = new Date(now.getFullYear(), now.getMonth() - k + 1, 1);
    const value = sumPrice(items.filter((i) => i.status === 'dropped' && i.decidedAt
      && new Date(i.decidedAt) >= from && new Date(i.decidedAt) < to));
    out.push({
      from,
      short: monthShort.format(from).replace('.', ''),
      long: `${monthLong.format(from)} ${from.getFullYear()}`,
      value,
      current: k === 0,
    });
  }
  return out;
}
