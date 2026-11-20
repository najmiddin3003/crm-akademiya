import PnlReportsPage from "@/components/finance/PnlReportsPage";
import PnlReportsV2 from "@/components/v2/finance/PnlReportsV2";
import { currentUiVersion } from "@/lib/uiVersionServer";

// Yangi versiyada (cookie `tizimli_ui`) — yangi dizayndagi «Moliya hisobotlari (P&L)»
// (components/v2/finance/PnlReportsV2.tsx, 28-qism): yil / oy, ko'rsatkichlar va foyda-zarar
// jadvali — eski sahifa bilan bir xil so'rov, hisob va Excel fayli. Eski versiyada —
// o'zgarishsiz. Versiya serverda tanlanadi.
export default async function Page() {
  return (await currentUiVersion()) === "v2" ? <PnlReportsV2 /> : <PnlReportsPage />;
}
