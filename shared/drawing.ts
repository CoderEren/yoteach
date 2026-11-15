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
    /** Per-line boxes when the marked text wraps. */
    parts?: Box[];
  }[];
  connections: { id: string; from: Box; to: Box; label: string | null }[];
  diagram: Diagram | null;
  /** A free-form sketch, optionally placed beside a grounded region. */
  sketch: (Sketch & { near: Box | null }) | null;
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
  let skipOver = (_from: string, _to: string) => 0;
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
    const column = new Map<string, number>();
    filled.forEach((ids, c) => ids.forEach((id) => column.set(id, c)));
    // Edges that jump over a column travel in a lane above the nodes instead of through them.
    const skips = d.edges.some((e) => Math.abs(column.get(e.to)! - column.get(e.from)!) > 1);
    const lane = skips ? 70 : 0;
    width = filled.length * (NODE_W + GAP) - GAP + 40;
    height = tallest * (NODE_H + 34) - 34 + 40 + lane;
    filled.forEach((ids, c) =>
      ids.forEach((id, row) =>
        pos.set(id, {
          x: 20 + c * (NODE_W + GAP) + NODE_W / 2,
          y: lane + (height - lane) / 2 + (row - (ids.length - 1) / 2) * (NODE_H + 34),
        }),
      ),
    );
    skipOver = (from: string, to: string) =>
      Math.abs(column.get(to)! - column.get(from)!) > 1 ? lane : 0;
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
    if (skipOver(e.from, e.to)) {
      // Leave from the top of each node and arc through the lane above the row.
      const s = { x: a.x, y: a.y - NODE_H / 2 - 4 },
        t = { x: b.x, y: b.y - NODE_H / 2 - 6 };
      const top = Math.min(s.y, t.y) - skipOver(e.from, e.to) + 8;
      const d = `M ${s.x.toFixed(1)} ${s.y.toFixed(1)} C ${s.x.toFixed(1)} ${top.toFixed(1)} ${t.x.toFixed(1)} ${top.toFixed(1)} ${t.x.toFixed(1)} ${t.y.toFixed(1)}`;
      return {
        d,
        label: e.label ?? null,
        lx: (s.x + t.x) / 2,
        ly: top + 14,
        tip: { x: t.x, y: t.y, angle: Math.PI / 2 },
      };
    }
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

// Free-form sketch on a 100 × 70 canvas (y grows downward). The tutor draws what a diagram
// cannot: vectors, graphs, geometry, annotated shapes.
// Lenient by design: a slightly-off coordinate or long label is fixed up, never a failed drawing.
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const Pt = z
  .tuple([z.number(), z.number()])
  .transform(([x, y]) => [clamp(x, 0, 100), clamp(y, 0, 70)] as [number, number]);
const Tone = z.enum(['ink', 'accent', 'muted']).optional().catch(undefined);
const Short = z
  .string()
  .trim()
  .min(1)
  .transform((t) => t.slice(0, 40));
/** Animation: which build step an element appears in, and where it slides afterwards. */
const Motion = {
  step: z.number().int().min(1).max(8).optional().catch(undefined),
  moveTo: Pt.optional().catch(undefined),
};
export const SketchElementSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('arrow'),
    from: Pt,
    to: Pt,
    label: Short.optional(),
    dashed: z.boolean().optional(),
    tone: Tone,
    ...Motion,
  }),
  z.object({
    type: z.literal('line'),
    from: Pt,
    to: Pt,
    label: Short.optional(),
    dashed: z.boolean().optional(),
    tone: Tone,
    ...Motion,
  }),
  z.object({
    type: z.literal('curve'),
    points: z
      .array(Pt)
      .min(2)
      .transform((p) => p.slice(0, 40)),
    label: Short.optional(),
    dashed: z.boolean().optional(),
    tone: Tone,
    ...Motion,
  }),
  z.object({
    type: z.literal('circle'),
    at: Pt,
    r: z.number().transform((r) => clamp(r, 1, 35)),
    label: Short.optional(),
    tone: Tone,
    ...Motion,
  }),
  z.object({
    type: z.literal('box'),
    at: Pt,
    w: z.number().transform((w) => clamp(w, 2, 100)),
    h: z.number().transform((h) => clamp(h, 2, 70)),
    label: Short.optional(),
    tone: Tone,
    ...Motion,
  }),
  z.object({ type: z.literal('dot'), at: Pt, label: Short.optional(), tone: Tone, ...Motion }),
  z.object({
    type: z.literal('text'),
    at: Pt,
    text: z
      .string()
      .trim()
      .min(1)
      .transform((t) => t.slice(0, 60)),
    tone: Tone,
    ...Motion,
  }),
  z.object({
    type: z.literal('axes'),
    origin: Pt,
    xLabel: Short.optional(),
    yLabel: Short.optional(),
    ...Motion,
  }),
]);
export type SketchElement = z.infer<typeof SketchElementSchema>;
export const SketchSchema = z.object({
  title: z
    .string()
    .trim()
    .min(1)
    .transform((t) => t.slice(0, 60)),
  // Keep every element that parses; drop the odd malformed one instead of failing the sketch.
  elements: z
    .array(z.unknown())
    .min(1)
    .transform((items) =>
      items
        .flatMap((item) => {
          const r = SketchElementSchema.safeParse(item);
          return r.success ? [r.data] : [];
        })
        .slice(0, 40),
    )
    .refine((items) => items.length > 0, 'No drawable elements.'),
  /** One caption per build step, shown under the sketch as it plays. */
  captions: z
    .array(
      z
        .string()
        .trim()
        .transform((t) => t.slice(0, 120)),
    )
    .max(8)
    .optional()
    .catch(undefined),
});
export type Sketch = z.infer<typeof SketchSchema>;
