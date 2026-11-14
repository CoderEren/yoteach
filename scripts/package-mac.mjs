import { cpSync, mkdirSync, writeFileSync, renameSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
if (process.platform !== 'darwin') throw new Error('Build this local application on macOS.');
const destination = resolve('release/Yoteach.app');
if (existsSync(destination))
  throw new Error('Move the previous release/Yoteach.app aside before packaging again.');
mkdirSync('release', { recursive: true });
cpSync('node_modules/electron/dist/Electron.app', destination, {
  recursive: true,
  verbatimSymlinks: true,
});
const content = destination + '/Contents',
  root = content + '/Resources/app';
mkdirSync(root, { recursive: true });
for (const dir of ['dist', 'dist-electron']) cpSync(dir, root + '/' + dir, { recursive: true });
writeFileSync(
  root + '/package.json',
  JSON.stringify({
    name: 'yoteach',
    version: '0.2.0',
    type: 'module',
    main: 'dist-electron/main.js',
  }),
);
renameSync(content + '/MacOS/Electron', content + '/MacOS/Yoteach');
const plist = content + '/Info.plist';
for (const [key, value] of Object.entries({
  CFBundleName: 'Yoteach',
  CFBundleDisplayName: 'Yoteach',
  CFBundleExecutable: 'Yoteach',
  CFBundleIdentifier: 'com.codereren.yoteach',
  NSMicrophoneUsageDescription:
    'Yoteach uses your microphone only during a voice tutoring session.',
})) {
  try {
    execFileSync('/usr/libexec/PlistBuddy', ['-c', `Set :${key} ${value}`, plist], {
      stdio: 'pipe',
    });
  } catch {
    execFileSync('/usr/libexec/PlistBuddy', ['-c', `Add :${key} string ${value}`, plist]);
  }
}
execFileSync('/usr/bin/codesign', ['--force', '--deep', '--sign', '-', destination], {
  stdio: 'inherit',
});
console.log(
  'Built release/Yoteach.app for this Mac. No credentials are included. Local ad-hoc signature; not notarized.',
);
