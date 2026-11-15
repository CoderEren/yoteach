import { useEffect, useRef, useState } from 'react';
import type { AppState } from '../../shared/model';
import { Yoyo } from './Yoyo';
import { api } from '../api';
import { useTutor } from '../tutor';
export function Companion({ data: _data }: { data: AppState }) {
  const { runtime: r, act } = useTutor();
  const [pose, setPose] = useState<{ direction: 'left' | 'right' | null; seq: number }>({
    direction: null,
    seq: 0,
  });
  const direction = pose.direction;
  const gesture = useRef<{
    x: number;
    y: number;
    dragging: boolean;
    timer: ReturnType<typeof setTimeout>;
    listening: boolean;
  } | null>(null);
  // Every new spot replays the string's pointing throw, even when the side stays the same.
  useEffect(
    () => api.onPose((p) => setPose((old) => ({ direction: p.direction, seq: old.seq + 1 }))),
    [],
  );
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
  // Talking wins over the brief gestures tools trigger (pointing, thinking after a lookup), so
  // the mouth keeps moving for as long as the voice plays. Pointing shows through the string.
  const activity = r?.activity ?? 'idle';
  const state =
    input === 'listening'
      ? 'listening'
      : activity === 'success'
        ? 'success'
        : input === 'arming'
          ? 'thinking'
          : r?.speaking
            ? 'speaking'
            : input === 'sending'
              ? 'thinking'
              : activity === 'speaking' || (activity === 'pointing' && !direction)
                ? 'idle'
                : activity;
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
        <Yoyo
          state={state}
          direction={direction}
          gestureKey={pose.seq}
          className={
            input === 'listening'
              ? 'ring-listening'
              : input !== 'idle' || state === 'thinking'
                ? 'ring-thinking'
                : ''
          }
        />
      </button>
      {state === 'success' && (
        <span className="yoyo-burst" aria-hidden="true">
          {Array.from({ length: 10 }, (_, i) => (
            <i
              key={i}
              style={{ ['--a' as string]: `${i * 36}deg`, ['--d' as string]: `${(i % 3) * 0.05}s` }}
            />
          ))}
        </span>
      )}
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
