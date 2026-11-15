import { lessonContext } from '../shared/lessons';
import { randomUUID } from 'node:crypto';
import {
  SnapshotSchema,
  ToolSchema,
  RuntimeUpdateSchema,
  cleanSpeech,
  type TutorRuntime,
  type SharedSnapshot,
  type Annotation,
  type TutorTool,
} from '../shared/tutor';
import { Store } from './store';
import { Providers, type SlidePrep, type VisionAnswer } from './providers';
import { FalClient } from './fal';
import { GenerateRequestSchema, type GenerateRequest } from '../shared/media';
import type { ScreenDrawing } from '../shared/drawing';
import { anchor, wordsOf } from '../shared/grounding';
import {
  AnswerSchema,
  QuestionId,
  gradeChoice,
  groundMisconceptions,
  misconceptions,
  normalize,
  practice,
  publicQuestion,
  question,
  reviewSuggestions,
  type Answer,
} from '../shared/practice';
export function groundRegions(snapshot: SharedSnapshot, answer: VisionAnswer): Annotation[] {
  const lines = snapshot.textBoxes,
    words = snapshot.words ?? [];
  return answer.regions.flatMap((region) => {
    if (region.confidence < 0.6) return [];
    let box = region.box,
      parts: Annotation['parts'],
      precision: Annotation['precision'] = 'vision-estimate';
    if (snapshot.source.kind === 'pdf' && lines.length) {
      const needle = region.evidence.replace(/\s+/g, ' ').trim();
      const matches = lines.filter((t) => t.text.replace(/\s+/g, ' ').includes(needle));
      // Ambiguous duplicate phrases are not precise anchors.
      if (matches.length !== 1) return [];
      box = matches[0].box;
      precision = 'pdf-text';
    } else if (lines.length) {
      // Screens: snap to the recognised words the model quoted; its box only breaks ties.
      const found = anchor(region.evidence, region.box, words, lines);
      if (found) {
        box = found.box;
        parts = found.parts.length > 1 ? found.parts.slice(0, 4) : undefined;
        precision = 'screen-text';
      } else if (lines.some((l) => region.evidence.length > 3 && l.text.includes(region.evidence)))
        return [];
    }
    return [
      {
        id: randomUUID(),
        snapshotId: snapshot.id,
        shape: region.shape,
        box,
        label: region.label,
        evidence: region.evidence,
        precision,
        ...(parts ? { parts } : {}),
      },
    ];
  });
}
export class TutorService {
  state: TutorRuntime;
  private abort?: AbortController;
  private connecting?: AbortController;
  private generating?: AbortController;
  private celebrating?: ReturnType<typeof setTimeout>;
  /** Slides read ahead in the background, per document and page. */
  private slides = new Map<string, { done: Promise<void>; prep: SlidePrep | null }>();
  /** Start reading a lecture slide ahead of time (fast model). Repeated calls are free. */
  prepareSlide(raw: unknown) {
    const snapshot = SnapshotSchema.parse(raw);
    if (snapshot.source.kind !== 'pdf') throw new Error('Only lecture slides are prepared.');
    const source = snapshot.source;
    const doc = this.store.snapshot().documents.find((d) => d.id === source.documentId);
    if (!doc || source.page > doc.pageCount) throw new Error('That slide is unavailable.');
    const key = `${doc.id}:${source.page}`;
    if (this.slides.has(key)) return { queued: false };
    const entry = { prep: null as SlidePrep | null, done: Promise.resolve() };
    entry.done = this.providers
      .slidePrep(
        snapshot,
        { name: doc.originalName, page: source.page, total: doc.pageCount },
        AbortSignal.timeout(40000),
      )
      .then((prep) => {
        entry.prep = prep;
      })
      .catch(() => {
        this.slides.delete(key); // allow a retry
      });
    this.slides.set(key, entry);
    if (this.slides.size > 600) this.slides.delete(this.slides.keys().next().value!);
    return { queued: true };
  }
  /**
   * What the tutor needs for the slide on screen: its weight (teach / brief / skip), a summary,
   * key points, regions pinned to this slide's words, and the next slide worth teaching.
   */
  async slideBriefing(waitMs = 2500) {
    const snapshot = this.state.snapshot,
      lecture = this.state.lecture;
    if (!snapshot || snapshot.source.kind !== 'pdf' || !lecture) return null;
    const source = snapshot.source;
    const entry = this.slides.get(`${source.documentId}:${source.page}`);
    if (!entry) return null;
    await Promise.race([entry.done, new Promise((r) => setTimeout(r, waitMs))]);
    const prep = entry.prep;
    if (!prep || this.state.snapshot?.id !== snapshot.id) return null;
    const regions = groundRegions(snapshot, { explanation: prep.summary, regions: prep.regions });
    this.state.annotations = [...this.state.annotations, ...regions].slice(-40);
    this.emit();
    let nextTeach: number | null = null;
    for (let p = source.page + 1; p <= lecture.total; p++) {
      const k = this.slides.get(`${source.documentId}:${p}`)?.prep?.kind;
      if (!k) break; // not read yet: unknown
      if (k !== 'skip') {
        nextTeach = p;
        break;
      }
    }
    return {
      slide: source.page,
      total: lecture.total,
      kind: prep.kind,
      why: prep.reason,
      summary: prep.summary,
      keyPoints: prep.keyPoints,
      regions: regions.map((a) => ({ regionId: a.id, label: a.label, evidence: a.evidence })),
      snapshotId: snapshot.id,
      nextTeachingSlide: nextTeach,
    };
  }
  private inventory?: {
    snapshotId: string;
    done: Promise<void>;
    summary: string | null;
    ctl: AbortController;
  };
  constructor(
    readonly store: Store,
    readonly providers: Providers,
    private changed: () => void,
    private openWorkspace: () => void,
    readonly fal = new FalClient({ key: '', imageModel: '', videoModel: '' }),
  ) {
    this.state = {
      chatId: null,
      activeLessonId: null,
      lessonSurface: 'app',
      drawing: null,
      sessionId: null,
      lecture: null,
      lecturePreparing: false,
      status: 'idle',
      mode: 'text',
      activity: 'idle',
      mic: false,
      input: 'idle',
      hotkeyError: '',
      focusRevision: 0,
      sharing: 'off',
      sourceName: '',
      epoch: 0,
      snapshot: null,
      annotations: [],
      focusRegion: null,
      analysis: '',
      latencyMs: null,
      error: '',
      generation: null,
      notice: null,
      practice: null,
      config: { ...providers.status(), media: fal.status() },
    };
  }
  get() {
    return structuredClone(this.state);
  }
  emit() {
    this.changed();
  }
  context(topicId?: string | null, documentId?: string, page = 1) {
    const d = this.store.snapshot(),
      s = d.sessions.find((s) => s.id === this.state.sessionId);
    const topic = d.topics.find((t) => t.id === (topicId ?? s?.topicId));
    const doc = d.documents.find((d) => d.id === (documentId ?? s?.documentId));
    return JSON.stringify({
      visualLesson: this.lessonContext(),
      practice: this.practiceContext(),
      mode: doc ? 'lecture' : 'tutor',
      lecture: doc ? { name: doc.originalName, page: s?.page ?? page, total: doc.pageCount } : null,
      legacyNotes: topic?.overview.slice(0, 6000),
      recentConversation: d.messages
        .filter((m) => m.sessionId === s?.id)
        .slice(-8)
        .map((m) => ({ role: m.role, text: m.text.slice(0, 1600) })),
      screenSharing: this.state.sharing,
      source: this.state.sourceName,
    });
  }
  /** Evidence the tutor may use to resume: latest answers and open review items only. */
  practiceContext() {
    const attempts = this.store.snapshot().attempts;
    if (!attempts.length) return null;
    return {
      recentAnswers: attempts.slice(-6).map((a) => ({
        question: question(a.questionId).prompt,
        verdict: a.verdict,
        possibleMisconceptions: a.misconceptions.map((m) => misconceptions[m.id].description),
        at: a.createdAt,
      })),
      review: reviewSuggestions(attempts).map((r) => ({
        reviewStep: r.step,
        question: question(r.questionId).prompt,
        possibleMisconception: r.misconception ? misconceptions[r.misconception].description : null,
        evidence: r.evidence,
      })),
      note: 'Review items come only from the latest answer to each question, never from time spent.',
    };
  }
  openPractice(id?: string, surface: 'screen' | 'app' = 'app') {
    if (!this.state.activeLessonId) this.openLesson(undefined, surface);
    // Questions whose latest answer needs review come first, then unanswered ones.
    const attempts = this.store.snapshot().attempts;
    const latest = (q: string) => attempts.filter((a) => a.questionId === q).at(-1);
    const chosen = id
      ? QuestionId.parse(id)
      : (
          practice.find((q) => latest(q.id) && latest(q.id)!.verdict !== 'correct') ??
          practice.find((q) => !latest(q.id)) ??
          practice[0]
        ).id;
    this.state.practice = { questionId: chosen, checking: false };
    this.emit();
    return publicQuestion(question(chosen));
  }
  closePractice() {
    this.checking?.abort();
    this.state.practice = null;
    this.emit();
  }
  private checking?: AbortController;
  /** Grades and saves one answer. Misconceptions need evidence in the student's own words. */
  async answerPractice(id: string, raw: Answer, origin: 'student' | 'tutor') {
    const q = question(QuestionId.parse(id));
    let answer = AnswerSchema.parse(raw);
    if (this.state.practice?.checking)
      throw new Error('The previous answer is still being checked.');
    if (!this.state.activeLessonId)
      this.openLesson(undefined, origin === 'tutor' ? this.surface() : 'app');
    const lessonId = this.state.activeLessonId;
    // A spoken or typed option counts as choosing it.
    if (answer.kind === 'text' && q.choices) {
      const typed = normalize(answer.text);
      const match = q.choices.find((c) => normalize(c.text) === typed);
      if (match) answer = { kind: 'choice', choiceId: match.id };
    }
    let answerSource: 'typed' | 'transcript' | 'reported' = 'typed';
    if (origin === 'tutor') {
      const said = this.store
        .snapshot()
        .messages.filter((m) => m.sessionId === this.state.sessionId && m.role === 'user')
        .slice(-4)
        .map((m) => normalize(m.text));
      const words = answer.kind === 'text' ? normalize(answer.text) : '';
      answerSource = words && said.some((s) => s.includes(words)) ? 'transcript' : 'reported';
    }
    this.state.practice = { questionId: q.id, checking: true };
    this.emit();
    const ctl = new AbortController();
    this.checking = ctl;
    try {
      let graded;
      if (answer.kind === 'choice')
        graded = { ...gradeChoice(q, answer.choiceId), grader: 'authored' as const, model: null };
      else {
        const result = await this.providers.grade(q, answer.text, ctl.signal);
        graded = {
          verdict: result.verdict,
          feedback: result.feedback,
          misconceptions: groundMisconceptions(answer.text, result.misconceptions),
          grader: 'claude' as const,
          model: this.providers.config.model,
        };
      }
      if (ctl.signal.aborted) throw new Error('Answer checking was cancelled.');
      // A tutor paraphrase is not the student's own words, so it is never evidence.
      if (answerSource === 'reported') graded.misconceptions = [];
      const attempt = this.store.addAttempt({
        questionId: q.id,
        lessonId,
        sessionId: this.state.sessionId,
        origin,
        answerSource,
        answer,
        ...graded,
      });
      return attempt;
    } finally {
      if (this.checking === ctl) {
        this.checking = undefined;
        if (this.state.practice) this.state.practice.checking = false;
        this.emit();
      }
    }
  }
  lessonContext() {
    const lesson = this.store.snapshot().lessons.find((l) => l.id === this.state.activeLessonId);
    return lesson ? lessonContext(lesson) : null;
  }
  /** Lectures stay in the app; everything else is taught on the user's screen. */
  surface(): 'screen' | 'app' {
    return this.state.lecture ? 'app' : 'screen';
  }
  openLesson(savedId?: string, surface: 'screen' | 'app' = 'app') {
    const lesson = this.store.openLesson('glucose-phosphorylation', this.state.sessionId, savedId);
    // Screen lessons keep the current screen grounding; the authored card does not replace it.
    if (surface === 'app') this.stopSharing(false);
    this.state.activeLessonId = lesson.id;
    this.state.lessonSurface = surface;
    this.emit();
    return this.lessonContext();
  }
  stepLesson(id: string, step: number) {
    if (id !== this.state.activeLessonId)
      throw new Error('Open this lesson before changing its step.');
    this.store.setLessonStep(id, step);
    this.emit();
    return this.lessonContext();
  }
  /** One generation at a time. Resolves when it settles; callers may ignore the promise. */
  generate(raw: GenerateRequest, origin: 'student' | 'tutor') {
    const request = GenerateRequestSchema.parse(raw);
    const current = this.state.generation;
    if (current && ['queued', 'running', 'saving'].includes(current.phase))
      throw new Error('An illustration is already being generated. Cancel it or wait.');
    const lesson = this.store.snapshot().lessons.find((l) => l.id === this.state.activeLessonId);
    const ctl = new AbortController(),
      id = randomUUID(),
      started = Date.now();
    this.generating = ctl;
    this.state.generation = {
      id,
      kind: request.kind,
      subject: request.subject,
      origin,
      lessonId: lesson?.id ?? null,
      lessonStep: lesson?.step ?? null,
      phase: 'queued',
      queuePosition: null,
      startedAt: new Date(started).toISOString(),
      error: '',
      mediaId: null,
      latencyMs: null,
    };
    this.emit();
    const mine = () => this.state.generation?.id === id && this.generating === ctl;
    const settled = (async () => {
      try {
        const out = await this.fal.generate(request.kind, request.subject, ctl.signal, (p) => {
          if (!mine()) return;
          Object.assign(this.state.generation!, p);
          this.emit();
        });
        if (!mine()) return;
        this.state.generation!.phase = 'saving';
        this.emit();
        const media = this.store.addMedia(
          {
            kind: request.kind,
            model: out.model,
            subject: request.subject,
            prompt: out.prompt,
            contentType: out.contentType,
            width: out.width,
            height: out.height,
            requestId: out.requestId,
            origin,
            sessionId: this.state.sessionId,
            lessonId: lesson?.id ?? null,
            lessonStep: lesson?.step ?? null,
          },
          out.bytes,
        );
        if (!mine()) return;
        Object.assign(this.state.generation!, {
          phase: 'done',
          mediaId: media.id,
          latencyMs: Date.now() - started,
        });
      } catch (e) {
        if (this.state.generation?.id !== id) return;
        Object.assign(this.state.generation, {
          phase: ctl.signal.aborted ? 'cancelled' : 'failed',
          error: ctl.signal.aborted
            ? 'Generation cancelled.'
            : e instanceof Error
              ? e.message
              : 'Generation failed. Try again.',
        });
      } finally {
        if (this.generating === ctl) this.generating = undefined;
        this.emit();
      }
    })();
    return { id, settled };
  }
  cancelGeneration() {
    this.generating?.abort();
  }
  dismissGeneration() {
    const g = this.state.generation;
    if (g && ['queued', 'running', 'saving'].includes(g.phase))
      throw new Error('Cancel the generation before dismissing it.');
    this.state.generation = null;
    this.emit();
  }
  /** Map the captured screen while the student is still talking. Never blocks capture. */
  preAnalyze() {
    const snapshot = this.state.snapshot;
    if (!snapshot || snapshot.source.kind !== 'screen' || !this.providers.config.visionKey) return;
    this.inventory?.ctl.abort();
    const ctl = new AbortController(),
      epoch = this.state.epoch;
    const entry = {
      snapshotId: snapshot.id,
      summary: null as string | null,
      ctl,
      done: Promise.resolve(),
    };
    entry.done = (async () => {
      try {
        const map = await this.providers.inventory(snapshot, ctl.signal);
        if (
          ctl.signal.aborted ||
          epoch !== this.state.epoch ||
          this.state.snapshot?.id !== snapshot.id
        )
          return;
        const regions = groundRegions(snapshot, { explanation: map.summary, regions: map.regions });
        this.state.annotations = [...this.state.annotations, ...regions].slice(-40);
        entry.summary = map.summary;
        this.emit();
      } catch {
        /* The tutor can still call analyze_current_screen. */
      }
    })();
    this.inventory = entry;
  }
  /** What the tutor needs to answer and draw at once: summary plus grounded region IDs. */
  async screenMap(timeoutMs = 3500) {
    const entry = this.inventory,
      snapshot = this.state.snapshot;
    if (!entry || !snapshot || entry.snapshotId !== snapshot.id) return null;
    await Promise.race([entry.done, new Promise((r) => setTimeout(r, timeoutMs))]);
    if (this.state.snapshot?.id !== entry.snapshotId || !entry.summary) return null;
    return {
      snapshotId: snapshot.id,
      summary: entry.summary,
      regions: this.state.annotations
        .filter((a) => a.snapshotId === snapshot.id)
        .map((a) => ({ regionId: a.id, label: a.label, evidence: a.evidence })),
    };
  }
  async start(topicId: string | null, mode: 'voice' | 'text', documentId?: string, page = 1) {
    if (this.state.sessionId || this.connecting)
      throw new Error('End the current session before starting another.');
    const context = this.context(topicId, documentId, page),
      ctl = new AbortController();
    this.connecting = ctl;
    this.state.status = 'connecting';
    this.state.error = '';
    this.emit();
    try {
      const signedUrl = await this.providers.signedUrl(ctl.signal);
      if (ctl.signal.aborted) throw new Error('Session start cancelled.');
      const s = this.store.startSession(topicId, mode, documentId, page);
      // Lectures get their own chat. Otherwise continue the latest chat if it was active in the
      // last 30 minutes; the topic check decides whether a new question starts a new one.
      const doc = documentId
        ? this.store.snapshot().documents.find((d) => d.id === documentId)
        : undefined;
      const recent = this.store
        .snapshot()
        .chats.filter((c) => c.kind === 'chat')
        .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0];
      this.state.chatId = doc
        ? this.store.createChat('lecture', doc.originalName, s.id, doc.id).id
        : recent && Date.now() - Date.parse(recent.updatedAt) < 30 * 60_000
          ? recent.id
          : null;
      Object.assign(this.state, {
        sessionId: s.id,
        lecturePreparing: !!documentId,
        lecture: documentId
          ? {
              documentId,
              page,
              total: this.store.snapshot().documents.find((d) => d.id === documentId)!.pageCount,
            }
          : null,
        mode,
        status: 'connecting',
        activity: 'idle',
        mic: false,
        error: '',
      });
      this.emit();
      return { id: s.id, signedUrl, context };
    } catch (e) {
      if (!ctl.signal.aborted) {
        this.state.status = 'error';
        this.state.activity = 'error';
        this.state.input = 'idle';
        this.state.error = e instanceof Error ? e.message : 'Session could not start.';
        this.emit();
      }
      throw e;
    } finally {
      if (this.connecting === ctl) this.connecting = undefined;
    }
  }
  require(id: string) {
    if (
      this.state.sessionId !== id ||
      !this.store.snapshot().sessions.some((s) => s.id === id && !s.endedAt)
    )
      throw new Error('This study session has ended.');
  }
  end(id?: string) {
    this.connecting?.abort();
    this.connecting = undefined;
    if (id && id !== this.state.sessionId) return;
    if (this.state.sessionId) this.store.endSession(this.state.sessionId);
    this.stopSharing(false);
    this.state.drawing = null;
    // The chat itself continues; the next session within 30 minutes picks it up again.
    Object.assign(this.state, {
      sessionId: null,
      lecture: null,
      status: 'idle',
      input: 'idle',
      mic: false,
      activity: 'idle',
    });
    this.emit();
  }
  update(raw: unknown) {
    const p = RuntimeUpdateSchema.parse(raw);
    this.require(p.sessionId);
    Object.assign(this.state, p);
    this.emit();
  }
  private filing?: Promise<void>;
  transcript(sessionId: string, role: 'user' | 'assistant', raw: string, eventId: string) {
    this.require(sessionId);
    // Voice tags are for speech only; store what a reader should see.
    const text = role === 'assistant' ? cleanSpeech(raw) || raw : raw;
    if (!this.state.chatId) {
      this.state.chatId = this.store.createChat('chat', 'New chat', sessionId).id;
    }
    const message = this.store.addMessage(sessionId, role, text, eventId, {
      chatId: this.state.chatId,
      page: this.state.lecture?.page,
    });
    this.emit();
    if (role === 'user' && !this.state.lecture)
      this.filing = this.fileByTopic(sessionId, message.id, text);
  }
  /**
   * Decide which chat a question belongs to. A new subject starts a new, named chat; the
   * question and anything said after it move there.
   */
  private async fileByTopic(sessionId: string, messageId: string, text: string) {
    const chatId = this.state.chatId;
    const data = this.store.snapshot(),
      chat = data.chats.find((c) => c.id === chatId);
    if (!chat || chat.kind !== 'chat') return;
    const earlier = data.messages.filter((m) => m.chatId === chat.id && m.id !== messageId);
    // The drawing on screen when the question arrived; a newer one is the answer's, keep it.
    const shownRevision = this.state.drawing?.revision ?? null;
    try {
      const verdict = await this.providers.topic(
        earlier.length
          ? {
              title: chat.title,
              named: chat.named,
              recent: earlier.slice(-6).map((m) => `${m.role}: ${m.text.slice(0, 300)}`),
            }
          : null,
        text,
        AbortSignal.timeout(15000),
      );
      if (this.state.sessionId !== sessionId) return;
      // A new question clears the last explanation's drawings unless it builds on them.
      if (
        !verdict.buildsOnLast &&
        this.state.drawing &&
        this.state.drawing.revision === shownRevision
      ) {
        this.state.drawing = null;
        this.state.focusRegion = null;
      }
      if (!earlier.length || verdict.sameTopic) {
        if (!chat.named || chat.title !== verdict.title)
          this.store.renameChat(chat.id, verdict.title);
      } else {
        // A new subject: clear the previous explanation's drawings off the screen.
        this.state.drawing = null;
        this.state.focusRegion = null;
        const next = this.store.createChat('chat', verdict.title, sessionId);
        this.store.renameChat(next.id, verdict.title);
        const after = this.store
          .snapshot()
          .messages.filter((m) => m.chatId === chat.id && m.sessionId === sessionId)
          .filter(
            (m) =>
              m.id === messageId ||
              m.createdAt > data.messages.find((x) => x.id === messageId)!.createdAt,
          )
          .map((m) => m.id);
        this.store.moveMessages(after, next.id);
        if (this.state.chatId === chat.id) this.state.chatId = next.id;
      }
      this.emit();
    } catch {
      // Without the topic model, name the chat after its first question.
      try {
        if (!chat.named && !earlier.length) {
          const words = text.replace(/\s+/g, ' ').trim().split(' ').slice(0, 6).join(' ');
          if (words) this.store.renameChat(chat.id, words.replace(/[?.!,;:]+$/, ''));
          this.emit();
        }
      } catch {
        /* The workspace closed meanwhile; the chat keeps its current title. */
      }
    }
  }
  /** For tests: wait until the latest question has been filed. */
  async filed() {
    await this.filing;
  }
  clearDrawing() {
    this.state.drawing = null;
    this.state.focusRegion = null;
    this.emit();
  }
  stopSharing(emit = true) {
    this.abort?.abort();
    this.abort = undefined;
    this.inventory?.ctl.abort();
    this.inventory = undefined;
    // Grounded marks die with their snapshot; a concept diagram does not depend on one.
    const d = this.state.drawing;
    this.state.drawing =
      d?.diagram || d?.sketch
        ? {
            ...d,
            snapshotId: null,
            marks: [],
            connections: [],
            sketch: d.sketch ? { ...d.sketch, near: null } : null,
            revision: d.revision + 1,
          }
        : null;
    if (['thinking', 'pointing'].includes(this.state.activity))
      this.state.activity = this.state.mic ? 'listening' : 'idle';
    Object.assign(this.state, {
      sharing: 'off',
      sourceName: '',
      lecturePreparing: false,
      snapshot: null,
      annotations: [],
      focusRegion: null,
      analysis: '',
      latencyMs: null,
      epoch: this.state.epoch + 1,
    });
    if (emit) this.emit();
  }
  selectWindow(id: string, name: string) {
    if (!this.state.sessionId) throw new Error('Start a study session before sharing a window.');
    this.stopSharing(false);
    this.state.sharing = 'window';
    this.state.sourceName = name;
    this.emit();
    return this.state.epoch;
  }
  acceptSnapshot(raw: unknown, pdf = false) {
    if (!this.state.sessionId) throw new Error('Start a study session before sharing a page.');
    const s = SnapshotSchema.parse(raw);
    if (s.epoch !== this.state.epoch)
      throw new Error('Sharing changed. Choose the page or window again.');
    if (s.source.kind === 'pdf') {
      if (!pdf) throw new Error('Choose Share this page in the PDF viewer.');
      const data = this.store.snapshot();
      const source = s.source,
        document = data.documents.find((d) => d.id === source.documentId),
        session = data.sessions.find((x) => x.id === this.state.sessionId);
      if (
        !document ||
        source.page > document.pageCount ||
        (session?.documentId && document.id !== session.documentId)
      )
        throw new Error('Choose an existing PDF from this session’s lecture.');
      const preparing = this.state.lecturePreparing;
      this.stopSharing(false);
      if (this.state.lecture) {
        this.store.setSlide(this.state.sessionId!, source.page);
        this.state.lecture.page = source.page;
      }
      s.epoch = this.state.epoch;
      this.state.sharing = 'pdf';
      this.state.lecturePreparing = preparing;
      this.state.sourceName = `${document.originalName} · p. ${source.page}`;
    } else if (this.state.sharing !== s.source.kind) throw new Error('Screen sharing is off.');
    this.abort?.abort();
    Object.assign(this.state, {
      snapshot: s,
      annotations: [],
      focusRegion: null,
      analysis: '',
      latencyMs: null,
    });
    this.emit();
  }
  async tool(sessionId: string, input: TutorTool) {
    this.require(sessionId);
    if (this.state.status === 'paused') throw new Error('The session is paused.');
    const tool = ToolSchema.parse(input);
    switch (tool.name) {
      case 'open_visual_lesson': {
        const surface = this.surface();
        this.openLesson(undefined, surface);
        if (surface === 'app') this.openWorkspace();
        return this.stepLesson(this.state.activeLessonId!, tool.step);
      }
      case 'navigate_visual_lesson': {
        if (!this.state.activeLessonId) throw new Error('Open a visual lesson first.');
        return this.stepLesson(this.state.activeLessonId, tool.step);
      }
      case 'generate_illustration': {
        const job = this.generate({ kind: tool.kind, subject: tool.subject }, 'tutor');
        void job.settled;
        return {
          started: true,
          generationId: job.id,
          kind: tool.kind,
          note: 'Generation runs in the background. The app sends a contextual update when it is shown or fails. You cannot see the result: do not describe its contents, and call it an AI-generated visual analogy, not a precise diagram.',
        };
      }
      case 'ask_practice_question': {
        const shown = this.openPractice(
          tool.question,
          this.state.activeLessonId ? this.state.lessonSurface : this.surface(),
        );
        if (this.state.lessonSurface === 'app') this.openWorkspace();
        return {
          ...shown,
          note: 'The question is now shown. Ask it in your own short words, wait for the student, then call record_practice_attempt with their answer verbatim. Do not reveal the answer first.',
        };
      }
      case 'record_practice_attempt': {
        if (this.state.practice?.questionId !== tool.question)
          this.openPractice(
            tool.question,
            this.state.activeLessonId ? this.state.lessonSurface : this.surface(),
          );
        const a = await this.answerPractice(
          tool.question,
          { kind: 'text', text: tool.answer },
          'tutor',
        );
        return {
          verdict: a.verdict,
          feedback: a.feedback,
          answerSource: a.answerSource,
          possibleMisconceptions: a.misconceptions.map((m) => ({
            ...misconceptions[m.id],
            reviewStep: misconceptions[m.id].step,
            evidence: m.evidence,
          })),
          modelAnswer: question(tool.question).modelAnswer,
          note:
            a.answerSource === 'reported'
              ? 'Saved, but the answer did not match the student’s saved words, so no misconception was recorded. Pass their words verbatim next time.'
              : 'Saved locally. Explain kindly using the feedback and correction; call any misconception possible, cite their words, and suggest the review step. Never call it mastery.',
        };
      }
      case 'draw_on_screen': {
        const snapshot = this.state.snapshot;
        if (!snapshot || this.state.sharing === 'off')
          throw new Error(
            'Nothing on screen is grounded yet. Call analyze_current_screen with the question first, then draw on its regions.',
          );
        if (!tool.marks.length && !tool.connections.length)
          throw new Error('Give at least one mark or connection.');
        // Each target is a regionId or a quote of the words; quotes are found on this screen or
        // slide. Unresolvable targets are reported back instead of failing the whole drawing.
        const missed: string[] = [];
        const resolve = (ref: string) => {
          const known = this.state.annotations.find((a) => a.id === ref);
          if (known) return known;
          const found = anchor(ref, null, wordsOf(snapshot), snapshot.textBoxes);
          if (!found) {
            missed.push(ref);
            return null;
          }
          const made: Annotation = {
            id: randomUUID(),
            snapshotId: snapshot.id,
            shape: 'highlight',
            box: found.box,
            label: ref.slice(0, 100),
            evidence: ref.slice(0, 500),
            precision: snapshot.source.kind === 'pdf' ? 'pdf-text' : 'screen-text',
            ...(found.parts.length > 1 ? { parts: found.parts.slice(0, 4) } : {}),
          };
          this.state.annotations = [...this.state.annotations, made].slice(-60);
          return made;
        };
        const marks = tool.marks.flatMap((m) => {
          const r = resolve(m.regionId ?? m.quote!);
          return r
            ? [
                {
                  id: randomUUID(),
                  regionId: r.id,
                  shape: m.shape,
                  label: m.label ?? null,
                  box: r.box,
                  parts: r.parts,
                },
              ]
            : [];
        });
        const connections = tool.connections.flatMap((c) => {
          const a = resolve(c.from),
            b = resolve(c.to);
          return a && b
            ? [{ id: randomUUID(), from: a.box, to: b.box, label: c.label ?? null }]
            : [];
        });
        if (!marks.length && !connections.length)
          throw new Error(
            `Could not find ${missed.map((m) => `"${m}"`).join(', ')} on screen. Quote a few exact words that are visible, or sketch it instead, and keep talking.`,
          );
        const previous =
          !tool.clear && this.state.drawing?.snapshotId === snapshot.id ? this.state.drawing : null;
        const drawing: ScreenDrawing = {
          id: randomUUID(),
          snapshotId: snapshot.id,
          marks: [...(previous?.marks ?? []), ...marks],
          connections: [...(previous?.connections ?? []), ...connections],
          diagram: this.state.drawing?.diagram ?? null,
          sketch: this.state.drawing?.sketch ?? null,
          revision: (this.state.drawing?.revision ?? 0) + 1,
        };
        this.state.drawing = drawing;
        if (this.state.lecture && this.state.chatId && snapshot.source.kind === 'pdf')
          this.store.logSlideDrawing(
            this.state.chatId,
            snapshot.source.page,
            drawing.marks.map((m) => ({ shape: m.shape, label: m.label, box: m.box })),
          );
        this.state.focusRegion = marks[0]?.regionId ?? null;
        this.state.focusRevision++;
        this.state.activity = 'pointing';
        this.emit();
        return {
          drawn: drawing.marks.length + drawing.connections.length,
          where:
            snapshot.source.kind === 'pdf' ? 'on the lecture slide' : 'on the student’s screen',
          note: missed.length
            ? `Drawn, except ${missed.map((m) => `"${m}"`).join(', ')} which is not visible as written.`
            : 'Drawn with a short animation. Refer to it naturally while you explain.',
        };
      }
      case 'sketch_diagram': {
        const current = this.state.drawing;
        this.state.drawing = {
          id: randomUUID(),
          snapshotId: current?.snapshotId ?? null,
          marks: current?.marks ?? [],
          connections: current?.connections ?? [],
          diagram: tool.diagram,
          sketch: null,
          revision: (current?.revision ?? 0) + 1,
        };
        this.emit();
        return {
          shown: true,
          where: this.state.lecture ? 'over the lecture slide' : 'on the student’s screen',
          note: 'The app laid it out and is drawing it now. Walk through it node by node.',
        };
      }
      case 'sketch_on_screen': {
        const current = this.state.drawing;
        const near = tool.near ? this.state.annotations.find((a) => a.id === tool.near) : undefined;
        if (tool.near && !near)
          throw new Error('Use a regionId from the latest screen map, or omit near.');
        this.state.drawing = {
          id: randomUUID(),
          snapshotId: current?.snapshotId ?? null,
          marks: current?.marks ?? [],
          connections: current?.connections ?? [],
          diagram: null,
          sketch: {
            title: tool.title,
            elements: tool.elements,
            captions: tool.captions,
            near: near?.box ?? null,
          },
          revision: (current?.revision ?? 0) + 1,
        };
        if (near) {
          this.state.focusRegion = near.id;
          this.state.focusRevision++;
        }
        this.emit();
        return {
          shown: true,
          where: near ? 'beside the region on screen' : 'in free space on the screen',
          note: 'It draws itself element by element. Talk through it in the same order.',
        };
      }
      case 'celebrate': {
        // A short happy bounce; the companion returns to idle by itself.
        this.state.activity = 'success';
        this.emit();
        clearTimeout(this.celebrating);
        this.celebrating = setTimeout(() => {
          if (this.state.activity === 'success') {
            this.state.activity = 'idle';
            this.emit();
          }
        }, 2600);
        return { celebrated: true };
      }
      case 'clear_screen':
        this.clearDrawing();
        return { cleared: true };
      case 'analyze_current_screen': {
        const snapshot = this.state.snapshot;
        if (!snapshot || this.state.sharing === 'off')
          throw new Error(
            'No current screen is available. Ask the student to hold Yoyo or their talk key again, or check Screen Recording access in Settings.',
          );
        this.abort?.abort();
        const ctl = new AbortController();
        this.abort = ctl;
        const epoch = this.state.epoch,
          started = Date.now();
        this.state.activity = 'thinking';
        this.state.error = '';
        this.emit();
        try {
          const answer = await this.providers.analyze(
            snapshot,
            tool.question,
            this.context(),
            ctl.signal,
          );
          this.require(sessionId);
          if (
            ctl.signal.aborted ||
            epoch !== this.state.epoch ||
            snapshot.id !== this.state.snapshot?.id
          )
            throw new Error('The shared content changed. Analysis was discarded.');
          // Keep the quick map's regions valid; deeper analysis adds to them.
          const fresh = groundRegions(snapshot, answer);
          this.state.annotations = [...this.state.annotations, ...fresh].slice(-40);
          this.state.analysis = answer.explanation;
          this.state.latencyMs = Date.now() - started;
          this.state.activity = this.state.mic ? 'listening' : 'thinking';
          this.emit();
          return {
            explanation: answer.explanation,
            snapshotId: snapshot.id,
            regions: fresh.map((a) => ({
              regionId: a.id,
              label: a.label,
              evidence: a.evidence,
              precision: a.precision,
            })),
            note: 'Teach by drawing: call draw_on_screen with these regionIds (circle, underline, box, arrow, highlight, point, short labels, connections between regions) while you explain. Vision-estimated regions are approximate.',
          };
        } catch (e) {
          if (!ctl.signal.aborted && epoch === this.state.epoch) {
            this.state.error = e instanceof Error ? e.message : 'Analysis failed.';
            this.state.activity = 'error';
            this.emit();
          }
          throw e;
        }
      }
      case 'highlight_screen_region':
      case 'draw_annotation': {
        if (tool.snapshotId !== this.state.snapshot?.id || this.state.sharing === 'off')
          throw new Error('That snapshot is no longer shared. Analyze the current page again.');
        const region = this.state.annotations.find((a) => a.id === tool.regionId);
        if (!region)
          throw new Error('Choose a grounded region returned by analyze_current_screen.');
        region.shape = tool.name === 'highlight_screen_region' ? 'highlight' : tool.shape;
        this.state.focusRegion = region.id;
        this.state.focusRevision++;
        this.state.activity = 'pointing';
        this.emit();
        return { shown: region.label };
      }
      case 'navigate_slide': {
        if (this.state.activeLessonId)
          throw new Error('Close the visual lesson to return to lecture slides.');
        const lecture = this.state.lecture;
        if (!lecture || this.state.sharing === 'off')
          throw new Error('Start or resume a lecture first.');
        if (this.state.lecturePreparing)
          throw new Error('The current slide is still being prepared.');
        this.store.setSlide(sessionId, tool.page);
        this.stopSharing(false);
        // A new slide starts with a clean screen: last slide's marks and sketches go.
        this.state.drawing = null;
        this.state.focusRegion = null;
        lecture.page = tool.page;
        this.state.lecturePreparing = true;
        this.emit();
        return {
          page: tool.page,
          total: lecture.total,
          note: 'Wait for the current slide analysis before teaching.',
        };
      }
      case 'save_explanation': {
        const answer =
          this.store
            .snapshot()
            .messages.filter((m) => m.sessionId === sessionId && m.role === 'assistant')
            .at(-1)?.text ?? this.state.analysis;
        if (!answer) throw new Error('Explain the concept first, then save the explanation.');
        const source = this.state.snapshot?.source;
        const e = this.store.saveExplanation(
          sessionId,
          tool.title,
          cleanSpeech(answer) || answer,
          source?.kind === 'pdf' ? { documentId: source.documentId, page: source.page } : null,
        );
        this.state.activity = 'success';
        this.emit();
        return { saved: true, id: e.id };
      }
      case 'record_learning_interaction':
        this.store.addMessage(sessionId, 'note', tool.note, undefined, {
          chatId: this.state.chatId,
          page: this.state.lecture?.page,
        });
        this.emit();
        return { recorded: true };
    }
  }
  saveMessage(id: string) {
    const d = this.store.snapshot(),
      m = d.messages.find((m) => m.id === id && m.role === 'assistant');
    if (!m) throw new Error('Choose an assistant explanation to save.');
    const s = d.sessions.find((s) => s.id === m.sessionId)!;
    const chat = d.chats.find((c) => c.id === m.chatId);
    const title = chat?.title ?? d.topics.find((t) => t.id === s.topicId)?.title ?? 'Explanation';
    this.store.saveExplanation(
      s.id,
      title,
      cleanSpeech(m.text) || m.text,
      m.page && chat?.documentId ? { documentId: chat.documentId, page: m.page } : null,
    );
    this.emit();
  }
}
