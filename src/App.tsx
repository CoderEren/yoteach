import { useEffect, useState, lazy, Suspense } from 'react';
import {
  BookOpen,
  MessageSquare,
  Settings,
  ShieldCheck,
  Upload,
  FileText,
  ArrowRight,
} from 'lucide-react';
import type { AppState } from '../shared/model';
import { api, unwrap } from './api';
import { Companion } from './components/Companion';
import { TutorWorkspace } from './components/TutorWorkspace';
import { Modal } from './components/Modal';
import { Yoyo } from './components/Yoyo';
import { useTutor } from './tutor';
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
    [saved, setSaved] = useState(false);
  const [viewer, setViewer] = useState<{ id: string; page: number } | null>(null);
  const { runtime: r } = useTutor();
  const companion = location.hash === '#/companion';
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
    document.body.classList.toggle('companion-body', companion);
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
          {mode === 'lecture' && !r?.sessionId && (
            <section className="lecture-library glass">
              <div>
                <h1>Your lecture, explained.</h1>
                <p>
                  Upload your slides as a PDF. Yoyo teaches each slide and makes room for your
                  questions.
                </p>
                <p className="privacy-caption">
                  PDF only · Export PowerPoint or Keynote slides to PDF first.
                </p>
              </div>
              <div className="source-actions">
                <button
                  className="button primary"
                  disabled={!!busy}
                  onClick={() => void importPdf()}
                >
                  <Upload size={17} />
                  Upload lecture PDF
                </button>
                <button
                  className="text-button"
                  disabled={!!busy}
                  onClick={() => void importPdf(true)}
                >
                  Try a sample lecture
                </button>
              </div>
              {!!data.documents.length && (
                <label>
                  Choose your lecture
                  <select
                    aria-label="Choose your lecture"
                    value={lectureId}
                    onChange={(e) => setLectureId(e.target.value)}
                  >
                    <option value="">Select a PDF</option>
                    {data.documents.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.originalName}
                      </option>
                    ))}
                  </select>
                </label>
              )}
              {lectureId && (
                <button
                  className="text-button"
                  onClick={() => setViewer({ id: lectureId, page: 1 })}
                >
                  Preview lecture slides
                </button>
              )}
            </section>
          )}
          {(mode === 'tutor' || lectureId) && (
            <TutorWorkspace
              key={mode}
              data={data}
              lectureId={mode === 'lecture' ? lectureId : undefined}
              onOpenPdf={(id, page) => setViewer({ id, page })}
            />
          )}
        </div>
      </main>
      {settings && (
        <Modal title="Make yourself at home." onClose={() => setSettings(false)}>
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
            Microphone audio and conversation text go to ElevenLabs. Explicitly shared slide or
            window images go to Anthropic for analysis. Transcripts and saved explanations stay on
            this Mac; provider retention follows your account settings.
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
            {data.documents.map((d) => (
              <button
                className="button"
                key={d.id}
                onClick={() => {
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
            {!data.documents.length &&
              !data.explanations.length &&
              !data.topics.some((t) => t.overview) && (
                <p>Your PDFs, saved explanations and preserved notes will appear here.</p>
              )}
          </div>
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
