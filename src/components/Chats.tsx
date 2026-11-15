import { useEffect, useMemo, useRef, useState } from 'react';
import { Bookmark, BookmarkCheck, MessageSquare, Send, Trash2 } from 'lucide-react';
import type { AppState } from '../../shared/model';
import { cleanSpeech, type Chat } from '../../shared/tutor';
import { api, unwrap } from '../api';
import { useTutor } from '../tutor';
import { GenerationPanel } from './GeneratedMedia';
import { HoldButton } from './HoldButton';
import { Modal } from './Modal';

const keyName = {
  control: 'Control',
  'right-control': 'Right Control',
  fn: 'Fn',
  'right-option': 'Right Option',
  f8: 'F8',
} as const;
function when(iso: string) {
  const d = new Date(iso),
    today = new Date();
  const days = Math.floor(
    (today.setHours(0, 0, 0, 0) - new Date(iso).setHours(0, 0, 0, 0)) / 864e5,
  );
  if (days === 0) return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  if (days === 1) return 'Yesterday';
  return d.toLocaleDateString([], { day: 'numeric', month: 'short' });
}
/** Conversations, one per subject, named after what was discussed. */
export function Chats({ data }: { data: AppState }) {
  const { runtime: r, act } = useTutor();
  const chats = useMemo(
    () =>
      data.chats
        .filter((c) => c.kind === 'chat' && data.messages.some((m) => m.chatId === c.id))
        .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)),
    [data.chats, data.messages],
  );
  const [picked, setPicked] = useState<string | null>(null),
    [text, setText] = useState(''),
    [error, setError] = useState(''),
    [sending, setSending] = useState(false),
    [remove, setRemove] = useState<Chat | null>(null);
  // Follow the live chat, including when a new topic splits off.
  const live = r?.chatId && chats.some((c) => c.id === r.chatId) ? r.chatId : null;
  useEffect(() => {
    if (live) setPicked(live);
  }, [live]);
  const chat = chats.find((c) => c.id === picked) ?? chats[0];
  const messages = data.messages.filter((m) => m.chatId === chat?.id && m.role !== 'note');
  const end = useRef<HTMLDivElement>(null);
  useEffect(() => {
    // Newer Chromium returns a promise from scrollIntoView; never hand it to React as cleanup.
    void end.current?.scrollIntoView({ block: 'end' });
  }, [messages.length, chat?.id]);
  useEffect(() => {
    const fn = (e: Event) => setError((e as CustomEvent<string>).detail);
    window.addEventListener('tutor-error', fn);
    return () => window.removeEventListener('tutor-error', fn);
  }, []);
  const status =
    r?.input === 'listening'
      ? 'Listening…'
      : r?.activity === 'speaking'
        ? 'Yoyo is speaking'
        : r?.activity === 'thinking' || r?.input === 'sending'
          ? 'Thinking…'
          : r?.status === 'connecting'
            ? 'Connecting…'
            : null;
  async function send() {
    const question = text.trim();
    if (!question) return;
    setSending(true);
    setError('');
    try {
      await act({ type: 'text', text: question });
      setText('');
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSending(false);
    }
  }
  const talkKey = keyName[data.settings.talkKey];
  return (
    <section className="chats page-enter">
      <aside className="chat-list" aria-label="Chats">
        <h2>Chats</h2>
        {chats.length ? (
          <ul>
            {chats.map((c) => (
              <li key={c.id} className={c.id === chat?.id ? 'active' : ''}>
                <button onClick={() => setPicked(c.id)} aria-current={c.id === chat?.id}>
                  <strong>{c.title}</strong>
                  <small>
                    {when(c.updatedAt)}
                    {c.id === live ? ' · now' : ''}
                  </small>
                </button>
                <button
                  className="icon-button small danger-subtle"
                  aria-label={`Delete chat ${c.title}`}
                  onClick={() => setRemove(c)}
                >
                  <Trash2 size={14} />
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="chat-list-empty">Each subject you ask about gets its own chat here.</p>
        )}
      </aside>
      <div className="chat-pane">
        <header className="chat-header">
          <div>
            <h1>{chat?.title ?? 'Ask Yoyo anything.'}</h1>
            <p>
              Hold <kbd>{talkKey}</kbd> anywhere and ask about what’s on your screen. Yoyo answers
              by drawing on it.
            </p>
          </div>
          {status && (
            <span className="chat-status" role="status">
              <span className="generation-pulse" aria-hidden="true" />
              {status}
            </span>
          )}
        </header>
        {(error || r?.error) && (
          <div className="banner error" role="alert">
            {error || r?.error}
            <button
              className="text-button"
              onClick={() => {
                setError('');
                void act({ type: 'dismiss-error' });
              }}
            >
              Dismiss
            </button>
          </div>
        )}
        <GenerationPanel media={data.media} />
        <div className="chat-messages" aria-live="polite">
          {messages.length ? (
            messages.map((m) => {
              const saved = data.explanations.find(
                (e) =>
                  e.sessionId === m.sessionId &&
                  (e.text === m.text || e.text === cleanSpeech(m.text)),
              );
              return (
                <article key={m.id} className={`bubble bubble-${m.role}`}>
                  <p>{m.role === 'assistant' ? cleanSpeech(m.text) : m.text}</p>
                  <footer>
                    <time>
                      {new Date(m.createdAt).toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </time>
                    {m.role === 'assistant' && (
                      <button
                        className="text-button"
                        aria-pressed={!!saved}
                        onClick={() =>
                          void unwrap(
                            saved ? api.tutor.deleteExplanation(saved.id) : api.tutor.save(m.id),
                          ).catch((e) => setError(String(e)))
                        }
                      >
                        {saved ? <BookmarkCheck size={13} /> : <Bookmark size={13} />}
                        {saved ? 'Saved' : 'Save'}
                      </button>
                    )}
                  </footer>
                </article>
              );
            })
          ) : (
            <div className="chat-empty">
              <MessageSquare size={24} />
              <p>Ask out loud with {talkKey}, or type below.</p>
            </div>
          )}
          <div ref={end} />
        </div>
        <form
          className="chat-composer"
          onSubmit={(e) => {
            e.preventDefault();
            void send();
          }}
        >
          <label className="sr-only" htmlFor="yoyo-question">
            Ask Yoyo
          </label>
          <textarea
            id="yoyo-question"
            rows={1}
            maxLength={2000}
            placeholder="Ask Yoyo…"
            value={text}
            disabled={!r?.config.voice}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                void send();
              }
            }}
          />
          <button
            className="icon-button send-question"
            aria-label="Send question"
            disabled={!text.trim() || sending || !r?.config.voice}
          >
            <Send size={18} />
          </button>
          <HoldButton />
        </form>
        {!r?.config.voice && (
          <p className="chat-setup">
            Voice is not set up yet. Follow <code>SETUP_REQUIRED.md</code>, then restart Yoteach.
          </p>
        )}
      </div>
      {remove && (
        <Modal title={`Delete “${remove.title}”?`} onClose={() => setRemove(null)}>
          <p className="confirmation-copy">
            This removes the chat from this Mac. Provider-side records are not affected.
          </p>
          <div className="form-actions confirmation-actions">
            <button className="button" onClick={() => setRemove(null)}>
              Keep chat
            </button>
            <button
              className="button danger"
              onClick={() =>
                void unwrap(api.tutor.deleteChat(remove.id))
                  .then(() => setRemove(null))
                  .catch((e) => setError(String(e)))
              }
            >
              Delete chat
            </button>
          </div>
        </Modal>
      )}
    </section>
  );
}
