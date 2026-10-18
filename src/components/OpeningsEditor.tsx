import { useId, type Dispatch } from 'react';
import type { OpeningType } from '../lib/framing';
import { HEADER_TYPES, TYPICAL_HEADER, headerName, headerType } from '../lib/lumber';
import type { Formatter } from '../lib/units';
import { resolveOpening, type OpeningInput, type WallAction, type WallInput } from '../state/wall';
import { Field, LengthInput, Panel, Segmented } from './controls';

interface Props {
  wall: WallInput;
  errorIds: Set<string>;
  fmt: Formatter;
  dispatch: Dispatch<WallAction>;
}

export function OpeningsEditor({ wall, errorIds, fmt, dispatch }: Props) {
  const count = wall.openings.length;
  return (
    <Panel
      title="Openings"
      summary={count ? `${count}` : undefined}
      actions={
        <div className="btn-row">
          <button className="btn add window" type="button" onClick={() => dispatch({ type: 'addOpening', kind: 'window' })}>
            <OpeningGlyph type="window" /> Window
          </button>
          <button className="btn add door" type="button" onClick={() => dispatch({ type: 'addOpening', kind: 'door' })}>
            <OpeningGlyph type="door" /> Door
          </button>
        </div>
      }
    >
      <div className="ops">
        {count === 0 && <p className="empty">No openings yet. Add a window or door to frame it in.</p>}
        {wall.openings.map((o) => (
          <OpeningCard key={o.id} opening={o} wall={wall} hasError={errorIds.has(o.id)} fmt={fmt} dispatch={dispatch} />
        ))}
      </div>
    </Panel>
  );
}

/** Small elevation icon: a window with a mullion, or a door with a knob. */
export function OpeningGlyph({ type }: { type: OpeningType }) {
  return type === 'window' ? (
    <svg className="glyph" width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
      <rect x="2.5" y="2.5" width="11" height="11" rx="0.5" fill="none" stroke="currentColor" strokeWidth="1.5" />
      <path d="M8 2.5v11M2.5 8h11" stroke="currentColor" strokeWidth="1.2" />
    </svg>
  ) : (
    <svg className="glyph" width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
      <path d="M4 14.5V1.5h8v13" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
      <path d="M2 14.5h12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <circle cx="10" cy="8.5" r="1" fill="currentColor" />
    </svg>
  );
}

interface CardProps {
  opening: OpeningInput;
  wall: WallInput;
  hasError: boolean;
  fmt: Formatter;
  dispatch: Dispatch<WallAction>;
}

function OpeningCard({ opening: o, wall, hasError, fmt, dispatch }: CardProps) {
  const patch = (p: Partial<OpeningInput>) => dispatch({ type: 'updateOpening', id: o.id, patch: p });
  const len = (key: 'offset' | 'width' | 'height' | 'headHeight') => (value: string) => patch({ [key]: value });
  const kind = o.type === 'window' ? 'Window' : 'Door';
  const r = resolveOpening(o, wall);
  const ids = { label: useId(), offset: useId(), width: useId(), height: useId() };

  return (
    <article className={`op op-${o.type}${hasError ? ' has-err' : ''}`} aria-label={`${kind} ${o.label}`}>
      <header className="op-head">
        <OpeningGlyph type={o.type} />
        <label className="visually-hidden" htmlFor={ids.label}>
          Label
        </label>
        <input
          id={ids.label}
          className="op-label"
          type="text"
          autoComplete="off"
          value={o.label}
          size={Math.max(2, o.label.length)}
          onChange={(e) => patch({ label: e.target.value })}
        />
        <Segmented
          bare
          label="Opening type"
          value={o.type}
          options={[['window', 'Window'], ['door', 'Door']]}
          onChange={(k) => dispatch({ type: 'setOpeningType', id: o.id, kind: k })}
        />
        <button className="op-remove" type="button" aria-label={`Remove ${o.label}`} title="Remove" onClick={() => dispatch({ type: 'removeOpening', id: o.id })}>
          <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true">
            <path d="M3.5 3.5l7 7M10.5 3.5l-7 7" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
          </svg>
        </button>
      </header>

      <div className="fields">
        <div className="field full">
          <label htmlFor={ids.offset}>Position to R.O. edge</label>
          <div className="inline">
            <Segmented bare label="Measure from" value={o.from} options={[['left', 'From left'], ['right', 'From right']]} onChange={(from) => patch({ from })} />
            <LengthInput id={ids.offset} value={o.offset} onChange={len('offset')} />
          </div>
        </div>
        <div className="field full">
          <label htmlFor={ids.width}>{kind} size (W × H)</label>
          <div className="inline pair">
            <LengthInput id={ids.width} value={o.width} onChange={len('width')} />
            <span className="times" aria-hidden="true">
              ×
            </span>
            <LengthInput id={ids.height} value={o.height} onChange={len('height')} />
            <label className="visually-hidden" htmlFor={ids.height}>
              {kind} height
            </label>
          </div>
        </div>
        {o.type === 'window' && (
          <Field label="Head height" hint={o.headHeight.trim() ? 'Overrides the wall' : 'From the wall'}>
            {(id) => <LengthInput id={id} value={o.headHeight} onChange={len('headHeight')} optional placeholder={wall.windowHeadHeight} />}
          </Field>
        )}
        <Field label="Header">
          {(id) => (
            <select id={id} value={o.header} onChange={(e) => patch({ header: e.target.value as OpeningInput['header'] })}>
              <option value="auto">Auto · {headerName(headerType(TYPICAL_HEADER))} typ.</option>
              <option value={TYPICAL_HEADER}>{headerName(headerType(TYPICAL_HEADER))}</option>
              <optgroup label="Beam schedule">
                {HEADER_TYPES.filter((h) => h.mark).map((h) => (
                  <option key={h.id} value={h.id}>
                    {h.mark} · {h.label}
                  </option>
                ))}
              </optgroup>
            </select>
          )}
        </Field>
        <Field label="Jacks / side">
          {(id) => (
            <select id={id} value={o.jacksPerSide} onChange={(e) => patch({ jacksPerSide: e.target.value as OpeningInput['jacksPerSide'] })}>
              <option value="auto">Auto</option>
              <option value="1">1</option>
              <option value="2">2</option>
            </select>
          )}
        </Field>
      </div>

      {r.ok && (
        <footer className="op-foot">
          <span>
            <b>R.O.</b> {fmt(r.roWidth)} × {fmt(r.roHeight)}
          </span>
          {o.type === 'window' && (
            <span>
              <b>Sill</b> {fmt(r.sill)}
            </span>
          )}
          <span>
            <b>From left</b> {fmt(r.x)}
          </span>
        </footer>
      )}
    </article>
  );
}
