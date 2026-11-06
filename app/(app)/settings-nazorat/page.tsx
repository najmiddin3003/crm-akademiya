import { redirect } from "next/navigation";
import AttendanceAlertV2 from "@/components/v2/settings/AttendanceAlertV2";
import SettingsFrameV2 from "@/components/v2/settings/SettingsFrameV2";
import { requireAdmin } from "@/lib/adminOnly";
import { currentUiVersion } from "@/lib/uiVersionServer";

// «Sozlamalar → Nazorat qoidalari» (06.11.2026) — davomat qilinmagan guruhlar haqida rahbarga xabar.
// FAQAT ADMIN: sahifa ruxsatlar daraxtida yo'q, cheklovsiz rol uchun yagona to'siq shu tekshiruv
// (/amallar-jurnali bilan bir xil). API ham o'zi tekshiradi (app/api/attendance-alert/route.ts).
// Yon menyudagi bandi faqat yangi versiyada (components/v2/shell/sidebarSections.ts → V2_INSERTED_ITEMS).
export default async function Page() {
  if (!(await requireAdmin())) redirect("/home");
  if ((await currentUiVersion()) !== "v2") redirect("/settings-general");
  return (
    <SettingsFrameV2 current="/settings-nazorat">
      <AttendanceAlertV2 />
    </SettingsFrameV2>
  );
}
