export type Rect = { x: number; y: number; width: number; height: number };
export function fitImage(image: { width: number; height: number }, area: Rect): Rect {
  const scale = Math.min(area.width / image.width, area.height / image.height);
  const width = image.width * scale,
    height = image.height * scale;
  return {
    x: area.x + (area.width - width) / 2,
    y: area.y + (area.height - height) / 2,
    width,
    height,
  };
}
export function pointBeside(box: Rect, area: Rect) {
  const x = area.x + box.x * area.width,
    y = area.y + box.y * area.height;
  const w = box.width * area.width,
    h = box.height * area.height;
  const direction = x - area.x >= 210 ? ('right' as const) : ('left' as const);
  return {
    direction,
    x: Math.round(
      Math.max(
        area.x,
        Math.min(area.x + area.width - 200, direction === 'right' ? x - 195 : x + w + 5),
      ),
    ),
    y: Math.round(Math.max(area.y, Math.min(area.y + area.height - 220, y + h / 2 - 110))),
  };
}
