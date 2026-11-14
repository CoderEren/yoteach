import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { Store } from '../electron/store';
import { Providers } from '../electron/providers';
import { TutorService } from '../electron/tutor';

/** Topic fixture: anything mentioning the TCA cycle is a new subject. */
function setup() {
  const dir = mkdtempSync(join(tmpdir(), 'yoteach-chats-')),
    store = new Store(dir);
  store.importPdf(
    {
      token: randomUUID(),
      courseId: null,
      pages: [1, 2].map((page) => ({ page, text: 'Glycolysis' })),
      headings: [],
      organization: 'fallback',
    },
    'Metabolism.pdf',
    new Uint8Array(Buffer.from('%PDF-1.7')),
  );
  const topicCalls: any[] = [];
  const service = new TutorService(
    store,
    new Providers(
      { elevenKey: 'k', agentId: 'a', visionKey: 'v', model: 'm', quickModel: 'quick' },
      async (url, init) => {
        if (String(url).includes('elevenlabs'))
          return new Response(JSON.stringify({ signed_url: 'wss://api.elevenlabs.io/x' }));
        const body = JSON.parse(String(init?.body));
        const input = JSON.parse(body.messages[0].content);
        topicCalls.push({ model: body.model, input });
        const tca = /TCA/i.test(input.newQuestion);
        const reply = input.currentChat
          ? { sameTopic: !tca, title: tca ? 'TCA Cycle' : 'Glycolysis' }
          : { sameTopic: true, title: tca ? 'TCA Cycle' : 'Glycolysis' };
        return new Response(
          JSON.stringify({ content: [{ type: 'text', text: JSON.stringify(reply) }] }),
        );
      },
    ),
    () => {},
    () => {},
  );
  return {
    dir,
    store,
    service,
    topicCalls,
    doc: store.snapshot().documents[0],
    cleanup: () => rmSync(dir, { recursive: true, force: true }),
  };
}

test('questions are filed into chats named by subject; a new subject starts a new chat', async () => {
  const f = setup();
  try {
    const s = await f.service.start(null, 'voice');
    f.service.transcript(s.id, 'user', 'Why does glycolysis invest ATP?', 'u1');
    await f.service.filed();
    f.service.transcript(s.id, 'assistant', 'Because it primes glucose.', 'a1');
    f.service.transcript(s.id, 'user', 'And why is that step irreversible?', 'u2');
    await f.service.filed();
    let data = f.store.snapshot();
    assert.equal(data.chats.length, 1);
    assert.equal(data.chats[0].title, 'Glycolysis');
    assert.equal(data.chats[0].named, true);
    assert.equal(f.topicCalls[0].model, 'quick');
    // The reply to a new subject can arrive before the topic check finishes; it moves too.
    f.service.transcript(s.id, 'user', 'OK, now explain the TCA cycle.', 'u3');
    f.service.transcript(s.id, 'assistant', 'The TCA cycle oxidizes acetyl-CoA.', 'a3');
    await f.service.filed();
    data = f.store.snapshot();
    const tca = data.chats.find((c) => c.title === 'TCA Cycle')!;
    assert.ok(tca);
    assert.equal(f.service.state.chatId, tca.id);
    assert.deepEqual(
      data.messages.filter((m) => m.chatId === tca.id).map((m) => m.eventId),
      ['u3', 'a3'],
    );
    assert.equal(
      data.messages.filter((m) => m.chatId === data.chats.find((c) => c.title === 'Glycolysis')!.id)
        .length,
      3,
    );
    // A session that reconnects soon continues the latest chat.
    f.service.end();
    const again = await f.service.start(null, 'text');
    assert.equal(f.service.state.chatId, tca.id);
    f.service.end();
    // Deleting a chat removes its messages only.
    f.store.deleteChat(tca.id);
    assert.equal(f.store.snapshot().chats.length, 1);
    assert.ok(f.store.snapshot().messages.every((m) => m.chatId !== tca.id));
    assert.ok(again.id);
  } finally {
    f.cleanup();
  }
});

test('without the topic model, a chat is named after its first question', async () => {
  const f = setup();
  try {
    (f.service.providers.config as any).visionKey = '';
    const s = await f.service.start(null, 'voice');
    f.service.transcript(s.id, 'user', 'How do vectors add head to tail?', 'u1');
    await f.service.filed();
    assert.equal(f.store.snapshot().chats[0].title, 'How do vectors add head to');
  } finally {
    f.cleanup();
  }
});

test('lecture walkthroughs get their own chat with slide numbers and logged drawings', async () => {
  const f = setup();
  try {
    const s = await f.service.start(null, 'voice', f.doc.id, 2);
    const chat = f.store.snapshot().chats.find((c) => c.kind === 'lecture')!;
    assert.equal(chat.title, 'Metabolism.pdf');
    assert.equal(f.service.state.chatId, chat.id);
    f.service.transcript(s.id, 'assistant', 'This slide shows the investment phase.', 'a1');
    const said = f.store.snapshot().messages.at(-1)!;
    assert.equal(said.page, 2);
    assert.equal(said.chatId, chat.id);
    assert.equal(f.topicCalls.length, 0, 'lecture chats are not re-filed by topic');
    f.store.logSlideDrawing(chat.id, 2, [
      { shape: 'circle', label: 'ATP', box: { x: 0.1, y: 0.1, width: 0.2, height: 0.1 } },
    ]);
    assert.equal(f.store.snapshot().slideDrawings[0].page, 2);
  } finally {
    f.cleanup();
  }
});

test('v6 data migrates to v7: one chat per earlier session, titled, with an exact backup', () => {
  const f = setup();
  try {
    const now = new Date().toISOString();
    const legacy: any = { ...f.store.snapshot(), version: 6 };
    delete legacy.chats;
    delete legacy.slideDrawings;
    const tutor = randomUUID(),
      lecture = randomUUID();
    legacy.sessions = [
      {
        id: tutor,
        courseId: null,
        topicId: null,
        documentId: null,
        page: 1,
        mode: 'voice',
        startedAt: now,
        endedAt: now,
      },
      {
        id: lecture,
        courseId: null,
        topicId: null,
        documentId: f.doc.id,
        page: 2,
        mode: 'voice',
        startedAt: now,
        endedAt: now,
      },
    ];
    legacy.messages = [
      {
        id: randomUUID(),
        sessionId: tutor,
        role: 'user',
        text: 'What is a vector, really?',
        createdAt: now,
      },
      {
        id: randomUUID(),
        sessionId: lecture,
        role: 'assistant',
        text: 'Slide one.',
        createdAt: now,
      },
    ];
    const bytes = JSON.stringify(legacy);
    writeFileSync(f.store.file, bytes);
    const data = new Store(f.dir).snapshot();
    assert.equal(data.version, 7);
    assert.deepEqual(data.chats.map((c) => [c.kind, c.title]).sort(), [
      ['chat', 'What is a vector, really'],
      ['lecture', 'Metabolism.pdf'],
    ]);
    assert.ok(data.messages.every((m) => data.chats.some((c) => c.id === m.chatId)));
    assert.equal(readFileSync(f.store.file + '.v6.backup', 'utf8'), bytes);
  } finally {
    f.cleanup();
  }
});
