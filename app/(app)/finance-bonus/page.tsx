import BonusesPage from "@/components/finance/BonusesPage";
import BonusesV2 from "@/components/v2/finance/BonusesV2";
import { currentUiVersion } from "@/lib/uiVersionServer";

// Yangi versiyada (cookie `tizimli_ui`) — Moliya → Bonus yangi dizaynda
// (components/v2/finance/BonusesV2.tsx, 20.11.2026): o'sha /api/bonuses, o'sha eksport,
// yaratish — oynada (so'rov tanasi o'sha). Eski versiyada — o'zgarmagan.
export default async function Page() {
  return (await currentUiVersion()) === "v2" ? <BonusesV2 /> : <BonusesPage />;
}
