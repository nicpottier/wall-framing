import { describe, expect, it } from 'vitest';
import { computeFraming, type Framing, type OpeningSpec, type Role, type WallSpec } from './framing';
import { makeFormatter } from './units';

const fmt = makeFormatter('in');

const wall = (over: Partial<WallSpec> = {}): WallSpec => ({
  length: 240,
  height: 97.125,
  spacing: 16,
  layoutFrom: 'left',
  topPlates: 2,
  headerPlies: 2,
  sillPlies: 1,
  openings: [],
  ...over,
});

const opening = (over: Partial<OpeningSpec> = {}): OpeningSpec => ({
  id: 'a',
  label: 'W1',
  type: 'window',
  x: 30,
  width: 48,
  height: 46.5,
  sill: 36,
  header: 'auto',
  jacksPerSide: 'auto',
  ...over,
});

function frame(spec: WallSpec): Framing {
  const r = computeFraming(spec, fmt);
  if (!r.ok) throw new Error(r.message);
  return r;
}
const of = (f: Framing, role: Role) => f.members.filter((m) => m.role === role);
const xs = (f: Framing, role: Role) => of(f, role).map((m) => m.x).sort((a, b) => a - b);

describe('plain wall', () => {
  const f = frame(wall());

  it('uses 92 5/8" studs for a 97 1/8" wall with a double top plate', () => {
    expect(f.studLength).toBeCloseTo(92.625);
    expect(of(f, 'topPlate')).toHaveLength(2);
  });

  it('places end studs and centers studs on 16" layout', () => {
    const studs = xs(f, 'stud');
    expect(studs[0]).toBe(0);
    expect(studs.at(-1)).toBe(238.5);
    expect(studs).toContain(16 - 0.75);
    expect(studs).toContain(224 - 0.75);
    // 0, 14 layout studs (16..224), 238.5
    expect(studs).toHaveLength(16);
  });

  it('mirrors layout when laid out from the right', () => {
    const r = frame(wall({ length: 250, layoutFrom: 'right' }));
    expect(xs(r, 'stud')).toContain(250 - 16 - 0.75);
  });

  it('fails clearly on an unreadable wall', () => {
    const r = computeFraming(wall({ length: NaN }), fmt);
    expect(r.ok).toBe(false);
  });
});

describe('window', () => {
  const f = frame(wall({ openings: [opening()] }));
  const o = f.openings[0]!;

  it('frames kings, jacks, header and sill around the rough opening', () => {
    expect(xs(f, 'king')).toEqual([27, 79.5]);
    expect(xs(f, 'jack')).toEqual([28.5, 78]);
    expect(of(f, 'jack')[0]!.length).toBeCloseTo(81); // 82 1/2 RO top - bottom plate
    const header = of(f, 'header')[0]!;
    expect(header.size).toBe('2x8');
    expect(header.length).toBe(51);
    expect(of(f, 'sill')[0]!.length).toBe(48);
  });

  it('sizes cripples above the header and below the sill', () => {
    expect(o.gapAbove).toBeCloseTo(94.125 - (82.5 + 7.25));
    expect(of(f, 'crippleTop').every((m) => Math.abs(m.length - 4.375) < 1e-9)).toBe(true);
    expect(o.crippleBelow).toBeCloseTo(33);
    // end cripples plus layout cripples at 48 and 64; the one at 32 would overlap the end cripple
    expect(xs(f, 'crippleBottom')).toEqual([30, 47.25, 63.25, 76.5]);
  });

  it('removes layout studs inside the opening framing', () => {
    const studs = xs(f, 'stud');
    for (const x of studs) expect(x + 1.5 <= 27 || x >= 81).toBe(true);
  });

  it('counts header plies in the cut list', () => {
    const g = f.cutList.find((c) => c.role === 'header')!;
    expect(g.qty).toBe(2);
  });
});

describe('door', () => {
  const f = frame(wall({ openings: [opening({ type: 'door', label: 'D1', x: 150, width: 38, height: 82.5, sill: 0 })] }));

  it('cuts the bottom plate at the rough opening', () => {
    expect(f.openings[0]!.plateCut).toEqual([150, 188]);
    expect(of(f, 'sill')).toHaveLength(0);
    expect(of(f, 'crippleBottom')).toHaveLength(0);
  });

  it('notes the plate cut in the cut list', () => {
    const plate = f.cutList.find((c) => c.role === 'plate')!;
    expect(plate.notes.join(' ')).toMatch(/Cut out at D1/);
  });
});

describe('headers', () => {
  it('doubles jacks on wide openings', () => {
    const f = frame(wall({ openings: [opening({ x: 40, width: 96 })] }));
    expect(of(f, 'jack')).toHaveLength(4);
    expect(of(f, 'header')[0]!.length).toBe(96 + 6);
  });

  it('steps the header down when the preferred size will not fit', () => {
    // 60" RO prefers 2x10; RO top 86" leaves 8 1/8" under the plates
    const f = frame(wall({ openings: [opening({ width: 60, height: 50, sill: 36 })] }));
    expect(of(f, 'header')[0]!.size).toBe('2x8');
    expect(f.issues.some((i) => i.level === 'warning')).toBe(true);
  });

  it('uses a filler strip when the gap is too short for cripples', () => {
    const f = frame(wall({ openings: [opening({ header: '2x10' })] }));
    expect(of(f, 'crippleTop')).toHaveLength(0);
    expect(of(f, 'filler')[0]!.fillHeight).toBeCloseTo(94.125 - 91.75);
  });

  it('errors when an explicit header hits the top plate', () => {
    const f = frame(wall({ openings: [opening({ header: '2x12', sill: 40 })] }));
    expect(f.openings[0]!.hasError).toBe(true);
  });
});

describe('conflicts', () => {
  it('flags openings whose framing overlaps', () => {
    const f = frame(wall({ openings: [opening(), opening({ id: 'b', label: 'W2', x: 80 })] }));
    expect(f.issues.find((i) => i.level === 'error')?.message).toMatch(/W1 and W2/);
  });

  it('flags openings too close to the wall ends', () => {
    const f = frame(wall({ openings: [opening({ x: 2 })] }));
    expect(f.openings[0]!.hasError).toBe(true);
  });

  it('notes a sliver bay next to a king', () => {
    // king at 145 with a layout stud at 143.25..144.75
    const f = frame(wall({ openings: [opening({ type: 'door', x: 148, width: 38, height: 82.5, sill: 0 })] }));
    expect(f.issues.some((i) => i.level === 'note')).toBe(true);
  });
});
