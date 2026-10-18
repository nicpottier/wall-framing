import { useEffect, useMemo, useReducer, useState } from 'react';
import { computeFraming } from './lib/framing';
import { makeFormatter } from './lib/units';
import { loadWall, saveWall, toWallSpec, wallReducer } from './state/wall';
import { Elevation } from './components/Elevation';
import { RoughOpeningSettings, SheathingSettings, WallSettings } from './components/WallSettings';
import { OpeningsEditor } from './components/OpeningsEditor';
import { Checks, CutList, Legend, TitleBlock } from './components/Report';
import { BrandMark } from './components/BrandMark';
import { Segmented } from './components/controls';

export default function App() {
  const [wall, dispatch] = useReducer(wallReducer, undefined, loadWall);
  const [highlight, setHighlight] = useState<string | null>(null);

  useEffect(() => saveWall(wall), [wall]);

  const fmt = useMemo(() => makeFormatter(wall.units), [wall.units]);
  const { spec, inputIssues } = useMemo(() => toWallSpec(wall), [wall]);
  const result = useMemo(() => computeFraming(spec, fmt), [spec, fmt]);
  const framing = result.ok ? result : null;

  const issues = useMemo(
    () => (result.ok ? [...inputIssues, ...result.issues] : [{ level: 'error' as const, message: result.message }, ...inputIssues]),
    [result, inputIssues],
  );
  const errorIds = useMemo(() => {
    const ids = new Set(issues.filter((i) => i.level === 'error' && i.openingId).map((i) => i.openingId!));
    framing?.openings.forEach((o) => o.hasError && ids.add(o.spec.id));
    return ids;
  }, [issues, framing]);

  return (
    <>
      <header className="app-header">
        <div className="brand">
          <BrandMark />
          <div>
            <div className="brand-name">Wall Framing Planner</div>
            <div className="brand-sub">2x6 framing · 1 1/2" × 5 1/2" actual</div>
          </div>
        </div>
        <div className="header-actions">
          <Segmented
            bare
            label="Show lengths in"
            value={wall.units}
            options={[['in', 'Inches'], ['ftin', 'Ft-in']]}
            onChange={(value) => dispatch({ type: 'set', key: 'units', value })}
          />
          <button className="btn" type="button" onClick={() => dispatch({ type: 'reset' })}>
            Load example
          </button>
        </div>
      </header>

      <div className="layout">
        <aside className="rail">
          <WallSettings wall={wall} dispatch={dispatch} />
          <OpeningsEditor wall={wall} errorIds={errorIds} fmt={fmt} dispatch={dispatch} />
          <RoughOpeningSettings wall={wall} dispatch={dispatch} />
          <SheathingSettings wall={wall} dispatch={dispatch} />
        </aside>

        <main className="main">
          <section className="sheet" aria-labelledby="sheet-title">
            <div className="sheet-head">
              <div className="sheet-title">
                <h1 id="sheet-title">{wall.name || 'Wall elevation'}</h1>
                <span className="sub">
                  {wall.view === 'deck'
                    ? 'On the deck, sheathing side up · bottom plate at the deck edge'
                    : `From inside · 2x6 @ ${wall.spacing}" O.C. · not to scale`}
                </span>
              </div>
              <div className="sheet-tools">
                <button
                  className="toggle"
                  type="button"
                  aria-pressed={wall.showSheathing === 'on'}
                  onClick={() => dispatch({ type: 'set', key: 'showSheathing', value: wall.showSheathing === 'on' ? 'off' : 'on' })}
                >
                  <i className="sw-line" /> Sheathing
                </button>
                <Segmented
                  bare
                  label="View"
                  value={wall.view}
                  options={[['standing', 'Standing'], ['deck', 'On the deck']]}
                  onChange={(value) => dispatch({ type: 'set', key: 'view', value })}
                />
              </div>
            </div>
            {framing ? (
              <>
                <Elevation framing={framing} fmt={fmt} highlight={highlight} onHighlight={setHighlight} showSheathing={wall.showSheathing === 'on'} view={wall.view} />
                <div className="sheet-hint">Hover a member to see its size and length.</div>
                <Legend showSheathing={wall.showSheathing === 'on'} />
                <TitleBlock framing={framing} name={wall.name} fmt={fmt} />
              </>
            ) : (
              <div className="fatal">{!result.ok && result.message}</div>
            )}
          </section>

          <div className="lower">
            <CutList framing={framing} fmt={fmt} highlight={highlight} onHighlight={setHighlight} />
            <Checks issues={issues} />
          </div>
        </main>
      </div>
    </>
  );
}
