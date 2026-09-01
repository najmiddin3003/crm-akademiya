import { NextResponse } from "next/server";
import { ensureIndexes } from "@/lib/mongodb";
import { normalizePhone } from "@/lib/eskiz";
import { isRoleKey } from "@/lib/roles";

// GET /api/roles/coverage — Boshqaruv → Rollar sahifasidagi ogohlantirish
// paneli uchun.
//
// NIMA UCHUN KERAK: rolga ruxsat berish JIM ishlamay qolishi mumkin va buni
// ekrandan bilib bo'lmasdi. Zanjir uzun:
//
//   users.hrEmployeeId → hr_employees.turi → roles.key → permissions
//
// Uning istalgan bo'g'ini uzilsa `resolvePermissions` `null` qaytaradi,
// ya'ni xodim CHEKLOVSIZ bo'lib qoladi (lib/rolePermissions.ts — bu ataylab
// shunday: noto'g'ri sozlangan rol hech kimni tizimdan ajratib qo'ymasin).
// Amalda shunday holat bo'ldi: bitta odamga IKKITA xodim yozuvi bor edi,
// login esa `turi` maydoni BO'SH bo'lganiga bog'langan — admin Moderator
// roliga cheklov qo'ydi, lekin ekranda hech narsa o'zgarmadi va sabab
// ko'rinmasdi.
//
// Shu route uch xil "jim uzilish"ni sanab beradi. Hech narsani
// o'zgartirmaydi — faqat ko'rsatadi.
export async function GET() {
  const db = await ensureIndexes();
  const [users, roster] = await Promise.all([
    db.collection("users").find({}, { projection: { phone: 1, role: 1, hrEmployeeId: 1, status: 1 } }).toArray(),
    db
      .collection("hr_employees")
      .find({}, { projection: { id: 1, name: 1, turi: 1, phone: 1, archReason: 1 } })
      .toArray(),
  ]);

  // Arxivdagi xodim login ham, ruxsat ham talab qilmaydi.
  const active = roster.filter((e) => !String(e.archReason ?? "").trim());

  // Login xodimga IKKI yo'l bilan bog'lanadi — aynan resolvePermissions
  // dagi tartibda: avval `hrEmployeeId`, u yo'q bo'lsa telefon bo'yicha.
  const linkedIds = new Set<number>();
  const adminEmployeeIds = new Set<number>();
  for (const u of users) {
    const byId = Number(u.hrEmployeeId);
    let empId: number | null = Number.isFinite(byId) ? byId : null;
    if (empId === null && typeof u.phone === "string") {
      const hit = active.find((e) => typeof e.phone === "string" && normalizePhone(e.phone) === u.phone);
      empId = typeof hit?.id === "number" ? hit.id : null;
    }
    if (empId === null) continue;
    linkedIds.add(empId);
    if (u.role === "admin") adminEmployeeIds.add(empId);
  }

  const brief = (e: (typeof roster)[number]) => ({
    id: Number(e.id),
    name: String(e.name ?? ""),
    turi: String(e.turi ?? ""),
  });

  return NextResponse.json({
    ok: true,
    // Lavozimi `teacher`/`moderator` emas — rol ruxsatlari BU XODIMGA
    // umuman qo'llanmaydi, u hamma bo'limni ko'radi.
    unknownTuri: active.filter((e) => !isRoleKey(e.turi)).map(brief),
    // Lavozimi to'g'ri, lekin login hisobi yo'q — rolga qo'yilgan cheklovni
    // bu xodimda sinab ham bo'lmaydi.
    noLogin: active.filter((e) => isRoleKey(e.turi) && !linkedIds.has(Number(e.id))).map(brief),
    // `users.role === "admin"` zanjirdan ATAYLAB o'tib ketadi (aks holda
    // admin o'ziga Rollar sahifasini yopib qo'yishi mumkin edi). Ro'yxatda
    // ko'rinib tursin, aks holda "admin nega hammasini ko'ryapti?" degan
    // savol qayta-qayta tug'iladi.
    adminBypass: active.filter((e) => adminEmployeeIds.has(Number(e.id))).map(brief),
  });
}
