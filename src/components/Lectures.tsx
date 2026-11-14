import { useState } from 'react';
import { Play, RotateCcw, Trash2, Upload } from 'lucide-react';
import type { AppState } from '../../shared/model';
import type { Chat } from '../../shared/tutor';
import { api, unwrap } from '../api';
import { useTutor } from '../tutor';
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
    [error, setError] = useState('');
  const walkthroughs = data.chats
    .filter((c) => c.kind === 'lecture' && data.documents.some((d) => d.id === c.documentId))
    .filter((c) => data.messages.some((m) => m.chatId === c.id && m.role === 'assistant'))
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  if (replay) return <LectureReplay data={data} chat={replay} onClose={() => setReplay(null)} />;
  const start = (documentId: string, page = 1) =>
    void act({ type: 'start', topicId: null, documentId, page, mode: 'voice' }).catch((e) =>
      setError(String(e)),
    );
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
                  onClick={() =>
                    void unwrap(api.tutor.deleteChat(c.id)).catch((e) => setError(String(e)))
                  }
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
    </section>
  );
}
