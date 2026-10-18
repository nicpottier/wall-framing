import { useEffect, useRef, useState } from 'react';
import { ROLES, type Framing, type Member, type OpeningFrame } from '../lib/framing';
import { T } from '../lib/lumber';
import { toFraction, type Formatter } from '../lib/units';
import { HDim, VDim, textWidth } from './Dimensions';

/**
 * standing: elevation seen from inside. deck: lying on the subfloor before lifting, sheathing side up.
 * Standing at the top plate looking down at the deck, you face the same way as from inside, so the
 * deck view keeps left and right and only flips top to bottom.
 */
export type WallView = 'standing' | 'deck';

interface Props {
  framing: Framing;
  fmt: Formatter;
  highlight: string | null;
  onHighlight: (group: string | null) => void;
  /** Overlay sheathing seams and their dimensions. */
  showSheathing: boolean;
  view: WallView;
}

/** Margins around the wall, named by wall side so they follow it when the view flips. */
const PAD = { start: 108, end: 96, top: 92, bottom: 100 };
const MIN_WIDTH = 720;
const MAX_HEIGHT = 620;

type Side = 'left' | 'right';
type Dir = 1 | -1;

/** Wall coordinates (x from the left end, z up from the floor) to screen pixels for a view. */
interface ViewMap {
  X: (x: number) => number;
  Y: (z: number) => number;
  ppi: number;
  /** Screen direction of increasing x: +1 standing, -1 on the deck. */
  sx: Dir;
  /** Screen direction moving out past the bottom plate: +1 standing (down), -1 on the deck (up). */
  bt: Dir;
  /** Screen rectangle for a wall-space box. */
  box: (x: number, z: number, w: number, h: number) => { x: number; y: number; width: number; height: number };
  /** Maps a side as seen standing to the screen side in this view. */
  side: (s: Side) => Side;
  /** Screen x of the wall's left-hand edge on screen. */
  left: number;
  /**
   * Baseline for text whose glyphs sit between `near` and `far` px from `edge` in direction `dir`,
   * so labels mirror cleanly instead of overlapping what they label.
   */
  textAt: (edge: number, near: number, far: number, dir: Dir) => number;
  /** Arrow pointing away from the end the layout is pulled from. */
  arrow: string;
}

interface Orientation {
  /** Bottom plate at the top of the screen. */
  flipZ: boolean;
  /** Wall's left end on the right of the screen. */
  mirrorX: boolean;
}

const ORIENTATION: Record<WallView, Orientation> = {
  standing: { flipZ: false, mirrorX: false },
  deck: { flipZ: true, mirrorX: false },
};

function makeView(
  { flipZ, mirrorX }: Orientation,
  ox: number,
  padTop: number,
  ppi: number,
  L: number,
  zTop: number,
  layoutFrom: Side,
): ViewMap {
  const X = (x: number) => ox + (mirrorX ? L - x : x) * ppi;
  const Y = (z: number) => padTop + (flipZ ? z : zTop - z) * ppi;
  return {
    X,
    Y,
    ppi,
    sx: mirrorX ? -1 : 1,
    bt: flipZ ? -1 : 1,
    box: (x, z, w, h) => ({
      x: Math.min(X(x), X(x + w)),
      y: Math.min(Y(z), Y(z + h)),
      width: w * ppi,
      height: h * ppi,
    }),
    side: (s) => (mirrorX ? (s === 'left' ? 'right' : 'left') : s),
    left: Math.min(X(0), X(L)),
    textAt: (edge, near, far, dir) => (dir > 0 ? edge + far : edge - near),
    arrow: (layoutFrom === 'left') !== mirrorX ? '→' : '←',
  };
}

function useWidth<E extends HTMLElement>() {
  const ref = useRef<E>(null);
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

export function Elevation({ framing, fmt, highlight, onHighlight, showSheathing, view }: Props) {
  const [wrapRef, measured] = useWidth<HTMLDivElement>();
  const { wall, plateBottom, studLength, members, openings, layout } = framing;
  const { length: L, height: H } = wall;
  const orient = ORIENTATION[view];
  const flipped = orient.flipZ;

  // Standing, the drawing extends above the wall when sheathing runs past the top plate.
  // On the deck that part isn't on the wall yet, so it isn't shown.
  const zTop = showSheathing && !flipped ? Math.max(H, framing.sheathing.top) : H;
  const padL = orient.mirrorX ? PAD.end : PAD.start;
  const padR = orient.mirrorX ? PAD.start : PAD.end;
  const padT = flipped ? PAD.bottom : PAD.top;
  const padB = flipped ? PAD.top : PAD.bottom;
  const width = Math.max(measured, MIN_WIDTH);
  const ppi = Math.max(0.5, Math.min((width - padL - padR) / L, (MAX_HEIGHT - padT - padB) / zTop));
  const height = Math.round(padT + padB + zTop * ppi);
  const ox = padL + (width - padL - padR - L * ppi) / 2;
  const v = makeView(orient, ox, padT, ppi, L, zTop, wall.layoutFrom);
  const { X, Y, sx, bt } = v;

  const rect = (m: Member, x: number, w: number, key: string) => (
    <rect
      key={key}
      className={`m m-${m.role}${highlight === m.group ? ' hl' : ''}`}
      {...v.box(x, m.z, w, m.h)}
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

  // Rows past the bottom plate: layout marks, then chain dimensions to rough-opening edges.
  const pts = [0, ...[...openings].sort((a, b) => a.spec.x - b.spec.x).flatMap((o) => [o.spec.x, o.spec.x + o.spec.width]), L];
  const layoutY = Y(0) + 14 * bt;
  const chainY = Y(0) + 62 * bt;
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
        aria-label={flipped ? 'Wall framing as laid out on the deck' : 'Wall framing elevation from inside'}
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
          <rect key={`cut${c0}`} className="cutout" {...v.box(c0, 0, c1 - c0, T)} />
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
          <OpeningOverlay key={o.spec.id} o={o} framing={framing} fmt={fmt} v={v} plateBottom={plateBottom} />
        ))}

        {showSheathing && <SheathingOverlay framing={framing} fmt={fmt} v={v} aboveWall={!flipped} />}

        {/* overall length */}
        <HDim x1={X(0)} x2={X(L)} y={Y(zTop) - 30 * bt} label={fmt(L)} ext={Y(H)} />
        {/* overall height and stud length, off the wall's left end */}
        <VDim x={X(0) - 70 * sx} y1={Y(H)} y2={Y(0)} label={`WALL ${fmt(H)}`} ext={X(0)} side={v.side('left')} rotate />
        <VDim x={X(0) - 36 * sx} y1={Y(plateBottom)} y2={Y(T)} label={`STUD ${fmt(studLength)}`} ext={X(0)} side={v.side('left')} rotate />

        {/* layout marks */}
        <text className="cap" x={v.left - 10} y={v.textAt(layoutY, 7, 15, bt)} textAnchor="end">
          {`LAYOUT ${v.arrow}`}
        </text>
        {layout.map(({ center, distance }, i) => (
          <g key={`lay${i}`}>
            <line className="lay-k" x1={X(center)} y1={layoutY} x2={X(center)} y2={layoutY + 6 * bt} />
            {(i + 1) % layoutStep === 0 && (
              <text className="lay-t" x={X(center)} y={v.textAt(layoutY, 10, 18, bt)} textAnchor="middle">
                {fmt(distance)}
              </text>
            )}
          </g>
        ))}

        {/* chain dimensions to rough openings */}
        <text className="cap" x={v.left - 10} y={chainY + 4} textAnchor="end">
          TO R.O.
        </text>
        {pts.slice(1).map((p, i) => {
          const prev = pts[i]!;
          if (p - prev <= 1e-6) return null;
          return <HDim key={`ch${i}`} x1={X(prev)} x2={X(p)} y={chainY} label={fmt(p - prev)} ext={Y(0) + 40 * bt} />;
        })}
      </svg>
    </div>
  );
}

interface OverlayProps {
  o: OpeningFrame;
  framing: Framing;
  fmt: Formatter;
  v: ViewMap;
  plateBottom: number;
}

function OpeningOverlay({ o, framing, fmt, v, plateBottom }: OverlayProps) {
  const { spec } = o;
  const { X, Y, sx, bt } = v;
  // Screen x of the rough opening's left and right edges as seen standing.
  const xl = X(spec.x);
  const xr = X(spec.x + spec.width);
  const yTop = Y(o.roTop);
  const yBot = Y(o.roBottom);
  const err = o.hasError ? ' err' : '';
  const cx = (xl + xr) / 2;
  const cy = (yTop + yBot) / 2;
  const roWidthPx = Math.abs(xr - xl);
  const title = `${spec.label} · ${spec.type.toUpperCase()}`;
  const ro = `RO ${toFraction(spec.width)} × ${toFraction(spec.height)}`;
  const full = spec.unit ? `${toFraction(spec.unit.width)} × ${toFraction(spec.unit.height)} unit · ${ro}` : ro;
  const size = roWidthPx > textWidth(full) + 50 ? full : ro;

  const ownMembers = framing.members.filter((m) => m.openingId === spec.id);
  const tops = ownMembers.filter((m) => m.role === 'crippleTop');
  const bottoms = ownMembers.filter((m) => m.role === 'crippleBottom');
  const hasFill = ownMembers.some((m) => m.role === 'filler');
  const sillBottom = o.roBottom - framing.wall.sillPlies * T;

  return (
    <g>
      <rect className={`ro${err}`} {...v.box(spec.x, o.roBottom, spec.width, spec.height)} />
      <line className="ro-x" x1={xl} y1={yTop} x2={xr} y2={yBot} />
      <line className="ro-x" x1={xr} y1={yTop} x2={xl} y2={yBot} />
      <text className={`ro-t halo${err}`} x={cx} y={cy - 2} textAnchor="middle">
        {title}
      </text>
      {roWidthPx > textWidth(size) + 50 && (
        <text className={`ro-s halo${err}`} x={cx} y={cy + 13} textAnchor="middle">
          {size}
        </text>
      )}

      {/* inside the opening, just under the header */}
      <HDim x1={xl} x2={xr} y={yTop + 16 * bt} label={fmt(spec.width)} />
      <VDim x={xr - 11 * sx} y1={yTop} y2={yBot} label={`RO ${fmt(spec.height)}`} side={v.side('left')} />
      <VDim x={xl + 11 * sx} y1={yTop} y2={Y(T)} label={`JACK ${fmt(o.roTop - T)}`} side={v.side('right')} />
      {spec.type === 'window' && (
        <VDim x={xr - 11 * sx} y1={yBot} y2={Y(0)} label={`SILL ${fmt(spec.sill)}`} side={v.side('left')} />
      )}

      {(tops.length > 0 || hasFill) && (
        <VDim
          x={X(tops.length ? widestBay(o.headerX, o.headerX + o.headerLength, tops.map((m) => m.x)) : o.headerX + o.headerLength * 0.72)}
          y1={Y(plateBottom)}
          y2={Y(o.headerTop)}
          label={`${tops.length ? 'CRIPPLE' : 'FILL'} ${fmt(o.gapAbove)}`}
          side={v.side('right')}
          rotate={false}
        />
      )}
      {bottoms.length > 0 && o.crippleBelow != null && (
        <VDim
          x={X(widestBay(spec.x, spec.x + spec.width, bottoms.map((m) => m.x)))}
          y1={Y(sillBottom)}
          y2={Y(T)}
          label={`CRIPPLE ${fmt(o.crippleBelow)}`}
          side={v.side('right')}
        />
      )}
    </g>
  );
}

interface SheathingProps {
  framing: Framing;
  fmt: Formatter;
  v: ViewMap;
  /** Draw sheathing that runs past the top plate. */
  aboveWall: boolean;
}

/** Panel seams over the framing, seam positions past the top plate, and seam heights off the right end. */
function SheathingOverlay({ framing, fmt, v, aboveWall }: SheathingProps) {
  const { wall, sheathing: sh } = framing;
  const { length: L, height: H } = wall;
  const { X, Y, sx, bt } = v;
  const out: Dir = bt === 1 ? -1 : 1; // screen direction out past the top
  const left = -sh.extLeft;
  const right = L + sh.extRight;
  // Highest sheathing drawn, and whether a top edge past the wall is being left off.
  const top = aboveWall ? sh.top : Math.min(sh.top, H);
  const cutOff = sh.top > top;
  const tickY = Y(Math.max(H, top)) + 48 * out;
  // Seams, then the wall top and the sheathing top, measured up from the floor.
  const chain = [0, ...sh.horizontalSeams, ...(top > H ? [H, top] : [top])];
  const dimX = X(right) + 28 * sx;
  const cornerTitle = (ext: number, end: string) =>
    `Sheathing runs ${fmt(ext)} past the ${end} end of the framing to the outside corner`;

  return (
    <g className="sheath">
      {/* sheathing above the top plate, and its top edge */}
      {top > H && (
        <>
          <rect className="sh-above" {...v.box(left, H, right - left, top - H)} />
          {sh.extLeft === 0 && <line className="sh-edge" x1={X(0)} y1={Y(top)} x2={X(0)} y2={Y(H)} />}
          {sh.extRight === 0 && <line className="sh-edge" x1={X(L)} y1={Y(top)} x2={X(L)} y2={Y(H)} />}
        </>
      )}
      {!cutOff && (
        <>
          <line className="sh-top" x1={X(left)} y1={Y(top)} x2={X(right)} y2={Y(top)}>
            <title>{`Top of sheathing ${fmt(top)} from the floor${top > H ? `, ${fmt(top - H)} above the top plate` : ''}`}</title>
          </line>
          <text className="sh-t halo" x={Math.min(X(left), X(right)) + 4} y={v.textAt(Y(top), 4, 12, top > H ? out : bt)}>
            {`TOP OF SHEATHING ${fmt(top)}`}
          </text>
        </>
      )}
      {sh.extLeft > 0 && (
        <line className="sh-edge" x1={X(left)} y1={Y(top)} x2={X(left)} y2={Y(0)}>
          <title>{cornerTitle(sh.extLeft, 'left')}</title>
        </line>
      )}
      {sh.extRight > 0 && (
        <line className="sh-edge" x1={X(right)} y1={Y(top)} x2={X(right)} y2={Y(0)}>
          <title>{cornerTitle(sh.extRight, 'right')}</title>
        </line>
      )}
      {sh.verticalSeams.map((s) => (
        <line key={`vs${s.x}`} className="sh-seam" x1={X(s.x)} y1={Y(Math.max(H, top))} x2={X(s.x)} y2={Y(0)} />
      ))}
      {sh.horizontalSeams.map((z) => (
        <line key={`hs${z}`} className="sh-seam" x1={X(left)} y1={Y(z)} x2={X(right)} y2={Y(z)} />
      ))}

      {/* seam positions, measured from the layout end */}
      <text className="cap" x={v.left - 10} y={tickY + 4} textAnchor="end">
        {`SHEATHING ${v.arrow}`}
      </text>
      {sh.verticalSeams.map((s) => (
        <g key={`vt${s.x}`}>
          <line className="sh-k" x1={X(s.x)} y1={tickY + 2 * bt} x2={X(s.x)} y2={tickY + 8 * bt} />
          <text className="sh-t halo" x={X(s.x)} y={v.textAt(tickY, 2, 10, out)} textAnchor="middle">
            {fmt(s.distance)}
          </text>
        </g>
      ))}

      {/* seam heights from the floor, off the wall's right end */}
      {chain.slice(1).map((z, i) => (
        <VDim
          key={`hd${z}`}
          className="sheath-dim"
          x={dimX}
          y1={Y(z)}
          y2={Y(chain[i]!)}
          label={fmt(z - chain[i]!)}
          ext={X(right)}
          side={v.side('right')}
        />
      ))}
    </g>
  );
}
