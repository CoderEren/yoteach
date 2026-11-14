import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
const execute = promisify(execFile);
// Window titles alone cannot distinguish a private browser tab. Limit external
// capture to document apps whose owning process macOS can positively identify.
export const studyApps = new Set([
  'Preview',
  'Keynote',
  'Pages',
  'Numbers',
  'Microsoft PowerPoint',
  'Microsoft Word',
  'Microsoft Excel',
  'Adobe Acrobat',
  'Adobe Acrobat Reader',
  'Skim',
  'LibreOffice',
  'Obsidian',
]);
export function eligibleWindowIds(windows: { id: number; owner: string }[]) {
  return new Set(windows.filter((w) => studyApps.has(w.owner)).map((w) => `window:${w.id}:0`));
}
export async function macStudyWindows() {
  if (process.platform !== 'darwin') return new Set<string>();
  try {
    const { stdout } = await execute(
      join(dirname(fileURLToPath(import.meta.url)), 'window-owners'),
      [],
      { timeout: 4000, maxBuffer: 1024 * 1024 },
    );
    return eligibleWindowIds(JSON.parse(stdout));
  } catch {
    throw new Error(
      'Could not identify the study window safely. Share a PDF inside yoteach instead.',
    );
  }
}
