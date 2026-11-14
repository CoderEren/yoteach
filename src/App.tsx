import { useEffect, useState, lazy, Suspense } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  Check,
  ChevronRight,
  FolderOpen,
  Home,
  LoaderCircle,
  Monitor,
  Moon,
  Plus,
  Search,
  Settings,
  ShieldCheck,
  Sun,
  X,
} from 'lucide-react';
import type { AppState, Command, Course, SourceDocument, Topic } from '../shared/model';
import { api, unwrap } from './api';
import type { loadPdf as LoadPdf } from './pdf';
import { Dashboard } from './components/Dashboard';
import { CourseWorkspace } from './components/CourseWorkspace';
import { Modal } from './components/Modal';
const PdfViewer = lazy(() =>
  import('./components/PdfViewer').then((m) => ({ default: m.PdfViewer })),
);
import { Yoyo } from './components/Yoyo';
import { Companion } from './components/Companion';
type EditModal =
  | { kind: 'course'; course?: Course }
  | { kind: 'topic'; topic?: Topic }
  | { kind: 'delete'; entity: 'course' | 'topic' | 'document'; id: string; title: string }
  | { kind: 'settings' };
export default function App() {
  const [data, setData] = useState<AppState | null>(null),
    [fatal, setFatal] = useState(''),
    [error, setError] = useState(''),
    [notice, setNotice] = useState(''),
    [courseId, setCourseId] = useState<string | null>(null),
    [topicId, setTopicId] = useState<string | null>(null),
    [query, setQuery] = useState(''),
    [modal, setModal] = useState<EditModal | null>(null),
    [viewer, setViewer] = useState<{ id: string; page: number } | null>(null),
    [busy, setBusy] = useState(''),
    [title, setTitle] = useState(''),
    [color, setColor] = useState<Course['color']>('iris'),
    [overview, setOverview] = useState(''),
    [parentId, setParentId] = useState(''),
    [formError, setFormError] = useState(''),
    [saving, setSaving] = useState(false);
  const companion = location.hash === '#/companion';
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === ',') {
        e.preventDefault();
        setModal({ kind: 'settings' });
      }
    };
    addEventListener('keydown', handler);
    return () => removeEventListener('keydown', handler);
  }, []);
  useEffect(() => {
    if (!api) {
      setFatal('Open yoteach through npm run dev or npm start to connect the desktop workspace.');
      return;
    }
    unwrap(api.getState())
      .then(setData)
      .catch((e) => setFatal(e.message));
    return api.onState(setData);
  }, []);
  useEffect(() => {
    if (!data) return;
    const media = matchMedia('(prefers-color-scheme: dark)');
    const apply = () => {
      document.documentElement.dataset.theme =
        data.settings.theme === 'system' ? (media.matches ? 'dark' : 'light') : data.settings.theme;
    };
    apply();
    media.addEventListener('change', apply);
    return () => media.removeEventListener('change', apply);
  }, [data?.settings.theme]);
  useEffect(() => {
    document.body.classList.toggle('companion-body', companion);
  }, [companion]);
  useEffect(() => {
    if (!notice) return;
    const t = setTimeout(() => setNotice(''), 5000);
    return () => clearTimeout(t);
  }, [notice]);
  async function command(cmd: Command) {
    const result = await unwrap(api.command(cmd));
    setData(result);
    return result;
  }
  function report(e: unknown) {
    setError(e instanceof Error ? e.message : String(e));
  }
  function openCourse(id: string) {
    setCourseId(id);
    setTopicId(null);
    setQuery('');
  }
  function openTopic(id: string) {
    if (!id) {
      setTopicId(null);
      return;
    }
    const t = data?.topics.find((t) => t.id === id);
    if (!t) return;
    setCourseId(t.courseId);
    setTopicId(id);
    setQuery('');
    void command({ type: 'topic.open', id }).catch(report);
  }
  function edit(next: EditModal) {
    setFormError('');
    setModal(next);
    setTitle(
      next.kind === 'course'
        ? (next.course?.title ?? '')
        : next.kind === 'topic'
          ? (next.topic?.title ?? '')
          : '',
    );
    setColor(next.kind === 'course' ? (next.course?.color ?? 'iris') : 'iris');
    setOverview(next.kind === 'topic' ? (next.topic?.overview ?? '') : '');
    setParentId(next.kind === 'topic' ? (next.topic?.parentId ?? '') : '');
  }
  async function saveForm(e: React.FormEvent) {
    e.preventDefault();
    if (!modal || saving) return;
    setSaving(true);
    setFormError('');
    try {
      if (modal.kind === 'course') {
        const next = await command(
          modal.course
            ? { type: 'course.rename', id: modal.course.id, title }
            : { type: 'course.create', title, color },
        );
        if (!modal.course) openCourse(next.courses.at(-1)!.id);
        setNotice(
          modal.course ? 'Course renamed.' : 'Your course is ready. Add a lecture PDF to begin.',
        );
      }
      if (modal.kind === 'topic' && courseId) {
        const next = await command(
          modal.topic
            ? {
                type: 'topic.update',
                id: modal.topic.id,
                title,
                overview,
                parentId: parentId || null,
              }
            : { type: 'topic.create', courseId, title, parentId: parentId || null },
        );
        if (!modal.topic) {
          const created = next.topics.at(-1)!;
          setTopicId(created.id);
          await command({ type: 'topic.open', id: created.id });
        }
        setNotice(modal.topic ? 'Topic saved.' : 'Topic added.');
      }
      if (modal.kind === 'delete') {
        await command({ type: `${modal.entity}.delete` as 'course.delete', id: modal.id });
        if (modal.entity === 'course') {
          setCourseId(null);
          setTopicId(null);
        }
        if (modal.entity === 'topic') setTopicId(null);
        setNotice(
          `${modal.entity === 'document' ? 'PDF' : modal.entity === 'topic' ? 'Topic' : 'Course'} removed.`,
        );
      }
      setModal(null);
    } catch (e) {
      setFormError(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  }
  async function importPdf(id: string, sample = false) {
    if (busy) return;
    setBusy('Choose a lecture PDF…');
    setError('');
    let token: string | undefined;
    let task: ReturnType<typeof LoadPdf> | undefined;
    try {
      const selected = await unwrap(api.pickPdf(id, sample));
      if (!selected) return;
      token = selected.token;
      setBusy('Reading your PDF…');
      const { loadPdf, extractPdf } = await import('./pdf');
      task = loadPdf(selected.bytes);
      const pdf = await task.promise;
      const result = await extractPdf(pdf, (p, total) => setBusy(`Reading page ${p} of ${total}…`));
      if (!result.headings.length)
        result.headings.push({
          title: selected.name.replace(/\.pdf$/i, '').slice(0, 120) || 'Lecture notes',
          page: 1,
          level: 1,
        });
      const next = await unwrap(api.finishImport({ token, courseId: id, ...result }));
      setData(next);
      setNotice(
        result.organization === 'fallback'
          ? 'PDF added. No headings found; edit the starter topic to organize it.'
          : `PDF added. Roadmap created from ${result.organization === 'outline' ? 'bookmarks' : 'detected headings'}—review and edit as needed.`,
      );
    } catch (e) {
      report(e);
    } finally {
      if (token) await api.cancelImport(token);
      await task?.destroy();
      setBusy('');
    }
  }
  async function addSample() {
    if (busy) return;
    try {
      const existing = data?.courses.find((c) => c.title === 'Biochemistry · Sample');
      const next = existing
        ? data!
        : await command({ type: 'course.create', title: 'Biochemistry · Sample', color: 'iris' });
      const id = existing?.id ?? next.courses.at(-1)!.id;
      openCourse(id);
      await importPdf(id, true);
    } catch (e) {
      report(e);
    }
  }
  if (fatal)
    return (
      <div className="launch-message">
        <Yoyo />
        <h1>Let’s open your workspace.</h1>
        <p role="alert">{fatal}</p>
      </div>
    );
  if (!data)
    return (
      <div className="launch-message">
        <LoaderCircle className="spin" />
        <p>Opening your workspace…</p>
      </div>
    );
  if (companion) return <Companion data={data} />;
  const course = data.courses.find((c) => c.id === courseId),
    topic = data.topics.find((t) => t.id === topicId),
    viewDoc = data.documents.find((d) => d.id === viewer?.id),
    matchingCourses = data.courses.filter((c) =>
      c.title.toLowerCase().includes(query.toLowerCase()),
    ),
    matchingTopics = data.topics.filter((t) => t.title.toLowerCase().includes(query.toLowerCase()));
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="titlebar-space" />
        <button
          className="brand"
          onClick={() => {
            setCourseId(null);
            setTopicId(null);
            setQuery('');
          }}
          aria-label="yoteach home"
        >
          <span className="brand-symbol">
            <span />
            <span />
          </span>
          yoteach<span className="brand-period">.</span>
        </button>
        <nav className="primary-nav" aria-label="Main navigation">
          <button
            className={!courseId && !query ? 'active' : ''}
            onClick={() => {
              setCourseId(null);
              setTopicId(null);
              setQuery('');
            }}
          >
            <Home size={18} />
            Workspace
          </button>
        </nav>
        <div className="sidebar-section-title">
          <span>Your courses</span>
          <button
            className="icon-button"
            onClick={() => edit({ kind: 'course' })}
            aria-label="Create course"
          >
            <Plus size={16} />
          </button>
        </div>
        <nav className="course-nav" aria-label="Courses">
          {data.courses.map((c) => (
            <button
              key={c.id}
              className={courseId === c.id ? 'active' : ''}
              onClick={() => openCourse(c.id)}
            >
              <span className={`sidebar-course-dot course-${c.color}`} />
              <span>{c.title}</span>
              {courseId === c.id && <ChevronRight size={14} />}
            </button>
          ))}
          {!data.courses.length && (
            <p className="sidebar-empty">
              Room for everything
              <br />
              you want to learn.
            </p>
          )}
        </nav>
        <div className="sidebar-bottom">
          <div className="sidebar-companion">
            <div className="mini-yoyo">
              <Yoyo />
            </div>
            <div>
              <strong>Yoyo is here.</strong>
              <span>Your desktop companion</span>
            </div>
            <button
              className="icon-button"
              aria-label="Show Yoyo"
              onClick={() => void unwrap(api.companion('show')).catch(report)}
            >
              <ArrowRight size={16} />
            </button>
          </div>
          <button className="sidebar-setting" onClick={() => edit({ kind: 'settings' })}>
            <Settings size={17} />
            Settings<span>⌘ ,</span>
          </button>
          <div className="sidebar-local">
            <ShieldCheck size={13} />
            On this Mac · Stage 1
          </div>
        </div>
      </aside>
      <main className="main-shell">
        <header className="topbar">
          <div className="breadcrumbs">
            {course ? (
              <>
                <button
                  onClick={() => {
                    setCourseId(null);
                    setTopicId(null);
                  }}
                  aria-label="Back to workspace"
                >
                  <ArrowLeft size={17} />
                </button>
                <span>Workspace</span>
                <ChevronRight size={14} />
                <strong>{course.title}</strong>
              </>
            ) : (
              <>
                <FolderOpen size={16} />
                <span>Learning workspace</span>
              </>
            )}
          </div>
          <div className="search-field">
            <Search size={16} />
            <input
              aria-label="Search courses and topics"
              placeholder="Find a course or topic"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            {query && (
              <button aria-label="Clear search" onClick={() => setQuery('')}>
                <X size={15} />
              </button>
            )}
          </div>
          <button
            className="topbar-yoyo"
            onClick={() => void unwrap(api.companion('show')).catch(report)}
          >
            <span className="status-dot" />
            Show Yoyo
          </button>
        </header>
        <div className="main-scroll">
          {error && (
            <div className="banner error" role="alert">
              <span>{error}</span>
              <button
                className="icon-button"
                onClick={() => setError('')}
                aria-label="Dismiss error"
              >
                <X size={16} />
              </button>
            </div>
          )}
          {busy && (
            <div className="banner import-progress" role="status">
              <LoaderCircle className="spin" size={18} />
              <span>{busy}</span>
              <small>Keep yoteach open until import finishes.</small>
            </div>
          )}
          {query ? (
            <section className="search-results page-enter">
              <h1>Search your workspace</h1>
              <p>Results for “{query}”</p>
              {matchingCourses.length + matchingTopics.length === 0 ? (
                <div className="quiet-empty">
                  <Search size={30} />
                  <h2>No matches yet.</h2>
                  <p>Try a different course or topic name.</p>
                </div>
              ) : (
                <>
                  {matchingCourses.map((c) => (
                    <button className="search-result" key={c.id} onClick={() => openCourse(c.id)}>
                      <BookOpen size={20} />
                      <span>
                        <strong>{c.title}</strong>
                        <small>Course</small>
                      </span>
                      <ChevronRight size={18} />
                    </button>
                  ))}
                  {matchingTopics.map((t) => (
                    <button className="search-result" key={t.id} onClick={() => openTopic(t.id)}>
                      <FolderOpen size={20} />
                      <span>
                        <strong>{t.title}</strong>
                        <small>
                          {data.courses.find((c) => c.id === t.courseId)?.title} · Topic
                        </small>
                      </span>
                      <ChevronRight size={18} />
                    </button>
                  ))}
                </>
              )}
            </section>
          ) : course ? (
            <CourseWorkspace
              data={data}
              course={course}
              topicId={topicId}
              onTopic={openTopic}
              onAddTopic={() => edit({ kind: 'topic' })}
              onEditTopic={(topic) => edit({ kind: 'topic', topic })}
              onDeleteTopic={(t) =>
                edit({ kind: 'delete', entity: 'topic', id: t.id, title: t.title })
              }
              onMoveTopic={(t, direction) =>
                void command({ type: 'topic.move', id: t.id, direction }).catch(report)
              }
              onRenameCourse={() => edit({ kind: 'course', course })}
              onDeleteCourse={() =>
                edit({ kind: 'delete', entity: 'course', id: course.id, title: course.title })
              }
              onImport={() => void importPdf(course.id)}
              onOpenPdf={(d, p = 1) => setViewer({ id: d.id, page: p })}
              onDeletePdf={(d) =>
                edit({ kind: 'delete', entity: 'document', id: d.id, title: d.originalName })
              }
              busy={!!busy}
            />
          ) : (
            <Dashboard
              data={data}
              onCreate={() => edit({ kind: 'course' })}
              onCourse={openCourse}
              onTopic={openTopic}
              onSample={() => void addSample()}
              busy={!!busy}
            />
          )}
          <footer className="workspace-footer">
            <span>A little clearer, every day.</span>
            <span>yoteach · Desktop foundation</span>
          </footer>
        </div>
      </main>
      {notice && (
        <div className="toast" role="status">
          <Check size={17} />
          {notice}
          <button
            className="icon-button"
            onClick={() => setNotice('')}
            aria-label="Dismiss notification"
          >
            <X size={15} />
          </button>
        </div>
      )}
      {modal && (
        <Modal
          title={
            modal.kind === 'course'
              ? modal.course
                ? 'Rename course'
                : 'Make room for a new subject.'
              : modal.kind === 'topic'
                ? modal.topic
                  ? 'Edit topic'
                  : 'Add a topic'
                : modal.kind === 'delete'
                  ? `Remove ${modal.entity === 'document' ? 'PDF' : modal.entity}?`
                  : 'Make yourself at home.'
          }
          onClose={() => {
            if (!saving) setModal(null);
          }}
        >
          {modal.kind === 'settings' ? (
            <div className="settings-content">
              <h3>Appearance</h3>
              <p>Choose the light that works for you.</p>
              <div className="theme-options">
                {(
                  [
                    { id: 'light', label: 'Light', icon: Sun },
                    { id: 'dark', label: 'Dark', icon: Moon },
                    { id: 'system', label: 'System', icon: Monitor },
                  ] as const
                ).map((t) => (
                  <button
                    key={t.id}
                    className={data.settings.theme === t.id ? 'selected' : ''}
                    aria-pressed={data.settings.theme === t.id}
                    onClick={() =>
                      void command({ type: 'settings.update', theme: t.id }).catch(report)
                    }
                  >
                    <t.icon size={22} />
                    {t.label}
                  </button>
                ))}
              </div>
              <h3>Desktop companion</h3>
              <p>Drag Yoyo with the grip above its head. Click Yoyo to preview expressions.</p>
              <button
                className="button"
                onClick={() =>
                  void unwrap(api.companion(data.settings.mascotVisible ? 'hide' : 'show')).catch(
                    report,
                  )
                }
              >
                {data.settings.mascotVisible ? 'Hide Yoyo' : 'Show Yoyo'}
              </button>
              <p className="settings-shortcut">Restore from the menu bar or press ⌘ ⇧ Y.</p>
              <div className="settings-privacy">
                <ShieldCheck size={22} />
                <div>
                  <strong>Your study space stays local.</strong>
                  <p>
                    Courses, PDFs and notes are saved on this Mac. Microphone and screen access are
                    off. No AI services are connected in Stage 1.
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <form onSubmit={saveForm} className="editor-form">
              {modal.kind === 'delete' ? (
                <>
                  <p>
                    Remove <strong>“{modal.title}”</strong>?
                  </p>
                  <p className="secondary">
                    {modal.entity === 'course'
                      ? 'This removes its topics, notes and imported PDF copies from yoteach. Your original files stay where they are.'
                      : modal.entity === 'topic'
                        ? 'This removes the topic and its notes. Subtopics move up one level. Source PDFs stay in your course.'
                        : 'This removes the imported copy and its source links. Topics and your notes remain. Your original file stays where it is.'}
                  </p>
                  <p className="delete-warning">This action cannot be undone.</p>
                </>
              ) : (
                <>
                  <label>
                    {modal.kind === 'course' ? 'Course name' : 'Topic title'}
                    <input
                      autoFocus
                      required
                      maxLength={120}
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      placeholder={
                        modal.kind === 'course'
                          ? 'e.g. Biochemistry'
                          : 'e.g. Energy investment phase'
                      }
                    />
                  </label>
                  {modal.kind === 'course' && !modal.course && (
                    <fieldset className="color-picker">
                      <legend>Course colour</legend>
                      {(['iris', 'cyan', 'rose', 'sage'] as const).map((c) => (
                        <button
                          key={c}
                          type="button"
                          className={`color-option course-${c} ${color === c ? 'selected' : ''}`}
                          aria-label={c}
                          aria-pressed={color === c}
                          onClick={() => setColor(c)}
                        >
                          {color === c && <Check size={17} />}
                        </button>
                      ))}
                    </fieldset>
                  )}
                  {modal.kind === 'topic' && (
                    <>
                      <label>
                        Place under
                        <select value={parentId} onChange={(e) => setParentId(e.target.value)}>
                          <option value="">Course root</option>
                          {data.topics
                            .filter((t) => t.courseId === courseId && t.id !== modal.topic?.id)
                            .map((t) => (
                              <option key={t.id} value={t.id}>
                                {t.title}
                              </option>
                            ))}
                        </select>
                      </label>
                      {modal.topic && (
                        <label>
                          Your notes & overview
                          <textarea
                            rows={6}
                            maxLength={20000}
                            value={overview}
                            onChange={(e) => setOverview(e.target.value)}
                            placeholder="What should you remember? What do you want to ask?"
                          />
                        </label>
                      )}
                    </>
                  )}
                </>
              )}
              {formError && (
                <p className="error-message" role="alert">
                  {formError}
                </p>
              )}
              <div className="form-actions">
                <button
                  type="button"
                  className="button"
                  disabled={saving}
                  onClick={() => setModal(null)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className={`button ${modal.kind === 'delete' ? 'destructive' : 'primary'}`}
                  disabled={saving}
                >
                  {saving ? (
                    <>
                      <LoaderCircle className="spin" size={16} />
                      Saving…
                    </>
                  ) : modal.kind === 'delete' ? (
                    'Remove'
                  ) : modal.kind === 'course' ? (
                    modal.course ? (
                      'Save name'
                    ) : (
                      'Create course'
                    )
                  ) : modal.topic ? (
                    'Save topic'
                  ) : (
                    'Add topic'
                  )}
                </button>
              </div>
            </form>
          )}
        </Modal>
      )}
      {viewer && viewDoc && (
        <Suspense
          fallback={
            <div className="toast" role="status">
              Opening PDF…
            </div>
          }
        >
          <PdfViewer document={viewDoc} initialPage={viewer.page} onClose={() => setViewer(null)} />
        </Suspense>
      )}
    </div>
  );
}
