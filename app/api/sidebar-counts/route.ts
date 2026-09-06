import { NextResponse } from "next/server";
import { ensureIndexes } from "@/lib/mongodb";
import { getCurrentUser } from "@/lib/auth";
import { isPathAllowed } from "@/lib/permissions";
import { getBranchScope } from "@/lib/branchScope";
import { currentAuthorName } from "@/lib/currentEmployee";
import { withLeadScope } from "@/lib/leadScope";

// SIDEBAR YONIDAGI SONLAR.
//
// NIMA NOTO'G'RI EDI: bu sonlar `constants/sidebar.js` da QATTIQ yozilgan
// edi — "502", "1411", "89", "189", "34". Ular referens saytdan ko'chirilgan
// va bazadagi haqiqat bilan hech qanday aloqasi yo'q edi: buyurtmalar
// sahifasida 3 ta yozuv turganda sidebar 502 deb ko'rsatardi. "34" esa
// umuman to'qima — unga manba bo'ladigan hech narsa yo'q edi.
//
// QOBIQ ROUTE'i: har bir sahifada chaqiriladi, shu sabab bo'lim ruxsatiga
// BOG'LANMAYDI (`SHARED_EXTRA`). Aks holda, masalan, `/orders-list` ruxsati
// yo'q xodimda BUTUN sanoq 403 bo'lardi. Ruxsat shu yerda, HAR BIR SANOQ
// UCHUN ALOHIDA kesiladi — naqsh `app/api/notifications/route.ts` dan.
//
// HAR BIR SANOQ o'zi olib boradigan sahifa bilan AYNAN BIR XIL filtrdan
// chiqadi, aks holda sidebar bir son, sahifa boshqa son ko'rsatardi:
//   /orders-list, /first-lessons → withLeadScope (app/api/orders/route.ts)
//   /groups                      → filtrsiz (lib/listQueries.ts → loadGroups)
//   /tasks                       → filtrsiz (o'z route'i ham kesmaydi)
export async function GET() {
  const me = await getCurrentUser();
  if (!me) return NextResponse.json({ ok: false, error: "Tizimga kirmagansiz" }, { status: 401 });

  const scope = await getBranchScope();
  if (!scope) return NextResponse.json({ ok: false, error: "Tizimga kirmagansiz" }, { status: 401 });

  const can = (href: string) => isPathAllowed(href, me.permissions);
  const db = await ensureIndexes();
  const counts: Record<string, number> = {};

  // Lidlar qamrovi ikkala sanoq uchun bir marta tayyorlanadi ("shu filial
  // YOKI o'zim qo'shganim" — lib/leadScope.ts).
  const needLeads = can("/orders-list") || can("/first-lessons");
  const leadFilter = needLeads ? withLeadScope({}, scope, await currentAuthorName()) : null;

  const jobs: Promise<unknown>[] = [];
  if (leadFilter && can("/orders-list")) {
    jobs.push(db.collection("orders").countDocuments(leadFilter).then((n) => { counts.orders = n; }));
  }
  if (leadFilter && can("/first-lessons")) {
    // FirstLessonsPage aynan shu shartni klientda qo'llaydi:
    // `orders.filter(o => (o.firstLesson || "").trim())`.
    jobs.push(
      db.collection("orders")
        .countDocuments({ $and: [leadFilter, { firstLesson: { $nin: ["", null] } }] })
        .then((n) => { counts.firstLessons = n; }),
    );
  }
  if (can("/groups")) {
    // FILIAL FILTRI ATAYLAB YO'Q — /groups sahifasi ham kesmaydi
    // (lib/listQueries.ts, kelishilgan qaror). Qo'shilsa sidebar va sahifa
    // bir-biriga zid son ko'rsatardi.
    jobs.push(db.collection("groups").countDocuments({}).then((n) => { counts.groups = n; }));
  }
  if (can("/tasks")) {
    jobs.push(
      db.collection("tasks")
        .countDocuments({ state: { $ne: "bajarilgan" } })
        .then((n) => { counts.tasks = n; }),
    );
  }
  await Promise.all(jobs);

  return NextResponse.json({ ok: true, counts });
}
