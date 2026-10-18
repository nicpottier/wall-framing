import { describe, expect, it } from 'vitest';
import { EXAMPLE_WALL, resolveOpening, toWallSpec, wallReducer, type OpeningInput, type WallInput } from './wall';

const wall = (over: Partial<WallInput> = {}): WallInput => ({ ...structuredClone(EXAMPLE_WALL), openings: [], ...over });

const win = (over: Partial<OpeningInput> = {}): OpeningInput => ({
  id: 'w',
  type: 'window',
  label: 'W1',
  from: 'left',
  offset: '30',
  width: '36',
  height: '48',
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

describe('resolveOpening', () => {
  it('adds the window allowance to the unit size', () => {
    const r = ok(win(), wall({ windowRoWidth: '3', windowRoHeight: '1/2' }));
    expect(r.roWidth).toBe(39);
    expect(r.roHeight).toBe(48.5);
  });

  it('adds the door allowance to doors', () => {
    const r = ok(win({ type: 'door', width: '36', height: '80' }), wall({ doorRoWidth: '2', doorRoHeight: '2 1/2' }));
    expect(r.roWidth).toBe(38);
    expect(r.roHeight).toBe(82.5);
    expect(r.sill).toBe(0);
  });

  it("sets a window's sill from the wall head height", () => {
    const r = ok(win(), wall({ windowHeadHeight: '82 1/2', windowRoHeight: '3' }));
    expect(r.headHeight).toBe(82.5);
    expect(r.sill).toBe(82.5 - 51);
    expect(r.defaultHead).toBe(true);
  });

  it('lets a window override the head height', () => {
    const r = ok(win({ headHeight: "7'" }), wall({ windowHeadHeight: '82 1/2', windowRoHeight: '3' }));
    expect(r.headHeight).toBe(84);
    expect(r.sill).toBe(84 - 51);
    expect(r.defaultHead).toBe(false);
  });

  it('measures from the right end to the right edge of the rough opening', () => {
    const r = ok(win({ from: 'right', offset: '50' }), wall({ length: "20'", windowRoWidth: '3' }));
    expect(r.x).toBe(240 - 50 - 39);
  });

  it('rejects a window taller than its head height', () => {
    const r = resolveOpening(win({ height: '90' }), wall());
    expect(r.ok).toBe(false);
  });

  it('rejects a bad override instead of silently using the default', () => {
    expect(resolveOpening(win({ headHeight: 'abc' }), wall()).ok).toBe(false);
  });
});

describe('toWallSpec', () => {
  it('turns the example wall into the expected rough openings', () => {
    const { spec, inputIssues } = toWallSpec(EXAMPLE_WALL);
    expect(inputIssues).toEqual([]);
    const [w1, d1] = spec.openings;
    expect(w1).toMatchObject({ x: 30, width: 48, height: 46.5, sill: 36, unit: { width: 45, height: 43.5 } });
    expect(d1).toMatchObject({ x: 152, width: 38, height: 82.5, sill: 0 });
  });

  it('reports openings it cannot read', () => {
    const { spec, inputIssues } = toWallSpec(wall({ openings: [win({ width: '' })] }));
    expect(spec.openings).toHaveLength(0);
    expect(inputIssues[0]?.openingId).toBe('w');
  });
});

describe('wallReducer', () => {
  it('swaps default unit sizes when an untouched window becomes a door', () => {
    const s = wallReducer(wall({ openings: [win()] }), { type: 'setOpeningType', id: 'w', kind: 'door' });
    expect(s.openings[0]).toMatchObject({ type: 'door', label: 'D1', width: '36', height: '80' });
  });

  it('places new openings after the last one', () => {
    const s = wallReducer(wall({ openings: [win()] }), { type: 'addOpening', kind: 'window' });
    // W1 RO spans 30..69 with a 3" allowance; next starts 24" later
    expect(s.openings[1]).toMatchObject({ label: 'W2', from: 'left', offset: '93' });
  });
});
