import { cpSync, mkdirSync } from 'node:fs';
mkdirSync('public/pdfjs', { recursive: true });
for (const name of ['cmaps', 'standard_fonts', 'wasm'])
  cpSync(`node_modules/pdfjs-dist/${name}`, `public/pdfjs/${name}`, { recursive: true });

mkdirSync('public/voice', { recursive: true });
for (const name of ['rawAudioProcessor.js', 'audioConcatProcessor.js'])
  cpSync(`node_modules/@elevenlabs/client/worklets/${name}`, `public/voice/${name}`);
cpSync(
  'node_modules/@alexanderolsen/libsamplerate-js/dist/libsamplerate.worklet.js',
  'public/voice/libsamplerate.js',
);

cpSync('src/audio/hold-recorder.worklet.js', 'public/voice/hold-recorder.js');
