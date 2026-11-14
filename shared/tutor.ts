import { z } from 'zod';
import { LessonKey, LessonStep } from './lessons';
import { MediaKind, Subject, type Generation } from './media';
const Uuid = z.uuid();
export const Shape = z.enum(['highlight', 'arrow', 'circle', 'point', 'label']);
export const Box = z
  .object({
    x: z.number().min(0).max(1),
    y: z.number().min(0).max(1),
    width: z.number().positive().max(1),
    height: z.number().positive().max(1),
  })
  .refine((b) => b.x + b.width <= 1.001 && b.y + b.height <= 1.001, 'Region must fit the image.');
export const SnapshotSchema = z.object({
  id: Uuid,
  epoch: z.number().int().nonnegative(),
  source: z.discriminatedUnion('kind', [
    z.object({
      kind: z.literal('pdf'),
      documentId: Uuid,
      page: z.number().int().min(1).max(500),
      name: z.string().max(240),
    }),
    z.object({ kind: z.literal('window'), id: z.string().max(200), name: z.string().max(240) }),
    z.object({
      kind: z.literal('screen'),
      id: z.string().max(200),
      name: z.string().max(240),
      bounds: z.object({
        x: z.number().int(),
        y: z.number().int(),
        width: z.number().int().positive(),
        height: z.number().int().positive(),
      }),
    }),
  ]),
  image: z
    .string()
    .max(8_000_000)
    .regex(/^data:image\/jpeg;base64,[A-Za-z0-9+/=]+$/),
  width: z.number().int().min(1).max(1920),
  height: z.number().int().min(1).max(1920),
  capturedAt: z.string().datetime(),
  textBoxes: z.array(z.object({ text: z.string().max(2000), box: Box })).max(2000),
});
export type SharedSnapshot = z.infer<typeof SnapshotSchema>;
export const AnnotationSchema = z.object({
  id: Uuid,
  snapshotId: Uuid,
  shape: Shape,
  box: Box,
  label: z.string().max(100),
  evidence: z.string().max(500),
  precision: z.enum(['pdf-text', 'vision-estimate']),
});
export type Annotation = z.infer<typeof AnnotationSchema>;
export const StudySessionSchema = z.object({
  id: Uuid,
  courseId: Uuid.nullable(),
  topicId: Uuid.nullable(),
  documentId: Uuid.nullable().default(null),
  page: z.number().int().min(1).max(500).default(1),
  mode: z.enum(['voice', 'text']),
  startedAt: z.string().datetime(),
  endedAt: z.string().datetime().nullable(),
});
export const MessageSchema = z.object({
  id: Uuid,
  sessionId: Uuid,
  role: z.enum(['user', 'assistant', 'note']),
  text: z.string().min(1).max(16000),
  createdAt: z.string().datetime(),
  eventId: z.string().max(120).optional(),
});
export const ExplanationSchema = z.object({
  id: Uuid,
  sessionId: Uuid,
  courseId: Uuid.nullable(),
  topicId: Uuid.nullable(),
  title: z.string().min(1).max(120),
  text: z.string().min(1).max(16000),
  source: z.object({ documentId: Uuid, page: z.number().int().positive() }).nullable(),
  createdAt: z.string().datetime(),
});
export type StudySession = z.infer<typeof StudySessionSchema>;
export type TutorMessage = z.infer<typeof MessageSchema>;
export type Explanation = z.infer<typeof ExplanationSchema>;
export type TutorRuntime = {
  activeLessonId: string | null;
  sessionId: string | null;
  lecturePreparing: boolean;
  lecture: { documentId: string; page: number; total: number } | null;
  status: 'idle' | 'connecting' | 'connected' | 'paused' | 'error';
  mode: 'voice' | 'text';
  activity: 'idle' | 'listening' | 'thinking' | 'speaking' | 'pointing' | 'success' | 'error';
  mic: boolean;
  input: 'idle' | 'arming' | 'listening' | 'sending';
  hotkeyError: string;
  focusRegion: string | null;
  focusRevision: number;
  sharing: 'off' | 'window' | 'pdf' | 'screen';
  sourceName: string;
  epoch: number;
  snapshot: SharedSnapshot | null;
  annotations: Annotation[];
  analysis: string;
  latencyMs: number | null;
  error: string;
  generation: Generation | null;
  config: {
    voice: boolean;
    vision: boolean;
    model: string;
    media: { image: boolean; video: boolean; imageModel: string; videoModel: string };
  };
};
export type WindowSource = { id: string; name: string };
export const ToolSchema = z.discriminatedUnion('name', [
  z.object({
    name: z.literal('open_visual_lesson'),
    lesson: LessonKey,
    step: LessonStep.default(1),
  }),
  z.object({ name: z.literal('navigate_visual_lesson'), step: LessonStep }),
  z.object({
    name: z.literal('generate_illustration'),
    subject: Subject,
    kind: MediaKind.default('image'),
  }),
  z.object({
    name: z.literal('analyze_current_screen'),
    question: z.string().trim().min(1).max(2000),
  }),
  z.object({ name: z.literal('highlight_screen_region'), snapshotId: Uuid, regionId: Uuid }),
  z.object({ name: z.literal('draw_annotation'), snapshotId: Uuid, regionId: Uuid, shape: Shape }),
  z.object({ name: z.literal('navigate_slide'), page: z.number().int().min(1).max(500) }),
  z.object({ name: z.literal('save_explanation'), title: z.string().trim().min(1).max(120) }),
  z.object({
    name: z.literal('record_learning_interaction'),
    note: z.string().trim().min(1).max(1000),
  }),
]);
export type TutorTool = z.infer<typeof ToolSchema>;
export const IntentSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('lesson-open'), lesson: LessonKey, savedId: Uuid.optional() }),
  z.object({ type: z.literal('lesson-step'), id: Uuid, step: LessonStep }),
  z.object({ type: z.literal('lesson-close') }),
  z.object({ type: z.literal('lesson-narrate') }),
  z.object({ type: z.literal('hold-start') }),
  z.object({ type: z.literal('hold-end') }),
  z.object({ type: z.literal('hold-cancel') }),
  z.object({
    type: z.literal('start'),
    topicId: Uuid.nullable().default(null),
    documentId: Uuid.optional(),
    page: z.number().int().min(1).max(500).optional(),
    mode: z.enum(['voice', 'text']),
  }),
  z.object({ type: z.literal('lecture-page'), page: z.number().int().min(1).max(500) }),
  z.object({ type: z.literal('text'), text: z.string().trim().min(1).max(2000) }),
  z.object({ type: z.literal('end') }),
  z.object({ type: z.literal('pause') }),
  z.object({ type: z.literal('mute') }),
  z.object({ type: z.literal('stop-sharing') }),
  z.object({ type: z.literal('share-window'), id: z.string().max(200) }),
  z.object({ type: z.literal('open') }),
]);
export type TutorIntent = z.infer<typeof IntentSchema>;
export const RuntimeUpdateSchema = z.object({
  sessionId: Uuid,
  lecturePreparing: z.boolean().optional(),
  input: z.enum(['idle', 'arming', 'listening', 'sending']).optional(),
  status: z.enum(['connecting', 'connected', 'paused', 'error']).optional(),
  activity: z
    .enum(['idle', 'listening', 'thinking', 'speaking', 'pointing', 'success', 'error'])
    .optional(),
  mic: z.boolean().optional(),
  error: z.string().max(500).optional(),
});
export type RuntimeUpdate = z.infer<typeof RuntimeUpdateSchema>;
export interface TutorApi {
  get(): Promise<import('./model').Result<TutorRuntime>>;
  intent(action: TutorIntent): Promise<import('./model').Result<void>>;
  start(
    topicId: string | null,
    mode: 'voice' | 'text',
    documentId?: string,
    page?: number,
  ): Promise<import('./model').Result<{ id: string; signedUrl: string; context: string }>>;
  end(id: string): Promise<import('./model').Result<void>>;
  update(patch: RuntimeUpdate): Promise<import('./model').Result<void>>;
  transcript(
    sessionId: string,
    role: 'user' | 'assistant',
    text: string,
    eventId: string,
  ): Promise<import('./model').Result<void>>;
  tool(sessionId: string, tool: TutorTool): Promise<import('./model').Result<unknown>>;
  captureScreen(): Promise<import('./model').Result<void>>;
  windows(): Promise<import('./model').Result<WindowSource[]>>;
  selectWindow(id: string): Promise<import('./model').Result<number>>;
  validateWindow(id: string, epoch: number): Promise<import('./model').Result<boolean>>;
  sharePdf(snapshot: SharedSnapshot): Promise<import('./model').Result<void>>;
  snapshot(snapshot: SharedSnapshot): Promise<import('./model').Result<void>>;
  stopSharing(): Promise<import('./model').Result<void>>;
  save(messageId: string): Promise<import('./model').Result<void>>;
  deleteSession(id: string): Promise<import('./model').Result<void>>;
  deleteExplanation(id: string): Promise<import('./model').Result<void>>;
  onChange(fn: (state: TutorRuntime) => void): () => void;
  onIntent(fn: (action: TutorIntent) => void): () => void;
  onNavigate(fn: (topicId: string) => void): () => void;
}
