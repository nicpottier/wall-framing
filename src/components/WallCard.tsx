import type { Framing, FramingFailure, Issue } from '../lib/framing';
import type { Formatter } from '../lib/units';
import type { WallInput } from '../state/wall';
import { Elevation } from './Elevation';

interface Props {
  wall: WallInput;
  result: Framing | FramingFailure;
  issues: Issue[];
  /** Link to the wall's editor. */
  href: string;
  fmt: Formatter;
  /** Shared scale so cards compare at a glance. */
  fit: { length: number; height: number; maxHeight: number };
}

const noop = () => {};

/** One wall in the overview: name, size, problems and a small drawing, linking to the wall's editor. */
export function WallCard({ wall, result, issues, href, fmt, fit }: Props) {
  const errors = issues.filter((i) => i.level === 'error').length;
  const others = issues.length - errors;
  const openings = wall.openings.length;
  return (
    <a className="wall-card" href={href} aria-label={`Edit ${wall.name || 'wall'}`}>
      <span className="wall-card-head">
        <span className="wall-card-name">{wall.name || 'Wall'}</span>
        <span className="wall-card-flags">
          {errors > 0 && <span className="pill error">{errors === 1 ? '1 fix' : `${errors} fixes`}</span>}
          {others > 0 && <span className="pill note">{others === 1 ? '1 check' : `${others} checks`}</span>}
        </span>
      </span>
      <span className="wall-card-sub">
        {result.ok ? `${fmt(result.wall.length)} × ${fmt(result.wall.height)}` : 'Not framed yet'}
        {` · ${openings === 0 ? 'no openings' : openings === 1 ? '1 opening' : `${openings} openings`}`}
      </span>
      <div className="wall-card-drawing">
        {result.ok ? (
          <Elevation framing={result} fmt={fmt} highlight={null} onHighlight={noop} showSheathing={false} view="standing" fit={fit} compact />
        ) : (
          <span className="wall-card-error">{result.message}</span>
        )}
      </div>
    </a>
  );
}
