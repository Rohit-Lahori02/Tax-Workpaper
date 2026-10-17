"use client";

import { Printer } from "lucide-react";

export function PrintButton({ label = "Print or save as PDF" }: { label?: string }) {
  return (
    <button type="button" onClick={() => window.print()} className="pill h-8 print:hidden">
      <Printer className="h-3.5 w-3.5" /> {label}
    </button>
  );
}
