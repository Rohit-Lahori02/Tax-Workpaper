import { notFound, redirect } from "next/navigation";
import { getPacket } from "@/lib/packet/load";
import { documentHref } from "@/lib/refs";

/** An extracted value is shown in place, on the page it was read from. */
export default async function ValuePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { index } = getPacket();
  const value = index.values.get(id);
  if (!value) notFound();
  redirect(documentHref(value.document_id, { page: value.page, value: value.id }));
}
