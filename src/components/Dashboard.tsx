import { ArrowRight, BookOpen, Clock3, FileText, Plus, Route, Upload } from 'lucide-react';
import type { AppState } from '../../shared/model';
import { Yoyo } from './Yoyo';
export function Dashboard({
  data,
  onCreate,
  onCourse,
  onTopic,
  onSample,
  busy,
}: {
  data: AppState;
  onCreate: () => void;
  onCourse: (id: string) => void;
  onTopic: (id: string) => void;
  onSample: () => void;
  busy: boolean;
}) {
  const last = data.topics.find((t) => t.id === data.settings.lastTopicId),
    lastCourse = data.courses.find((c) => c.id === last?.courseId);
  return (
    <div className="dashboard page-enter">
      <div className="page-heading">
        <div>
          <h1>Your space to understand.</h1>
          <p>A home for your courses. A companion for the curious.</p>
        </div>
        <button className="button primary" onClick={onCreate}>
          <Plus size={17} />
          New course
        </button>
      </div>
      <section className="welcome glass">
        <div className="welcome-copy">
          <h2>{last ? 'Let’s pick up the thread.' : 'Big ideas. Small steps.'}</h2>
          <p>
            {last
              ? 'Your materials, your notes, and a little help along the way. Come back to where you left off.'
              : 'Bring your lecture notes. Find your next topic. Make a little more sense of it all.'}
          </p>
          {last ? (
            <button className="button ink" onClick={() => onTopic(last.id)}>
              Continue learning
              <ArrowRight size={17} />
            </button>
          ) : (
            <button className="button ink" onClick={onCreate}>
              Create your first course
              <ArrowRight size={17} />
            </button>
          )}
          <span className="quiet-note">Your workspace stays on this Mac.</span>
        </div>
        <div className="welcome-yoyo">
          <span className="hello-note">
            a little clarity,
            <br />a little company.
          </span>
          <Yoyo />
          <span className="yoyo-name">Meet Yoyo, your study companion</span>
        </div>
      </section>
      {last && (
        <button className="continue-row" onClick={() => onTopic(last.id)}>
          <span className="continue-icon">
            <BookOpen size={21} />
          </span>
          <span>
            <small>Continue learning · {lastCourse?.title}</small>
            <strong>{last.title}</strong>
          </span>
          <ArrowRight size={20} />
        </button>
      )}
      <div className="dashboard-lower">
        <section className="courses-section">
          <div className="section-heading">
            <h2>
              Your courses <span>{data.courses.length}</span>
            </h2>
            {data.courses.length > 0 && (
              <button className="text-button" onClick={onCreate}>
                Add course
                <Plus size={15} />
              </button>
            )}
          </div>
          {data.courses.length ? (
            <div className="course-grid">
              {data.courses.map((c) => {
                const docs = data.documents.filter((d) => d.courseId === c.id),
                  topics = data.topics.filter((t) => t.courseId === c.id);
                return (
                  <button
                    className={`course-card course-${c.color}`}
                    key={c.id}
                    onClick={() => onCourse(c.id)}
                  >
                    <div className="course-card-top">
                      <BookOpen size={23} />
                      <ArrowRight size={18} />
                    </div>
                    <h3>{c.title}</h3>
                    <p>
                      {docs.length} {docs.length === 1 ? 'document' : 'documents'}
                      <span>·</span>
                      {topics.length} {topics.length === 1 ? 'topic' : 'topics'}
                    </p>
                    <div className="course-card-bottom">
                      {docs.length ? 'Open your roadmap' : 'Add your first lecture'}
                      <span className="course-dot" />
                    </div>
                  </button>
                );
              })}
            </div>
          ) : (
            <div className="empty-courses">
              <div className="empty-illustration">
                <FileText size={27} />
                <Route size={21} />
              </div>
              <h3>Start with something you’re learning.</h3>
              <p>
                Create a course, then add a PDF. We’ll use its headings to help you build an
                editable roadmap.
              </p>
              <button className="text-button" onClick={onSample} disabled={busy}>
                Explore a sample course
                <ArrowRight size={16} />
              </button>
              <small>Includes a short, clearly labelled sample lecture.</small>
            </div>
          )}
        </section>
        <aside className="activity-section">
          <div className="section-heading">
            <h2>Recently, in your workspace</h2>
          </div>
          {data.activities.length ? (
            <ol className="activity-list">
              {data.activities.slice(0, 5).map((a) => (
                <li key={a.id}>
                  <span className="activity-mark">
                    <Clock3 size={14} />
                  </span>
                  <button onClick={() => (a.topicId ? onTopic(a.topicId) : onCourse(a.courseId))}>
                    <strong>{a.text}</strong>
                    <small>
                      {new Date(a.createdAt).toLocaleDateString(undefined, {
                        month: 'short',
                        day: 'numeric',
                      })}{' '}
                      · {data.courses.find((c) => c.id === a.courseId)?.title}
                    </small>
                  </button>
                </li>
              ))}
            </ol>
          ) : (
            <div className="activity-empty">
              <Clock3 size={21} />
              <p>A fresh page.</p>
              <span>Your courses and study activity will appear here as you go.</span>
            </div>
          )}
          <div className="local-note">
            <Upload size={17} />
            <p>
              Lecture PDFs belong here.
              <br />
              <span>Up to 50 MB · Stored locally</span>
            </p>
          </div>
        </aside>
      </div>
    </div>
  );
}
