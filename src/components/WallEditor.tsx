import { useMemo, useState, type Dispatch } from 'react';
import type { Formatter } from '../lib/units';
import type { DisplayPrefs } from '../state/project';
import type { WallAction } from '../state/wall';
import { wallHref } from '../useRoute';
import { Elevation } from './Elevation';
import type { WallResult } from './Overview';
import { OpeningsEditor } from './OpeningsEditor';
import { Checks, CutList, Legend, TitleBlock } from './Report';
import { Segmented } from './controls';
import { StructureEditor } from './StructureEditor';
import { SheathingSettings, WallSettings } from './WallSettings';

interface Props {
  index: number;
  count: number;
  current: WallResult;
  dispatch: Dispatch<WallAction>;
  onBack: () => void;
  onDelete: () => void;
  prefs: DisplayPrefs;
  setPref: <K extends keyof DisplayPrefs>(key: K, value: DisplayPrefs[K]) => void;
  fmt: Formatter;
  highlight: string | null;
  onHighlight: (group: string | null) => void;
}

/** Form, drawing, cut list and checks for one wall, with a way back to the overview. */
export function WallEditor({ index, count, current, dispatch, onBack, onDelete, prefs, setPref, fmt, highlight, onHighlight }: Props) {
  const { wall, result, issues } = current;
  const framing = result.ok ? result : null;
  const [confirmDelete, setConfirmDelete] = useState(false);
  const showSheathing = prefs.showSheathing === 'on';

  const errorIds = useMemo(() => {
    const ids = new Set(issues.filter((i) => i.level === 'error' && i.openingId).map((i) => i.openingId!));
    framing?.openings.forEach((o) => o.hasError && ids.add(o.spec.id));
    framing?.posts.forEach((p) => p.hasError && ids.add(p.spec.id));
    return ids;
  }, [issues, framing]);

  return (
    <>
      <nav className="editor-nav" aria-label="Walls">
        <a
          className="btn back"
          href="#"
          onClick={(e) => {
            e.preventDefault();
            onBack();
          }}
        >
          ← All walls
        </a>
        <span className="editor-nav-pos">
          <a className="btn icon" href={wallHref(index - 1)} aria-disabled={index === 0} tabIndex={index === 0 ? -1 : undefined} aria-label="Previous wall">
            ‹
          </a>
          Wall {index + 1} of {count}
          <a
            className="btn icon"
            href={wallHref(index + 1)}
            aria-disabled={index === count - 1}
            tabIndex={index === count - 1 ? -1 : undefined}
            aria-label="Next wall"
          >
            ›
          </a>
        </span>
        <span className="editor-nav-end">
          {confirmDelete ? (
            <>
              <span className="confirm-text">Delete {wall.name || 'this wall'}?</span>
              <button className="btn danger" type="button" onClick={onDelete}>
                Delete
              </button>
              <button className="btn" type="button" onClick={() => setConfirmDelete(false)}>
                Keep
              </button>
            </>
          ) : (
            <button className="btn" type="button" disabled={count <= 1} onClick={() => setConfirmDelete(true)}>
              Delete wall
            </button>
          )}
        </span>
      </nav>

      <div className="layout">
        <aside className="rail">
          <WallSettings wall={wall} dispatch={dispatch} />
          <OpeningsEditor wall={wall} errorIds={errorIds} fmt={fmt} dispatch={dispatch} />
          <StructureEditor wall={wall} errorIds={errorIds} fmt={fmt} dispatch={dispatch} />
          <SheathingSettings wall={wall} dispatch={dispatch} />
        </aside>

        <main className="main">
          <section className="sheet" aria-labelledby="sheet-title">
            <div className="sheet-head">
              <div className="sheet-title">
                <h1 id="sheet-title">{wall.name || 'Wall elevation'}</h1>
                <span className="sub">
                  {prefs.view === 'deck'
                    ? 'On the deck, sheathing side up · bottom plate at the deck edge'
                    : `${wall.sheathed === 'yes' ? 'From inside' : 'From the south or west side'} · ${wall.studSize} @ ${wall.spacing}" O.C. · not to scale`}
                </span>
              </div>
              <div className="sheet-tools">
                <button className="toggle" type="button" aria-pressed={showSheathing} onClick={() => setPref('showSheathing', showSheathing ? 'off' : 'on')}>
                  <i className="sw-line" /> Sheathing
                </button>
                <Segmented bare label="View" value={prefs.view} options={[['standing', 'Standing'], ['deck', 'On the deck']]} onChange={(v) => setPref('view', v)} />
              </div>
            </div>
            {framing ? (
              <>
                <Elevation framing={framing} fmt={fmt} highlight={highlight} onHighlight={onHighlight} showSheathing={showSheathing} view={prefs.view} />
                <div className="sheet-hint">Hover a member to see its size and length.</div>
                <Legend showSheathing={showSheathing && framing.wall.sheathing.enabled !== false} framing={framing} />
                <TitleBlock framing={framing} name={wall.name} fmt={fmt} />
              </>
            ) : (
              <div className="fatal">{!result.ok && result.message}</div>
            )}
          </section>

          <div className="lower">
            <CutList
              rows={framing?.cutList ?? null}
              stats={framing?.stats ?? null}
              studLength={framing?.studLength}
              fmt={fmt}
              highlight={highlight}
              onHighlight={onHighlight}
            />
            <Checks issues={issues} />
          </div>
        </main>
      </div>
    </>
  );
}
