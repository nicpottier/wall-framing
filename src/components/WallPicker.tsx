import type { Dispatch } from 'react';
import type { Project, ProjectAction } from '../state/project';

/** Choose which wall of the project the form and drawing show; add or remove walls. */
export function WallPicker({ project, dispatch }: { project: Project; dispatch: Dispatch<ProjectAction> }) {
  const { walls, selected } = project;
  const current = walls[selected];
  return (
    <div className="wall-picker">
      <label className="visually-hidden" htmlFor="wall-pick">
        Wall
      </label>
      <select id="wall-pick" value={selected} onChange={(e) => dispatch({ type: 'selectWall', index: Number(e.target.value) })}>
        {walls.map((w, i) => (
          <option key={w.id} value={i}>
            {w.name || `Wall ${i + 1}`}
          </option>
        ))}
      </select>
      <button className="btn" type="button" onClick={() => dispatch({ type: 'addWall' })}>
        + Wall
      </button>
      <button
        className="btn"
        type="button"
        disabled={walls.length <= 1}
        title={walls.length <= 1 ? 'A project needs at least one wall' : `Remove ${current?.name}`}
        onClick={() => dispatch({ type: 'removeWall', index: selected })}
      >
        Remove
      </button>
    </div>
  );
}
