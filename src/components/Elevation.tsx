import { useEffect, useRef, useState } from 'react';
import { ROLES, type Framing, type Member, type OpeningFrame } from '../lib/framing';
import { T } from '../lib/lumber';
import { toFraction, type Formatter } from '../lib/units';
import { HDim, VDim, textWidth } from './Dimensions';

interface Props {
  framing: Framing;
  fmt: Formatter;
  highlight: string | null;
  onHighlight: (group: string | null) => void;
}

const PAD = { left: 108, right: 40, top: 64, bottom: 100 };
const MIN_WIDTH = 720;
const MAX_HEIGHT = 620;

function useWidth<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [width, setWidth] = useState(0);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => setWidth(entry?.contentRect.width ?? 0));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, width] as const;
}

/** Center of the widest gap between members (each T wide, given by left edge) within [lo, hi]. */
function widestBay(lo: number, hi: number, xs: number[]) {
  let best = { w: -1, c: (lo + hi) / 2 };
  let start = lo;
  for (const x of [...xs].sort((a, b) => a - b).concat([hi])) {
    const w = x - start;
    if (w > best.w) best = { w, c: start + w / 2 };
    start = x + T;
  }
  return best.c;
}

export function Elevation({ framing, fmt, highlight, onHighlight }: Props) {
  const [wrapRef, measured] = useWidth<HTMLDivElement>();
  const { wall, plateBottom, studLength, members, openings, layout } = framing;
  const { length: L, height: H } = wall;

  const width = Math.max(measured, MIN_WIDTH);
  const ppi = Math.max(
    0.5,
    Math.min((width - PAD.left - PAD.right) / L, (MAX_HEIGHT - PAD.top - PAD.bottom) / H),
  );
  const height = Math.round(PAD.top + PAD.bottom + H * ppi);
  const ox = PAD.left + (width - PAD.left - PAD.right - L * ppi) / 2;
  const X = (x: number) => ox + x * ppi;
  const Y = (z: number) => PAD.top + (H - z) * ppi;

  const rect = (m: Member, x: number, w: number, key: string) => (
    <rect
      key={key}
      className={`m m-${m.role}${highlight === m.group ? ' hl' : ''}`}
      x={X(x)}
      y={Y(m.z + m.h)}
      width={w * ppi}
      height={m.h * ppi}
      onMouseEnter={() => onHighlight(m.group)}
    >
      <title>{`${ROLES[m.role].name}${m.isEnd ? ' (end)' : ''} · ${m.size} × ${fmt(m.length)}`}</title>
    </rect>
  );

  // Bottom plate is drawn in segments around door cut-outs.
  const cuts = openings.flatMap((o) => (o.plateCut ? [o.plateCut] : [])).sort((a, b) => a[0] - b[0]);
  const memberEls = members.flatMap((m) => {
    if (m.role !== 'plate' || !cuts.length) return [rect(m, m.x, m.w, m.id)];
    const els = [];
    let a = 0;
    for (const [c0, c1] of cuts) {
      if (c0 > a) els.push(rect(m, a, c0 - a, `${m.id}-${a}`));
      a = Math.max(a, c1);
    }
    if (a < L) els.push(rect(m, a, L - a, `${m.id}-${a}`));
    return els;
  });

  // Chain dimensions to rough-opening edges.
  const pts = [0, ...[...openings].sort((a, b) => a.spec.x - b.spec.x).flatMap((o) => [o.spec.x, o.spec.x + o.spec.width]), L];
  const chainY = Y(0) + 62;
  const layoutY = Y(0) + 14;
  const lastMark = layout.at(-1);
  const layoutStep = lastMark && wall.spacing * ppi < textWidth(fmt(lastMark.distance)) + 10 ? 2 : 1;

  return (
    <div className="svg-wrap" ref={wrapRef}>
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width={width}
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-label="Wall framing elevation"
        className={highlight ? 'focus' : undefined}
        onMouseLeave={() => onHighlight(null)}
      >
        {/* one-foot grid */}
        <g>
          {Array.from({ length: Math.ceil(L / 12) - 1 }, (_, i) => (i + 1) * 12).map((x) => (
            <line key={`gx${x}`} className="grid" x1={X(x)} y1={Y(H)} x2={X(x)} y2={Y(0)} />
          ))}
          {Array.from({ length: Math.ceil(H / 12) - 1 }, (_, i) => (i + 1) * 12).map((z) => (
            <line key={`gz${z}`} className="grid" x1={X(0)} y1={Y(z)} x2={X(L)} y2={Y(z)} />
          ))}
        </g>

        <g onMouseLeave={() => onHighlight(null)}>{memberEls}</g>

        {cuts.map(([c0, c1]) => (
          <rect key={`cut${c0}`} className="cutout" x={X(c0)} y={Y(T)} width={(c1 - c0) * ppi} height={T * ppi} />
        ))}

        {/* header callouts */}
        {members
          .filter((m) => m.role === 'header')
          .map((m) => {
            const label = `(${wall.headerPlies}) ${m.size} × ${fmt(m.length)}`;
            if (m.w * ppi < textWidth(label) + 8 || m.h * ppi < 12) return null;
            return (
              <text key={`hl${m.id}`} className="hdr-t" x={X(m.x + m.w / 2)} y={Y(m.z + m.h / 2) + 3.8} textAnchor="middle">
                {label}
              </text>
            );
          })}

        {openings.map((o) => (
          <OpeningOverlay
            key={o.spec.id}
            o={o}
            framing={framing}
            fmt={fmt}
            X={X}
            Y={Y}
            plateBottom={plateBottom}
          />
        ))}

        {/* overall length */}
        <HDim x1={X(0)} x2={X(L)} y={Y(H) - 30} label={fmt(L)} ext={Y(H)} />
        {/* overall height and stud length */}
        <VDim x={X(0) - 70} y1={Y(H)} y2={Y(0)} label={`WALL ${fmt(H)}`} ext={X(0)} rotate />
        <VDim x={X(0) - 36} y1={Y(plateBottom)} y2={Y(T)} label={`STUD ${fmt(studLength)}`} ext={X(0)} rotate />

        {/* layout marks */}
        <text className="cap" x={X(0) - 10} y={layoutY + 15} textAnchor="end">
          {`LAYOUT ${wall.layoutFrom === 'right' ? '←' : '→'}`}
        </text>
        {layout.map(({ center, distance }, i) => (
          <g key={`lay${i}`}>
            <line className="lay-k" x1={X(center)} y1={layoutY} x2={X(center)} y2={layoutY + 6} />
            {(i + 1) % layoutStep === 0 && (
              <text className="lay-t" x={X(center)} y={layoutY + 18} textAnchor="middle">
                {fmt(distance)}
              </text>
            )}
          </g>
        ))}

        {/* chain dimensions to rough openings */}
        <text className="cap" x={X(0) - 10} y={chainY + 4} textAnchor="end">
          TO R.O.
        </text>
        {pts.slice(1).map((p, i) => {
          const prev = pts[i]!;
          if (p - prev <= 1e-6) return null;
          return <HDim key={`ch${i}`} x1={X(prev)} x2={X(p)} y={chainY} label={fmt(p - prev)} ext={Y(0) + 40} />;
        })}
      </svg>
    </div>
  );
}

interface OverlayProps {
  o: OpeningFrame;
  framing: Framing;
  fmt: Formatter;
  X: (x: number) => number;
  Y: (z: number) => number;
  plateBottom: number;
}

function OpeningOverlay({ o, framing, fmt, X, Y, plateBottom }: OverlayProps) {
  const { spec } = o;
  const x0 = X(spec.x);
  const x1 = X(spec.x + spec.width);
  const y0 = Y(o.roTop);
  const y1 = Y(o.roBottom);
  const err = o.hasError ? ' err' : '';
  const cx = (x0 + x1) / 2;
  const cy = (y0 + y1) / 2;
  const title = `${spec.label} · ${spec.type.toUpperCase()}`;
  const size = `${toFraction(spec.width)} × ${toFraction(spec.height)} RO`;

  const ownMembers = framing.members.filter((m) => m.openingId === spec.id);
  const tops = ownMembers.filter((m) => m.role === 'crippleTop');
  const bottoms = ownMembers.filter((m) => m.role === 'crippleBottom');
  const hasFill = ownMembers.some((m) => m.role === 'filler');
  const sillBottom = o.roBottom - framing.wall.sillPlies * T;

  return (
    <g>
      <rect className={`ro${err}`} x={x0} y={y0} width={x1 - x0} height={y1 - y0} />
      <line className="ro-x" x1={x0} y1={y0} x2={x1} y2={y1} />
      <line className="ro-x" x1={x1} y1={y0} x2={x0} y2={y1} />
      <text className={`ro-t halo${err}`} x={cx} y={cy - 2} textAnchor="middle">
        {title}
      </text>
      {x1 - x0 > textWidth(size) + 50 && (
        <text className={`ro-s halo${err}`} x={cx} y={cy + 13} textAnchor="middle">
          {size}
        </text>
      )}

      <HDim x1={x0} x2={x1} y={y0 + 16} label={fmt(spec.width)} />
      <VDim x={x1 - 11} y1={y0} y2={y1} label={`RO ${fmt(spec.height)}`} side="left" />
      <VDim x={x0 + 11} y1={y0} y2={Y(T)} label={`JACK ${fmt(o.roTop - T)}`} side="right" />
      {spec.type === 'window' && (
        <VDim x={x1 - 11} y1={y1} y2={Y(0)} label={`SILL ${fmt(spec.sill)}`} side="left" />
      )}

      {(tops.length > 0 || hasFill) && (
        <VDim
          x={X(tops.length ? widestBay(o.headerX, o.headerX + o.headerLength, tops.map((m) => m.x)) : o.headerX + o.headerLength * 0.72)}
          y1={Y(plateBottom)}
          y2={Y(o.headerTop)}
          label={`${tops.length ? 'CRIPPLE' : 'FILL'} ${fmt(o.gapAbove)}`}
          side="right"
          rotate={false}
        />
      )}
      {bottoms.length > 0 && o.crippleBelow != null && (
        <VDim
          x={X(widestBay(spec.x, spec.x + spec.width, bottoms.map((m) => m.x)))}
          y1={Y(sillBottom)}
          y2={Y(T)}
          label={`CRIPPLE ${fmt(o.crippleBelow)}`}
          side="right"
        />
      )}
    </g>
  );
}
