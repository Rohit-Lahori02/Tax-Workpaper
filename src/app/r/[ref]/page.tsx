import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { DocumentRecord } from "@/components/record/document-record";
import { GenericRecord } from "@/components/record/generic-record";
import { LineRecord } from "@/components/record/line-record";
import { ValueRecord } from "@/components/record/value-record";
import { sensitiveLiterals } from "@/lib/mask";
import { getPacket } from "@/lib/packet/load";
import { resolveRef } from "@/lib/packet/resolve";
import { parseRef } from "@/lib/refs";
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
  return { title: (decode(ref) ?? ref) + " · Workpaper" };
}

export default async function RecordPage({ params }: { params: Params }) {
  const { ref: raw } = await params;
  const refStr = decode(raw);
  if (!refStr) notFound();

  const { packet, index } = getPacket();
  const actor = await getCurrentActor();
  const reveal = canViewSensitive(actor);
  const literals = reveal ? [] : sensitiveLiterals(packet);

  const resolved = resolveRef(parseRef(refStr), packet, index);
  if (!resolved) notFound();

  switch (resolved.kind) {
    case "value":
      return <ValueRecord resolved={resolved} index={index} reveal={reveal} />;
    case "document":
      return <DocumentRecord resolved={resolved} index={index} reveal={reveal} literals={literals} />;
    case "line":
      return <LineRecord resolved={resolved} packet={packet} index={index} />;
    case "generic":
      return <GenericRecord resolved={resolved} refStr={refStr} literals={literals} />;
  }
}
