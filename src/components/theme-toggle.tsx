"use client";

import { Moon, Sun } from "lucide-react";
import { useSyncExternalStore } from "react";

type Theme = "light" | "dark";

const QUERY = "(prefers-color-scheme: dark)";

function subscribe(onChange: () => void) {
  const observer = new MutationObserver(onChange);
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
  const mq = window.matchMedia(QUERY);
  mq.addEventListener("change", onChange);
  return () => {
    observer.disconnect();
    mq.removeEventListener("change", onChange);
  };
}

function getSnapshot(): Theme {
  const explicit = document.documentElement.getAttribute("data-theme");
  if (explicit === "light" || explicit === "dark") return explicit;
  return window.matchMedia(QUERY).matches ? "dark" : "light";
}

function getServerSnapshot(): Theme {
  return "light";
}

/**
 * Light/dark switch. The choice is kept in a cookie so the server renders the
 * attribute on the next request; the attribute is also set at once for this page.
 */
export function ThemeToggle() {
  const theme = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const next: Theme = theme === "dark" ? "light" : "dark";
  return (
    <button
      type="button"
      aria-label={"Switch to " + next + " theme"}
      title={"Switch to " + next + " theme"}
      onClick={() => {
        document.documentElement.setAttribute("data-theme", next);
        document.cookie = "wp-theme=" + next + "; path=/; max-age=31536000; samesite=lax";
      }}
      className="flex h-8 w-8 items-center justify-center rounded-full border border-border bg-surface text-muted hover:text-foreground"
    >
      {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
    </button>
  );
}
