// lib/apiPermissions.ts ni QAYTA GENERATSIYA qiladi.
//
//   node scripts/gen-api-permissions.mjs
//
// Nima qiladi: har bir `app/api/**/route.ts` ni uni ISHLATADIGAN sahifalar
// bilan bog'laydi. Buning uchun `app/(app)/<segment>/**/page.tsx` dan boshlab
// `@/components/...` va `@/hooks/...` importlarini rekursiv kuzatadi va
// yo'l-yo'lakay fayllardagi "/api/..." satrlarini yig'adi.
//
// NEGA GENERATSIYA: 128 ta route'ni qo'lda bog'lash — bir sahifa buzilishi
// yoki bir teshik ochilishi uchun yetarli. Yangi sahifa/API qo'shilganda shu
// skriptni qayta ishga tushiring va `git diff lib/apiPermissions.ts` ga
// qarang; o'zgarish kutilganidek bo'lsa — commit qiling.
//
// QO'LDA sozlanadigan uchta ro'yxat pastda (PUBLIC, SHARED_EXTRA, MANUAL) —
// ular statik tahlil bila olmaydigan qarorlar.
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (p) => fs.readFileSync(p, "utf8");

// ── Qo'lda beriladigan qarorlar ──────────────────────────────────────────

/** Sessiyasiz ochiq: login/faollashtirish oqimi va tashqi cron. */
const PUBLIC = [
  "/api/auth/login",
  "/api/auth/activate",
  "/api/auth/verify-token",
  "/api/auth/forgot-password",
  "/api/auth/reset-password",
  "/api/auth/resend-invite",
  // Chiqish — sessiyasi ENDI AMAL QILMAYDIGAN (bloklangan, muzlatilgan,
  // o'chirilgan) xodim ham cookie'sini tozalay olishi kerak. Ilgari bu
  // route "sessiya" darajasida edi: proxy uni handler'gacha 401 bilan
  // to'sardi, (app) layout esa shu route'ga yo'naltirardi — foydalanuvchi
  // `{"ok":false,"error":"Sessiya amal qilmaydi"}` JSON'ida qolib ketardi
  // (19.09.2026, dev'da vaqtinchalik admin o'chirilganda ko'rindi).
  // Xavfi yo'q: ikkalasi ham faqat o'z cookie'sini o'chiradi.
  "/api/auth/force-logout",
  "/api/auth/logout",
  // CRON_SECRET sarlavhasi bilan himoyalangan (app/api/sync/cron/route.ts).
  "/api/sync/cron",
  // Chaqiruvchi — Telegram serveri, uning sessiyasi yo'q. TELEGRAM_WEBHOOK_SECRET
  // sarlavhasi bilan himoyalangan (app/api/telegram/webhook/route.ts).
  "/api/telegram/webhook",
  // O'QUVCHILAR botining webhook'i — alohida bot, alohida kalit
  // (TELEGRAM_STUDENT_WEBHOOK_SECRET, app/api/telegram/student/route.ts).
  // Bu qatorsiz Telegram'ning har bir so'rovi 401 bo'ladi.
  "/api/telegram/student",
  // O'QUVCHI WEB SAHIFASI. Chaqiruvchi — o'quvchi, uning CRM sessiyasi
  // YO'Q va bo'lmasligi ham kerak. Himoya boshqacha: Telegram `initData`
  // imzosi bot tokeni bilan tekshiriladi va o'quvchi bog'lanish
  // yozuvidan topiladi (lib/studentBot/webapp.ts). Marshrut faqat O'QIYDI.
  "/api/student-web/me",
  // GAMIFIKATSIYA — O'QUVCHI SAHIFASI (TZ 5.8). Chaqiruvchi — o'quvchi yoki
  // ota-onasi, CRM sessiyasi yo'q. Himoya: shaxsiy havoladagi tasodifiy token
  // (43 belgi, faqat shu o'quvchi, faqat istak qo'shish) yoki Mini App'da
  // Telegram `initData` imzosi (lib/gamification/meAuth.ts).
  "/api/me/[token]",
  "/api/me/[token]/wishlist/[itemId]",
  "/api/me/tg",
  "/api/me/tg/wishlist/[itemId]",
  // XODIMLAR BOTI — «👤 Profilim» Mini App (28.09.2026). Chaqiruvchi — xodim
  // Telegram ichida, CRM sessiyasi yo'q. Himoya: `initData` imzosi xodimlar
  // bot kaliti bilan + botdagi kirish (lib/staffBot/webapp.ts); javob faqat
  // xodimning o'z ma'lumoti, faqat o'qish (app/api/xodim/data).
  "/api/xodim/me",
  "/api/xodim/data",
  // «📷 Ishga keldim» Mini App'i — QR kodni yozadi (app/api/xodim/davomat):
  // xodim initData'dan, filial imzolangan QR tokenidan (lib/attendanceQr.ts).
  "/api/xodim/davomat",
  // TEZLIK SINOVI (/tezlik, components/tezlik/TapTest.tsx) — faqat vaqt
  // va server nomini qaytaradi, ma'lumot yo'q; dev'dan ham prod o'lchanadi
  // (CORS "*", lib/health.ts). /ping ilova ichida ishlatilmaydi (tiriklik).
  "/api/health/ping",
  "/api/health/db",
];

/**
 * Faqat SHU metodlar uchun sessiyasiz ochiq.
 * `/ariza` — tashqi nomzodlar to'ldiradigan ommaviy anketa; u arizani
 * POST qiladi. GET esa Boshqaruv → Ishga qabul ruxsatini talab qiladi.
 */
const PUBLIC_METHODS = {
  "/api/management-cv": ["POST"],
  // Ommaviy so'rovnoma (/sorovnoma) — javob yuborish. Sozlamalar sahifaga
  // server komponentdan keladi, GET yo'q. Spamdan himoya route ichida
  // (yashirin maydon, to'ldirish vaqti, IP va raqam bo'yicha chegara).
  "/api/sorovnoma": ["POST"],
};

/** Faqat sessiya yetarli — har doim ochiq sahifalar ishlatadiganlar. */
const SHARED_EXTRA = [
  // Yon paneldagi sonlar — qo'ng'iroq va filial tanlagichi bilan bir xil
  // sabab: HAR BIR sahifada chaqiriladi. Bo'lim ruxsatiga bog'lansa, o'sha
  // ruxsati yo'q xodimda BUTUN sanoq 403 bo'lardi. Ruxsat route ichida,
  // har bir sanoq uchun ALOHIDA kesiladi (app/api/sidebar-counts).
  "/api/sidebar-counts",
  "/api/auth/unlock",
  "/api/auth/change-password", // Sozlamalar → Xavfsizlik
  "/api/profile",             // Sozlamalar → Profil
  "/api/sessions",            // Sozlamalar → Qurilmalar
  // Navbardagi filial tanlagichi — har bir sahifada turadi, ya'ni sahifa
  // ruxsatiga bog'lab bo'lmaydi. Route'ning o'zi hech qanday ruxsat
  // bermaydi: tanlangan qiymat serverda foydalanuvchining RUXSAT ETILGAN
  // filiallariga solishtiriladi (lib/branchScope.ts).
  "/api/branch",
  // Navbardagi qo'ng'iroq — filial tanlagichi bilan bir xil sabab: u ham
  // har bir sahifada turadi. Bironta bo'lim ruxsatiga bog'lansa, o'sha
  // ruxsati yo'q xodim uchun BUTUN qo'ng'iroq 403 bo'lardi. Route hech
  // qanday ruxsat bermaydi: har bir manba (to'lov / buyurtma / topshiriq)
  // handler ICHIDA `isPathAllowed` bilan alohida kesiladi va yopiq manba
  // umuman so'ralmaydi (app/api/notifications/route.ts).
  "/api/notifications",
  // Bosh sahifadagi KPI kartalari. "/home" HAR DOIM ochiq (pastdagi
  // INTERNALLY_GATED izohiga qarang), ya'ni bu route'ni bironta bo'lim
  // ruxsatiga bog'lab bo'lmaydi. Ruxsat handler ichida, HAR BIR KARTA
  // uchun alohida kesiladi va yopiq kartaning soni umuman so'ralmaydi
  // (app/api/home-stats/route.ts, lib/homeStats.ts).
  "/api/home-stats",
  // Xodim topshiriqlari (/tasks). Sahifa HAMMAGA ochiq (lib/permissions.ts
  // → SELF_SERVICE_PATHS): oddiy xodim ham o'z topshirig'ini ko'radi va
  // «Bajardim» bosadi. "/tasks" ga bog'lansa u 403 olardi. Qamrov va
  // rahbar/direktor amallari HAR BIR handler ichida kesiladi
  // (lib/staffTasksServer.ts → loadViewer, taskScope, canManage).
  "/api/staff-tasks",
  "/api/staff-tasks/[id]",
  "/api/staff-tasks/[id]/file",
  "/api/staff-tasks/fines",
  "/api/staff-tasks/fines/[id]",
  "/api/staff-tasks/stats",
  "/api/staff-tasks/settings",
  "/api/staff-tasks/upload",
  // AI YORDAMCHI (lib/ai, 07.10.2026). Robot HAR sahifada turadi (qobiq),
  // ya'ni uni bironta bo'lim ruxsatiga bog'lab bo'lmaydi. Ma'lumotga ruxsat
  // HAR BIR VOSITA ichida kesiladi (lib/ai/tools → `pages`): xodim CRM'da
  // ko'ra olmaydigan narsani AI orqali ham ololmaydi. Sozlamalar route'i
  // ichida `requireAdmin`.
  "/api/ai/status",
  "/api/ai/chat",
  "/api/ai/conversations",
  "/api/ai/settings",
];

/**
 * Statik tahlil topa olmagan bog'lanishlar.
 * `/api/employees*` — eski taklif oqimi API'si; uni chaqiradigan
 * components/employees/EmployeesPage.tsx ni hozir hech qaysi sahifa
 * render qilmaydi (yetim). Ochiq qoldirib bo'lmaydi: u foydalanuvchi
 * yaratadi va `/password` shifrlangan parolni QAYTARADI.
 */
const MANUAL = {
  "/api/employees": ["/management-xodimlar"],
  "/api/employees/[id]": ["/management-xodimlar"],
  "/api/employees/[id]/password": ["/management-xodimlar"],
  // 16.09.2026 gacha Kassa → Chiqim oynasi shu route'dan "shu oyda olingan"
  // summani so'rardi; endi oyna uni oylik qatoridan oladi va ilovada
  // chaqiruv qolmadi. Route esa qoldi (scripts/_e2e-smoke-test.mjs
  // ishlatadi) — chaqiruvsiz qolgani uchun generator uni "sessiya
  // yetarli" darajasiga tushirib yuborardi, ya'ni xodimning oylik
  // to'lovlari har qanday kirgan odamga ochilardi. Avvalgi kesim saqlanadi.
  "/api/employee-salary-summary": ["/finance-cash"],
  // Eski (o'quvchiga bog'langan) topshiriqni tahrirlash/o'chirish. 23.09.2026
  // gacha uni /tasks sahifasi chaqirardi; u sahifa endi xodim topshiriqlari
  // (/api/staff-tasks) va bu route'ni hech kim chaqirmaydi. Chaqiruvsiz
  // qolgani uchun generator uni "sessiya yetarli" darajasiga tushirib,
  // PATCH/DELETE ni har kirgan odamga ochib qo'yardi. Eski topshiriqlar
  // o'quvchi profilida («Vazifa» tabi) yashaydi — kesim o'shanga.
  "/api/tasks/[id]": ["/students-list"],
};

// lib/permissions.ts dagi ALWAYS_ALLOWED_PATHS bilan bir xil bo'lishi SHART
// — BITTA ATAYLABGI ISTISNO bilan: "/home" pastdagi INTERNALLY_GATED da.
const ALWAYS_ALLOWED = new Set([
  "/settings-profile", "/settings-security", "/settings-devices", "/birthdays", "/dashboard",
  "/gamification-lesson", "/gamification-students", "/gamification-ranking", "/gamification-competition", "/gamification-shop",
]);

/**
 * HAR DOIM OCHIQ, LEKIN MAZMUNI SAHIFANING O'ZIDA KESILADIGAN sahifalar —
 * ular hech qanday route'ni KENGAYTIRMAYDI, shu bois tahlildan chetlatiladi.
 *
 * NIMA NOTO'G'RI EDI: "/home" bosh sahifa sifatida ALWAYS_ALLOWED_PATHS ga
 * qo'shilgach, generator uni oddiy sahifa deb hisobladi va u ko'rsatadigan
 * dars jadvalining route'lari — /api/groups, /api/rooms, /api/offline-courses
 * — ruxsat ro'yxatiga "/home" bilan kirdi. `isPathAllowed("/home", ...)` esa
 * HAR DOIM `true`, ya'ni o'sha uchtasi amalda "sessiya yetarli" darajasiga
 * tushib qolgandi, jadvalda esa ruxsatli ko'rinardi — buni faqat ro'yxatni
 * diqqat bilan o'qib sezish mumkin edi.
 *
 * TO'G'RI MODEL: bosh sahifa jadvalni FAQAT "Dars jadvali" ruxsati bor
 * xodimga ko'rsatadi (app/(app)/home/page.tsx), ya'ni o'sha route'lar
 * "/groups-schedule" orqali baribir ochiladi va ruxsati yo'q xodim ularni
 * umuman so'ramaydi. Bosh sahifaning O'ZIGA tegishli route (/api/home-stats)
 * esa yuqoridagi SHARED_EXTRA da — u ham ichidan kesiladi.
 */
const INTERNALLY_GATED = new Set(["/home"]);
const ROUTE_ALIASES = { "/student-edit": "/students-list" };

// ── Tahlil ───────────────────────────────────────────────────────────────

function walk(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) {
      if (["node_modules", ".next", ".git"].includes(e.name)) continue;
      walk(p, out);
    } else if (/\.(tsx?|jsx?)$/.test(e.name)) out.push(p);
  }
  return out;
}

const apiRoutes = walk(path.join(ROOT, "app", "api"))
  .filter((p) => /route\.tsx?$/.test(p))
  .map((p) => "/" + path.relative(path.join(ROOT, "app"), p).replace(/\\/g, "/").replace(/\/route\.tsx?$/, ""))
  .sort();

/**
 * Fayldagi "/api/..." havolalari; `${...}` `*` ga aylanadi.
 *
 * IZOHLAR OLIB TASHLANADI. Aks holda izohda eslatib o'tilgan yo'l ham
 * haqiqiy havola deb o'qiladi — bir marta shunday bo'lgan: bitta izohdagi
 * "/api" + yulduzcha BARCHA bir bo'lakli API'ni "qobiqda ishlatiladi" deb
 * belgilab, ularni ruxsat tekshiruvidan chiqarib yuborgan.
 */
function apiRefsIn(file) {
  const src = read(file)
    .replace(/\/\*[\s\S]*?\*\//g, " ")       // blok izohlar
    .replace(/(^|[^:'"`])\/\/.*$/gm, "$1");  // satr izohlar (https:// ga tegmaydi)
  const out = new Set();
  for (const m of src.matchAll(/["'`](\/api\/[^"'`]*)["'`]/g)) {
    const u = m[1].replace(/\$\{[^}]*\}/g, "*").split("?")[0].replace(/\/+$/, "");
    if (!u.startsWith("/api")) continue;
    // "/api" dan keyingi BIRINCHI bo'lak dinamik bo'lsa, havola qaysi route
    // ekanini aniqlamaydi va hammasiga mos kelib ketardi — tashlaymiz.
    // Bunday chaqiruv boshqa, aniqroq havolalar orqali baribir qamraladi.
    if (u.split("/")[2] === "*") continue;
    out.add(u);
  }
  return out;
}

function resolveImport(spec, fromFile) {
  let base;
  if (spec.startsWith("@/")) base = path.join(ROOT, spec.slice(2));
  else if (spec.startsWith(".")) base = path.resolve(path.dirname(fromFile), spec);
  else return null;
  for (const c of [base + ".tsx", base + ".ts", base + ".jsx", base + ".js",
                   path.join(base, "index.tsx"), path.join(base, "index.ts")]) {
    if (fs.existsSync(c) && fs.statSync(c).isFile()) return c;
  }
  return null;
}

function collect(entry, seen = new Set(), refs = new Set()) {
  if (seen.has(entry)) return refs;
  seen.add(entry);
  for (const r of apiRefsIn(entry)) refs.add(r);
  for (const m of read(entry).matchAll(/from\s+["']([^"']+)["']/g)) {
    const r = resolveImport(m[1], entry);
    if (r && !r.includes(`${path.sep}app${path.sep}api${path.sep}`)) collect(r, seen, refs);
  }
  return refs;
}

const appDir = path.join(ROOT, "app", "(app)");
const bySegment = new Map();
for (const p of walk(appDir).filter((x) => /page\.tsx?$/.test(x))) {
  const seg = "/" + path.relative(appDir, p).replace(/\\/g, "/").split("/")[0];
  if (seg.startsWith("/[")) continue; // [view] — "hali qurilmagan" o'rin egallovchi
  if (INTERNALLY_GATED.has(seg)) continue;
  if (!bySegment.has(seg)) bySegment.set(seg, new Set());
  for (const r of collect(p)) bySegment.get(seg).add(r);
}

// Qobiq (Navbar/Sidebar) HAR BIR sahifada — u so'ragan API bloklanmaydi.
const shellRefs = new Set();
for (const f of ["components/shared/AppShell.tsx", "app/(app)/layout.tsx"]) {
  for (const r of collect(path.join(ROOT, f))) shellRefs.add(r);
}

// Havola route naqshiga mos keladimi (segment soni ham teng bo'lishi shart).
//
// Havoladagi `*` (kodda `${...}` bo'lgan joy) FAQAT dinamik `[...]`
// segmentga mos keladi. Aks holda `/api/hr-employees/${id}` havolasi
// `/api/hr-employees/import` route'iga ham "mos" kelib, ommaviy import
// endpointini kerak bo'lmagan sahifaga ochib qo'yardi.
// Aynan shu yo'lda STATIK route bor bo'lsa — havola faqat o'shanga
// bog'lanadi, dinamik qo'shnisiga emas.
//
// NIMA NOTO'G'RI EDI: `/api/hr-employees/ref` havolasi dinamik
// `/api/hr-employees/[id]` route'iga ham "mos" kelardi (dinamik segment
// har qanday matnni yutadi). `ref` esa qobiqdagi ALWAYS_ALLOWED
// sahifadan chaqiriladi, ya'ni XODIM PROFILI (`[id]`) jimgina
// "sessiya yetarli" darajasiga tushib qolardi — GET, PATCH va DELETE
// bilan birga. Buni faqat `git diff` da sezish mumkin edi.
const STATIC_ROUTES = new Set(apiRoutes.filter((r) => !r.includes("[")));

function matches(route, ref) {
  const rp = route.split("/").filter(Boolean);
  const fp = ref.split("/").filter(Boolean);
  if (rp.length !== fp.length) return false;
  if (route.includes("[") && STATIC_ROUTES.has("/" + fp.join("/"))) return false;
  for (let i = 0; i < rp.length; i++) {
    if (fp[i] === "*") {
      if (!rp[i].startsWith("[")) return false;
      continue;
    }
    if (rp[i].startsWith("[")) continue; // dinamik segment — nima bo'lsa ham mos
    if (rp[i] !== fp[i]) return false;
  }
  return true;
}

const publicSet = new Set(PUBLIC);
const sharedExtra = new Set(SHARED_EXTRA);
const shared = [];
const gated = {};

for (const route of apiRoutes) {
  if (publicSet.has(route)) continue;
  if (MANUAL[route]) { gated[route] = MANUAL[route]; continue; }

  const inShell = [...shellRefs].some((r) => matches(route, r));
  if (inShell || sharedExtra.has(route)) { shared.push(route); continue; }

  const pages = [...bySegment].filter(([, refs]) => [...refs].some((r) => matches(route, r))).map(([s]) => s);
  if (pages.length === 0) { shared.push(route); continue; }

  const keys = [...new Set(pages.map((s) => ROUTE_ALIASES[s] ?? s))];
  // Ro'yxatda HAR DOIM ochiq sahifa bo'lsa, bu API'ni hamma ishlatadi.
  if (keys.some((k) => ALWAYS_ALLOWED.has(k))) { shared.push(route); continue; }
  gated[route] = keys.sort();
}

// ── Yozish ───────────────────────────────────────────────────────────────

const q = (s) => JSON.stringify(s);
const lines = [];
lines.push("// AVTOMATIK GENERATSIYA QILINGAN — QO'LDA TAHRIRLAMANG.");
lines.push("// Yangilash: node scripts/gen-api-permissions.mjs");
lines.push("//");
lines.push("// Har bir /api/* route'i uni ishlatadigan sahifalarga bog'langan. Xodim");
lines.push("// shu sahifalardan KAMIDA BITTASINI ko'ra olsa, route ochiq bo'ladi.");
lines.push("// Qo'lda beriladigan qarorlar (ommaviy route'lar va h.k.) skript ichida.");
lines.push("");
lines.push("/** Sessiyasiz ochiq route'lar. */");
lines.push(`export const PUBLIC_API: readonly string[] = [\n${PUBLIC.map((r) => `  ${q(r)},`).join("\n")}\n];`);
lines.push("");
lines.push("/** Faqat shu HTTP metodlar uchun sessiyasiz ochiq. */");
lines.push("export const PUBLIC_API_METHODS: Record<string, readonly string[]> = {");
for (const [k, v] of Object.entries(PUBLIC_METHODS)) lines.push(`  ${q(k)}: [${v.map(q).join(", ")}],`);
lines.push("};");
lines.push("");
lines.push("/** Sessiya yetarli — qo'shimcha ruxsat talab qilinmaydi. */");
lines.push(`export const SHARED_API: readonly string[] = [\n${shared.sort().map((r) => `  ${q(r)},`).join("\n")}\n];`);
lines.push("");
lines.push("/** Route → kerakli ruxsatlar. Xodimda ULARDAN BITTASI bo'lsa yetarli. */");
lines.push("export const API_PERMISSIONS: Record<string, readonly string[]> = {");
for (const r of Object.keys(gated).sort()) lines.push(`  ${q(r)}: [${gated[r].map(q).join(", ")}],`);
lines.push("};");
lines.push("");

const target = path.join(ROOT, "lib", "apiPermissions.generated.ts");
const prev = fs.existsSync(target) ? read(target) : "";
const next = lines.join("\r\n");
fs.writeFileSync(target, next);
console.log(`${prev === next ? "o'zgarmadi" : "YANGILANDI"}: lib/apiPermissions.generated.ts`);
console.log(`  ommaviy: ${PUBLIC.length}   sessiya: ${shared.length}   ruxsatli: ${Object.keys(gated).length}   jami: ${apiRoutes.length}`);
