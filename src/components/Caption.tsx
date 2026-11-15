import { useEffect, useState } from 'react';
import { api } from '../api';

/** Yoyo's subtitles: the last few words it said, in a small chip just above (or below) Yoyo. */
export function Caption() {
  const [caption, setCaption] = useState<{ text: string; placement: 'above' | 'below' }>({
    text: '',
    placement: 'above',
  });
  // The chip stays mounted for a moment after clearing so it can fade out with its last words.
  const [shown, setShown] = useState('');
  useEffect(() => api.onCaption(setCaption), []);
  useEffect(() => {
    if (caption.text) setShown(caption.text);
  }, [caption.text]);
  return (
    <main className={`yoyo-subtitles ${caption.placement}`} aria-hidden="true">
      {shown && <p className={caption.text ? 'on' : 'off'}>{shown}</p>}
    </main>
  );
}
