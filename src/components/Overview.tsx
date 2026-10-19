import type { CutGroup, Framing, FramingFailure, FramingStats, Issue } from '../lib/framing';
import type { Formatter } from '../lib/units';
import type { WallInput } from '../state/wall';
import type { TextError } from '../state/wallText';
import { wallHref } from '../useRoute';
import { Segmented } from './controls';
import { Checks, CutList } from './Report';
import { TextEditor } from './TextEditor';
import { WallCard } from './WallCard';

export type OverviewTab = 'walls' | 'cuts' | 'text';

export interface WallResult {
  wall: WallInput;
  result: Framing | FramingFailure;
  issues: Issue[];
}

interface Props {
  title: string;
  results: WallResult[];
  tab: OverviewTab;
  onTab: (tab: OverviewTab) => void;
  onAddWall: () => void;
  fmt: Formatter;
  /** Combined cut list and checks for the Cut list tab. */
  rows: CutGroup[];
  stats: FramingStats;
  issues: Issue[];
  highlight: string | null;
  onHighlight: (group: string | null) => void;
  /** The project as text, for the Text tab. */
  text: string;
  textErrors: TextError[];
  onText: (text: string) => void;
  fileName: string;
}

const CARD_MAX_HEIGHT = 200;

/** Every wall in the project at a glance; each card opens that wall's editor. */
export function Overview(props: Props) {
  const { title, results, tab, onTab, onAddWall, fmt } = props;
  const framed = results.flatMap((r) => (r.result.ok ? [r.result] : []));
  const fit = {
    length: Math.max(24, ...framed.map((f) => f.wall.length)),
    height: Math.max(48, ...framed.map((f) => f.wall.height)),
    maxHeight: CARD_MAX_HEIGHT,
  };
  const problems = results.reduce((n, r) => n + r.issues.filter((i) => i.level === 'error').length, 0);

  const cards = (
    <div className="wall-grid">
      {results.map((r, i) => (
        <WallCard key={r.wall.id} wall={r.wall} result={r.result} issues={r.issues} href={wallHref(i)} fmt={fmt} fit={fit} />
      ))}
      <button type="button" className="wall-card add" onClick={onAddWall}>
        <span className="add-plus" aria-hidden="true">
          +
        </span>
        Add wall
      </button>
    </div>
  );

  return (
    <div className="overview">
      <div className="overview-head">
        <div className="sheet-title">
          <h1>{title || 'Walls'}</h1>
          <span className="sub">
            {results.length} {results.length === 1 ? 'wall' : 'walls'} · {props.stats.pieces} pieces
            {problems > 0 && ` · ${problems} to fix`}
          </span>
        </div>
        <Segmented
          bare
          label="Overview"
          value={tab}
          options={[['walls', 'Walls'], ['cuts', 'Cut list'], ['text', 'Text']]}
          onChange={onTab}
        />
      </div>

      {tab === 'walls' && cards}

      {tab === 'cuts' && (
        <div className="lower">
          <CutList
            rows={props.rows}
            stats={props.stats}
            scope={`${framed.length} walls`}
            fmt={fmt}
            highlight={props.highlight}
            onHighlight={props.onHighlight}
          />
          <Checks issues={props.issues} />
        </div>
      )}

      {tab === 'text' && (
        <div className="overview-text">
          <TextEditor text={props.text} errors={props.textErrors} onChange={props.onText} fileName={props.fileName} />
          {cards}
        </div>
      )}
    </div>
  );
}
