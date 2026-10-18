import type { Dispatch } from 'react';
import { HEADER_SIZES } from '../lib/lumber';
import type { OpeningInput, WallAction } from '../state/wall';
import { Field, LengthInput, Segmented } from './controls';

interface Props {
  openings: OpeningInput[];
  errorIds: Set<string>;
  dispatch: Dispatch<WallAction>;
}

export function OpeningsEditor({ openings, errorIds, dispatch }: Props) {
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
        {openings.length === 0 && <p className="empty">No openings yet. Add a window or door to frame it in.</p>}
        {openings.map((o) => (
          <OpeningCard key={o.id} opening={o} hasError={errorIds.has(o.id)} dispatch={dispatch} />
        ))}
      </div>
    </section>
  );
}

function OpeningCard({ opening: o, hasError, dispatch }: { opening: OpeningInput; hasError: boolean; dispatch: Dispatch<WallAction> }) {
  const patch = (p: Partial<OpeningInput>) => dispatch({ type: 'updateOpening', id: o.id, patch: p });
  const len = (key: 'x' | 'width' | 'height' | 'sill') => (value: string) => patch({ [key]: value });

  return (
    <div className={`op${hasError ? ' has-err' : ''}`} data-type={o.type}>
      <div className="op-head">
        <span className="op-tag">{o.label || '?'}</span>
        <Segmented
          bare
          label="Opening type"
          value={o.type}
          options={[['window', 'Window'], ['door', 'Door']]}
          onChange={(kind) => dispatch({ type: 'setOpeningType', id: o.id, kind })}
        />
        <button className="icon-btn" type="button" aria-label={`Remove ${o.label}`} onClick={() => dispatch({ type: 'removeOpening', id: o.id })}>
          ×
        </button>
      </div>
      <div className="fields">
        <Field label="Label">
          {(id) => <input id={id} type="text" className="plain" autoComplete="off" value={o.label} onChange={(e) => patch({ label: e.target.value })} />}
        </Field>
        <Field label="Left end to R.O.">{(id) => <LengthInput id={id} value={o.x} onChange={len('x')} />}</Field>
        <Field label="R.O. width">{(id) => <LengthInput id={id} value={o.width} onChange={len('width')} />}</Field>
        <Field label="R.O. height">{(id) => <LengthInput id={id} value={o.height} onChange={len('height')} />}</Field>
        {o.type === 'window' && (
          <Field label="Floor to R.O. sill">{(id) => <LengthInput id={id} value={o.sill} onChange={len('sill')} />}</Field>
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
      </div>
    </div>
  );
}
