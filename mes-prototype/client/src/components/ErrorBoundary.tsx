import { Component, type ErrorInfo, type ReactNode } from 'react';
import { Link } from 'react-router-dom';

type Props = {
  children: ReactNode;
  /** When this changes, the boundary clears and re-renders children (e.g. route path). */
  resetKey?: string;
  title?: string;
  /** Primary navigation target after a crash. */
  homeTo?: string;
  homeLabel?: string;
};

type State = {
  error: Error | null;
  errorInfo: ErrorInfo | null;
};

function ErrorFallback({
  title,
  message,
  homeTo,
  homeLabel,
  onRetry,
  error,
  componentStack,
}: {
  title: string;
  message?: string;
  homeTo: string;
  homeLabel: string;
  onRetry: () => void;
  error: Error;
  componentStack?: string | null;
}) {
  const showDetails = import.meta.env.DEV;

  return (
    <div className="min-h-[12rem] flex items-center justify-center p-6 md:p-8">
      <div className="w-full max-w-lg rounded-xl border border-red-500/30 bg-slate-900 p-6">
        <p className="text-xs uppercase tracking-widest text-red-400 font-semibold">Unexpected error</p>
        <h2 className="text-lg font-semibold text-slate-100 mt-2">{title}</h2>
        <p className="text-sm text-slate-400 mt-2">
          {message ||
            'Something went wrong while loading this screen. Your session and navigation are still available.'}
        </p>
        <div className="mt-5 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={onRetry}
            className="px-4 py-2 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-900 text-sm font-semibold"
          >
            Try again
          </button>
          <Link
            to={homeTo}
            className="px-4 py-2 rounded-lg border border-slate-600 text-slate-200 hover:bg-slate-800 text-sm font-medium"
          >
            {homeLabel}
          </Link>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="px-4 py-2 rounded-lg text-slate-400 hover:text-slate-200 text-sm"
          >
            Reload app
          </button>
        </div>
        {showDetails && (
          <details className="mt-4 text-xs text-slate-500">
            <summary className="cursor-pointer text-slate-400 hover:text-slate-300">Technical details</summary>
            <pre className="mt-2 overflow-auto max-h-40 p-3 rounded-lg bg-slate-950 border border-slate-800 text-red-300/90 whitespace-pre-wrap">
              {error.message}
              {componentStack ? `\n\n${componentStack}` : ''}
            </pre>
          </details>
        )}
      </div>
    </div>
  );
}

export default class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null, errorInfo: null };

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    this.setState({ errorInfo });
    console.error('[ErrorBoundary]', error, errorInfo);
  }

  componentDidUpdate(prevProps: Props) {
    if (prevProps.resetKey !== this.props.resetKey && this.state.error) {
      this.setState({ error: null, errorInfo: null });
    }
  }

  private handleRetry = () => {
    this.setState({ error: null, errorInfo: null });
  };

  render() {
    const { children, title = 'This page could not be loaded', homeTo = '/', homeLabel = 'Go home' } =
      this.props;
    const { error, errorInfo } = this.state;

    if (error) {
      return (
        <ErrorFallback
          title={title}
          homeTo={homeTo}
          homeLabel={homeLabel}
          onRetry={this.handleRetry}
          error={error}
          componentStack={errorInfo?.componentStack}
        />
      );
    }

    return children;
  }
}
