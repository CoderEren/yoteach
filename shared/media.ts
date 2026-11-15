import { z } from 'zod';
import { LessonStep } from './lessons';

// Generated media is illustrative. Precise science stays in authored lesson scenes.
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
export const GeneratedMediaSchema = z.object({
  id: z.uuid(),
  kind: MediaKind,
  model: FalModelId,
  subject: Subject,
  prompt: z.string().min(1).max(2000),
  filename: z.string().regex(MediaFilename),
  contentType: MediaType,
  bytes: z.number().int().positive(),
  width: z.number().int().positive().nullable(),
  height: z.number().int().positive().nullable(),
  requestId: z.string().min(1).max(120),
  origin: z.enum(['student', 'tutor']),
  sessionId: z.uuid().nullable(),
  lessonId: z.uuid().nullable(),
  lessonStep: LessonStep.nullable(),
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
  lessonId: string | null;
  lessonStep: number | null;
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
  video:
    'Short educational clip for a university student. Clear, scientifically plausible motion, slow steady camera, clean 3D-render style, soft lighting, uncluttered background. No text, letters, numbers, labels, formulas or watermarks.',
};
/** The subject is study data, not instructions; it only fills the scene description. */
export function illustrationPrompt(kind: MediaKind, subject: string) {
  const clean = Subject.parse(subject).replace(/\s+/g, ' ');
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
