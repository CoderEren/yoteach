import { spawnSync } from 'node:child_process';
import { mkdirSync, statSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
if (process.platform === 'darwin') {
  for (const name of ['window-owners', 'hold-key', 'capture-screen']) {
    const input = resolve(`native/${name}.swift`),
      output = resolve(`dist-electron/${name}`);
    if (!existsSync(output) || statSync(output).mtimeMs < statSync(input).mtimeMs) {
      mkdirSync('dist-electron', { recursive: true });
      const result = spawnSync(
        '/usr/bin/xcrun',
        [
          'swiftc',
          '-O',
          ...(name === 'capture-screen' ? ['-parse-as-library'] : []),
          '-module-cache-path',
          resolve('node_modules/.cache/swift'),
          input,
          '-o',
          output,
        ],
        { encoding: 'utf8' },
      );
      if (result.status !== 0) throw new Error(`Could not build ${name}: ${result.stderr}`);
    }
  }
}
