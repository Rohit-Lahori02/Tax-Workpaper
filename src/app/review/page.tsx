import type { Metadata } from "next";
import Link from "next/link";
import { EffectBadge } from "@/components/checks/finding-row";
import { PageHeader } from "@/components/page-header";
import { RefLink } from "@/components/ref-link";
import { ApproveAdjustmentButton } from "@/components/review/approve-adjustment";
import { SignoffCell, type SignoffCellData } from "@/components/review/signoff-cell";
import { Badge, Card, cn, SectionTitle, Stat } from "@/components/ui";
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
  const fullySigned = scopes.filter((s) => levels.every((l) => cells[s.id + "|" + l].state === "valid")).length;
  const reopened = statuses.filter((s) => s.state === "reopened").length;
  const pending = approvals.filter((a) => a.state === "pending" || a.state === "reopened");
  const blocking = ledger.all.filter((f) => f.kind === "note" && !f.retracted && !f.resolved && f.body.blocking === true);

  return (
    <>
      <PageHeader
        title="Sign-offs"
        description="Each sign-off stores a fingerprint of everything in its scope at that moment: working values, adjustments, verifications, notes and judgments. Change any of it and the sign-off reopens by itself. Levels go in order, and nobody signs off on work they prepared."
      />
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Scopes fully signed" value={fullySigned + " / " + scopes.length} tone={fullySigned === scopes.length ? "ok" : undefined} hint={levels.join(" → ")} />
        <Stat label="Reopened sign-offs" value={reopened} tone={reopened ? "warn" : "ok"} hint="signed, then something underneath changed" />
        <Stat label="Awaiting partner approval" value={pending.length} tone={pending.length ? "warn" : "ok"} hint="adjustments over the firm threshold" />
        <Stat label="Blocking notes open" value={blocking.length} tone={blocking.length ? "danger" : "ok"} hint="filing is blocked while any is open" />
      </div>

      <Card className="mt-6" title="Sign-off matrix" description="One row per area, plus the whole return. The whole-return row is what the client approves." flush>
        <div className="overflow-auto">
          <table className="tbl">
            <thead>
              <tr>
                <th>Scope</th>
                <th className="num">Lines</th>
                <th className="num">Records</th>
                {levels.map((l) => (
                  <th key={l} className="capitalize">
                    {l}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {scopes.map((s) => {
                const snap = ctx.snapshots.get(s.id)!;
                return (
                  <tr key={s.id} className={cn(s.id === "return" && "bg-surface-2/60 font-medium")}>
                    <td>
                      <div>{s.label}</div>
                      <div className="font-mono text-[10px] text-muted">{snap.hash.slice(0, 12)}</div>
                    </td>
                    <td className="num text-muted">{s.lines.length}</td>
                    <td className="num text-muted">{snap.facts}</td>
                    {levels.map((l) => (
                      <td key={l} className="min-w-[200px] align-top font-normal">
                        <SignoffCell cell={cells[s.id + "|" + l]} />
                      </td>
                    ))}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>

      <section id="approvals" className="mt-6 scroll-mt-20">
        <SectionTitle>Adjustments needing partner approval</SectionTitle>
        <Card flush>
          {approvals.filter((a) => a.state !== "not_needed").length === 0 ? (
            <p className="p-4 text-[13px] text-muted">No adjustment exceeds the firm threshold.</p>
          ) : (
            <ul className="divide-y divide-border">
              {approvals
                .filter((a) => a.state !== "not_needed")
                .map((a) => (
                  <li key={a.adjustment.factId} className="flex flex-wrap items-center gap-3 px-4 py-3">
                    <RefLink refId={a.adjustment.key} />
                    <span className="font-mono text-[12px] tabular-nums">
                      <span className="text-muted line-through">{fmtNumber(a.adjustment.engineValue)}</span> → {fmtNumber(a.adjustment.newValue)}
                    </span>
                    <EffectBadge effect={a.adjustment.effect} />
                    <span className="min-w-0 flex-1 truncate text-[12.5px] text-muted">
                      {a.adjustment.actorName}: {a.adjustment.reason}
                    </span>
                    {a.state === "approved" ? (
                      <Badge tone="ok" dot>
                        approved by {a.approval?.actorName}
                      </Badge>
                    ) : (
                      <>
                        <Badge tone="warn" dot>
                          {a.state === "reopened" ? "changed since approval" : "pending"}
                        </Badge>
                        <ApproveAdjustmentButton factId={a.adjustment.factId} allowed={canApproveAdjustment(actor) && a.adjustment.actorId !== actor.id} label={a.state === "reopened" ? "Re-approve" : "Approve as partner"} />
                      </>
                    )}
                  </li>
                ))}
            </ul>
          )}
        </Card>
      </section>

      <section id="blocking" className="mt-6 scroll-mt-20">
        <SectionTitle>Blocking review notes</SectionTitle>
        <Card description="Open review notes block filing. Resolve them on the item they concern." flush>
          {blocking.length === 0 ? (
            <p className="p-4 text-[13px] text-muted">None open.</p>
          ) : (
            <ul className="divide-y divide-border">
              {blocking.map((b) => (
                <li key={b.id} className="flex flex-wrap items-baseline gap-3 px-4 py-3 text-[13px]">
                  <RefLink refId={b.target} />
                  <span className="min-w-0 flex-1">{String(b.body.text ?? "")}</span>
                  <span className="text-[12px] text-muted">{b.actorName}</span>
                  <Link href={"/r/" + encodeURIComponent(b.target)} className="text-[12px] text-accent hover:underline">
                    open
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </section>
    </>
  );
}
