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
  BookmarkX,
} from 'lucide-react';
import type { AppState } from '../shared/model';
import { api, unwrap } from './api';
import { Companion } from './components/Companion';
import { Chats } from './components/Chats';
import { Lectures } from './components/Lectures';
import { Modal } from './components/Modal';
import { MediaView } from './components/GeneratedMedia';
import { cleanSpeech } from '../shared/tutor';

/** Split a spoken explanation into readable paragraphs of two or three sentences. */
function paragraphs(text: string) {
  const given = text
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean);
  if (given.length > 1) return given;
  const sentences = text.match(/[^.!?]+[.!?]+["”’)]*\s*|[^.!?]+$/g) ?? [text];
  const out: string[] = [];
  for (let i = 0; i < sentences.length; i += 3)
    out.push(
      sentences
        .slice(i, i + 3)
        .join('')
        .trim(),
    );
  return out.filter(Boolean);
}
import { Yoyo } from './components/Yoyo';
import { useTutor } from './tutor';
import { LectureStage } from './components/LectureStage';
import { DesktopOverlay } from './components/DesktopOverlay';
const PdfViewer = lazy(() =>
  import('./components/PdfViewer').then((m) => ({ default: m.PdfViewer })),
);
export default function App() {
  const [data, setData] = useState<AppState | null>(null),
    [mode, setMode] = useState<'chats' | 'lectures'>('chats');
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
        setMode(r?.lecture ? 'lectures' : 'chats');
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
  if (overlay) return <DesktopOverlay data={data} />;
  const media = data.media.find((m) => m.id === mediaId);
  if (r?.lecture) return <LectureStage media={data.media} />;
  const doc = data.documents.find((d) => d.id === viewer?.id);
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="titlebar-space" />
        <button className="brand" aria-label="yoteach home" onClick={() => setMode('chats')}>
          yoteach<span className="brand-period">.</span>
        </button>
        <nav className="primary-nav" aria-label="Main navigation">
          <button
            className={mode === 'chats' ? 'active' : ''}
            aria-current={mode === 'chats' ? 'page' : undefined}
            onClick={() => setMode('chats')}
          >
            <MessageSquare size={18} />
            Chats
          </button>
          <button
            className={mode === 'lectures' ? 'active' : ''}
            aria-current={mode === 'lectures' ? 'page' : undefined}
            onClick={() => setMode('lectures')}
          >
            <BookOpen size={18} />
            Lectures
          </button>
        </nav>
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
          {mode === 'lectures' ? (
            <Lectures
              data={data}
              lectureId={lectureId}
              busy={busy}
              onUpload={() => void importPdf()}
            />
          ) : (
            <Chats data={data} />
          )}
        </div>
      </main>
      {settings && (
        <Modal title="Settings" onClose={() => setSettings(false)}>
          <div className="settings">
            <section className="settings-group">
              <h3>Talk to Yoyo</h3>
              <div className="settings-row">
                <div>
                  <label htmlFor="talk-key">Talk key</label>
                  <p>Hold anywhere to ask; release to send. You can also hold Yoyo.</p>
                </div>
                <select
                  id="talk-key"
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
              </div>
              {data.settings.talkKey === 'fn' && (
                <p className="settings-hint">
                  Fn can also open the macOS emoji picker. Set “Press 🌐 key to” Do Nothing in
                  Keyboard settings.
                </p>
              )}
              {r?.hotkeyError && (
                <p role="alert" className="settings-hint error-message">
                  {r.hotkeyError}
                </p>
              )}
            </section>
            <section className="settings-group">
              <h3>Help when I’m stuck</h3>
              <div className="settings-row">
                <div>
                  <label htmlFor="proactive-help">Offer help</label>
                  <p>
                    Offer help when the same text stays on screen for a while. This check reads the
                    screen on your Mac only; nothing is sent.
                  </p>
                </div>
                <input
                  id="proactive-help"
                  type="checkbox"
                  role="switch"
                  className="switch"
                  checked={data.settings.proactiveHelp}
                  onChange={(e) =>
                    void unwrap(
                      api.command({ type: 'settings.update', proactiveHelp: e.target.checked }),
                    ).then(setData)
                  }
                />
              </div>
            </section>
            <section className="settings-group">
              <h3>Appearance</h3>
              <div className="settings-row">
                <div>
                  <span className="settings-label">Theme</span>
                  <p>Follows macOS unless you choose.</p>
                </div>
                <div className="segmented" role="radiogroup" aria-label="Theme">
                  {(['system', 'light', 'dark'] as const).map((theme) => (
                    <button
                      key={theme}
                      role="radio"
                      aria-checked={data.settings.theme === theme}
                      onClick={() =>
                        void unwrap(api.command({ type: 'settings.update', theme })).then(setData)
                      }
                    >
                      {theme[0].toUpperCase() + theme.slice(1)}
                    </button>
                  ))}
                </div>
              </div>
            </section>
            <section className="settings-group">
              <h3>Privacy</h3>
              <ul className="settings-facts">
                <li>
                  <strong>Your voice</strong> is recorded only while you hold the key, then sent to
                  ElevenLabs.
                </li>
                <li>
                  <strong>Your screen</strong>: holding the key captures the display under your
                  pointer for Anthropic to read. Yoteach’s own windows are left out.
                </li>
                <li>
                  <strong>Chats, lectures and saved work</strong> stay on this Mac. Provider
                  retention follows your account settings.
                </li>
              </ul>
            </section>
          </div>
        </Modal>
      )}
      {saved && (
        <Modal title="Saved material" onClose={() => setSaved(false)}>
          <div className="saved-material">
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
                {m.kind === 'video' ? 'Clip' : 'Image'} · {m.subject.slice(0, 70)}
                {m.subject.length > 70 ? '…' : ''}
              </button>
            ))}
            {data.documents.map((d) => (
              <button
                className="button"
                key={d.id}
                onClick={() => {
                  setLectureId(d.id);
                  setMode('lectures');
                  setViewer({ id: d.id, page: 1 });
                  setSaved(false);
                }}
              >
                <FileText size={16} />
                {d.originalName}
              </button>
            ))}
            {data.explanations.length > 0 && <h3 className="saved-heading">Saved explanations</h3>}
            {[...data.explanations].reverse().map((e) => {
              const doc = e.source && data.documents.find((d) => d.id === e.source!.documentId);
              return (
                <article key={e.id} className="saved-explanation">
                  <header>
                    <div>
                      <h4>{e.title}</h4>
                      <small>
                        {new Date(e.createdAt).toLocaleDateString([], {
                          day: 'numeric',
                          month: 'short',
                        })}
                        {doc ? ` · ${doc.originalName}, slide ${e.source!.page}` : ''}
                      </small>
                    </div>
                    <button
                      className="button small"
                      onClick={() => void unwrap(api.tutor.deleteExplanation(e.id))}
                    >
                      <BookmarkX size={14} /> Unsave
                    </button>
                  </header>
                  {paragraphs(cleanSpeech(e.text)).map((p, i) => (
                    <p key={i}>{p}</p>
                  ))}
                </article>
              );
            })}
            {data.topics
              .filter((t) => t.overview)
              .map((t) => (
                <article key={t.id}>
                  <h3>{t.title}</h3>
                  <p>{t.overview}</p>
                  <small>Preserved note from your previous workspace</small>
                </article>
              ))}
            {!data.media.length &&
              !data.documents.length &&
              !data.explanations.length &&
              !data.topics.some((t) => t.overview) && (
                <p>
                  Your PDFs, generated images and clips, saved explanations and preserved notes will
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
