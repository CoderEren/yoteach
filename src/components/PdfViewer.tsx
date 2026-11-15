import { useEffect, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, ZoomIn, ZoomOut, AlignLeft, LoaderCircle } from 'lucide-react';
import { Util, type PDFDocumentProxy, type RenderTask } from 'pdfjs-dist';
import { useTutor } from '../tutor';
import { textRunBox } from '../../shared/pdf-geometry';
import type { SharedSnapshot } from '../../shared/tutor';
import type { SourceDocument } from '../../shared/model';
import { api, unwrap } from '../api';
import { loadPdf } from '../pdf';
import { Modal } from './Modal';
export function PdfViewer({
  document,
  initialPage,
  onClose,
}: {
  document: SourceDocument;
  initialPage: number;
  onClose: () => void;
}) {
  const { runtime: tutor } = useTutor();
  const [sharing, setSharing] = useState(false);
  const [pdf, setPdf] = useState<PDFDocumentProxy | null>(null),
    [page, setPage] = useState(initialPage),
    [zoom, setZoom] = useState(1),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(true),
    [text, setText] = useState(false);
  const canvas = useRef<HTMLCanvasElement>(null),
    holder = useRef<HTMLDivElement>(null);
  useEffect(() => {
    let alive = true;
    let task: ReturnType<typeof loadPdf> | undefined;
    unwrap(api.readPdf(document.id))
      .then((bytes) => {
        if (!alive) return;
        task = loadPdf(bytes);
        return task.promise;
      })
      .then((doc) => {
        if (doc && alive) setPdf(doc);
      })
      .catch((e) => {
        if (alive) {
          setError(e.message);
          setBusy(false);
        }
      });
    return () => {
      alive = false;
      void task?.destroy();
    };
  }, [document.id]);
  useEffect(() => {
    if (!pdf || !canvas.current || text) return;
    let disposed = false,
      render: RenderTask | undefined;
    setBusy(true);
    setError('');
    (async () => {
      try {
        const sheet = await pdf.getPage(page);
        if (disposed) return;
        const natural = sheet.getViewport({ scale: 1 });
        const available = Math.max(400, (holder.current?.clientWidth ?? 750) - 64);
        const scale = Math.min(available / natural.width, 1.5) * zoom;
        const viewport = sheet.getViewport({ scale });
        const node = canvas.current!;
        const ratio = Math.min(window.devicePixelRatio, 2);
        node.width = Math.floor(viewport.width * ratio);
        node.height = Math.floor(viewport.height * ratio);
        node.style.width = `${viewport.width}px`;
        node.style.height = `${viewport.height}px`;
        render = sheet.render({ canvas: node, viewport, transform: [ratio, 0, 0, ratio, 0, 0] });
        await render.promise;
        if (!disposed) setBusy(false);
      } catch (e) {
        if (!disposed) {
          setError(e instanceof Error ? e.message : 'This page could not be rendered.');
          setBusy(false);
        }
      }
    })();
    return () => {
      disposed = true;
      render?.cancel();
    };
  }, [pdf, page, zoom, text]);
  async function sharePage() {
    if (!pdf || !tutor?.sessionId) return;
    const epoch = tutor.epoch;
    setSharing(true);
    setError('');
    try {
      const sheet = await pdf.getPage(page),
        natural = sheet.getViewport({ scale: 1 }),
        scale = Math.min(1.8, 1600 / Math.max(natural.width, natural.height)),
        viewport = sheet.getViewport({ scale });
      const image = window.document.createElement('canvas');
      image.width = Math.ceil(viewport.width);
      image.height = Math.ceil(viewport.height);
      await sheet.render({ canvas: image, viewport }).promise;
      const content = await sheet.getTextContent();
      const textBoxes: SharedSnapshot['textBoxes'] = content.items
        .flatMap((item) => {
          if (!('str' in item) || !item.str.trim()) return [];
          const transform = Util.transform(viewport.transform, item.transform);
          const box = textRunBox(transform, item.width * scale, image.width, image.height);
          return box ? [{ text: item.str.slice(0, 2000), box }] : [];
        })
        .slice(0, 2000);
      await unwrap(
        api.tutor.sharePdf({
          id: crypto.randomUUID(),
          epoch,
          source: { kind: 'pdf', documentId: document.id, page, name: document.originalName },
          image: image.toDataURL('image/jpeg', 0.88),
          width: image.width,
          height: image.height,
          capturedAt: new Date().toISOString(),
          textBoxes,
        }),
      );
      await unwrap(api.tutor.intent({ type: 'open' }));
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'This page could not be shared. Try again.');
    } finally {
      setSharing(false);
    }
  }
  return (
    <Modal title={document.originalName} onClose={onClose} wide>
      <div className="pdf-share-bar">
        <p>
          {tutor?.sessionId
            ? 'Share a still image of this page. Yoyo can send it to Anthropic when you ask about it.'
            : 'Start a study session to share a page with Yoyo.'}
        </p>
        <button
          className="button small"
          disabled={!tutor?.sessionId || !tutor.config.vision || !pdf || busy || sharing}
          onClick={() => void sharePage()}
        >
          {sharing ? 'Sharing page…' : 'Share this page'}
        </button>
      </div>
      <div className="pdf-toolbar">
        <div className="toolbar-group">
          <button
            className="icon-button"
            disabled={page <= 1}
            onClick={() => setPage((p) => p - 1)}
            aria-label="Previous page"
          >
            <ChevronLeft size={18} />
          </button>
          <label className="page-label">
            Page{' '}
            <input
              aria-label="Page number"
              type="number"
              min={1}
              max={document.pageCount}
              value={page}
              onChange={(e) => {
                const v = Number(e.target.value);
                if (v >= 1 && v <= document.pageCount) setPage(v);
              }}
            />{' '}
            of {document.pageCount}
          </label>
          <button
            className="icon-button"
            disabled={page >= document.pageCount}
            onClick={() => setPage((p) => p + 1)}
            aria-label="Next page"
          >
            <ChevronRight size={18} />
          </button>
        </div>
        <div className="toolbar-group">
          <button
            className="icon-button"
            disabled={zoom <= 0.6 || text}
            onClick={() => setZoom((z) => Math.max(0.6, z - 0.2))}
            aria-label="Zoom out"
          >
            <ZoomOut size={18} />
          </button>
          <span className="zoom-label">{Math.round(zoom * 100)}%</span>
          <button
            className="icon-button"
            disabled={zoom >= 2 || text}
            onClick={() => setZoom((z) => Math.min(2, z + 0.2))}
            aria-label="Zoom in"
          >
            <ZoomIn size={18} />
          </button>
          <button
            className={`button small ${text ? 'selected' : ''}`}
            onClick={() => {
              setText(!text);
              setBusy(false);
            }}
            aria-pressed={text}
          >
            <AlignLeft size={16} />
            Extracted text
          </button>
        </div>
      </div>
      <div
        ref={holder}
        className="pdf-body"
        tabIndex={0}
        aria-label="PDF page. Use left and right arrow keys to navigate."
        onKeyDown={(e) => {
          if (e.key === 'ArrowRight') setPage((p) => Math.min(document.pageCount, p + 1));
          if (e.key === 'ArrowLeft') setPage((p) => Math.max(1, p - 1));
        }}
      >
        {error ? (
          <p className="error-message" role="alert">
            {error}
          </p>
        ) : text ? (
          <pre className="pdf-text">
            {document.pages[page - 1]?.text ||
              'No readable text was found on this page. Scanned pages can still be viewed, but automatic text extraction is unavailable.'}
          </pre>
        ) : (
          <>
            <canvas
              ref={canvas}
              aria-label={`Page ${page} of ${document.originalName}. Use Extracted text for a readable text alternative.`}
            />
            {busy && (
              <div className="pdf-loading" role="status">
                <LoaderCircle className="spin" />
                Loading page…
              </div>
            )}
          </>
        )}
      </div>
    </Modal>
  );
}
