import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, writeFileSync, existsSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { Store } from '../electron/store';
function setup() {
  const dir = mkdtempSync(join(tmpdir(), 'yoteach-test-'));
  return {
    dir,
    store: new Store(dir),
    cleanup: () => rmSync(dir, { recursive: true, force: true }),
  };
}
test('courses, nested topics, notes and settings survive reopening', () => {
  const { dir, store, cleanup } = setup();
  try {
    const c = store.command({ type: 'course.create', title: 'Physics', color: 'cyan' }).courses[0];
    const t = store.command({
      type: 'topic.create',
      title: 'Motion',
      courseId: c.id,
      parentId: null,
    }).topics[0];
    store.command({
      type: 'topic.update',
      id: t.id,
      title: 'Motion',
      overview: 'Review acceleration.',
      parentId: null,
    });
    store.command({ type: 'topic.open', id: t.id });
    store.command({ type: 'settings.update', theme: 'dark' });
    const reopened = new Store(dir).snapshot();
    assert.equal(reopened.topics[0].overview, 'Review acceleration.');
    assert.equal(reopened.settings.theme, 'dark');
    assert.equal(reopened.settings.lastTopicId, t.id);
    assert.equal(reopened.courses[0].title, 'Physics');
  } finally {
    cleanup();
  }
});
test('validation rejects invalid input, missing IDs, cross-course nesting and cycles without changing data', () => {
  const { store, cleanup } = setup();
  try {
    const c = store.command({ type: 'course.create', title: 'Maths', color: 'iris' }).courses[0];
    const t = store.command({
      type: 'topic.create',
      title: 'Parent',
      courseId: c.id,
      parentId: null,
    }).topics[0];
    const child = store.command({
      type: 'topic.create',
      title: 'Child',
      courseId: c.id,
      parentId: t.id,
    }).topics[1];
    const before = store.snapshot();
    assert.throws(
      () =>
        store.command({
          type: 'topic.update',
          id: t.id,
          title: t.title,
          overview: '',
          parentId: child.id,
        }),
      /itself/,
    );
    assert.throws(() => store.command({ type: 'course.rename', id: c.id, title: '   ' }));
    assert.throws(() => store.readPdf('../../secrets'));
    assert.throws(() =>
      store.command({
        type: 'topic.create',
        courseId: randomUUID(),
        title: 'Oops',
        parentId: null,
      }),
    );
    assert.deepEqual(store.snapshot(), before);
    const other = store.command({ type: 'course.create', title: 'Other', color: 'sage' })
      .courses[1];
    assert.throws(
      () =>
        store.command({ type: 'topic.create', courseId: other.id, title: 'Oops', parentId: t.id }),
      /same course/,
    );
  } finally {
    cleanup();
  }
});
test('PDF ownership, source refs and deletion preserve originals and remove owned copies', () => {
  const { dir, store, cleanup } = setup();
  try {
    const c = store.command({ type: 'course.create', title: 'Biology', color: 'sage' }).courses[0];
    const bytes = new Uint8Array(Buffer.from('%PDF-1.7 test'));
    const original = join(dir, 'original.pdf');
    writeFileSync(original, bytes);
    const state = store.importPdf(
      {
        token: randomUUID(),
        courseId: c.id,
        pages: [{ page: 1, text: 'Test' }],
        headings: [{ title: 'Topic', page: 1, level: 1 }],
        organization: 'headings',
      },
      'Lecture.pdf',
      bytes,
    );
    const doc = state.documents[0],
      topic = state.topics[0];
    assert.deepEqual(store.readPdf(doc.id), bytes);
    assert.equal(topic.sourceRefs[0].documentId, doc.id);
    assert.throws(
      () =>
        store.importPdf(
          {
            token: randomUUID(),
            courseId: c.id,
            pages: [{ page: 1, text: '' }],
            headings: [{ title: 'Bad', page: 2, level: 1 }],
            organization: 'headings',
          },
          'Bad.pdf',
          bytes,
        ),
      /page references/,
    );
    store.command({ type: 'document.delete', id: doc.id });
    assert.equal(readdirSync(store.documentsDir).length, 0);
    assert.equal(store.snapshot().topics[0].sourceRefs.length, 0);
    assert.ok(existsSync(original));
    store.command({ type: 'course.delete', id: c.id });
    assert.equal(store.snapshot().topics.length, 0);
    assert.equal(store.snapshot().activities.length, 0);
  } finally {
    cleanup();
  }
});
test('topic deletion promotes children; reorder is stable across restarts', () => {
  const { dir, store, cleanup } = setup();
  try {
    const c = store.command({ type: 'course.create', title: 'Algorithms', color: 'iris' })
      .courses[0];
    const a = store.command({ type: 'topic.create', title: 'A', courseId: c.id, parentId: null })
      .topics[0];
    const b = store.command({ type: 'topic.create', title: 'B', courseId: c.id, parentId: null })
      .topics[1];
    store.command({ type: 'topic.create', title: 'Child', courseId: c.id, parentId: a.id });
    store.command({ type: 'topic.move', id: b.id, direction: 'up' });
    assert.equal(
      new Store(dir)
        .snapshot()
        .topics.filter((t) => !t.parentId)
        .sort((a, b) => a.order - b.order)[0].id,
      b.id,
    );
    store.command({ type: 'topic.delete', id: a.id });
    assert.equal(store.snapshot().topics.find((t) => t.title === 'Child')?.parentId, null);
  } finally {
    cleanup();
  }
});
test('a corrupt snapshot is preserved rather than silently reset', () => {
  const { dir, store, cleanup } = setup();
  try {
    writeFileSync(store.file, '{bad json');
    assert.throws(() => new Store(dir), /left untouched/);
    assert.equal(readFileSync(store.file, 'utf8'), '{bad json');
  } finally {
    cleanup();
  }
});
