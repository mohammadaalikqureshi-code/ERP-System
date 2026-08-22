import { Component, ErrorInfo, ReactNode } from 'react';
import { AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error:', error, errorInfo);
  }

  private handleRetry = () => {
    this.setState({ hasError: false, error: undefined });
  };

  public render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="flex flex-col items-center justify-center min-h-[400px] p-6 text-center">
          <div className="bg-red-50 text-red-500 rounded-full p-4 mb-4 dark:bg-red-950">
            <AlertCircle className="w-10 h-10" />
          </div>
          <h2 className="text-xl font-bold mb-2">Something went wrong</h2>
          <p className="text-stone-600 dark:text-stone-400 mb-6 max-w-md">
            An unexpected error occurred. Our team has been notified. 
            Please try again or refresh the page.
          </p>
          <div className="flex gap-4">
            <Button onClick={this.handleRetry} variant="outline">
              Try Again
            </Button>
            <Button onClick={() => window.location.reload()} className="bg-teal-600 hover:bg-teal-700 text-white">
              Refresh Page
            </Button>
          </div>
          {import.meta.env.DEV && this.state.error && (
            <pre className="mt-8 p-4 bg-stone-100 dark:bg-stone-900 rounded text-left text-sm overflow-auto max-w-2xl w-full">
              {this.state.error.stack}
            </pre>
          )}
        </div>
      );
    }

    return this.props.children;
  }
}
