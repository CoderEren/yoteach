import { useEffect, useRef, useState } from 'react';
import { ArrowLeft, Check, CircleAlert, CircleDot, Trash2 } from 'lucide-react';
import {
  misconceptions,
  practice,
  question as find,
  reviewSuggestions,
  type PracticeAttempt,
  type ReviewSuggestion,
} from '../../shared/practice';
import { api, unwrap } from '../api';
import { useTutor } from '../tutor';

const verdictText = { correct: 'Correct', partial: 'Partly there', incorrect: 'Not yet' } as const;
function latestFor(attempts: PracticeAttempt[], id: string) {
  return attempts.filter((a) => a.questionId === id).at(-1);
}
export function ReviewList({
  items,
  onReview,
}: {
  items: ReviewSuggestion[];
  onReview?: (step: number) => void;
}) {
  if (!items.length)
    return <p className="practice-empty">No review suggested by your latest answers.</p>;
  return (
    <ul className="review-list">
      {items.map((r) => (
        <li key={r.attemptId + (r.misconception ?? '')}>
          <strong>
            {r.misconception
              ? `Possible misconception: ${misconceptions[r.misconception].description}`
              : `Revisit: ${find(r.questionId).prompt}`}
          </strong>
          {r.evidence && <span className="review-evidence">From your answer: “{r.evidence}”</span>}
          {onReview ? (
            <button className="text-button" onClick={() => onReview(r.step)}>
              Review step {r.step}
            </button>
          ) : (
            <small>Suggested: lesson step {r.step}</small>
          )}
        </li>
      ))}
    </ul>
  );
}
/** Practice inside the open lesson. Every result comes from a saved, graded answer. */
export function PracticePanel({
  attempts,
  onReview,
  voiceOnly = false,
}: {
  attempts: PracticeAttempt[];
  onReview: (step: number) => void;
  /** On-screen cards cannot take keyboard focus: written answers are spoken. */
  voiceOnly?: boolean;
}) {
  const { runtime: r, act } = useTutor();
  const id = r?.practice?.questionId ?? practice[0].id,
    q = find(id),
    checking = !!r?.practice?.checking;
  const [choice, setChoice] = useState(''),
    [text, setText] = useState(''),
    [error, setError] = useState('');
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    setChoice('');
    setText('');
    setError('');
    heading.current?.focus();
  }, [id]);
  const latest = latestFor(attempts, id),
    count = attempts.filter((a) => a.questionId === id).length;
  const review = reviewSuggestions(attempts);
  async function submit() {
    setError('');
    try {
      const attempt = await unwrap(
        api.practice.answer(
          id,
          q.choices ? { kind: 'choice', choiceId: choice } : { kind: 'text', text },
        ),
      );
      setChoice('');
      setText('');
      void act({
        type: 'inform',
        text:
          'The student answered a practice question in the app (study data): ' +
          JSON.stringify({
            question: q.prompt,
            verdict: attempt.verdict,
            feedbackShown: attempt.feedback,
            possibleMisconceptions: attempt.misconceptions.map((m) => ({
              ...misconceptions[m.id],
              evidence: m.evidence,
            })),
          }) +
          ' The feedback is already on screen; add at most one short spoken sentence if helpful.',
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }
  return (
    <section className="practice-panel glass" aria-label="Practice">
      <header className="practice-header">
        <div>
          <p className="eyebrow">Check your understanding</p>
          <div className="practice-tabs" role="tablist" aria-label="Practice questions">
            {practice.map((p, i) => {
              const v = latestFor(attempts, p.id)?.verdict;
              return (
                <button
                  key={p.id}
                  role="tab"
                  aria-selected={p.id === id}
                  aria-label={`Question ${i + 1}${v ? `, latest: ${verdictText[v]}` : ''}`}
                  className={v ? `practice-tab ${v}` : 'practice-tab'}
                  onClick={() => void act({ type: 'practice-open', question: p.id })}
                >
                  {v === 'correct' ? <Check size={14} /> : v ? <CircleAlert size={14} /> : i + 1}
                </button>
              );
            })}
          </div>
        </div>
        <button className="button small" onClick={() => void act({ type: 'practice-close' })}>
          <ArrowLeft size={16} /> Back to lesson
        </button>
      </header>
      <div className="practice-body">
        <form
          className="practice-question"
          onSubmit={(e) => {
            e.preventDefault();
            void submit();
          }}
        >
          <h2 ref={heading} tabIndex={-1}>
            {q.prompt}
          </h2>
          <small>About lesson step {q.step}</small>
          {q.choices ? (
            <fieldset disabled={checking}>
              <legend className="sr-only">{q.prompt}</legend>
              {q.choices.map((c) => (
                <label
                  key={c.id}
                  className={choice === c.id ? 'practice-choice chosen' : 'practice-choice'}
                >
                  <input
                    type="radio"
                    name={`practice-${q.id}`}
                    value={c.id}
                    checked={choice === c.id}
                    onChange={() => setChoice(c.id)}
                  />
                  {c.text}
                </label>
              ))}
            </fieldset>
          ) : voiceOnly ? (
            <p className="practice-voice">
              Hold your talk key or Yoyo and say your answer. Yoyo checks and saves it here.
            </p>
          ) : (
            <>
              <label htmlFor="practice-answer" className="sr-only">
                Your answer
              </label>
              <textarea
                id="practice-answer"
                rows={4}
                maxLength={2000}
                disabled={checking}
                placeholder="Explain in your own words…"
                value={text}
                onChange={(e) => setText(e.target.value)}
              />
            </>
          )}
          <div className="practice-actions" hidden={voiceOnly && !q.choices}>
            <button
              className="button primary"
              disabled={checking || (q.choices ? !choice : !text.trim())}
            >
              {checking ? 'Checking…' : count ? 'Check new answer' : 'Check answer'}
            </button>
            {checking && (
              <span role="status" className="generation-status">
                <span className="generation-pulse" aria-hidden="true" />
                {q.choices ? 'Checking' : 'Claude is reading your answer'}
              </span>
            )}
          </div>
          {error && (
            <div className="banner error" role="alert">
              {error}
              <button type="button" className="text-button" onClick={() => setError('')}>
                Dismiss
              </button>
            </div>
          )}
        </form>
        {latest && (
          <article className={`practice-feedback ${latest.verdict}`} aria-live="polite">
            <header>
              <span className="practice-verdict">
                {latest.verdict === 'correct' ? <Check size={16} /> : <CircleDot size={16} />}
                {verdictText[latest.verdict]}
              </span>
              <small>
                {latest.origin === 'tutor' ? 'Answered with Yoyo' : 'Your latest answer'} · {count}{' '}
                {count === 1 ? 'attempt' : 'attempts'}
              </small>
              <button
                className="icon-button"
                aria-label="Delete this answer"
                onClick={() =>
                  void unwrap(api.practice.remove(latest.id)).catch((e) => setError(String(e)))
                }
              >
                <Trash2 size={15} />
              </button>
            </header>
            <blockquote>
              {latest.answer.kind === 'choice'
                ? q.choices?.find((c) => c.id === (latest.answer as { choiceId: string }).choiceId)
                    ?.text
                : latest.answer.text}
            </blockquote>
            <p>{latest.feedback}</p>
            {latest.misconceptions.map((m) => (
              <div className="practice-misconception" key={m.id}>
                <strong>Possible misconception: {misconceptions[m.id].description}</strong>
                <span>From your answer: “{m.evidence}”</span>
                <p>{misconceptions[m.id].correction}</p>
                <button className="text-button" onClick={() => onReview(misconceptions[m.id].step)}>
                  Review step {misconceptions[m.id].step}
                </button>
              </div>
            ))}
            {latest.answerSource === 'reported' && (
              <small>
                Yoyo’s summary of your answer did not match your saved words, so no misconception
                was recorded.
              </small>
            )}
            {latest.verdict !== 'correct' && (
              <details>
                <summary>Show a model answer</summary>
                <p>{q.modelAnswer}</p>
              </details>
            )}
            <small className="practice-grader">
              {latest.grader === 'authored'
                ? 'Checked against the authored answer.'
                : `Checked by Claude (${latest.model}) against an authored model answer and rubric.`}
            </small>
          </article>
        )}
      </div>
      <aside className="practice-review">
        <h3>Suggested review</h3>
        <p className="practice-empty">Based only on your latest answer to each question.</p>
        <ReviewList items={review} onReview={onReview} />
      </aside>
    </section>
  );
}
