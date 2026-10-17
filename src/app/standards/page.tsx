import { RotateCcw, Save } from "lucide-react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ActionForm } from "@/components/filing/action-form";
import { PageHeader } from "@/components/page-header";
import { Badge, Card, KV } from "@/components/ui";
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
      <p className="mb-4 text-[12.5px] text-muted">{packet.firm.starter_standards.note}</p>

      <div className="grid gap-4 xl:grid-cols-2">
        {views.map((v) => {
          const value = formatStandardValue(v.def, v.current);
          const starter = formatStandardValue(v.def, v.starter);
          const isList = v.def.kind === "list" || v.def.kind === "hours";
          return (
            <Card
              key={v.def.key}
              id={v.def.key}
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
                  {value.split("\n").map((item, i) => (
                    <li key={i} className="flex items-start gap-2">
                      <span className="mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full bg-border-strong" />
                      <span className={starter.split("\n").includes(item) ? "" : "font-medium text-accent"}>{item}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <div className="text-[24px] font-semibold tabular-nums tracking-tight">
                  {v.def.kind === "percent" ? value + "%" : v.def.key === "partner_threshold" || v.def.key === "variance_amount" ? "$" + Number(value).toLocaleString("en-US") : value}
                  {v.override ? <span className="ml-2 text-[12px] font-normal text-muted">was {v.def.kind === "percent" ? starter + "%" : starter}</span> : null}
                </div>
              )}
              <KV className="mt-3" rows={[["Used by", v.def.usedBy], ...(v.override ? ([["Changed", fmtDateTime(v.override.at) + " by " + v.override.actorName], ["Reason", String(v.override.body.text ?? "")]] as [string, string][]) : [])]} />
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
          <p className="px-4 py-3 text-[13px] text-muted">No changes yet; the starter standards are in force.</p>
        )}
      </Card>
    </>
  );
}
