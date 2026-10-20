import { describe, expect, it } from 'vitest';
import { parseProjectText, projectToText } from './wallText';
import { EXAMPLE_PROJECT, loadSaved, postCutList, type Project } from './project';
import { resolveOpening, type WallInput } from './wall';

const SAMPLE = `# Buckley-Watanabe residence

Framing per structural plans Rev. 1, 05/22/26.

## Defaults
- studs: 2x6 @ 16
- top plate: double
- exterior: yes
- headers: 4x8, tight under plate
- head height: 6-10 1/2
- window ro: +3 x +3
- door ro: +2 x +2 1/2
- sheathing: vertical, 2" thick, start 12, double seam studs, block seams

## Wall A · south
- length: 20-0
- height: 8-1 1/8
- corners: left outside, right inside

<!-- confirm W2 with the owner -->

### Openings
- W1: window 3-9 x 3-7 1/2, 4-6 from left
- W2: window 3046, 4-1 1/2 after W1, head 7-0
- D1: door 3068, 5-9 from right, header 4x10

## Wall B · east
- length: 14-6
- layout: from right

Kitchen wall.

### Openings
- W3: window 5-0 x 3-0, centered, sill 3-6, jacks 2, header 3 1/2 x 11 7/8 lvl
`;

function parse(text: string): Project {
  const r = parseProjectText(text);
  if (!r.project) throw new Error(r.errors.map((e) => `${e.line}: ${e.message}`).join('\n'));
  return r.project;
}

const errorsOf = (text: string) => parseProjectText(text).errors;

/** Walls without ids, for comparing a round trip. */
const shape = (p: Project) => ({
  ...p,
  walls: p.walls.map(({ id: _id, openings, ...w }) => ({ ...w, openings: openings.map(({ id: _oid, ...o }) => o) })),
});

describe('parseProjectText', () => {
  const p = parse(SAMPLE);
  const [a, b] = p.walls as [WallInput, WallInput];

  it('reads the project, defaults and walls', () => {
    expect(p.title).toBe('Buckley-Watanabe residence');
    expect(p.notes).toBe('Framing per structural plans Rev. 1, 05/22/26.');
    expect(p.walls.map((w) => w.name)).toEqual(['Wall A · south', 'Wall B · east']);
    expect(p.defaults).toMatchObject({ spacing: '16', windowHeadHeight: '6-10 1/2', sheathingThickness: '2', doorRoHeight: '2 1/2' });
  });

  it('applies defaults to every wall and lets a wall override them', () => {
    expect(a).toMatchObject({ length: '20-0', height: '8-1 1/8', cornerLeft: 'outside', cornerRight: 'inside', layoutFrom: 'left' });
    expect(b).toMatchObject({ length: '14-6', layoutFrom: 'right', cornerLeft: 'none', windowHeadHeight: '6-10 1/2' });
  });

  it('keeps notes but not hidden comments', () => {
    expect(b.notes).toBe('Kitchen wall.');
    expect(a.notes).toBe('');
  });

  it('reads openings with dash lengths, callouts and centerline positions', () => {
    const [w1, w2, d1] = a.openings;
    expect(w1).toMatchObject({ label: 'W1', type: 'window', width: '3-9', height: '3-7 1/2', from: 'left', offset: '4-6' });
    // 4-6 + 4-1 1/2 between centerlines
    expect(w2).toMatchObject({ width: '3-0', height: '4-6', from: 'left', offset: '103 1/2', headHeight: '7-0' });
    expect(d1).toMatchObject({ type: 'door', width: '3-0', height: '6-8', from: 'right', offset: '5-9', header: '4x10' });
    expect(resolveOpening(w1!, a)).toMatchObject({ x: 30, roWidth: 48 });
  });

  it('centers openings and turns a sill height into a head height', () => {
    const [w3] = b.openings;
    expect(w3).toMatchObject({ offset: '87', jacksPerSide: '2', header: 'lvl-3.5x11.875' });
    // sill 42 + RO height 36 + 3
    expect(w3!.headHeight).toBe('81');
  });

  it('reports problems by line', () => {
    expect(errorsOf('## A\n- length: 10-0\n- colour: blue')).toEqual([{ line: 3, message: expect.stringMatching(/Unknown setting "colour"/) }]);
    expect(errorsOf('## A\n- length: 10-0\n### Openings\n- W1: window 3x4, 2-0 from left')[0]).toMatchObject({ line: 4 });
    expect(errorsOf('## A\n- length: 10-0\n### Openings\n- W1: window 3046')[0]?.message).toMatch(/add a position/);
    expect(errorsOf('## A\n- length: 10-0\n### Openings\n- W2: window 3046, 2-0 after W1')[0]?.message).toMatch(/after W1/);
    expect(errorsOf('## A\n- length: 10-0\n### Openings\n- W1: window 3046, 5-14 from left')[0]?.message).toMatch(/isn't a length/);
    expect(errorsOf('- studs: 2x6 @ 16')[0]?.message).toMatch(/Defaults or a ## wall/);
    expect(errorsOf('## A\n- height: 8-0')[0]).toMatchObject({ line: 1, message: expect.stringMatching(/add a length/) });
    expect(errorsOf('## A\n- length: 10-0\n- studs: 2x6 @ 18')[0]?.message).toMatch(/12, 16, 19.2 or 24/);
    expect(errorsOf('# Only a title')[0]?.message).toMatch(/at least one wall/);
  });
});

describe('projectToText', () => {
  it('round-trips the example project', () => {
    expect(shape(parse(projectToText(EXAMPLE_PROJECT)))).toEqual(shape(EXAMPLE_PROJECT));
  });

  it('round-trips a parsed file', () => {
    const p = parse(SAMPLE);
    expect(shape(parse(projectToText(p)))).toEqual(shape(p));
  });

  it('writes only settings that differ from the defaults', () => {
    const text = projectToText(parse(SAMPLE));
    const wallB = text.slice(text.indexOf('## Wall B'));
    expect(wallB).toMatch(/- layout: from right/);
    expect(wallB).not.toMatch(/- studs:/);
    expect(text).toMatch(/- W1: window 3-9 x 3-7 1\/2, 4-6 from left\n/);
  });
});

describe('posts and balloon framing', () => {
  const text = `## Wall
- length: 20-0

### Posts
- P1: 6x6, 8-0 from right
- P2: (3) studs, centered

### Balloon framing
- Stair: 10-1 7/8 tall, 4-0 to 12-0 from left
`;

  it('reads posts and tall stretches', () => {
    const { project, errors } = parseProjectText(text);
    expect(errors).toEqual([]);
    const wall = project!.walls[0]!;
    expect(wall.posts).toMatchObject([
      { label: 'P1', type: '6x6', from: 'right', offset: '8-0' },
      { label: 'P2', type: 'studs-3', from: 'left', offset: '120' },
    ]);
    expect(wall.tall).toMatchObject([{ label: 'Stair', height: '10-1 7/8', start: '4-0', end: '12-0', from: 'left' }]);
  });

  it('writes them back out', () => {
    const { project } = parseProjectText(text);
    const again = parseProjectText(projectToText(project!));
    expect(again.project!.walls[0]!.posts).toEqual(project!.walls[0]!.posts);
    expect(again.project!.walls[0]!.tall).toEqual(project!.walls[0]!.tall);
  });

  it('explains bad lines', () => {
    const { errors } = parseProjectText(text.replace('6x6', '8x8').replace('4-0 to 12-0 from left', 'somewhere'));
    expect(errors.map((e) => e.message)).toEqual([
      expect.stringContaining('P1: unknown post "8x8"'),
      expect.stringContaining('Stair: I don\'t understand "somewhere"'),
    ]);
  });
});

describe('interior walls, corners and intersections', () => {
  const text = `## Defaults
- studs: 2x6 @ 16

## West
- length: 13-6 1/2
- california corners: right 2x6

### Intersections
- Bath north: 2x4 wall, 6-10 3/4 from left

## Bath north
- length: 6-0 5/8
- studs: 2x4 @ 16
- exterior: no
- sheathing: none
`;

  it('reads stud size, sheathing, california corners and intersections', () => {
    const { project, errors } = parseProjectText(text);
    expect(errors).toEqual([]);
    const [west, bath] = project!.walls;
    expect(west).toMatchObject({ studSize: '2x6', californiaLeft: 'none', californiaRight: '2x6', sheathed: 'yes' });
    expect(west!.intersections).toMatchObject([{ label: 'Bath north', size: '2x4', from: 'left', offset: '6-10 3/4' }]);
    expect(bath).toMatchObject({ studSize: '2x4', sheathed: 'no', exterior: 'no' });
  });

  it('writes them back out', () => {
    const { project } = parseProjectText(text);
    const again = parseProjectText(projectToText(project!)).project!;
    expect(again.walls).toEqual(project!.walls);
  });

  it('explains a bad california corner', () => {
    const { errors } = parseProjectText(text.replace('right 2x6', 'middle'));
    expect(errors[0]!.message).toContain('california corners');
  });
});

describe('window allowances', () => {
  it('reads sides, top and bottom, and splits the older overall form evenly', () => {
    const at = (v: string) => parseProjectText(`## Defaults\n- window ro: ${v}\n\n## Wall\n- length: 10-0\n`).project!.defaults;
    expect(at('3/8 sides, 3/8 top, 1 1/2 bottom')).toMatchObject({ windowRoSide: '3/8', windowRoTop: '3/8', windowRoBottom: '1 1/2' });
    expect(at('+3 x +3')).toMatchObject({ windowRoSide: '1 1/2', windowRoTop: '1 1/2', windowRoBottom: '1 1/2' });
    expect(parseProjectText(`## Defaults\n- window ro: lots\n`).errors[0]!.message).toContain('3/8 sides');
  });
});

describe('freestanding posts', () => {
  const text = `## Wall\n- length: 10-0\n\n## Posts\n- P1: 6x6 under 5 1/2 x 11 7/8 GL, at 98 7/8, 2 3/4\n- P2: (3) studs under 4x10, at 10-0, 20-0\n`;

  it('reads them, sizes them to the beam, and writes them back', () => {
    const { project, errors } = parseProjectText(text);
    expect(errors).toEqual([]);
    expect(project!.posts).toMatchObject([
      { label: 'P1', type: '6x6', beam: 'gl-5.5x11.875', x: '98 7/8', y: '2 3/4' },
      { label: 'P2', type: 'studs-3', beam: '4x10', x: '10-0', y: '20-0' },
    ]);
    expect(parseProjectText(projectToText(project!)).project!.posts).toEqual(project!.posts);
    // Default height 97 1/8 less an 11 7/8 beam, standing on the subfloor; built-up posts count each stud.
    const rows = postCutList(project!);
    expect(rows.map((g) => [g.size, g.length, g.qty])).toEqual([
      ['6x6', 85.25, 1],
      ['2x6', 87.875, 3],
    ]);
  });

  it('explains a bad one', () => {
    const { errors } = parseProjectText(text.replace('under 4x10', 'over there'));
    expect(errors[0]!.message).toContain('Posts are written');
  });
});

describe('plan positions', () => {
  it('reads and writes a wall\'s plan position', () => {
    const { project, errors } = parseProjectText(`## Wall\n- length: 10-0\n- plan: 5 1/2, 34-0 9/16, running east\n`);
    expect(errors).toEqual([]);
    expect(project!.walls[0]).toMatchObject({ planX: '5 1/2', planY: '34-0 9/16', planRun: 'east' });
    expect(parseProjectText(projectToText(project!)).project!.walls).toEqual(project!.walls);
  });

  it('explains a bad one', () => {
    const { errors } = parseProjectText(`## Wall\n- length: 10-0\n- plan: somewhere\n`);
    expect(errors[0]!.message).toContain('running east');
  });
});

describe('beams', () => {
  const text = `## Wall
- length: 20-0

### Beams
- B2: 5 1/2 x 11 7/8 GL, 2 3/4 from right
- B3: 4x10, 2-0 to 6-0 from left
- B4: 5½ × 11⅞ GL, full length
`;

  it('reads crossing, partial and full-length beams and writes them back', () => {
    const { project, errors } = parseProjectText(text);
    expect(errors).toEqual([]);
    expect(project!.walls[0]!.beams).toMatchObject([
      { label: 'B2', type: 'gl-5.5x11.875', span: 'cross', from: 'right', offset: '2 3/4' },
      { label: 'B3', type: '4x10', span: 'along', start: '2-0', end: '6-0' },
      { label: 'B4', span: 'full' },
    ]);
    expect(parseProjectText(projectToText(project!)).project!.walls).toEqual(project!.walls);
  });
});

describe('first-floor example', () => {
  it('reads the plans file into the main house walls', () => {
    // In the order they're stood: east and west run through the corners, north and south go between them.
    expect(EXAMPLE_PROJECT.walls.map((w) => w.name)).toEqual([
      'East · kitchen',
      'East · bay, north return',
      'East · bay',
      'East · bay, south return',
      'East · living',
      'West · south',
      'West · north',
      'North · west',
      'North · east',
      'South · east',
      'South · west',
      'Mudroom stub',
      'Bath north',
      'Bath south',
      'Bath east',
      'Niche north',
      'Niche south',
      'Hall',
      'Closet north',
      'Closet west',
      'Closet south',
      'Stair wall',
    ]);
    expect(EXAMPLE_PROJECT.walls.find((w) => w.name === 'South · east')).toMatchObject({ length: '15-0 7/8', cornerLeft: 'inside', californiaLeft: 'none' });
    expect(EXAMPLE_PROJECT.walls.find((w) => w.name === 'West · south')).toMatchObject({ cornerLeft: 'outside', californiaLeft: '2x6' });
    expect(EXAMPLE_PROJECT.walls.every((w) => w.tall.length === 0)).toBe(true);
    expect(EXAMPLE_PROJECT.walls.every((w) => w.planRun !== '')).toBe(true);
    expect(EXAMPLE_PROJECT.walls.find((w) => w.name === 'Hall')).toMatchObject({ planX: '96 1/8', planY: '267 5/8', planRun: 'south' });
    // B2's posts stand on their own; the walls end at them.
    expect(EXAMPLE_PROJECT.walls.filter((w) => w.posts.length)).toEqual([]);
    expect(EXAMPLE_PROJECT.posts.map((p) => p.label)).toEqual(['P1 north', 'D', 'E', 'P1 south']);
    expect(EXAMPLE_PROJECT.walls.filter((w) => w.beams.length).map((w) => [w.name, w.beams[0]!.span])).toEqual([
      ['Mudroom stub', 'full'],
      ['Hall', 'full'],
    ]);
    const west = EXAMPLE_PROJECT.walls.find((w) => w.name === 'West · north')!;
    expect(west.intersections.map((t) => t.label)).toEqual(['Bath north', 'Bath south']);
    expect(EXAMPLE_PROJECT.walls.find((w) => w.name === 'Bath east')).toMatchObject({ studSize: '2x4', sheathed: 'no', californiaLeft: '2x4' });
    expect(EXAMPLE_PROJECT.defaults).toMatchObject({ height: '9-1 1/4', windowHeadHeight: '7-8' });
  });
});

describe('loadSaved', () => {
  it('moves v2 positions from the rough opening edge to the centerline', () => {
    const store = new Map<string, string>();
    const v2 = {
      name: 'Old wall',
      length: "20'",
      height: '97 1/8',
      windowRoWidth: '3',
      windowRoHeight: '3',
      doorRoWidth: '2',
      doorRoHeight: '2 1/2',
      units: 'ftin',
      openings: [
        { id: 'o1', type: 'window', label: 'W1', from: 'left', offset: '30', width: '45', height: '43 1/2', headHeight: '', header: '2x8', jacksPerSide: 'auto' },
        { id: 'o2', type: 'door', label: 'D1', from: 'right', offset: '50', width: '36', height: '80', headHeight: '', header: 'auto', jacksPerSide: 'auto' },
      ],
    };
    store.set('wall-framing-planner.v2', JSON.stringify(v2));
    globalThis.localStorage = { getItem: (k: string) => store.get(k) ?? null, setItem: () => {} } as unknown as Storage;

    const { project, prefs } = loadSaved();
    const wall = project.walls[0]!;
    expect(prefs.units).toBe('ftin');
    expect(wall.openings.map((o) => o.offset)).toEqual(['54', '69']);
    expect(wall.openings[0]!.header).toBe('auto');
    expect(resolveOpening(wall.openings[0]!, wall)).toMatchObject({ x: 30 });
    expect(resolveOpening(wall.openings[1]!, wall)).toMatchObject({ x: 152 });
  });
});
