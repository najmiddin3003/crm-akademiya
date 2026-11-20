import SmsTemplatesPage from "@/components/sales/SmsTemplatesPage";
import SmsTemplatesV2 from "@/components/v2/sales/SmsTemplatesV2";
import { currentUiVersion } from "@/lib/uiVersionServer";

// Yangi versiyada (lib/uiVersion.ts, cookie `tizimli_ui`) — yangi dizayndagi «SMS shablonlari»
// (components/v2/sales/SmsTemplatesV2.tsx, 53-qism, 20.11.2026). Eski versiyada —
// SmsTemplatesPage o'zgarmadi. Ma'lumot ikkalasida bitta: /api/sms-templates. Versiya serverda
// tanlanadi — miltillashsiz.
export default async function Page() {
  return (await currentUiVersion()) === "v2" ? <SmsTemplatesV2 /> : <SmsTemplatesPage />;
}
