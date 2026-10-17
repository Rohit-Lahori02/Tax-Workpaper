/**
 * Route-level skeleton. Mirrors the shape most pages take (header, stat
 * tiles, a wide card and a narrow one) so the layout does not jump when the
 * real page streams in. Purely presentational; nothing here reads data.
 */
export default function Loading() {
  return (
    <div aria-busy="true" aria-live="polite" className="animate-pulse">
      <span className="sr-only">Loading</span>
      <header className="mb-6 border-b border-border pb-5">
        <div className="h-3 w-16 rounded bg-surface-2" />
        <div className="mt-3 h-7 w-72 max-w-full rounded-md bg-surface-2" />
        <div className="mt-3 h-3.5 w-[min(100%,560px)] rounded bg-surface-2" />
        <div className="mt-2 h-3.5 w-[min(100%,420px)] rounded bg-surface-2" />
        <div className="mt-4 flex gap-2">
          <div className="h-5 w-24 rounded-full bg-surface-2" />
          <div className="h-5 w-20 rounded-full bg-surface-2" />
          <div className="h-5 w-28 rounded-full bg-surface-2" />
        </div>
      </header>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="card px-5 py-4">
            <div className="h-2.5 w-24 rounded bg-surface-2" />
            <div className="mt-3 h-7 w-28 rounded-md bg-surface-2" />
            <div className="mt-3 h-2.5 w-32 rounded bg-surface-2" />
          </div>
        ))}
      </div>
      <div className="mt-4 grid gap-4 xl:grid-cols-3">
        <div className="card xl:col-span-2">
          <div className="border-b border-border px-5 py-4">
            <div className="h-3.5 w-40 rounded bg-surface-2" />
            <div className="mt-2 h-2.5 w-72 max-w-full rounded bg-surface-2" />
          </div>
          <div className="divide-y divide-border">
            {[0, 1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="flex items-center gap-3 px-5 py-3">
                <div className="h-6 w-6 rounded-md bg-surface-2" />
                <div className="h-3 flex-1 rounded bg-surface-2" style={{ maxWidth: 160 + ((i * 53) % 220) }} />
                <div className="ml-auto h-3 w-16 rounded bg-surface-2" />
              </div>
            ))}
          </div>
        </div>
        <div className="card p-5">
          <div className="h-3.5 w-32 rounded bg-surface-2" />
          <div className="mt-4 grid gap-2.5">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="h-3 rounded bg-surface-2" style={{ width: `${70 + ((i * 17) % 30)}%` }} />
            ))}
          </div>
          <div className="mt-5 h-8 w-36 rounded-full bg-surface-2" />
        </div>
      </div>
    </div>
  );
}
