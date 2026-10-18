import { ROLES, type Framing, type Issue, type Role } from '../lib/framing';
import type { Formatter } from '../lib/units';

/** CSS swatch token for a role (top plates share the plate color, both cripple kinds share one). */
export const swatchVar = (role: Role) => {
  const name = role === 'topPlate' ? 'plate' : role === 'crippleTop' || role === 'crippleBottom' ? 'cripple' : role;
  return `var(--w-${name})`;
};

const LEGEND: [string, Role][] = [
  ['Plate', 'plate'],
  ['Stud', 'stud'],
  ['King stud', 'king'],
  ['Jack / trimmer', 'jack'],
  ['Header', 'header'],
  ['Rough sill', 'sill'],
  ['Cripple', 'crippleTop'],
  ['Filler', 'filler'],
];

export function Legend() {
  return (
    <div className="legend">
      {LEGEND.map(([name, role]) => (
        <span key={role}>
          <i className="sw" style={{ background: swatchVar(role) }} />
          {name}
        </span>
      ))}
    </div>
  );
}

export function TitleBlock({ framing, name, fmt }: { framing: Framing; name: string; fmt: Formatter }) {
  const { wall } = framing;
  const cells: [string, string][] = [
    ['Wall', name || '—'],
    ['Length', fmt(wall.length)],
    ['Height', fmt(wall.height)],
    ['Stud length', fmt(framing.studLength)],
    ['Spacing', `${wall.spacing}" O.C.`],
    ['Plates', `1 bottom · ${wall.topPlates} top`],
    ['Openings', String(framing.openings.length)],
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
  framing: Framing | null;
  fmt: Formatter;
  highlight: string | null;
  onHighlight: (group: string | null) => void;
}

export function CutList({ framing, fmt, highlight, onHighlight }: CutListProps) {
  const stats = framing?.stats;
  return (
    <section className="panel" aria-labelledby="cut-h">
      <div className="panel-head">
        <h2 className="eyebrow" id="cut-h">
          Cut list
        </h2>
      </div>
      {framing && stats && (
        <>
          <div className="stats">
            <Stat n={stats.fullStuds} label={`full-length studs @ ${fmt(framing.studLength)}`} />
            <Stat n={stats.jacks} label="jacks" />
            <Stat n={stats.cripples} label="cripples" />
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
                {framing.cutList.map((g) => (
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
                    <td className="note">{g.notes.join('. ')}</td>
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
        Header sizes picked on Auto are a rule-of-thumb starting point for a bearing wall. Confirm every header against IRC
        Table R602.7 or your engineer's schedule before cutting.
      </p>
    </section>
  );
}
