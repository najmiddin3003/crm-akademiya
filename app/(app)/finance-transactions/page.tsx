import TransactionEntriesPage from "@/components/finance/TransactionEntriesPage";
import TransactionEntriesV2 from "@/components/v2/finance/TransactionEntriesV2";
import { currentUiVersion } from "@/lib/uiVersionServer";

// Yangi versiyada (cookie `tizimli_ui`) — Moliya → Tranzaksiyalar jurnali yangi dizaynda
// (components/v2/finance/TransactionEntriesV2.tsx, 20.11.2026): o'sha API va filtrlar,
// serverda sahifalash. Eski versiyada — o'zgarmagan. Versiya serverda tanlanadi — miltillashsiz.
export default async function Page() {
  return (await currentUiVersion()) === "v2" ? <TransactionEntriesV2 /> : <TransactionEntriesPage />;
}
