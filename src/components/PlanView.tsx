import { useMemo, useState, type Dispatch } from 'react';
import { DEPTH, HEADER_TYPES, POST_TYPES, headerName } from '../lib/lumber';
import { planBox, planOverlaps, planPoint, RUN, unionBox, wallBox, type Box, type PlacedWall, type PlanOverlap } from '../lib/plan';
import type { Formatter } from '../lib/units';
import { resolveProjectPost, type Project, type ProjectAction, type ProjectPost } from '../state/project';
import { resolvePlacement } from '../state/wall';
import { LengthInput } from './controls';
import { wallHref } from '../useRoute';
import { HDim, VDim, textWidth } from './Dimensions';
import { useWidth } from './Elevation';
import type { WallResult } from './Overview';

interface Props {
  results: WallResult[];
  project: Project;
  dispatch: Dispatch<ProjectAction>;
  fmt: Formatter;
}

const PAD = 56;
const MAX_HEIGHT = 680;
const MIN_WIDTH = 320;
/** Pixels per inch below which wall names are left to the tooltips. */
const MIN_LABEL_SCALE = 1;

/** The walls and freestanding posts placed on the floor plan, and any that share floor. */
export function usePlan(results: WallResult[], project: Project) {
  return useMemo(() => {
    // Posts go on the plan as their own square (5 1/2" deep for built-up studs), centered.
    const posts: PlacedWall[] = [];
    project.posts.forEach((p, i) => {
      const r = resolveProjectPost(p, project.defaults);
      if (typeof r === 'string') return;
      const deep = p.type.startsWith('studs') ? DEPTH['2x6'] : r.width;
      posts.push({ index: -1 - i, name: p.label || 'Post', x: r.x - r.width / 2, y: r.y - deep / 2, run: 'east', length: r.width, depth: deep });
    });
    const placed: (PlacedWall & { result: WallResult })[] = [];
    const unplaced: string[] = [];
    results.forEach((r, index) => {
      const p = resolvePlacement(r.wall);
      if (!p || typeof p === 'string' || !r.result.ok) {
        unplaced.push(r.wall.name || `Wall ${index + 1}`);
        return;
      }
      placed.push({ index, name: r.wall.name, ...p, length: r.result.wall.length, depth: DEPTH[r.wall.studSize], result: r });
    });
    return { placed, posts, unplaced, overlaps: planOverlaps([...placed, ...posts]) };
  }, [results, project]);
}

/** Every placed wall to scale, north up, with openings, posts and beams; each wall links to its editor. */
export function PlanView({ results, project, dispatch, fmt }: Props) {
  const [wrapRef, measured] = useWidth<HTMLDivElement>();
  const { placed, posts, unplaced, overlaps } = usePlan(results, project);
  const [hover, setHover] = useState<number | null>(null);

  const bounds = unionBox([...placed.map(sheathedBox), ...posts.map(wallBox)]);
  if (!bounds) {
    return (
      <section className="plan-card">
        <PlanHead />
        <PostsEditor project={project} dispatch={dispatch} />
        <p className="empty plan-empty">
          No walls are on the plan yet. Give a wall a plan position in its editor (its left end and the direction it runs) to see it here.
        </p>
      </section>
    );
  }

  const bw = bounds.x1 - bounds.x0;
  const bh = bounds.y1 - bounds.y0;
  const width = Math.max(measured || 800, MIN_WIDTH);
  const k = Math.min((width - 2 * PAD) / bw, (MAX_HEIGHT - 2 * PAD) / bh);
  const height = Math.round(bh * k + 2 * PAD);
  const ox = (width - bw * k) / 2;
  const sx = (x: number) => ox + (x - bounds.x0) * k;
  const sy = (y: number) => PAD + (bounds.y1 - y) * k;
  const rect = (b: Box) => ({ x: sx(b.x0), y: sy(b.y1), width: (b.x1 - b.x0) * k, height: (b.y1 - b.y0) * k });
  const badWalls = new Set(overlaps.flatMap((o) => [o.a.index, o.b.index]));

  return (
    <section className="plan-card">
      <PlanHead />
      <div className="svg-wrap" ref={wrapRef}>
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="100%"
          viewBox={`0 0 ${width} ${height}`}
          style={{ height: 'auto', aspectRatio: `${width} / ${height}` }}
          role="img"
          aria-label="Floor plan of the walls"
          className={hover != null ? 'plan focus' : 'plan'}
        >
          {/* overall size */}
          <HDim x1={sx(bounds.x0)} x2={sx(bounds.x1)} y={sy(bounds.y1) - 26} label={fmt(bw)} ext={sy(bounds.y1)} />
          <VDim x={sx(bounds.x0) - 26} y1={sy(bounds.y1)} y2={sy(bounds.y0)} label={fmt(bh)} ext={sx(bounds.x0)} side="left" rotate />
          <NorthArrow x={width - 26} y={30} />

          {placed.map((w) => (
            <PlanWall
              key={w.result.wall.id}
              w={w}
              rect={rect}
              sx={sx}
              sy={sy}
              k={k}
              fmt={fmt}
              bad={badWalls.has(w.index)}
              hot={hover === w.index}
              onHover={setHover}
            />
          ))}

          {posts.map((p) => {
            const b = wallBox(p);
            return (
              <g key={`post${p.index}`}>
                <rect className="plan-post free" {...rect(b)}>
                  <title>{`${p.name}: freestanding post`}</title>
                </rect>
                {k >= MIN_LABEL_SCALE && (
                  <text className="plan-t" x={sx(b.x1) + 4} y={sy((b.y0 + b.y1) / 2)} dominantBaseline="middle">
                    {p.name}
                  </text>
                )}
              </g>
            );
          })}

          {overlaps.map((o, i) => (
            <rect key={`ov${i}`} className="plan-overlap" {...rect(o.box)}>
              <title>{overlapText(o, fmt)}</title>
            </rect>
          ))}
        </svg>
      </div>
      {(overlaps.length > 0 || unplaced.length > 0) && (
        <ul className="plan-notes">
          {overlaps.map((o, i) => (
            <li key={`o${i}`} className="error">
              {overlapText(o, fmt)}
            </li>
          ))}
          {unplaced.length > 0 && <li className="note">Not on the plan: {unplaced.join(', ')}. Give them a plan position in their editors.</li>}
        </ul>
      )}
      <PostsEditor project={project} dispatch={dispatch} />
    </section>
  );
}

export const overlapText = (o: PlanOverlap, fmt: Formatter) =>
  `${o.a.name} and ${o.b.name} overlap ${fmt(o.box.x1 - o.box.x0)} × ${fmt(o.box.y1 - o.box.y0)} on the plan. Check their lengths and positions.`;

function PlanHead() {
  return (
    <div className="plan-head">
      <h2>Plan</h2>
      <span className="sub">Framing to scale, north up · click a wall to edit it</span>
    </div>
  );
}

/** Framing plus sheathing on the outside face, which sets the plan's overall size. */
function sheathedBox(w: PlacedWall & { result: WallResult }): Box {
  const f = w.result.result;
  const t = f.ok && f.wall.sheathing.enabled !== false ? f.wall.sheathing.thickness : 0;
  return f.ok ? planBox(w, -f.sheathing.extLeft, w.length + f.sheathing.extRight, 0, w.depth + t) : wallBox(w);
}

interface WallProps {
  w: PlacedWall & { result: WallResult };
  rect: (b: Box) => { x: number; y: number; width: number; height: number };
  sx: (x: number) => number;
  sy: (y: number) => number;
  k: number;
  fmt: Formatter;
  bad: boolean;
  hot: boolean;
  onHover: (index: number | null) => void;
}

function PlanWall({ w, rect, sx, sy, k, fmt, bad, hot, onHover }: WallProps) {
  const f = w.result.result;
  if (!f.ok) return null;
  const errors = w.result.issues.some((i) => i.level === 'error');
  const sheathed = f.wall.sheathing.enabled !== false;
  const exterior = sheathed && f.wall.exterior;
  const t = sheathed ? f.wall.sheathing.thickness : 0;
  const mid = w.depth / 2;
  // Label on the side the wall is seen from, along the wall.
  const [lx, ly] = planPoint(w, w.length / 2, 0);
  const into = RUN[w.run].into;
  const vertical = w.run === 'north' || w.run === 'south';
  const nx = sx(lx) - into[0] * 9;
  const ny = sy(ly) + into[1] * 9;
  // Labels need room along the wall, and a plan big enough that they don't crowd each other.
  const fits = k >= MIN_LABEL_SCALE && w.length * k > textWidth(w.name) * 0.85 + 6;

  return (
    <a
      href={wallHref(w.index)}
      className={`plan-wall${exterior ? ' exterior' : ''}${errors || bad ? ' err' : ''}${hot ? ' hot' : ''}`}
      onMouseEnter={() => onHover(w.index)}
      onMouseLeave={() => onHover(null)}
      aria-label={`Edit ${w.name}`}
    >
      <title>{`${w.name} · ${fmt(w.length)} · ${f.wall.studs ?? '2x6'}${exterior ? ' exterior' : ''}`}</title>
      {t > 0 && <rect className="plan-sheath" {...rect(planBox(w, -f.sheathing.extLeft, w.length + f.sheathing.extRight, w.depth, w.depth + t))} />}
      <rect className="plan-frame" {...rect(wallBox(w))} />
      {f.sections
        .filter((p) => p.beam)
        .map((p) => (
          <rect key={`b${p.x0}`} className="plan-beam" {...rect(planBox(w, p.x0, p.x1, 0, w.depth))} />
        ))}
      {f.posts
        .filter((p) => !p.hasError)
        .map((p) => (
          <rect key={p.spec.id} className="plan-post" {...rect(planBox(w, p.x0, p.x1, 0, Math.min(w.depth, 5.5)))} />
        ))}
      {f.openings.map((o) => {
        const [ax, ay] = planPoint(w, o.spec.x, mid);
        const [bx, by] = planPoint(w, o.spec.x + o.spec.width, mid);
        return (
          <g key={o.spec.id}>
            <rect className="plan-ro" {...rect(planBox(w, o.spec.x, o.spec.x + o.spec.width, 0, w.depth))} />
            <line className={`plan-op ${o.spec.type}`} x1={sx(ax)} y1={sy(ay)} x2={sx(bx)} y2={sy(by)} />
          </g>
        );
      })}
      {fits && (
        <text
          className="plan-t"
          x={nx}
          y={ny}
          textAnchor="middle"
          dominantBaseline="middle"
          transform={vertical ? `rotate(-90 ${nx} ${ny})` : undefined}
        >
          {w.name}
        </text>
      )}
    </a>
  );
}

function NorthArrow({ x, y }: { x: number; y: number }) {
  return (
    <g className="plan-north" aria-hidden="true">
      <path d={`M${x} ${y - 14} L${x + 6} ${y + 4} L${x} ${y} L${x - 6} ${y + 4} Z`} />
      <text x={x} y={y + 18} textAnchor="middle">
        N
      </text>
    </g>
  );
}

/** Freestanding posts under beams: size, the beam they carry and their center on the plan. */
function PostsEditor({ project, dispatch }: { project: Project; dispatch: Dispatch<ProjectAction> }) {
  const patch = (id: string, p: Partial<ProjectPost>) => dispatch({ type: 'updatePost', id, patch: p });
  return (
    <div className="plan-posts">
      <div className="plan-posts-head">
        <h3>Freestanding posts</h3>
        <span className="sub">On the subfloor under a beam; walls either side end at them</span>
        <button className="btn add structure" type="button" onClick={() => dispatch({ type: 'addPost' })}>
          + Post
        </button>
      </div>
      {project.posts.length > 0 && (
        <table className="plan-posts-table">
          <thead>
            <tr>
              <th>Post</th>
              <th>Size</th>
              <th>Under</th>
              <th>Center east</th>
              <th>Center north</th>
              <th aria-label="Remove" />
            </tr>
          </thead>
          <tbody>
            {project.posts.map((p) => {
              const r = resolveProjectPost(p, project.defaults);
              return (
                <tr key={p.id} className={typeof r === 'string' ? 'err' : undefined} title={typeof r === 'string' ? r : undefined}>
                  <td>
                    <input aria-label="Label" type="text" value={p.label} onChange={(e) => patch(p.id, { label: e.target.value })} />
                  </td>
                  <td>
                    <select aria-label="Size" value={p.type} onChange={(e) => patch(p.id, { type: e.target.value as ProjectPost['type'] })}>
                      {POST_TYPES.map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.label}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td>
                    <select aria-label="Beam" value={p.beam} onChange={(e) => patch(p.id, { beam: e.target.value as ProjectPost['beam'] })}>
                      {HEADER_TYPES.map((h) => (
                        <option key={h.id} value={h.id}>
                          {headerName(h)}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td>
                    <LengthInput id={`${p.id}-x`} value={p.x} onChange={(x) => patch(p.id, { x })} />
                  </td>
                  <td>
                    <LengthInput id={`${p.id}-y`} value={p.y} onChange={(y) => patch(p.id, { y })} />
                  </td>
                  <td>
                    <button className="op-remove" type="button" aria-label={`Remove ${p.label}`} onClick={() => dispatch({ type: 'removePost', id: p.id })}>
                      ×
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </div>
  );
}
