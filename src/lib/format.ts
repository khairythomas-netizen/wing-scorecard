/** Prices are stored in cents; never format from a float. */
export function formatPrice(cents: number, currency = 'CAD'): string {
  return new Intl.NumberFormat(undefined, {
    style: 'currency',
    currency,
    maximumFractionDigits: cents % 100 === 0 ? 0 : 2,
  }).format(cents / 100);
}

/** "$24", "24.50" and "24" all parse. Returns null when there is no number. */
export function parsePriceToCents(input: string): number | null {
  const cleaned = input.replace(/[^0-9.]/g, '');
  if (!cleaned) return null;
  const value = Number.parseFloat(cleaned);
  if (!Number.isFinite(value) || value < 0) return null;
  return Math.round(value * 100);
}

export function timeAgo(iso: string): string {
  const seconds = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
  const units: [number, string][] = [
    [60, 's'],
    [3600, 'm'],
    [86_400, 'h'],
    [604_800, 'd'],
    [2_629_800, 'w'],
  ];
  if (seconds < 60) return 'now';
  for (let i = 1; i < units.length; i++) {
    const [limit] = units[i]!;
    if (seconds < limit) {
      const [divisor] = units[i - 1]!;
      return `${Math.floor(seconds / divisor)}${units[i]![1]}`;
    }
  }
  return `${Math.floor(seconds / 2_629_800)}mo`;
}

export const compact = (n: number): string =>
  new Intl.NumberFormat(undefined, { notation: 'compact' }).format(n);
