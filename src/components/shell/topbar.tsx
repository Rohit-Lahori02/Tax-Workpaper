import { ShieldAlert } from "lucide-react";
import { LookupBox } from "@/components/lookup-box";
import { RoleSwitcher } from "@/components/role-switcher";
import { MobileNav } from "@/components/shell/sidebar";
import { Badge } from "@/components/ui";
import type { Actor } from "@/lib/roles";

export function Topbar({ actors, actor, masked }: { actors: Actor[]; actor: Actor; masked: boolean }) {
  return (
    <header className="sticky top-0 z-20 flex h-14 items-center gap-4 border-b border-border bg-surface/85 px-6 backdrop-blur lg:px-8">
      <MobileNav />
      <LookupBox className="hidden md:block" />
      <div className="ml-auto flex items-center gap-3">
        {masked ? (
          <Badge tone="warn">
            <ShieldAlert className="h-3 w-3" /> sensitive data masked
          </Badge>
        ) : null}
        <RoleSwitcher actors={actors} currentId={actor.id} />
      </div>
    </header>
  );
}
