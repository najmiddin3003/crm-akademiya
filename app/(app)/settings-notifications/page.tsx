import { redirect } from "next/navigation";
import NotificationRulesV2 from "@/components/v2/settings/NotificationRulesV2";
import SettingsFrameV2 from "@/components/v2/settings/SettingsFrameV2";
import { requireAdmin } from "@/lib/adminOnly";
import { currentUiVersion } from "@/lib/uiVersionServer";

// «Sozlamalar → Umumiy → Bildirishnomalar» (23-qism, 13.11.2026) — qaysi hodisa kimga boradi.
// FAQAT ADMIN: sahifa ruxsatlar daraxtida yo'q, cheklovsiz rol uchun yagona to'siq shu tekshiruv
// (/settings-nazorat bilan bir xil). API ham o'zi tekshiradi (app/api/notification-rules/route.ts).
export default async function Page() {
  if (!(await requireAdmin())) redirect("/home");
  if ((await currentUiVersion()) === "v2") {
    return (
      <SettingsFrameV2 current="/settings-notifications">
        <NotificationRulesV2 />
      </SettingsFrameV2>
    );
  }
  // Eski versiya: yangi sozlamalar ramkasi yo'q, sahifa o'zi. v2 tokenlari faqat shu belgi ichida ishlaydi.
  return (
    <div data-ui="v2" className="text-v2-text">
      <NotificationRulesV2 />
    </div>
  );
}
