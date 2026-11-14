import { useEffect, useRef, useState } from 'react';
import type { AppState } from '../../shared/model';
import { Yoyo } from './Yoyo';
import { api } from '../api';
import { useTutor } from '../tutor';
export function Companion({ data: _data }: { data: AppState }) {
  const { runtime: r, act } = useTutor();
  const [direction, setDirection] = useState<'left' | 'right' | null>(null);
  const gesture = useRef<{
    x: number;
    y: number;
    dragging: boolean;
    timer: ReturnType<typeof setTimeout>;
    listening: boolean;
  } | null>(null);
  useEffect(() => api.onPose((p) => setDirection(p.direction)), []);
  const stop = (cancel: boolean, x: number, y: number) => {
    const g = gesture.current;
    if (!g) return;
    gesture.current = null;
    clearTimeout(g.timer);
    if (g.dragging) void api.drag({ phase: 'end', x, y });
    else if (g.listening) void act({ type: cancel ? 'hold-cancel' : 'hold-end' });
  };
  useEffect(
    () => () => {
      const g = gesture.current;
      if (g) {
        clearTimeout(g.timer);
        void act({ type: 'hold-cancel' });
      }
    },
    [],
  );
  const input = r?.input ?? 'idle';
  const state =
    input === 'listening'
      ? 'listening'
      : input === 'arming'
        ? 'thinking'
        : r?.activity === 'speaking'
          ? 'speaking'
          : input === 'sending'
            ? 'thinking'
            : r?.activity === 'pointing' && !direction
              ? 'idle'
              : (r?.activity ?? 'idle');
  return (
    <main className={`companion companion-bare input-${input}`}>
      <button
        className="mascot-button"
        aria-label="Hold Yoyo to speak, or drag to move"
        aria-pressed={input === 'listening'}
        onPointerDown={(event) => {
          if (event.button !== 0) return;
          event.preventDefault();
          event.currentTarget.setPointerCapture(event.pointerId);
          const g = {
            x: event.screenX,
            y: event.screenY,
            dragging: false,
            listening: false,
            timer: setTimeout(() => {
              if (gesture.current === g && !g.dragging) {
                g.listening = true;
                void act({ type: 'hold-start' });
              }
            }, 180),
          };
          gesture.current = g;
        }}
        onPointerMove={(event) => {
          const g = gesture.current;
          if (!g) return;
          if (!g.dragging && Math.hypot(event.screenX - g.x, event.screenY - g.y) > 7) {
            g.dragging = true;
            clearTimeout(g.timer);
            void act({ type: 'hold-cancel' });
            void api.drag({ phase: 'start', x: g.x, y: g.y });
          }
          if (g.dragging) void api.drag({ phase: 'move', x: event.screenX, y: event.screenY });
        }}
        onPointerUp={(event) => stop(false, event.screenX, event.screenY)}
        onPointerCancel={(event) => stop(true, event.screenX, event.screenY)}
        onLostPointerCapture={(event) => stop(true, event.screenX, event.screenY)}
        onKeyDown={(event) => {
          if ([' ', 'Enter'].includes(event.key) && !event.repeat) {
            event.preventDefault();
            void act({ type: 'hold-start' });
          }
        }}
        onKeyUp={(event) => {
          if ([' ', 'Enter'].includes(event.key)) {
            event.preventDefault();
            void act({ type: 'hold-end' });
          }
        }}
      >
        <span className="listening-halo" aria-hidden="true" />
        <Yoyo state={state} direction={direction} />
      </button>
      {r?.notice && (
        <span className="companion-notice" role="status">
          {r.notice}
        </span>
      )}
      <span className="sr-only" role="status">
        {input === 'listening'
          ? 'Listening. Release to send.'
          : input === 'arming'
            ? 'Opening microphone…'
            : input === 'sending'
              ? 'Sending your question…'
              : r?.error || state}
      </span>
    </main>
  );
}
