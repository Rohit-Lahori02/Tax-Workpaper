"use client";

import { Check, ChevronsUpDown, Eye, EyeOff } from "lucide-react";
import { useEffect, useId, useRef, useState, useTransition } from "react";
import { cn } from "@/components/ui";
import { switchActor } from "@/lib/actions";
import { ROLE_LABELS, type Actor } from "@/lib/roles";

function initials(name: string) {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");
}

/**
 * The person acting in this browser. A chip that opens a menu drawn with the
 * app's own styles (native select popups ignore the theme on some platforms),
 * grouped into firm staff and clients, with full keyboard support.
 */
export function RoleSwitcher({ actors, currentId }: { actors: Actor[]; currentId: string }) {
  const [pending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const menuId = useId();
  const current = actors.find((a) => a.id === currentId) ?? actors[0];

  const groups: { label: string; items: Actor[] }[] = [
    { label: "Firm", items: actors.filter((a) => a.kind === "staff") },
    { label: "Clients", items: actors.filter((a) => a.kind === "client") },
  ].filter((g) => g.items.length);
  const flat = groups.flatMap((g) => g.items);

  const openMenu = () => {
    setActive(Math.max(0, flat.findIndex((a) => a.id === currentId)));
    setOpen(true);
  };

  const choose = (id: string) => {
    setOpen(false);
    buttonRef.current?.focus();
    if (id === currentId) return;
    const fd = new FormData();
    fd.set("actor", id);
    startTransition(() => switchActor(fd));
  };

  // Close on a click anywhere outside the menu.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    listRef.current?.querySelector<HTMLElement>('[data-index="' + active + '"]')?.scrollIntoView({ block: "nearest" });
  }, [active, open]);

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (!open) {
      if (e.key === "ArrowDown" || e.key === "ArrowUp" || e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        openMenu();
      }
      return;
    }
    switch (e.key) {
      case "Escape":
        e.preventDefault();
        setOpen(false);
        buttonRef.current?.focus();
        break;
      case "ArrowDown":
        e.preventDefault();
        setActive((i) => Math.min(flat.length - 1, i + 1));
        break;
      case "ArrowUp":
        e.preventDefault();
        setActive((i) => Math.max(0, i - 1));
        break;
      case "Home":
        e.preventDefault();
        setActive(0);
        break;
      case "End":
        e.preventDefault();
        setActive(flat.length - 1);
        break;
      case "Enter":
      case " ":
        e.preventDefault();
        if (flat[active]) choose(flat[active].id);
        break;
      case "Tab":
        setOpen(false);
        break;
    }
  };

  return (
    <div ref={rootRef} className="relative" onKeyDown={onKeyDown}>
      <button
        ref={buttonRef}
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={menuId}
        aria-label={"Acting as " + current.name + ", " + ROLE_LABELS[current.role] + ". Change who you are acting as."}
        onClick={() => (open ? setOpen(false) : openMenu())}
        disabled={pending}
        title={current.note ?? ROLE_LABELS[current.role]}
        className={cn("flex h-8 items-center gap-2 rounded-lg border border-border bg-surface pl-1 pr-2 text-left shadow-[var(--card-inset)] transition-colors hover:border-border-strong", open && "border-border-strong bg-surface-2", pending && "opacity-60")}
      >
        <span className={cn("flex h-6 w-6 items-center justify-center rounded-md text-[10px] font-semibold", current.kind === "client" ? "bg-ok-soft text-ok" : "bg-accent-soft text-accent")}>{initials(current.name)}</span>
        <span className="hidden flex-col leading-none sm:flex">
          <span className="text-[12px] font-medium">{current.name}</span>
          <span className="mt-0.5 text-[10.5px] text-muted">{ROLE_LABELS[current.role]}</span>
        </span>
        <ChevronsUpDown className="ml-0.5 h-3.5 w-3.5 text-muted" />
      </button>

      {open ? (
        <div
          id={menuId}
          ref={listRef}
          role="listbox"
          aria-label="Act as"
          aria-activedescendant={flat[active] ? menuId + "-" + flat[active].id : undefined}
          className="fade-up absolute right-0 top-[calc(100%+6px)] z-30 w-[292px] overflow-hidden rounded-xl border border-border bg-surface shadow-[0_12px_40px_-12px_rgba(0,0,0,0.45),0_0_0_1px_var(--border)]"
        >
          <div className="border-b border-border px-3 py-2 text-[11px] leading-4 text-muted">
            Act as someone else. The file is the same; what you may see and do follows the role.
          </div>
          <div className="max-h-[min(60vh,420px)] overflow-auto scroll-thin py-1">
            {groups.map((g) => (
              <div key={g.label}>
                <div className="px-3 pb-1 pt-2 text-[10.5px] font-semibold uppercase tracking-[0.08em] text-muted/80">{g.label}</div>
                {g.items.map((a) => {
                  const i = flat.indexOf(a);
                  const isCurrent = a.id === currentId;
                  return (
                    <div
                      key={a.id}
                      id={menuId + "-" + a.id}
                      role="option"
                      aria-selected={isCurrent}
                      data-index={i}
                      onMouseEnter={() => setActive(i)}
                      onClick={() => choose(a.id)}
                      className={cn("mx-1 flex cursor-pointer items-center gap-2.5 rounded-lg px-2 py-1.5", i === active && "bg-surface-2", isCurrent && i !== active && "bg-accent-soft/30")}
                    >
                      <span className={cn("flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-[10.5px] font-semibold", a.kind === "client" ? "bg-ok-soft text-ok" : "bg-accent-soft text-accent")}>{initials(a.name)}</span>
                      <span className="min-w-0 flex-1 leading-tight">
                        <span className="block truncate text-[12.5px] font-medium">{a.name}</span>
                        <span className="flex items-center gap-1.5 text-[11px] text-muted">
                          {ROLE_LABELS[a.role]}
                          {a.kind === "staff" ? (
                            a.sensitiveDataClearance ? (
                              <span className="flex items-center gap-0.5" title="Cleared to see sensitive identifiers">
                                <Eye className="h-3 w-3" />
                              </span>
                            ) : (
                              <span className="flex items-center gap-0.5 text-warn" title="No sensitive-data clearance: identifiers stay masked">
                                <EyeOff className="h-3 w-3" />
                              </span>
                            )
                          ) : null}
                          {a.credential ? <span className="font-mono text-[10px]">{a.credential}</span> : null}
                        </span>
                      </span>
                      {isCurrent ? <Check className="h-4 w-4 shrink-0 text-accent" aria-hidden /> : null}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
          <div className="border-t border-border bg-surface-2/40 px-3 py-1.5 text-[10.5px] text-muted">Switching records nothing. What you do afterwards is recorded under that name.</div>
        </div>
      ) : null}
    </div>
  );
}
