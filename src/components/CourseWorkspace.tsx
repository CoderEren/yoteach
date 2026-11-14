import { useEffect, useState } from 'react';
import {
  ArrowDown,
  ArrowUp,
  ArrowUpRight,
  BookOpen,
  ChevronRight,
  FileText,
  FolderOpen,
  GraduationCap,
  Layers3,
  MessageSquare,
  MoreHorizontal,
  Pencil,
  Plus,
  Route,
  Trash2,
  Upload,
} from 'lucide-react';
import type { AppState, Course, SourceDocument, Topic } from '../../shared/model';
export type TopicTab =
  'overview' | 'sources' | 'explanations' | 'lessons' | 'practice' | 'progress';
const tabs: { id: TopicTab; label: string }[] = [
  { id: 'overview', label: 'Overview' },
  { id: 'sources', label: 'Sources' },
  { id: 'explanations', label: 'Explanations' },
  { id: 'lessons', label: 'Lessons' },
  { id: 'practice', label: 'Practice' },
  { id: 'progress', label: 'Progress' },
];
export function CourseWorkspace({
  data,
  course,
  topicId,
  onTopic,
  onAddTopic,
  onEditTopic,
  onDeleteTopic,
  onMoveTopic,
  onRenameCourse,
  onDeleteCourse,
  onImport,
  onOpenPdf,
  onDeletePdf,
  busy,
}: {
  data: AppState;
  course: Course;
  topicId: string | null;
  onTopic: (id: string) => void;
  onAddTopic: () => void;
  onEditTopic: (t: Topic) => void;
  onDeleteTopic: (t: Topic) => void;
  onMoveTopic: (t: Topic, d: 'up' | 'down') => void;
  onRenameCourse: () => void;
  onDeleteCourse: () => void;
  onImport: () => void;
  onOpenPdf: (d: SourceDocument, p?: number) => void;
  onDeletePdf: (d: SourceDocument) => void;
  busy: boolean;
}) {
  const topics = data.topics.filter((t) => t.courseId === course.id),
    documents = data.documents.filter((d) => d.courseId === course.id),
    topic = topics.find((t) => t.id === topicId);
  const [tab, setTab] = useState<TopicTab>('overview');
  useEffect(() => setTab('overview'), [topicId, course.id]);
  function branch(parentId: string | null, depth = 0): React.ReactNode {
    return topics
      .filter((t) => t.parentId === parentId)
      .sort((a, b) => a.order - b.order)
      .map((t) => (
        <li key={t.id}>
          <button
            className={`roadmap-topic ${t.id === topicId ? 'active' : ''}`}
            onClick={() => onTopic(t.id)}
            aria-current={t.id === topicId ? 'page' : undefined}
          >
            <span className="roadmap-node" />
            <span>{t.title}</span>
            <ChevronRight size={14} />
          </button>
          {depth < 30 && topics.some((s) => s.parentId === t.id) && (
            <ol>{branch(t.id, depth + 1)}</ol>
          )}
        </li>
      ));
  }
  const sourceDocs = topic
    ? documents.filter((d) => topic.sourceRefs.some((r) => r.documentId === d.id))
    : documents;
  const sourceList = (
    <div className="document-list">
      {sourceDocs.length ? (
        sourceDocs.map((d) => {
          const ref = topic?.sourceRefs.find((r) => r.documentId === d.id);
          return (
            <article className="document-row" key={d.id}>
              <span className="document-icon">
                <FileText size={23} />
                <small>PDF</small>
              </span>
              <button className="document-title" onClick={() => onOpenPdf(d, ref?.page)}>
                <strong>{d.originalName}</strong>
                <span>
                  {d.pageCount} pages{ref ? ` · Topic starts on page ${ref.page}` : ''} ·{' '}
                  {d.organization === 'outline'
                    ? 'PDF bookmarks'
                    : d.organization === 'headings'
                      ? 'Detected headings'
                      : 'Manual organization'}
                </span>
              </button>
              <button
                className="icon-button"
                onClick={() => onOpenPdf(d, ref?.page)}
                aria-label={`Open ${d.originalName}`}
              >
                <ArrowUpRight size={19} />
              </button>
              <button
                className="icon-button danger-subtle"
                onClick={() => onDeletePdf(d)}
                aria-label={`Remove ${d.originalName}`}
              >
                <Trash2 size={16} />
              </button>
            </article>
          );
        })
      ) : (
        <div className="quiet-empty">
          <FolderOpen size={28} />
          <h3>{topic ? 'No source pages linked' : 'Your lectures go here.'}</h3>
          <p>
            {topic
              ? 'This is a manually added topic. Your course PDFs are available in the course library.'
              : 'Add a PDF to read it here and organize its headings into topics.'}
          </p>
          {!topic && (
            <button className="button" onClick={onImport} disabled={busy}>
              <Upload size={16} />
              Add PDF
            </button>
          )}
        </div>
      )}
    </div>
  );
  const future = {
    explanations: {
      icon: MessageSquare,
      title: 'Keep the explanations that click.',
      body: 'Saved tutor explanations will live alongside this topic, ready to revisit.',
      stage: 'Planned for Stage 2',
    },
    lessons: {
      icon: Layers3,
      title: 'A different way to see it.',
      body: 'Step-by-step visual lessons will help you explore this topic when you ask for them.',
      stage: 'Planned for Stage 3',
    },
    practice: {
      icon: GraduationCap,
      title: 'Make understanding visible.',
      body: 'Practice questions and your responses will help reveal what makes sense and what needs another look.',
      stage: 'Planned for Stage 3',
    },
    progress: {
      icon: Route,
      title: 'Understanding takes evidence.',
      body: 'This topic has not been assessed. Future progress will use practice and demonstrated understanding, never time spent reading.',
      stage: 'Planned for Stage 3',
    },
  };
  return (
    <div className="course-workspace page-enter">
      <header className="course-heading">
        <div className={`course-symbol course-${course.color}`}>
          <BookOpen size={25} />
        </div>
        <div>
          <h1>{course.title}</h1>
          <p>
            {documents.length} {documents.length === 1 ? 'document' : 'documents'} · {topics.length}{' '}
            {topics.length === 1 ? 'topic' : 'topics'} · Local workspace
          </p>
        </div>
        <div className="course-actions">
          <button className="icon-button" onClick={onRenameCourse} aria-label="Rename course">
            <Pencil size={17} />
          </button>
          <button
            className="icon-button danger-subtle"
            onClick={onDeleteCourse}
            aria-label="Delete course"
          >
            <Trash2 size={17} />
          </button>
          <button className="button primary" onClick={onImport} disabled={busy}>
            <Upload size={17} />
            Add PDF
          </button>
        </div>
      </header>
      <div className="course-layout">
        <aside className="roadmap glass">
          <div className="roadmap-heading">
            <h2>Learning roadmap</h2>
            <button className="icon-button" onClick={onAddTopic} aria-label="Add topic">
              <Plus size={17} />
            </button>
          </div>
          <button className={`library-link ${!topic ? 'active' : ''}`} onClick={() => onTopic('')}>
            <FolderOpen size={17} />
            Course library<span>{documents.length}</span>
          </button>
          <div className="roadmap-divider" />
          <ol className="roadmap-tree">{branch(null)}</ol>
          {!topics.length && (
            <div className="roadmap-empty">
              <Route size={24} />
              <p>Your path starts here.</p>
              <span>Import a PDF or add topics yourself.</span>
            </div>
          )}
          <button className="add-topic text-button" onClick={onAddTopic}>
            <Plus size={15} />
            Add a topic
          </button>
          <p className="roadmap-footnote">
            Built from PDF headings.
            <br />
            Always yours to edit.
          </p>
        </aside>
        <section className="topic-content glass">
          {topic ? (
            <>
              <header className="topic-heading">
                <div className="topic-breadcrumb">
                  <BookOpen size={14} />
                  <span>
                    {topic.parentId
                      ? topics.find((t) => t.id === topic.parentId)?.title
                      : course.title}
                  </span>
                  <ChevronRight size={13} />
                  Topic
                </div>
                <div className="topic-title-row">
                  <h2>{topic.title}</h2>
                  <div className="topic-tools">
                    <button
                      className="icon-button"
                      onClick={() => onMoveTopic(topic, 'up')}
                      aria-label="Move topic up"
                    >
                      <ArrowUp size={16} />
                    </button>
                    <button
                      className="icon-button"
                      onClick={() => onMoveTopic(topic, 'down')}
                      aria-label="Move topic down"
                    >
                      <ArrowDown size={16} />
                    </button>
                    <button
                      className="icon-button"
                      onClick={() => onEditTopic(topic)}
                      aria-label="Edit topic"
                    >
                      <Pencil size={16} />
                    </button>
                    <button
                      className="icon-button danger-subtle"
                      onClick={() => onDeleteTopic(topic)}
                      aria-label="Delete topic"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
                <div className="topic-status">
                  <span className="status-dot" />
                  Not assessed<span>Build understanding at your pace.</span>
                </div>
              </header>
              <nav className="topic-tabs" aria-label="Topic sections">
                {tabs.map((t) => (
                  <button
                    key={t.id}
                    onClick={() => setTab(t.id)}
                    className={tab === t.id ? 'active' : ''}
                    aria-current={tab === t.id ? 'page' : undefined}
                  >
                    {t.label}
                  </button>
                ))}
              </nav>
              <div className="topic-tab-content">
                {tab === 'overview' ? (
                  <>
                    <div className="section-heading">
                      <h3>Your notes & overview</h3>
                      <button className="text-button" onClick={() => onEditTopic(topic)}>
                        <Pencil size={14} />
                        {topic.overview ? 'Edit notes' : 'Add notes'}
                      </button>
                    </div>
                    {topic.overview ? (
                      <div className="overview-copy">{topic.overview}</div>
                    ) : (
                      <p className="overview-empty">
                        What do you want to understand about this topic? Add a short overview or
                        leave yourself a question for next time.
                      </p>
                    )}
                    <div className="section-heading sources-heading">
                      <h3>Start with the source</h3>
                    </div>
                    {sourceList}
                    <div className="study-note">
                      <BookOpen size={20} />
                      <div>
                        <strong>A little more clarity, one topic at a time.</strong>
                        <p>
                          Read your source, make a note, and bring Yoyo along. Live tutoring will
                          arrive in a later stage.
                        </p>
                      </div>
                    </div>
                  </>
                ) : tab === 'sources' ? (
                  sourceList
                ) : (
                  (() => {
                    const item = future[tab];
                    return (
                      <div className="future-state">
                        <item.icon size={35} />
                        <h3>{item.title}</h3>
                        <p>{item.body}</p>
                        <span>{item.stage}</span>
                      </div>
                    );
                  })()
                )}
              </div>
            </>
          ) : (
            <>
              <header className="library-heading">
                <h2>Your course library</h2>
                <p>Keep the original material close. Follow a topic when you’re ready.</p>
              </header>
              {sourceList}
              <div className="organization-note">
                <Route size={20} />
                <div>
                  <h3>A roadmap you can make your own</h3>
                  <p>
                    We read PDF bookmarks first, then look for page headings. This is basic document
                    organization, not AI analysis. Rename, reorder, nest or add topics from the
                    roadmap.
                  </p>
                  <p>
                    Scanned PDFs can be viewed, but need manually added topics. OCR is not included
                    yet.
                  </p>
                </div>
              </div>
            </>
          )}
        </section>
      </div>
    </div>
  );
}
