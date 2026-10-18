/** A tiny framed opening: plates, studs, kings and a header. */
export function BrandMark() {
  const piece = (x: number, y: number, w: number, h: number, fill: string) => (
    <rect x={x} y={y} width={w} height={h} fill={`var(--w-${fill})`} stroke="var(--w-edge)" strokeWidth={0.8} />
  );
  return (
    <svg width="34" height="34" viewBox="0 0 34 34" aria-hidden="true">
      {piece(2, 2, 30, 3, 'plate')}
      {piece(2, 5, 30, 3, 'plate')}
      {piece(2, 29, 30, 3, 'plate')}
      {piece(2, 8, 3, 21, 'stud')}
      {piece(29, 8, 3, 21, 'stud')}
      {piece(10, 8, 3, 21, 'king')}
      {piece(21, 8, 3, 21, 'king')}
      {piece(13, 12, 8, 4, 'header')}
    </svg>
  );
}
