import { redirect } from "next/navigation";

export default async function ReturnIndex({ searchParams }: { searchParams: Promise<{ v?: string }> }) {
  const { v } = await searchParams;
  redirect("/return/F1040" + (v ? "?v=" + encodeURIComponent(v) : ""));
}
