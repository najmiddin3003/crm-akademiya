import CashFlowStatementPage from "@/components/finance/CashFlowStatementPage";
import CashFlowStatementV2 from "@/components/v2/finance/CashFlowStatementV2";
import { currentUiVersion } from "@/lib/uiVersionServer";

// Yangi versiyada (cookie `tizimli_ui`) — yangi dizayndagi «Pul oqimi»
// (components/v2/finance/CashFlowStatementV2.tsx, 28-qism): yil / oy, boshlang'ich va yakuniy
// balans, operatsion faoliyat turlari bilan — eski sahifa bilan bir xil so'rov, hisob va
// Excel fayli. Eski versiyada — o'zgarishsiz. Versiya serverda tanlanadi.
export default async function Page() {
  return (await currentUiVersion()) === "v2" ? <CashFlowStatementV2 /> : <CashFlowStatementPage />;
}
