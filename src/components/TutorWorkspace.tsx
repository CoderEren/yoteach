import { useEffect, useState } from 'react';
import {
  Mic,
  MicOff,
  MonitorUp,
  MonitorOff,
  Pause,
  Square,
  Send,
  MessageSquare,
  Bookmark,
  Trash2,
  Check,
  BookOpen,
  ArrowUpRight,
} from 'lucide-react';
import type { AppState } from '../../shared/model';
import type { Annotation, WindowSource } from '../../shared/tutor';
import { useTutor } from '../tutor';
import { api, unwrap } from '../api';
import { Yoyo } from './Yoyo';
import { Modal } from './Modal';
export function AnnotationLayer({ annotations }: { annotations: Annotation[] }) {
  return (
    <svg
      className="annotation-layer"
      viewBox="0 0 1000 1000"
      preserveAspectRatio="none"
      aria-hidden="true"
    >
      {annotations.map((a, i) => {
        const x = a.box.x * 1000,
          y = a.box.y * 1000,
          w = a.box.width * 1000,
          h = a.box.height * 1000,
          cx = x + w / 2,
          cy = y + h / 2;
        return (
          <g key={a.id} className={`annotation annotation-${a.shape}`}>
            {a.shape === 'highlight' ? (
              <rect x={x} y={y} width={w} height={h} rx={3} />
            ) : a.shape === 'circle' ? (
              <ellipse cx={cx} cy={cy} rx={w / 2} ry={h / 2} />
            ) : a.shape === 'arrow' ? (
              <>
                <path
                  d={`M ${Math.max(4, x - 65)} ${Math.max(4, y - 35)} L ${x + 3} ${cy} M ${x + 3} ${cy} l -17 -10 M ${x + 3} ${cy} l -17 10`}
                />
              </>
            ) : a.shape === 'point' ? (
              <>
                <circle cx={cx} cy={cy} r={9} />
                <path d={`M ${cx} ${cy - 12} v -32`} />
              </>
            ) : (
              <path d={`M ${x} ${y + h} h ${w}`} />
            )}
            <rect
              className="annotation-number-bg"
              x={Math.max(0, x - 4)}
              y={Math.max(0, y - 42)}
              width={44}
              height={40}
              rx={5}
            />
            <text x={Math.max(0, x - 4) + 22} y={Math.max(0, y - 42) + 28} textAnchor="middle">
              {i + 1}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
export function TutorWorkspace({
  data,
  onOpenTopic,
  onOpenPdf,
}: {
  data: AppState;
  onOpenTopic: (id: string) => void;
  onOpenPdf: (id: string, page: number) => void;
}) {
  const { runtime: r, act } = useTutor();
  const [topicId, setTopicId] = useState(data.settings.lastTopicId ?? data.topics[0]?.id ?? ''),
    [consent, setConsent] = useState(false),
    [text, setText] = useState(''),
    [error, setError] = useState(''),
    [windows, setWindows] = useState<WindowSource[] | null>(null),
    [busy, setBusy] = useState(false),
    [historyId, setHistoryId] = useState<string | null>(null),
    [remove, setRemove] = useState<string | null>(null);
  useEffect(() => {
    const fn = (e: Event) => setError((e as CustomEvent<string>).detail);
    window.addEventListener('tutor-error', fn);
    return () => window.removeEventListener('tutor-error', fn);
  }, []);
  useEffect(() => {
    if (!data.topics.some((t) => t.id === topicId))
      setTopicId(data.settings.lastTopicId ?? data.topics[0]?.id ?? '');
  }, [data.topics, topicId]);
  async function run(fn: () => Promise<unknown>) {
    setError('');
    setBusy(true);
    try {
      await fn();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }
  if (!r) return <p role="status">Opening Yoyo…</p>;
  const active = data.sessions.find((s) => s.id === r.sessionId),
    chosen = data.topics.find((t) => t.id === (active?.topicId ?? topicId)),
    viewId = r.sessionId ?? historyId,
    messages = data.messages.filter((m) => m.sessionId === viewId),
    snapshot = r.snapshot;
  const ready = !!r.sessionId,
    connected = r.status === 'connected';
  return (
    <section className="tutor-workspace page-enter">
      <header className="tutor-heading">
        <div>
          <h1>Let’s work through it.</h1>
          <p>A question, a conversation, a little more clarity.</p>
        </div>
        <div className="tutor-presence">
          <Yoyo state={r.activity} />
          <span role="status">
            {r.status === 'connected'
              ? r.activity === 'speaking'
                ? 'Yoyo is speaking'
                : r.activity === 'thinking'
                  ? 'Looking closely…'
                  : r.mode === 'voice' && r.mic
                    ? 'Listening to you'
                    : 'Connected · text ready'
              : r.status === 'connecting'
                ? 'Connecting…'
                : r.status === 'paused'
                  ? 'Session paused'
                  : r.status === 'error'
                    ? 'Connection needs attention'
                    : 'Ready when you are'}
          </span>
        </div>
      </header>
      {(error || r.error) && (
        <div className="banner error" role="alert">
          {error || r.error}
          <button className="text-button" onClick={() => setError('')}>
            Dismiss
          </button>
        </div>
      )}
      {!ready && (
        <section className="session-start glass">
          <div>
            <label htmlFor="study-topic">What are we studying?</label>
            <select id="study-topic" value={topicId} onChange={(e) => setTopicId(e.target.value)}>
              {!data.topics.length && <option value="">Add a course and topic first</option>}
              {data.topics.map((t) => (
                <option key={t.id} value={t.id}>
                  {data.courses.find((c) => c.id === t.courseId)?.title} / {t.title}
                </option>
              ))}
            </select>
            <label className="consent-check">
              <input
                type="checkbox"
                checked={consent}
                onChange={(e) => setConsent(e.target.checked)}
              />
              <span>
                Share this topic’s notes, linked source text and saved explanations with ElevenLabs.
                Keep a transcript on this Mac.
              </span>
            </label>
            <p className="privacy-caption">
              Voice also sends microphone audio. A shared page or window image goes to OpenAI only
              when Yoyo analyzes it. Provider retention follows your account settings.
            </p>
          </div>
          <div className="session-start-actions">
            <button
              className="button primary"
              disabled={
                !consent || !topicId || !r.config.voice || r.status === 'connecting' || busy
              }
              onClick={() => void run(() => act({ type: 'start', topicId, mode: 'voice' }))}
            >
              <Mic size={17} />
              Start voice session
            </button>
            <button
              className="button"
              disabled={
                !consent || !topicId || !r.config.voice || r.status === 'connecting' || busy
              }
              onClick={() => void run(() => act({ type: 'start', topicId, mode: 'text' }))}
            >
              <MessageSquare size={17} />
              Start with text
            </button>
            {r.status === 'connecting' && (
              <button className="text-button" onClick={() => void act({ type: 'end' })}>
                Cancel connection
              </button>
            )}
          </div>
        </section>
      )}
      {!r.config.voice && (
        <div className="connection-setup">
          <h2>Connect Yoyo’s voice</h2>
          <p>
            Add <code>ELEVENLABS_API_KEY</code> and <code>ELEVENLABS_AGENT_ID</code> to the app’s{' '}
            <code>.env</code> file, then restart. The agent needs Yoyo’s six client tools from{' '}
            <code>docs/STAGE-2-SETUP.md</code>.
          </p>
          <span>
            <Check size={15} />
            Your courses and PDFs are ready to use now.
          </span>
        </div>
      )}
      {ready && (
        <div className="session-bar">
          <button className="session-topic" onClick={() => onOpenTopic(active!.topicId)}>
            <BookOpen size={17} />
            <strong>{chosen?.title}</strong>
            <ArrowUpRight size={15} />
          </button>
          <span className={r.mic ? 'permission-on' : 'permission-off'}>
            {r.mic ? <Mic size={14} /> : <MicOff size={14} />}Mic {r.mic ? 'on' : 'off'}
          </span>
          <span className={r.sharing !== 'off' ? 'permission-on' : 'permission-off'}>
            {r.sharing !== 'off' ? <MonitorUp size={14} /> : <MonitorOff size={14} />}Sharing{' '}
            {r.sharing === 'off' ? 'off' : 'on'}
          </span>
          {r.mode === 'voice' && (
            <button className="button small" onClick={() => void act({ type: 'mute' })}>
              {r.mic ? 'Mute' : 'Unmute'}
            </button>
          )}
          <button className="button small" onClick={() => void act({ type: 'pause' })}>
            <Pause size={14} />
            Pause
          </button>
          <button className="button small" onClick={() => void act({ type: 'end' })}>
            <Square size={13} />
            End
          </button>
        </div>
      )}
      <div className="tutor-columns">
        <section className="conversation-panel glass" aria-label="Study conversation">
          <header>
            <h2>
              {ready
                ? 'Your conversation'
                : historyId
                  ? 'Saved conversation'
                  : 'Room for your questions'}
            </h2>
            <span>Saved on this Mac</span>
          </header>
          <div className="conversation-messages" aria-live="polite" aria-relevant="additions text">
            {messages.length ? (
              messages.map((m) => (
                <article className={`transcript transcript-${m.role}`} key={m.id}>
                  <div className="transcript-meta">
                    <strong>
                      {m.role === 'user'
                        ? 'You'
                        : m.role === 'assistant'
                          ? 'Yoyo'
                          : 'Learning note'}
                    </strong>
                    <time>
                      {new Date(m.createdAt).toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </time>
                  </div>
                  <p>{m.text}</p>
                  {m.role === 'assistant' && (
                    <button
                      className="text-button"
                      disabled={data.explanations.some(
                        (e) => e.sessionId === m.sessionId && e.text === m.text,
                      )}
                      onClick={() => void run(() => unwrap(api.tutor.save(m.id)))}
                    >
                      <Bookmark size={14} />
                      {data.explanations.some(
                        (e) => e.sessionId === m.sessionId && e.text === m.text,
                      )
                        ? 'Saved to topic'
                        : 'Save explanation'}
                    </button>
                  )}
                </article>
              ))
            ) : (
              <div className="conversation-empty">
                <MessageSquare size={26} />
                <h3>Start with what’s on your mind.</h3>
                <p>
                  Ask a question, share the page you’re reading, or talk through a tricky idea. You
                  can interrupt Yoyo and ask a follow-up.
                </p>
              </div>
            )}
          </div>
          <form
            className="question-form"
            onSubmit={(e) => {
              e.preventDefault();
              if (text.trim())
                void run(async () => {
                  await act({ type: 'text', text: text.trim() });
                  setText('');
                });
            }}
          >
            <label className="sr-only" htmlFor="yoyo-question">
              Ask Yoyo
            </label>
            <textarea
              id="yoyo-question"
              placeholder={
                connected ? 'What would you like to understand?' : 'Start a session to ask Yoyo'
              }
              value={text}
              disabled={!connected}
              maxLength={2000}
              rows={2}
              onChange={(e) => setText(e.target.value)}
            />
            <button
              className="icon-button send-question"
              aria-label="Send question"
              disabled={!connected || !text.trim() || busy}
            >
              <Send size={19} />
            </button>
          </form>
        </section>
        <section className="shared-panel glass" aria-label="Shared study material">
          <header>
            <h2>{snapshot ? 'What Yoyo can see' : 'Bring the source closer.'}</h2>
            {r.sharing !== 'off' && (
              <button
                className="text-button danger-subtle"
                onClick={() => void act({ type: 'stop-sharing' })}
              >
                <MonitorOff size={14} />
                Stop sharing
              </button>
            )}
          </header>
          {snapshot ? (
            <>
              <div className="shared-source-name">
                <strong>{r.sourceName}</strong>
                <span>
                  Still image ·{' '}
                  {new Date(snapshot.capturedAt).toLocaleTimeString([], {
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </span>
              </div>
              <div className="shared-image">
                <img src={snapshot.image} alt={`Shared ${r.sourceName}`} />
                <AnnotationLayer annotations={r.annotations} />
              </div>
              {r.annotations.length > 0 && (
                <ol className="annotation-key">
                  {r.annotations.map((a) => (
                    <li key={a.id}>
                      <strong>{a.label}</strong>
                      <span>
                        “{a.evidence}” ·{' '}
                        {a.precision === 'pdf-text'
                          ? 'PDF text anchor'
                          : 'Approximate visual region'}
                      </span>
                    </li>
                  ))}
                </ol>
              )}
              {r.analysis && (
                <details className="analysis-result">
                  <summary>
                    Read the visual explanation
                    {r.latencyMs ? ` · ${(r.latencyMs / 1000).toFixed(1)}s` : ''}
                  </summary>
                  <p>{r.analysis}</p>
                </details>
              )}
            </>
          ) : (
            <div className="sharing-empty">
              <MonitorUp size={30} />
              <h3>
                {r.sharing === 'window' ? 'Window sharing is on.' : 'You decide what to share.'}
              </h3>
              <p>
                {r.sharing === 'window'
                  ? `Yoyo will capture ${r.sourceName} when you ask about it. No image has been analyzed yet.`
                  : 'Open a course PDF and choose “Share this page”, or select a study window. Yoyo only analyzes images when you ask.'}
              </p>
            </div>
          )}
          <div className="source-actions">
            {chosen?.sourceRefs[0] && (
              <button
                className="button"
                onClick={() =>
                  onOpenPdf(chosen.sourceRefs[0].documentId, chosen.sourceRefs[0].page)
                }
              >
                <BookOpen size={16} />
                Open source PDF
              </button>
            )}
            <button
              className="button"
              disabled={!connected || !r.config.vision || busy}
              onClick={() => void run(async () => setWindows(await unwrap(api.tutor.windows())))}
            >
              <MonitorUp size={16} />
              Choose window
            </button>
          </div>
          {!r.config.vision && (
            <p className="privacy-caption source-note">
              Add <code>OPENAI_API_KEY</code> to enable visual explanations.
            </p>
          )}
        </section>
      </div>
      <section className="session-history">
        <div className="section-heading">
          <h2>Pick up the thread.</h2>
          <span>{data.sessions.length} study sessions</span>
        </div>
        {data.sessions.length ? (
          <div>
            {[...data.sessions].reverse().map((s) => (
              <div className="session-history-row" key={s.id}>
                <button
                  onClick={() => {
                    setHistoryId(s.id);
                    setError('');
                  }}
                  disabled={ready}
                >
                  <MessageSquare size={18} />
                  <span>
                    <strong>
                      {data.topics.find((t) => t.id === s.topicId)?.title ?? 'Study session'}
                    </strong>
                    <small>
                      {new Date(s.startedAt).toLocaleDateString()} ·{' '}
                      {s.mode === 'voice' ? 'Voice' : 'Text'} ·{' '}
                      {data.messages.filter((m) => m.sessionId === s.id).length} messages
                    </small>
                  </span>
                </button>
                <button
                  className="icon-button danger-subtle"
                  aria-label={`Delete session from ${new Date(s.startedAt).toLocaleString()}`}
                  onClick={() => setRemove(s.id)}
                >
                  <Trash2 size={16} />
                </button>
              </div>
            ))}
          </div>
        ) : (
          <p>Your conversations will appear here after your first session.</p>
        )}
      </section>
      {windows && (
        <Modal title="Share a study window" onClose={() => setWindows(null)}>
          <p className="share-consent">
            Yoyo can capture this window while sharing is on. Images are sent to OpenAI only on an
            analysis request. Browser and private-labelled windows are excluded; use the internal
            PDF viewer for browser documents.
          </p>
          <div className="window-choices">
            {windows.length ? (
              windows.map((w) => (
                <button
                  key={w.id}
                  className="window-choice"
                  onClick={() =>
                    void run(async () => {
                      await act({ type: 'share-window', id: w.id });
                      setWindows(null);
                    })
                  }
                >
                  <MonitorUp size={18} />
                  <span>{w.name}</span>
                </button>
              ))
            ) : (
              <p>
                No eligible windows found. Open a study document in Preview or share a PDF inside
                yoteach. If needed, enable Electron under macOS Screen Recording and restart.
              </p>
            )}
          </div>
        </Modal>
      )}
      {remove && (
        <Modal title="Delete this study session?" onClose={() => setRemove(null)}>
          <p>
            This removes its local transcript and saved explanations. It does not delete
            provider-side records.
          </p>
          <div className="form-actions">
            <button className="button" onClick={() => setRemove(null)}>
              Keep session
            </button>
            <button
              className="button danger"
              onClick={() =>
                void run(async () => {
                  await unwrap(api.tutor.deleteSession(remove));
                  setRemove(null);
                  setHistoryId(null);
                })
              }
            >
              Delete session
            </button>
          </div>
        </Modal>
      )}
    </section>
  );
}
