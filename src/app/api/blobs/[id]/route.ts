import { NextResponse } from "next/server";
import { getBlob } from "@/lib/facts/repo";
import { getCurrentActor } from "@/lib/session";

/** Serves an attached file to anyone acting on this engagement. */
export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return new NextResponse("Not found", { status: 404 });
  await getCurrentActor();
  const blob = await getBlob(id);
  if (!blob) return new NextResponse("Not found", { status: 404 });
  const bytes = Buffer.from(blob.dataBase64, "base64");
  const safeName = blob.name.replace(/[^\w.\- ]+/g, "_");
  return new NextResponse(bytes, {
    headers: {
      "Content-Type": blob.mime,
      "Content-Length": String(bytes.length),
      "Content-Disposition": `inline; filename="${safeName}"`,
      "Cache-Control": "private, max-age=0, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
