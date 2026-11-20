import FinanceReportsPage from "@/components/finance/FinanceReportsPage";
import FinanceReportsV2 from "@/components/v2/finance/FinanceReportsV2";
import { currentUiVersion } from "@/lib/uiVersionServer";

// Yangi versiyada (cookie `tizimli_ui`) — yangi dizayndagi «Moliya hisobotlari»
// (components/v2/finance/FinanceReportsV2.tsx, 28-qism): Kirim / Chiqim / Qoldiq,
// kunma-kun grafik va turlar / to'lov usullari taqsimoti — eski sahifa bilan bir xil
// so'rovlar va hisob. Eski versiyada — o'zgarishsiz. Versiya serverda tanlanadi.
export default async function Page() {
  return (await currentUiVersion()) === "v2" ? <FinanceReportsV2 /> : <FinanceReportsPage />;
}
