import type { Metadata } from "next";
import { DocumentTable } from "@/components/documents/document-table";
import { PageHeader } from "@/components/page-header";
import { Card, Stat } from "@/components/ui";
import { documentRows } from "@/lib/packet/documents";
import { getPacket } from "@/lib/packet/load";
import { getNow } from "@/lib/session";
import { fmtDate } from "@/lib/format";

export const metadata: Metadata = { title: "Documents" };

export default async function DocumentsPage() {
  const { index, packet } = getPacket();
  const now = await getNow();
  const version = now.replay ? (packet.return_versions.filter((v) => v.computed_at <= now.iso).at(-1)?.version ?? index.latestVersion) : index.latestVersion;
  const rows = documentRows(index, version).map((r) => (now.replay && r.receivedAt > now.iso ? { ...r, reason: "Not yet received as of " + fmtDate(now.iso) + " (arrives " + fmtDate(r.receivedAt) + ")" } : r));
  const notYet = now.replay ? rows.filter((r) => r.receivedAt > now.iso).length : 0;
  const reached = rows.filter((r) => r.state === "reached").length;
  const unused = rows.filter((r) => r.state === "unused").length;
  const notExtracted = rows.filter((r) => r.state === "not_extracted").length;
  const superseded = rows.filter((r) => r.state === "superseded").length;

  return (
    <>
      <PageHeader
        title="Documents"
        description={
          "Every document the client or the firm put in the file, and where each one landed on return " +
          version +
          ". A document that reaches no line is either irrelevant, a duplicate, or a gap in the return. Each one needs a reason."
        }
      />
      <div className="mb-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="On the return" value={reached} hint={"documents feeding at least one line in " + version} tone="ok" />
        <Stat label="Reach no line" value={unused} hint="extracted, but no line cites them" tone={unused ? "warn" : undefined} />
        <Stat label="Not extracted" value={notExtracted} hint="the pipeline read nothing from them" tone={notExtracted ? "danger" : undefined} />
        <Stat label="Superseded" value={superseded} hint="replaced by a corrected document" />
      </div>
      {notYet ? <p className="mb-3 text-[12.5px] text-muted">Replaying as of {fmtDate(now.iso)}: {notYet} of these documents had not arrived yet; their rows say when they do.</p> : null}
      <Card flush>
        <DocumentTable rows={rows} version={version} />
      </Card>
    </>
  );
}
