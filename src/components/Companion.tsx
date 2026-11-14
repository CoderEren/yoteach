import { useState } from 'react';
import {
  ArrowUpRight,
  ChevronDown,
  EyeOff,
  GripHorizontal,
  Mic,
  MicOff,
  MonitorUp,
  MonitorOff,
  Pause,
  Square,
} from 'lucide-react';
import type { AppState, MascotState } from '../../shared/model';
import { Yoyo } from './Yoyo';
import { api, unwrap } from '../api';
import { useTutor } from '../tutor';
const states: { id: MascotState; label: string }[] = [
  { id: 'idle', label: 'Idle' },
  { id: 'listening', label: 'Listening' },
  { id: 'thinking', label: 'Thinking' },
  { id: 'speaking', label: 'Speaking' },
  { id: 'pointing', label: 'Pointing' },
  { id: 'success', label: 'Celebrating' },
  { id: 'error', label: 'Unavailable' },
];
export function Companion({ data }: { data: AppState }) {
  const [expanded, setExpanded] = useState(false),
    [preview, setPreview] = useState<MascotState>('idle'),
    [previewing, setPreviewing] = useState(false),
    [error, setError] = useState('');
  const { runtime: r, act } = useTutor();
  const active = data.sessions.find((s) => s.id === r?.sessionId),
    topic = data.topics.find((t) => t.id === (active?.topicId ?? data.settings.lastTopicId)),
    course = data.courses.find((c) => c.id === topic?.courseId);
  async function action(kind: Parameters<typeof api.companion>[0]) {
    try {
      await unwrap(api.companion(kind));
      setError('');
      if (kind === 'expand') setExpanded(true);
      if (kind === 'collapse') setExpanded(false);
    } catch (e) {
      setError(String(e));
    }
  }
  const state = r?.sessionId ? r.activity : previewing ? preview : 'idle';
  return (
    <main className={`companion ${expanded ? 'expanded' : ''}`}>
      {expanded && (
        <section className="companion-panel live-companion">
          <header>
            <div>
              <strong>yo, teach?</strong>
              <span className="preview-label">
                {r?.sessionId
                  ? r.status === 'connected'
                    ? 'Study session connected'
                    : 'Connecting…'
                  : 'Your learning companion'}
              </span>
            </div>
            <button
              className="icon-button"
              onClick={() => action('collapse')}
              aria-label="Collapse Yoyo"
            >
              <ChevronDown size={18} />
            </button>
          </header>
          <div className="companion-context">
            <span>{r?.lecture ? 'Lecture walkthrough' : 'AI tutor'}</span>
            <strong>
              {r?.lecture
                ? `Slide ${r.lecture.page} of ${r.lecture.total}`
                : 'What would you like to understand?'}
            </strong>
          </div>
          <p className="companion-copy">
            {r?.activity === 'thinking'
              ? 'Let me take a closer look.'
              : r?.activity === 'speaking'
                ? 'Talk it through with me.'
                : r?.sessionId
                  ? 'One question at a time.'
                  : 'A little more clarity, together.'}
          </p>
          {r?.sessionId ? (
            <div className="companion-session-actions">
              {r.mode === 'voice' && (
                <button className="button small" onClick={() => void act({ type: 'mute' })}>
                  {r.mic ? <MicOff size={14} /> : <Mic size={14} />} {r.mic ? 'Mute' : 'Unmute'}
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
              {r.sharing !== 'off' && (
                <button
                  className="text-button danger-subtle"
                  onClick={() => void act({ type: 'stop-sharing' })}
                >
                  Stop sharing
                </button>
              )}
            </div>
          ) : (
            <p className="preview-help">
              Start a voice or text session in your workspace. Sharing stays off until you choose a
              source.
            </p>
          )}
          <button className="button companion-open" onClick={() => void act({ type: 'open' })}>
            Open workspace
            <ArrowUpRight size={16} />
          </button>
          {!r?.sessionId && (
            <details
              className="expression-preview"
              onToggle={(e) => setPreviewing(e.currentTarget.open)}
            >
              <summary>Preview expressions</summary>
              <div className="state-picker" aria-label="Preview mascot states">
                {states.map((s) => (
                  <button
                    key={s.id}
                    className={preview === s.id ? 'active' : ''}
                    aria-pressed={preview === s.id}
                    onClick={() => setPreview(s.id)}
                  >
                    {s.label}
                  </button>
                ))}
              </div>
              {preview === 'error' && <p className="preview-error">Animation preview only.</p>}
            </details>
          )}
          <footer>
            <span className={r?.mic ? 'permission-on' : ''}>
              {r?.mic ? <Mic size={13} /> : <MicOff size={13} />}Mic {r?.mic ? 'on' : 'off'}
            </span>
            <span className={r?.sharing && r.sharing !== 'off' ? 'permission-on' : ''}>
              {r?.sharing && r.sharing !== 'off' ? (
                <MonitorUp size={13} />
              ) : (
                <MonitorOff size={13} />
              )}
              Screen {r?.sharing && r.sharing !== 'off' ? 'on' : 'off'}
            </span>
          </footer>
        </section>
      )}
      <div className="companion-character">
        <div className="drag-grip" title="Drag to move Yoyo" aria-hidden="true">
          <GripHorizontal size={18} />
        </div>
        <button
          className="mascot-button"
          onClick={() => action(expanded ? 'collapse' : 'expand')}
          aria-label={expanded ? 'Collapse Yoyo panel' : 'Expand Yoyo panel'}
        >
          <Yoyo state={state} />
        </button>
        <button
          className="hide-yoyo icon-button"
          onClick={() => action('hide')}
          aria-label="Hide Yoyo"
        >
          <EyeOff size={16} />
        </button>
        <span className="yoyo-caption">
          {r?.sessionId ? (r.mic ? 'Mic on · Yoyo' : 'Session active · Mic off') : 'yo, teach?'}
        </span>
      </div>
      {error && (
        <p role="alert" className="error-message">
          {error}
        </p>
      )}
    </main>
  );
}
