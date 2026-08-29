import { NextResponse } from "next/server";
import { ensureIndexes } from "@/lib/mongodb";
import { isValidPhone, normalizePhone } from "@/lib/invite";
import type { HrEmployee } from "@/lib/hrEmployees";
import { toUz } from "@/lib/uzTime";

// POST /api/hr-employees/import — bir nechta xodimni bir so'rovda qo'shadi.
//
// Boshqaruv → Xodimlar ro'yxatidagi "Import" tugmasi shu yerga yozadi.
// Ilgari o'sha tugma faqat "Import funksiyasi (demo)" toast'ini chiqarardi:
// na fayl tanlash, na endpoint bor edi.
//
// Naqsh app/api/groups/import/route.ts dan olingan. Kutilayotgan ustunlar —
// AYNAN shu sahifaning CSV eksporti chiqaradigan ustunlar, ya'ni eksport →
// tahrir → import zanjiri ishlaydi. "№", "Aktiv o'quvchilar" va "Guruhlar"
// o'qilmaydi: birinchisi qator raqami, qolgan ikkitasi guruh/o'quvchi
// yozuvlaridan kelib chiqadi — CSV'dan olsak, soxta son bo'lib qolardi.
//
// MUHIM: import faollashtirish SMS'ini YUBORMAYDI va `users` yozuvini
// yaratmaydi (POST /api/hr-employees dan farqi shu). Ommaviy importda
// o'nlab odamga SMS ketishi kutilmagan natija bo'lardi; taklif keyin
// alohida yuboriladi.

export interface ImportEmployeeRow {
  name?: string;
  gender?: string;
  turi?: string;
  filial?: string;
  phone?: string;
  kurs?: string;
  created?: string;
}

const str = (v: unknown) => String(v ?? "").trim();

// Eksport o'zbekcha yorliq yozadi — importda ichki qiymatga qaytaramiz.
// Ichki qiymatning o'zi ("male", "teacher") kelsa ham qabul qilinadi.
const GENDER_BY_LABEL: Record<string, string> = { erkak: "male", ayol: "female", male: "male", female: "female" };
const ROLE_BY_LABEL: Record<string, string> = {
  "o'qituvchi": "teacher", "oqituvchi": "teacher", teacher: "teacher",
  moderator: "moderator",
  administrator: "admin", admin: "admin",
};

function fmtNow(raw: Date): string {
  const d = toUz(raw);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(d.getDate())}.${p(d.getMonth() + 1)}.${d.getFullYear()} | ${p(d.getHours())}:${p(d.getMinutes())}`;
}

export async function POST(req: Request) {
  let body: { employees?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Noto'g'ri so'rov" }, { status: 400 });
  }

  const incoming = body.employees;
  if (!Array.isArray(incoming) || incoming.length === 0) {
    return NextResponse.json({ ok: false, error: "Import uchun qator topilmadi" }, { status: 400 });
  }
  if (incoming.length > 1000) {
    return NextResponse.json({ ok: false, error: "Bir martada 1000 tadan ko'p qator import qilib bo'lmaydi" }, { status: 400 });
  }

  const db = await ensureIndexes();
  const col = db.collection("hr_employees");

  const existing = await col.find({}, { projection: { id: 1, phone: 1 } }).toArray();
  // Telefon raqami — takrorlanmaydigan belgi. `users` da ham tekshiramiz:
  // o'sha raqam allaqachon faollashtirilgan bo'lishi mumkin.
  const takenPhones = new Set(existing.map((e) => normalizePhone(str(e.phone))));
  for (const u of await db.collection("users").find({}, { projection: { phone: 1 } }).toArray()) {
    takenPhones.add(normalizePhone(str(u.phone)));
  }
  let nextId = existing.reduce((max, e) => Math.max(max, Number(e.id) || 0), 0) + 1;

  const created: HrEmployee[] = [];
  const skipped: { row: number; reason: string }[] = [];

  for (let i = 0; i < incoming.length; i++) {
    const r = (incoming[i] ?? {}) as ImportEmployeeRow;
    const name = str(r.name);
    if (!name) {
      skipped.push({ row: i + 1, reason: "Ism bo'sh" });
      continue;
    }

    // Telefon ixtiyoriy, lekin kiritilgan bo'lsa — haqiqiy va yagona.
    let phone = "";
    const rawPhone = str(r.phone);
    if (rawPhone) {
      if (!isValidPhone(rawPhone)) {
        skipped.push({ row: i + 1, reason: `${name}: telefon raqami noto'g'ri` });
        continue;
      }
      phone = normalizePhone(rawPhone);
      if (takenPhones.has(phone)) {
        skipped.push({ row: i + 1, reason: `${name}: ${phone} allaqachon ro'yxatda` });
        continue;
      }
      takenPhones.add(phone);
    }

    const employee: HrEmployee = {
      id: nextId++,
      name,
      gender: GENDER_BY_LABEL[str(r.gender).toLowerCase()] ?? "",
      // Aktiv o'quvchi va guruh soni CSV'dan OLINMAYDI — ular guruh
      // ro'yxatidan kelib chiqadi, faylga yozilgani esa eskirgan nusxa.
      aktivOq: 0,
      groups: 0,
      turi: ROLE_BY_LABEL[str(r.turi).toLowerCase()] ?? "",
      filial: str(r.filial) || "Akademiya",
      phone,
      kurs: str(r.kurs),
      // Faylda yaratilgan sana bo'lsa — saqlaymiz (eksport nusxasi qaytganda
      // sana o'zgarmasin); bo'lmasa hozirgi vaqt.
      created: /^\d{2}\.\d{2}\.\d{4}/.test(str(r.created)) ? str(r.created) : fmtNow(new Date()),
      lastActive: "",
      archReason: "",
      archDate: "",
      email: "",
      percent: "",
      degree: "",
      photoUrl: "",
      branchAssignments: [],
    };
    created.push(employee);
  }

  if (created.length > 0) {
    await col.insertMany(created.map((e) => ({ ...e })));
  }

  return NextResponse.json({ ok: true, created: created.length, skipped });
}
