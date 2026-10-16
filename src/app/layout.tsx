import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Link from "next/link";
import type { ReactNode } from "react";
import { RoleSwitcher } from "@/components/role-switcher";
import { Badge } from "@/components/ui";
import { getPacket } from "@/lib/packet/load";
import { canViewSensitive } from "@/lib/roles";
import { getCurrentActor, listActors } from "@/lib/session";
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Miraflores Workpaper",
  description: "Evidence, calculation and review record for one household's tax return.",
};

export default async function RootLayout({ children }: { children: ReactNode }) {
  const { packet } = getPacket();
  const actor = await getCurrentActor();
  const actors = listActors();
  const masked = !canViewSensitive(actor);

  return (
    <html lang="en" className={geistSans.variable + " " + geistMono.variable + " h-full antialiased"}>
      <body className="flex min-h-full flex-col">
        <header className="border-b border-border bg-surface">
          <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3">
            <Link href="/" className="font-semibold">
              {packet.firm.name} Workpaper
            </Link>
            <span className="text-sm text-muted">
              {packet.packet.name} · {packet.packet.client_id}
            </span>
            <nav className="ml-auto flex items-center gap-4 text-sm">
              <Link href="/" className="hover:underline">
                Overview
              </Link>
            </nav>
            <div className="flex items-center gap-2">
              {masked ? <Badge tone="warn">sensitive data masked</Badge> : null}
              <RoleSwitcher actors={actors} currentId={actor.id} />
            </div>
          </div>
        </header>
        <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6">{children}</main>
      </body>
    </html>
  );
}
