import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
// @ts-expect-error Maintenance script is intentionally plain JavaScript.
import { visualToolNames } from '../scripts/agent-tool-config.mjs';

test('every silent drawing tool is synchronised and retired tools remain detached', () => {
  const definitions = readdirSync('docs/agent-tools').map((file) =>
    JSON.parse(readFileSync(`docs/agent-tools/${file}`, 'utf8')),
  );
  for (const tool of definitions.filter((t) => t.pre_tool_speech === 'off')) {
    assert.ok(
      visualToolNames.includes(tool.name),
      `${tool.name} would retain stale hosted settings`,
    );
  }
  for (const name of visualToolNames) assert.ok(definitions.some((t) => t.name === name));
  for (const name of [
    'open_visual_lesson',
    'navigate_visual_lesson',
    'ask_practice_question',
    'record_practice_attempt',
  ])
    assert.ok(!visualToolNames.includes(name));
});
