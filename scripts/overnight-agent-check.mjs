// Opt-in paid text conversations; no screen/audio, no real client-tool effects.
import { config } from 'dotenv';
import { appendFileSync, mkdirSync, writeFileSync } from 'node:fs';
config({ quiet: true });
const phase = process.argv[2];
if (!['before', 'after'].includes(phase)) throw new Error('Choose before or after');
const questions = [
  ['biology', 'Why does a neuron fire an action potential?'],
  ['chemistry', 'Why does a catalyst speed up a reaction?'],
  ['physics', 'How does a pendulum exchange energy?'],
  ['vectors', 'How do I add two vectors?'],
  ['matrices', 'What does a rotation matrix do to a grid?'],
  ['calculus', 'What does a derivative mean?'],
  ['economics', 'Why does a supply shortage raise prices?'],
  ['history', 'How did Roman roads help trade?'],
  ['computing', 'How do packets travel across a network?'],
  ['geography', 'Why do tectonic plates cause earthquakes?'],
  ['language', 'How does the subject relate to the verb in a sentence?'],
  ['literature', 'How does dramatic irony work in Romeo and Juliet?'],
];
mkdirSync('docs/overnight/live', { recursive: true });
const results = [];
for (const [subject, question] of questions) {
  // Record the attempt before opening the paid connection, including failed attempts.
  appendFileSync(
    'docs/overnight/spend.md',
    `| ${new Date().toISOString()} | ElevenLabs | 1 conversation attempt | ${phase}: ${subject} |\n`,
  );
  const r = await fetch(
    `https://api.elevenlabs.io/v1/convai/conversation/get-signed-url?agent_id=${encodeURIComponent(process.env.ELEVENLABS_AGENT_ID)}`,
    {
      headers: { 'xi-api-key': process.env.ELEVENLABS_API_KEY },
      signal: AbortSignal.timeout(30000),
    },
  );
  if (!r.ok) throw new Error(`Authentication HTTP ${r.status}`);
  const { signed_url } = await r.json();
  const row = { subject, question, firstWordsMs: null, speech: [], tools: [], error: null };
  await new Promise((resolve) => {
    const ws = new WebSocket(signed_url);
    let sent = 0,
      quiet;
    const finish = () => {
      clearTimeout(quiet);
      clearTimeout(deadline);
      ws.close();
      resolve();
    };
    const deadline = setTimeout(() => {
      row.error = 'Conversation timed out';
      finish();
    }, 60000);
    const bump = () => {
      clearTimeout(quiet);
      quiet = setTimeout(finish, 6500);
    };
    ws.onopen = () =>
      ws.send(
        JSON.stringify({
          type: 'conversation_initiation_client_data',
          conversation_config_override: { conversation: { text_only: true } },
        }),
      );
    ws.onerror = () => {
      row.error = 'WebSocket connection failed';
      finish();
    };
    ws.onmessage = ({ data }) => {
      const m = JSON.parse(data);
      if (m.type === 'ping')
        ws.send(JSON.stringify({ type: 'pong', event_id: m.ping_event.event_id }));
      if (m.type === 'conversation_initiation_metadata') {
        ws.send(
          JSON.stringify({
            type: 'contextual_update',
            text: 'No screen map is ready. Answer the conceptual question directly. This is a text-only tool-selection evaluation; client tools are simulated.',
          }),
        );
        sent = Date.now();
        ws.send(JSON.stringify({ type: 'user_message', text: question }));
      }
      if (m.type === 'agent_response' && sent) {
        row.firstWordsMs ??= Date.now() - sent;
        row.speech.push(m.agent_response_event.agent_response);
        bump();
      }
      if (m.type === 'client_tool_call') {
        const c = m.client_tool_call;
        row.tools.push({ name: c.tool_name, parameters: c.parameters, atMs: Date.now() - sent });
        ws.send(
          JSON.stringify({
            type: 'client_tool_result',
            tool_call_id: c.tool_call_id,
            result: JSON.stringify({ shown: true, evaluation: 'simulated renderer' }),
            is_error: false,
          }),
        );
        bump();
      }
    };
  });
  row.forbiddenLeadIn =
    /\b(this slide|let me (draw|show|sketch)|let['’]s look|i['’]ll (draw|show|sketch)|i (can['’]t|cannot) see)\b/i.test(
      row.speech.join(' '),
    );
  results.push(row);
  writeFileSync(`docs/overnight/live/${phase}.json`, JSON.stringify(results, null, 2));
  console.log(
    JSON.stringify({
      phase,
      subject,
      firstWordsMs: row.firstWordsMs,
      forbiddenLeadIn: row.forbiddenLeadIn,
      tools: row.tools.map((t) => t.name),
      error: row.error,
    }),
  );
}
