// All utregning. Rene funksjoner uten DOM, så de er lette å teste.

const DAYS_PER_MONTH = 365.25 / 12;

export const FREQ = {
  daily:   { label: 'Daglig',   per: 'per dag',   perMonth: 365.25 / 12 },
  weekly:  { label: 'Ukentlig', per: 'per uke',   perMonth: 52.1775 / 12 },
  monthly: { label: 'Månedlig', per: 'per måned', perMonth: 1 },
  yearly:  { label: 'Årlig',    per: 'per år',    perMonth: 1 / 12 },
  once:    { label: 'Én gang',  per: 'totalt',    perMonth: 0 },
};

export const VERDICT = {
  kjop:  { label: 'Kjøp' },
  tenk:  { label: 'Tenk deg om' },
  dropp: { label: 'Dropp' },
};

const timesOrOne = (t) => (t > 0 ? t : 1);

export function usesPerMonth(frequency, times) {
  return FREQ[frequency].perMonth * timesOrOne(times);
}

/** Antall bruk i hele levetiden. Minst 1, så vi aldri deler på null. */
export function totalUses({ lifespanMonths, frequency, times }) {
  if (frequency === 'once') return timesOrOne(times);
  return Math.max(1, Math.round(lifespanMonths * usesPerMonth(frequency, times)));
}

/** Hvor mange bruk du anslo å ha hatt *så langt* siden kjøpet. */
export function expectedUsesSoFar(item, now = new Date()) {
  const total = totalUses(item);
  if (item.frequency === 'once') return total;
  const since = new Date(item.decidedAt || item.createdAt);
  const months = Math.max(0, (now - since) / (DAYS_PER_MONTH * 864e5));
  return Math.min(total, Math.round(months * usesPerMonth(item.frequency, item.times)));
}

/** Faktisk kostnad per bruk så langt (null hvis ikke brukt ennå). */
export function actualCpu(item) {
  const net = Math.max(0, (item.price || 0) - Math.min(item.price || 0, item.resale || 0));
  return item.actualUses > 0 ? net / item.actualUses : null;
}

export function verdictFor(cpu, category) {
  if (cpu < category.buyBelow) return 'kjop';
  if (cpu > category.dropAbove) return 'dropp';
  return 'tenk';
}

/**
 * input: { price, resale, lifespanMonths, frequency, times }
 * category: { buyBelow, dropAbove }
 */
export function evaluate(input, category, hourlyWage, today = new Date()) {
  const price = Math.max(0, input.price || 0);
  const resale = Math.min(price, Math.max(0, input.resale || 0));
  const net = price - resale;
  const uses = totalUses(input);
  const cpu = net / uses;
  const verdict = verdictFor(cpu, category);
  const perMonth = input.lifespanMonths > 0 ? net / input.lifespanMonths : null;

  // Når passerer kostnad per bruk Kjøp-grensen? Trenger flere enn net / grense bruk.
  let worth;
  if (net === 0) {
    worth = { kind: 'now' };
  } else if (!(category.buyBelow > 0)) {
    worth = { kind: 'never' };
  } else {
    const needed = Math.floor(net / category.buyBelow) + 1;
    if (needed > uses) {
      worth = { kind: 'never', needed };
    } else if (input.frequency === 'once') {
      worth = { kind: 'uses', needed };
    } else {
      const months = needed / usesPerMonth(input.frequency, input.times);
      const date = new Date(today);
      date.setDate(date.getDate() + Math.ceil(months * DAYS_PER_MONTH));
      worth = { kind: 'date', needed, date };
    }
  }

  const hours = hourlyWage > 0 ? price / hourlyWage : null;
  return { price, resale, net, uses, cpu, verdict, perMonth, worth, hours };
}
