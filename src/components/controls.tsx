import { useId, type ReactNode } from 'react';
import { parseLength } from '../lib/units';

interface FieldProps {
  label: string;
  hint?: string;
  full?: boolean;
  children: (id: string) => ReactNode;
}

export function Field({ label, hint, full, children }: FieldProps) {
  const id = useId();
  return (
    <div className={`field${full ? ' full' : ''}`}>
      <label htmlFor={id}>{label}</label>
      {children(id)}
      {hint && <span className="hint">{hint}</span>}
    </div>
  );
}

interface LengthInputProps {
  id: string;
  value: string;
  onChange: (value: string) => void;
  /** Blank is allowed (the placeholder shows the value that applies instead). */
  optional?: boolean;
  placeholder?: string;
}

/** Text input for tape-measure lengths; flags text that can't be read. */
export function LengthInput({ id, value, onChange, optional, placeholder }: LengthInputProps) {
  const invalid = !(optional && !value.trim()) && !Number.isFinite(parseLength(value));
  return (
    <input
      id={id}
      type="text"
      inputMode="decimal"
      autoComplete="off"
      className={invalid ? 'invalid' : undefined}
      aria-invalid={invalid}
      value={value}
      placeholder={placeholder}
      onChange={(e) => onChange(e.target.value)}
    />
  );
}

interface SegmentedProps<V extends string> {
  label: string;
  value: V;
  options: readonly (readonly [V, string])[];
  onChange: (value: V) => void;
  /** Render without the field wrapper and label. */
  bare?: boolean;
  /** Span the full row of a fields grid. */
  full?: boolean;
}

export function Segmented<V extends string>({ label, value, options, onChange, bare, full }: SegmentedProps<V>) {
  const group = (
    <div className="seg" role="group" aria-label={label}>
      {options.map(([v, text]) => (
        <button key={v} type="button" aria-pressed={v === value} onClick={() => onChange(v)}>
          {text}
        </button>
      ))}
    </div>
  );
  if (bare) return group;
  return (
    <div className={`field${full ? ' full' : ''}`}>
      <span className="lbl">{label}</span>
      {group}
    </div>
  );
}

/** Open/closed marker for collapsible sections; CSS turns it when open. */
export function Chevron() {
  return (
    <svg className="chev" width="12" height="12" viewBox="0 0 12 12" aria-hidden="true">
      <path d="M3 4.5 6 7.5 9 4.5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

interface PanelProps {
  title: string;
  /** Shown beside the title, mainly so a closed panel still says what's set. */
  summary?: ReactNode;
  /** Buttons on the right of the header. */
  actions?: ReactNode;
  /** Render as a closable section that starts closed. */
  collapsible?: boolean;
  /** Section color. */
  tone?: 'wall' | 'openings' | 'sheathing' | 'structure';
  children: ReactNode;
}

export function Panel({ title, summary, actions, collapsible, tone, children }: PanelProps) {
  const id = useId();
  if (collapsible) {
    return (
      <details className="panel collapsible" data-tone={tone}>
        <summary className="panel-head">
          <span className="panel-title">
            <h2 className="eyebrow">{title}</h2>
            {summary && <span className="panel-summary">{summary}</span>}
          </span>
          <Chevron />
        </summary>
        {children}
      </details>
    );
  }
  return (
    <section className="panel" data-tone={tone} aria-labelledby={id}>
      <div className="panel-head">
        <span className="panel-title">
          <h2 className="eyebrow" id={id}>
            {title}
          </h2>
          {summary && <span className="panel-summary">{summary}</span>}
        </span>
        {actions}
      </div>
      {children}
    </section>
  );
}
