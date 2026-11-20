import ServedReportPage from "@/components/reports/ServedReportPage";
import ServedReportV2 from "@/components/v2/reports/ServedReportV2";
import { shortPersonName } from "@/components/v2/reports/reportFormat";
import { getCurrentUser } from "@/lib/auth";
import { currentUiVersion } from "@/lib/uiVersionServer";

// Hisobotlar → O'quv markazga ishlab berilgan (href /reports-served; referensdagi sarlavha
// "O'qituvchilar oylik to'lov analitikasi").
// Yangi versiyada (cookie `tizimli_ui`) — yangi dizaynda (components/v2/reports/ServedReportV2.tsx,
// 51-qism, 20.11.2026): o'sha /api/transaction-entries/served-summary, /api/groups, /api/teachers va
// o'sha hisob (components/v2/reports/servedReportCalc.ts). Eski versiyada — o'zgarishsiz (kod
// components/reports/ServedReportPage.tsx ga aynan ko'chdi). Versiya serverda tanlanadi — miltillashsiz.
export default async function Page() {
  return (await currentUiVersion()) === "v2" ? (
    <ServedReportV2 author={shortPersonName((await getCurrentUser())?.fullName || "")} />
  ) : (
    <ServedReportPage />
  );
}
