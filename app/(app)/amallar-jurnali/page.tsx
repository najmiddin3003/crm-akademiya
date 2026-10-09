import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/adminOnly";
import ActionLogPage from "@/components/admin/ActionLogPage";

// «Amallar jurnali» — CRM'da kim, qachon, nima qilgani (lib/actionLog.ts,
// 10.10.2026). FAQAT ADMIN: jurnalda hamma xodimning amali, IP va qurilmasi.
//
// Qo'riqchi shu yerda — /vaqtinchalik bilan bir xil sabab (u yerdagi
// izohga qarang): sahifa ruxsatlar daraxtida yo'q (`adminOnly`), shu bois
// cheklovsiz rol uchun yagona to'siq mana shu tekshiruv. API ham o'zi
// tekshiradi (app/api/action-log/route.ts).
export default async function Page() {
  if (!(await requireAdmin())) redirect("/home");
  return <ActionLogPage />;
}
