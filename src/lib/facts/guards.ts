import { filingState, frozenReason } from "@/lib/season";
import { getLedger } from "./repo";

/** The reason the return may not change right now (transmitted or filed with no amendment open), or null. */
export async function frozenMessage(): Promise<string | null> {
  const { ledger } = await getLedger();
  return frozenReason(filingState(ledger));
}
