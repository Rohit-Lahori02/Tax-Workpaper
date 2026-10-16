import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Sidebar } from "@/components/shell/sidebar";
import { Topbar } from "@/components/shell/topbar";
import { fmtDate } from "@/lib/format";
import { getPacket } from "@/lib/packet/load";
import { canViewSensitive } from "@/lib/roles";
import { getCurrentActor, listActors } from "@/lib/session";
import "@fontsource-variable/inter";
import "@fontsource-variable/jetbrains-mono";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "Miraflores Workpaper", template: "%s · Workpaper" },
  description: "Evidence, calculation and review record for one household's tax return.",
};

// Applies the saved theme before first paint. Kept tiny and dependency-free on purpose.
const themeScript = `(function(){try{var t=localStorage.getItem("wp-theme");if(t==="light"||t==="dark"){document.documentElement.setAttribute("data-theme",t)}}catch(e){}})();`;

export default async function RootLayout({ children }: { children: ReactNode }) {
  const { packet, index } = getPacket();
  const actor = await getCurrentActor();
  const actors = listActors();
  const latest = index.versions.get(index.latestVersion)!;
  const nextDeadline = [...packet.firm.deadlines].sort((a, b) => a.date.localeCompare(b.date)).find((d) => d.date >= latest.computed_at.slice(0, 10));

  return (
    <html lang="en" className="h-full" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="min-h-full">
        <div className="flex min-h-screen">
          <Sidebar
            firm={packet.firm.name}
            client={{
              name: packet.packet.name.replace(/ - tax year \d{4}$/, ""),
              clientId: packet.packet.client_id,
              taxYear: packet.household.tax_year,
              version: latest.version,
              computedAt: fmtDate(latest.computed_at),
              nextDeadline: nextDeadline ? { what: nextDeadline.what, date: fmtDate(nextDeadline.date) } : null,
              warnings: latest.diagnostics.filter((d) => d.severity === "warning").length,
            }}
          />
          <div className="flex min-w-0 flex-1 flex-col">
            <Topbar actors={actors} actor={actor} masked={!canViewSensitive(actor)} />
            <main className="w-full flex-1 px-6 py-6 lg:px-8 2xl:px-10">{children}</main>
          </div>
        </div>
      </body>
    </html>
  );
}
