import { DiffPaymentsPageV1 } from "@/components/reports/reportTableLegacy";
import { DiffPaymentsV2 } from "@/components/v2/reports/reportTablePages";
import { shortPersonName } from "@/components/v2/reports/reportFormat";
import { getCurrentUser } from "@/lib/auth";
import { currentUiVersion } from "@/lib/uiVersionServer";

// Hisobotlar → Kurs narxidan farqli to'lovlar (href /reports-diff-payments).
// Yangi versiyada (cookie `tizimli_ui`) — yangi dizaynda (components/v2/reports/reportTablePages.tsx,
// 51-qism, 20.11.2026): o'sha /api/student-reports?kind=price-diff, qidiruv/Turi/Guruh, Excel/PDF.
// Eski versiyada — o'zgarishsiz (kod components/reports/reportTableLegacy.tsx ga aynan ko'chdi).
// Versiya serverda tanlanadi — miltillashsiz; `author` — PDF/Excel'dagi «kim tayyorlagani».
export default async function Page() {
  return (await currentUiVersion()) === "v2" ? (
    <DiffPaymentsV2 author={shortPersonName((await getCurrentUser())?.fullName || "")} />
  ) : (
    <DiffPaymentsPageV1 />
  );
}
