"use client";

import { AlertOctagon, RotateCcw } from "lucide-react";
import Link from "next/link";
import { useEffect } from "react";

/**
 * Route error boundary. The shell (sidebar, top bar) stays up; only the page
 * body is replaced. Nothing in the ledger is affected: facts are written by
 * server actions that either complete or return an error of their own.
 */
export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    // Surface in the browser console for whoever is debugging; the server log has the full trace.
    console.error(error);
  }, [error]);

  return (
    <div className="fade-up mx-auto grid max-w-2xl gap-5 py-10">
      <div className="grid justify-items-center gap-4 text-center">
        <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-danger-soft text-danger ring-1 ring-inset ring-danger/25">
          <AlertOctagon className="h-6 w-6" />
        </span>
        <div>
          <h1 className="text-[24px] font-semibold leading-8 tracking-[-0.02em]">This page could not be built</h1>
          <p className="mx-auto mt-2 max-w-lg text-[13.5px] leading-[22px] text-muted">
            Something went wrong while putting this page together. The file itself is untouched: the packet is read-only and every record in the ledger is already saved. Trying again usually works; if it keeps failing, the reference below tells the firm which run to look at.
          </p>
        </div>
        <div className="flex flex-wrap items-center justify-center gap-2">
          <button type="button" onClick={reset} className="pill primary">
            <RotateCcw className="h-3.5 w-3.5" /> Try again
          </button>
          <Link href="/" className="pill">
            Back to the overview
          </Link>
        </div>
      </div>
      <div className="card px-5 py-4 text-[12.5px] leading-5">
        <div className="text-[11px] font-medium uppercase tracking-[0.06em] text-muted">What the server said</div>
        <p className="mt-1.5 break-words font-mono text-[12px] text-foreground">{error.message || "No message was given."}</p>
        {error.digest ? (
          <p className="mt-2 text-muted">
            Reference <span className="font-mono text-foreground">{error.digest}</span>, for matching against the server log.
          </p>
        ) : null}
      </div>
    </div>
  );
}
