'use client';

import { useEffect } from 'react';
import { AlertTriangle } from 'lucide-react';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Surface the underlying error in the server/browser console for debugging.
    console.error(error);
  }, [error]);

  return (
    <div className="mx-auto flex max-w-lg flex-col items-center gap-3 rounded-xl border border-border bg-surface px-6 py-16 text-center">
      <AlertTriangle className="h-8 w-8 text-amber-500" aria-hidden />
      <h2 className="text-lg font-semibold text-foreground">Something went wrong</h2>
      <p className="text-sm text-muted">
        We couldn&apos;t load this data. If the database hasn&apos;t been set up yet, apply the
        schema migration and run <code className="rounded bg-surface-muted px-1">npm run seed</code>
        .
      </p>
      <p className="text-xs text-muted">{error.message}</p>
      <button
        type="button"
        onClick={reset}
        className="mt-2 rounded-lg bg-accent px-4 py-2 text-sm font-medium text-accent-foreground transition-opacity hover:opacity-90"
      >
        Try again
      </button>
    </div>
  );
}
