import { ShieldAlert } from "lucide-react";
import { LookupBox } from "@/components/lookup-box";
import { RoleSwitcher } from "@/components/role-switcher";
import { MobileNav } from "@/components/shell/sidebar";
import { ThemeToggle } from "@/components/theme-toggle";
import { Badge } from "@/components/ui";
import type { Actor } from "@/lib/roles";

export function Topbar({ actors, actor, masked }: { actors: Actor[]; actor: Actor; masked: boolean }) {
  return (
    <header className="sticky top-0 z-20 flex h-[52px] items-center gap-4 border-b border-border bg-sidebar/90 px-6 backdrop-blur lg:px-8 2xl:px-10">
      <MobileNav />
      <LookupBox className="hidden flex-1 md:block" />
      <div className="ml-auto flex items-center gap-2">
        {masked ? (
          <Badge tone="warn" className="hidden sm:inline-flex">
            <ShieldAlert className="h-3 w-3" /> sensitive data masked
          </Badge>
        ) : null}
        <RoleSwitcher actors={actors} currentId={actor.id} />
        <ThemeToggle />
      </div>
    </header>
  );
}
