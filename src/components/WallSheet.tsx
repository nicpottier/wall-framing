import { useEffect, useRef } from 'react';
import type { Framing, FramingFailure, Issue } from '../lib/framing';
import type { Formatter } from '../lib/units';
import type { WallInput } from '../state/wall';
import { Elevation, type WallView } from './Elevation';

interface Props {
  wall: WallInput;
  result: Framing | FramingFailure;
  issues: Issue[];
  selected: boolean;
  onSelect: () => void;
  fmt: Formatter;
  highlight: string | null;
  onHighlight: (group: string | null) => void;
  showSheathing: boolean;
  view: WallView;
  fit: { length: number; height: number; maxHeight: number };
}

/** One wall in the all-walls view: a compact header and its drawing at the shared scale. */
export function WallSheet({ wall, result, issues, selected, onSelect, fmt, highlight, onHighlight, showSheathing, view, fit }: Props) {
  const ref = useRef<HTMLElement>(null);
  // Bring a wall picked elsewhere (the wall list, the text) into view.
  useEffect(() => {
    if (selected) ref.current?.scrollIntoView({ block: 'nearest' });
  }, [selected]);
  const errors = issues.filter((i) => i.level === 'error').length;
  const others = issues.length - errors;
  const openings = wall.openings.length;
  return (
    <section ref={ref} className={`sheet wall-sheet${selected ? ' selected' : ''}`} aria-label={wall.name}>
      <div className="wall-sheet-head">
        <button type="button" className="wall-sheet-title" onClick={onSelect} aria-pressed={selected}>
          <span className="name">{wall.name || 'Wall'}</span>
          <span className="sub">
            {result.ok ? `${fmt(result.wall.length)} × ${fmt(result.wall.height)}` : 'Not framed'}
            {openings ? ` · ${openings} ${openings === 1 ? 'opening' : 'openings'}` : ''}
          </span>
        </button>
        <span className="wall-sheet-flags">
          {errors > 0 && <span className="pill error">{errors === 1 ? '1 fix' : `${errors} fixes`}</span>}
          {others > 0 && <span className="pill note">{others === 1 ? '1 check' : `${others} checks`}</span>}
          <button type="button" className="btn" onClick={onSelect}>
            {selected ? 'Editing' : 'Edit'}
          </button>
        </span>
      </div>
      {result.ok ? (
        <Elevation framing={result} fmt={fmt} highlight={highlight} onHighlight={onHighlight} showSheathing={showSheathing} view={view} fit={fit} />
      ) : (
        <div className="fatal">{result.message}</div>
      )}
    </section>
  );
}
