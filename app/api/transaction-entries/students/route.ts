import { NextResponse } from "next/server";
import { ensureIndexes } from "@/lib/mongodb";

// GET /api/transaction-entries/students — tranzaksiyalarda uchraydigan
// TAKRORLANMAS o'quvchi ismlari (Moliya → Tranzaksiyalar sahifasidagi
// "O'quvchi" filtri uchun).
//
// Ilgari bu ro'yxat butun jadvalni (25 569 qator, ~11 MB) yuklab, klientda
// `new Set(...)` bilan chiqarilardi. Bu yerda Mongo `distinct` bajaradi —
// 3 357 ism, ~73 KB.
// Ixtiyoriy filtrlar (Xodim profilidagi "O'quvchi" tanlovi uchun):
//   ?moderator=<ism>  — faqat shu xodim qayd etgan to'lovlardagi ismlar
//   ?txType=payIn     — faqat shu turdagi yozuvlar
// Parametrsiz chaqirilsa javob avvalgidek — butun ro'yxat, ya'ni Moliya →
// Tranzaksiyalar sahifasi o'zgarishsiz ishlaydi.
function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

const TX_TYPES = ["payIn", "payOut", "transfer"];

export async function GET(req: Request) {
  const sp = new URL(req.url).searchParams;
  const filter: Record<string, unknown> = { studentName: { $nin: ["", null] } };

  const moderator = (sp.get("moderator") || "").trim();
  // app/api/transaction-entries/route.ts dagi nameFilter bilan AYNAN bir xil
  // qoida: chetlari kesilgan, katta-kichik harf farq qilmaydi.
  if (moderator) filter.moderator = { $regex: `^${escapeRegex(moderator)}$`, $options: "i" };

  // ?teacherName=<ism> — USTOZNING o'quvchilari (xodim profilidagi
  // "O'quvchi" tanlovi o'qituvchida shu manbadan to'ladi). Kassir kesimi
  // `moderator` da qoladi — ikkalasi boshqa-boshqa savol.
  const teacherName = (sp.get("teacherName") || "").trim();
  if (teacherName) filter.teacherName = { $regex: `^${escapeRegex(teacherName)}$`, $options: "i" };

  const txType = sp.get("txType");
  if (txType) {
    if (!TX_TYPES.includes(txType)) {
      return NextResponse.json({ ok: false, error: "Noto'g'ri txType" }, { status: 400 });
    }
    filter.txType = txType;
  }

  const db = await ensureIndexes();
  const names = await db.collection("transaction_entries").distinct("studentName", filter);
  names.sort();
  return NextResponse.json({ ok: true, students: names });
}
