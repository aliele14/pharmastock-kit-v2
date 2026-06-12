/** Display formatting helpers (safe on both server and client — pure). */

const currencyFmt = new Intl.NumberFormat('en-IE', {
  style: 'currency',
  currency: 'EUR',
  maximumFractionDigits: 0,
});

const currencyPreciseFmt = new Intl.NumberFormat('en-IE', {
  style: 'currency',
  currency: 'EUR',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const numberFmt = new Intl.NumberFormat('en-IE');

const dateFmt = new Intl.DateTimeFormat('en-GB', {
  day: '2-digit',
  month: 'short',
  year: 'numeric',
  timeZone: 'UTC',
});

/** Whole-euro currency, e.g. "€12,480". */
export function formatCurrency(value: number): string {
  return currencyFmt.format(value);
}

/** Two-decimal currency, e.g. "€4.50". */
export function formatCurrencyPrecise(value: number): string {
  return currencyPreciseFmt.format(value);
}

/** Thousands-separated integer, e.g. "1,240". */
export function formatNumber(value: number): string {
  return numberFmt.format(value);
}

/** `YYYY-MM-DD` → "12 Jun 2026". */
export function formatDate(isoDate: string): string {
  return dateFmt.format(new Date(`${isoDate}T00:00:00Z`));
}

/** Human phrasing of a days-to-expiry value. */
export function formatDaysToExpiry(days: number): string {
  if (days < 0) return `Expired ${Math.abs(days)}d ago`;
  if (days === 0) return 'Expires today';
  return `${formatNumber(days)}d left`;
}
