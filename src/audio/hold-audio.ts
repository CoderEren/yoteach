import { createConnection, setSetupStrategy } from '@elevenlabs/client/internal';
// Pinned SDK platform adapter: keep ElevenLabs' playback, interruptions, tools and turn-taking.
// Only microphone transport is replaced so audio leaves this Mac after release.
import { MediaDeviceOutput } from '../../node_modules/@elevenlabs/client/dist/platform/web/output.js';
import type { WebSocketConnection } from '../../node_modules/@elevenlabs/client/dist/utils/WebSocketConnection.js';
import { attachConnectionToOutput } from '../../node_modules/@elevenlabs/client/dist/utils/attachConnectionToOutput.js';
import type { BaseConnection } from '../../node_modules/@elevenlabs/client/dist/utils/BaseConnection.js';
import { pcmChunks, pcmBytesChunks, toPcm16 } from '../../shared/hold-audio';
const b64 = (bytes: Uint8Array) => btoa(String.fromCharCode(...bytes));
const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export class HoldAudio {
  private stream: MediaStream | null = null;
  private context: AudioContext | null = null;
  private worklet: AudioWorkletNode | null = null;
  private frames: Float32Array[] = [];
  private generation = 0;
  private rate = 16000;
  private connection: BaseConnection | null = null;
  private output: MediaDeviceOutput | null = null;
  private holding = false;
  private muted = true;
  private volume = 0;
  // Live streaming while the key is held, so little is left to send on release.
  private streaming: (() => boolean) | null = null;
  private sent = 0;
  private pump?: ReturnType<typeof setInterval>;
  private pumping = false;
  private lastActivity = 0;
  /** Start sending held audio live. Returns false when the connection cannot take it yet. */
  streamLive(valid: () => boolean) {
    const connection = this.connection;
    if (!this.holding || !connection || this.streaming) return false;
    if (connection.inputFormat.format !== 'pcm') return false;
    this.streaming = valid;
    this.pump = setInterval(() => void this.flush(), 100);
    void this.flush();
    return true;
  }
  private async flush() {
    if (this.pumping) return;
    this.pumping = true;
    try {
      const connection = this.connection,
        valid = this.streaming;
      if (!connection || !valid || !valid()) return;
      const pending = this.frames.slice(this.sent);
      this.sent = this.frames.length;
      if (pending.length) {
        const rate = connection.inputFormat.sampleRate;
        const chunks = pcmBytesChunks(toPcm16(pending, this.rate, rate), rate);
        // Live audio arrives in real time already; a backlog (first hold) goes at twice speed.
        const backlog = chunks.length > 8;
        for (const chunk of chunks) {
          if (!valid() || connection !== this.connection) return;
          connection.sendMessage({ user_audio_chunk: b64(chunk) });
          if (backlog) await wait(12);
        }
      }
      // Tell the agent the student is still talking, so a pause mid-question is not a turn end.
      if (Date.now() - this.lastActivity > 700) {
        connection.sendMessage({ type: 'user_activity' });
        this.lastActivity = Date.now();
      }
    } finally {
      this.pumping = false;
    }
  }
  private stopStreaming() {
    clearInterval(this.pump);
    this.pump = undefined;
    this.streaming = null;
  }
  install() {
    setSetupStrategy(async (options) => {
      const connection = await createConnection(options);
      // Vite can prebundle the SDK separately from its platform adapters. Class identity
      // is not a transport check across those module copies. Check audio capabilities.
      if (!(
        'addListener' in connection &&
        typeof connection.addListener === 'function' &&
        'removeListener' in connection &&
        typeof connection.removeListener === 'function'
      )) {
        connection.close();
        throw new Error('Hold-to-talk requires a WebSocket session.');
      }
      let output: MediaDeviceOutput;
      try {
        output = await MediaDeviceOutput.create({
          ...connection.outputFormat,
          workletPaths: options.workletPaths,
          libsampleratePath: options.libsampleratePath,
        });
      } catch (error) {
        connection.close();
        throw error;
      }
      this.connection = connection;
      this.output = output;
      if (this.holding) output.setVolume(0);
      const detach = attachConnectionToOutput(connection as WebSocketConnection, output);
      return {
        connection,
        output,
        playbackEventTarget: output,
        input: {
          close: async () => this.cancel(),
          setDevice: async () => {},
          setMuted: async (muted: boolean) => {
            this.muted = muted;
          },
          isMuted: () => this.muted,
          getAnalyser: () => undefined,
          getVolume: () => this.volume,
          getByteFrequencyData: (buffer: Uint8Array) => buffer.fill(0),
        },
        detach: async () => {
          detach();
          if (this.connection === connection) {
            this.connection = null;
            this.output = null;
          }
        },
      };
    });
  }
  async start() {
    this.cancel();
    const token = this.generation;
    this.holding = true;
    this.output?.setVolume(0);
    this.output?.interrupt();
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: true, noiseSuppression: true, channelCount: 1 },
      video: false,
    });
    if (token !== this.generation || !this.holding) {
      stream.getTracks().forEach((t) => t.stop());
      return false;
    }
    this.stream = stream;
    const context = new AudioContext({ sampleRate: 16000 });
    this.context = context;
    this.rate = context.sampleRate;
    try {
      await context.audioWorklet.addModule('/voice/hold-recorder.js');
      if (token !== this.generation) return false;
      const worklet = new AudioWorkletNode(context, 'hold-recorder');
      this.worklet = worklet;
      worklet.port.onmessage = (e) => {
        if (!(e.data instanceof Float32Array) || token !== this.generation) return;
        this.frames.push(e.data);
        this.volume = Math.sqrt(e.data.reduce((s, n) => s + n * n, 0) / e.data.length);
      };
      const source = context.createMediaStreamSource(stream),
        silent = context.createGain();
      silent.gain.value = 0;
      source.connect(worklet).connect(silent).connect(context.destination);
      await context.resume();
      return token === this.generation && this.holding;
    } catch (error) {
      this.cancel();
      throw error;
    }
  }
  async finish() {
    this.holding = false;
    this.stream?.getTracks().forEach((t) => t.stop());
    this.stream = null;
    const worklet = this.worklet;
    if (worklet)
      await new Promise<void>((resolve) => {
        const timer = setTimeout(resolve, 150);
        worklet.port.addEventListener('message', function done(event) {
          if (event.data === 'finished') {
            clearTimeout(timer);
            worklet!.port.removeEventListener('message', done);
            resolve();
          }
        });
        worklet.port.postMessage('finish');
      });
    await this.context?.close().catch(() => {});
    this.context = null;
    this.worklet = null;
    this.volume = 0;
    clearInterval(this.pump);
    while (this.pumping) await wait(5);
    const frames = this.frames,
      sent = this.sent,
      streamed = !!this.streaming;
    this.frames = [];
    this.sent = 0;
    this.stopStreaming();
    return { frames, sampleRate: this.rate, sent: streamed ? sent : 0, streamed };
  }
  async send(
    recording: { frames: Float32Array[]; sampleRate: number; sent?: number; streamed?: boolean },
    valid: () => boolean,
  ) {
    const connection = this.connection;
    if (!connection) throw new Error('Voice connection is not ready. Hold to try again.');
    if (connection.inputFormat.format !== 'pcm')
      throw new Error('Configure the Yoyo agent input as PCM audio.');
    if (recording.streamed) {
      // Most of the question is already there: send the tail, then a short silence to end it.
      const rate = connection.inputFormat.sampleRate;
      const tail = pcmBytesChunks(
        toPcm16(recording.frames.slice(recording.sent ?? 0), recording.sampleRate, rate),
        rate,
      );
      const silence = pcmBytesChunks(new Int16Array(Math.round(rate * 0.7)), rate);
      this.output?.interrupt(0);
      this.output?.setVolume(1);
      for (const chunk of tail) {
        if (!valid() || connection !== this.connection) return false;
        connection.sendMessage({ user_audio_chunk: b64(chunk) });
        await wait(8);
      }
      for (const chunk of silence) {
        if (!valid() || connection !== this.connection) return false;
        connection.sendMessage({ user_audio_chunk: b64(chunk) });
        await wait(25);
      }
      return true;
    }
    const chunks = pcmChunks(
      recording.frames,
      recording.sampleRate,
      connection.inputFormat.sampleRate,
    );
    if (!chunks.length) {
      this.output?.setVolume(1);
      return false;
    }
    this.output?.interrupt(0);
    this.output?.setVolume(1);
    // The hosted recognizer expects real-time PCM cadence; a burst can be dropped.
    // The trailing silence lets hosted VAD close the released turn.
    for (let i = 0; i < chunks.length; i++) {
      if (!valid() || connection !== this.connection) return false;
      connection.sendMessage({ user_audio_chunk: btoa(String.fromCharCode(...chunks[i])) });
      await new Promise((resolve) => setTimeout(resolve, 25));
    }
    if (valid()) this.output?.setVolume(1);
    return true;
  }
  cancel() {
    this.generation++;
    this.holding = false;
    this.stopStreaming();
    this.sent = 0;
    this.frames = [];
    this.volume = 0;
    this.stream?.getTracks().forEach((t) => t.stop());
    this.stream = null;
    void this.context?.close().catch(() => {});
    this.context = null;
    this.worklet = null;
    this.output?.setVolume(1);
  }
}
