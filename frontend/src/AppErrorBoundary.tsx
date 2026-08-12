import { Component, type ErrorInfo, type ReactNode } from 'react';

interface AppErrorBoundaryProps {
  children: ReactNode;
}

interface AppErrorBoundaryState {
  failed: boolean;
  diagnosticCode: string | null;
}

export default class AppErrorBoundary extends Component<AppErrorBoundaryProps, AppErrorBoundaryState> {
  declare readonly props: Readonly<AppErrorBoundaryProps>;

  state: AppErrorBoundaryState = { failed: false, diagnosticCode: null };

  static getDerivedStateFromError(error: Error): AppErrorBoundaryState {
    const diagnosticCode = error.name === 'TypeError' ? 'UI-TYPE' : 'UI-RENDER';
    return { failed: true, diagnosticCode };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('HINGA interface error', error, info);
  }

  render() {
    if (this.state.failed) {
      return (
        <main className="recovery-screen">
          <div className="recovery-card">
            <h1>HINGA needs to reload</h1>
            <p>Your conversation could not be displayed. Reload the page to continue.</p>
            <small>Diagnostic code: {this.state.diagnosticCode}</small>
            <button type="button" onClick={() => window.location.reload()}>Reload HINGA</button>
          </div>
        </main>
      );
    }

    return this.props.children;
  }
}
