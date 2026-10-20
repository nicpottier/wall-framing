import { describe, expect, it } from 'vitest';
import { planBox, planOverlaps, planPoint, wallBox, type PlacedWall } from './plan';

const w = (over: Partial<PlacedWall>): PlacedWall => ({ index: 0, name: 'W', x: 0, y: 0, run: 'east', length: 120, depth: 5.5, ...over });

describe('plan', () => {
  it('puts the depth away from the viewer', () => {
    // A south wall seen from inside runs west, so its depth goes south.
    expect(wallBox(w({ x: 288, y: 5.5, run: 'west', length: 288 }))).toEqual({ x0: 0, y0: 0, x1: 288, y1: 5.5 });
    // A west wall seen from inside runs north, its depth to the west.
    expect(wallBox(w({ x: 5.5, y: 5.5, run: 'north', length: 84 }))).toEqual({ x0: 0, y0: 5.5, x1: 5.5, y1: 89.5 });
    expect(planPoint(w({ run: 'south', x: 10, y: 100 }), 20, 3)).toEqual([13, 80]);
    expect(planBox(w({ run: 'east' }), 10, 40, 0, 5.5)).toEqual({ x0: 10, y0: 0, x1: 40, y1: 5.5 });
  });

  it('finds walls sharing floor, but not walls that only touch', () => {
    const south = w({ index: 0, name: 'South', x: 288, y: 5.5, run: 'west', length: 288 });
    const west = w({ index: 1, name: 'West', x: 5.5, y: 5.5, run: 'north', length: 84 });
    expect(planOverlaps([south, west])).toEqual([]);
    const late = w({ index: 2, name: 'Late', x: 5.5, y: 3, run: 'north', length: 84 });
    expect(planOverlaps([south, late]).map((o) => [o.a.name, o.b.name])).toEqual([['South', 'Late']]);
  });
});
