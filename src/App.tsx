import { useEffect, useMemo, useReducer, useState } from 'react';
import { computeFraming } from './lib/framing';
import { makeFormatter } from './lib/units';
import { loadWall, saveWall, toWallSpec, wallReducer } from './state/wall';
import { Elevation } from './components/Elevation';
import { RoughOpeningSettings, SheathingSettings, WallSettings } from './components/WallSettings';
import { OpeningsEditor } from './components/OpeningsEditor';
import { Checks, CutList, Legend, TitleBlock } from './components/Report';
import { BrandMark } from './components/BrandMark';

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
        <button className="btn" type="button" onClick={() => dispatch({ type: 'reset' })}>
          Load example wall
        </button>
      </header>

      <div className="layout">
        <aside className="rail">
          <WallSettings wall={wall} dispatch={dispatch} />
          <SheathingSettings wall={wall} dispatch={dispatch} />
          <RoughOpeningSettings wall={wall} dispatch={dispatch} />
          <OpeningsEditor wall={wall} errorIds={errorIds} fmt={fmt} dispatch={dispatch} />
        </aside>

        <main className="main">
          <section className="sheet" aria-labelledby="sheet-title">
            <div className="sheet-head">
              <h1 id="sheet-title">{wall.name || 'Wall elevation'}</h1>
              <span className="sub">2x6 @ {wall.spacing}" O.C. · elevation, not to scale</span>
            </div>
            {framing ? (
              <>
                <Elevation framing={framing} fmt={fmt} highlight={highlight} onHighlight={setHighlight} showSheathing={wall.showSheathing === 'on'} />
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
