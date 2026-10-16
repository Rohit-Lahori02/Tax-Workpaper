import Link from "next/link";
import { PageHeader } from "@/components/page-header";

export default function NotFound() {
  return (
    <>
      <PageHeader
        title="Nothing in the packet matches that reference"
        description="References look like F1040.11, ev-0703, D30, qa-14, asset:SAC-BLDG or py:/carryovers_into_2025."
      />
      <Link href="/" className="text-[13px] text-accent hover:underline">
        Back to the overview
      </Link>
    </>
  );
}
