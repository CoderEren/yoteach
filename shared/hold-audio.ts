/** Bounded mono PCM16; no provider transport occurs until the caller releases the hold. */
export function pcmChunks(frames: Float32Array[], fromRate: number, toRate: number): Uint8Array[] {
  const count = frames.reduce((sum, frame) => sum + frame.length, 0);
  if (count < fromRate * 0.12) return [];
  if (count > fromRate * 61) throw new Error('Hold recordings are limited to one minute.');
  const source = new Float32Array(count);
  let offset = 0;
  for (const frame of frames) {
    source.set(frame, offset);
    offset += frame.length;
  }
  const size = Math.ceil((count * toRate) / fromRate);
  const pcm = new Int16Array(size + toRate); // one second of silence closes the hosted turn
  for (let i = 0; i < size; i++) {
    const position = (i * fromRate) / toRate,
      left = Math.floor(position),
      fraction = position - left;
    const sample = Math.max(
      -1,
      Math.min(
        1,
        source[left] * (1 - fraction) + (source[Math.min(left + 1, count - 1)] ?? 0) * fraction,
      ),
    );
    pcm[i] = Math.round(sample * (sample < 0 ? 32768 : 32767));
  }
  const bytes = new Uint8Array(pcm.buffer),
    chunkSize = Math.round(toRate * 0.025) * 2;
  const chunks: Uint8Array[] = [];
  for (let i = 0; i < bytes.length; i += chunkSize) chunks.push(bytes.slice(i, i + chunkSize));
  return chunks;
}
/**
 * True when a hold contains speech: at least ~250 ms of 30 ms windows clearly above the
 * recording's own noise floor. A silent hold is never sent, so the agent does not wait on it.
 */
export function hasSpeech(frames: Float32Array[], rate: number) {
  const window = Math.max(1, Math.round(rate * 0.03));
  const levels: number[] = [];
  let sum = 0,
    n = 0;
  for (const frame of frames)
    for (let i = 0; i < frame.length; i++) {
      sum += frame[i] * frame[i];
      if (++n === window) {
        levels.push(Math.sqrt(sum / n));
        sum = 0;
        n = 0;
      }
    }
  if (!levels.length) return false;
  const sorted = [...levels].sort((a, b) => a - b);
  const floor = sorted[Math.floor(sorted.length * 0.2)];
  // Clearly above the room's own level, but a steady voice from the first moment still counts.
  const threshold = Math.max(0.015, Math.min(floor * 3, 0.04));
  return levels.filter((l) => l > threshold).length * 0.03 >= 0.25;
}
