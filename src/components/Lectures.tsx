import { useEffect, useState } from 'react';
import { Play, RotateCcw, Trash2, Upload } from 'lucide-react';
import type { AppState } from '../../shared/model';
import type { Chat } from '../../shared/tutor';
import { api, unwrap } from '../api';
import { useTutor } from '../tutor';
import { Modal } from './Modal';
import { LectureReplay } from './LectureReplay';

/** Lectures Yoyo has walked through, with replay; plus starting a new walkthrough. */
export function Lectures({
  data,
  lectureId,
  busy,
  onUpload,
}: {
  data: AppState;
  lectureId: string;
  busy: string;
  onUpload: () => void;
}) {
  const { runtime: r, act } = useTutor();
  const [replay, setReplay] = useState<Chat | null>(null),
    [error, setError] = useState(''),
    [remove, setRemove] = useState<Chat | null>(null),
    [deleting, setDeleting] = useState(false);
  // Start failures (microphone permission, connection) used to vanish; show them here.
  useEffect(() => {
    const fn = (e: Event) => setError((e as CustomEvent<string>).detail);
    window.addEventListener('tutor-error', fn);
    return () => window.removeEventListener('tutor-error', fn);
  }, []);
  const walkthroughs = data.chats
    .filter((c) => c.kind === 'lecture' && data.documents.some((d) => d.id === c.documentId))
    .filter((c) => data.messages.some((m) => m.chatId === c.id && m.role === 'assistant'))
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  if (replay) return <LectureReplay data={data} chat={replay} onClose={() => setReplay(null)} />;
  const start = (documentId: string, page = 1) => {
    setError('');
    void act({ type: 'start', topicId: null, documentId, page, mode: 'voice' }).catch((e) =>
      setError(String(e)),
    );
  };
  const chosen = data.documents.find((d) => d.id === lectureId);
  return (
    <section className="lectures page-enter">
      <header className="lectures-header">
        <h1>Lectures</h1>
        <p>Upload slides and Yoyo teaches them one by one. Replay any walkthrough later.</p>
      </header>
      <div className="lecture-new glass">
        <button className="lecture-upload" disabled={!!busy} onClick={onUpload}>
          <Upload size={22} />
          <span>
            <strong>{chosen?.originalName ?? 'Upload a lecture PDF'}</strong>
            <small>
              {chosen
                ? 'Click to choose another PDF'
                : 'PowerPoint or Keynote? Export to PDF first.'}
            </small>
          </span>
        </button>
        <button
          className="button primary lecture-run"
          aria-describedby={!r?.config.voice || !r?.config.vision ? 'lecture-setup' : undefined}
          disabled={
            !lectureId ||
            !!busy ||
            !r?.config.voice ||
            !r?.config.vision ||
            r?.status === 'connecting'
          }
          onClick={() =>
            start(
              lectureId,
              data.sessions.filter((s) => s.documentId === lectureId).at(-1)?.page ?? 1,
            )
          }
        >
          {r?.status === 'connecting' ? 'Opening lecture…' : 'Run me through the lecture'}
        </button>
      </div>
      {r && (!r.config.voice || !r.config.vision) && (
        <p id="lecture-setup" role="status" className="settings-hint">
          Voice and screen understanding are not set up yet. Follow <code>SETUP_REQUIRED.md</code>,
          then restart Yoteach. You can still upload and read PDFs in Saved material.
        </p>
      )}
      {(error || r?.error) && (
        <p role="alert" className="error-message">
          {error || r?.error}
        </p>
      )}
      <h2 className="lectures-subhead">Walkthroughs</h2>
      {walkthroughs.length ? (
        <ul className="walkthroughs">
          {walkthroughs.map((c) => {
            const doc = data.documents.find((d) => d.id === c.documentId)!;
            const said = data.messages.filter((m) => m.chatId === c.id && m.role === 'assistant');
            const pages = new Set(said.map((m) => m.page ?? 1));
            const last = said.at(-1)?.page ?? 1;
            return (
              <li key={c.id} className="walkthrough glass">
                <div>
                  <strong>{doc.originalName}</strong>
                  <small>
                    {new Date(c.createdAt).toLocaleDateString([], {
                      day: 'numeric',
                      month: 'short',
                    })}{' '}
                    · {pages.size} of {doc.pageCount} slides
                  </small>
                </div>
                <button className="button small primary" onClick={() => setReplay(c)}>
                  <Play size={14} /> Replay
                </button>
                <button
                  className="button small"
                  disabled={!r?.config.voice || !!r?.sessionId}
                  onClick={() => start(doc.id, Math.min(doc.pageCount, last))}
                >
                  <RotateCcw size={14} /> Continue
                </button>
                <button
                  className="icon-button small danger-subtle"
                  aria-label={`Delete walkthrough of ${doc.originalName}`}
                  onClick={() => setRemove(c)}
                >
                  <Trash2 size={14} />
                </button>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="walkthroughs-empty">Lectures you run through appear here to replay.</p>
      )}
      {remove && (
        <Modal
          title={`Delete walkthrough of “${data.documents.find((d) => d.id === remove.documentId)?.originalName}”?`}
          onClose={() => {
            if (!deleting) setRemove(null);
          }}
        >
          <p className="confirmation-copy">
            This removes its narration and drawings from this Mac. Your PDF stays in Saved material.
            Provider-side records are not affected.
          </p>
          <div className="form-actions confirmation-actions">
            <button className="button" disabled={deleting} onClick={() => setRemove(null)}>
              Keep walkthrough
            </button>
            <button
              className="button danger"
              disabled={deleting}
              onClick={async () => {
                setDeleting(true);
                try {
                  await unwrap(api.tutor.deleteChat(remove.id));
                  setRemove(null);
                } catch (e) {
                  setError(e instanceof Error ? e.message : String(e));
                  setRemove(null);
                } finally {
                  setDeleting(false);
                }
              }}
            >
              {deleting ? 'Deleting…' : 'Delete walkthrough'}
            </button>
          </div>
        </Modal>
      )}
    </section>
  );
}
