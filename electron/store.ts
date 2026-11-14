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
  type TutorMessage,
  type Explanation,
} from '../shared/tutor';
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
  readonly file: string;
  constructor(readonly directory: string) {
    mkdirSync(directory, { recursive: true, mode: 0o700 });
    this.documentsDir = join(directory, 'documents');
    mkdirSync(this.documentsDir, { recursive: true, mode: 0o700 });
    this.file = join(directory, 'workspace.json');
    if (existsSync(this.file)) {
      try {
        const raw = JSON.parse(readFileSync(this.file, 'utf8'));
        this.state = StateSchema.parse(
          raw.version === 1
            ? { ...raw, version: 2, sessions: [], messages: [], explanations: [] }
            : raw,
        );
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
  private activity(next: AppState, courseId: string, text: string, topicId: string | null = null) {
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
        n.settings.theme = cmd.theme;
        break;
    }
    if (!n.topics.some((t) => t.id === n.settings.lastTopicId)) n.settings.lastTopicId = null;
    n.sessions = n.sessions.filter((s) => n.topics.some((t) => t.id === s.topicId));
    n.messages = n.messages.filter((m) => n.sessions.some((s) => s.id === m.sessionId));
    n.explanations = n.explanations.filter((e) => n.topics.some((t) => t.id === e.topicId));
    n.explanations.forEach((e) => {
      if (e.source && !n.documents.some((d) => d.id === e.source!.documentId)) e.source = null;
    });
    this.save(n);
    this.cleanupOrphans();
    return this.snapshot();
  }
  importPdf(input: ImportPayload, originalName: string, bytes: Uint8Array) {
    const payload = ImportSchema.parse(input),
      n = this.snapshot();
    this.course(n, payload.courseId);
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
    let parents: { level: number; id: string }[] = [];
    for (const h of payload.headings) {
      while (parents.length && parents[parents.length - 1].level >= h.level) parents.pop();
      const topicId = randomUUID();
      n.topics.push({
        id: topicId,
        courseId: payload.courseId,
        parentId: parents.at(-1)?.id ?? null,
        title: h.title,
        overview: '',
        order: n.topics.length,
        sourceRefs: [{ documentId: id, page: h.page }],
        createdAt,
      });
      parents.push({ level: h.level, id: topicId });
    }
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
  startSession(topicId: string, mode: 'voice' | 'text') {
    const n = this.snapshot(),
      t = this.topic(n, topicId);
    const session = StudySessionSchema.parse({
      id: randomUUID(),
      courseId: t.courseId,
      topicId,
      mode,
      startedAt: new Date().toISOString(),
      endedAt: null,
    });
    n.sessions.push(session);
    this.save(n);
    return session;
  }
  endSession(id: string) {
    const n = this.snapshot(),
      s = n.sessions.find((s) => s.id === id);
    if (s && !s.endedAt) {
      s.endedAt = new Date().toISOString();
      this.save(n);
    }
  }
  addMessage(sessionId: string, role: TutorMessage['role'], text: string, eventId?: string) {
    const n = this.snapshot();
    if (!n.sessions.some((s) => s.id === sessionId && !s.endedAt))
      throw new Error('This study session has ended.');
    const existing =
      eventId && n.messages.find((m) => m.sessionId === sessionId && m.eventId === eventId);
    if (existing) {
      existing.text = text;
      this.save(n);
      return existing;
    }
    const m = MessageSchema.parse({
      id: randomUUID(),
      sessionId,
      role,
      text,
      createdAt: new Date().toISOString(),
      eventId,
    });
    n.messages.push(m);
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
    this.save(n);
  }
  deleteExplanation(id: string) {
    const n = this.snapshot();
    n.explanations = n.explanations.filter((e) => e.id !== id);
    this.save(n);
  }
  private cleanupOrphans() {
    // Delete only UUID-owned PDF files. Never follow paths supplied by the renderer.
    const retained = new Set(this.state.documents.map((d) => d.filename));
    for (const name of readdirOwned(this.documentsDir))
      if (!retained.has(name)) {
        try {
          unlinkSync(join(this.documentsDir, name));
        } catch {
          /* Retry on next launch/mutation; no data references remain. */
        }
      }
  }
}
import { readdirSync } from 'node:fs';
function readdirOwned(dir: string) {
  return readdirSync(dir).filter((name) => /^[a-f0-9-]{36}\.pdf$/.test(name));
}
