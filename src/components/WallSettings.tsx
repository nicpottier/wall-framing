import type { Dispatch } from 'react';
import type { WallAction, WallInput, WallSettingKey } from '../state/wall';
import { Field, LengthInput, Segmented } from './controls';

const HEIGHT_PRESETS = [
  ["8'", '97 1/8'],
  ["9'", '109 1/8'],
  ["10'", '121 1/8'],
] as const;

const SPACINGS = ['12', '16', '19.2', '24'] as const;

export function WallSettings({ wall, dispatch }: { wall: WallInput; dispatch: Dispatch<WallAction> }) {
  const set = (key: WallSettingKey) => (value: string) => dispatch({ type: 'set', key, value });

  return (
    <section className="panel" aria-labelledby="wall-h">
      <div className="panel-head">
        <h2 className="eyebrow" id="wall-h">
          Wall
        </h2>
      </div>
      <div className="fields">
        <Field label="Wall name" full>
          {(id) => (
            <input id={id} type="text" className="plain" autoComplete="off" value={wall.name} onChange={(e) => set('name')(e.target.value)} />
          )}
        </Field>
        <Field label="Wall length" hint={`e.g. 20' or 240 or 12'-6 1/2"`}>
          {(id) => <LengthInput id={id} value={wall.length} onChange={set('length')} />}
        </Field>
        <Field label="Wall height" hint="Floor to top of top plate">
          {(id) => <LengthInput id={id} value={wall.height} onChange={set('height')} />}
        </Field>
        <div className="field full">
          <div className="chips" aria-label="Common wall heights">
            {HEIGHT_PRESETS.map(([name, h]) => (
              <button key={h} className="chip" type="button" onClick={() => set('height')(h)}>
                {name} · {h}"
              </button>
            ))}
          </div>
        </div>
        <Field label="Stud spacing">
          {(id) => (
            <select id={id} value={wall.spacing} onChange={(e) => set('spacing')(e.target.value)}>
              {SPACINGS.map((s) => (
                <option key={s} value={s}>
                  {s}" O.C.
                </option>
              ))}
            </select>
          )}
        </Field>
        <Segmented label="Layout from" value={wall.layoutFrom} options={[['left', 'Left'], ['right', 'Right']]} onChange={set('layoutFrom')} />
        <Segmented label="Top plate" value={wall.topPlates} options={[['1', 'Single'], ['2', 'Double']]} onChange={set('topPlates')} />
        <Segmented label="Header plies" value={wall.headerPlies} options={[['2', '2 + foam'], ['3', '3']]} onChange={set('headerPlies')} />
        <Segmented label="Rough sill" value={wall.sillPlies} options={[['1', 'Single'], ['2', 'Double']]} onChange={set('sillPlies')} />
        <Segmented label="Show lengths in" value={wall.units} options={[['in', 'Inches'], ['ftin', 'Ft-in']]} onChange={set('units')} />
      </div>
    </section>
  );
}

/** Wall-wide rules for sizing rough openings from window and door unit sizes. */
export function RoughOpeningSettings({ wall, dispatch }: { wall: WallInput; dispatch: Dispatch<WallAction> }) {
  const set = (key: WallSettingKey) => (value: string) => dispatch({ type: 'set', key, value });

  return (
    <section className="panel" aria-labelledby="ro-h">
      <div className="panel-head">
        <h2 className="eyebrow" id="ro-h">
          Rough openings
        </h2>
      </div>
      <div className="fields">
        <Field label="Window head height" hint="Floor to top of R.O. Each window can override it." full>
          {(id) => <LengthInput id={id} value={wall.windowHeadHeight} onChange={set('windowHeadHeight')} />}
        </Field>
        <p className="field-group full">Added to the unit size to get the rough opening</p>
        <Field label="Window, width +">
          {(id) => <LengthInput id={id} value={wall.windowRoWidth} onChange={set('windowRoWidth')} />}
        </Field>
        <Field label="Window, height +">
          {(id) => <LengthInput id={id} value={wall.windowRoHeight} onChange={set('windowRoHeight')} />}
        </Field>
        <Field label="Door, width +">
          {(id) => <LengthInput id={id} value={wall.doorRoWidth} onChange={set('doorRoWidth')} />}
        </Field>
        <Field label="Door, height +">
          {(id) => <LengthInput id={id} value={wall.doorRoHeight} onChange={set('doorRoHeight')} />}
        </Field>
      </div>
    </section>
  );
}
