import FinanceAnalyticsPage from "@/components/finance/FinanceAnalyticsPage";
import FinanceCashflowV2 from "@/components/v2/finance/FinanceCashflowV2";
import { currentUiVersion } from "@/lib/uiVersionServer";

// Yangi versiyada (cookie `tizimli_ui`) — yangi dizayndagi «Kirim chiqim»
// (components/v2/finance/FinanceCashflowV2.tsx, 28-qism): Kirim / Chiqim / Bonus / Jarima
// kataklari va turlar jadvali — eski sahifa bilan bir xil ma'lumot va hisob. Eski
// versiyada — o'zgarishsiz. Versiya serverda tanlanadi — miltillashsiz.
export default async function Page() {
  return (await currentUiVersion()) === "v2" ? <FinanceCashflowV2 /> : <FinanceAnalyticsPage />;
}
