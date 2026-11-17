import SalesPlanPage from "@/components/sales/SalesPlanPage";
import SalesPlanV2 from "@/components/v2/sales/SalesPlanV2";
import { currentUiVersion } from "@/lib/uiVersionServer";

// Sotuv va marketing → Savdo plani. YANGI VERSIYA (17.11.2026, 36-qism): har admin uchun oylik yangi o'quvchi
// rejasi va bajarilishi (components/v2/sales/SalesPlanV2.tsx); `?classic=1` — eski sahifa.
export default async function Page({ searchParams }: { searchParams: Promise<{ classic?: string }> }) {
  const { classic } = await searchParams;
  if (classic !== "1" && (await currentUiVersion()) === "v2") return <SalesPlanV2 />;
  return <SalesPlanPage />;
}
