import type { Metadata } from "next";
import Link from "next/link";
import { MarkSeenButton } from "@/components/changes/mark-seen";
import { PageHeader } from "@/components/page-header";
import { RefLink } from "@/components/ref-link";
import { Badge, Card, Empty } from "@/components/ui";
import { factsSince, lastSeenSeq } from "@/lib/effective";
import { getLedger } from "@/lib/facts/repo";
import { KIND_LABELS, type FactKind, type FactView } from "@/lib/facts/types";
import { fmtDate } from "@/lib/format";
import { describeRef } from "@/lib/packet/describe";
import { getPacket } from "@/lib/packet/load";
import { getCurrentActor } from "@/lib/session";

export const metadata: Metadata = { title: "Since you last looked" };

const fmtWhen = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit", timeZone: "UTC" });

function summaryOf(f: FactView): string {
  const b = f.body;
  switch (f.kind) {
    case "verification":
      return "verified · " + String(b.type ?? "").replace(/_/g, " ");
    case "note":
      return (b.blocking ? "blocking note: " : "note: ") + String(b.text ?? "");
    case "question":
      return "asked " + (b.to === "client" ? "the client" : String(b.to)) + ": " + String(b.text ?? "");
    case "answer":
      return "answered: " + String(b.text ?? "");
    case "attachment":
      return "attached " + String(b.name ?? "a file");
    case "adjustment":
      return "adjusted " + String(b.engineValue) + " → " + String(b.newValue) + ": " + String(b.reason ?? "");
    case "retract":
      return "retracted an earlier record";
    case "resolve":
      return "resolved a note";
    default:
      return KIND_LABELS[f.kind as FactKind] ?? f.kind;
  }
}

export default async function ChangesPage() {
  const { packet, index } = getPacket();
  const actor = await getCurrentActor();
  const { ledger } = await getLedger();
  const since = lastSeenSeq(ledger, actor.id);
  const fresh = factsSince(ledger, since, actor.id).reverse();
  const groups = new Map<string, FactView[]>();
  for (const f of fresh) groups.set(f.target, [...(groups.get(f.target) ?? []), f]);
  const latest = index.versions.get(index.latestVersion)!;
  const seenAt = ledger.all.filter((f) => f.kind === "seen" && f.actorId === actor.id).at(-1);

  return (
    <>
      <PageHeader
        title="Since you last looked"
        description={
          seenAt
            ? "Everything other people recorded after you last caught up on " + fmtWhen.format(new Date(seenAt.at)) + " UTC, grouped by the item it concerns."
            : "You have not caught up before, so this is everything other people have recorded on this engagement."
        }
        meta={
          <Badge tone={fresh.length ? "accent" : "ok"} dot>
            {fresh.length} new record{fresh.length === 1 ? "" : "s"} by others
          </Badge>
        }
        actions={<MarkSeenButton disabled={fresh.length === 0} />}
      />
      <div className="grid gap-4 xl:grid-cols-3">
        <div className="grid content-start gap-4 xl:col-span-2">
          {fresh.length === 0 ? (
            <Card>
              <Empty>Nothing new since you last looked.</Empty>
            </Card>
          ) : null}
          {[...groups.entries()].map(([target, facts]) => {
            const d = describeRef(target, packet, index);
            return (
              <Card
                key={target}
                title={
                  <span className="flex flex-wrap items-baseline gap-2">
                    <RefLink refId={target} />
                    <span>{d.label}</span>
                  </span>
                }
                description={d.detail}
                flush
              >
                <ul className="divide-y divide-border">
                  {facts.map((f) => (
                    <li key={f.id} className="flex gap-3 px-4 py-2.5 text-[13px]">
                      <span className="w-28 shrink-0 font-mono text-[11px] text-muted">{fmtWhen.format(new Date(f.at))}</span>
                      <span className="min-w-0">
                        <span className="font-medium">{f.actorName}</span> <span className="text-muted">{summaryOf(f)}</span>
                        {f.retracted ? (
                          <Badge tone="neutral" className="ml-1.5">
                            retracted
                          </Badge>
                        ) : null}
                      </span>
                    </li>
                  ))}
                </ul>
              </Card>
            );
          })}
        </div>
        <div className="grid content-start gap-4">
          <Card title="Engine runs" description="Lines the computation engine changed between its own versions.">
            <ul className="grid gap-2 text-[13px]">
              {index.versionOrder.map((vid, i) => {
                const v = index.versions.get(vid)!;
                const prev = index.versionOrder[i - 1];
                return (
                  <li key={vid} className="flex items-baseline justify-between gap-3">
                    <span>
                      <span className="font-medium">{vid}</span> <span className="text-muted">{fmtDate(v.computed_at)}</span>
                    </span>
                    {prev ? (
                      <Link href={"/compare?a=" + prev + "&b=" + vid} className="text-accent hover:underline">
                        {v.changes_from_previous.length} lines vs {prev}
                      </Link>
                    ) : (
                      <span className="text-muted">first run</span>
                    )}
                  </li>
                );
              })}
              <li className="flex items-baseline justify-between gap-3 border-t border-border pt-2">
                <span className="font-medium">Working</span>
                <Link href={"/compare?a=" + latest.version + "&b=working"} className="text-accent hover:underline">
                  compare with {latest.version}
                </Link>
              </li>
            </ul>
          </Card>
        </div>
      </div>
    </>
  );
}
