import {
  mkdirSync,
  readFileSync,
  writeFileSync,
  renameSync,
  existsSync,
  unlinkSync,
  openSync,
  fsyncSync,
  closeSync,
} from 'node:fs';
import { join } from 'node:path';
import {
  StudySessionSchema,
  MessageSchema,
  ExplanationSchema,
  ChatSchema,
  type Chat,
  type TutorMessage,
  type Explanation,
} from '../shared/tutor';
import { LessonKey, LessonStep, type SavedLesson } from '../shared/lessons';
import { AttemptSchema, type PracticeAttempt } from '../shared/practice';
import {
  GeneratedMediaSchema,
  MediaFilename,
  mediaExtension,
  type GeneratedMedia,
  type MediaType,
} from '../shared/media';
import { randomUUID } from 'node:crypto';
import {
  AppState,
  Command,
  CommandSchema,
  Course,
  ImportPayload,
  ImportSchema,
  StateSchema,
  freshState,
} from '../shared/model';

/** Main-process-only store. Atomic snapshots keep the small Stage 1 database portable. */
export class Store {
  private state: AppState;
  readonly documentsDir: string;
  readonly mediaDir: string;
  readonly file: string;
  constructor(readonly directory: string) {
    mkdirSync(directory, { recursive: true, mode: 0o700 });
    this.documentsDir = join(directory, 'documents');
    mkdirSync(this.documentsDir, { recursive: true, mode: 0o700 });
    this.mediaDir = join(directory, 'media');
    mkdirSync(this.mediaDir, { recursive: true, mode: 0o700 });
    this.file = join(directory, 'workspace.json');
    if (existsSync(this.file)) {
      try {
        const raw = JSON.parse(readFileSync(this.file, 'utf8'));
        if ([1, 2, 3, 4, 5, 6].includes(raw.version)) {
          // Keep an exact pre-migration snapshot, including legacy notes and associations.
          const backup = this.file + `.v${raw.version}.backup`;
          if (!existsSync(backup)) writeFileSync(backup, readFileSync(this.file), { mode: 0o600 });
          raw.version = 7;
          raw.lessons ??= [];
          raw.media ??= [];
          raw.attempts ??= [];
          raw.slideDrawings ??= [];
          raw.sessions ??= [];
          raw.messages ??= [];
          raw.explanations ??= [];
        }
        if (!raw.chats) {
          // One chat per earlier session, titled by its lecture or its first question.
          raw.chats = [];
          for (const s of raw.sessions ?? []) {
            const messages = (raw.messages ?? []).filter((m: any) => m.sessionId === s.id);
            if (!messages.length && !s.documentId) continue;
            const doc = (raw.documents ?? []).find((d: any) => d.id === s.documentId);
            const first = messages.find((m: any) => m.role === 'user')?.text ?? '';
            const id = randomUUID();
            raw.chats.push({
              id,
              kind: doc ? 'lecture' : 'chat',
              title: doc ? doc.originalName.slice(0, 80) : firstWords(first) || 'Earlier chat',
              named: !!doc,
              documentId: doc?.id ?? null,
              sessionId: s.id,
              createdAt: s.startedAt,
              updatedAt: messages.at(-1)?.createdAt ?? s.startedAt,
            });
            for (const m of messages) m.chatId = id;
          }
        }
        this.state = StateSchema.parse(raw);
        // A prior process cannot own a live session after relaunch.
        this.state.sessions.forEach((s) => {
          if (!s.endedAt) s.endedAt = new Date().toISOString();
        });
        this.save(this.state);
      } catch {
        throw new Error(
          `Your saved workspace could not be read. It has been left untouched at ${this.file}. Restore a valid copy before reopening yoteach.`,
        );
      }
    } else {
      this.state = freshState();
      this.save(this.state);
    }
    this.cleanupOrphans();
  }
  openLesson(key: SavedLesson['key'], sessionId: string | null, savedId?: string) {
    LessonKey.parse(key);
    const n = this.snapshot();
    if (savedId) {
      const saved = n.lessons.find((l) => l.id === savedId);
      if (!saved) throw new Error('This saved lesson is unavailable.');
      return saved;
    }
    const session = sessionId ? n.sessions.find((s) => s.id === sessionId && !s.endedAt) : null;
    if (sessionId && !session) throw new Error('This study session has ended.');
    const existing = n.lessons.find((l) => l.key === key && l.sessionId === sessionId);
    if (existing) return existing;
    const now = new Date().toISOString();
    const lesson: SavedLesson = {
      id: randomUUID(),
      key,
      revision: 1,
      step: 1,
      sessionId,
      source: session?.documentId ? { documentId: session.documentId, page: session.page } : null,
      createdAt: now,
      updatedAt: now,
    };
    n.lessons.push(lesson);
    this.save(n);
    return lesson;
  }
  setLessonStep(id: string, step: number) {
    LessonStep.parse(step);
    const n = this.snapshot(),
      lesson = n.lessons.find((l) => l.id === id);
    if (!lesson) throw new Error('This saved lesson is unavailable.');
    lesson.step = step;
    lesson.updatedAt = new Date().toISOString();
    this.save(n);
    return lesson;
  }
  /** Write the file first, then reference it; a failed save removes the unreferenced file. */
  addMedia(
    meta: Omit<GeneratedMedia, 'id' | 'filename' | 'bytes' | 'createdAt' | 'source'>,
    bytes: Uint8Array,
  ) {
    const n = this.snapshot(),
      id = randomUUID(),
      filename = `${id}.${mediaExtension[meta.contentType]}`,
      path = join(this.mediaDir, filename);
    const session = meta.sessionId ? n.sessions.find((s) => s.id === meta.sessionId) : null;
    const lesson = meta.lessonId ? n.lessons.find((l) => l.id === meta.lessonId) : null;
    if (meta.lessonId && !lesson) throw new Error('This saved lesson is unavailable.');
    const source = session?.documentId
      ? { documentId: session.documentId, page: session.page }
      : (lesson?.source ?? null);
    const media = GeneratedMediaSchema.parse({
      ...meta,
      id,
      filename,
      bytes: bytes.byteLength,
      source,
      sessionId: session ? session.id : null,
      createdAt: new Date().toISOString(),
    });
    const temporary = path + '.tmp',
      fd = openSync(temporary, 'w', 0o600);
    try {
      writeFileSync(fd, bytes);
      fsyncSync(fd);
    } finally {
      closeSync(fd);
    }
    renameSync(temporary, path);
    n.media.push(media);
    this.activity(
      n,
      session?.courseId ?? null,
      `Generated ${media.kind}: ${media.subject.slice(0, 200)}`,
    );
    try {
      this.save(n);
    } catch (error) {
      unlinkSync(path);
      throw error;
    }
    return media;
  }
  addAttempt(input: Omit<PracticeAttempt, 'id' | 'createdAt' | 'source'>) {
    const n = this.snapshot();
    const session = input.sessionId ? n.sessions.find((s) => s.id === input.sessionId) : null;
    const lesson = input.lessonId ? n.lessons.find((l) => l.id === input.lessonId) : null;
    if (input.lessonId && !lesson) throw new Error('This saved lesson is unavailable.');
    const attempt = AttemptSchema.parse({
      ...input,
      id: randomUUID(),
      sessionId: session ? session.id : null,
      source: session?.documentId
        ? { documentId: session.documentId, page: session.page }
        : (lesson?.source ?? null),
      createdAt: new Date().toISOString(),
    });
    n.attempts.push(attempt);
    this.save(n);
    return attempt;
  }
  deleteAttempt(id: string) {
    const n = this.snapshot();
    n.attempts = n.attempts.filter((a) => a.id !== id);
    this.save(n);
  }
  readMedia(id: string): { bytes: Uint8Array; contentType: MediaType } {
    const media = this.state.media.find((m) => m.id === id);
    if (!media) throw new Error('This generated media no longer exists.');
    try {
      return {
        bytes: new Uint8Array(readFileSync(join(this.mediaDir, media.filename))),
        contentType: media.contentType,
      };
    } catch {
      throw new Error('The saved media file is missing. Generate it again.');
    }
  }
  deleteMedia(id: string) {
    const n = this.snapshot();
    n.media = n.media.filter((m) => m.id !== id);
    this.save(n);
    this.cleanupOrphans();
  }
  snapshot() {
    return structuredClone(this.state);
  }
  private save(next: AppState) {
    const valid = StateSchema.parse(next),
      temporary = this.file + '.tmp';
    const fd = openSync(temporary, 'w', 0o600);
    try {
      writeFileSync(fd, JSON.stringify(valid));
      fsyncSync(fd);
    } finally {
      closeSync(fd);
    }
    renameSync(temporary, this.file);
    this.state = valid;
  }
  private activity(
    next: AppState,
    courseId: string | null,
    text: string,
    topicId: string | null = null,
  ) {
    next.activities.unshift({
      id: randomUUID(),
      courseId,
      topicId,
      text,
      createdAt: new Date().toISOString(),
    });
    next.activities = next.activities.slice(0, 100);
  }
  private course(next: AppState, id: string) {
    const c = next.courses.find((x) => x.id === id);
    if (!c) throw new Error('This course no longer exists. Return to your workspace.');
    return c;
  }
  private topic(next: AppState, id: string) {
    const t = next.topics.find((x) => x.id === id);
    if (!t) throw new Error('This topic no longer exists. Choose another topic.');
    return t;
  }
  private parent(next: AppState, id: string | null, courseId: string, self?: string) {
    if (!id) return;
    const seen = new Set(self ? [self] : []);
    let current: string | null = id;
    while (current) {
      if (seen.has(current))
        throw new Error('A topic cannot be placed inside itself or its subtopics.');
      seen.add(current);
      const p = this.topic(next, current);
      if (p.courseId !== courseId) throw new Error('Choose a parent in the same course.');
      current = p.parentId;
    }
  }
  command(input: Command) {
    const cmd = CommandSchema.parse(input);
    const n = this.snapshot();
    switch (cmd.type) {
      case 'course.create': {
        const c: Course = {
          id: randomUUID(),
          title: cmd.title,
          color: cmd.color,
          createdAt: new Date().toISOString(),
        };
        n.courses.push(c);
        this.activity(n, c.id, `Created ${c.title}`);
        break;
      }
      case 'course.rename': {
        const c = this.course(n, cmd.id);
        c.title = cmd.title;
        this.activity(n, c.id, `Renamed course to ${c.title}`);
        break;
      }
      case 'course.delete': {
        this.course(n, cmd.id);
        n.courses = n.courses.filter((c) => c.id !== cmd.id);
        n.topics = n.topics.filter((t) => t.courseId !== cmd.id);
        n.documents = n.documents.filter((d) => d.courseId !== cmd.id);
        n.activities = n.activities.filter((a) => a.courseId !== cmd.id);
        break;
      }
      case 'topic.create': {
        this.course(n, cmd.courseId);
        this.parent(n, cmd.parentId, cmd.courseId);
        const id = randomUUID();
        n.topics.push({
          id,
          courseId: cmd.courseId,
          parentId: cmd.parentId,
          title: cmd.title,
          overview: '',
          order: n.topics.length,
          sourceRefs: [],
          createdAt: new Date().toISOString(),
        });
        this.activity(n, cmd.courseId, `Added ${cmd.title}`, id);
        break;
      }
      case 'topic.update': {
        const t = this.topic(n, cmd.id);
        this.parent(n, cmd.parentId, t.courseId, t.id);
        Object.assign(t, { title: cmd.title, overview: cmd.overview, parentId: cmd.parentId });
        break;
      }
      case 'topic.move': {
        const t = this.topic(n, cmd.id);
        const siblings = n.topics
          .filter((x) => x.courseId === t.courseId && x.parentId === t.parentId)
          .sort((a, b) => a.order - b.order);
        const index = siblings.findIndex((x) => x.id === t.id);
        const to = index + (cmd.direction === 'up' ? -1 : 1);
        if (to >= 0 && to < siblings.length) {
          [siblings[index], siblings[to]] = [siblings[to], siblings[index]];
          siblings.forEach((s, i) => {
            s.order = i;
          });
        }
        break;
      }
      case 'topic.delete': {
        const t = this.topic(n, cmd.id);
        n.topics.forEach((c) => {
          if (c.parentId === t.id) c.parentId = t.parentId;
        });
        n.topics = n.topics.filter((x) => x.id !== t.id);
        n.activities = n.activities.filter((a) => a.topicId !== t.id);
        break;
      }
      case 'topic.open': {
        const t = this.topic(n, cmd.id);
        n.settings.lastTopicId = t.id;
        if (n.activities[0]?.topicId !== t.id || !n.activities[0]?.text.startsWith('Opened '))
          this.activity(n, t.courseId, `Opened ${t.title}`, t.id);
        break;
      }
      case 'document.delete': {
        const d = n.documents.find((x) => x.id === cmd.id);
        if (!d) throw new Error('This PDF no longer exists.');
        n.documents = n.documents.filter((x) => x.id !== cmd.id);
        n.topics.forEach((t) => {
          t.sourceRefs = t.sourceRefs.filter((r) => r.documentId !== cmd.id);
        });
        this.activity(n, d.courseId, 'Removed a PDF');
        break;
      }
      case 'settings.update':
        if (cmd.theme) n.settings.theme = cmd.theme;
        if (cmd.talkKey) n.settings.talkKey = cmd.talkKey;
        if (cmd.proactiveHelp !== undefined) n.settings.proactiveHelp = cmd.proactiveHelp;
        break;
    }
    if (!n.topics.some((t) => t.id === n.settings.lastTopicId)) n.settings.lastTopicId = null;
    n.sessions = n.sessions.filter((s) => !s.topicId || n.topics.some((t) => t.id === s.topicId));
    n.messages = n.messages.filter((m) => n.sessions.some((s) => s.id === m.sessionId));
    n.explanations = n.explanations.filter(
      (e) => !e.topicId || n.topics.some((t) => t.id === e.topicId),
    );
    n.explanations.forEach((e) => {
      if (e.source && !n.documents.some((d) => d.id === e.source!.documentId)) e.source = null;
    });
    for (const m of [...n.media, ...n.attempts]) {
      if (m.source && !n.documents.some((d) => d.id === m.source!.documentId)) m.source = null;
      if (m.sessionId && !n.sessions.some((s) => s.id === m.sessionId)) m.sessionId = null;
    }
    this.save(n);
    this.cleanupOrphans();
    return this.snapshot();
  }
  importPdf(input: ImportPayload, originalName: string, bytes: Uint8Array) {
    const payload = ImportSchema.parse(input),
      n = this.snapshot();
    if (payload.courseId) this.course(n, payload.courseId);
    if (
      payload.pages.some((p, i) => p.page !== i + 1) ||
      payload.headings.some((h) => h.page > payload.pages.length)
    )
      throw new Error('PDF page references are invalid. Please import the file again.');
    const id = randomUUID(),
      filename = id + '.pdf',
      createdAt = new Date().toISOString();
    writeFileSync(join(this.documentsDir, filename), bytes, { mode: 0o600 });
    n.documents.push({
      id,
      courseId: payload.courseId,
      originalName: originalName.slice(0, 240),
      filename,
      pages: payload.pages,
      pageCount: payload.pages.length,
      organization: payload.organization,
      createdAt,
    });
    this.activity(n, payload.courseId, `Added ${originalName.slice(0, 220)}`);
    try {
      this.save(n);
    } catch (error) {
      unlinkSync(join(this.documentsDir, filename));
      throw error;
    }
    return this.snapshot();
  }
  readPdf(id: string) {
    const doc = this.state.documents.find((d) => d.id === id);
    if (!doc) throw new Error('This PDF no longer exists.');
    try {
      return new Uint8Array(readFileSync(join(this.documentsDir, doc.filename)));
    } catch {
      throw new Error('The stored PDF is missing. Remove it and import the original file again.');
    }
  }
  settings(patch: Partial<AppState['settings']>) {
    const n = this.snapshot();
    Object.assign(n.settings, patch);
    this.save(n);
    return this.snapshot();
  }
  startSession(topicId: string | null, mode: 'voice' | 'text', documentId?: string, page = 1) {
    const n = this.snapshot();
    const t = topicId ? this.topic(n, topicId) : null;
    const doc = documentId ? n.documents.find((d) => d.id === documentId) : null;
    if (documentId && (!doc || page > doc.pageCount))
      throw new Error('Choose an existing lecture and slide.');
    const session = StudySessionSchema.parse({
      id: randomUUID(),
      courseId: t?.courseId ?? doc?.courseId ?? null,
      topicId,
      documentId: documentId ?? null,
      page,
      mode,
      startedAt: new Date().toISOString(),
      endedAt: null,
    });
    n.sessions.push(session);
    this.save(n);
    return session;
  }
  setSlide(id: string, page: number) {
    const n = this.snapshot(),
      s = n.sessions.find((s) => s.id === id && !s.endedAt);
    const d = n.documents.find((d) => d.id === s?.documentId);
    if (!s || !d || page < 1 || page > d.pageCount) throw new Error('That slide is unavailable.');
    s.page = page;
    this.save(n);
  }
  endSession(id: string) {
    const n = this.snapshot(),
      s = n.sessions.find((s) => s.id === id);
    if (s && !s.endedAt) {
      s.endedAt = new Date().toISOString();
      this.save(n);
    }
  }
  createChat(
    kind: Chat['kind'],
    title: string,
    sessionId: string | null,
    documentId: string | null = null,
  ) {
    const n = this.snapshot(),
      now = new Date().toISOString();
    const chat = ChatSchema.parse({
      id: randomUUID(),
      kind,
      title: title.slice(0, 80) || 'New chat',
      named: kind === 'lecture',
      documentId,
      sessionId,
      createdAt: now,
      updatedAt: now,
    });
    n.chats.push(chat);
    this.save(n);
    return chat;
  }
  renameChat(id: string, title: string) {
    const n = this.snapshot(),
      chat = n.chats.find((c) => c.id === id);
    if (!chat) return;
    chat.title = title.trim().slice(0, 80) || chat.title;
    chat.named = true;
    this.save(n);
  }
  /** Move messages (a topic change detected after they were saved) into another chat. */
  moveMessages(ids: string[], chatId: string) {
    const n = this.snapshot();
    for (const m of n.messages) if (ids.includes(m.id)) m.chatId = chatId;
    const touched = n.chats.find((c) => c.id === chatId);
    if (touched) touched.updatedAt = new Date().toISOString();
    // A chat left empty by the move disappears.
    n.chats = n.chats.filter(
      (c) => c.kind === 'lecture' || n.messages.some((m) => m.chatId === c.id),
    );
    this.save(n);
  }
  deleteChat(id: string) {
    const n = this.snapshot();
    n.chats = n.chats.filter((c) => c.id !== id);
    n.messages = n.messages.filter((m) => m.chatId !== id);
    n.slideDrawings = n.slideDrawings.filter((d) => d.chatId !== id);
    this.save(n);
  }
  logSlideDrawing(
    chatId: string,
    page: number,
    marks: {
      shape: string;
      label: string | null;
      box: { x: number; y: number; width: number; height: number };
    }[],
  ) {
    const n = this.snapshot();
    n.slideDrawings.push({
      id: randomUUID(),
      chatId,
      page,
      marks: marks.slice(0, 12),
      createdAt: new Date().toISOString(),
    });
    this.save(n);
  }
  addMessage(
    sessionId: string,
    role: TutorMessage['role'],
    text: string,
    eventId?: string,
    place: { chatId?: string | null; page?: number } = {},
  ) {
    const n = this.snapshot();
    if (!n.sessions.some((s) => s.id === sessionId && !s.endedAt))
      throw new Error('This study session has ended.');
    const existing =
      eventId && n.messages.find((m) => m.sessionId === sessionId && m.eventId === eventId);
    if (existing) {
      existing.text = text;
      // A reply can carry on onto the next slide; keep it with the slide it ended on.
      if (place.page) existing.page = place.page;
      this.save(n);
      return existing;
    }
    const m = MessageSchema.parse({
      id: randomUUID(),
      sessionId,
      chatId: place.chatId ?? null,
      page: place.page,
      role,
      text,
      createdAt: new Date().toISOString(),
      eventId,
    });
    n.messages.push(m);
    const chat = place.chatId ? n.chats.find((c) => c.id === place.chatId) : undefined;
    if (chat) chat.updatedAt = m.createdAt;
    this.save(n);
    return m;
  }
  saveExplanation(sessionId: string, title: string, text: string, source: Explanation['source']) {
    const n = this.snapshot(),
      s = n.sessions.find((s) => s.id === sessionId);
    if (!s) throw new Error('This session no longer exists.');
    const existing = n.explanations.find((e) => e.sessionId === sessionId && e.text === text);
    if (existing) return existing;
    const e = ExplanationSchema.parse({
      id: randomUUID(),
      sessionId,
      courseId: s.courseId,
      topicId: s.topicId,
      title,
      text,
      source,
      createdAt: new Date().toISOString(),
    });
    n.explanations.push(e);
    this.activity(n, s.courseId, `Saved ${title}`, s.topicId);
    this.save(n);
    return e;
  }
  deleteSession(id: string) {
    const n = this.snapshot();
    n.sessions = n.sessions.filter((s) => s.id !== id);
    n.messages = n.messages.filter((m) => m.sessionId !== id);
    n.explanations = n.explanations.filter((e) => e.sessionId !== id);
    n.media = n.media.filter((m) => m.sessionId !== id);
    n.attempts = n.attempts.filter((a) => a.sessionId !== id);
    n.chats = n.chats.filter((c) => n.messages.some((m) => m.chatId === c.id));
    n.slideDrawings = n.slideDrawings.filter((d) => n.chats.some((c) => c.id === d.chatId));
    this.save(n);
    this.cleanupOrphans();
  }
  deleteExplanation(id: string) {
    const n = this.snapshot();
    n.explanations = n.explanations.filter((e) => e.id !== id);
    this.save(n);
  }
  private cleanupOrphans() {
    // Delete only UUID-owned files. Never follow paths supplied by the renderer.
    const owned: [string, Set<string>, RegExp][] = [
      [
        this.documentsDir,
        new Set(this.state.documents.map((d) => d.filename)),
        /^[a-f0-9-]{36}\.pdf$/,
      ],
      [this.mediaDir, new Set(this.state.media.map((m) => m.filename)), MediaFilename],
    ];
    for (const [dir, retained, pattern] of owned)
      for (const name of readdirSync(dir))
        if (
          (pattern.test(name) && !retained.has(name)) ||
          /^[a-f0-9-]{36}\.(jpg|png|webp|mp4|webm)\.tmp$/.test(name)
        ) {
          try {
            unlinkSync(join(dir, name));
          } catch {
            /* Retry on next launch/mutation; no data references remain. */
          }
        }
  }
}
import { readdirSync } from 'node:fs';

/** A readable fallback title: the first few words of the first question. */
export function firstWords(text: string) {
  const words = text.replace(/\s+/g, ' ').trim().split(' ').slice(0, 6).join(' ');
  return words.length > 2 ? words.replace(/[?.!,;:]+$/, '') : '';
}
