const MONTHS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
export const START_YEAR = 1989;

export function money(amount: number): string {
  const sign = amount < 0 ? '-' : '';
  const abs = Math.abs(amount);
  if (abs >= 1_000_000) return `${sign}$${(abs / 1_000_000).toFixed(2)}M`;
  if (abs >= 1_000) return `${sign}$${Math.round(abs / 1_000)}K`;
  return `${sign}$${Math.round(abs)}`;
}

export function barrels(amount: number): string {
  if (amount >= 1_000_000) return `${(amount / 1_000_000).toFixed(2)}M BBL`;
  if (amount >= 1_000) return `${Math.round(amount / 1_000)}K BBL`;
  return `${amount} BBL`;
}

export function date(month: number): string {
  return `${MONTHS[month % 12]} ${START_YEAR + Math.floor(month / 12)}`;
}
