import { Mic } from 'lucide-react';
import { useTutor } from '../tutor';
export function HoldButton() {
  const { runtime: r, act } = useTutor();
  const held = r?.input === 'listening',
    busy = r?.input === 'sending';
  return (
    <button
      className={`button primary hold-button ${held ? 'is-listening' : ''}`}
      disabled={busy || !r?.config.voice}
      aria-label="Hold to speak"
      aria-pressed={held}
      onPointerDown={(event) => {
        if (event.button !== 0) return;
        event.preventDefault();
        event.currentTarget.setPointerCapture(event.pointerId);
        void act({ type: 'hold-start' });
      }}
      onPointerUp={() => void act({ type: 'hold-end' })}
      onPointerCancel={() => void act({ type: 'hold-cancel' })}
      onLostPointerCapture={() => {
        if (r?.input === 'listening' || r?.input === 'arming') void act({ type: 'hold-cancel' });
      }}
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
      <Mic size={18} />
      {held
        ? 'Listening · release to send'
        : r?.input === 'arming'
          ? 'Opening microphone…'
          : busy
            ? 'Sending…'
            : 'Hold to speak'}
    </button>
  );
}
