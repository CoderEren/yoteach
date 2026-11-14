import { useTutor } from '../tutor';
import { AnnotationLayer } from './TutorWorkspace';
export function DesktopOverlay() {
  const { runtime: r } = useTutor();
  return (
    <main className="desktop-overlay" aria-hidden="true">
      <AnnotationLayer
        annotations={
          r?.snapshot?.source.kind === 'screen'
            ? r.annotations.filter((a) => a.id === r.focusRegion)
            : []
        }
      />
    </main>
  );
}
