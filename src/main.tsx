import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { TutorProvider } from './tutor';
if (location.hash === '#/companion') document.body.classList.add('companion-body');
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
createRoot(document.getElementById('root')!).render(
  <ErrorBoundary>
    <TutorProvider>
      <App />
    </TutorProvider>
  </ErrorBoundary>,
);
