import CashboxesPage from "@/components/finance/CashboxesPage";
import CashboxesV2 from "@/components/v2/finance/CashboxesV2";
import { currentUiVersion } from "@/lib/uiVersionServer";

// Yangi versiyada (lib/uiVersion.ts, cookie `tizimli_ui`) — yangi dizayndagi
// Kassalar (components/v2/finance/CashboxesV2.tsx); amallar, oynalar va API
// ikkalasida bir xil. Versiya serverda tanlanadi — miltillashsiz.
export default async function Page() {
  return (await currentUiVersion()) === "v2" ? <CashboxesV2 /> : <CashboxesPage />;
}
