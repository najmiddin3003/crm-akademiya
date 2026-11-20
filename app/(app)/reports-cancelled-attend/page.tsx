import { CancelledAttendPageV1 } from "@/components/reports/reportTableLegacy";
import { CancelledAttendV2 } from "@/components/v2/reports/reportTablePages";
import { shortPersonName } from "@/components/v2/reports/reportFormat";
import { getCurrentUser } from "@/lib/auth";
import { currentUiVersion } from "@/lib/uiVersionServer";

// Hisobotlar → Davomati bekor qilinganlar analitikasi (href /reports-cancelled-attend).
// Yangi versiyada (cookie `tizimli_ui`) — yangi dizaynda (components/v2/reports/reportTablePages.tsx,
// 51-qism, 20.11.2026): o'sha /api/student-reports?kind=cancelled-attendance, qidiruv/Kurs/«Kim bekor
// qildi?» (+ kim bo'yicha qator), Excel/PDF. Eski versiyada — o'zgarishsiz (kod
// components/reports/reportTableLegacy.tsx ga aynan ko'chdi). Versiya serverda tanlanadi.
export default async function Page() {
  return (await currentUiVersion()) === "v2" ? (
    <CancelledAttendV2 author={shortPersonName((await getCurrentUser())?.fullName || "")} />
  ) : (
    <CancelledAttendPageV1 />
  );
}
