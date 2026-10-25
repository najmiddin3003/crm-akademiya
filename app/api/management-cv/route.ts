import { NextResponse } from "next/server";
import { ensureIndexes } from "@/lib/mongodb";
import { getBranchScope } from "@/lib/branchScope";
import { getCurrentUser } from "@/lib/auth";
import { createCvFromForm } from "@/lib/cvApplyServer";
import { cvBranchFilter, cvFromRow, formatSubmitted, sanitizeCvInput, type CvApplication } from "@/lib/managementCv";
import { isPathAllowed } from "@/lib/permissions";

// Boshqaruv → Ishga qabul (CV) backend'i (MongoDB `cv_applications`).
// Demo seed YO'Q — arizalar faqat ommaviy /ariza sahifasidan yoki Google
// Sheets orqali kelganda paydo bo'ladi.
//
// `ord` — jadvaldagi qator tartibi: yangi ariza TEPAGA qo'shiladi, ya'ni
// mavjud eng kichik `ord` dan bittaga kichik qiymat oladi. Ro'yxat `ord`
// bo'yicha o'sish tartibida qaytariladi.
//
// Cloudinary'ga yuklash `crypto` ishlatadi — Node ish muhiti kerak.
export const runtime = "nodejs";

/**
 * FILIAL QAMROVI (19.09.2026, foydalanuvchi so'rovi: "sidebardagi ishga
 * qabul CV bo'limida alohida filialni ajratish kerak"). Navbardagi tanlov
 * cookie'da (lib/branchScope.ts) — ro'yxat shu filialning arizalarini
 * ko'rsatadi. "Qaysi filial bo'lsa ham" (`branchId: null`) va eski, filial
 * yozilmagan arizalar HAMMA filialda ko'rinadi — ular hech kimniki emas,
 * yo'qolib qolmasin.
 */
// HOVUZ (09.10.2026, lib/branchPools.ts): 1+2 da arizalar umumiy. Shart — lib/managementCv.ts
// `cvBranchFilter` (yon menyudagi «Yangi» sanog'i ham shundan).

// `?all=1` (yangi ko'rinish, 25.10.2026): ADMIN uchun barcha filiallar arizalari — rasmdagi
// «barcha filiallar» va «Filial» filtri; boshqalarga e'tiborsiz (navbar filiali, avvalgidek).
// `canHire` — «Ishga olish» (xodim yaratadi) Xodimlar bo'limi ruxsati bilan.
export async function GET(req: Request) {
  const scope = await getBranchScope();
  if (!scope) return NextResponse.json({ ok: false, error: "Tizimga kirmagansiz" }, { status: 401 });
  const all = scope.isAdmin && new URL(req.url).searchParams.get("all") === "1";
  const db = await ensureIndexes();
  const col = db.collection("cv_applications");
  const rows = await col.find(all ? {} : cvBranchFilter(scope.branchId)).sort({ ord: 1 }).toArray();
  // Admin izohi — faqat adminga (lib/managementCv.ts `cvFromRow`).
  const applications = rows.map((r) => cvFromRow(r as unknown as Record<string, unknown>, scope.isAdmin));
  const me = await getCurrentUser();
  const canHire = !!me && isPathAllowed("/management-xodimlar", me.permissions);
  // Filial nomi va manzili — «Suhbatga chaqirish» oynasidagi «Joy» sukuti (ommaviy /ariza ham
  // shularni ko'rsatadi; /api/branches esa CV ruxsatiga ochilmagan).
  const places = (await db.collection("branches").find({}, { projection: { _id: 0, id: 1, name: 1, address: 1 } }).sort({ id: 1 }).toArray()).map((b) => ({
    id: Number(b.id),
    name: String(b.name ?? ""),
    address: String(b.address ?? ""),
  }));
  return NextResponse.json({ ok: true, applications, branchId: scope.branchId, isAdmin: scope.isAdmin, all, canHire, places });
}

const bad = (error: string, status = 400) => NextResponse.json({ ok: false, error }, { status });

// POST /api/management-cv — yangi ariza. Uch manbadan keladi:
//   1) ommaviy /ariza sahifasi — multipart (rasm va fayllar bilan),
//   2) CRM ichidagi "Ishga qabul anketasi" modali — 19.09.2026 dan
//      xuddi (1) kabi multipart (savollar bir xil), xodim sessiyasi bilan,
//   3) Google Sheets sinxroni (o'sha yerda to'ldirilgan qatorlar) — JSON.
// Hammasida `sid` bo'ladi — takror yozmaslik uchun shu bo'yicha
// tekshiramiz. JSON yo'lida filial — kirgan xodimning joriy filiali
// (anketani u to'ldirgan), sessiyasiz kelsa (Sheets) yozilmaydi.
export async function POST(req: Request) {
  const db = await ensureIndexes();

  if ((req.headers.get("content-type") || "").includes("multipart/form-data")) {
    let form: FormData;
    try {
      form = await req.formData();
    } catch {
      return bad("Noto'g'ri so'rov");
    }
    const staff = await getCurrentUser();
    const r = await createCvFromForm(db, form, staff ? { fullName: staff.fullName } : null);
    return r.ok ? NextResponse.json(r) : bad(r.error, r.status);
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return bad("Noto'g'ri so'rov");
  }

  const input = sanitizeCvInput(body);
  if (!input) return bad("Ism va familiyani kiriting");
  if (!input.phone) return bad("Telefon raqamni kiriting");
  if (!input.position) return bad("Yo'nalishni tanlang");

  const col = db.collection("cv_applications");

  if (input.sid) {
    const dup = await col.findOne({ sid: input.sid });
    if (dup) {
      return NextResponse.json({
        ok: true,
        dup: true,
        application: cvFromRow(dup as unknown as Record<string, unknown>),
      });
    }
  }

  if (input.branchId === undefined) {
    const scope = await getBranchScope();
    if (scope) {
      input.branchId = scope.branchId;
      const branch = await db.collection("branches").findOne({ id: scope.branchId }, { projection: { name: 1 } });
      if (branch && !input.branchName) input.branchName = String(branch.name);
    }
  }

  const [lastId] = await col.find({}).sort({ id: -1 }).limit(1).toArray();
  const [firstOrd] = await col.find({}).sort({ ord: 1 }).limit(1).toArray();

  const application: CvApplication = {
    ...input,
    id: ((lastId?.id as number) ?? 0) + 1,
    status: "new",
    submitted: formatSubmitted(new Date()),
  };
  await col.insertOne({ ...application, ord: ((firstOrd?.ord as number) ?? 1) - 1 });

  return NextResponse.json({ ok: true, application });
}
