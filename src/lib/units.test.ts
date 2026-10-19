import { describe, expect, it } from 'vitest';
import { makeFormatter, parseLength, toFraction } from './units';

describe('parseLength', () => {
  it.each([
    ['240', 240],
    ['240.5', 240.5],
    ['92 5/8', 92.625],
    ['92-5/8"', 92.625],
    ['5/8', 0.625],
    ["20'", 240],
    ['20 ft', 240],
    [`8'-1 1/8"`, 97.125],
    ["8' 1-1/8", 97.125],
    ['8ft 1 1/8in', 97.125],
    ['3-0', 36],
    ['4-6', 54],
    ['4-6 1/2', 54.5],
    ['4-6-1/2', 54.5],
    ['6-8', 80],
    ['8-1 1/8', 97.125],
    ['20-0', 240],
    ['12-6"', 150],
    ['1-1/8', 1.125],
  ])('reads %s', (raw, expected) => {
    expect(parseLength(raw)).toBeCloseTo(expected);
  });

  it.each(['', 'abc', '5/0', "x'", '12 apples', '5-14', '4-6 1/0'])('rejects %j', (raw) => {
    expect(parseLength(raw)).toBeNaN();
  });
});

describe('formatting', () => {
  it('rounds to sixteenths and reduces fractions', () => {
    expect(toFraction(92.625)).toBe('92 5/8');
    expect(toFraction(0.5)).toBe('1/2');
    expect(toFraction(81.0001)).toBe('81');
    expect(toFraction(2.375)).toBe('2 3/8');
  });

  it('formats inches and feet-inches', () => {
    expect(makeFormatter('in')(97.125)).toBe('97 1/8"');
    expect(makeFormatter('ftin')(97.125)).toBe(`8'-1 1/8"`);
    expect(makeFormatter('ftin')(240)).toBe(`20'-0"`);
    expect(makeFormatter('ftin')(6)).toBe('6"');
  });
});
