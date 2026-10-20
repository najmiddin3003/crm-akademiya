import { Suspense } from "react";
import LeadsPage from "@/components/leads/LeadsPage";
import LeadsV2 from "@/components/v2/leads/LeadsV2";
import { getCurrentUser } from "@/lib/auth";
import { hasSectionPermission } from "@/lib/permissions";
import { currentUiVersion } from "@/lib/uiVersionServer";
import "./leads.css";

// Lidlar ro'yxati (sidebar: Lidlar → Lidlar ro'yxati). 23.09.2026 dan
// foydalanuvchi prototipi bo'yicha yangi sahifa (components/leads/LeadsPage.tsx)
// — eski «Buyurtmalar ro'yxati» o'rnida, ma'lumot o'sha (`orders`).
//
// Yangi versiyada (lib/uiVersion.ts, cookie `tizimli_ui`) — yangi dizayndagi
// ro'yxat va lid paneli (components/v2/leads/LeadsV2.tsx, 20.10.2026); ma'lumot,
// holat o'tishlari va so'rovlar ikkalasida bir xil (components/leads/
// useLeadsCore.ts, leadsExport.ts). Versiya serverda tanlanadi — miltillashsiz.
//
// Rol serverda aniqlanadi: direktor (admin) 10 daqiqadan keyin ham holatni
// orqaga qaytara oladi (server ham tekshiradi — /api/orders/:id/holat),
// Sotuv va marketing sozlamasi ruxsati borlarga «Lidlar sozlamalari» tugmasi.
// useSearchParams() (`?add=1`) Suspense chegarasini talab qiladi.
export default async function Page() {
  const [me, version] = await Promise.all([getCurrentUser(), currentUiVersion()]);
  const isAdmin = me?.role === "admin";
  const canSettings = isAdmin || (me ? hasSectionPermission("/settings-sales", me.permissions) : false);
  return (
    <Suspense fallback={null}>
      {version === "v2" ? <LeadsV2 isAdmin={isAdmin} canSettings={canSettings} /> : <LeadsPage isAdmin={isAdmin} canSettings={canSettings} />}
    </Suspense>
  );
}
