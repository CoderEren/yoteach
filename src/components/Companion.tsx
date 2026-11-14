import { useState } from 'react';
import {
  ArrowUpRight,
  ChevronDown,
  EyeOff,
  GripHorizontal,
  MicOff,
  MonitorOff,
} from 'lucide-react';
import type { AppState, MascotState } from '../../shared/model';
import { Yoyo } from './Yoyo';
import { api, unwrap } from '../api';
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
    [state, setState] = useState<MascotState>('idle'),
    [error, setError] = useState('');
  const topic = data.topics.find((t) => t.id === data.settings.lastTopicId),
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
  return (
    <main className={`companion ${expanded ? 'expanded' : ''}`}>
      {expanded && (
        <section className="companion-panel">
          <header>
            <div>
              <strong>yo, teach?</strong>
              <span className="preview-label">Animation preview</span>
            </div>
            <button
              className="icon-button"
              onClick={() => action('collapse')}
              aria-label="Collapse Yoyo"
            >
              <ChevronDown size={18} />
            </button>
          </header>
          <p className="companion-copy">
            A little company.
            <br />A clearer way to learn.
          </p>
          <div className="companion-context">
            <span>{course?.title ?? 'Your learning workspace'}</span>
            <strong>{topic?.title ?? 'Choose a topic to get started'}</strong>
          </div>
          <p className="preview-help">
            Try Yoyo’s expressions. Voice and screen sharing are not connected yet.
          </p>
          <div className="state-picker" aria-label="Preview mascot states">
            {states.map((s) => (
              <button
                key={s.id}
                className={state === s.id ? 'active' : ''}
                aria-pressed={state === s.id}
                onClick={() => setState(s.id)}
              >
                {s.label}
              </button>
            ))}
          </div>
          {state === 'error' && (
            <p className="preview-error">
              Preview: tutor unavailable. Your workspace is still here.
            </p>
          )}
          <button className="button companion-open" onClick={() => action('workspace')}>
            Open workspace
            <ArrowUpRight size={16} />
          </button>
          <footer>
            <span>
              <MicOff size={13} />
              Mic off
            </span>
            <span>
              <MonitorOff size={13} />
              Screen off
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
        <span className="yoyo-caption">{expanded ? 'Yoyo · UI preview' : 'yo, teach?'}</span>
      </div>
      {error && (
        <p role="alert" className="error-message">
          {error}
        </p>
      )}
    </main>
  );
}
