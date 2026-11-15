import { useRef } from 'react';
import { Mic } from 'lucide-react';
import { useTutor } from '../tutor';
export function HoldButton() {
  const { runtime: r, act } = useTutor();
  const pressed = useRef(false);
  function release(cancel = false) {
    if (!pressed.current) return;
    pressed.current = false;
    void act({ type: cancel ? 'hold-cancel' : 'hold-end' });
  }
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
        pressed.current = true;
        event.currentTarget.setPointerCapture(event.pointerId);
        void act({ type: 'hold-start' });
      }}
      onPointerUp={() => release()}
      onPointerCancel={() => release(true)}
      onLostPointerCapture={() => release(true)}
      onBlur={() => release(true)}
      onKeyDown={(event) => {
        if ([' ', 'Enter'].includes(event.key) && !event.repeat) {
          event.preventDefault();
          pressed.current = true;
          void act({ type: 'hold-start' });
        }
      }}
      onKeyUp={(event) => {
        if ([' ', 'Enter'].includes(event.key)) {
          event.preventDefault();
          release();
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
