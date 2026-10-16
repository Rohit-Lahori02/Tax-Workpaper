import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import type { ReactNode } from "react";
import { Sidebar } from "@/components/shell/sidebar";
import { Topbar } from "@/components/shell/topbar";
import { fmtDate } from "@/lib/format";
import { getPacket } from "@/lib/packet/load";
import { canViewSensitive } from "@/lib/roles";
import { getCurrentActor, listActors } from "@/lib/session";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap" });
const mono = JetBrains_Mono({ subsets: ["latin"], variable: "--font-jetbrains", display: "swap" });

export const metadata: Metadata = {
  title: { default: "Miraflores Workpaper", template: "%s · Workpaper" },
  description: "Evidence, calculation and review record for one household's tax return.",
};

export default async function RootLayout({ children }: { children: ReactNode }) {
  const { packet, index } = getPacket();
  const actor = await getCurrentActor();
  const actors = listActors();
  const latest = index.versions.get(index.latestVersion)!;

  return (
    <html lang="en" className={inter.variable + " " + mono.variable + " h-full"}>
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
            }}
          />
          <div className="flex min-w-0 flex-1 flex-col">
            <Topbar actors={actors} actor={actor} masked={!canViewSensitive(actor)} />
            <main className="mx-auto w-full max-w-[1440px] flex-1 px-6 py-6 lg:px-8">{children}</main>
          </div>
        </div>
      </body>
    </html>
  );
}
