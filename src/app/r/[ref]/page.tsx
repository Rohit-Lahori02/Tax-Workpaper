import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { FactsPanel } from "@/components/facts/facts-panel";
import { PageHeader } from "@/components/page-header";
import { Card } from "@/components/ui";
import { factsContext } from "@/lib/facts/context";
import { getLedger } from "@/lib/facts/repo";
import { redactDeep, sensitiveLiterals } from "@/lib/mask";
import { getPacket } from "@/lib/packet/load";
import { resolveRef } from "@/lib/packet/resolve";
import { hrefFor, parseRef } from "@/lib/refs";
import { logSensitiveView } from "@/lib/sensitive";
import { getViewer } from "@/lib/session";

type Params = Promise<{ ref: string }>;

function decode(raw: string): string | null {
  try {
    return decodeURIComponent(raw);
  } catch {
    return null;
  }
}

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { ref } = await params;
  return { title: decode(ref) ?? ref };
}

/** Fallback record view for reference kinds that do not have a dedicated screen yet. */
export default async function RecordPage({ params }: { params: Params }) {
  const { ref: raw } = await params;
  const refStr = decode(raw);
  if (!refStr) notFound();

  const parsed = parseRef(refStr);
  if (parsed.kind === "value" || parsed.kind === "document" || parsed.kind === "line" || parsed.kind === "version") {
    redirect(hrefFor(refStr));
  }

  const { packet, index } = getPacket();
  const resolved = resolveRef(parsed, packet, index);
  if (!resolved || resolved.kind !== "generic") notFound();

  const [{ actor, reveal }, { ledger }, ctx] = await Promise.all([getViewer(), getLedger(), factsContext()]);
  const redacted = redactDeep(resolved.data, sensitiveLiterals(packet));
  const hasSensitive = JSON.stringify(redacted) !== JSON.stringify(resolved.data);
  const data = reveal ? resolved.data : redacted;
  if (reveal && hasSensitive) logSensitiveView(actor, "/r/" + refStr, ["record"]);

  return (
    <>
      <PageHeader eyebrow={<span className="font-mono">{refStr}</span>} title={resolved.title} description={resolved.subtitle} />
      <div className="grid gap-4 xl:grid-cols-3">
        <Card title="As delivered in the packet" className="xl:col-span-2" flush>
          <pre className="overflow-auto whitespace-pre-wrap p-4 font-mono text-[12px] leading-5">{JSON.stringify(data, null, 2)}</pre>
        </Card>
        <FactsPanel target={refStr} facts={ledger.forTarget(refStr)} actor={ctx.actor} staff={ctx.staff} verificationTypes={ctx.verificationTypes} />
      </div>
    </>
  );
}
