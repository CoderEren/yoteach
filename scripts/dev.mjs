import { createServer } from 'vite';
import { spawn } from 'node:child_process';
import electron from 'electron';
await import('./build-electron.mjs');
const server = await createServer();
await server.listen();
console.log(
  'yoteach renderer: http://127.0.0.1:5173. Restart npm run dev after changing electron/ or shared/.',
);
const env = { ...process.env, YOTEACH_DEV_URL: 'http://127.0.0.1:5173' };
delete env.ELECTRON_RUN_AS_NODE;
const child = spawn(electron, ['.'], { stdio: 'inherit', env });
let closing = false;
async function close(code = 0) {
  if (closing) return;
  closing = true;
  child.kill();
  await server.close();
  process.exit(code);
}
child.on('exit', (code) => close(code ?? 0));
process.on('SIGINT', () => close());
process.on('SIGTERM', () => close());
