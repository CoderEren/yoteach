import { spawnSync } from 'node:child_process';
import { mkdirSync, statSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
if (process.platform === 'darwin') {
  const input = resolve('native/window-owners.swift'),
    output = resolve('dist-electron/window-owners');
  if (!existsSync(output) || statSync(output).mtimeMs < statSync(input).mtimeMs) {
    mkdirSync('dist-electron', { recursive: true });
    const result = spawnSync(
      '/usr/bin/xcrun',
      [
        'swiftc',
        '-O',
        '-module-cache-path',
        resolve('node_modules/.cache/swift'),
        input,
        '-o',
        output,
      ],
      { encoding: 'utf8' },
    );
    if (result.status !== 0)
      console.warn(
        'External window sharing is unavailable: install Xcode Command Line Tools and rebuild. Internal PDF sharing works without the helper.',
      );
  }
}
