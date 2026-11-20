import SurveysPage from "@/components/sales/SurveysPage";
import MarketingSurveysV2 from "@/components/v2/sales/MarketingSurveysV2";
import { currentUiVersion } from "@/lib/uiVersionServer";

// Yangi versiyada (lib/uiVersion.ts, cookie `tizimli_ui`) — yangi dizayndagi «Marketing»
// (components/v2/sales/MarketingSurveysV2.tsx, 53-qism, 20.11.2026: lid manbalari va kodlari,
// qo'shish/tahrirlash oynasi). Eski versiyada — SurveysPage o'zgarmadi. Ma'lumot ikkalasida
// bitta: /api/surveys. Versiya serverda tanlanadi — miltillashsiz.
export default async function Page() {
  return (await currentUiVersion()) === "v2" ? <MarketingSurveysV2 /> : <SurveysPage />;
}
