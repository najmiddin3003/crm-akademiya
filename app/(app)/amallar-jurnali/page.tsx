import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/adminOnly";
import ActionLogPage from "@/components/admin/ActionLogPage";
import ActionLogV2 from "@/components/v2/actionLog/ActionLogV2";
import { currentUiVersion } from "@/lib/uiVersionServer";

// «Amallar jurnali» — CRM'da kim, qachon, nima qilgani (lib/actionLog.ts,
// 10.10.2026). FAQAT ADMIN: jurnalda hamma xodimning amali, IP va qurilmasi.
//
// Qo'riqchi shu yerda — /vaqtinchalik bilan bir xil sabab (u yerdagi
// izohga qarang): sahifa ruxsatlar daraxtida yo'q (`adminOnly`), shu bois
// cheklovsiz rol uchun yagona to'siq mana shu tekshiruv. API ham o'zi
// tekshiradi (app/api/action-log/route.ts, …/feed/route.ts).
//
// YANGI VERSIYA (25.10.2026, 14-qism — rasm «Amallar jurnali»): odam tilidagi yozuvlar, toifalar,
// «oldin → keyin» (components/v2/actionLog/ActionLogV2.tsx); `?classic=1` — eski texnik jadval.
export default async function Page({ searchParams }: { searchParams: Promise<{ classic?: string }> }) {
  if (!(await requireAdmin())) redirect("/home");
  const { classic } = await searchParams;
  if (classic !== "1" && (await currentUiVersion()) === "v2") return <ActionLogV2 />;
  return <ActionLogPage />;
}
