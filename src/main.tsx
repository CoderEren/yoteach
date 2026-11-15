import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { TutorProvider } from './tutor';
import { Caption } from './components/Caption';
const subtitles = location.hash === '#/caption';
if (location.hash === '#/companion' || subtitles) document.body.classList.add('companion-body');
import './styles.css';
class ErrorBoundary extends React.Component<{ children: React.ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? (
      <div className="launch-message">
        <h1>Something interrupted your workspace.</h1>
        <p>Your saved data is still on this Mac.</p>
        <button onClick={() => location.reload()}>Reload yoteach</button>
      </div>
    ) : (
      this.props.children
    );
  }
}
// The subtitle window only displays words; it never talks to the tutor or the workspace.
createRoot(document.getElementById('root')!).render(
  subtitles ? (
    <Caption />
  ) : (
    <ErrorBoundary>
      <TutorProvider>
        <App />
      </TutorProvider>
    </ErrorBoundary>
  ),
);
