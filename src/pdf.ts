import { getDocument, GlobalWorkerOptions, type PDFDocumentProxy } from 'pdfjs-dist';
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import type { Heading, PageText } from '../shared/model';
GlobalWorkerOptions.workerSrc = workerUrl;
export function loadPdf(bytes: Uint8Array) {
  return getDocument({
    data: new Uint8Array(bytes),
    useSystemFonts: true,
    cMapUrl: new URL('/pdfjs/cmaps/', location.href).href,
    cMapPacked: true,
    standardFontDataUrl: new URL('/pdfjs/standard_fonts/', location.href).href,
    wasmUrl: new URL('/pdfjs/wasm/', location.href).href,
  });
}
export async function extractPdf(
  pdf: PDFDocumentProxy,
  onProgress: (page: number, total: number) => void,
) {
  if (pdf.numPages > 500)
    throw new Error(
      'This PDF has more than 500 pages. Split it into smaller lecture files and try again.',
    );
  const pages: PageText[] = [],
    candidates: Heading[] = [];
  const seen = new Set<string>();
  for (let p = 1; p <= pdf.numPages; p++) {
    const page = await pdf.getPage(p),
      content = await page.getTextContent();
    const items = content.items.filter((i): i is Extract<typeof i, { str: string }> => 'str' in i);
    let lines: { text: string; size: number; y: number }[] = [];
    for (const item of items) {
      const size = Math.hypot(item.transform[2], item.transform[3]),
        y = item.transform[5];
      const last = lines.at(-1);
      if (last && Math.abs(last.y - y) < Math.max(2, size * 0.35)) {
        last.text += ' ' + item.str;
        last.size = Math.max(last.size, size);
      } else lines.push({ text: item.str, size, y });
    }
    lines = lines
      .map((l) => ({ ...l, text: l.text.replace(/\s+/g, ' ').trim() }))
      .filter((l) => l.text);
    pages.push({
      page: p,
      text: lines
        .map((l) => l.text)
        .join('\n')
        .slice(0, 50000),
    });
    const sizes = items
      .map((i) => Math.hypot(i.transform[2], i.transform[3]))
      .sort((a, b) => a - b);
    const median = sizes[Math.floor(sizes.length / 2)] ?? 12;
    for (const [index, line] of lines.entries()) {
      if (
        line.text.length < 4 ||
        line.text.length > 110 ||
        /^[\d\s\W]+$/.test(line.text) ||
        seen.has(line.text.toLowerCase())
      )
        continue;
      if (
        line.size >= median * 1.22 ||
        (index === 0 && line.size >= median && line.text.length < 85 && !/[.!?]$/.test(line.text))
      ) {
        if (candidates.length < 100) {
          candidates.push({ title: line.text, page: p, level: 1 });
          seen.add(line.text.toLowerCase());
        }
        break;
      }
    }
    page.cleanup();
    onProgress(p, pdf.numPages);
  }
  const outline = await pdf.getOutline();
  const headings: Heading[] = [];
  async function walk(nodes: NonNullable<typeof outline>, level: number) {
    for (const node of nodes) {
      if (headings.length >= 100) break;
      let page: number | null = null;
      try {
        const dest =
          typeof node.dest === 'string' ? await pdf.getDestination(node.dest) : node.dest;
        if (dest?.[0] != null)
          page = typeof dest[0] === 'number' ? dest[0] + 1 : (await pdf.getPageIndex(dest[0])) + 1;
      } catch {
        /* Malformed bookmarks fall back to detected headings. */
      }
      const title = node.title.replace(/\s+/g, ' ').trim().slice(0, 120);
      if (page && page <= pdf.numPages && title)
        headings.push({ title, page, level: Math.min(level, 3) });
      if (node.items?.length) await walk(node.items, level + 1);
    }
  }
  if (outline) await walk(outline, 1);
  return {
    pages,
    headings: headings.length ? headings : candidates,
    organization: (headings.length ? 'outline' : candidates.length ? 'headings' : 'fallback') as
      'outline' | 'headings' | 'fallback',
  };
}
