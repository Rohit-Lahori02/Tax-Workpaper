import { maxSeq } from "@/lib/facts/repo";
import { getCurrentActor } from "@/lib/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface Viewer {
  id: string;
  name: string;
  role: string;
  lastSeen: number;
}

// Per-process presence. Enough for one server; a shared store would replace this for a fleet.
const viewers = new Map<string, Viewer>();
const POLL_MS = 3000;
const STALE_MS = 20000;

/**
 * Server-sent events: the ledger's latest sequence number and who else is
 * looking. The browser refreshes its server components when the sequence moves.
 */
export async function GET(req: Request) {
  const actor = await getCurrentActor();
  const encoder = new TextEncoder();
  let timer: ReturnType<typeof setInterval> | null = null;

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      const send = async () => {
        try {
          const now = Date.now();
          viewers.set(actor.id, { id: actor.id, name: actor.name, role: actor.role, lastSeen: now });
          for (const [id, v] of viewers) if (now - v.lastSeen > STALE_MS) viewers.delete(id);
          const seq = await maxSeq();
          const others = [...viewers.values()].filter((v) => v.id !== actor.id).map((v) => ({ id: v.id, name: v.name, role: v.role }));
          controller.enqueue(encoder.encode("data: " + JSON.stringify({ seq, viewers: others }) + "\n\n"));
        } catch (e) {
          console.error("events tick failed", e);
        }
      };
      void send();
      timer = setInterval(send, POLL_MS);
      req.signal.addEventListener("abort", () => {
        if (timer) clearInterval(timer);
        viewers.delete(actor.id);
        try {
          controller.close();
        } catch {}
      });
    },
    cancel() {
      if (timer) clearInterval(timer);
      viewers.delete(actor.id);
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
