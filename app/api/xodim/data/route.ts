import { NextResponse, after } from "next/server";
import type { Db } from "mongodb";
import { healMissingAddresses } from "@/lib/attendanceCheck";
import { ensureIndexes } from "@/lib/mongodb";
import { staffFromInitData } from "@/lib/staffBot/webapp";
import { loadTeacherRoster } from "@/lib/teacherRoster";
import { buildSalaryLedger } from "@/lib/salaryLedger";
import { buildPayrollRows } from "@/lib/payrollSources";
import { payrollMonthKey, payrollPeriod } from "@/lib/salary";
import { EMPLOYEE_PROFILE_TABS_KEY } from "@/components/employees/employeeExtras";
import type { HrEmployee } from "@/lib/hrEmployees";
import type { TurnstileIoRecord } from "@/lib/turnstileIo";
import { GET as entriesGet } from "@/app/api/transaction-entries/route";
import { GET as summaryGet } from "@/app/api/transaction-entries/moderator-summary/route";
import { GET as entryStudentsGet } from "@/app/api/transaction-entries/students/route";
import { GET as facetsGet } from "@/app/api/transaction-entries/facets/route";

// GET /api/xodim/data?u=<saytdagi API manzili> — xodimlar botining «👤 Profilim»
// Mini App'i (28.09.2026) uchun YAGONA kirish.
//
// Mini App saytdagi xodim profilining O'ZINI chizadi
// (components/employees/EmployeeProfilePage.tsx, `readOnly`). U o'z
// so'rovlarini odatdagidek (`/api/bonuses`, `/api/hr-employees/12/students`
// …) yuboradi, faqat shu route orqali: CRM sessiyasi yo'q, kirish —
// Telegram `initData` imzosi (lib/staffBot/webapp.ts).
//
// QOIDA: har bir manzil faqat XODIMNING O'ZIGA tegishli javob qaytaradi —
//   • ism/id so'rovda bo'lsa, u xodimning o'ziniki bo'lishi shart (403);
//   • saytda BUTUN ro'yxat qaytaradigan manzillar (bonuslar, jarimalar,
//     turniket, lidlar, qarzdorlar, oylik jadvali) shu yerda xodimning
//     o'z qatorlarigacha kesiladi — sahifa ularni baribir shunday
//     filtrlaydi, ya'ni ko'rinish o'zgarmaydi, begona ma'lumot esa
//     tarmoqqa chiqmaydi;
//   • admin eslatmalari (`/notes`) va xodim kartasidagi admin izohi
//     (`comment`) berilmaydi — foydalanuvchi qarori, 28.09.2026;
//   • ro'yxatda yo'q manzil — 404. Faqat o'qish: GET'dan boshqa metod yo'q.
//
// Tranzaksiya route'lari (to'rttasi) sessiyaga tayanmaydi — ular shu yerdan
// tozalangan parametrlar bilan chaqiriladi, ya'ni raqamlar saytdagi bilan
// AYNAN bir xil yo'ldan hisoblanadi.
//
// Filial: sahifadagi ma'lumot xodimning HAMMA filialidan (guruhlari,
// lidlari) — saytda "barcha filiallar" rejimi yo'q, lekin o'z profilida
// ikki filialda ishlaydigan ustoz o'quvchilarining yarmini ko'rmasligi
// kerak. Oylik qatori — xodimning o'z oylik filialidan (`payrollBranchId`).

const NO_STORE = { "Cache-Control": "private, no-store" };

const json = (body: unknown, status = 200) => NextResponse.json(body, { status, headers: NO_STORE });
const notFound = () => json({ ok: false, error: "Topilmadi" }, 404);
const notMine = () => json({ ok: false, error: "Faqat o'z ma'lumotingizni ko'ra olasiz" }, 403);

/** Sahifadagi ism solishtirishi bilan bir xil: chetlari kesilgan, katta-kichik harf farqsiz. */
const lc = (v: unknown) => String(v ?? "").trim().toLowerCase();

/**
 * Tranzaksiya route'iga yuboriladigan parametrlar: `identities` dan AYNAN
 * BITTASI (xodimning o'z ismi — serverdagi yozuvdan qo'yiladi) va
 * `allowed` dagilar. Qolgan hamma narsa (kassa, o'quvchi id'si …) tashlanadi.
 */
function selfParams(
  sp: URLSearchParams,
  emp: HrEmployee,
  identities: readonly string[],
  allowed: readonly string[],
): URLSearchParams | null {
  const given = identities.filter((k) => sp.has(k));
  if (given.length !== 1 || lc(sp.get(given[0])) !== lc(emp.name)) return null;
  const out = new URLSearchParams({ [given[0]]: emp.name.trim() });
  for (const k of allowed) for (const v of sp.getAll(k)) out.append(k, v);
  return out;
}

async function forward(handler: (req: Request) => Promise<NextResponse>, qs: URLSearchParams | null): Promise<Response> {
  if (!qs) return notMine();
  const res = await handler(new Request(`http://localhost/?${qs}`));
  res.headers.set("Cache-Control", NO_STORE["Cache-Control"]);
  return res;
}

/** "Tranzaksiyalar tarixi" / "O'quvchilar to'lovlari" jadvallari filtrlari. */
const ENTRY_FILTERS = ["txType", "status", "slim", "page", "limit", "txName", "dateFrom", "dateTo", "studentNameExact", "studentNames"];

async function dispatch(db: Db, emp: HrEmployee, url: URL): Promise<Response> {
  const sp = url.searchParams;
  const parts = url.pathname.split("/").filter(Boolean);
  if (parts[0] !== "api") return notFound();
  const p = parts.slice(1);

  // /api/hr-employees/:id[/students|/notes|/salary-ledger] — faqat o'z id'si.
  if (p[0] === "hr-employees" && (p.length === 2 || p.length === 3)) {
    if (Number(p[1]) !== emp.id) return notMine();
    switch (p[2] ?? "") {
      case "": {
        // `archDate` eski hujjatlarda yo'q — sayt route'idagidek bo'sh satr.
        const employee: HrEmployee & { comment?: string } = { ...emp, archDate: emp.archDate || "" };
        delete employee.comment;
        return json({ ok: true, employee });
      }
      case "students":
        return json({ ok: true, ...(await loadTeacherRoster(db, emp.name, null)) });
      case "notes":
        return json({ ok: true, notes: [] });
      case "salary-ledger":
        return json({ ok: true, ledger: await buildSalaryLedger(db, emp) });
    }
    return notFound();
  }

  const mine = (who: unknown) => lc(who) === lc(emp.name);

  switch (p.join("/")) {
    case "transaction-entries": {
      const qs = selfParams(sp, emp, ["moderator", "teacherName", "person", "studentName"], ENTRY_FILTERS);
      // `studentName` bilan so'ralgani — xodimning o'z chiqimlari (avans,
      // oylik). O'quvchi filtrlari ham route'da AYNAN shu maydonga yozadi va
      // ismni bosib ketardi — ya'ni begona odamning yozuvlarini ochardi.
      if (qs?.has("studentName")) {
        qs.delete("studentNameExact");
        qs.delete("studentNames");
      }
      return forward(entriesGet, qs);
    }
    case "transaction-entries/moderator-summary":
      return forward(summaryGet, selfParams(sp, emp, ["moderator", "teacherName"], []));
    case "transaction-entries/students":
      return forward(entryStudentsGet, selfParams(sp, emp, ["moderator", "teacherName"], ["txType"]));
    case "transaction-entries/facets":
      return forward(facetsGet, selfParams(sp, emp, ["person"], []));

    case "bonuses":
    case "penalties": {
      const rows = await db
        .collection(p[0])
        .find({ type: "employee" }, { projection: { _id: 0 } })
        .sort({ id: -1 })
        .toArray();
      return json({ ok: true, [p[0]]: rows.filter((r) => mine(r.recipientName)) });
    }

    case "turnstile-io": {
      const rows = await db
        .collection("turnstile_io")
        .find({ personType: "employee" }, { projection: { _id: 0 } })
        .sort({ date: -1, id: 1 })
        .toArray();
      const records = rows.filter((r) => mine(r.personName));
      // Manzili yo'q QR joylashuvi — fonda to'ldiriladi (saytdagi /api/turnstile-io bilan bir xil).
      healMissingAddresses(db, records as unknown as TurnstileIoRecord[], after);
      return json({ ok: true, records });
    }

    // "O'qituvchining hisoboti" — lidlar xodim bo'yicha sanaladi. Lid
    // kartasining boshqa maydonlari (ism, telefon, izoh) kerak emas.
    case "orders": {
      const field = emp.turi === "teacher" ? "teacher" : "moderator";
      const orders = await db
        .collection("orders")
        .find({ [field]: emp.name }, { projection: { _id: 0, id: 1, status: 1, created: 1, teacher: 1, moderator: 1 } })
        .sort({ id: -1 })
        .toArray();
      return json({ ok: true, orders });
    }

    // "To'lanmagan to'lovlar" — faqat o'z guruhlaridagi o'quvchilar.
    case "student-reports": {
      if (sp.get("kind") !== "unpaid") return notFound();
      const roster = await loadTeacherRoster(db, emp.name, null);
      const names = new Set(roster.students.map((s) => lc(s.name)));
      const rows = names.size
        ? await db.collection("unpaid_students").find({}, { projection: { _id: 0 } }).sort({ id: 1 }).toArray()
        : [];
      return json({ ok: true, rows: rows.filter((r) => names.has(lc(r.studentName))) });
    }

    // "Avans/Oylik tarixi" dagi kassa nomlari (id → nom).
    case "cashboxes": {
      if (sp.get("names") !== "1") return notFound();
      const cashboxes = await db
        .collection("cashboxes")
        .find({}, { projection: { id: 1, name: 1, archived: 1, _id: 0 } })
        .sort({ id: 1 })
        .toArray();
      return json({ ok: true, cashboxes });
    }

    // Chap kartadagi "Akladi" / "To'lanmagan" — Oylik hisob-kitob sahifasi
    // bilan bir xil hisob, faqat o'z qatori.
    case "salary-runs/employees-payroll": {
      const period = payrollPeriod();
      const branch = Number(emp.payrollBranchId);
      const rows = await buildPayrollRows(db, period, Number.isFinite(branch) ? { payrollBranchId: branch } : {});
      return json({ ok: true, month: payrollMonthKey(period), employees: rows.filter((r) => r.id === emp.id) });
    }

    // Admin "Tablarni sozlash" da yashirgan tablar Mini App'da ham yashirin.
    case "settings": {
      if (sp.get("key") !== EMPLOYEE_PROFILE_TABS_KEY) return notFound();
      const doc = await db.collection("settings").findOne({ key: EMPLOYEE_PROFILE_TABS_KEY });
      return json({ ok: true, values: doc?.values ?? {} });
    }
  }
  return notFound();
}

export async function GET(req: Request) {
  const raw = new URL(req.url).searchParams.get("u") ?? "";
  if (!raw.startsWith("/api/")) return notFound();
  try {
    const db = await ensureIndexes();
    const auth = await staffFromInitData(db, req.headers.get("x-telegram-init-data") || "");
    if (!auth.ok) return json({ ok: false, error: auth.error }, auth.status);
    return await dispatch(db, auth.employee, new URL(raw, "http://localhost"));
  } catch (e) {
    console.error("[xodim/data]", e);
    return json({ ok: false, error: "Server xatosi — birozdan keyin qayta urinib ko'ring" }, 500);
  }
}
