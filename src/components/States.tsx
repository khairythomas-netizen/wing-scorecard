/** Shared loading and empty treatments, so every screen waits the same way. */

export function Spinner({ label = 'Loading' }: { label?: string }) {
  return (
    <div className="flex items-center justify-center gap-2 py-16 text-muted" role="status">
      <span className="h-4 w-4 animate-spin rounded-full border-2 border-line border-t-orange" />
      <span className="text-xs font-semibold">{label}</span>
    </div>
  );
}

export function EmptyState({ title, detail }: { title: string; detail?: string }) {
  return (
    <div className="px-8 py-16 text-center">
      <p className="text-sm font-bold">{title}</p>
      {detail && <p className="mt-1.5 text-xs leading-relaxed text-muted">{detail}</p>}
    </div>
  );
}

export function ErrorState({ error, onRetry }: { error: Error; onRetry?: () => void }) {
  const offline = /failed to fetch|networkerror|load failed/i.test(error.message);
  return (
    <div className="px-8 py-14 text-center">
      <p className="text-sm font-bold">{offline ? 'Cannot reach the server' : 'Something went wrong'}</p>
      <p className="mt-1.5 break-words text-xs text-muted">
        {offline ? 'Check your connection and try again.' : error.message}
      </p>
      {onRetry && (
        <button
          onClick={onRetry}
          className="mt-5 rounded-xl border border-line bg-surface px-5 py-2.5 text-xs font-extrabold"
        >
          Try again
        </button>
      )}
    </div>
  );
}

/** Grey blocks in the shape of a feed post, to avoid a blank first paint. */
export function PostSkeleton() {
  return (
    <div className="border-t border-line pb-4" aria-hidden>
      <div className="flex items-center gap-2.5 px-3 py-2.5">
        <div className="h-9 w-9 animate-pulse rounded-full bg-surface2" />
        <div className="flex-1 space-y-1.5">
          <div className="h-3 w-24 animate-pulse rounded bg-surface2" />
          <div className="h-2 w-32 animate-pulse rounded bg-surface2" />
        </div>
      </div>
      <div className="aspect-square w-full animate-pulse bg-surface2" />
      <div className="space-y-2 px-3 pt-3">
        <div className="h-6 w-20 animate-pulse rounded-xl bg-surface2" />
        <div className="h-3 w-40 animate-pulse rounded bg-surface2" />
      </div>
    </div>
  );
}
