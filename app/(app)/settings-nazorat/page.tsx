import { redirect } from "next/navigation";
import AttendanceAlertV2 from "@/components/v2/settings/AttendanceAlertV2";
import SettingsFrameV2 from "@/components/v2/settings/SettingsFrameV2";
import { requireAdmin } from "@/lib/adminOnly";
import { getCurrentUser } from "@/lib/auth";
import { ensureIndexes } from "@/lib/mongodb";
import { resolveDesk } from "@/lib/staffDesk";
import { currentUiVersion } from "@/lib/uiVersionServer";

// «Sozlamalar → Nazorat qoidalari» (06.11.2026) — davomat qilinmagan guruhlar haqida rahbarga xabar.
// FAQAT ADMIN: sahifa ruxsatlar daraxtida yo'q, cheklovsiz rol uchun yagona to'siq shu tekshiruv
// (/amallar-jurnali bilan bir xil). API ham o'zi tekshiradi (app/api/attendance-alert/route.ts).
// Yon menyudagi bandi ikkala versiyada (components/shared/sidebarModel.ts → ADMIN_MENU_ITEMS).
export default async function Page({ searchParams }: { searchParams: Promise<{ korish?: string }> }) {
  // 47-qism: menejer (rol nomi «Menejer») — FAQAT KO'RISH, yangi versiyada; qolganlar — faqat admin.
  // Rahbar `?korish=menejer` bilan menejer ko'radigan holatni tekshiradi.
  let readOnly = (await searchParams).korish === "menejer";
  if (!(await requireAdmin())) {
    const me = await getCurrentUser();
    const desk = me ? await resolveDesk(await ensureIndexes(), me) : null;
    if (desk?.mode !== "manager" || (await currentUiVersion()) !== "v2") redirect("/home");
    readOnly = true;
  }
  if ((await currentUiVersion()) === "v2") {
    return (
      <SettingsFrameV2 current="/settings-nazorat">
        <AttendanceAlertV2 readOnly={readOnly} />
      </SettingsFrameV2>
    );
  }
  // Eski versiya: yangi sozlamalar ramkasi yo'q, karta o'zi. v2 tokenlari faqat shu belgi ichida ishlaydi.
  return (
    <div data-ui="v2" className="text-v2-text">
      <AttendanceAlertV2 />
    </div>
  );
}
