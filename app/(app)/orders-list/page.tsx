import { Suspense } from "react";
import LeadsPage from "@/components/leads/LeadsPage";
import { getCurrentUser } from "@/lib/auth";
import { hasSectionPermission } from "@/lib/permissions";
import "./leads.css";

// Lidlar ro'yxati (sidebar: Lidlar → Lidlar ro'yxati). 23.09.2026 dan
// foydalanuvchi prototipi bo'yicha yangi sahifa (components/leads/LeadsPage.tsx)
// — eski «Buyurtmalar ro'yxati» o'rnida, ma'lumot o'sha (`orders`).
//
// Rol serverda aniqlanadi: direktor (admin) 10 daqiqadan keyin ham holatni
// orqaga qaytara oladi (server ham tekshiradi — /api/orders/:id/holat),
// Sotuv va marketing sozlamasi ruxsati borlarga «Lidlar sozlamalari» tugmasi.
// useSearchParams() (`?add=1`) Suspense chegarasini talab qiladi.
export default async function Page() {
  const me = await getCurrentUser();
  const isAdmin = me?.role === "admin";
  const canSettings = isAdmin || (me ? hasSectionPermission("/settings-sales", me.permissions) : false);
  return (
    <Suspense fallback={null}>
      <LeadsPage isAdmin={isAdmin} canSettings={canSettings} />
    </Suspense>
  );
}
