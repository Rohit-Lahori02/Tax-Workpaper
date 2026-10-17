import { Clock3 } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ActionForm } from "@/components/filing/action-form";
import { PageHeader } from "@/components/page-header";
import { Badge, Card, cn, Stat, type Tone } from "@/components/ui";
import { areaStatuses } from "@/lib/completeness";
import { timeAction } from "@/lib/facts/actions-admin";
import { fmtDate } from "@/lib/format";
import { canLogTime, canSeeLedger } from "@/lib/permissions";
import { getReviewContext, needsYou } from "@/lib/review";
import { PHASE_LABELS, type FilingPhase } from "@/lib/season";
import { getCurrentActor, getNow, listActors } from "@/lib/session";
import { timeByArea, timeEntries } from "@/lib/standards";

export const metadata: Metadata = { title: "Status" };

const PHASE_TONE: Record<FilingPhase, Tone> = { preparing: "neutral", transmitted: "accent", rejected: "danger", filed: "ok", amending: "warn", amended: "ok" };
const SIGN_TONE = { valid: "ok", reopened: "warn", missing: "neutral" } as const;

export default async function StatusPage() {
  const actor = await getCurrentActor();
  if (!canSeeLedger(actor)) notFound();
  const ctx = await getReviewContext();
  const now = await getNow();
  const { packet, index, ledger, checks, statuses, levels, assignments, filing, gates } = ctx;
  const areas = areaStatuses(packet, index, ledger, checks);
  const time = timeByArea(packet, ledger);
  const entries = timeEntries(ledger);
  const budgetTotal = time.reduce((s, t) => s + t.budget, 0);
  const loggedTotal = time.reduce((s, t) => s + t.logged, 0);
  const staff = listActors().filter((a) => a.kind === "staff");
  const nowDate = new Date(now.iso);
  const extended = packet.firm.deadlines.find((d) => /extended due date/i.test(d.what));
  const daysLeft = extended ? Math.ceil((Date.parse(extended.date) - nowDate.getTime()) / 86400000) : null;
  const linesTotal = areas.reduce((s, a) => s + a.lines, 0);
  const verifiedTotal = areas.reduce((s, a) => s + a.verified, 0);
  const errorsOpen = checks.findings.filter((f) => f.severity === "error").length - areas.reduce((s, a) => s + a.checkErrorsResolved, 0);
  const nameOf = (id: string) => packet.firm.staff.find((s) => s.id === id)?.name ?? id;
  const workload = staff.map((s) => ({ actor: s, items: needsYou(ctx, s, nowDate), hours: Math.round(entries.filter((e) => e.actorId === s.id).reduce((n, e) => n + e.hours, 0) * 100) / 100 }));

  return (
    <>
      <PageHeader
        title="Engagement status"
        description="One screen for the person running the season: where the return stands, each area's evidence, checks, sign-offs and time against budget, and what is sitting with whom."
        meta={
          <>
            <Badge tone={PHASE_TONE[filing.phase]} dot>
              {PHASE_LABELS[filing.phase]}
            </Badge>
            <Badge tone={gates.every((g) => g.ok) ? "ok" : "warn"}>{gates.filter((g) => g.ok).length + " of " + gates.length + " gates open"}</Badge>
            {extended && daysLeft !== null ? <Badge tone={daysLeft < 0 ? "danger" : daysLeft <= 14 ? "warn" : "neutral"}>{daysLeft < 0 ? -daysLeft + " days past the extended due date" : daysLeft + " days to the extended due date"}</Badge> : null}
          </>
        }
      />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Lines verified" value={linesTotal ? Math.round((verifiedTotal / linesTotal) * 100) + "%" : "—"} hint={verifiedTotal + " of " + linesTotal} />
        <Stat label="Check errors open" value={errorsOpen} tone={errorsOpen ? "danger" : "ok"} hint={checks.findings.filter((f) => f.severity === "error").length + " found in all"} />
        <Stat label="Hours logged" value={loggedTotal} hint={"of " + budgetTotal + " budgeted"} tone={loggedTotal > budgetTotal ? "warn" : undefined} />
        <Stat label="Next deadline" value={extended ? fmtDate(extended.date) : "—"} hint={extended?.what} />
      </div>

      <Card className="mt-4" title="Areas" description="Evidence, checks, questions, sign-offs and time, one row per area of the return." flush>
        <div className="overflow-auto">
          <table className="tbl">
            <thead>
              <tr>
                <th>Area</th>
                <th className="text-right">Verified</th>
                <th className="text-right">Errors</th>
                <th className="text-right">Open Qs</th>
                <th className="text-right">Blocking</th>
                {levels.map((l) => (
                  <th key={l} className="capitalize">
                    {l}
                  </th>
                ))}
                <th>Preparer</th>
                <th>Time vs budget</th>
              </tr>
            </thead>
            <tbody>
              {areas
                .filter((a) => a.id !== "partner_review")
                .map((a) => {
                  const t = time.find((x) => x.area === a.id);
                  const pct = t && t.budget ? Math.min(100, Math.round((t.logged / t.budget) * 100)) : 0;
                  const over = t ? t.logged > t.budget : false;
                  const prep = assignments.find((x) => x.scope === "area:" + a.id && x.role === "preparer");
                  return (
                    <tr key={a.id}>
                      <td>
                        <Link href={"/completeness#" + a.id} className="font-medium hover:underline">
                          {a.label}
                        </Link>
                        <div className="text-[11px] text-muted">
                          {a.lines} lines · {a.documents} docs
                        </div>
                      </td>
                      <td className="text-right tabular-nums">{a.lines ? Math.round((a.verified / a.lines) * 100) + "%" : "—"}</td>
                      <td className={cn("text-right tabular-nums", a.checkErrors - a.checkErrorsResolved > 0 && "text-danger")}>{a.checkErrors ? a.checkErrors - a.checkErrorsResolved + " / " + a.checkErrors : "0"}</td>
                      <td className="text-right tabular-nums">{a.openQuestions}</td>
                      <td className={cn("text-right tabular-nums", a.blocking && "text-danger")}>{a.blocking}</td>
                      {levels.map((l) => {
                        const s = statuses.find((x) => x.scope.id === "area:" + a.id && x.level === l);
                        return (
                          <td key={l}>
                            <Badge tone={SIGN_TONE[s?.state ?? "missing"]} dot>
                              {s?.state ?? "missing"}
                            </Badge>
                          </td>
                        );
                      })}
                      <td className="text-muted">{prep ? nameOf(prep.assigneeId) : "—"}</td>
                      <td className="min-w-[150px]">
                        <div className="flex items-center gap-2">
                          <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-surface-2">
                            <div className={cn("h-full rounded-full", over ? "bg-danger" : pct > 80 ? "bg-warn" : "bg-ok")} style={{ width: pct + "%" }} />
                          </div>
                          <span className={cn("whitespace-nowrap font-mono text-[11px]", over ? "text-danger" : "text-muted")}>
                            {t?.logged ?? 0} / {t?.budget ?? 0} h
                          </span>
                        </div>
                      </td>
                    </tr>
                  );
                })}
            </tbody>
          </table>
        </div>
      </Card>

      <div className="mt-4 grid gap-4 xl:grid-cols-2">
        <Card title="Who has what" description="Needs-you items and hours by person, from the same rules as each person's My work page.">
          <table className="tbl">
            <thead>
              <tr>
                <th>Person</th>
                <th>Role</th>
                <th className="text-right">Waiting on them</th>
                <th className="text-right">Overdue</th>
                <th className="text-right">Hours</th>
              </tr>
            </thead>
            <tbody>
              {workload.map((w) => (
                <tr key={w.actor.id}>
                  <td className="font-medium">{w.actor.name}</td>
                  <td className="capitalize text-muted">{w.actor.role.replace(/_/g, " ")}</td>
                  <td className="text-right tabular-nums">{w.items.length}</td>
                  <td className={cn("text-right tabular-nums", w.items.some((i) => i.overdue) && "text-danger")}>{w.items.filter((i) => i.overdue).length}</td>
                  <td className="text-right tabular-nums">{w.hours}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>

        <Card title="Log time" description="Quarter hours against an area. Time is a record like any other: it can be retracted, never edited.">
          {canLogTime(actor) ? (
            <ActionForm
              action={timeAction}
              label="Log time"
              icon={<Clock3 className="h-3.5 w-3.5" />}
              primary
              fields={[
                { name: "area", label: "Area id", type: "text", defaultValue: "business", hint: Object.keys(packet.firm.budget_hours).join(", ") },
                { name: "hours", label: "Hours", type: "number", defaultValue: "0.5", required: true },
                { name: "date", label: "Date (YYYY-MM-DD)", type: "text", defaultValue: now.iso.slice(0, 10) },
                { name: "text", label: "What was done", type: "textarea", placeholder: "Traced 1099-NECs to the books; reconciled Paywell deposits." },
              ]}
            />
          ) : null}
          {entries.length ? (
            <ul className="mt-4 grid gap-1 border-t border-border pt-3 text-[12.5px]">
              {entries
                .slice()
                .reverse()
                .slice(0, 12)
                .map((e) => (
                  <li key={e.fact.id} className="flex items-baseline justify-between gap-3">
                    <span className="min-w-0 truncate">
                      <span className="font-medium">{e.actorName}</span> · {e.area.replace(/_/g, " ")}
                      {e.text ? <span className="text-muted"> · {e.text}</span> : null}
                    </span>
                    <span className="shrink-0 font-mono text-[11px] text-muted">
                      {e.hours} h · {fmtDate(e.date)}
                    </span>
                  </li>
                ))}
            </ul>
          ) : (
            <p className="mt-3 text-[12.5px] text-muted">No time logged yet.</p>
          )}
        </Card>
      </div>
    </>
  );
}
