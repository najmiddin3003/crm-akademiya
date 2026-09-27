import { NextResponse } from "next/server";
import type { Db, Filter, Document } from "mongodb";
import { ensureIndexes } from "@/lib/mongodb";
import { getBranchScope } from "@/lib/branchScope";
import { getCurrentUser } from "@/lib/auth";
import { CV_UPLOAD_FOLDER, cloudinaryConfig, uploadDocument, uploadImage } from "@/lib/cloudinary";
import {
  ageOf,
  cvFromRow,
  formatSubmitted,
  makeCvRef,
  sanitizeCvInput,
  type CvApplication,
  type CvFile,
} from "@/lib/managementCv";
import {
  CV_ANY_BRANCH,
  CV_EDU_LEVELS,
  CV_EXP_LEVELS,
  CV_FILE_LIMITS,
  CV_LOADS,
  CV_MIN_AGE,
  CV_ROLE_GROUPS,
  CV_SOURCES,
  CV_SUBJECT_GROUPS,
  CV_TEACHING_ROLES,
} from "@/constants/managementCv";

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
function cvBranchFilter(branchId: number): Filter<Document> {
  return { $or: [{ branchId }, { branchId: null }, { branchId: { $exists: false } }] };
}

export async function GET() {
  const scope = await getBranchScope();
  if (!scope) return NextResponse.json({ ok: false, error: "Tizimga kirmagansiz" }, { status: 401 });
  const db = await ensureIndexes();
  const col = db.collection("cv_applications");
  const rows = await col.find(cvBranchFilter(scope.branchId)).sort({ ord: 1 }).toArray();
  // Admin izohi — faqat adminga (lib/managementCv.ts `cvFromRow`).
  const applications = rows.map((r) => cvFromRow(r as unknown as Record<string, unknown>, scope.isAdmin));
  return NextResponse.json({ ok: true, applications, branchId: scope.branchId });
}

const bad = (error: string, status = 400) => NextResponse.json({ ok: false, error }, { status });

const ROLES = new Set(CV_ROLE_GROUPS.flatMap((g) => g.roles));
const SUBJECTS = new Set(CV_SUBJECT_GROUPS.flatMap((g) => g.subjects));
const IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const DOC_TYPES = new Set([
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
]);
const DOC_EXT = /\.(pdf|jpe?g|png|webp|docx?)$/i;

function fileOf(form: FormData, key: string): File | null {
  const f = form.get(key);
  return f instanceof File && f.size > 0 ? f : null;
}

function filesOf(form: FormData, key: string): File[] {
  return form.getAll(key).filter((f): f is File => f instanceof File && f.size > 0);
}

function fileMeta(f: File, url: string): CvFile {
  return { name: f.name.slice(0, 160), url, size: f.size, type: f.type || "" };
}

/**
 * ANKETA — `multipart/form-data` (rasm va fayllar bilan). Ikki manbadan:
 * ommaviy /ariza sahifasi (nomzod o'zi) va CRM'dagi "Ishga qabul anketasi"
 * modali (xodim nomzod nomidan) — savollar bir xil, mijoz mantiqi ham bitta
 * (components/management/cvApplyForm.ts).
 *
 * Tekshiruv mijozdagi bilan bir xil: mijoz tezkor javob uchun, server esa
 * haqiqat uchun — anketa ommaviy, unga brauzersiz ham murojaat qilish
 * mumkin. Fayllar avval tekshiriladi, keyin Cloudinary'ga yuklanadi,
 * oxirida bazaga yoziladi — yarim yozuv qolmasin.
 *
 * XODIM SESSIYASI bilan kelganda (CRM modali) rasm va rozilik majburiy
 * emas — xodimda nomzodning rasmi bo'lmasligi mumkin, rozilikni nomzod
 * o'zi belgilamaydi; kim kiritgani `enteredBy` ga yoziladi.
 */
async function createFromPublicForm(db: Db, form: FormData) {
  const str = (k: string) => {
    const v = form.get(k);
    return typeof v === "string" ? v.trim() : "";
  };

  // Tuzoq maydoni — botlar to'ldiradi, odam ko'rmaydi. Jimgina "qabul
  // qilindi" deymiz, lekin hech narsa saqlamaymiz.
  if (str("website")) return NextResponse.json({ ok: true, ref: makeCvRef(), application: null });

  const staff = await getCurrentUser();

  const firstName = str("firstName");
  const lastName = str("lastName");
  if (!firstName || !lastName) return bad("Ism va familiyani kiriting");

  const phoneDigits = str("phone").replace(/\D/g, "");
  if (phoneDigits.length !== 12 || !phoneDigits.startsWith("998")) return bad("Telefon raqamni to'liq kiriting: +998 va 9 ta raqam");
  const phone = `+${phoneDigits}`;

  const birth = str("birth");
  const age = ageOf(birth);
  if (!birth || age < 0) return bad("Tug'ilgan sanangizni tanlang");
  if (age < CV_MIN_AGE || age >= 80) return bad(`Ishga qabul ${CV_MIN_AGE} yoshdan boshlanadi — sanani tekshiring`);

  const address = str("city");
  if (!address) return bad("Yashash manzilingizni yozing");

  const position = str("role");
  if (!position || !ROLES.has(position)) return bad("Vakansiya turini tanlang");
  const teaching = CV_TEACHING_ROLES.includes(position);
  const subject = str("subject");
  if (teaching && (!subject || !SUBJECTS.has(subject))) return bad("Fan yoki yo'nalishni tanlang");

  const branchRaw = str("branch");
  let branchId: number | null = null;
  let branchName = CV_ANY_BRANCH;
  if (!branchRaw) return bad("Filialni tanlang");
  if (branchRaw !== "any") {
    const n = Number(branchRaw);
    const branch = Number.isFinite(n) ? await db.collection("branches").findOne({ id: n }, { projection: { name: 1 } }) : null;
    if (!branch) return bad("Filialni tanlang");
    branchId = n;
    branchName = String(branch.name);
  }

  const load = str("load");
  if (!CV_LOADS.includes(load)) return bad("Bandlik turini tanlang");

  const startDate = str("startDate");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(startDate)) return bad("Qachondan boshlay olishingizni tanlang");

  const salaryDigits = str("salary").replace(/\D/g, "");
  if (!salaryDigits) return bad("Kutayotgan oylikni yozing");
  const expectedSalary = salaryDigits.replace(/\B(?=(\d{3})+(?!\d))/g, " ");

  const edu = str("edu");
  if (!CV_EDU_LEVELS.includes(edu)) return bad("Ta'lim darajangizni tanlang");
  const experience = str("exp");
  if (!CV_EXP_LEVELS.includes(experience)) return bad("Ish tajribangizni tanlang");
  const university = str("school");
  if (!university) return bad("O'quv yurti va yo'nalishni yozing");
  const whyUs = str("about");
  if (!whyUs) return bad("Nega Akademiyada ishlamoqchi ekaningizni yozing");
  const consented = str("consent") === "on";
  if (!consented && !staff) return bad("Rozilikni belgilang");

  const source = str("source");

  // ── Fayllar ──
  const photo = fileOf(form, "photo");
  if (!photo && !staff) return bad("Rasmingizni yuklang");
  if (photo && !IMAGE_TYPES.has(photo.type)) return bad("Faqat rasm yuklang — JPG yoki PNG");
  if (photo && photo.size > CV_FILE_LIMITS.photoBytes) return bad("Rasm hajmi 10 MB dan oshmasin");

  const cv = fileOf(form, "cv");
  if (cv && !(DOC_TYPES.has(cv.type) || DOC_EXT.test(cv.name))) return bad("CV fayli — faqat PDF, DOC yoki rasm");
  if (cv && cv.size > CV_FILE_LIMITS.fileBytes) return bad("CV fayli 10 MB dan oshmasin");

  const docs = filesOf(form, "docs");
  if (docs.length > CV_FILE_LIMITS.docsCount) return bad(`Ko'pi bilan ${CV_FILE_LIMITS.docsCount} ta fayl yuklash mumkin`);
  let total = 0;
  for (const d of docs) {
    if (!(DOC_TYPES.has(d.type) || DOC_EXT.test(d.name))) return bad(`${d.name} — faqat PDF yoki rasm yuklanadi`);
    if (d.size > CV_FILE_LIMITS.fileBytes) return bad(`${d.name} — 10 MB dan katta, siqib qayta yuklang`);
    total += d.size;
  }
  if (total > CV_FILE_LIMITS.docsTotalBytes) return bad("Fayllarning umumiy hajmi 25 MB dan oshmasin");

  // Rasm (nomzod uchun MAJBURIY) va fayllar Cloudinary'da bo'lishi shart
  // (foydalanuvchi talabi) — sozlanmagan bo'lsa ariza qabul qilinmaydi,
  // jimgina fayllarsiz saqlanmaydi.
  if ((photo || cv || docs.length) && !cloudinaryConfig()) return bad("Rasm saqlash xizmati sozlanmagan — administratorga xabar bering", 503);

  let photoUrl = "";
  if (photo) {
    const uploaded = await uploadImage(photo, CV_UPLOAD_FOLDER);
    if (!uploaded.ok || !uploaded.url) return bad(uploaded.error || "Rasm yuklanmadi", 502);
    photoUrl = uploaded.url;
  }

  let cvFile: CvFile | null = null;
  if (cv) {
    const r = await uploadDocument(cv, `${CV_UPLOAD_FOLDER}/hujjatlar`);
    if (!r.ok || !r.url) return bad(r.error || "CV fayli yuklanmadi", 502);
    cvFile = fileMeta(cv, r.url);
  }
  const docFiles: CvFile[] = [];
  for (const d of docs) {
    const r = await uploadDocument(d, `${CV_UPLOAD_FOLDER}/hujjatlar`);
    if (!r.ok || !r.url) return bad(r.error || `${d.name} yuklanmadi`, 502);
    docFiles.push(fileMeta(d, r.url));
  }

  const col = db.collection("cv_applications");
  const sid = str("sid") || `pa${Date.now()}_${Math.floor(Math.random() * 9999)}`;
  const dup = await col.findOne({ sid });
  if (dup) return NextResponse.json({ ok: true, dup: true, ref: dup.ref ?? "", application: cvFromRow(dup as unknown as Record<string, unknown>) });

  // Ariza raqami noyob bo'lsin — 3 belgi 32^3 = 32 768 variant, bir kunda
  // to'qnashuv ehtimoli kichik, lekin nol emas.
  let ref = makeCvRef();
  for (let i = 0; i < 5 && (await col.findOne({ ref }, { projection: { _id: 1 } })); i++) ref = makeCvRef();

  const [lastId] = await col.find({}).sort({ id: -1 }).limit(1).toArray();
  const [firstOrd] = await col.find({}).sort({ ord: 1 }).limit(1).toArray();
  const now = new Date();
  const application: CvApplication = {
    id: ((lastId?.id as number) ?? 0) + 1,
    sid,
    ref,
    name: `${firstName} ${lastName}`,
    firstName,
    lastName,
    phone,
    telegram: str("telegram").replace(/^@+/, "").slice(0, 64),
    photoUrl,
    address,
    birth,
    university,
    position,
    subject: teaching ? subject : "",
    achievements: str("certText"),
    experience,
    startDate,
    whyUs,
    schools: "",
    currentJob: str("lastJob"),
    levels: "",
    plans5: "",
    expectedSalary,
    results: "",
    priorities: [],
    strengths: [],
    extra: "",
    branchId,
    branchName,
    load,
    edu,
    source: CV_SOURCES.includes(source) ? source : "",
    cvFile,
    docs: docFiles,
    consentAt: consented ? now.toISOString() : "",
    ...(staff ? { enteredBy: staff.fullName } : {}),
    status: "new",
    submitted: formatSubmitted(now),
  };
  await col.insertOne({ ...application, ord: ((firstOrd?.ord as number) ?? 1) - 1 });
  return NextResponse.json({ ok: true, ref, application });
}

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
    return createFromPublicForm(db, form);
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
