// Drafting primitives for the elevation. All coordinates are screen pixels.

/** Approximate rendered width of 11px condensed dimension text. */
export const textWidth = (s: string) => s.length * 5.9;

function Tick({ x, y }: { x: number; y: number }) {
  return <line className="tick" x1={x - 3.5} y1={y + 3.5} x2={x + 3.5} y2={y - 3.5} />;
}

interface HDimProps {
  x1: number;
  x2: number;
  y: number;
  label: string;
  /** y of the object edge to draw extension lines from. */
  ext?: number;
  className?: string;
}

export function HDim({ x1, x2, y, label, ext, className }: HDimProps) {
  const d = ext == null ? 0 : y < ext ? -1 : 1;
  return (
    <g className={className}>
      {ext != null && (
        <>
          <line className="ext" x1={x1} y1={ext + d * 3} x2={x1} y2={y + d * 4} />
          <line className="ext" x1={x2} y1={ext + d * 3} x2={x2} y2={y + d * 4} />
        </>
      )}
      <line className="dl" x1={x1} y1={y} x2={x2} y2={y} />
      <Tick x={x1} y={y} />
      <Tick x={x2} y={y} />
      <text className="dt halo" x={(x1 + x2) / 2} y={y - 4} textAnchor="middle">
        {label}
      </text>
    </g>
  );
}

interface VDimProps {
  x: number;
  /** Top, in screen px (smaller y). */
  y1: number;
  /** Bottom, in screen px. */
  y2: number;
  label: string;
  /** x of the object edge to draw extension lines from. */
  ext?: number;
  /** Which side of the dimension line the text sits on. */
  side?: 'left' | 'right';
  /** Rotate text to run along the line; 'auto' rotates when it fits. */
  rotate?: boolean | 'auto';
  className?: string;
}

export function VDim({ x, y1, y2, label, ext, side = 'left', rotate = 'auto', className }: VDimProps) {
  const d = ext == null ? 0 : x < ext ? -1 : 1;
  const mid = (y1 + y2) / 2;
  const rot = rotate === true || (rotate === 'auto' && y2 - y1 > textWidth(label) + 14);
  return (
    <g className={className}>
      {ext != null && (
        <>
          <line className="ext" x1={ext + d * 3} y1={y1} x2={x + d * 4} y2={y1} />
          <line className="ext" x1={ext + d * 3} y1={y2} x2={x + d * 4} y2={y2} />
        </>
      )}
      <line className="dl" x1={x} y1={y1} x2={x} y2={y2} />
      <Tick x={x} y={y1} />
      <Tick x={x} y={y2} />
      {rot ? (
        <text
          className="dt halo"
          transform={`translate(${side === 'left' ? x - 4 : x + 12},${mid}) rotate(-90)`}
          textAnchor="middle"
        >
          {label}
        </text>
      ) : (
        <text
          className="dt halo"
          x={side === 'left' ? x - 7 : x + 7}
          y={mid + 4}
          textAnchor={side === 'left' ? 'end' : 'start'}
        >
          {label}
        </text>
      )}
    </g>
  );
}
