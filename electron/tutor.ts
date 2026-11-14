import { randomUUID } from 'node:crypto';
import {
  SnapshotSchema,
  ToolSchema,
  RuntimeUpdateSchema,
  type TutorRuntime,
  type SharedSnapshot,
  type Annotation,
  type TutorTool,
} from '../shared/tutor';
import { Store } from './store';
import { Providers, type VisionAnswer } from './providers';
export function groundRegions(snapshot: SharedSnapshot, answer: VisionAnswer): Annotation[] {
  return answer.regions.flatMap((region) => {
    if (region.confidence < 0.7) return [];
    let box = region.box;
    if (snapshot.source.kind === 'pdf' && snapshot.textBoxes.length) {
      const needle = region.evidence.replace(/\s+/g, ' ').trim();
      const matches = snapshot.textBoxes.filter((t) =>
        t.text.replace(/\s+/g, ' ').includes(needle),
      );
      // Ambiguous duplicate phrases are not precise anchors.
      if (matches.length !== 1) return [];
      box = matches[0].box;
    }
    return [
      {
        id: randomUUID(),
        snapshotId: snapshot.id,
        shape: region.shape,
        box,
        label: region.label,
        evidence: region.evidence,
        precision:
          snapshot.source.kind === 'pdf' && snapshot.textBoxes.length
            ? ('pdf-text' as const)
            : ('vision-estimate' as const),
      },
    ];
  });
}
export class TutorService {
  state: TutorRuntime;
  private abort?: AbortController;
  private connecting?: AbortController;
  constructor(
    readonly store: Store,
    readonly providers: Providers,
    private changed: () => void,
    private navigate: (id: string) => void,
  ) {
    this.state = {
      sessionId: null,
      status: 'idle',
      mode: 'text',
      activity: 'idle',
      mic: false,
      sharing: 'off',
      sourceName: '',
      epoch: 0,
      snapshot: null,
      annotations: [],
      analysis: '',
      latencyMs: null,
      error: '',
      config: providers.status(),
    };
  }
  get() {
    return structuredClone(this.state);
  }
  emit() {
    this.changed();
  }
  context(topicId?: string) {
    const d = this.store.snapshot(),
      s = d.sessions.find((s) => s.id === this.state.sessionId),
      topic = d.topics.find((t) => t.id === (topicId ?? s?.topicId));
    if (!topic) throw new Error('Choose an existing topic first.');
    return JSON.stringify({
      topicId: topic.id,
      topic: topic.title,
      course: d.courses.find((c) => c.id === topic.courseId)?.title,
      notes: topic.overview.slice(0, 6000),
      sources: topic.sourceRefs.slice(0, 4).map((r) => ({
        page: r.page,
        name: d.documents.find((d) => d.id === r.documentId)?.originalName,
        text: d.documents
          .find((d) => d.id === r.documentId)
          ?.pages[r.page - 1]?.text.slice(0, 4000),
      })),
      savedExplanations: d.explanations
        .filter((e) => e.topicId === topic.id)
        .slice(-3)
        .map((e) => e.text.slice(0, 1600)),
      recentConversation: d.messages
        .filter((m) => m.sessionId === s?.id)
        .slice(-8)
        .map((m) => ({ role: m.role, text: m.text.slice(0, 1600) })),
      availableTopics: d.topics
        .filter((t) => t.courseId === topic.courseId)
        .slice(0, 100)
        .map((t) => ({ id: t.id, title: t.title })),
      screenSharing: this.state.sharing,
      source: this.state.sourceName,
    });
  }
  async start(topicId: string, mode: 'voice' | 'text') {
    if (this.state.sessionId || this.connecting)
      throw new Error('End the current session before starting another.');
    const context = this.context(topicId),
      ctl = new AbortController();
    this.connecting = ctl;
    this.state.status = 'connecting';
    this.state.error = '';
    this.emit();
    try {
      const signedUrl = await this.providers.signedUrl(ctl.signal);
      if (ctl.signal.aborted) throw new Error('Session start cancelled.');
      const s = this.store.startSession(topicId, mode);
      Object.assign(this.state, {
        sessionId: s.id,
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
    Object.assign(this.state, { sessionId: null, status: 'idle', mic: false, activity: 'idle' });
    this.emit();
  }
  update(raw: unknown) {
    const p = RuntimeUpdateSchema.parse(raw);
    this.require(p.sessionId);
    Object.assign(this.state, p);
    this.emit();
  }
  transcript(sessionId: string, role: 'user' | 'assistant', text: string, eventId: string) {
    this.require(sessionId);
    this.store.addMessage(sessionId, role, text, eventId);
    this.emit();
  }
  stopSharing(emit = true) {
    this.abort?.abort();
    this.abort = undefined;
    if (['thinking', 'pointing'].includes(this.state.activity))
      this.state.activity = this.state.mic ? 'listening' : 'idle';
    Object.assign(this.state, {
      sharing: 'off',
      sourceName: '',
      snapshot: null,
      annotations: [],
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
      if (!document || source.page > document.pageCount || document.courseId !== session?.courseId)
        throw new Error('Share a PDF from the current session’s course.');
      this.stopSharing(false);
      s.epoch = this.state.epoch;
      this.state.sharing = 'pdf';
      this.state.sourceName = `${document.originalName} · p. ${source.page}`;
    } else if (this.state.sharing !== 'window') throw new Error('Window sharing is off.');
    this.abort?.abort();
    Object.assign(this.state, { snapshot: s, annotations: [], analysis: '', latencyMs: null });
    this.emit();
  }
  async tool(sessionId: string, input: TutorTool) {
    this.require(sessionId);
    if (this.state.status === 'paused') throw new Error('The session is paused.');
    const tool = ToolSchema.parse(input);
    switch (tool.name) {
      case 'analyze_current_screen': {
        const snapshot = this.state.snapshot;
        if (!snapshot || this.state.sharing === 'off')
          throw new Error(
            'Nothing is shared. Ask the student to share a PDF page or choose a window.',
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
          this.state.annotations = groundRegions(snapshot, answer);
          this.state.analysis = answer.explanation;
          this.state.latencyMs = Date.now() - started;
          this.state.activity = this.state.annotations.length ? 'pointing' : 'idle';
          this.emit();
          return {
            explanation: answer.explanation,
            snapshotId: snapshot.id,
            regions: this.state.annotations.map((a) => ({
              regionId: a.id,
              label: a.label,
              evidence: a.evidence,
              precision: a.precision,
            })),
            note: 'Annotations are visible in the shared-page panel. Vision-estimated regions may be approximate.',
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
        this.state.activity = 'pointing';
        this.emit();
        return { shown: region.label };
      }
      case 'open_topic': {
        const d = this.store.snapshot(),
          current = d.sessions.find((s) => s.id === sessionId),
          topic = d.topics.find((t) => t.id === tool.topicId);
        if (!topic || topic.courseId !== current?.courseId)
          throw new Error('Choose a topic from the current course.');
        this.store.command({ type: 'topic.open', id: topic.id });
        this.navigate(topic.id);
        this.emit();
        return {
          opened: topic.title,
          note: 'Session memory stays attached to the topic selected at session start.',
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
          answer,
          source?.kind === 'pdf' ? { documentId: source.documentId, page: source.page } : null,
        );
        this.state.activity = 'success';
        this.emit();
        return { saved: true, id: e.id };
      }
      case 'record_learning_interaction':
        this.store.addMessage(sessionId, 'note', tool.note);
        this.emit();
        return { recorded: true };
    }
  }
  saveMessage(id: string) {
    const d = this.store.snapshot(),
      m = d.messages.find((m) => m.id === id && m.role === 'assistant');
    if (!m) throw new Error('Choose an assistant explanation to save.');
    const s = d.sessions.find((s) => s.id === m.sessionId)!;
    const title = d.topics.find((t) => t.id === s.topicId)?.title ?? 'Saved explanation';
    this.store.saveExplanation(s.id, title, m.text, null);
    this.emit();
  }
}
