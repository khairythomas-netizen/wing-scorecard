/**
 * Colour for a final score, red through amber to green.
 *
 * Anchored on the range scores actually land in rather than 0 to 10. Almost
 * nothing scores below 5, so a linear ramp over the full range would render
 * every real wing somewhere in the green half and say nothing.
 *
 * Interpolated in sRGB between hand-picked stops instead of by rotating hue,
 * because hue rotation passes through a yellow that is too light to carry
 * white text.
 */

interface Stop {
  at: number;
  rgb: [number, number, number];
}

const STOPS: Stop[] = [
  { at: 5.0, rgb: [0xc0, 0x24, 0x2b] }, // deep red
  { at: 6.5, rgb: [0xc2, 0x52, 0x12] }, // burnt orange
  { at: 7.5, rgb: [0x9a, 0x6d, 0x0c] }, // dark amber
  { at: 8.5, rgb: [0x4f, 0x7f, 0x2a] }, // olive green
  { at: 9.5, rgb: [0x1e, 0x7a, 0x3c] }, // green
  { at: 10.5, rgb: [0x0f, 0x72, 0x3a] }, // deep green
];

const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));

function mix(a: [number, number, number], b: [number, number, number], t: number) {
  return [
    Math.round(a[0] + (b[0] - a[0]) * t),
    Math.round(a[1] + (b[1] - a[1]) * t),
    Math.round(a[2] + (b[2] - a[2]) * t),
  ] as [number, number, number];
}

export function scoreRgb(score: number): [number, number, number] {
  const s = clamp(score, STOPS[0]!.at, STOPS[STOPS.length - 1]!.at);
  for (let i = 0; i < STOPS.length - 1; i++) {
    const lo = STOPS[i]!;
    const hi = STOPS[i + 1]!;
    if (s <= hi.at) return mix(lo.rgb, hi.rgb, (s - lo.at) / (hi.at - lo.at));
  }
  return STOPS[STOPS.length - 1]!.rgb;
}

const hex = ([r, g, b]: [number, number, number]) =>
  `#${[r, g, b].map((n) => n.toString(16).padStart(2, '0')).join('')}`;

/** The flat colour for a score, for places that cannot take a gradient. */
export function scoreHex(score: number): string {
  return hex(scoreRgb(score));
}

/** Nudges a colour towards white, for the light end of the badge's gradient. */
function lighten(rgb: [number, number, number], amount: number): [number, number, number] {
  return mix(rgb, [255, 255, 255], amount);
}

/**
 * A gradient rather than a flat fill. It is the difference between a score
 * that looks like a status pill and one that looks designed, and it costs
 * nothing.
 */
export function scoreGradient(score: number): string {
  const base = scoreRgb(score);
  return `linear-gradient(135deg, ${hex(lighten(base, 0.18))} 0%, ${hex(base)} 100%)`;
}

/** Relative luminance, per WCAG. */
export function luminance([r, g, b]: [number, number, number]): number {
  const channel = (v: number) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

export function contrastWithWhite(rgb: [number, number, number]): number {
  return 1.05 / (luminance(rgb) + 0.05);
}
