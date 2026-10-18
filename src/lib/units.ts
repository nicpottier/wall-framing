export type Units = 'in' | 'ftin';

/**
 * Parses a tape-measure style length into inches.
 * Accepts: 240, 240.5, 92 5/8, 92-5/8", 20', 20ft, 8'-1 1/8", 8' 1-1/8
 * Returns NaN when the text can't be read.
 */
export function parseLength(raw: string | null | undefined): number {
  if (raw == null) return NaN;
  const s = String(raw)
    .trim()
    .toLowerCase()
    .replace(/[′’]/g, "'")
    .replace(/[″”]/g, '"')
    .replace(/\s*(feet|foot|ft)\b/g, "'")
    .replace(/\s*(inches|inch|in)\b/g, '"');
  if (!s) return NaN;

  let feet = 0;
  let rest = s;
  const tick = s.indexOf("'");
  if (tick >= 0) {
    const f = s.slice(0, tick).trim();
    if (!/^\d*\.?\d+$/.test(f)) return NaN;
    feet = parseFloat(f);
    rest = s.slice(tick + 1);
  }

  rest = rest.replace(/"/g, '').replace(/-/g, ' ').trim();
  let inches = 0;
  if (rest) {
    for (const tok of rest.split(/\s+/)) {
      const m = tok.match(/^(\d+)\/(\d+)$/);
      if (m) {
        const den = Number(m[2]);
        if (den === 0) return NaN;
        inches += Number(m[1]) / den;
      } else if (/^\d*\.?\d+$/.test(tok)) {
        inches += parseFloat(tok);
      } else {
        return NaN;
      }
    }
  } else if (tick < 0) {
    return NaN;
  }
  return feet * 12 + inches;
}

/** Inches to a fractional string rounded to 1/16, e.g. 92.625 -> "92 5/8". No unit mark. */
export function toFraction(v: number): string {
  let n = Math.round(v * 16);
  const neg = n < 0;
  n = Math.abs(n);
  const whole = Math.floor(n / 16);
  let r = n % 16;
  let d = 16;
  while (r && r % 2 === 0) {
    r /= 2;
    d /= 2;
  }
  const body = r ? `${whole ? `${whole} ` : ''}${r}/${d}` : String(whole);
  return (neg ? '-' : '') + body;
}

export type Formatter = (inches: number) => string;

/** Builds a length formatter: inches (92 5/8") or feet-inches (7'-8 5/8"). */
export function makeFormatter(units: Units): Formatter {
  return (v: number) => {
    if (!Number.isFinite(v)) return '—';
    if (units === 'ftin' && Math.abs(v) >= 12) {
      const n = Math.round(v * 16);
      const ft = Math.floor(n / 192);
      return `${ft}'-${toFraction((n - ft * 192) / 16)}"`;
    }
    return `${toFraction(v)}"`;
  };
}

/** Rounds to the nearest 1/16" so lengths group cleanly in a cut list. */
export const round16 = (v: number) => Math.round(v * 16) / 16;
