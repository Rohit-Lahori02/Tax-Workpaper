import Link from "next/link";

export default function NotFound() {
  return (
    <div className="grid gap-2">
      <h1 className="text-xl font-semibold">Nothing in the packet matches that reference</h1>
      <p className="text-sm text-muted">
        References look like ev-0703, F1040.11, D30, qa-14, asset:SAC-BLDG or py:/carryovers_into_2025.
      </p>
      <Link href="/" className="text-sm text-accent hover:underline">
        Back to the overview
      </Link>
    </div>
  );
}
