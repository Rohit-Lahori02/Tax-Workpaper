import { RotateCcw, Save } from "lucide-react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ActionForm } from "@/components/filing/action-form";
import { PageHeader } from "@/components/page-header";
import { Badge, Card, cn, KV } from "@/components/ui";
import { revertStandardAction, standardAction } from "@/lib/facts/actions-admin";
import { getLedger } from "@/lib/facts/repo";
import { fmtDateTime } from "@/lib/format";
import { getPacket } from "@/lib/packet/load";
import { canEditStandards, canSeeLedger } from "@/lib/permissions";
import { getCurrentActor } from "@/lib/session";
import { formatStandardValue, standardsView } from "@/lib/standards";

export const metadata: Metadata = { title: "Firm standards" };

export default async function StandardsPage() {
  const actor = await getCurrentActor();
  if (!canSeeLedger(actor)) notFound();
  const { packet } = getPacket();
  const { ledger } = await getLedger();
  const views = standardsView(packet, ledger);
  const may = canEditStandards(actor);
  const changed = views.filter((v) => v.override).length;
  const history = ledger.all.filter((f) => f.kind === "standard" || (f.kind === "retract" && f.target.startsWith("standard:"))).slice().reverse();

  return (
    <>
      <PageHeader
        eyebrow="Firm"
        title="Firm standards"
        description="The rules the app enforces, as data the firm owns. The packet ships a starting point; every change here is a record with a reason, takes effect everywhere at once, and can be reverted. Nothing already signed is reopened by a standards change."
        meta={
          <>
            <Badge tone={changed ? "accent" : "neutral"} dot>
              {changed ? changed + " standard" + (changed === 1 ? "" : "s") + " changed from the starter set" : "starter standards in force"}
            </Badge>
            {!may ? <Badge tone="neutral">read only for your role</Badge> : null}
          </>
        }
      />
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <span className="text-[12.5px] text-muted">{packet.firm.starter_standards.note}</span>
        <span className="ml-auto flex flex-wrap gap-1.5">
          {views.map((v) => (
            <a key={v.def.key} href={"#" + v.def.key} className={cn("chip h-7", v.override && "is-active")}>
              {v.def.label}
            </a>
          ))}
        </span>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        {views.map((v) => {
          const value = formatStandardValue(v.def, v.current);
          const starter = formatStandardValue(v.def, v.starter);
          const isList = v.def.kind === "list" || v.def.kind === "hours";
          return (
            <Card
              key={v.def.key}
              id={v.def.key}
              className={cn("scroll-mt-24", v.override && "ring-1 ring-inset ring-accent/30")}
              title={v.def.label}
              description={v.def.description}
              aside={
                v.override ? (
                  <Badge tone="accent" dot>
                    changed
                  </Badge>
                ) : (
                  <Badge tone="neutral">starter</Badge>
                )
              }
            >
              {isList ? (
                <ul className="grid gap-1 text-[13px]">
                  {value.split("\n").map((item, i) => {
                    const added = !starter.split("\n").includes(item);
                    const [k, rest] = v.def.kind === "hours" ? item.split(/:\s*/) : [item, undefined];
                    return (
                      <li key={i} className="flex items-center gap-2">
                        <span className={cn("font-mono text-[10px] tabular-nums text-muted/70", added && "text-accent")}>{String(i + 1).padStart(2, "0")}</span>
                        {v.def.key === "verification_types" ? <span className={cn("ref", added && "border-accent/40 text-accent")}>{item}</span> : <span className={cn("min-w-0 flex-1", added && "font-medium text-accent")}>{k}</span>}
                        {rest !== undefined ? <span className="ml-auto font-mono text-[12px] tabular-nums">{rest} h</span> : null}
                      </li>
                    );
                  })}
                </ul>
              ) : (
                <div className="flex items-baseline gap-3">
                  <span className={cn("text-[30px] font-semibold leading-none tabular-nums tracking-[-0.02em]", v.override && "text-accent")}>
                    {v.def.kind === "percent" ? value + "%" : v.def.key === "partner_threshold" || v.def.key === "variance_amount" ? "$" + Number(value).toLocaleString("en-US") : value}
                  </span>
                  {v.override ? <span className="text-[12px] text-muted line-through decoration-border-strong">{v.def.kind === "percent" ? starter + "%" : "$" + Number(starter).toLocaleString("en-US")}</span> : null}
                </div>
              )}
              <KV className="mt-4 text-[12.5px]" rows={[["Used by", v.def.usedBy]]} />
              {v.override ? (
                <div className="mt-3 rounded-lg border border-accent/25 bg-accent-soft/40 px-3 py-2 text-[12.5px]">
                  <div className="text-[11px] font-medium uppercase tracking-[0.06em] text-accent">Changed {fmtDateTime(v.override.at)} by {v.override.actorName}</div>
                  <p className="mt-0.5 leading-5">{String(v.override.body.text ?? "")}</p>
                </div>
              ) : null}
              {v.def.editable && may ? (
                <div className="mt-3 flex flex-wrap items-start gap-3 border-t border-border pt-3">
                  <ActionForm
                    action={standardAction}
                    hidden={{ key: v.def.key }}
                    label="Change"
                    icon={<Save className="h-3.5 w-3.5" />}
                    fields={[
                      { name: "value", label: isList ? "New value, one per line" : "New value", type: isList ? "textarea" : "number", defaultValue: value, required: true },
                      { name: "text", label: "Why", type: "textarea", required: true, placeholder: "Partner meeting 2026-10: raise the threshold now that the ledger shows every effect." },
                    ]}
                  />
                  {v.override ? <ActionForm action={revertStandardAction} hidden={{ key: v.def.key }} label="Revert to starter" icon={<RotateCcw className="h-3.5 w-3.5" />} confirm={"Revert " + v.def.label + " to the packet's starter value?"} /> : null}
                </div>
              ) : !v.def.editable ? (
                <p className="mt-3 border-t border-border pt-3 text-[12px] text-muted">Enforced structurally: the sign-off matrix, the sequence gate and the no-self-review rule depend on these levels, so they change in code, not here.</p>
              ) : null}
            </Card>
          );
        })}
      </div>

      <Card className="mt-4" title="History" description="Every standards change and reversion, newest first." flush>
        {history.length ? (
          <table className="tbl">
            <thead>
              <tr>
                <th>When</th>
                <th>Who</th>
                <th>Standard</th>
                <th>Change</th>
              </tr>
            </thead>
            <tbody>
              {history.map((f) => (
                <tr key={f.id}>
                  <td className="whitespace-nowrap text-muted">{fmtDateTime(f.at)}</td>
                  <td>{f.actorName}</td>
                  <td className="font-mono text-[11.5px]">{f.target.replace("standard:", "")}</td>
                  <td className="text-muted">{f.kind === "retract" ? "Reverted: " + String(f.body.reason ?? "") : String(f.body.text ?? "")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p className="px-5 py-4 text-[13px] text-muted">No changes yet; the starter standards are in force.</p>
        )}
      </Card>
    </>
  );
}
