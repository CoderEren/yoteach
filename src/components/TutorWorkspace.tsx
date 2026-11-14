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
import { HoldButton } from './HoldButton';
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
  lectureId,
  onOpenPdf,
}: {
  data: AppState;
  lectureId?: string;
  onOpenPdf: (id: string, page: number) => void;
}) {
  const { runtime: r, act } = useTutor();
  const [text, setText] = useState(''),
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
    chosen = data.documents.find((d) => d.id === (active?.documentId ?? lectureId)),
    viewId = r.sessionId ?? historyId,
    messages = data.messages.filter((m) => m.sessionId === viewId),
    snapshot = r.snapshot;
  const ready = !!r.sessionId,
    connected = r.status === 'connected';
  return (
    <section className="tutor-workspace page-enter">
      <header className="tutor-heading">
        <div>
          <h1>{lectureId ? 'Let’s bring this lecture to life.' : 'Let’s work through it.'}</h1>
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
      <section className="session-start glass">
        <div>
          <h2>Hold. Ask. Release.</h2>
          <p>Hold Yoyo or your talk key to ask about the screen in front of you.</p>
        </div>
        <div className="session-start-actions">
          <HoldButton />
          {!ready && (
            <button
              className="button"
              disabled={!r.config.voice || r.status === 'connecting'}
              onClick={() => void act({ type: 'start', topicId: null, mode: 'text' })}
            >
              <MessageSquare size={17} />
              Start with text
            </button>
          )}
          {r.status === 'connecting' && (
            <button className="text-button" onClick={() => void act({ type: 'end' })}>
              Cancel connection
            </button>
          )}
        </div>
      </section>
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
            Your saved PDFs are ready to use now.
          </span>
        </div>
      )}
      {ready && (
        <div className="session-bar">
          <strong className="session-topic">{chosen?.originalName ?? 'AI tutor'}</strong>
          {r.lecture && (
            <div className="toolbar-group">
              <button
                className="button small"
                disabled={r.lecture.page <= 1 || r.lecturePreparing}
                onClick={() =>
                  void run(() => act({ type: 'lecture-page', page: r.lecture!.page - 1 }))
                }
              >
                Previous slide
              </button>
              <span>
                Slide {r.lecture.page} / {r.lecture.total}
              </span>
              <button
                className="button small"
                disabled={r.lecture.page >= r.lecture.total || r.lecturePreparing}
                onClick={() =>
                  void run(() => act({ type: 'lecture-page', page: r.lecture!.page + 1 }))
                }
              >
                Next slide
              </button>
            </div>
          )}
          <span className={r.mic ? 'permission-on' : 'permission-off'}>
            {r.mic ? <Mic size={14} /> : <MicOff size={14} />}Mic {r.mic ? 'on' : 'off'}
          </span>
          <span className={r.sharing !== 'off' ? 'permission-on' : 'permission-off'}>
            {r.sharing !== 'off' ? <MonitorUp size={14} /> : <MonitorOff size={14} />}Sharing{' '}
            {r.sharing === 'off' ? 'off' : 'on'}
          </span>
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
      <div className="tutor-columns tutor-single">
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
                        ? 'Saved'
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
                  Ask a question about your screen, or talk through a tricky idea. You can interrupt
                  Yoyo and ask a follow-up.
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
                      {data.documents.find((d) => d.id === s.documentId)?.originalName ??
                        data.topics.find((t) => t.id === s.topicId)?.title ??
                        'AI tutor'}
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
