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

export const ALT_SHARES = [[1, 'Alltid'], [0.75, '¾'], [0.5, 'Halvparten'], [0.25, '¼']];

/**
 * Alternativkost i snitt per bruk: hva du ellers ville betalt (f.eks. buss 46 kr),
 * ganget med hvor stor andel av gangene kjøpet faktisk erstatter alternativet.
 * Ganger du ellers ville gått eller latt være, sparer ingenting – men teller som bruk.
 */
export function altPerUse(input) {
  const cost = Math.max(0, input.altCost || 0);
  const share = input.altShare > 0 && input.altShare <= 1 ? input.altShare : 1;
  return cost * share;
}

/** Når (bruk nr. `needed`) blir det nådd, gitt frekvensen? */
function whenUses(needed, uses, input, today) {
  if (needed > uses) return { kind: 'never', needed };
  if (input.frequency === 'once') return { kind: 'uses', needed };
  const months = needed / usesPerMonth(input.frequency, input.times);
  const date = new Date(today);
  date.setDate(date.getDate() + Math.ceil(months * DAYS_PER_MONTH));
  return { kind: 'date', needed, date };
}

/**
 * input: { price, resale, lifespanMonths, frequency, times, altCost, altShare }
 * category: { buyBelow, dropAbove }
 * cpu er kostnad per bruk *etter* alternativkost (kan bli negativ = du sparer penger).
 * grossCpu er ren kostnad per bruk uten alternativ.
 */
export function evaluate(input, category, hourlyWage, today = new Date()) {
  const price = Math.max(0, input.price || 0);
  const resale = Math.min(price, Math.max(0, input.resale || 0));
  const net = price - resale;
  const uses = totalUses(input);
  const grossCpu = net / uses;
  const alt = altPerUse(input);
  const cpu = grossCpu - alt;
  const pays = alt > 0 && cpu <= 0;
  const verdict = verdictFor(cpu, category);
  const perMonth = input.lifespanMonths > 0 ? net / input.lifespanMonths : null;

  // «Verdt det fra»: når netto kostnad per bruk går under Kjøp-grensen.
  // net / n − alt < grense  ⇔  n > net / (grense + alt)
  let worth;
  if (net === 0) {
    worth = { kind: 'now' };
  } else if (!(category.buyBelow + alt > 0)) {
    worth = { kind: 'never' };
  } else {
    worth = whenUses(Math.floor(net / (category.buyBelow + alt)) + 1, uses, input, today);
  }

  // «Tjent inn»: når sparte alternativkostnader har dekket prisen.
  let payback = null;
  let lifetimeSaving = null;
  if (alt > 0) {
    payback = net === 0 ? { kind: 'now' } : whenUses(Math.ceil(net / alt), uses, input, today);
    lifetimeSaving = uses * alt - net;
  }

  const hours = hourlyWage > 0 ? price / hourlyWage : null;
  return { price, resale, net, uses, cpu, grossCpu, alt, pays, verdict, perMonth, worth, payback, lifetimeSaving, hours };
}
