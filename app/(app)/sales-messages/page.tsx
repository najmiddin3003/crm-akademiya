import SmsMessagesPage from "@/components/sales/SmsMessagesPage";
import SmsMessagesV2 from "@/components/v2/sales/SmsMessagesV2";
import { currentUiVersion } from "@/lib/uiVersionServer";

// Yangi versiyada (lib/uiVersion.ts, cookie `tizimli_ui`) — yangi dizayndagi «Xabarlar ro'yhati»
// (components/v2/sales/SmsMessagesV2.tsx, 53-qism, 20.11.2026; faqat ko'rish). Eski versiyada —
// SmsMessagesPage o'zgarmadi. Ma'lumot ikkalasida bitta: /api/sms-messages. Versiya serverda
// tanlanadi — miltillashsiz.
export default async function Page() {
  return (await currentUiVersion()) === "v2" ? <SmsMessagesV2 /> : <SmsMessagesPage />;
}
