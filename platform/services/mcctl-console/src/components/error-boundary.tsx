'use client';

import { Component, type ReactNode, type ErrorInfo } from 'react';
import { ApiError } from '@/lib/api-client';

interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

/**
 * Error Boundary component for catching and displaying errors
 *
 * Provides graceful error handling for API failures and runtime errors.
 * Can be customized with a fallback UI or error callback.
 *
 * @example
 * <ErrorBoundary fallback={<ErrorPage />}>
 *   <ServerList />
 * </ErrorBoundary>
 */
export class ErrorBoundary extends Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    console.error('Error Boundary caught an error:', error, errorInfo);
    this.props.onError?.(error, errorInfo);
  }

  render(): ReactNode {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <DefaultErrorFallback
          error={this.state.error}
          reset={() => this.setState({ hasError: false, error: null })}
        />
      );
    }

    return this.props.children;
  }
}

interface DefaultErrorFallbackProps {
  error: Error | null;
  reset: () => void;
}

/**
 * Default error fallback UI
 */
function DefaultErrorFallback({ error, reset }: DefaultErrorFallbackProps) {
  const isApiError = error instanceof ApiError;
  const title = isApiError ? 'API Error' : 'Something went wrong';
  const message = isApiError
    ? error.getUserMessage()
    : error?.message || 'An unexpected error occurred';

  return (
    <div className="flex min-h-[400px] flex-col items-center justify-center p-8">
      <div className="max-w-md text-center">
        <div className="mb-4 text-6xl">
          {isApiError && error.isServerError() ? '503' : '500'}
        </div>
        <h2 className="mb-2 text-xl font-semibold text-foreground">{title}</h2>
        <p className="mb-6 text-muted-foreground">{message}</p>
        <button
          onClick={reset}
          className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        >
          Try again
        </button>
      </div>
    </div>
  );
}

/**
 * API Error Fallback component for React Query error states
 *
 * @example
 * const { data, error, refetch } = useServers();
 * if (error) {
 *   return <ApiErrorFallback error={error} retry={refetch} />;
 * }
 */
interface ApiErrorFallbackProps {
  error: Error;
  retry?: () => void;
}

export function ApiErrorFallback({ error, retry }: ApiErrorFallbackProps) {
  const isApiError = error instanceof ApiError;
  const message = isApiError
    ? error.getUserMessage()
    : 'Failed to load data. Please try again.';

  return (
    <div className="flex flex-col items-center justify-center p-8 text-center">
      <p className="mb-4 text-muted-foreground">{message}</p>
      {retry && (
        <button
          onClick={retry}
          className="inline-flex items-center justify-center rounded-md bg-secondary px-4 py-2 text-sm font-medium text-secondary-foreground transition-colors hover:bg-secondary/80"
        >
          Retry
        </button>
      )}
    </div>
  );
}
