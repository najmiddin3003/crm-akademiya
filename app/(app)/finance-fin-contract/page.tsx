import FinanceContractsPage from "@/components/finance/FinanceContractsPage";
import ContractsV2 from "@/components/v2/finance/ContractsV2";
import { currentUiVersion } from "@/lib/uiVersionServer";

// Moliya → Shartnoma. YANGI VERSIYA (17.11.2026, 32-qism): «Shartnomalar» — o'quvchi bilan o'qish va to'lov
// shartnomalari reyestri (components/v2/finance/ContractsV2.tsx); `?classic=1` — eski to'lov bo'laklari sahifasi.
export default async function Page({ searchParams }: { searchParams: Promise<{ classic?: string }> }) {
  const { classic } = await searchParams;
  if (classic !== "1" && (await currentUiVersion()) === "v2") return <ContractsV2 />;
  return <FinanceContractsPage />;
}
