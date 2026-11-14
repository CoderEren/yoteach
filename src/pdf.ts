import { Util } from 'pdfjs-dist';
import { textRunBox } from '../shared/pdf-geometry';
import { getDocument, GlobalWorkerOptions, type PDFDocumentProxy } from 'pdfjs-dist';
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import type { PageText } from '../shared/model';
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
  const pages: PageText[] = [];
  for (let p = 1; p <= pdf.numPages; p++) {
    const page = await pdf.getPage(p),
      content = await page.getTextContent();
    pages.push({
      page: p,
      text: content.items
        .filter((i): i is Extract<typeof i, { str: string }> => 'str' in i)
        .map((i) => i.str + (i.hasEOL ? '\n' : ' '))
        .join('')
        .slice(0, 50000),
    });
    page.cleanup();
    onProgress(p, pdf.numPages);
  }
  return { pages, headings: [], organization: 'fallback' as const };
}

export async function renderSnapshot(
  bytes: Uint8Array,
  document: { id: string; originalName: string },
  page: number,
  epoch: number,
) {
  const task = loadPdf(bytes);
  try {
    const pdf = await task.promise,
      sheet = await pdf.getPage(page),
      natural = sheet.getViewport({ scale: 1 });
    const scale = Math.min(1.8, 1600 / Math.max(natural.width, natural.height)),
      viewport = sheet.getViewport({ scale });
    const image = window.document.createElement('canvas');
    image.width = Math.ceil(viewport.width);
    image.height = Math.ceil(viewport.height);
    await sheet.render({ canvas: image, viewport }).promise;
    const content = await sheet.getTextContent();
    const textBoxes = content.items
      .flatMap((item) => {
        if (!('str' in item) || !item.str.trim()) return [];
        const box = textRunBox(
          Util.transform(viewport.transform, item.transform),
          item.width * scale,
          image.width,
          image.height,
        );
        return box ? [{ text: item.str.slice(0, 2000), box }] : [];
      })
      .slice(0, 2000);
    return {
      id: crypto.randomUUID(),
      epoch,
      source: { kind: 'pdf' as const, documentId: document.id, page, name: document.originalName },
      image: image.toDataURL('image/jpeg', 0.88),
      width: image.width,
      height: image.height,
      capturedAt: new Date().toISOString(),
      textBoxes,
    };
  } finally {
    await task.destroy();
  }
}
