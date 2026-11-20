import PlannedExpensesPage from "@/components/finance/PlannedExpensesPage";
import PlannedExpensesV2 from "@/components/v2/finance/PlannedExpensesV2";
import { currentUiVersion } from "@/lib/uiVersionServer";

// Yangi versiyada (cookie `tizimli_ui`) — Moliya → Rejalashtirilgan xarajatlar yangi dizaynda
// (components/v2/finance/PlannedExpensesV2.tsx, 20.11.2026): o'sha /api/planned-expenses,
// qo'shish/tahrirlash — oynada, so'rov tanasi o'sha. Eski versiyada — o'zgarmagan.
export default async function Page() {
  return (await currentUiVersion()) === "v2" ? <PlannedExpensesV2 /> : <PlannedExpensesPage />;
}
