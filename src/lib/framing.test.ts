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

const sheathing = (over: Partial<SheathingSpec> = {}): SheathingSpec => ({ ...NO_SHEATHING_EFFECTS, ...over });

const wall = (over: Partial<WallSpec> = {}): WallSpec => ({
  length: 240,
  height: 97.125,
  spacing: 16,
  layoutFrom: 'left',
  topPlates: 2,
  headerMount: 'dropped',
  defaultHeader: '4x8',
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

  it('uses the chosen header size', () => {
    const f = frame(wall({ openings: [opening({ header: '4x10' })] }));
    expect(header(f).size).toBe('4x10');
    expect(header(f).h).toBe(9.25);
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

  it('tops out at the last panel row that is mostly on this wall', () => {
    // 12-108: 85 1/8" of 96" on the wall, so it goes on before the wall is stood
    expect(frame(wall({ sheathing: sheathing({ startHeight: 12 }) })).sheathing.top).toBe(108);
    // 60-108: 37 1/8" of 48" on the wall
    expect(frame(wall({ sheathing: sheathing({ orientation: 'horizontal', startHeight: 12 }) })).sheathing.top).toBe(108);
    // 96-192 is almost all on the wall above
    expect(frame(wall({ sheathing: sheathing({ startHeight: 0 }) })).sheathing.top).toBe(96);
    expect(frame(wall({ sheathing: sheathing({ orientation: 'horizontal', startHeight: 0 }) })).sheathing.top).toBe(96);
    expect(frame(wall({ height: 96, sheathing: sheathing({ startHeight: 0 }) })).sheathing.top).toBe(96);
  });

  it('never cuts slivers of blocking', () => {
    const f = frame(wall({ sheathing: sheathing({ startHeight: 12, seamStuds: 'double' }), openings: [opening()] }));
    expect(of(f, 'blocking').every((b) => b.w >= 3)).toBe(true);
  });

  it('can turn blocking off', () => {
    const f = frame(wall({ sheathing: sheathing({ startHeight: 12, blockSeams: false }) }));
    expect(of(f, 'blocking')).toHaveLength(0);
  });
});

describe('posts', () => {
  it('replaces the layout studs it covers with a 6x6', () => {
    // A 6x6 from 45 1/4 to 50 3/4 covers the stud on 48.
    const f = frame(wall({ posts: [{ id: 'p', label: 'P1', x: 45.25, type: '6x6' }] }));
    const [post, ...rest] = of(f, 'post');
    expect(rest).toHaveLength(0);
    expect(post).toMatchObject({ x: 45.25, w: 5.5, size: '6x6', length: f.studLength });
    expect(of(f, 'stud').some((m) => m.layoutCenter === 48)).toBe(false);
    expect(of(f, 'stud').some((m) => m.layoutCenter === 32)).toBe(true);
    expect(f.posts[0]!.hasError).toBe(false);
  });

  it('builds up studs as separate plies', () => {
    const f = frame(wall({ posts: [{ id: 'p', label: 'P', x: 100, type: 'studs-3' }] }));
    expect(xs(f, 'post')).toEqual([100, 101.5, 103]);
    expect(f.cutList.find((g) => g.role === 'post')!.qty).toBe(3);
  });

  it('takes the place of the end stud at a wall end', () => {
    const f = frame(wall({ posts: [{ id: 'p', label: 'P', x: 0, type: '6x6' }] }));
    expect(of(f, 'stud').some((m) => m.isEnd && m.x === 0)).toBe(false);
    expect(of(f, 'stud').some((m) => m.isEnd && m.x === 238.5)).toBe(true);
  });

  it('is an error over an opening', () => {
    const f = frame(wall({ openings: [opening()], posts: [{ id: 'p', label: 'P1', x: 50, type: '6x6' }] }));
    expect(f.issues.some((i) => i.level === 'error' && i.message.startsWith('P1: overlaps W1'))).toBe(true);
    expect(of(f, 'post')).toHaveLength(0);
  });

  it('backs a sheathing seam that lands on it', () => {
    const f = frame(wall({ sheathing: sheathing({ seamStuds: 'double' }), posts: [{ id: 'p', label: 'P', x: 45, type: '6x6' }] }));
    expect(of(f, 'seamStud').some((m) => m.x > 40 && m.x < 52)).toBe(false);
  });
});

describe('plate steps', () => {
  // The stair stretch rises to the second floor's bottom plate, 10'-1 7/8".
  const tall = { id: 't', label: 'Stair', x0: 96, x1: 192, height: 121.875 };
  const f = frame(wall({ height: 109.25, tall: [tall] }));

  it('splits the wall into stretches with their own plates and stud lengths', () => {
    expect(f.sections.map((p) => [p.x0, p.x1, p.height])).toEqual([
      [0, 96, 109.25],
      [96, 192, 121.875],
      [192, 240, 109.25],
    ]);
    expect(f.maxHeight).toBe(121.875);
    expect(f.sections[1]!.studLength).toBeCloseTo(117.375);
    expect(of(f, 'topPlate').filter((m) => m.z > 115)).toHaveLength(2);
    expect(of(f, 'topPlate').filter((m) => m.z > 115).every((m) => m.x === 96 && m.w === 96)).toBe(true);
  });

  it('puts (2) studs each side of each step', () => {
    const step = of(f, 'stud').filter((m) => m.isStep);
    expect(step.map((m) => [m.x, m.length])).toEqual([
      [94.5, 104.75],
      [96, 117.375],
      [93, 104.75],
      [97.5, 117.375],
      [190.5, 117.375],
      [192, 104.75],
      [189, 117.375],
      [193.5, 104.75],
    ]);
    expect(f.steps.map((s) => [s.x, s.low])).toEqual([
      [96, 'left'],
      [192, 'right'],
    ]);
  });

  it('blocks 4\'-0" into the tall side in line with the lower plates', () => {
    const [left, right] = f.steps;
    expect(left!.blocking![0]).toBe(99);
    expect(left!.blocking![1] - 96).toBeGreaterThanOrEqual(48);
    expect(192 - right!.blocking![0]).toBeGreaterThanOrEqual(48);
    for (const b of of(f, 'stepBlocking')) {
      expect(b.z + b.h / 2).toBeCloseTo(109.25 - 1.5);
      expect(b.x).toBeGreaterThanOrEqual(96);
      expect(b.x + b.w).toBeLessThanOrEqual(192);
    }
    expect(f.issues.filter((i) => i.message.includes('CS16'))).toHaveLength(2);
  });

  it('frames openings to their own stretch', () => {
    const g = frame(wall({ height: 109.25, tall: [tall], openings: [opening({ x: 120, width: 30, sill: 60 })] }));
    const king = of(g, 'king')[0]!;
    expect(king.length).toBeCloseTo(117.375);
    expect(g.openings[0]!.headerTop).toBeCloseTo(121.875 - 3);
  });

  it('flags an opening across a step', () => {
    const g = frame(wall({ height: 109.25, tall: [tall], openings: [opening({ x: 80, width: 30 })] }));
    expect(g.issues.some((i) => i.level === 'error' && i.message.includes('plate step'))).toBe(true);
  });

  it('runs to the end of the wall without a step there', () => {
    const g = frame(wall({ height: 109.25, tall: [{ ...tall, x0: 120, x1: 240 }] }));
    expect(g.steps).toHaveLength(1);
    expect(of(g, 'stud').find((m) => m.isEnd && m.x === 238.5)!.length).toBeCloseTo(117.375);
  });

  it('rejects stretches that leave no room for step studs', () => {
    const g = frame(wall({ height: 109.25, tall: [{ ...tall, x0: 2 }] }));
    expect(g.sections).toHaveLength(1);
    expect(g.issues.some((i) => i.level === 'error' && i.message.startsWith('Stair: leaves only'))).toBe(true);
  });

  it('gives tall stretches their own sheathing rows', () => {
    const g = frame(wall({ height: 109.25, tall: [{ ...tall, x1: 240, height: 220 }], sheathing: sheathing({ startHeight: 12 }) }));
    expect(g.sections[1]!.seams).toEqual([12, 108, 204]);
    expect(g.sections[1]!.sheathTop).toBe(204);
    // the step blocking backs the 108 seam near the step; plain seam blocking takes over past it
    expect(of(g, 'blocking').some((b) => b.x >= 160 && b.seamHeight === 108)).toBe(true);
    expect(of(g, 'blocking').some((b) => b.x < 140 && b.x > 96 && b.seamHeight === 108)).toBe(false);
  });
});

describe('2x4 and unsheathed walls', () => {
  const f = frame(wall({ studs: '2x4', sheathing: { ...NO_SHEATHING_EFFECTS, enabled: false, startHeight: 12 }, openings: [opening()] }));

  it('cuts every stud and plate from 2x4', () => {
    expect(of(f, 'stud').every((m) => m.size === '2x4')).toBe(true);
    expect(of(f, 'plate')[0]!.size).toBe('2x4');
  });

  it('needs no foam behind a 4x8 header', () => {
    expect(f.cutList.find((g) => g.role === 'header')!.notes.some((n) => n.includes('foam'))).toBe(false);
  });

  it('has no seams, seam studs or blocking', () => {
    expect(f.sheathing.verticalSeams).toEqual([]);
    expect(of(f, 'seamStud')).toHaveLength(0);
    expect(of(f, 'blocking')).toHaveLength(0);
  });
});

describe('california corners', () => {
  it('lays a stud flat against the end stud, reaching past the wall butting in', () => {
    const f = frame(wall({ california: { left: 5.5, right: 0 } }));
    const [b, ...rest] = of(f, 'cornerBacker');
    expect(rest).toHaveLength(0);
    // End stud 0 to 1 1/2, flat 2x6 1 1/2 to 7: 1 1/2" past the corner at 5 1/2.
    expect(b).toMatchObject({ x: 1.5, w: 5.5, length: f.studLength });
  });

  it('moves along only when the wall is too shallow to reach past the corner', () => {
    // A flat 2x4 against the end stud would stop at 5", short of a 2x6 wall butting in at 5 1/2".
    const f = frame(wall({ studs: '2x4', california: { left: 5.5, right: 3.5 } }));
    expect(of(f, 'cornerBacker').map((m) => [m.x, m.w])).toEqual([
      [3.5, 3.5],
      [240 - 5, 3.5],
    ]);
  });

  it('works from the right end and moves layout studs out of the way', () => {
    const f = frame(wall({ california: { left: 0, right: 5.5 } }));
    expect(of(f, 'cornerBacker')[0]).toMatchObject({ x: 240 - 7, w: 5.5 });
    expect(of(f, 'stud').some((m) => !m.isEnd && m.x + m.w > 233 && m.x < 238.5)).toBe(false);
  });

  it('skips the backer where a king already backs the corner', () => {
    const f = frame(wall({ california: { left: 5.5, right: 0 }, openings: [opening({ x: 8.5 })] }));
    expect(of(f, 'cornerBacker')).toHaveLength(0);
  });

  it('uses a single stud when an opening leaves no room to lay one flat', () => {
    // A 2x4 butting in puts the corner at 3 1/2; W1's king at 5 1/2 blocks the flat stud but not a single one.
    const f = frame(wall({ california: { left: 3.5, right: 0 }, openings: [opening({ x: 8.5 })] }));
    expect(of(f, 'cornerBacker')[0]).toMatchObject({ x: 3.5, w: 1.5 });
  });

  it('falls back to a note when an opening leaves no room at all', () => {
    const f = frame(wall({ california: { left: 5.5, right: 0 }, openings: [opening({ x: 9 })] }));
    expect(of(f, 'cornerBacker')).toHaveLength(0);
    expect(f.issues.some((i) => i.message.includes('drywall clips'))).toBe(true);
  });
});

describe('intersections', () => {
  it('frames each side of a 2x4 wall with ladder blocking between', () => {
    const f = frame(wall({ intersections: [{ id: 'i', label: 'Bath', x: 40, width: 3.5 }] }));
    // Faces at 38 1/4 and 41 3/4; backers leave 3/4" of drywall nailing past each.
    expect(xs(f, 'partitionStud')).toEqual([36, 42.5]);
    expect(of(f, 'stud').some((m) => m.layoutCenter === 32)).toBe(true);
    const ladder = of(f, 'ladder');
    expect(ladder.length).toBe(3);
    expect(ladder.every((m) => m.x === 37.5 && m.w === 5)).toBe(true);
    expect(ladder.map((m) => m.z + m.h / 2)).toEqual([24, 48, 72]);
    expect(f.intersections[0]!.bay).toEqual([37.5, 42.5]);
  });

  it('uses a king beside it instead of adding a stud', () => {
    // W1's right king runs from 79 1/2 to 81.
    const f = frame(wall({ openings: [opening()], intersections: [{ id: 'i', label: 'P', x: 84, width: 3.5 }] }));
    expect(xs(f, 'partitionStud')).toEqual([86.5]);
    expect(f.intersections[0]!.bay).toEqual([81, 86.5]);
  });

  it('needs nothing more where a post covers it', () => {
    const f = frame(wall({ posts: [{ id: 'p', label: 'P1', x: 37.25, type: '6x6' }], intersections: [{ id: 'i', label: 'Stub', x: 40, width: 3.5 }] }));
    expect(of(f, 'partitionStud')).toHaveLength(0);
    expect(of(f, 'ladder')).toHaveLength(0);
  });

  it('warns when it meets the wall inside an opening', () => {
    const f = frame(wall({ openings: [opening()], intersections: [{ id: 'i', label: 'Closet', x: 50, width: 3.5 }] }));
    expect(f.issues.some((i) => i.level === 'warning' && i.message.startsWith("Closet: meets this wall inside W1's rough opening"))).toBe(true);
  });
});

describe('beams', () => {
  const B2 = { id: 'b', label: 'B2', depth: 11.875, size: '5½ × 11⅞ GL' };
  // 9'-1 1/4" walls: B2's top flush with the plates puts its underside at 97 3/8".
  const H = 109.25;

  it('pockets a beam crossing the wall over a post, breaking the top plates', () => {
    const f = frame(
      wall({ height: H, posts: [{ id: 'p', label: 'P1', x: 100, type: '6x6' }], beams: [{ ...B2, x0: 100, x1: 105.5 }] }),
    );
    expect(f.sections.map((p) => [p.x0, p.x1, p.plates])).toEqual([
      [0, 100, 2],
      [100, 105.5, 0],
      [105.5, 240, 2],
    ]);
    expect(of(f, 'post')[0]!.length).toBeCloseTo(97.375 - 1.5);
    expect(of(f, 'topPlate').every((m) => m.x + m.w <= 100 || m.x >= 105.5)).toBe(true);
    expect(f.issues.some((i) => i.message.startsWith('B2 (5½ × 11⅞ GL) breaks the top plates'))).toBe(true);
  });

  it('warns when nothing carries it', () => {
    const f = frame(wall({ height: H, beams: [{ ...B2, x0: 100, x1: 105.5 }] }));
    expect(f.issues.some((i) => i.level === 'warning' && i.message.startsWith('B2: nothing carries it'))).toBe(true);
  });

  it('caps a wall it runs along, with a single plate under it cut at the posts', () => {
    const f = frame(
      wall({
        height: H,
        posts: [
          { id: 'd', label: 'D', x: 0, type: '6x6' },
          { id: 'e', label: 'E', x: 234.5, type: '6x6' },
        ],
        beams: [{ ...B2, x0: 0, x1: 240 }],
      }),
    );
    const plates = of(f, 'topPlate');
    expect(plates).toHaveLength(1);
    expect(plates[0]).toMatchObject({ x: 5.5, w: 229, z: 97.375 - 1.5 });
    expect(f.studLength).toBeCloseTo(97.375 - 3);
    expect(of(f, 'post').every((m) => Math.abs(m.length - 95.875) < 1e-6)).toBe(true);
    expect(f.issues.some((i) => i.message.includes('caps this wall'))).toBe(true);
  });
});
