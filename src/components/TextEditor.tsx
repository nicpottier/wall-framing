import { useRef, useState, type ChangeEvent } from 'react';
import type { TextError } from '../state/wallText';
import { Panel } from './controls';

interface Props {
  text: string;
  errors: TextError[];
  onChange: (text: string) => void;
  /** Suggested file name for downloads. */
  fileName: string;
}

const EXAMPLE_LINES = [
  ['## Wall A', 'Starts a wall. ## Defaults applies to every wall below it.'],
  ['- length: 20-0', 'Settings: length, height, studs, layout, top plate, exterior, headers, head height, rough sill, window ro, door ro, sheathing, corners'],
  ['- W1: window 3-0 x 4-6, 4-6 from left', 'Positions are to the centerline: "from left", "from right", "after W1", or "centered"'],
  ['- D1: door 3068, 5-9 from right', 'Four-digit callouts give feet and inches of width then height'],
  ['  …, head 7-0, header 4x10, jacks 2', 'Optional: head or sill, header, jacks, ro W x H'],
  ['- P1: 6x6, 8-0 from right', 'Under ### Posts: 6x6, 4x6, 4x4 or (2)–(4) studs, to the centerline'],
  ['- Stair: 10-1 7/8 tall, 12-6 to 24-1 from left', 'Under ### Balloon framing: a stretch framed to its own height, with plate steps at its ends'],
] as const;

/** The wall spec as plain text, applied to the project whenever it reads cleanly. */
export function TextEditor({ text, errors, onChange, fileName }: Props) {
  const area = useRef<HTMLTextAreaElement>(null);
  const file = useRef<HTMLInputElement>(null);
  const [copied, setCopied] = useState(false);

  const goToLine = (line: number) => {
    const el = area.current;
    if (!el) return;
    const lines = text.split('\n');
    const start = lines.slice(0, line - 1).reduce((n, l) => n + l.length + 1, 0);
    el.focus();
    el.setSelectionRange(start, start + (lines[line - 1]?.length ?? 0));
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      area.current?.select();
    }
  };

  const download = () => {
    const url = URL.createObjectURL(new Blob([text], { type: 'text/markdown' }));
    const a = Object.assign(document.createElement('a'), { href: url, download: fileName });
    a.click();
    URL.revokeObjectURL(url);
  };

  const open = async (e: ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) onChange(await f.text());
    e.target.value = '';
  };

  return (
    <Panel
      title="Wall spec"
      tone="wall"
      actions={
        <div className="btn-row">
          <button className="btn" type="button" onClick={copy}>
            {copied ? 'Copied' : 'Copy'}
          </button>
          <button className="btn" type="button" onClick={download}>
            Download
          </button>
          <button className="btn" type="button" onClick={() => file.current?.click()}>
            Open…
          </button>
          <input ref={file} type="file" accept=".md,.txt,text/markdown,text/plain" hidden onChange={open} />
        </div>
      }
    >
      <div className="text-editor">
        <label className="visually-hidden" htmlFor="wall-text">
          Wall spec text
        </label>
        <textarea
          id="wall-text"
          ref={area}
          value={text}
          spellCheck={false}
          autoCapitalize="off"
          autoCorrect="off"
          onChange={(e) => onChange(e.target.value)}
        />
        {errors.length ? (
          <div className="text-status bad" role="status">
            <p>
              {errors.length === 1 ? '1 problem' : `${errors.length} problems`}. The drawing shows the last version that read
              cleanly.
            </p>
            <ul>
              {errors.map((e, i) => (
                <li key={i}>
                  <button type="button" onClick={() => goToLine(e.line)}>
                    Line {e.line}
                  </button>
                  {e.message}
                </li>
              ))}
            </ul>
          </div>
        ) : (
          <p className="text-status good" role="status">
            Up to date with the drawing.
          </p>
        )}
        <details className="text-help">
          <summary>Format</summary>
          <dl>
            {EXAMPLE_LINES.map(([code, help]) => (
              <div key={code}>
                <dt>
                  <code>{code}</code>
                </dt>
                <dd>{help}</dd>
              </div>
            ))}
          </dl>
          <p>Lengths: 4-6 is 4'-6", 4-6 1/2 adds a fraction, plain numbers are inches. Other text is kept as notes.</p>
        </details>
      </div>
    </Panel>
  );
}
