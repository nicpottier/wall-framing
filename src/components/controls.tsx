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
}

export function Segmented<V extends string>({ label, value, options, onChange, bare }: SegmentedProps<V>) {
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
    <div className="field">
      <span className="lbl">{label}</span>
      {group}
    </div>
  );
}
