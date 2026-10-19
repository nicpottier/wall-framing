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
  /**
   * Draw at a scale shared with other walls: fit the longest and tallest of them, capped at
   * maxHeight px, instead of fitting this wall alone.
   */
  fit?: { length: number; height: number; maxHeight: number };
  /** Framing and openings only, with no dimensions or callouts, for small overview drawings. */
  compact?: boolean;
}

/** Margins around the wall, named by wall side so they follow it when the view flips. */
const PAD = { start: 108, end: 96, top: 92, bottom: 100 };
const COMPACT_PAD = { start: 12, end: 12, top: 12, bottom: 12 };
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

const FULL = ['stud', 'seamStud', 'king', 'post'];

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

export function Elevation({ framing, fmt, highlight, onHighlight, showSheathing: sheathingOn, view, fit, compact = false }: Props) {
  const [wrapRef, measured] = useWidth<HTMLDivElement>();
  const { wall, members, openings, layout, sections, steps } = framing;
  const { length: L, height: H } = wall;
  const Hmax = framing.maxHeight;
  const orient = ORIENTATION[view];
  const flipped = orient.flipZ;
  const showSheathing = sheathingOn && !compact;
  const pad = compact ? COMPACT_PAD : PAD;

  // Standing, the drawing extends above the wall when sheathing runs past the top plate.
  // On the deck that part isn't on the wall yet, so it isn't shown.
  const zTop = showSheathing && !flipped ? Math.max(Hmax, ...sections.map((p) => p.sheathTop)) : Hmax;
  const padL = orient.mirrorX ? pad.end : pad.start;
  const padR = orient.mirrorX ? pad.start : pad.end;
  const padT = flipped ? pad.bottom : pad.top;
  const padB = flipped ? pad.top : pad.bottom;
  const width = compact ? measured || 320 : Math.max(measured, MIN_WIDTH);
  const ppi = fit
    ? Math.max(0.5, Math.min((width - padL - padR) / fit.length, (fit.maxHeight - padT - padB) / fit.height))
    : Math.max(0.5, Math.min((width - padL - padR) / L, (MAX_HEIGHT - padT - padB) / zTop));
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

  // Bottom plate is drawn in segments around door cut-outs; a lower top plate around raised headers.
  const cuts = openings.flatMap((o) => (o.plateCut ? [o.plateCut] : [])).sort((a, b) => a[0] - b[0]);
  const topCuts = openings.flatMap((o) => (o.topPlateCut ? [o.topPlateCut] : [])).sort((a, b) => a[0] - b[0]);
  const memberEls = members.flatMap((m) => {
    const end = m.x + m.w;
    const segmentCuts = (m.role === 'plate' ? cuts : m.lowerPlate ? topCuts : []).filter(([c0, c1]) => c1 > m.x && c0 < end);
    if (!segmentCuts.length) return [rect(m, m.x, m.w, m.id)];
    const els = [];
    let a = m.x;
    for (const [c0, c1] of segmentCuts) {
      if (c0 > a) els.push(rect(m, a, c0 - a, `${m.id}-${a}`));
      a = Math.max(a, c1);
    }
    if (a < end) els.push(rect(m, a, end - a, `${m.id}-${a}`));
    return els;
  });
  const leftSec = sections[0]!;
  const rightSec = sections[sections.length - 1]!;

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
        // Compact drawings scale with their container so they can never push it wider.
        width={compact ? '100%' : width}
        height={compact ? undefined : height}
        style={compact ? { height: 'auto', aspectRatio: `${width} / ${height}` } : undefined}
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-label={flipped ? 'Wall framing as laid out on the deck' : 'Wall framing elevation from inside'}
        className={highlight ? 'focus' : undefined}
        onMouseLeave={() => onHighlight(null)}
      >
        {/* one-foot grid */}
        <g>
          {Array.from({ length: Math.ceil(L / 12) - 1 }, (_, i) => (i + 1) * 12).map((x) => {
            const top = sections.find((p) => x <= p.x1)?.height ?? H;
            return <line key={`gx${x}`} className="grid" x1={X(x)} y1={Y(top)} x2={X(x)} y2={Y(0)} />;
          })}
          {sections.flatMap((p) =>
            Array.from({ length: Math.ceil(p.height / 12) - 1 }, (_, i) => (i + 1) * 12).map((z) => (
              <line key={`gz${p.x0}-${z}`} className="grid" x1={X(p.x0)} y1={Y(z)} x2={X(p.x1)} y2={Y(z)} />
            )),
          )}
        </g>

        <g onMouseLeave={() => onHighlight(null)}>{memberEls}</g>

        {cuts.map(([c0, c1]) => (
          <rect key={`cut${c0}`} className="cutout" {...v.box(c0, 0, c1 - c0, T)} />
        ))}

        {/* header callouts */}
        {!compact &&
          members
            .filter((m) => m.role === 'header')
            .map((m) => {
              const label = `${m.size} × ${fmt(m.length)}`;
              if (m.w * ppi < textWidth(label) + 8 || m.h * ppi < 12) return null;
              return (
                <text key={`hl${m.id}`} className="hdr-t" x={X(m.x + m.w / 2)} y={Y(m.z + m.h / 2) + 3.8} textAnchor="middle">
                  {label}
                </text>
              );
            })}

        {/* CS16 straps across plate steps, over the sheathing */}
        {!compact &&
          steps.map((st) =>
            st.blocking ? (
              <line
                key={`strap${st.x}`}
                className="strap"
                x1={X(st.low === 'left' ? Math.max(0, st.x - (st.blocking[1] - st.x)) : st.blocking[0])}
                x2={X(st.low === 'left' ? st.blocking[1] : Math.min(L, st.x + (st.x - st.blocking[0])))}
                y1={Y(st.strapZ)}
                y2={Y(st.strapZ)}
              >
                <title>{`CS16 strap over the sheathing across the plate step ${fmt(st.x)} from the left end (3/S4.1)`}</title>
              </line>
            ) : null,
          )}

        {!compact && <PostOverlay framing={framing} fmt={fmt} v={v} />}

        {openings.map((o) => (
          <OpeningOverlay key={o.spec.id} o={o} framing={framing} fmt={fmt} v={v} compact={compact} />
        ))}

        {showSheathing && <SheathingOverlay framing={framing} fmt={fmt} v={v} aboveWall={!flipped} />}

        {!compact && (
          <>
            {/* overall length */}
            <HDim x1={X(0)} x2={X(L)} y={Y(zTop) - 30 * bt} label={fmt(L)} ext={Y(leftSec.height)} />
            {/* overall height and stud length, off the wall's left end */}
            <VDim x={X(0) - 70 * sx} y1={Y(leftSec.height)} y2={Y(0)} label={`WALL ${fmt(leftSec.height)}`} ext={X(0)} side={v.side('left')} rotate />
            <VDim
              x={X(0) - 36 * sx}
              y1={Y(leftSec.plateBottom)}
              y2={Y(T)}
              label={`STUD ${fmt(leftSec.studLength)}`}
              ext={X(0)}
              side={v.side('left')}
              rotate
            />
            {/* the right end too, when it is a different height */}
            {sections.length > 1 && Math.abs(rightSec.height - leftSec.height) > 1e-6 && (
              <>
                <VDim x={X(L) + 70 * sx} y1={Y(rightSec.height)} y2={Y(0)} label={`WALL ${fmt(rightSec.height)}`} ext={X(L)} side={v.side('right')} rotate />
                <VDim
                  x={X(L) + 36 * sx}
                  y1={Y(rightSec.plateBottom)}
                  y2={Y(T)}
                  label={`STUD ${fmt(rightSec.studLength)}`}
                  ext={X(L)}
                  side={v.side('right')}
                  rotate
                />
              </>
            )}
            {/* stretches framed to their own height: length, height and stud length */}
            {sections
              .filter((p) => p.tall && p !== leftSec && p !== rightSec)
              .map((p) => {
                const studs = members.filter((m) => FULL.includes(m.role) && m.x >= p.x0 && m.x + m.w <= p.x1).map((m) => m.x);
                return (
                  <g key={`tall${p.x0}`}>
                    <HDim x1={X(p.x0)} x2={X(p.x1)} y={Y(p.height) - 14 * bt} label={`${(p.tall!.label || 'TALL').toUpperCase()} ${fmt(p.x1 - p.x0)} · ${fmt(p.height)} TALL`} ext={Y(p.height)} />
                    <VDim
                      x={X(widestBay(p.x0, p.x1, studs))}
                      y1={Y(p.plateBottom)}
                      y2={Y(T)}
                      label={`STUD ${fmt(p.studLength)}`}
                      side={v.side('right')}
                      rotate={false}
                    />
                  </g>
                );
              })}

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
          </>
        )}
      </svg>
    </div>
  );
}

interface OverlayProps {
  o: OpeningFrame;
  framing: Framing;
  fmt: Formatter;
  v: ViewMap;
  compact: boolean;
}

function OpeningOverlay({ o, framing, fmt, v, compact }: OverlayProps) {
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
  const title = compact ? spec.label : `${spec.label} · ${spec.type.toUpperCase()}`;
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
      <rect className={`ro ${spec.type}${err}`} {...v.box(spec.x, o.roBottom, spec.width, spec.height)} />
      <line className={`ro-x ${spec.type}`} x1={xl} y1={yTop} x2={xr} y2={yBot} />
      <line className={`ro-x ${spec.type}`} x1={xr} y1={yTop} x2={xl} y2={yBot} />
      <line className={`ro-cl ${spec.type}`} x1={cx} y1={yTop} x2={cx} y2={yBot}>
        <title>{`${spec.label} centerline, ${fmt(spec.x + spec.width / 2)} from the left end`}</title>
      </line>
      <text className={`ro-t halo ${spec.type}${err}`} x={cx} y={cy - 2} textAnchor="middle">
        {title}
      </text>
      {!compact && roWidthPx > textWidth(size) + 50 && (
        <text className={`ro-s halo ${spec.type}${err}`} x={cx} y={cy + 13} textAnchor="middle">
          {size}
        </text>
      )}

      {!compact && (
        <>
          {/* inside the opening, just under the header */}
          <HDim x1={xl} x2={xr} y={yTop + 16 * bt} label={fmt(spec.width)} />
          <VDim x={xr - 11 * sx} y1={yTop} y2={yBot} label={`RO ${fmt(spec.height)}`} side={v.side('left')} />
          <VDim x={xl + 11 * sx} y1={Y(o.headerBottom)} y2={Y(T)} label={`JACK ${fmt(o.headerBottom - T)}`} side={v.side('right')} />
          {spec.type === 'window' && (
            <VDim x={xr - 11 * sx} y1={yBot} y2={Y(0)} label={`SILL ${fmt(spec.sill)}`} side={v.side('left')} />
          )}

          {(tops.length > 0 || hasFill) && (
            <VDim
              x={X(tops.length ? widestBay(o.crippleSpan[0], o.crippleSpan[1], tops.map((m) => m.x)) : o.crippleSpan[0] + (o.crippleSpan[1] - o.crippleSpan[0]) * 0.72)}
              y1={Y(o.crippleZone[1])}
              y2={Y(o.crippleZone[0])}
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
        </>
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
  const { wall, sheathing: sh, sections } = framing;
  const { length: L } = wall;
  const { X, Y, sx, bt } = v;
  const out: Dir = bt === 1 ? -1 : 1; // screen direction out past the top
  const left = -sh.extLeft;
  const right = L + sh.extRight;
  // Each stretch of the wall at its own height: the sheathing over it, and whether a top edge past
  // the wall is being left off. A stretch at a wall end carries the corner extension.
  const rows = sections.map((p, i) => {
    const top = aboveWall ? p.sheathTop : Math.min(p.sheathTop, p.height);
    return {
      p,
      top,
      cutOff: p.sheathTop > top,
      x0: i === 0 ? left : p.x0,
      x1: i === sections.length - 1 ? right : p.x1,
      seams: p.seams.filter((z) => z <= top + 1e-6),
    };
  });
  const first = rows[0]!;
  const last = rows[rows.length - 1]!;
  const rowAt = (x: number) => rows.find((r) => x <= r.p.x1 + 1e-6) ?? last;
  const tickY = Y(Math.max(framing.maxHeight, ...rows.map((r) => r.top))) + 48 * out;
  // Sheathing hung on the deck runs from the first full row up to its top; the strip below and any
  // row mostly on the wall above go on after the wall is stood.
  const bottom = Math.min(wall.sheathing.startHeight, ...rows.map((r) => r.top));
  // Seams, then the wall top and the sheathing top at the right end, measured up from the floor.
  const H = last.p.height;
  const chain = [...new Set([0, ...last.seams, ...(last.top > H ? [H, last.top] : [last.top])])].sort((a, b) => a - b);
  const dimX = X(right) + 28 * sx;
  const cornerTitle = (ext: number, end: string) =>
    `Sheathing runs ${fmt(ext)} past the ${end} end of the framing to the outside corner`;
  // Label each distinct top once, on the first stretch that has it.
  const labelled = new Set<number>();

  return (
    <g className="sheath">
      {rows.map((r) => {
        const showLabel = !r.cutOff && !labelled.has(r.top);
        labelled.add(r.top);
        return (
          <g key={`row${r.p.x0}`}>
            {/* sheathing above the top plate, and its top edge */}
            {r.top > r.p.height && <rect className="sh-above" {...v.box(r.x0, r.p.height, r.x1 - r.x0, r.top - r.p.height)} />}
            {!r.cutOff && (
              <line className="sh-top" x1={X(r.x0)} y1={Y(r.top)} x2={X(r.x1)} y2={Y(r.top)}>
                <title>{`Top of sheathing ${fmt(r.top)} from the floor${r.top > r.p.height ? `, ${fmt(r.top - r.p.height)} above the top plate` : ''}`}</title>
              </line>
            )}
            {showLabel && (
              <text className="sh-t halo" x={Math.min(X(r.x0), X(r.x1)) + 4} y={v.textAt(Y(r.top), 4, 12, r.top > r.p.height ? out : bt)}>
                {`TOP OF SHEATHING ${fmt(r.top)}`}
              </text>
            )}
            {r.seams.map((z) => (
              <line key={`hs${z}`} className="sh-seam" x1={X(r.x0)} y1={Y(z)} x2={X(r.x1)} y2={Y(z)} />
            ))}
          </g>
        );
      })}
      {/* where stretches meet, the taller one's sheathing edge */}
      {rows.slice(1).map((r, i) => {
        const prev = rows[i]!;
        if (Math.abs(r.top - prev.top) < 1e-6) return null;
        return <line key={`se${r.p.x0}`} className="sh-edge" x1={X(r.p.x0)} y1={Y(Math.max(r.top, prev.top))} x2={X(r.p.x0)} y2={Y(Math.min(r.top, prev.top))} />;
      })}
      {first.top > first.p.height && sh.extLeft === 0 && <line className="sh-edge" x1={X(0)} y1={Y(first.top)} x2={X(0)} y2={Y(first.p.height)} />}
      {last.top > last.p.height && sh.extRight === 0 && <line className="sh-edge" x1={X(L)} y1={Y(last.top)} x2={X(L)} y2={Y(last.p.height)} />}
      {sh.extLeft > 0 && (
        <line className="sh-edge" x1={X(left)} y1={Y(first.top)} x2={X(left)} y2={Y(bottom)}>
          <title>{cornerTitle(sh.extLeft, 'left')}</title>
        </line>
      )}
      {sh.extRight > 0 && (
        <line className="sh-edge" x1={X(right)} y1={Y(last.top)} x2={X(right)} y2={Y(bottom)}>
          <title>{cornerTitle(sh.extRight, 'right')}</title>
        </line>
      )}
      {sh.verticalSeams.map((s) => (
        <line key={`vs${s.x}`} className="sh-seam" x1={X(s.x)} y1={Y(rowAt(s.x).top)} x2={X(s.x)} y2={Y(bottom)} />
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

/** Each post's label, size and centerline. */
function PostOverlay({ framing, fmt, v }: { framing: Framing; fmt: Formatter; v: ViewMap }) {
  const { X, Y } = v;
  return (
    <g>
      {framing.posts
        .filter((p) => !p.hasError)
        .map((p) => {
          const cx = X((p.x0 + p.x1) / 2);
          const sec = framing.sections.find((s) => p.x0 >= s.x0 - 1e-6 && p.x1 <= s.x1 + 1e-6) ?? framing.sections[0]!;
          const label = `${p.spec.label} · ${p.type.label}`;
          const cy = Y(sec.plateBottom * 0.62);
          return (
            <g key={p.spec.id}>
              <line className="post-cl" x1={cx} y1={Y(sec.plateBottom)} x2={cx} y2={Y(T)}>
                <title>{`${p.spec.label} centerline, ${fmt((p.x0 + p.x1) / 2)} from the left end`}</title>
              </line>
              <text className="post-t halo" x={cx} y={cy} textAnchor="middle" transform={`rotate(-90 ${cx} ${cy})`} dy={4}>
                {label}
              </text>
            </g>
          );
        })}
    </g>
  );
}
