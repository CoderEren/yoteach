/** Axis-aligned screen bounds of a PDF text run, including rotated page/text transforms. */
export function textRunBox(
  transform: number[],
  advance: number,
  imageWidth: number,
  imageHeight: number,
) {
  const [a, b, c, d, x, y] = transform;
  const length = Math.hypot(a, b),
    height = Math.hypot(c, d);
  if (!length || !height || advance <= 0 || imageWidth <= 0 || imageHeight <= 0) return null;
  const dx = (a / length) * advance,
    dy = (b / length) * advance,
    upX = (b / length) * height,
    upY = (-a / length) * height;
  const xs = [x, x + dx, x + upX, x + dx + upX],
    ys = [y, y + dy, y + upY, y + dy + upY];
  const left = Math.max(0, Math.min(...xs) / imageWidth),
    top = Math.max(0, Math.min(...ys) / imageHeight),
    right = Math.min(1, Math.max(...xs) / imageWidth),
    bottom = Math.min(1, Math.max(...ys) / imageHeight);
  if (right <= left || bottom <= top) return null;
  return { x: left, y: top, width: right - left, height: bottom - top };
}
