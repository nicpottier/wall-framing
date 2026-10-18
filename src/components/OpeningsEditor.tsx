import type { Dispatch } from 'react';
import { HEADER_SIZES } from '../lib/lumber';
import type { Formatter } from '../lib/units';
import { resolveOpening, type OpeningInput, type WallAction, type WallInput } from '../state/wall';
import { Field, LengthInput, Segmented } from './controls';

interface Props {
  wall: WallInput;
  errorIds: Set<string>;
  fmt: Formatter;
  dispatch: Dispatch<WallAction>;
}

export function OpeningsEditor({ wall, errorIds, fmt, dispatch }: Props) {
  return (
    <section className="panel" aria-labelledby="ops-h">
      <div className="panel-head">
        <h2 className="eyebrow" id="ops-h">
          Openings
        </h2>
        <div className="btn-row">
          <button className="btn" type="button" onClick={() => dispatch({ type: 'addOpening', kind: 'window' })}>
            + Window
          </button>
          <button className="btn" type="button" onClick={() => dispatch({ type: 'addOpening', kind: 'door' })}>
            + Door
          </button>
        </div>
      </div>
      <div className="ops">
        {wall.openings.length === 0 && <p className="empty">No openings yet. Add a window or door to frame it in.</p>}
        {wall.openings.map((o) => (
          <OpeningCard key={o.id} opening={o} wall={wall} hasError={errorIds.has(o.id)} fmt={fmt} dispatch={dispatch} />
        ))}
      </div>
    </section>
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

  return (
    <div className={`op${hasError ? ' has-err' : ''}`} data-type={o.type}>
      <div className="op-head">
        <span className="op-tag">{o.label || '?'}</span>
        <Segmented
          bare
          label="Opening type"
          value={o.type}
          options={[['window', 'Window'], ['door', 'Door']]}
          onChange={(k) => dispatch({ type: 'setOpeningType', id: o.id, kind: k })}
        />
        <button className="icon-btn" type="button" aria-label={`Remove ${o.label}`} onClick={() => dispatch({ type: 'removeOpening', id: o.id })}>
          ×
        </button>
      </div>
      <div className="fields">
        <Field label="Label">
          {(id) => <input id={id} type="text" className="plain" autoComplete="off" value={o.label} onChange={(e) => patch({ label: e.target.value })} />}
        </Field>
        <Segmented label="Measure from" value={o.from} options={[['left', 'Left end'], ['right', 'Right end']]} onChange={(from) => patch({ from })} />
        <Field label={`${o.from === 'left' ? 'Left' : 'Right'} end to R.O.`} hint={`Wall end to the ${o.from} edge of the rough opening`} full>
          {(id) => <LengthInput id={id} value={o.offset} onChange={len('offset')} />}
        </Field>
        <Field label={`${kind} width`}>{(id) => <LengthInput id={id} value={o.width} onChange={len('width')} />}</Field>
        <Field label={`${kind} height`}>{(id) => <LengthInput id={id} value={o.height} onChange={len('height')} />}</Field>
        {o.type === 'window' && (
          <Field label="Head height" hint={o.headHeight.trim() ? 'Overrides the wall setting' : 'Blank uses the wall setting'} full>
            {(id) => <LengthInput id={id} value={o.headHeight} onChange={len('headHeight')} optional placeholder={wall.windowHeadHeight} />}
          </Field>
        )}
        <Field label="Header">
          {(id) => (
            <select id={id} value={o.header} onChange={(e) => patch({ header: e.target.value as OpeningInput['header'] })}>
              <option value="auto">Auto</option>
              {HEADER_SIZES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          )}
        </Field>
        <Field label="Jacks each side">
          {(id) => (
            <select id={id} value={o.jacksPerSide} onChange={(e) => patch({ jacksPerSide: e.target.value as OpeningInput['jacksPerSide'] })}>
              <option value="auto">Auto</option>
              <option value="1">1</option>
              <option value="2">2</option>
            </select>
          )}
        </Field>
        {r.ok && (
          <dl className="derived full">
            <div>
              <dt>Rough opening</dt>
              <dd>
                {fmt(r.roWidth)} × {fmt(r.roHeight)}
              </dd>
            </div>
            {o.type === 'window' && (
              <div>
                <dt>Sill</dt>
                <dd>{fmt(r.sill)}</dd>
              </div>
            )}
            <div>
              <dt>From left</dt>
              <dd>{fmt(r.x)}</dd>
            </div>
          </dl>
        )}
      </div>
    </div>
  );
}
