"use client";

import "./globals.css";

/**
 * Last-resort boundary for errors thrown by the root layout itself, where no
 * shell can be rendered. Kept dependency-free so it cannot fail the same way.
 */
export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="en">
      <body className="bg-background text-foreground">
        <main className="mx-auto grid min-h-screen max-w-xl content-center gap-4 px-6 py-16 text-center">
          <h1 className="text-[22px] font-semibold tracking-[-0.02em]">The workpaper could not start</h1>
          <p className="text-[13.5px] leading-[22px] text-muted">
            The application shell failed before any page could load. This is usually the database being unreachable or a bad environment setting, not anything in the file. The packet is read-only and the ledger is append-only, so nothing has been lost.
          </p>
          <p className="break-words font-mono text-[12px]">{error.message || "No message was given."}</p>
          {error.digest ? <p className="text-[12px] text-muted">Reference {error.digest}</p> : null}
          <div>
            <button type="button" onClick={reset} className="pill primary">
              Try again
            </button>
          </div>
        </main>
      </body>
    </html>
  );
}
