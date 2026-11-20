import { CancelledPaymentsPageV1 } from "@/components/reports/reportTableLegacy";
import { CancelledPaymentsV2 } from "@/components/v2/reports/reportTablePages";
import { shortPersonName } from "@/components/v2/reports/reportFormat";
import { getCurrentUser } from "@/lib/auth";
import { currentUiVersion } from "@/lib/uiVersionServer";

// Hisobotlar → Bekor qilingan to'lovlar (href /reports-cancelled).
// Yangi versiyada (cookie `tizimli_ui`) — yangi dizaynda (components/v2/reports/reportTablePages.tsx,
// 51-qism, 20.11.2026): o'sha /api/student-reports?kind=cancelled-payments, qidiruv/O'qituvchi/Guruh,
// Excel/PDF. Eski versiyada — o'zgarishsiz (kod components/reports/reportTableLegacy.tsx ga aynan
// ko'chdi). Versiya serverda tanlanadi — miltillashsiz.
export default async function Page() {
  return (await currentUiVersion()) === "v2" ? (
    <CancelledPaymentsV2 author={shortPersonName((await getCurrentUser())?.fullName || "")} />
  ) : (
    <CancelledPaymentsPageV1 />
  );
}
