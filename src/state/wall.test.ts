import { describe, expect, it } from 'vitest';
import { EXAMPLE_WALL, parseSize, resolveOpening, toWallSpec, wallReducer, type OpeningInput, type WallInput } from './wall';

const wall = (over: Partial<WallInput> = {}): WallInput => ({ ...structuredClone(EXAMPLE_WALL), openings: [], ...over });

const win = (over: Partial<OpeningInput> = {}): OpeningInput => ({
  id: 'w',
  type: 'window',
  label: 'W1',
  from: 'left',
  offset: '48',
  width: '36',
  height: '48',
  ro: '',
  headHeight: '',
  header: 'auto',
  jacksPerSide: 'auto',
  ...over,
});

const ok = (o: OpeningInput, w: WallInput) => {
  const r = resolveOpening(o, w);
  if (!r.ok) throw new Error(r.message);
  return r;
};

describe('parseSize', () => {
  it('reads width x height in any length style', () => {
    expect(parseSize('45 x 43 1/2')).toEqual({ width: 45, height: 43.5 });
    expect(parseSize('3-0 x 4-6')).toEqual({ width: 36, height: 54 });
    expect(parseSize('3-0 × 6-8')).toEqual({ width: 36, height: 80 });
  });

  it('reads four-digit schedule callouts', () => {
    expect(parseSize('3046')).toEqual({ width: 36, height: 54 });
    expect(parseSize('2868')).toEqual({ width: 32, height: 80 });
  });

  it('rejects anything else', () => {
    expect(parseSize('3-0x4-6')).toBeNull();
    expect(parseSize('30461')).toBeNull();
    expect(parseSize('36 by 48')).toBeNull();
  });
});

describe('resolveOpening', () => {
  it('centers the rough opening on the position from the left', () => {
    const r = ok(win(), wall({ windowRoWidth: '3' }));
    expect(r.center).toBe(48);
    expect(r.roWidth).toBe(39);
    expect(r.x).toBe(48 - 19.5);
  });

  it('measures from the right end to the centerline', () => {
    const r = ok(win({ from: 'right', offset: '5-0' }), wall({ length: '20-0' }));
    expect(r.center).toBe(240 - 60);
  });

  it('adds the allowance, or uses an explicit rough opening', () => {
    expect(ok(win(), wall({ windowRoWidth: '3', windowRoHeight: '1/2' }))).toMatchObject({ roWidth: 39, roHeight: 48.5 });
    expect(ok(win({ ro: '40 x 50' }), wall())).toMatchObject({ roWidth: 40, roHeight: 50 });
  });

  it("sets a window's sill from the wall head height or its own", () => {
    expect(ok(win(), wall({ windowHeadHeight: '82 1/2', windowRoHeight: '3' })).sill).toBe(82.5 - 51);
    expect(ok(win({ headHeight: '7-0' }), wall({ windowRoHeight: '3' })).sill).toBe(84 - 51);
  });

  it('rejects a window taller than its head height, and bad overrides', () => {
    expect(resolveOpening(win({ height: '90' }), wall()).ok).toBe(false);
    expect(resolveOpening(win({ headHeight: 'abc' }), wall()).ok).toBe(false);
    expect(resolveOpening(win({ ro: '40 by 50' }), wall()).ok).toBe(false);
  });
});

describe('toWallSpec', () => {
  it('turns the example wall into the expected rough openings', () => {
    const { spec, inputIssues } = toWallSpec(EXAMPLE_WALL);
    expect(inputIssues).toEqual([]);
    const [w1, d1] = spec.openings;
    expect(w1).toMatchObject({ x: 30, width: 48, height: 46.5, sill: 36, unit: { width: 45, height: 43.5 } });
    expect(d1).toMatchObject({ x: 152, width: 38, height: 82.5, sill: 0 });
    expect(spec.defaultHeader).toBe('4x8');
  });

  it('reports openings it cannot read', () => {
    const { spec, inputIssues } = toWallSpec(wall({ openings: [win({ width: '' })] }));
    expect(spec.openings).toHaveLength(0);
    expect(inputIssues[0]?.openingId).toBe('w');
  });
});

describe('wallReducer', () => {
  it('swaps default unit sizes when an untouched window becomes a door', () => {
    const s = wallReducer(wall({ openings: [win({ width: '3-0', height: '4-0' })] }), { type: 'setOpeningType', id: 'w', kind: 'door' });
    expect(s.openings[0]).toMatchObject({ type: 'door', label: 'D1', width: '3-0', height: '6-8' });
  });

  it('places new openings after the last one, by centerline', () => {
    const s = wallReducer(wall({ openings: [win()] }), { type: 'addOpening', kind: 'window' });
    // W1 RO spans 28 1/2..67 1/2; the next RO starts 24" later and is 39" wide
    expect(s.openings[1]).toMatchObject({ label: 'W2', from: 'left', offset: toCenter(67.5 + 24, 39) });
  });
});

const toCenter = (x: number, w: number) => String(x + w / 2);
