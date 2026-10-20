import FinancialAnalyticsPage from "@/components/finance/FinancialAnalyticsPage";
import FinanceAnalyticsV2 from "@/components/v2/finance/FinanceAnalyticsV2";
import { currentUiVersion } from "@/lib/uiVersionServer";

// Yangi versiyada (lib/uiVersion.ts, cookie `tizimli_ui`) — yangi dizayndagi Moliya
// analitikasi (components/v2/finance/FinanceAnalyticsV2.tsx, 20.10.2026: tushum,
// chiqim, sof foyda, oyma-oy grafik, lid → o'quvchi, hisobot yuklab olish). Eski
// versiyada — Kalendar / Journal / Pul oqimi tablari o'zgarmadi. Versiya serverda
// tanlanadi — miltillashsiz.
export default async function Page() {
  return (await currentUiVersion()) === "v2" ? <FinanceAnalyticsV2 /> : <FinancialAnalyticsPage />;
}
