import { z } from 'zod';

// On-screen drawing. Marks attach only to grounded regions; diagrams are laid out by the
// app. The tutor never supplies raw coordinates.
const RegionId = z.uuid();
const Label = z.string().trim().min(1).max(60);
export const MarkShape = z.enum(['highlight', 'circle', 'underline', 'box', 'arrow', 'point']);
export const MarkSchema = z.object({
  regionId: RegionId,
  shape: MarkShape,
  label: Label.optional(),
});
export const ConnectionSchema = z.object({
  from: RegionId,
  to: RegionId,
  label: z.string().trim().min(1).max(40).optional(),
});
const NodeId = z
  .string()
  .trim()
  .min(1)
  .max(24)
  .regex(/^[\w-]+$/, 'Use short node IDs such as atp or step-1.');
export const DiagramSchema = z
  .object({
    title: z.string().trim().min(1).max(60),
    layout: z.enum(['flow', 'cycle']).default('flow'),
    nodes: z
      .array(z.object({ id: NodeId, label: z.string().trim().min(1).max(40) }))
      .min(2)
      .max(7),
    edges: z
      .array(
        z.object({
          from: NodeId,
          to: NodeId,
          label: z.string().trim().min(1).max(30).optional(),
        }),
      )
      .max(10)
      .default([]),
  })
  .superRefine((d, ctx) => {
    const ids = new Set(d.nodes.map((n) => n.id));
    if (ids.size !== d.nodes.length)
      ctx.addIssue({ code: 'custom', message: 'Node IDs must be unique.' });
    for (const e of d.edges)
      if (!ids.has(e.from) || !ids.has(e.to) || e.from === e.to)
        ctx.addIssue({ code: 'custom', message: 'Edges must join two different listed nodes.' });
  });
export type Diagram = z.infer<typeof DiagramSchema>;
type Box = { x: number; y: number; width: number; height: number };
export type ScreenDrawing = {
  id: string;
  /** Grounded marks belong to one snapshot and disappear with it. */
  snapshotId: string | null;
  marks: {
    id: string;
    regionId: string;
    shape: z.infer<typeof MarkShape>;
    label: string | null;
    box: Box;
  }[];
  connections: { id: string; from: Box; to: Box; label: string | null }[];
  diagram: Diagram | null;
  revision: number;
};
export type LaidOut = {
  width: number;
  height: number;
  nodes: { id: string; label: string; x: number; y: number; w: number; h: number }[];
  edges: {
    d: string;
    label: string | null;
    lx: number;
    ly: number;
    tip: { x: number; y: number; angle: number };
  }[];
};
const NODE_W = 150,
  NODE_H = 54,
  GAP = 120; // room for an arrow and its label between columns
/** Deterministic layout: layered left-to-right flow, or nodes around a circle. */
export function layoutDiagram(d: Diagram): LaidOut {
  const pos = new Map<string, { x: number; y: number }>();
  let width: number, height: number;
  if (d.layout === 'cycle') {
    const n = d.nodes.length,
      r = Math.max(110, n * 34);
    width = height = r * 2 + NODE_W + 20;
    d.nodes.forEach((node, i) => {
      const a = -Math.PI / 2 + (i * 2 * Math.PI) / n;
      pos.set(node.id, { x: width / 2 + r * Math.cos(a), y: height / 2 + r * Math.sin(a) });
    });
  } else {
    // Longest-path layering from sources; back edges are ignored so cycles still terminate.
    const layer = new Map(d.nodes.map((n) => [n.id, 0]));
    const order = new Map(d.nodes.map((n, i) => [n.id, i]));
    for (let pass = 0; pass < d.nodes.length; pass++)
      for (const e of d.edges)
        if (order.get(e.from)! < order.get(e.to)! || layer.get(e.from)! < layer.get(e.to)!)
          layer.set(e.to, Math.max(layer.get(e.to)!, layer.get(e.from)! + 1));
    const columns: string[][] = [];
    for (const n of d.nodes) (columns[Math.min(layer.get(n.id)!, 6)] ??= []).push(n.id);
    const filled = columns.filter(Boolean);
    const tallest = Math.max(...filled.map((c) => c.length));
    width = filled.length * (NODE_W + GAP) - GAP + 40;
    height = tallest * (NODE_H + 34) - 34 + 40;
    filled.forEach((column, c) =>
      column.forEach((id, row) =>
        pos.set(id, {
          x: 20 + c * (NODE_W + GAP) + NODE_W / 2,
          y: height / 2 + (row - (column.length - 1) / 2) * (NODE_H + 34),
        }),
      ),
    );
  }
  const nodes = d.nodes.map((n) => ({
    ...n,
    ...pos.get(n.id)!,
    w: NODE_W,
    h: NODE_H,
  }));
  const edges = d.edges.map((e) => {
    const a = pos.get(e.from)!,
      b = pos.get(e.to)!;
    const dx = b.x - a.x,
      dy = b.y - a.y,
      len = Math.hypot(dx, dy) || 1;
    // Leave each node at its border, and bow slightly so opposing edges stay apart.
    const exit = (p: { x: number; y: number }, sx: number, sy: number) => {
      const t = Math.min(NODE_W / 2 / Math.abs(sx || 1e-6), NODE_H / 2 / Math.abs(sy || 1e-6));
      return { x: p.x + sx * (t + 6), y: p.y + sy * (t + 6) };
    };
    const s = exit(a, dx / len, dy / len),
      t = exit(b, -dx / len, -dy / len);
    const mx = (s.x + t.x) / 2 - (dy / len) * 18,
      my = (s.y + t.y) / 2 + (dx / len) * 18;
    return {
      d: `M ${s.x.toFixed(1)} ${s.y.toFixed(1)} Q ${mx.toFixed(1)} ${my.toFixed(1)} ${t.x.toFixed(1)} ${t.y.toFixed(1)}`,
      label: e.label ?? null,
      lx: mx,
      ly: my,
      tip: { x: t.x, y: t.y, angle: Math.atan2(t.y - my, t.x - mx) },
    };
  });
  return { width, height, nodes, edges };
}
