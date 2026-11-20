import PenaltiesPage from "@/components/finance/PenaltiesPage";
import PenaltiesV2 from "@/components/v2/finance/PenaltiesV2";
import { currentUiVersion } from "@/lib/uiVersionServer";

// Yangi versiyada (cookie `tizimli_ui`) — Moliya → Jarima yangi dizaynda
// (components/v2/finance/PenaltiesV2.tsx, 20.11.2026): o'sha /api/penalties, qo'shish va
// «Bekor qilish» — oynada (so'rovlar o'sha). Eski versiyada — o'zgarmagan.
export default async function Page() {
  return (await currentUiVersion()) === "v2" ? <PenaltiesV2 /> : <PenaltiesPage />;
}
