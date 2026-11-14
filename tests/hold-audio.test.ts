import { test } from 'node:test';
import assert from 'node:assert/strict';
import { pcmChunks } from '../shared/hold-audio';
import { fitImage, pointBeside } from '../shared/desktop-geometry';
import { SettingsSchema, freshState } from '../shared/model';
test('released audio resamples PCM, bounds duration and appends silence for hosted turn completion', () => {
  assert.deepEqual(pcmChunks([new Float32Array(100)], 16000, 16000), []);
  const result = pcmChunks([new Float32Array(48000).fill(0.5)], 48000, 16000);
  const bytes = Buffer.concat(result);
  assert.equal(bytes.byteLength, 64000);
  assert.equal(bytes.readInt16LE(0), 16384);
  assert.equal(bytes.readInt16LE(32000), 0);
  assert.ok(result.every((chunk) => chunk.length <= 800));
  assert.throws(() => pcmChunks([new Float32Array(16000 * 62)], 16000, 16000), /one minute/);
});
test('desktop and letterboxed lecture coordinates place Yoyo beside actual regions on either side', () => {
  const bounds = { x: -1920, y: 0, width: 1920, height: 1080 };
  const left = pointBeside({ x: 0.6, y: 0.5, width: 0.1, height: 0.1 }, bounds);
  assert.equal(left.direction, 'right');
  assert.ok(left.x >= -1920 && left.x <= -200);
  const right = pointBeside({ x: 0.01, y: 0.1, width: 0.1, height: 0.1 }, bounds);
  assert.equal(right.direction, 'left');
  assert.deepEqual(
    fitImage({ width: 1000, height: 500 }, { x: 0, y: 0, width: 1000, height: 800 }),
    { x: 0, y: 150, width: 1000, height: 500 },
  );
});
test('existing settings gain a talk key without losing the mascot home', () => {
  const { talkKey: _, ...old } = freshState().settings;
  const result = SettingsSchema.parse({ ...old, mascotPosition: { x: -500, y: 100 } });
  assert.equal(result.talkKey, 'control');
  assert.deepEqual(result.mascotPosition, { x: -500, y: 100 });
});
