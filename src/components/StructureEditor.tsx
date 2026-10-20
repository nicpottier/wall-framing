import { useId, type Dispatch, type ReactNode } from 'react';
import { DEPTH, HEADER_TYPES, POST_TYPES, T, headerName, postType } from '../lib/lumber';
import { parseLength, type Formatter } from '../lib/units';
import {
  resolveBeam,
  resolveIntersection,
  resolvePost,
  resolveTall,
  type BeamInput,
  type IntersectionInput,
  type PostInput,
  type TallInput,
  type WallAction,
  type WallInput,
} from '../state/wall';
import { Field, LengthInput, Panel, Segmented } from './controls';
import { PlusIcon } from './OpeningsEditor';

interface Props {
  wall: WallInput;
  errorIds: Set<string>;
  fmt: Formatter;
  dispatch: Dispatch<WallAction>;
}

/** Posts under beam bearing, walls butting in, California corners, and stretches framed taller than the rest. */
export function StructureEditor({ wall, errorIds, fmt, dispatch }: Props) {
  const empty = !wall.posts.length && !wall.tall.length && !wall.intersections.length && !wall.beams.length;
  const count = (n: number, one: string, many: string) => (n ? `${n} ${n === 1 ? one : many}` : '');
  const corners = [wall.californiaLeft, wall.californiaRight].filter((c) => c !== 'none').length;
  const parts = [
    count(wall.intersections.length, 'intersection', 'intersections'),
    count(wall.posts.length, 'post', 'posts'),
    count(wall.beams.length, 'beam', 'beams'),
    count(corners, 'California corner', 'California corners'),
    count(wall.tall.length, 'tall stretch', 'tall stretches'),
  ].filter(Boolean);
  const set = (key: 'californiaLeft' | 'californiaRight') => (value: string) => dispatch({ type: 'set', key, value });
  const cornerField = (key: 'californiaLeft' | 'californiaRight', label: string) => (
    <Field label={label}>
      {(id) => (
        <select id={id} value={wall[key]} onChange={(e) => set(key)(e.target.value)}>
          <option value="none">None</option>
          <option value="2x4">2x4 wall butts in</option>
          <option value="2x6">2x6 wall butts in</option>
        </select>
      )}
    </Field>
  );
  return (
    <Panel tone="structure" title="Structure" summary={parts.join(' · ') || undefined}>
      <div className="fields">
        <p className="field-group full">California corners</p>
        {cornerField('californiaLeft', 'Left end')}
        {cornerField('californiaRight', 'Right end')}
        <p className="field-note full">Where a wall butts into an end of this one, a stud laid flat against the end stud reaches past it to back the drywall in the inside corner.</p>
      </div>
      <div className="ops">
        <div className="btn-row">
          <button className="btn add structure" type="button" onClick={() => dispatch({ type: 'addIntersection' })}>
            <PlusIcon />
            <TeeGlyph /> Intersection
          </button>
          <button className="btn add structure" type="button" onClick={() => dispatch({ type: 'addPost' })}>
            <PlusIcon />
            <PostGlyph /> Post
          </button>
          <button className="btn add structure" type="button" onClick={() => dispatch({ type: 'addBeam' })}>
            <PlusIcon />
            <BeamGlyph /> Beam
          </button>
          <button className="btn add structure" type="button" onClick={() => dispatch({ type: 'addTall' })}>
            <PlusIcon />
            <TallGlyph /> Tall stretch
          </button>
        </div>
        {empty && (
          <p className="empty">
            Add an intersection where another wall butts in partway along (it gets backer studs and ladder blocking), a post and beam where a
            dropped beam bears on this wall and breaks its top plates, or a tall stretch where the top plate steps up per 3/S4.1.
          </p>
        )}
        {wall.intersections.map((t) => (
          <IntersectionCard key={t.id} it={t} wall={wall} hasError={errorIds.has(t.id)} fmt={fmt} dispatch={dispatch} />
        ))}
        {wall.posts.map((p) => (
          <PostCard key={p.id} post={p} wall={wall} hasError={errorIds.has(p.id)} fmt={fmt} dispatch={dispatch} />
        ))}
        {wall.beams.map((b) => (
          <BeamCard key={b.id} beam={b} wall={wall} hasError={errorIds.has(b.id)} fmt={fmt} dispatch={dispatch} />
        ))}
        {wall.tall.map((t) => (
          <TallCard key={t.id} tall={t} wall={wall} hasError={errorIds.has(t.id)} fmt={fmt} dispatch={dispatch} />
        ))}
      </div>
    </Panel>
  );
}

function BeamGlyph() {
  return (
    <svg className="glyph" width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
      <rect x="1.5" y="2.5" width="13" height="4" fill="currentColor" fillOpacity="0.3" stroke="currentColor" strokeWidth="1.3" />
      <path d="M6 6.5v8M10 6.5v8M1.5 14.5h13" stroke="currentColor" strokeWidth="1.3" />
    </svg>
  );
}

interface BeamCardProps {
  beam: BeamInput;
  wall: WallInput;
  hasError: boolean;
  fmt: Formatter;
  dispatch: Dispatch<WallAction>;
}

function BeamCard({ beam: b, wall, hasError, fmt, dispatch }: BeamCardProps) {
  const patch = (patch: Partial<BeamInput>) => dispatch({ type: 'updateBeam', id: b.id, patch });
  const r = resolveBeam(b, wall);
  return (
    <article className={`op op-structure${hasError ? ' has-err' : ''}`} aria-label={`Beam ${b.label}`}>
      <CardHead kind="Beam" label={b.label} glyph={<BeamGlyph />} onLabel={(label) => patch({ label })} onRemove={() => dispatch({ type: 'removeBeam', id: b.id })} />
      <div className="fields">
        <Field label="Size" full>
          {(id) => (
            <select id={id} value={b.type} onChange={(e) => patch({ type: e.target.value as BeamInput['type'] })}>
              {HEADER_TYPES.map((h) => (
                <option key={h.id} value={h.id}>
                  {headerName(h)}
                </option>
              ))}
            </select>
          )}
        </Field>
        <Segmented
          full
          label="Beam"
          value={b.span}
          options={[['cross', 'Crosses the wall'], ['along', 'Along part'], ['full', 'Full length']]}
          onChange={(span) => patch({ span })}
        />
        {b.span !== 'full' && (
          <Segmented full label="Measured from" value={b.from} options={[['left', 'Left end'], ['right', 'Right end']]} onChange={(from) => patch({ from })} />
        )}
        {b.span === 'cross' && <Field label="To its centerline">{(id) => <LengthInput id={id} value={b.offset} onChange={(offset) => patch({ offset })} />}</Field>}
        {b.span === 'along' && (
          <>
            <Field label="Near end">{(id) => <LengthInput id={id} value={b.start} onChange={(start) => patch({ start })} />}</Field>
            <Field label="Far end">{(id) => <LengthInput id={id} value={b.end} onChange={(end) => patch({ end })} />}</Field>
          </>
        )}
        <p className="field-note full">Dropped (11/S4.2): its top is flush with the top plates, which stop where it passes. Put a post under a beam crossing the wall.</p>
      </div>
      {typeof r !== 'string' && (
        <footer className="op-foot">
          <span>
            <b>Sides</b> {fmt(r.x0)} – {fmt(r.x1)} from left
          </span>
        </footer>
      )}
    </article>
  );
}

function TeeGlyph() {
  return (
    <svg className="glyph" width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
      <path d="M1.5 3.5h13M1.5 7.5h4.5v7M14.5 7.5H10v7" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
    </svg>
  );
}

interface IntersectionCardProps {
  it: IntersectionInput;
  wall: WallInput;
  hasError: boolean;
  fmt: Formatter;
  dispatch: Dispatch<WallAction>;
}

function IntersectionCard({ it, wall, hasError, fmt, dispatch }: IntersectionCardProps) {
  const patch = (patch: Partial<IntersectionInput>) => dispatch({ type: 'updateIntersection', id: it.id, patch });
  const offsetId = useId();
  const r = resolveIntersection(it, wall);
  const half = DEPTH[it.size] / 2;
  return (
    <article className={`op op-structure${hasError ? ' has-err' : ''}`} aria-label={`Intersection ${it.label}`}>
      <CardHead
        kind="Intersection"
        label={it.label}
        glyph={<TeeGlyph />}
        onLabel={(label) => patch({ label })}
        onRemove={() => dispatch({ type: 'removeIntersection', id: it.id })}
      />
      <div className="fields">
        <div className="field full">
          <label htmlFor={offsetId}>Position to its centerline</label>
          <div className="inline">
            <Segmented bare label="Measure from" value={it.from} options={[['left', 'From left'], ['right', 'From right']]} onChange={(from) => patch({ from })} />
            <LengthInput id={offsetId} value={it.offset} onChange={(offset) => patch({ offset })} />
          </div>
        </div>
        <Segmented label="Wall butting in" value={it.size} options={[['2x4', '2x4'], ['2x6', '2x6']]} onChange={(size) => patch({ size })} />
      </div>
      {typeof r !== 'string' && (
        <footer className="op-foot">
          <span>
            <b>Faces</b> {fmt(r - half)} – {fmt(r + half)} from left
          </span>
        </footer>
      )}
    </article>
  );
}

function PostGlyph() {
  return (
    <svg className="glyph" width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
      <path d="M2 2.5h12M2 13.5h12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <rect x="5.5" y="2.5" width="5" height="11" fill="currentColor" fillOpacity="0.3" stroke="currentColor" strokeWidth="1.3" />
    </svg>
  );
}

function TallGlyph() {
  return (
    <svg className="glyph" width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
      <path d="M1.5 7.5h4.5V2.5h4.5v5h4" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
      <path d="M1.5 14h13" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M7 2.5V14M9.5 2.5V14" stroke="currentColor" strokeWidth="1" />
    </svg>
  );
}

interface CardHeadProps {
  kind: string;
  label: string;
  glyph: ReactNode;
  onLabel: (label: string) => void;
  onRemove: () => void;
}

function CardHead({ kind, label, glyph, onLabel, onRemove }: CardHeadProps) {
  const id = useId();
  return (
    <header className="op-head">
      {glyph}
      <label className="visually-hidden" htmlFor={id}>
        {kind} label
      </label>
      <input id={id} className="op-label" type="text" autoComplete="off" value={label} size={Math.max(2, label.length)} onChange={(e) => onLabel(e.target.value)} />
      <span className="op-kind">{kind}</span>
      <button className="op-remove" type="button" aria-label={`Remove ${label}`} title="Remove" onClick={onRemove}>
        <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true">
          <path d="M3.5 3.5l7 7M10.5 3.5l-7 7" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
        </svg>
      </button>
    </header>
  );
}

interface PostCardProps {
  post: PostInput;
  wall: WallInput;
  hasError: boolean;
  fmt: Formatter;
  dispatch: Dispatch<WallAction>;
}

function PostCard({ post: p, wall, hasError, fmt, dispatch }: PostCardProps) {
  const patch = (patch: Partial<PostInput>) => dispatch({ type: 'updatePost', id: p.id, patch });
  const offsetId = useId();
  const r = resolvePost(p, wall);
  return (
    <article className={`op op-structure${hasError ? ' has-err' : ''}`} aria-label={`Post ${p.label}`}>
      <CardHead kind="Post" label={p.label} glyph={<PostGlyph />} onLabel={(label) => patch({ label })} onRemove={() => dispatch({ type: 'removePost', id: p.id })} />
      <div className="fields">
        <div className="field full">
          <label htmlFor={offsetId}>Position to centerline</label>
          <div className="inline">
            <Segmented bare label="Measure from" value={p.from} options={[['left', 'From left'], ['right', 'From right']]} onChange={(from) => patch({ from })} />
            <LengthInput id={offsetId} value={p.offset} onChange={(offset) => patch({ offset })} />
          </div>
        </div>
        <Field label="Size" hint="Plan note 5: (3) studs min at beam ends">
          {(id) => (
            <select id={id} value={p.type} onChange={(e) => patch({ type: e.target.value as PostInput['type'] })}>
              {POST_TYPES.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.label}
                </option>
              ))}
            </select>
          )}
        </Field>
      </div>
      {typeof r !== 'string' && (
        <footer className="op-foot">
          <span>
            <b>Faces</b> {fmt(r.x)} – {fmt(r.x + postType(p.type).width)} from left
          </span>
        </footer>
      )}
    </article>
  );
}

interface TallCardProps {
  tall: TallInput;
  wall: WallInput;
  hasError: boolean;
  fmt: Formatter;
  dispatch: Dispatch<WallAction>;
}

function TallCard({ tall: t, wall, hasError, fmt, dispatch }: TallCardProps) {
  const patch = (patch: Partial<TallInput>) => dispatch({ type: 'updateTall', id: t.id, patch });
  const r = resolveTall(t, wall);
  const plates = wall.topPlates === '1' ? 1 : 2;
  const H = parseLength(wall.height);
  return (
    <article className={`op op-structure${hasError ? ' has-err' : ''}`} aria-label={`Tall stretch ${t.label}`}>
      <CardHead kind="Tall stretch" label={t.label} glyph={<TallGlyph />} onLabel={(label) => patch({ label })} onRemove={() => dispatch({ type: 'removeTall', id: t.id })} />
      <div className="fields">
        <Segmented full label="Ends measured from" value={t.from} options={[['left', 'Left end'], ['right', 'Right end']]} onChange={(from) => patch({ from })} />
        <Field label="Near end">{(id) => <LengthInput id={id} value={t.start} onChange={(start) => patch({ start })} />}</Field>
        <Field label="Far end">{(id) => <LengthInput id={id} value={t.end} onChange={(end) => patch({ end })} />}</Field>
        <Field label="Height" hint={Number.isFinite(H) ? `Floor to top of plate; the wall is ${fmt(H)}` : 'Floor to top of plate'}>
          {(id) => <LengthInput id={id} value={t.height} onChange={(height) => patch({ height })} />}
        </Field>
      </div>
      {typeof r !== 'string' && (
        <footer className="op-foot">
          <span>
            <b>Length</b> {fmt(r.x1 - r.x0)}
          </span>
          <span>
            <b>Studs</b> {fmt(r.height - (plates + 1) * T)}
          </span>
          <span>
            <b>Ends</b> {fmt(r.x0)} – {fmt(r.x1)} from left
          </span>
        </footer>
      )}
    </article>
  );
}
