import { z } from 'zod';
import { StudySessionSchema, MessageSchema, ExplanationSchema, type TutorApi } from './tutor';
export const Id = z.uuid();
export const Title = z
  .string()
  .trim()
  .min(1, 'Enter a title.')
  .max(120, 'Keep titles under 120 characters.');
const Stamp = z.string().datetime();
export const CourseSchema = z.object({
  id: Id,
  title: Title,
  color: z.enum(['iris', 'cyan', 'rose', 'sage']),
  createdAt: Stamp,
});
export const RefSchema = z.object({ documentId: Id, page: z.number().int().min(1).max(500) });
export const TopicSchema = z.object({
  id: Id,
  courseId: Id,
  parentId: Id.nullable(),
  title: Title,
  overview: z.string().max(20000),
  order: z.number().int().min(0),
  sourceRefs: z.array(RefSchema).max(500),
  createdAt: Stamp,
});
export const PageSchema = z.object({
  page: z.number().int().min(1).max(500),
  text: z.string().max(50000),
});
export const HeadingSchema = z.object({
  title: Title,
  page: z.number().int().min(1).max(500),
  level: z.number().int().min(1).max(3),
});
export const DocumentSchema = z.object({
  id: Id,
  courseId: Id,
  originalName: z.string().max(240),
  filename: z.string().regex(/^[a-f0-9-]{36}\.pdf$/),
  pageCount: z.number().int().min(1).max(500),
  pages: z.array(PageSchema).max(500),
  organization: z.enum(['outline', 'headings', 'fallback']),
  createdAt: Stamp,
});
export const SettingsSchema = z.object({
  theme: z.enum(['system', 'light', 'dark']),
  mascotVisible: z.boolean(),
  mascotPosition: z.object({ x: z.number().int(), y: z.number().int() }).nullable(),
  lastTopicId: Id.nullable(),
});
export const ActivitySchema = z.object({
  id: Id,
  courseId: Id,
  topicId: Id.nullable(),
  text: z.string().max(300),
  createdAt: Stamp,
});
export const StateSchema = z.object({
  version: z.literal(2),
  sessions: z.array(StudySessionSchema),
  messages: z.array(MessageSchema),
  explanations: z.array(ExplanationSchema),
  courses: z.array(CourseSchema),
  topics: z.array(TopicSchema),
  documents: z.array(DocumentSchema),
  activities: z.array(ActivitySchema).max(100),
  settings: SettingsSchema,
});
export type Course = z.infer<typeof CourseSchema>;
export type Topic = z.infer<typeof TopicSchema>;
export type SourceDocument = z.infer<typeof DocumentSchema>;
export type AppState = z.infer<typeof StateSchema>;
export type Heading = z.infer<typeof HeadingSchema>;
export type PageText = z.infer<typeof PageSchema>;
export type MascotState =
  'idle' | 'listening' | 'thinking' | 'speaking' | 'pointing' | 'success' | 'error';
export const CommandSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('course.create'), title: Title, color: CourseSchema.shape.color }),
  z.object({ type: z.literal('course.rename'), id: Id, title: Title }),
  z.object({ type: z.literal('course.delete'), id: Id }),
  z.object({
    type: z.literal('topic.create'),
    courseId: Id,
    title: Title,
    parentId: Id.nullable(),
  }),
  z.object({
    type: z.literal('topic.update'),
    id: Id,
    title: Title,
    overview: z.string().max(20000),
    parentId: Id.nullable(),
  }),
  z.object({ type: z.literal('topic.move'), id: Id, direction: z.enum(['up', 'down']) }),
  z.object({ type: z.literal('topic.delete'), id: Id }),
  z.object({ type: z.literal('topic.open'), id: Id }),
  z.object({ type: z.literal('document.delete'), id: Id }),
  z.object({ type: z.literal('settings.update'), theme: SettingsSchema.shape.theme }),
]);
export type Command = z.infer<typeof CommandSchema>;
export const ImportSchema = z.object({
  token: Id,
  courseId: Id,
  pages: z.array(PageSchema).min(1).max(500),
  headings: z.array(HeadingSchema).max(100),
  organization: DocumentSchema.shape.organization,
});
export type ImportPayload = z.infer<typeof ImportSchema>;
export type PendingImport = { token: string; name: string; bytes: Uint8Array };
export type Result<T> = { ok: true; value: T } | { ok: false; error: string };
export interface DesktopApi {
  tutor: TutorApi;
  getState(): Promise<Result<AppState>>;
  command(command: Command): Promise<Result<AppState>>;
  pickPdf(courseId: string, sample?: boolean): Promise<Result<PendingImport | null>>;
  finishImport(payload: ImportPayload): Promise<Result<AppState>>;
  cancelImport(token: string): Promise<Result<void>>;
  readPdf(id: string): Promise<Result<Uint8Array>>;
  companion(action: 'show' | 'hide' | 'expand' | 'collapse' | 'workspace'): Promise<Result<void>>;
  onState(callback: (state: AppState) => void): () => void;
}
export const freshState = (): AppState => ({
  version: 2,
  sessions: [],
  messages: [],
  explanations: [],
  courses: [],
  topics: [],
  documents: [],
  activities: [],
  settings: { theme: 'system', mascotVisible: true, mascotPosition: null, lastTopicId: null },
});
