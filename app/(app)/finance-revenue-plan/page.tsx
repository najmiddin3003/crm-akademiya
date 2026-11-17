import RevenuePlanPage from "@/components/finance/RevenuePlanPage";
import FinancialPlanV2 from "@/components/v2/finance/FinancialPlanV2";
import { PLAN_TABS } from "@/lib/financialPlanTypes";
import { currentUiVersion } from "@/lib/uiVersionServer";

// Moliya → Tushum rejasi. YANGI VERSIYA (17.11.2026, 32-qism): «Moliyaviy reja» — Tushum, Xarajat,
// Pul oqimi, Foyda va zarar tablari (components/v2/finance/FinancialPlanV2.tsx); `?classic=1` — eski sahifa.
export default async function Page({ searchParams }: { searchParams: Promise<{ classic?: string; tab?: string }> }) {
  const { classic, tab } = await searchParams;
  const initialTab = PLAN_TABS.find((x) => x.key === tab)?.key;
  if (classic !== "1" && (await currentUiVersion()) === "v2") return <FinancialPlanV2 initialTab={initialTab} />;
  return <RevenuePlanPage />;
}
