import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { PageHeader } from "@/components/page-header";
import { Card } from "@/components/ui";
import { redactDeep, sensitiveLiterals } from "@/lib/mask";
import { getPacket } from "@/lib/packet/load";
import { resolveRef } from "@/lib/packet/resolve";
import { hrefFor, parseRef } from "@/lib/refs";
import { canViewSensitive } from "@/lib/roles";
import { getCurrentActor } from "@/lib/session";

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

  const actor = await getCurrentActor();
  const literals = canViewSensitive(actor) ? [] : sensitiveLiterals(packet);
  const data = literals.length ? redactDeep(resolved.data, literals) : resolved.data;

  return (
    <>
      <PageHeader eyebrow={<span className="font-mono">{refStr}</span>} title={resolved.title} description={resolved.subtitle} />
      <Card title="As delivered in the packet" flush>
        <pre className="overflow-auto whitespace-pre-wrap p-4 font-mono text-[12px] leading-5">{JSON.stringify(data, null, 2)}</pre>
      </Card>
    </>
  );
}
