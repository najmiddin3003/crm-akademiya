import { NextResponse } from "next/server";
import { ensureIndexes } from "@/lib/mongodb";
import { requireAdmin } from "@/lib/adminOnly";
import { normalizePhone } from "@/lib/eskiz";
import { MAX_BATCH } from "./invite/route";

// "Vaqtinchalik tugma" sahifasining backend'i (app/(app)/vaqtinchalik).
//
// NIMA UCHUN ALOHIDA ROUTE, /api/hr-employees BOR TURIB:
//
//  1. QAMROV. `/api/hr-employees` ro'yxatni JORIY FILIAL bo'yicha kesadi —
//     admin uchun ham (lib/employeeBranches.ts dagi izohga qarang, bu ongli
//     qaror). Bu sahifaning butun ma'nosi esa TO'RTALA filialni bir ekranda
//     ko'rish, ya'ni o'sha qoidaga zid. Mavjud route'ni "adminga kesmaslik"
//     qilib o'zgartirish — o'sha qarorni butun tizim bo'ylab bekor qilish
//     bo'lardi, shu bois qamrovsiz ko'rinish shu yerda, ALOHIDA turadi.
//
//  2. RUXSAT. Bu ro'yxat faqat adminga ochiq. Bo'lim ruxsatlari daraxti
//     (Boshqaruv → Rollar) "kim admin" degan savolga javob bermaydi —
//     lib/adminOnly.ts izohiga qarang.
//
// DIQQAT: `/api/temp-staff` `lib/apiPermissions.generated.ts` jadvalida
// YO'Q, ya'ni proxy undan faqat SESSIYA talab qiladi. Shu sababli adminlik
// tekshiruvi handler ichida — u yagona to'siq.

/** Xodim yozuvining shu sahifada ko'rinadigan qismi. */
export interface TempStaffRow {
  id: number;
  name: string;
  phone: string;
  turi: string;
  email: string;
  branchIds: number[];
  archReason: string;
  archDate: string;
  created: string;
  /**
   * "Ikki bosqichli tasdiqlash" — `hr_employees.twoFactor`.
   *
   * DIQQAT: qiymat rost saqlanadi, lekin login oqimi
   * (app/api/auth/login) uni HOZIRCHA O'QIMAYDI. Sahifada shu ochiq
   * aytiladi — aks holda tugmacha xavfsizlik bergandek ko'rinardi.
   */
  twoFactor: boolean;
  /**
   * Shu telefonda `users` hujjati bormi.
   *
   * Sahifaning maqsadi uchun eng muhim ustun: xodim qo'shishda 409 "Bu
   * telefon raqami allaqachon ro'yxatdan o'tgan" xatosini AYNAN shu hujjat
   * beradi (app/api/hr-employees/route.ts). Ustun bo'lmasa "nega raqamim
   * band?" degan savolga ekrandan javob topib bo'lmasdi.
   */
  accountStatus: string | null;
}

export async function GET() {
  if (!(await requireAdmin())) {
    return NextResponse.json({ ok: false, error: "Bu sahifa faqat admin uchun" }, { status: 403 });
  }
  const db = await ensureIndexes();

  const [rows, branchRows, userRows] = await Promise.all([
    db.collection("hr_employees").find({}).sort({ id: -1 }).toArray(),
    db.collection("branches").find({}, { projection: { _id: 0, id: 1, name: 1 } }).sort({ id: 1 }).toArray(),
    // Telefon bo'yicha bog'lanadi, `hrEmployeeId` bo'yicha emas: importda
    // qo'shilgan xodimda `users` yozuvi umuman yo'q, qo'lda yaratilgan
    // hisobda esa `hrEmployeeId` bo'lmasligi mumkin. Raqamni BAND QILADIGAN
    // narsa — aynan `users.phone`.
    db.collection("users").find({}, { projection: { _id: 0, phone: 1, status: 1 } }).toArray(),
  ]);

  // Kalit NORMALLASHTIRILGAN raqam. Bugungi bazada ikkala kolleksiya ham
  // 12 xonali shaklda (o'lchandi: 57 xodimdan 0 tasi farq qilmadi), lekin
  // eski yozuvlarda `hr_employees.phone` 9 xonali va bo'shliqli bo'lishi
  // mumkin (components/auth/PhoneField.tsx izohi) — aynan tenglik bunday
  // qatorni "hisobi yo'q" deb ko'rsatib qo'yardi.
  const statusByPhone = new Map<string, string>();
  for (const u of userRows) {
    const phone = normalizePhone(String(u.phone ?? ""));
    if (phone) statusByPhone.set(phone, String(u.status ?? "—"));
  }

  const employees: TempStaffRow[] = rows.map((r) => ({
    id: Number(r.id),
    name: String(r.name ?? ""),
    phone: String(r.phone ?? ""),
    turi: String(r.turi ?? ""),
    email: String(r.email ?? ""),
    branchIds: Array.isArray(r.branchIds) ? r.branchIds.map(Number).filter(Number.isFinite) : [],
    archReason: String(r.archReason ?? ""),
    archDate: String(r.archDate ?? ""),
    created: String(r.created ?? ""),
    twoFactor: Boolean(r.twoFactor),
    accountStatus: statusByPhone.get(normalizePhone(String(r.phone ?? ""))) ?? null,
  }));

  const branches = branchRows.map((b) => ({ id: Number(b.id), name: String(b.name ?? `Filial ${b.id}`) }));
  // Partiya chegarasi SERVERDA belgilanadi va shu yerda klientga
  // uzatiladi — ikki joyda ikki xil son turib qolmasin. Klient uni faqat
  // OGOHLANTIRISH uchun ishlatadi, majburlash baribir /invite da.
  return NextResponse.json({ ok: true, employees, branches, maxBatch: MAX_BATCH });
}
