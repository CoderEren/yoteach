import { useEffect, useState, lazy, Suspense } from 'react';
import {
  BookOpen,
  MessageSquare,
  Settings,
  ShieldCheck,
  Upload,
  FileText,
  ArrowRight,
  Sparkles,
} from 'lucide-react';
import type { AppState } from '../shared/model';
import { api, unwrap } from './api';
import { Companion } from './components/Companion';
import { TutorWorkspace } from './components/TutorWorkspace';
import { Modal } from './components/Modal';
import { MediaView } from './components/GeneratedMedia';
import { ReviewList } from './components/Practice';
import { reviewSuggestions } from '../shared/practice';
import { Yoyo } from './components/Yoyo';
import { useTutor } from './tutor';
import { LectureStage } from './components/LectureStage';
import { VisualLesson } from './components/VisualLesson';
import { lessonDefinition } from '../shared/lessons';
import { DesktopOverlay } from './components/DesktopOverlay';
const PdfViewer = lazy(() =>
  import('./components/PdfViewer').then((m) => ({ default: m.PdfViewer })),
);
export default function App() {
  const [data, setData] = useState<AppState | null>(null),
    [mode, setMode] = useState<'tutor' | 'lecture'>('tutor');
  const [lectureId, setLectureId] = useState(''),
    [error, setError] = useState(''),
    [busy, setBusy] = useState('');
  const [settings, setSettings] = useState(false),
    [saved, setSaved] = useState(false),
    [mediaId, setMediaId] = useState<string | null>(null);
  const [viewer, setViewer] = useState<{ id: string; page: number } | null>(null);
  const { runtime: r, act } = useTutor();
  const companion = location.hash === '#/companion';
  const overlay = location.hash === '#/overlay';
  useEffect(() => {
    if (!api) {
      setError('Launch the desktop app with npm run dev.');
      return;
    }
    void unwrap(api.getState())
      .then(setData)
      .catch((e) => setError(e.message));
    return api.onState(setData);
  }, []);
  useEffect(() => {
    document.body.classList.toggle('companion-body', companion || overlay);
    const media = matchMedia('(prefers-color-scheme: dark)');
    const apply = () =>
      (document.documentElement.dataset.theme =
        data?.settings.theme === 'system'
          ? media.matches
            ? 'dark'
            : 'light'
          : (data?.settings.theme ?? 'light'));
    apply();
    media.addEventListener('change', apply);
    return () => media.removeEventListener('change', apply);
  }, [data?.settings.theme]);
  useEffect(() => {
    if (!api || companion) return;
    return api.tutor.onIntent((a) => {
      if (a.type === 'open') {
        setMode(r?.lecture ? 'lecture' : 'tutor');
        if (r?.lecture) setLectureId(r.lecture.documentId);
      }
    });
  }, [r?.lecture]);
  async function importPdf(sample = false) {
    setBusy('Choose a lecture PDF…');
    setError('');
    let token: string | undefined;
    let task: ReturnType<(typeof import('./pdf'))['loadPdf']> | undefined;
    try {
      const selected = await unwrap(api.pickPdf(null, sample));
      if (!selected) return;
      token = selected.token;
      const { loadPdf, extractPdf } = await import('./pdf');
      task = loadPdf(selected.bytes);
      const result = await extractPdf(await task.promise, (p, total) =>
        setBusy(`Reading page ${p} of ${total}…`),
      );
      const next = await unwrap(api.finishImport({ token, courseId: null, ...result }));
      setData(next);
      setLectureId(next.documents.at(-1)!.id);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      if (token) await api.cancelImport(token);
      await task?.destroy();
      setBusy('');
    }
  }
  if (!data)
    return (
      <div className="launch-message">
        <Yoyo />
        <p role="status">{error || 'Opening your workspace…'}</p>
      </div>
    );
  if (companion) return <Companion data={data} />;
  if (overlay) return <DesktopOverlay />;
  const lesson = data.lessons.find((l) => l.id === r?.activeLessonId);
  const media = data.media.find((m) => m.id === mediaId);
  if (lesson)
    return (
      <VisualLesson key={lesson.id} saved={lesson} media={data.media} attempts={data.attempts} />
    );
  if (r?.lecture) return <LectureStage media={data.media} />;
  const doc = data.documents.find((d) => d.id === viewer?.id);
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="titlebar-space" />
        <button className="brand" aria-label="yoteach home" onClick={() => setMode('tutor')}>
          yoteach<span className="brand-period">.</span>
        </button>
        <nav className="primary-nav" aria-label="Main navigation">
          <button
            className={mode === 'tutor' ? 'active' : ''}
            disabled={!!r?.sessionId && !!r.lecture}
            onClick={() => setMode('tutor')}
          >
            <MessageSquare size={18} />
            AI tutor
          </button>
          <button
            className={mode === 'lecture' ? 'active' : ''}
            disabled={!!r?.sessionId && !r.lecture}
            onClick={() => setMode('lecture')}
          >
            <BookOpen size={18} />
            Lecture walkthrough
          </button>
        </nav>
        <div className="sidebar-empty">
          A question or a whole lecture.
          <br />A little more clarity.
        </div>
        <div className="sidebar-bottom">
          <div className="sidebar-companion">
            <div className="mini-yoyo">
              <Yoyo />
            </div>
            <strong>Yoyo is here.</strong>
            <button
              className="icon-button"
              aria-label="Show Yoyo"
              onClick={() => void api.companion('show')}
            >
              <ArrowRight size={16} />
            </button>
          </div>
          <button className="sidebar-setting" onClick={() => setSaved(true)}>
            <FileText size={17} />
            Saved material
          </button>
          <button className="sidebar-setting" onClick={() => setSettings(true)}>
            <Settings size={17} />
            Settings
          </button>
          <div className="sidebar-local">
            <ShieldCheck size={13} />
            Saved on this Mac
          </div>
        </div>
      </aside>
      <main className="main-shell">
        <header className="topbar">
          <div className="breadcrumbs">{mode === 'tutor' ? 'AI tutor' : 'Lecture walkthrough'}</div>
          <button className="topbar-yoyo" onClick={() => void api.companion('show')}>
            Show Yoyo
          </button>
        </header>
        <div className="main-scroll">
          {error && (
            <div className="banner error" role="alert">
              {error}
              <button onClick={() => setError('')}>Dismiss</button>
            </div>
          )}
          {busy && (
            <div className="banner import-progress" role="status">
              {busy}
            </div>
          )}
          {mode === 'lecture' ? (
            <section className="lecture-launch">
              <button
                className="lecture-upload glass"
                disabled={!!busy}
                onClick={() => void importPdf()}
              >
                <Upload size={30} />
                <strong>
                  {data.documents.find((d) => d.id === lectureId)?.originalName ??
                    'Upload your lecture'}
                </strong>
                <span>
                  {lectureId ? 'Click to replace · PDF' : 'Choose a PDF of your lecture slides'}
                </span>
              </button>
              <button
                className="button primary lecture-run"
                disabled={
                  !lectureId ||
                  !!busy ||
                  !r?.config.voice ||
                  !r?.config.vision ||
                  r?.status === 'connecting'
                }
                onClick={() =>
                  void act({
                    type: 'start',
                    topicId: null,
                    documentId: lectureId,
                    page: data.sessions.filter((s) => s.documentId === lectureId).at(-1)?.page ?? 1,
                    mode: 'voice',
                  })
                }
              >
                {r?.status === 'connecting' ? 'Opening lecture…' : 'Run me through the lecture'}
              </button>
              {r?.error && (
                <p role="alert" className="error-message">
                  {r.error}
                </p>
              )}
            </section>
          ) : (
            <TutorWorkspace data={data} onOpenPdf={(id, page) => setViewer({ id, page })} />
          )}
        </div>
      </main>
      {settings && (
        <Modal title="Make yourself at home." onClose={() => setSettings(false)}>
          <h3>Hold to talk</h3>
          <label className="talk-key-setting">
            Global talk key
            <select
              aria-label="Global talk key"
              value={data.settings.talkKey}
              onChange={(e) =>
                void unwrap(
                  api.command({
                    type: 'settings.update',
                    talkKey: e.target.value as AppState['settings']['talkKey'],
                  }),
                ).then(setData)
              }
            >
              <option value="control">Control</option>
              <option value="right-control">Right Control</option>
              <option value="fn">Fn / Globe</option>
              <option value="right-option">Right Option</option>
              <option value="f8">F8</option>
            </select>
          </label>
          <p>
            Hold to listen; release to send. You can also hold Yoyo. Drag Yoyo to choose where it
            returns after pointing.
          </p>
          {r?.hotkeyError && (
            <p role="alert" className="error-message">
              {r.hotkeyError}
            </p>
          )}
          <p>
            Fn may also trigger the macOS Globe action. Choose “Do Nothing” for that key in macOS
            Keyboard settings if needed.
          </p>
          <h3>Appearance</h3>
          <div className="source-actions">
            {(['system', 'light', 'dark'] as const).map((theme) => (
              <button
                className="button"
                key={theme}
                onClick={() =>
                  void unwrap(api.command({ type: 'settings.update', theme })).then(setData)
                }
              >
                {theme[0].toUpperCase() + theme.slice(1)}
              </button>
            ))}
          </div>
          <p>
            Released voice questions and conversation text go to ElevenLabs. Holding the talk key or
            Yoyo captures the display under your pointer; that image goes to Anthropic when your
            question needs it. Lecture slides are analyzed directly. Transcripts and saved
            explanations stay on this Mac; provider retention follows your account settings.
          </p>
          <p>
            macOS may attribute development permissions to Electron or the terminal that launched
            it. Internal PDFs do not require Screen Recording.
          </p>
        </Modal>
      )}
      {saved && (
        <Modal title="Saved material" onClose={() => setSaved(false)}>
          <div className="saved-material">
            {data.lessons.map((l) => (
              <button
                className="button"
                key={l.id}
                onClick={() => {
                  setSaved(false);
                  void act({ type: 'lesson-open', lesson: l.key, savedId: l.id });
                }}
              >
                <BookOpen size={16} />
                {lessonDefinition(l.key).title} · Step {l.step}
              </button>
            ))}
            {data.attempts.length > 0 && (
              <article className="saved-practice">
                <h3>Practice & review</h3>
                <p>
                  {data.attempts.length} saved {data.attempts.length === 1 ? 'answer' : 'answers'} ·
                  review is based only on your latest answer to each question.
                </p>
                <ReviewList items={reviewSuggestions(data.attempts)} />
                <button
                  className="button small"
                  onClick={() => {
                    setSaved(false);
                    void act({ type: 'lesson-open', lesson: 'glucose-phosphorylation' }).then(() =>
                      act({ type: 'practice-open' }),
                    );
                  }}
                >
                  Open practice
                </button>
              </article>
            )}
            {[...data.media].reverse().map((m) => (
              <button
                className="button"
                key={m.id}
                onClick={() => {
                  setSaved(false);
                  setMediaId(m.id);
                }}
              >
                <Sparkles size={16} />
                {m.kind === 'video' ? 'Clip' : 'Visual analogy'} ·{' '}
                {m.lessonStep ? `Lesson step ${m.lessonStep} · ` : ''}
                {m.subject.slice(0, 70)}
                {m.subject.length > 70 ? '…' : ''}
              </button>
            ))}
            {data.documents.map((d) => (
              <button
                className="button"
                key={d.id}
                onClick={() => {
                  setLectureId(d.id);
                  setMode('lecture');
                  setViewer({ id: d.id, page: 1 });
                  setSaved(false);
                }}
              >
                <FileText size={16} />
                {d.originalName}
              </button>
            ))}
            {data.explanations.map((e) => (
              <article key={e.id}>
                <h3>{e.title}</h3>
                <p>{e.text}</p>
              </article>
            ))}
            {data.topics
              .filter((t) => t.overview)
              .map((t) => (
                <article key={t.id}>
                  <h3>{t.title}</h3>
                  <p>{t.overview}</p>
                  <small>Preserved note from your previous workspace</small>
                </article>
              ))}
            {!data.lessons.length &&
              !data.media.length &&
              !data.attempts.length &&
              !data.documents.length &&
              !data.explanations.length &&
              !data.topics.some((t) => t.overview) && (
                <p>
                  Your PDFs, lessons, generated visuals, saved explanations and preserved notes will
                  appear here.
                </p>
              )}
          </div>
        </Modal>
      )}
      {media && (
        <Modal title="Generated visual" onClose={() => setMediaId(null)}>
          <MediaView media={media} />
          <p className="generated-media-meta">
            {media.subject}
            <br />
            <small>
              Generated {new Date(media.createdAt).toLocaleString()} ·{' '}
              {media.origin === 'tutor' ? 'requested by Yoyo' : 'requested by you'}
              {media.lessonStep ? ` · glucose lesson step ${media.lessonStep}` : ''}
              {media.source
                ? ` · ${data.documents.find((d) => d.id === media.source!.documentId)?.originalName ?? 'lecture'} p. ${media.source.page}`
                : ''}
            </small>
          </p>
        </Modal>
      )}
      {viewer && doc && (
        <Suspense fallback={<p>Opening PDF…</p>}>
          <PdfViewer document={doc} initialPage={viewer.page} onClose={() => setViewer(null)} />
        </Suspense>
      )}
    </div>
  );
}
