import { z } from 'zod';

// Generated media is illustrative, never a precise diagram.
export const MediaKind = z.enum(['image', 'video']);
export type MediaKind = z.infer<typeof MediaKind>;
export const FalModelId = z
  .string()
  .max(120)
  .regex(/^[a-z0-9-]+(\/[a-z0-9._-]+){1,5}$/i, 'Use a fal model ID such as fal-ai/flux/schnell.');
export const MediaType = z.enum([
  'image/jpeg',
  'image/png',
  'image/webp',
  'video/mp4',
  'video/webm',
]);
export type MediaType = z.infer<typeof MediaType>;
export const mediaExtension: Record<MediaType, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'video/mp4': 'mp4',
  'video/webm': 'webm',
};
export const MediaFilename = /^[a-f0-9-]{36}\.(jpg|png|webp|mp4|webm)$/;
export const Subject = z.string().trim().min(3, 'Describe what to illustrate.').max(600);
/** Three causal beats, with app-rendered captions rather than model-painted text. */
export const VideoLessonSchema = z.object({
  scene: z.string().trim().min(10).max(220).optional(),
  objective: z.string().trim().min(8).max(160),
  steps: z
    .array(
      z.object({
        caption: z.string().trim().min(8).max(130),
        action: z.string().trim().min(15).max(240),
      }),
    )
    .length(3),
});
export type VideoLesson = z.infer<typeof VideoLessonSchema>;
export const GeneratedMediaSchema = z.object({
  id: z.uuid(),
  kind: MediaKind,
  model: FalModelId,
  subject: Subject,
  prompt: z.string().min(1).max(2000),
  lesson: VideoLessonSchema.optional(),
  filename: z.string().regex(MediaFilename),
  contentType: MediaType,
  bytes: z.number().int().positive(),
  width: z.number().int().positive().nullable(),
  height: z.number().int().positive().nullable(),
  requestId: z.string().min(1).max(120),
  origin: z.enum(['student', 'tutor']),
  sessionId: z.uuid().nullable(),
  source: z.object({ documentId: z.uuid(), page: z.number().int().positive() }).nullable(),
  createdAt: z.string().datetime(),
});
export type GeneratedMedia = z.infer<typeof GeneratedMediaSchema>;
export const GenerateRequestSchema = z.object({
  kind: MediaKind.default('image'),
  subject: Subject,
});
export type GenerateRequest = z.input<typeof GenerateRequestSchema>;
export type GenerationPhase = 'queued' | 'running' | 'saving' | 'done' | 'failed' | 'cancelled';
export type Generation = {
  id: string;
  kind: MediaKind;
  subject: string;
  origin: 'student' | 'tutor';
  phase: GenerationPhase;
  queuePosition: number | null;
  startedAt: string;
  error: string;
  mediaId: string | null;
  latencyMs: number | null;
};
export const mediaLimits = {
  image: { bytes: 20_000_000, timeoutMs: 120_000 },
  video: { bytes: 80_000_000, timeoutMs: 600_000 },
} as const;
const style = {
  image:
    'Educational illustration for a university student. Clear, scientifically plausible, clean 3D-render or illustration style, soft lighting, uncluttered background, centred subject. Absolutely no text, letters, numbers, labels, formulas or watermarks.',
};
/** The subject is study data, not instructions; it only fills the scene description. */
export function illustrationPrompt(kind: MediaKind, subject: string, lesson?: VideoLesson) {
  const clean = Subject.parse(subject).replace(/\s+/g, ' ');
  if (kind === 'video') {
    if (!lesson) throw new Error('A video needs a teaching storyboard before generation.');
    const plan = VideoLessonSchema.parse(lesson);
    return `Educational mechanism animation. Fixed wide camera; all participants remain visible. Simple flat colors on a plain background, stable object identities. Show cause then effect, one action at a time. No camera orbit, decorative motion, morphing, cuts, text or watermarks. Learning goal: ${plan.objective}. Scene: ${plan.scene ?? clean}. ${plan.steps.map((step, i) => `${['First third', 'Middle third', 'Final third'][i]}: ${step.action}`).join(' ')} Hold the final result clearly.`;
  }
  return `${style[kind]} Scene: ${clean}`;
}
/** Identify media by its bytes, never by the provider's claimed type alone. */
export function sniffMedia(bytes: Uint8Array): MediaType | null {
  const at = (i: number, ...values: number[]) => values.every((v, j) => bytes[i + j] === v);
  const ascii = (i: number, text: string) => at(i, ...Array.from(text, (c) => c.charCodeAt(0)));
  if (bytes.length < 12) return null;
  if (at(0, 0xff, 0xd8, 0xff)) return 'image/jpeg';
  if (at(0, 0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a)) return 'image/png';
  if (ascii(0, 'RIFF') && ascii(8, 'WEBP')) return 'image/webp';
  if (ascii(4, 'ftyp')) return 'video/mp4';
  if (at(0, 0x1a, 0x45, 0xdf, 0xa3)) return 'video/webm';
  return null;
}
export const kindOf = (type: MediaType): MediaKind =>
  type.startsWith('video/') ? 'video' : 'image';
/** fal serves outputs from its public CDN. Anything else is refused before download. */
export function isFalMediaUrl(raw: string) {
  try {
    const url = new URL(raw);
    return (
      url.protocol === 'https:' &&
      !url.username &&
      !url.password &&
      !url.port &&
      (url.hostname === 'fal.media' || url.hostname.endsWith('.fal.media'))
    );
  } catch {
    return false;
  }
}
