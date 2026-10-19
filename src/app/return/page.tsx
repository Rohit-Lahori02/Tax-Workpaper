import { redirect } from "next/navigation";
import { staffOnlyPage } from "@/lib/page-guards";

export default async function ReturnIndex({ searchParams }: { searchParams: Promise<{ v?: string }> }) {
  await staffOnlyPage();
  const { v } = await searchParams;
  redirect("/return/F1040" + (v ? "?v=" + encodeURIComponent(v) : ""));
}
