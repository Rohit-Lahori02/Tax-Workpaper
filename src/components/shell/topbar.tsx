import { Bell } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
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
  live,
}: {
  actors: Actor[];
  actor: Actor;
  revealEligible: boolean;
  revealOn: boolean;
  unseen: number;
  live?: ReactNode;
}) {
  return (
    <header className="sticky top-0 z-20 flex h-14 items-center gap-4 border-b border-border bg-background/85 px-6 backdrop-blur-md lg:px-8 2xl:px-10">
      <MobileNav />
      <LookupBox className="hidden flex-1 md:block" />
      <div className="ml-auto flex items-center gap-2">
        {live}
        <span className="mx-1 hidden h-5 w-px bg-border md:block" />
        <Link href="/changes" title={unseen ? unseen + " new records since you last looked" : "Nothing new since you last looked"} className="icon-btn relative">
          <Bell className="h-4 w-4" strokeWidth={1.75} />
          {unseen ? (
            <span className="absolute -right-1.5 -top-1.5 min-w-[18px] rounded-full bg-accent px-1 text-center text-[10px] font-semibold leading-[18px] text-accent-fg ring-2 ring-background">
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
