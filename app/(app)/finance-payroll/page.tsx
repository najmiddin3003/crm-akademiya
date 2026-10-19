import SalaryCreatePage from "@/components/finance/SalaryCreatePage";
import PayrollV2 from "@/components/v2/finance/PayrollV2";
import { currentUiVersion } from "@/lib/uiVersionServer";

// Yangi versiyada (lib/uiVersion.ts, cookie `tizimli_ui`) — yangi dizayndagi
// Oylik chiqarish (components/v2/finance/PayrollV2.tsx). Hisob, filtr va
// chiqarish so'rovi ikkalasida bitta (components/finance/usePayroll.ts).
// Versiya serverda tanlanadi — miltillashsiz.
export default async function Page() {
  return (await currentUiVersion()) === "v2" ? <PayrollV2 /> : <SalaryCreatePage />;
}
