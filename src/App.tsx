import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react';
import { computeFraming } from './lib/framing';
import { makeFormatter } from './lib/units';
import { toWallSpec, type WallAction } from './state/wall';
import { currentWall, loadSaved, projectReducer, saveProject, type DisplayPrefs } from './state/project';
import { parseProjectText, projectToText } from './state/wallText';
import { Elevation } from './components/Elevation';
import { SheathingSettings, WallSettings } from './components/WallSettings';
import { OpeningsEditor } from './components/OpeningsEditor';
import { Checks, CutList, Legend, TitleBlock } from './components/Report';
import { BrandMark } from './components/BrandMark';
import { Segmented } from './components/controls';
import { TextEditor } from './components/TextEditor';
import { WallPicker } from './components/WallPicker';

const initial = loadSaved();

export default function App() {
  const [project, dispatch] = useReducer(projectReducer, initial.project);
  const [prefs, setPrefs] = useState<DisplayPrefs>(initial.prefs);
  const [tab, setTab] = useState<'form' | 'text'>('form');
  const [highlight, setHighlight] = useState<string | null>(null);
  const wall = currentWall(project);
  const wallDispatch = useCallback((action: WallAction) => dispatch({ type: 'wall', action }), []);
  const setPref = <K extends keyof DisplayPrefs>(key: K, value: DisplayPrefs[K]) => setPrefs((p) => ({ ...p, [key]: value }));

  useEffect(() => saveProject(project, prefs), [project, prefs]);

  // The text keeps what was typed; the form's changes rewrite it. Text that reads cleanly updates the project.
  const [text, setText] = useState(() => projectToText(project));
  const written = useRef(text);
  useEffect(() => {
    const t = projectToText(project);
    if (t !== written.current) {
      written.current = t;
      setText(t);
    }
  }, [project]);
  const textResult = useMemo(() => parseProjectText(text), [text]);
  const onText = (next: string) => {
    setText(next);
    const r = parseProjectText(next);
    if (r.project) {
      written.current = projectToText(r.project);
      dispatch({ type: 'replace', project: r.project });
    }
  };

  const fmt = useMemo(() => makeFormatter(prefs.units), [prefs.units]);
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

  const showSheathing = prefs.showSheathing === 'on';
  const fileName = `${(project.title || 'walls').replace(/[^\w-]+/g, '-').replace(/^-|-$/g, '').toLowerCase() || 'walls'}.wall.md`;

  return (
    <>
      <header className="app-header">
        <div className="brand">
          <BrandMark />
          <div>
            <div className="brand-name">Wall Framing Planner</div>
            <div className="brand-sub">{project.title || '2x6 framing · 1 1/2" × 5 1/2" actual'}</div>
          </div>
        </div>
        <div className="header-actions">
          <Segmented bare label="Show lengths in" value={prefs.units} options={[['in', 'Inches'], ['ftin', 'Ft-in']]} onChange={(v) => setPref('units', v)} />
          <button className="btn" type="button" onClick={() => dispatch({ type: 'reset' })}>
            Load example
          </button>
        </div>
      </header>

      <div className={`layout${tab === 'text' ? ' wide-rail' : ''}`}>
        <aside className="rail">
          <div className="rail-top">
            <Segmented bare label="Edit with" value={tab} options={[['form', 'Form'], ['text', 'Text']]} onChange={setTab} />
            {tab === 'form' && <WallPicker project={project} dispatch={dispatch} />}
          </div>
          {tab === 'form' ? (
            <>
              <WallSettings wall={wall} dispatch={wallDispatch} />
              <OpeningsEditor wall={wall} errorIds={errorIds} fmt={fmt} dispatch={wallDispatch} />
              <SheathingSettings wall={wall} dispatch={wallDispatch} />
            </>
          ) : (
            <TextEditor text={text} errors={textResult.errors} onChange={onText} fileName={fileName} />
          )}
        </aside>

        <main className="main">
          <section className="sheet" aria-labelledby="sheet-title">
            <div className="sheet-head">
              <div className="sheet-title">
                <h1 id="sheet-title">{wall.name || 'Wall elevation'}</h1>
                <span className="sub">
                  {prefs.view === 'deck'
                    ? 'On the deck, sheathing side up · bottom plate at the deck edge'
                    : `From inside · 2x6 @ ${wall.spacing}" O.C. · not to scale`}
                </span>
              </div>
              <div className="sheet-tools">
                {project.walls.length > 1 && tab === 'text' && <WallPicker project={project} dispatch={dispatch} />}
                <button className="toggle" type="button" aria-pressed={showSheathing} onClick={() => setPref('showSheathing', showSheathing ? 'off' : 'on')}>
                  <i className="sw-line" /> Sheathing
                </button>
                <Segmented bare label="View" value={prefs.view} options={[['standing', 'Standing'], ['deck', 'On the deck']]} onChange={(v) => setPref('view', v)} />
              </div>
            </div>
            {framing ? (
              <>
                <Elevation framing={framing} fmt={fmt} highlight={highlight} onHighlight={setHighlight} showSheathing={showSheathing} view={prefs.view} />
                <div className="sheet-hint">Hover a member to see its size and length.</div>
                <Legend showSheathing={showSheathing} />
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
