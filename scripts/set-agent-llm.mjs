// Usage (explicit maintenance, user-approved only): node scripts/set-agent-llm.mjs <llm> [temperature]
// Switch the existing hosted agent's LLM, keeping a full backup and verifying nothing else changed.
import { config } from 'dotenv';
import { mkdirSync, writeFileSync } from 'node:fs';
config({ quiet: true });
const id = process.env.ELEVENLABS_AGENT_ID,
  key = process.env.ELEVENLABS_API_KEY;
const llm = process.argv[2] ?? 'claude-sonnet-5-5';
const temperature = process.argv[3] === undefined ? undefined : Number(process.argv[3]);
const root = 'https://api.elevenlabs.io/v1/convai';
async function request(path, method = 'GET', body) {
  const r = await fetch(root + path, {
    method,
    headers: { 'xi-api-key': key, 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(30000),
  });
  const text = await r.text();
  if (!r.ok) throw new Error(`${method} ${path} ${r.status}: ${text.slice(0, 400)}`);
  return JSON.parse(text);
}
const before = await request('/agents/' + encodeURIComponent(id));
const dir = `work/agent-llm-${Date.now()}`; // ignored backups
mkdirSync(dir, { recursive: true, mode: 0o700 });
writeFileSync(dir + '/before.json', JSON.stringify(before, null, 2), { mode: 0o600 });
const prompt = { llm, ...(temperature === undefined ? {} : { temperature }) };
await request('/agents/' + encodeURIComponent(id), 'PATCH', {
  conversation_config: { agent: { prompt } },
});
const after = await request('/agents/' + encodeURIComponent(id));
writeFileSync(dir + '/after.json', JSON.stringify(after, null, 2), { mode: 0o600 });
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const bp = before.conversation_config.agent.prompt,
  ap = after.conversation_config.agent.prompt;
console.log(
  JSON.stringify({
    llmBefore: bp.llm,
    llmAfter: ap.llm,
    temperatureAfter: ap.temperature,
    promptUnchanged: bp.prompt === ap.prompt,
    toolsUnchanged: same(bp.tool_ids, ap.tool_ids),
    voiceUnchanged: same(before.conversation_config.tts, after.conversation_config.tts),
    authUnchanged: same(before.platform_settings.auth, after.platform_settings.auth),
    backup: dir,
  }),
);
