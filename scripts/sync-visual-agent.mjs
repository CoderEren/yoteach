// Explicit maintenance action: update the existing configured agent, never create another agent.
// Run only when the user has authorized hosted agent configuration changes.
import { config } from 'dotenv';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
config({ quiet: true });
const id = process.env.ELEVENLABS_AGENT_ID;
const key = process.env.ELEVENLABS_API_KEY;
if (!id || !key) throw new Error('Configure the existing agent ID and management key locally.');
const root = 'https://api.elevenlabs.io/v1/convai';
async function request(path, method = 'GET', body) {
  const response = await fetch(root + path, {
    method,
    headers: { 'xi-api-key': key, 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(30000),
  });
  if (!response.ok)
    throw new Error(`${method} agent configuration request failed (${response.status}).`);
  return response.json();
}
const before = await request('/agents/' + encodeURIComponent(id));
const stamp = Date.now(),
  directory = `work/agent-visual-${stamp}`;
mkdirSync(directory, { recursive: true, mode: 0o700 });
writeFileSync(directory + '/before.json', JSON.stringify(before, null, 2), { mode: 0o600 });
const ids = [...before.conversation_config.agent.prompt.tool_ids];
const attached = await Promise.all(
  ids.map((toolId) => request('/tools/' + encodeURIComponent(toolId))),
);
writeFileSync(directory + '/tools-before.json', JSON.stringify(attached, null, 2), { mode: 0o600 });
for (const name of ['open_visual_lesson', 'navigate_visual_lesson', 'generate_illustration']) {
  const tool_config = JSON.parse(readFileSync(`docs/agent-tools/${name}.json`, 'utf8'));
  const existing = attached.find((tool) => tool.tool_config.name === name);
  if (existing) await request('/tools/' + existing.id, 'PATCH', { tool_config });
  else {
    const created = await request('/tools', 'POST', { tool_config });
    ids.push(created.id);
    // Save creation IDs before the agent patch, for recovery if the next request fails.
    writeFileSync(directory + '/' + name + '.json', JSON.stringify(created), { mode: 0o600 });
  }
}
const prompt = readFileSync('docs/YOYO-AGENT-PROMPT.md', 'utf8').split('\n---\n')[1].trim();
await request('/agents/' + encodeURIComponent(id), 'PATCH', {
  conversation_config: { agent: { prompt: { prompt, tool_ids: ids } } },
});
const after = await request('/agents/' + encodeURIComponent(id));
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const verified = {
  promptMatches: after.conversation_config.agent.prompt.prompt === prompt,
  toolsMatch: same(after.conversation_config.agent.prompt.tool_ids, ids),
  voiceUnchanged: same(before.conversation_config.tts, after.conversation_config.tts),
  modelUnchanged:
    before.conversation_config.agent.prompt.llm === after.conversation_config.agent.prompt.llm,
  authUnchanged: same(before.platform_settings.auth, after.platform_settings.auth),
  overridesUnchanged: same(before.platform_settings.overrides, after.platform_settings.overrides),
  originalToolsPreserved: before.conversation_config.agent.prompt.tool_ids.every((toolId) =>
    ids.includes(toolId),
  ),
};
writeFileSync(directory + '/verification.json', JSON.stringify(verified, null, 2));
console.log(JSON.stringify({ ...verified, backup: directory }));
if (Object.values(verified).some((value) => !value))
  throw new Error('Agent verification failed; inspect the local backup.');
