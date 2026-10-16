import { Bell } from "lucide-react";
import Link from "next/link";
import { LookupBox } from "@/components/lookup-box";
import { RevealToggle } from "@/components/reveal-toggle";
import { RoleSwitcher } from "@/components/role-switcher";
import { MobileNav } from "@/components/shell/sidebar";
import { ThemeToggle } from "@/components/theme-toggle";
import type { Actor } from "@/lib/roles";

export function Topbar({
  actors,
  actor,
  revealEligible,
  revealOn,
  unseen,
}: {
  actors: Actor[];
  actor: Actor;
  revealEligible: boolean;
  revealOn: boolean;
  unseen: number;
}) {
  return (
    <header className="sticky top-0 z-20 flex h-[52px] items-center gap-4 border-b border-border bg-sidebar/90 px-6 backdrop-blur lg:px-8 2xl:px-10">
      <MobileNav />
      <LookupBox className="hidden flex-1 md:block" />
      <div className="ml-auto flex items-center gap-2">
        <Link
          href="/changes"
          title={unseen ? unseen + " new records since you last looked" : "Nothing new since you last looked"}
          className="relative flex h-8 w-8 items-center justify-center rounded-full border border-border bg-surface text-muted hover:text-foreground"
        >
          <Bell className="h-4 w-4" />
          {unseen ? (
            <span className="absolute -right-1 -top-1 min-w-[18px] rounded-full bg-accent px-1 text-center text-[10px] font-semibold leading-[18px] text-accent-fg">
              {unseen > 99 ? "99+" : unseen}
            </span>
          ) : null}
        </Link>
        <RevealToggle eligible={revealEligible} on={revealOn} />
        <RoleSwitcher actors={actors} currentId={actor.id} />
        <ThemeToggle />
      </div>
    </header>
  );
}
