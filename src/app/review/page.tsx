import { ArrowRight, Info } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { EffectBadge } from "@/components/checks/finding-row";
import { PageHeader } from "@/components/page-header";
import { RefLink } from "@/components/ref-link";
import { ApproveAdjustmentButton } from "@/components/review/approve-adjustment";
import { SignoffCell, type SignoffCellData } from "@/components/review/signoff-cell";
import { Badge, Card, cn, Empty, Stat } from "@/components/ui";
import { fmtNumber } from "@/lib/format";
import { canApproveAdjustment } from "@/lib/permissions";
import { getReviewContext } from "@/lib/review";
import { getCurrentActor } from "@/lib/session";
import { canSignOff } from "@/lib/signoff";

export const metadata: Metadata = { title: "Sign-offs" };

export default async function ReviewPage() {
  const actor = await getCurrentActor();
  const ctx = await getReviewContext();
  const { scopes, levels, statuses, approvals, ledger } = ctx;
  const cells: Record<string, SignoffCellData> = {};
  for (const scope of scopes) {
    const forScope = statuses.filter((s) => s.scope.id === scope.id);
    for (const level of levels) {
      const st = forScope.find((s) => s.level === level)!;
      const el = canSignOff(actor, scope, level, levels, forScope, ledger);
      cells[scope.id + "|" + level] = {
        scope: scope.id,
        level,
        state: st.state,
        signer: st.fact?.actorName ?? null,
        at: st.fact?.at ?? null,
        hash: st.fact ? String(st.fact.body.hash) : null,
        changes: st.changes,
        allowed: el.allowed,
        reason: el.reason,
      };
    }
  }
  const rowState = (id: string): "signed" | "partial" | "reopened" | "none" => {
    const states = levels.map((l) => cells[id + "|" + l].state);
    if (states.some((s) => s === "reopened")) return "reopened";
    if (states.every((s) => s === "valid")) return "signed";
    if (states.some((s) => s === "valid")) return "partial";
    return "none";
  };
  const fullySigned = scopes.filter((s) => rowState(s.id) === "signed").length;
  const reopened = statuses.filter((s) => s.state === "reopened").length;
  const canActOn = scopes.filter((s) => levels.some((l) => cells[s.id + "|" + l].allowed && cells[s.id + "|" + l].state !== "valid")).length;
  const pending = approvals.filter((a) => a.state === "pending" || a.state === "reopened");
  const blocking = ledger.all.filter((f) => f.kind === "note" && !f.retracted && !f.resolved && f.body.blocking === true);
  const needingApproval = approvals.filter((a) => a.state !== "not_needed");
  const RAIL: Record<ReturnType<typeof rowState>, string> = { signed: "bg-ok", partial: "bg-accent", reopened: "bg-warn", none: "bg-border-strong" };

  return (
    <>
      <PageHeader
        eyebrow="Review"
        title="Sign-offs"
        description="Each sign-off stores a fingerprint of everything in its scope at that moment: working values, adjustments, verifications, notes and judgments. Change any of it and the sign-off reopens by itself. Levels go in order, and nobody signs off on work they prepared."
        meta={
          <>
            <Badge tone="neutral">
              {levels.map((l, i) => (
                <span key={l} className="inline-flex items-center gap-1 capitalize">
                  {i ? <ArrowRight className="h-3 w-3 opacity-60" /> : null}
                  {l}
                </span>
              ))}
            </Badge>
            {canActOn ? (
              <Badge tone="accent" dot>
                you can sign {canActOn} scope{canActOn === 1 ? "" : "s"} now
              </Badge>
            ) : (
              <Badge tone="neutral">nothing waits on your signature</Badge>
            )}
          </>
        }
      />
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Scopes fully signed" value={fullySigned + " / " + scopes.length} tone={fullySigned === scopes.length ? "ok" : undefined} hint="every level current" />
        <Stat label="Reopened sign-offs" value={reopened} tone={reopened ? "warn" : "ok"} hint="signed, then something underneath changed" />
        <Stat label="Awaiting partner approval" value={pending.length} tone={pending.length ? "warn" : "ok"} hint="adjustments over the firm threshold" />
        <Stat label="Blocking notes open" value={blocking.length} tone={blocking.length ? "danger" : "ok"} hint="filing is blocked while any is open" />
      </div>

      <Card
        className="mt-5"
        title="Sign-off matrix"
        description="One row per area, plus the whole return. The whole-return row is what the client approves."
        aside={
          <span className="flex flex-wrap items-center gap-3 text-[11px]">
            {(
              [
                ["signed", "all levels current"],
                ["partial", "in progress"],
                ["reopened", "reopened"],
                ["none", "not started"],
              ] as const
            ).map(([k, label]) => (
              <span key={k} className="inline-flex items-center gap-1.5">
                <span className={cn("h-2 w-2 rounded-full", RAIL[k])} /> {label}
              </span>
            ))}
          </span>
        }
        flush
      >
        <div className="overflow-auto">
          <table className="tbl">
            <thead>
              <tr>
                <th className="w-[260px]">Scope</th>
                {levels.map((l, i) => (
                  <th key={l} className="min-w-[200px]">
                    <span className="inline-flex items-center gap-1.5 capitalize">
                      <span className="flex h-4 w-4 items-center justify-center rounded-full bg-surface-3 font-mono text-[9.5px] normal-case text-muted">{i + 1}</span>
                      {l}
                    </span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {scopes.map((s) => {
                const snap = ctx.snapshots.get(s.id)!;
                const whole = s.id === "return";
                const rs = rowState(s.id);
                return (
                  <tr key={s.id} className={cn(whole && "bg-surface-2/50")}>
                    <td className={cn("relative pl-5", whole && "border-t-2 border-t-border")}>
                      <span className={cn("absolute bottom-2.5 left-0 top-2.5 w-0.5 rounded-r", RAIL[rs])} />
                      <div className={cn("text-[13px]", whole ? "font-semibold" : "font-medium")}>{s.label}</div>
                      <div className="mt-0.5 flex flex-wrap items-center gap-x-2 text-[11px] text-muted">
                        <span className="tabular-nums">{s.lines.length} lines</span>
                        <span>·</span>
                        <span className="tabular-nums">{snap.facts} records</span>
                        {snap.adjustments ? (
                          <>
                            <span>·</span>
                            <span className="text-accent">{snap.adjustments} adjusted</span>
                          </>
                        ) : null}
                      </div>
                      <div className="mt-0.5 font-mono text-[10px] text-muted/70" title="Fingerprint of the scope right now">
                        {snap.hash.slice(0, 12)}
                      </div>
                    </td>
                    {levels.map((l) => (
                      <td key={l} className={cn("align-top", whole && "border-t-2 border-t-border")}>
                        <SignoffCell cell={cells[s.id + "|" + l]} />
                      </td>
                    ))}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div className="flex items-center gap-2 border-t border-border px-5 py-2.5 text-[11.5px] text-muted">
          <Info className="h-3.5 w-3.5" />A level opens only when the one before it is current. Hover a locked cell to see why you cannot sign it.
        </div>
      </Card>

      <div className="mt-4 grid gap-4 xl:grid-cols-2">
        <Card id="approvals" className="scroll-mt-20" title="Adjustments needing partner approval" description="Any adjustment with a federal or state tax effect over the firm's threshold." aside={needingApproval.length ? <Badge tone={pending.length ? "warn" : "ok"} dot>{pending.length ? pending.length + " pending" : "all approved"}</Badge> : null} flush={needingApproval.length > 0}>
          {needingApproval.length === 0 ? (
            <Empty>No adjustment exceeds the firm threshold.</Empty>
          ) : (
            <ul className="divide-y divide-border">
              {needingApproval.map((a) => (
                <li key={a.adjustment.factId} className="grid gap-2 px-5 py-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <RefLink refId={a.adjustment.key} />
                    <span className="font-mono text-[12.5px] tabular-nums">
                      <span className="text-muted line-through">{fmtNumber(a.adjustment.engineValue)}</span> <ArrowRight className="inline h-3 w-3 text-muted" /> <span className="font-semibold">{fmtNumber(a.adjustment.newValue)}</span>
                    </span>
                    <EffectBadge effect={a.adjustment.effect} />
                    <span className="ml-auto">
                      {a.state === "approved" ? (
                        <Badge tone="ok" dot>
                          approved by {a.approval?.actorName}
                        </Badge>
                      ) : (
                        <Badge tone="warn" dot>
                          {a.state === "reopened" ? "changed since approval" : "pending"}
                        </Badge>
                      )}
                    </span>
                  </div>
                  <p className="text-[12.5px] leading-5 text-muted">
                    <span className="text-foreground">{a.adjustment.actorName}</span>: {a.adjustment.reason}
                  </p>
                  {a.state !== "approved" ? <ApproveAdjustmentButton factId={a.adjustment.factId} allowed={canApproveAdjustment(actor) && a.adjustment.actorId !== actor.id} label={a.state === "reopened" ? "Re-approve" : "Approve as partner"} /> : null}
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card id="blocking" className="scroll-mt-20" title="Blocking review notes" description="Open review notes block filing. Resolve them on the item they concern." aside={blocking.length ? <Badge tone="danger" dot>{blocking.length} open</Badge> : <Badge tone="ok" dot>none open</Badge>} flush={blocking.length > 0}>
          {blocking.length === 0 ? (
            <Empty>None open. A reviewer or partner raises one from any line or document.</Empty>
          ) : (
            <ul className="divide-y divide-border">
              {blocking.map((b) => (
                <li key={b.id} className="flex flex-wrap items-start gap-3 px-5 py-3 text-[13px]">
                  <RefLink refId={b.target} />
                  <span className="min-w-0 flex-1 leading-5">{String(b.body.text ?? "")}</span>
                  <span className="text-[12px] text-muted">{b.actorName}</span>
                  <Link href={"/r/" + encodeURIComponent(b.target)} className="text-[12px] text-accent hover:underline">
                    open
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </>
  );
}
