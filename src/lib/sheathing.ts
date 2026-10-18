import { WALL_DEPTH } from './lumber';

/**
 * How a wall end meets the adjoining wall at a corner.
 * - none: sheathing stops flush with the end of the framing.
 * - outside: this wall runs past the other one; its sheathing extends past the framing by the
 *   other wall's sheathing thickness, to cover that sheathing's edge.
 * - inside: this wall butts into the other one; the corner is a full wall depth plus the other
 *   wall's sheathing beyond this wall's framing.
 */
export type CornerType = 'none' | 'outside' | 'inside';
export type PanelOrientation = 'vertical' | 'horizontal';

export interface SheathingSpec {
  orientation: PanelOrientation;
  /** Total panel thickness (e.g. ZIP System R-9 is about 2"). */
  thickness: number;
  /** Floor (bottom of bottom plate) to the bottom edge of the first full panel row. */
  startHeight: number;
  corners: { left: CornerType; right: CornerType };
  /** Single: a stud is centered under each vertical seam. Double: two studs straddle it. */
  seamStuds: 'single' | 'double';
  /** Add blocking behind horizontal seams. */
  blockSeams: boolean;
}

/** 4x8 sheet goods. */
export const PANEL_SHORT = 48;
export const PANEL_LONG = 96;

export function panelSize(orientation: PanelOrientation) {
  return orientation === 'vertical'
    ? { width: PANEL_SHORT, height: PANEL_LONG }
    : { width: PANEL_LONG, height: PANEL_SHORT };
}

/** How far the sheathing extends past the framing at a wall end. */
export function cornerExtension(type: CornerType, thickness: number): number {
  if (type === 'outside') return thickness;
  if (type === 'inside') return WALL_DEPTH + thickness;
  return 0;
}

export interface SeamMark {
  /** Position from the wall's left end. */
  x: number;
  /** Distance from the framing end the layout is pulled from. */
  distance: number;
}

export interface SheathingLayout {
  panel: { width: number; height: number };
  /** Sheathing past the framing at each end. */
  extLeft: number;
  extRight: number;
  /** Extension at the end the layout (and sheathing) starts from. */
  extOrigin: number;
  verticalSeams: SeamMark[];
  /** Heights of horizontal seams within the wall. */
  horizontalSeams: number[];
  /** Top edge of the panel row that covers the top of the wall. */
  top: number;
}

const EPS = 1e-6;

/**
 * Sheathing starts at the outside corner of the layout end, so panel edges sit at
 * k × panel width measured from there. Stud layout uses the same origin so seams land on studs.
 */
export function sheathingLayout(wall: {
  length: number;
  height: number;
  layoutFrom: 'left' | 'right';
  sheathing: SheathingSpec;
}): SheathingLayout {
  const { length: L, height: H, sheathing: s } = wall;
  const panel = panelSize(s.orientation);
  const extLeft = cornerExtension(s.corners.left, s.thickness);
  const extRight = cornerExtension(s.corners.right, s.thickness);
  const fromRight = wall.layoutFrom === 'right';
  const extOrigin = fromRight ? extRight : extLeft;

  const verticalSeams: SeamMark[] = [];
  for (let k = 1; ; k++) {
    const distance = k * panel.width - extOrigin;
    if (distance >= L - EPS) break;
    if (distance <= EPS) continue;
    verticalSeams.push({ x: fromRight ? L - distance : distance, distance });
  }

  const horizontalSeams: number[] = [];
  for (let k = Math.max(0, Math.ceil(-s.startHeight / panel.height)); ; k++) {
    const z = s.startHeight + k * panel.height;
    if (z >= H - EPS) break;
    if (z > EPS) horizontalSeams.push(z);
  }

  // Rows stack up from the start height until one reaches the top of the wall.
  const top = s.startHeight + Math.max(1, Math.ceil((H - s.startHeight - EPS) / panel.height)) * panel.height;

  return { panel, extLeft, extRight, extOrigin, verticalSeams, horizontalSeams, top };
}
