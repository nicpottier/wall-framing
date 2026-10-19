import { ROLES, type CutGroup, type Framing, type FramingStats, type Issue, type Role } from '../lib/framing';
import type { Formatter } from '../lib/units';

/** CSS swatch token for a role (top plates share the plate color, both cripple kinds share one). */
export const swatchVar = (role: Role) => {
  const name =
    role === 'topPlate'
      ? 'plate'
      : role === 'crippleTop' || role === 'crippleBottom'
        ? 'cripple'
        : role === 'headPlate'
          ? 'sill'
          : role === 'seamStud'
          ? 'seam'
          : role === 'blocking'
            ? 'block'
            : role === 'stepBlocking' || role === 'ladder'
              ? 'step'
              : role === 'cornerBacker' || role === 'partitionStud'
                ? 'backer'
                : role;
  return `var(--w-${name})`;
};

const LEGEND: [string, Role][] = [
  ['Plate', 'plate'],
  ['Stud', 'stud'],
  ['King stud', 'king'],
  ['Jack / trimmer', 'jack'],
  ['Header', 'header'],
  ['Sill / head plate', 'sill'],
  ['Cripple', 'crippleTop'],
  ['Filler', 'filler'],
  ['Seam stud', 'seamStud'],
  ['Blocking', 'blocking'],
];

/** Shown only on walls that have them. */
const EXTRA_LEGEND: [string, Role][] = [
  ['Post', 'post'],
  ['Corner / partition backer', 'cornerBacker'],
  ['Partition backer', 'partitionStud'],
  ['Ladder blocking', 'ladder'],
  ['Step blocking', 'stepBlocking'],
];

export function Legend({ showSheathing, framing }: { showSheathing: boolean; framing?: Framing }) {
  const has = (role: Role) => framing?.members.some((m) => m.role === role);
  // Corner and partition backers share a swatch; list it once.
  const extras = EXTRA_LEGEND.filter(([, role]) => has(role) && !(role === 'partitionStud' && has('cornerBacker'))).map(
    ([name, role]): [string, Role] => [role === 'cornerBacker' && !has('partitionStud') ? 'Corner backer' : name, role],
  );
  return (
    <div className="legend">
      {[...LEGEND, ...extras].map(([name, role]) => (
        <span key={role}>
          <i className="sw" style={{ background: swatchVar(role) }} />
          {name}
        </span>
      ))}
      {showSheathing && (
        <span>
          <i className="sw-line" />
          Sheathing seam
        </span>
      )}
      {framing?.steps.some((st) => st.blocking) && (
        <span>
          <i className="sw-strap" />
          CS16 strap
        </span>
      )}
    </div>
  );
}

export function TitleBlock({ framing, name, fmt }: { framing: Framing; name: string; fmt: Formatter }) {
  const { wall } = framing;
  const cells: [string, string][] = [
    ['Wall', name || '—'],
    ['Length', fmt(wall.length)],
    ['Height', framing.maxHeight > wall.height ? `${fmt(wall.height)} – ${fmt(framing.maxHeight)}` : fmt(wall.height)],
    ['Stud length', fmt(framing.studLength)],
    ['Studs', `${wall.studs ?? '2x6'} @ ${wall.spacing}" O.C.`],
    ['Plates', `1 bottom · ${wall.topPlates} top`],
    ['Openings', String(framing.openings.length)],
    ...(framing.posts.length ? [['Posts', String(framing.posts.length)] as [string, string]] : []),
    ...(framing.steps.length ? [['Plate steps', String(framing.steps.length)] as [string, string]] : []),
  ];
  return (
    <div className="titleblock">
      {cells.map(([k, v]) => (
        <div className="tb" key={k}>
          <span>{k}</span>
          <b>{v}</b>
        </div>
      ))}
    </div>
  );
}

interface CutListProps {
  /** Rows to list; null when the wall can't be framed. */
  rows: CutGroup[] | null;
  stats: FramingStats | null;
  /** Stud length for a single wall; left off when walls of different heights are combined. */
  studLength?: number;
  /** Shown beside the title, e.g. "10 walls". */
  scope?: string;
  fmt: Formatter;
  highlight: string | null;
  onHighlight: (group: string | null) => void;
}

export function CutList({ rows, stats, studLength, scope, fmt, highlight, onHighlight }: CutListProps) {
  return (
    <section className="panel" aria-labelledby="cut-h">
      <div className="panel-head">
        <span className="panel-title">
          <h2 className="eyebrow" id="cut-h">
            Cut list
          </h2>
          {scope && <span className="panel-summary">{scope}</span>}
        </span>
      </div>
      {rows && stats && (
        <>
          <div className="stats">
            <Stat n={stats.fullStuds} label={studLength ? `full-length studs @ ${fmt(studLength)}` : 'full-length studs'} />
            <Stat n={stats.jacks} label="jacks" />
            <Stat n={stats.cripples} label="cripples" />
            <Stat n={stats.blocks} label="blocks" />
            <Stat n={stats.headers} label={stats.headers === 1 ? 'header' : 'headers'} />
            <Stat n={Math.ceil(stats.linealFeet)} label="lineal ft of 2x" />
          </div>
          <div className="table-wrap">
            <table onMouseLeave={() => onHighlight(null)}>
              <thead>
                <tr>
                  <th>Member</th>
                  <th>Size</th>
                  <th className="num">Qty</th>
                  <th>Length</th>
                  <th>Notes</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((g, i) => (
                  <tr key={g.key} className={highlight === g.key ? 'hl' : undefined} onMouseEnter={() => onHighlight(g.key)}>
                    <td>
                      <span className="mname">
                        <i className="sw" style={{ background: swatchVar(g.role) }} />
                        {ROLES[g.role].name}
                      </span>
                    </td>
                    <td className="len">{g.size}</td>
                    <td className="num">{g.qty}</td>
                    <td className="len">{fmt(g.length)}</td>
                    <td className="note">{repeatsNote(rows, i) ? '' : g.notes.join('. ')}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <td>Total pieces</td>
                  <td />
                  <td className="num">{stats.pieces}</td>
                  <td />
                  <td />
                </tr>
              </tfoot>
            </table>
          </div>
        </>
      )}
    </section>
  );
}

/** True when a row has the same member and notes as the row above, so its note can be left off. */
function repeatsNote(rows: CutGroup[], i: number) {
  const prev = rows[i - 1];
  const row = rows[i]!;
  return !!prev && prev.role === row.role && prev.notes.join() === row.notes.join();
}

function Stat({ n, label }: { n: number; label: string }) {
  return (
    <span className="stat">
      <b>{n}</b>
      {label}
    </span>
  );
}

const LEVEL_ORDER = { error: 0, warning: 1, note: 2 } as const;
const LEVEL_NAME = { error: 'Fix', warning: 'Check', note: 'Note' } as const;

export function Checks({ issues }: { issues: Issue[] }) {
  const sorted = [...issues].sort((a, b) => LEVEL_ORDER[a.level] - LEVEL_ORDER[b.level]);
  return (
    <section className="panel" aria-labelledby="iss-h">
      <div className="panel-head">
        <h2 className="eyebrow" id="iss-h">
          Checks
        </h2>
      </div>
      {sorted.length ? (
        <ul className="issues">
          {sorted.map((i, k) => (
            <li className="issue" key={k}>
              <span className={`pill ${i.level}`}>{LEVEL_NAME[i.level]}</span>
              <span>{i.message}</span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="ok">No conflicts. Every opening clears the end studs, the top plate and its neighbours.</p>
      )}
      <p className="fineprint">
        Headers follow the Buckley-Watanabe structural plans (Harezlak Engineering, Rev. 1, 05/22/26): 4x8 typical per
        plan note 3, larger sizes from the beam schedule, and trimmers, head plates, A35 clips and MSTA24 straps per
        10/S4.1. Pick the larger size for any opening the plans call out.
      </p>
    </section>
  );
}
