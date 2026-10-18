import { describe, expect, it } from 'vitest';
import { computeFraming, type Framing, type OpeningSpec, type Role, type WallSpec } from './framing';
import type { SheathingSpec } from './sheathing';
import { makeFormatter } from './units';

const fmt = makeFormatter('in');

/** Seams on 16" layout with no corner offsets, single seam studs, and no seams inside the wall. */
const NO_SHEATHING_EFFECTS: SheathingSpec = {
  orientation: 'vertical',
  thickness: 0,
  startHeight: 0,
  corners: { left: 'none', right: 'none' },
  seamStuds: 'single',
  blockSeams: true,
};

const wall = (over: Partial<WallSpec> = {}): WallSpec => ({
  length: 240,
  height: 97.125,
  spacing: 16,
  layoutFrom: 'left',
  topPlates: 2,
  headerMount: 'dropped',
  exterior: true,
  sillPlies: 1,
  sheathing: NO_SHEATHING_EFFECTS,
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

  it('frames kings, jacks, a 4x8 header and a sill around the rough opening', () => {
    expect(xs(f, 'king')).toEqual([27, 79.5]);
    expect(xs(f, 'jack')).toEqual([28.5, 78]);
    const header = of(f, 'header')[0]!;
    expect(header.size).toBe('4x8');
    expect(header.length).toBe(51);
    expect(of(f, 'sill')[0]!.length).toBe(48);
  });

  it('drops the header tight under the top plates, with jacks up to it', () => {
    expect(o.headerTop).toBeCloseTo(94.125);
    expect(o.headerBottom).toBeCloseTo(94.125 - 7.25);
    expect(of(f, 'jack')[0]!.length).toBeCloseTo(94.125 - 7.25 - 1.5);
  });

  it('puts a flat head plate at the top of the opening with cripples up to the header', () => {
    const plate = of(f, 'headPlate');
    expect(plate).toHaveLength(1);
    expect(plate[0]).toMatchObject({ x: 30, z: 82.5, w: 48 });
    expect(o.gapAbove).toBeCloseTo(86.875 - 84);
    expect(xs(f, 'crippleTop')).toEqual([30, 47.25, 63.25, 76.5]);
  });

  it('sizes cripples below the sill', () => {
    expect(o.crippleBelow).toBeCloseTo(33);
    // end cripples plus layout cripples at 48 and 64; the one at 32 would overlap the end cripple
    expect(xs(f, 'crippleBottom')).toEqual([30, 47.25, 63.25, 76.5]);
  });

  it('removes layout studs inside the opening framing', () => {
    const studs = xs(f, 'stud');
    for (const x of studs) expect(x + 1.5 <= 27 || x >= 81).toBe(true);
  });

  it('lists one header with its foam fill', () => {
    const g = f.cutList.find((c) => c.role === 'header')!;
    expect(g.qty).toBe(1);
    expect(g.notes.join(' ')).toMatch(/2" rigid foam/);
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
  const header = (f: Framing) => of(f, 'header')[0]!;

  it('doubles jacks when the header is over 6\'-0" (10/S4.1)', () => {
    // 68" RO: 71" header with single jacks
    expect(of(frame(wall({ openings: [opening({ width: 68 })] })), 'jack')).toHaveLength(2);
    // 70" RO: 73" header
    const f = frame(wall({ openings: [opening({ x: 40, width: 70 })] }));
    expect(of(f, 'jack')).toHaveLength(4);
    expect(header(f).length).toBe(70 + 6);
  });

  it('adds A35 clips to long exterior headers only', () => {
    const long = wall({ openings: [opening({ x: 40, width: 70 })] });
    expect(frame(long).cutList.find((c) => c.role === 'header')!.notes.join(' ')).toMatch(/A35/);
    expect(frame({ ...long, exterior: false }).cutList.find((c) => c.role === 'header')!.notes.join(' ')).not.toMatch(/A35/);
  });

  it('doubles the head plate at exterior openings over 8\'-0"', () => {
    const f = frame(wall({ length: 300, openings: [opening({ x: 40, width: 100 })] }));
    expect(of(f, 'headPlate')).toHaveLength(2);
    expect(frame(wall({ length: 300, exterior: false, openings: [opening({ x: 40, width: 100 })] })).openings[0]!.headPlies).toBe(1);
  });

  it('uses scheduled beams by mark', () => {
    const f = frame(wall({ openings: [opening({ header: '4x10' })] }));
    expect(header(f).size).toBe('B4 4x10');
    expect(header(f).h).toBe(9.25);
    expect(f.cutList.find((c) => c.role === 'header')!.notes.join(' ')).toMatch(/B4 per beam schedule/);
  });

  it('rips a filler when the space under the header is too short for cripples', () => {
    // 4x10 bottom at 84 7/8" over a head plate topping out at 84"
    const f = frame(wall({ openings: [opening({ header: '4x10' })] }));
    expect(of(f, 'crippleTop')).toHaveLength(0);
    expect(of(f, 'filler')[0]!.fillHeight).toBeCloseTo(0.875);
  });

  it('raises a deep header into the double top plate when that makes it fit', () => {
    // 3 1/2 x 11 7/8 LVL over a head at 82": needs 83 1/2" at its bottom
    const f = frame(wall({ openings: [opening({ header: 'lvl-3.5x11.875', sill: 35.5 })] }));
    const o = f.openings[0]!;
    expect(o.hasError).toBe(false);
    expect(o.headerTop).toBeCloseTo(95.625);
    expect(o.topPlateCut).toEqual([28.5, 79.5]);
    expect(f.issues.some((i) => /MSTA24/.test(i.message))).toBe(true);
  });

  it('errors when the header cannot fit even raised into the plate', () => {
    const f = frame(wall({ openings: [opening({ header: 'lvl-3.5x11.875' })] }));
    expect(f.openings[0]!.hasError).toBe(true);
  });

  describe('sitting on the opening', () => {
    const f = frame(wall({ headerMount: 'onJacks', openings: [opening()] }));
    const o = f.openings[0]!;

    it('puts the header on the jacks with cripples up to the plates', () => {
      expect(o.headerBottom).toBe(82.5);
      expect(of(f, 'jack')[0]!.length).toBeCloseTo(81);
      expect(of(f, 'headPlate')).toHaveLength(0);
      expect(o.gapAbove).toBeCloseTo(94.125 - 89.75);
    });

    it('errors when the header runs into the top plate', () => {
      expect(frame(wall({ headerMount: 'onJacks', openings: [opening({ header: 'lvl-3.5x18' })] })).openings[0]!.hasError).toBe(true);
    });
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

describe('sheathing', () => {
  const sheathing = (over: Partial<SheathingSpec> = {}): SheathingSpec => ({ ...NO_SHEATHING_EFFECTS, ...over });

  it('pulls layout in by the sheathing thickness at an outside corner', () => {
    const f = frame(wall({ sheathing: sheathing({ thickness: 2, corners: { left: 'outside', right: 'none' } }) }));
    expect(f.layout[0]).toEqual({ center: 14, distance: 14 });
    expect(f.sheathing.verticalSeams[0]).toEqual({ x: 46, distance: 46 });
    // the stud under the seam is centered on it
    expect(xs(f, 'stud')).toContain(46 - 0.75);
  });

  it('pulls layout in by wall depth plus sheathing at an inside corner', () => {
    const f = frame(wall({ sheathing: sheathing({ thickness: 2, corners: { left: 'inside', right: 'none' } }) }));
    expect(f.layout[0]!.center).toBeCloseTo(16 - 7.5);
    expect(f.sheathing.verticalSeams[0]!.x).toBeCloseTo(48 - 7.5);
  });

  it('uses the corner at the end the layout is pulled from', () => {
    const f = frame(wall({ layoutFrom: 'right', sheathing: sheathing({ thickness: 2, corners: { left: 'inside', right: 'outside' } }) }));
    expect(f.layout[0]).toEqual({ center: 240 - 14, distance: 14 });
    expect(f.sheathing.verticalSeams[0]!.x).toBe(240 - 46);
  });

  it('straddles vertical seams with double studs, replacing the layout stud', () => {
    const f = frame(wall({ sheathing: sheathing({ seamStuds: 'double' }) }));
    const seam = xs(f, 'seamStud');
    expect(seam).toEqual([46.5, 48, 94.5, 96, 142.5, 144, 190.5, 192]);
    expect(xs(f, 'stud')).not.toContain(47.25);
  });

  it('adds a centered stud when a seam misses the layout', () => {
    const f = frame(wall({ spacing: 19.2, sheathing: sheathing({ seamStuds: 'single' }) }));
    expect(xs(f, 'seamStud')).toContain(47.25);
  });

  it('notes a seam over an opening with nothing behind it', () => {
    const f = frame(wall({ spacing: 19.2, openings: [opening()] }));
    expect(f.issues.some((i) => i.level === 'note' && /seam 48" from the left end falls inside W1/.test(i.message))).toBe(true);
  });

  it('blocks horizontal seams across every bay, centered on the seam', () => {
    const f = frame(wall({ sheathing: sheathing({ startHeight: 12 }) }));
    const blocks = of(f, 'blocking');
    // 2x4 flat: 3 1/2" face centered on the 12" seam
    expect(blocks.every((b) => b.z === 10.25 && b.h === 3.5 && b.size === '2x4')).toBe(true);
    // blocks plus the studs between the end studs fill 1 1/2" to 238 1/2"
    const posts = of(f, 'stud').length - 2;
    expect(blocks.reduce((a, b) => a + b.w, 0) + posts * 1.5).toBeCloseTo(237);
  });

  it('skips blocking inside rough openings but blocks between cripples', () => {
    const f = frame(
      wall({
        sheathing: sheathing({ startHeight: 12 }),
        openings: [opening(), opening({ id: 'd', label: 'D1', type: 'door', x: 152, width: 38, height: 82.5, sill: 0 })],
      }),
    );
    const blocks = of(f, 'blocking');
    expect(blocks.some((b) => b.x < 190 && b.x + b.w > 152)).toBe(false); // door
    expect(blocks.some((b) => b.x >= 30 && b.x + b.w <= 78)).toBe(true); // under the window sill
  });

  it('puts horizontal panels on 4\' rows from the start height', () => {
    const f = frame(wall({ sheathing: sheathing({ orientation: 'horizontal', startHeight: 12 }) }));
    expect(f.sheathing.horizontalSeams).toEqual([12, 60]);
    expect(f.sheathing.verticalSeams.map((s) => s.x)).toEqual([96, 192]);
  });

  it('finds the top of the panel row that covers the top of the wall', () => {
    expect(frame(wall({ sheathing: sheathing({ startHeight: 12 }) })).sheathing.top).toBe(108);
    expect(frame(wall({ sheathing: sheathing({ orientation: 'horizontal', startHeight: 12 }) })).sheathing.top).toBe(108);
    expect(frame(wall({ sheathing: sheathing({ startHeight: 0 }) })).sheathing.top).toBe(192);
    expect(frame(wall({ height: 96, sheathing: sheathing({ startHeight: 0 }) })).sheathing.top).toBe(96);
  });

  it('can turn blocking off', () => {
    const f = frame(wall({ sheathing: sheathing({ startHeight: 12, blockSeams: false }) }));
    expect(of(f, 'blocking')).toHaveLength(0);
  });
});
