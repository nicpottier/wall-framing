import type { Dispatch } from 'react';
import type { WallAction, WallInput, WallSettingKey } from '../state/wall';
import { Field, LengthInput, Panel, Segmented } from './controls';

const HEIGHT_PRESETS = [
  ["8'", '97 1/8'],
  ["9'", '109 1/8'],
  ["10'", '121 1/8'],
] as const;

const SPACINGS = ['12', '16', '19.2', '24'] as const;

interface Props {
  wall: WallInput;
  dispatch: Dispatch<WallAction>;
}

const setter = (dispatch: Dispatch<WallAction>) => (key: WallSettingKey) => (value: string) =>
  dispatch({ type: 'set', key, value });

export function WallSettings({ wall, dispatch }: Props) {
  const set = setter(dispatch);

  return (
    <Panel title="Wall" tone="wall">
      <div className="fields">
        <Field label="Name" full>
          {(id) => (
            <input id={id} type="text" className="plain" autoComplete="off" value={wall.name} onChange={(e) => set('name')(e.target.value)} />
          )}
        </Field>
        <Field label="Length" hint={`20' · 240 · 12'-6 1/2"`}>
          {(id) => <LengthInput id={id} value={wall.length} onChange={set('length')} />}
        </Field>
        <div className="field">
          <label htmlFor="wall-height">Height</label>
          <LengthInput id="wall-height" value={wall.height} onChange={set('height')} />
          <span className="chips" aria-label="Common wall heights to the top of the top plate">
              {HEIGHT_PRESETS.map(([name, h]) => (
                <button
                  key={h}
                  className="chip"
                  type="button"
                  aria-pressed={wall.height === h}
                  title={`${name} wall: ${h}" to the top of the top plate`}
                  onClick={() => set('height')(h)}
                >
                  {name}
                </button>
              ))}
          </span>
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
        <Segmented label="Exterior wall" value={wall.exterior} options={[['yes', 'Yes'], ['no', 'No']]} onChange={set('exterior')} />
      </div>
    </Panel>
  );
}

const CORNERS = [
  ['none', 'No corner'],
  ['outside', 'Outside (runs past)'],
  ['inside', 'Inside (butts in)'],
] as const;

/** 4x8 sheathing: panel direction, thickness, corner offsets and seam framing. */
export function SheathingSettings({ wall, dispatch }: Props) {
  const set = setter(dispatch);
  const corner = (key: 'cornerLeft' | 'cornerRight', label: string) => (
    <Field label={label}>
      {(id) => (
        <select id={id} value={wall[key]} onChange={(e) => set(key)(e.target.value)}>
          {CORNERS.map(([v, t]) => (
            <option key={v} value={v}>
              {t}
            </option>
          ))}
        </select>
      )}
    </Field>
  );
  const summary = [
    wall.sheathingOrientation === 'vertical' ? 'Vertical' : 'Horizontal',
    `${wall.sheathingThickness}" thick`,
    `starts ${wall.sheathingStart}"`,
    `${wall.seamStuds} seam studs`,
  ].join(' · ');

  return (
    <Panel title="Sheathing · 4x8" summary={summary} collapsible tone="sheathing">
      <div className="fields">
        <Segmented
          label="Panels run"
          value={wall.sheathingOrientation}
          options={[['vertical', 'Vertical'], ['horizontal', 'Horizontal']]}
          onChange={set('sheathingOrientation')}
        />
        <Field label="Thickness" hint={`ZIP R-9 ≈ 2"`}>
          {(id) => <LengthInput id={id} value={wall.sheathingThickness} onChange={set('sheathingThickness')} />}
        </Field>
        <Field label="Start height" hint="Floor to bottom of first full panel">
          {(id) => <LengthInput id={id} value={wall.sheathingStart} onChange={set('sheathingStart')} />}
        </Field>
        <Segmented label="Seam studs" value={wall.seamStuds} options={[['single', 'Single'], ['double', 'Double']]} onChange={set('seamStuds')} />
        {corner('cornerLeft', 'Left end corner')}
        {corner('cornerRight', 'Right end corner')}
        <p className="field-note full">
          Seen from inside. Outside adds the sheathing thickness; inside adds the wall depth plus sheathing. Layout and
          sheathing start at the {wall.layoutFrom} end.
        </p>
        <Segmented label="Block horizontal seams" value={wall.blockSeams} options={[['yes', 'Yes'], ['no', 'No']]} onChange={set('blockSeams')} />
      </div>
    </Panel>
  );
}
