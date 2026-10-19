import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react';
import { computeFraming, mergeCutLists, sumStats } from './lib/framing';
import { makeFormatter, type Formatter } from './lib/units';
import { toWallSpec, type WallAction, type WallInput } from './state/wall';
import { loadSaved, projectReducer, saveProject, type DisplayPrefs } from './state/project';
import { parseProjectText, projectToText } from './state/wallText';
import { BrandMark } from './components/BrandMark';
import { Segmented } from './components/controls';
import { Overview, type OverviewTab, type WallResult } from './components/Overview';
import { WallEditor } from './components/WallEditor';
import { useRoute } from './useRoute';

const initial = loadSaved();

function frameWall(wall: WallInput, fmt: Formatter): WallResult {
  const { spec, inputIssues } = toWallSpec(wall);
  const result = computeFraming(spec, fmt);
  const issues = result.ok ? [...inputIssues, ...result.issues] : [{ level: 'error' as const, message: result.message }, ...inputIssues];
  return { wall, result, issues };
}

export default function App() {
  const [project, dispatch] = useReducer(projectReducer, initial.project);
  const [prefs, setPrefs] = useState<DisplayPrefs>(initial.prefs);
  const [overviewTab, setOverviewTab] = useState<OverviewTab>('walls');
  const [highlight, setHighlight] = useState<string | null>(null);
  const [route, go] = useRoute();
  const setPref = <K extends keyof DisplayPrefs>(key: K, value: DisplayPrefs[K]) => setPrefs((p) => ({ ...p, [key]: value }));

  useEffect(() => saveProject(project, prefs), [project, prefs]);

  // The wall being edited is the project's selected wall; a wall that no longer exists goes back to the overview.
  const editing = route.screen === 'wall' && route.index >= 0 && route.index < project.walls.length ? route.index : null;
  useEffect(() => {
    if (route.screen === 'wall' && editing === null) go({ screen: 'overview' }, true);
    else if (editing !== null && editing !== project.selected) dispatch({ type: 'selectWall', index: editing });
  }, [route, editing, project.selected, go]);
  const wallDispatch = useCallback((action: WallAction) => dispatch({ type: 'wall', action }), []);

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
  const results = useMemo(() => project.walls.map((w) => frameWall(w, fmt)), [project.walls, fmt]);
  const framed = results.flatMap((r) => (r.result.ok ? [r.result] : []));
  const rows = useMemo(() => mergeCutLists(framed.map((f) => f.cutList)), [framed]);
  const stats = useMemo(() => sumStats(framed.map((f) => f.stats)), [framed]);
  const allIssues = useMemo(() => results.flatMap((r) => r.issues.map((i) => ({ ...i, message: `${r.wall.name}: ${i.message}` }))), [results]);
  const fileName = `${(project.title || 'walls').replace(/[^\w-]+/g, '-').replace(/^-|-$/g, '').toLowerCase() || 'walls'}.wall.md`;

  const addWall = () => {
    dispatch({ type: 'addWall' });
    go({ screen: 'wall', index: project.walls.length });
  };
  const deleteWall = (index: number) => {
    dispatch({ type: 'removeWall', index });
    go({ screen: 'overview' }, true);
  };

  return (
    <>
      <header className="app-header">
        <a
          className="brand"
          href="#"
          onClick={(e) => {
            e.preventDefault();
            go({ screen: 'overview' });
          }}
        >
          <BrandMark />
          <div>
            <div className="brand-name">Wall Framing Planner</div>
            <div className="brand-sub">{project.title || '2x6 framing · 1 1/2" × 5 1/2" actual'}</div>
          </div>
        </a>
        <div className="header-actions">
          <Segmented bare label="Show lengths in" value={prefs.units} options={[['in', 'Inches'], ['ftin', 'Ft-in']]} onChange={(v) => setPref('units', v)} />
          <button
            className="btn"
            type="button"
            onClick={() => {
              dispatch({ type: 'reset' });
              go({ screen: 'overview' });
            }}
          >
            Load example
          </button>
        </div>
      </header>

      {editing === null ? (
        <Overview
          title={project.title}
          results={results}
          tab={overviewTab}
          onTab={setOverviewTab}
          onAddWall={addWall}
          fmt={fmt}
          rows={rows}
          stats={stats}
          issues={allIssues}
          highlight={highlight}
          onHighlight={setHighlight}
          text={text}
          textErrors={textResult.errors}
          onText={onText}
          fileName={fileName}
        />
      ) : (
        <WallEditor
          key={project.walls[editing]!.id}
          index={editing}
          count={project.walls.length}
          current={results[editing]!}
          dispatch={wallDispatch}
          onBack={() => go({ screen: 'overview' })}
          onDelete={() => deleteWall(editing)}
          prefs={prefs}
          setPref={setPref}
          fmt={fmt}
          highlight={highlight}
          onHighlight={setHighlight}
        />
      )}
    </>
  );
}
