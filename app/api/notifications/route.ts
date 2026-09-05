import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { ensureIndexes } from "@/lib/mongodb";
import { getCurrentUser } from "@/lib/auth";
import { isPathAllowed } from "@/lib/permissions";
import { employeeNameById, nameEq } from "@/lib/currentEmployee";
import { getBranchScope, type BranchScope } from "@/lib/branchScope";
import { withLeadScope } from "@/lib/leadScope";
import { SOURCE_SCAN, SOURCE_SHOW, WINDOW_DAYS } from "@/constants/notifications";
import { overdueUz, uzMoney, type NotifItem, type NotifKind, type NotifSource } from "@/lib/notifications";
import { uzDateIso, uzParseStamp, uzStamp, uzWall } from "@/lib/uzTime";

// Navbardagi qo'ng'iroq paneli — HAQIQIY hodisalar.
//
// Ilgari panel constants/navbar.js dagi beshta o'ylab topilgan qatorni
// ko'rsatardi va qizil nuqta doim yonib turardi. Endi uch manba bazadan
// o'qiladi: kassaga tushgan to'lov, yangi buyurtma (lid) va muddati o'tgan
// topshiriq.
//
// JONLI SO'ROV, materiallashtirilgan `notifications` kolleksiyasi EMAS.
// Sabab: qator — o'zgaruvchan haqiqatning proyeksiyasi, muzlatilgan da'vo
// emas. Bekor qilingan to'lov ro'yxatdan o'zi chiqib ketadi, tuzatilgan
// summa keyingi so'rovda o'zi to'g'rilanadi, bajarilgan topshiriq o'zi
// yo'qoladi. Muzlatilgan matn esa haftalab bekor qilingan to'lovni e'lon
// qilib turardi. Bahosi — 60 soniyada bir necha o'qish; kolleksiya bo'lsa
// migratsiya, backfill va yozuv darvozasi kerak bo'lardi.
//
// O'QILGAN HOLATI — foydalanuvchi hujjatidagi `users.lastSeenNotifAt`
// (manba boshiga bitta ISO tamg'a). Alohida kolleksiya ham, har bir qator
// uchun yozuv ham yo'q.

/** Manba boshiga ruxsat kaliti. */
const PAY_ALL = "/finance-transactions";
const PAY_OWN = "/finance-cash";
const ORDERS = "/orders-list";
const TASKS = "/tasks";

/** AYNAN `toISOString()` shakli — pastdagi leksikografik taqqoslash shunga tayanadi. */
const ISO_UTC = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;

const KINDS: NotifKind[] = ["payment", "order", "task"];

const off = (): NotifSource => ({ state: "off", unread: 0, shown: 0, capped: false });

function byAtDesc(a: NotifItem, b: NotifItem): number {
  return a.at < b.at ? 1 : a.at > b.at ? -1 : 0;
}

// GET /api/notifications — panel ochilganda va har 60 soniyada.
//
// HECH NARSA YOZMAYDI. Oltita foydalanuvchining ochiq tab'i shunchaki
// turgani uchun bildirishnoma "o'qilgan" bo'lib qolmasligi kerak —
// kursorni faqat PATCH suradi.
export async function GET() {
  const me = await getCurrentUser();
  if (!me) return NextResponse.json({ ok: false, error: "Tizimga kirmagansiz" }, { status: 401 });

  // RUXSAT SHU YERDA TEKSHIRILADI, proxy'da emas.
  //
  // `/api/notifications` qobiqdan (Navbar/Sidebar) chaqiriladi, ya'ni har
  // bir sahifada. Uni bironta bo'lim ruxsatiga bog'lab bo'lmaydi — o'sha
  // ruxsati yo'q xodim uchun butun qo'ng'iroq 403 bo'lardi. Shu bois route
  // SHARED_API da (sessiya yetarli), qamrov esa MANBA BOSHIGA bu yerda
  // kesiladi. Yopiq manba UMUMAN so'ralmaydi — Atlas'ga borish ham kamayadi.
  const canPayAll = isPathAllowed(PAY_ALL, me.permissions);
  const canPayOwn = isPathAllowed(PAY_OWN, me.permissions);
  const canPay = canPayAll || canPayOwn;
  const canOrder = isPathAllowed(ORDERS, me.permissions);
  const canTask = isPathAllowed(TASKS, me.permissions);

  const now = new Date();
  const nowMs = now.getTime();
  const sinceMs = nowMs - WINDOW_DAYS * 86_400_000;
  const sinceIso = new Date(sinceMs).toISOString();

  // Kursor yo'q bo'lsa OYNA BOSHI olinadi, "hozir" emas.
  const cur = me.lastSeenNotifAt ?? {};
  const cursorOf = (k: NotifKind) => (typeof cur[k] === "string" ? cur[k] : sinceIso);

  const db = await ensureIndexes();

  // KASSA EGALARIDA QO'NG'IROQ VAQTINCHA O'CHIQ (markaz qarori, 2026-09-05).
  //
  // Sabab markazniki: hozircha kassirga bildirishnoma kerak emas, keyinroq
  // alohida ko'rinish qilinadi. Admin esa HAMMA kassani ko'radi (pastdagi
  // `loadPayments` da `isAdmin` uchun kassa filtri qo'yilmaydi).
  //
  // QAYTA YOQISH: shu blokni o'chirish kifoya — boshqa hech narsaga
  // tegilmagan, manbalar va ruxsatlar o'z holicha qolgan.
  //
  // Kassa "egaligi" ISM bo'yicha aniqlanadi: `cashboxes.moderator` —
  // `hr_employees.name` ning nusxasi, id emas (lib/currentEmployee.ts).
  if (me.role !== "admin" && (await ownsAnyCashbox(db, me.hrEmployeeId))) {
    return NextResponse.json({
      ok: true,
      serverNow: now.toISOString(),
      unread: 0,
      unreadIsFloor: false,
      items: [],
      // Uchala manba ham "off": panel shunda "ruxsat yo'q" emas, "bo'sh"
      // holatini chizadi va soxta "0 ta yangi" nishoni yonmaydi.
      sources: { payment: off(), order: off(), task: off() },
    });
  }

  const sources: Record<NotifKind, NotifSource> = { payment: off(), order: off(), task: off() };
  const picked: Record<NotifKind, NotifItem[]> = { payment: [], order: [], task: [] };

  // Uchala manba bir-biriga bog'liq emas — parallel.
  const [payRows, orderRows, taskRows] = await Promise.all([
    canPay ? loadPayments(db, me, canPayAll, sinceMs, sinceIso, sources) : Promise.resolve(null),
    // Lidlar qamrovi uchun filial va muallif ismi kerak. Ikkalasi ham shu
    // yerda, Promise.all ICHIDA olinadi — shunda ular to'lov va topshiriq
    // so'rovlari bilan PARALLEL ketadi. Qo'ng'iroq har 60 soniyada
    // so'raladi, ya'ni ketma-ket qo'yilsa har bir foydalanuvchiga
    // muntazam qo'shimcha kutish bo'lardi.
    //
    // Ism `me.hrEmployeeId` dan olinadi, `currentAuthorName()` dan EMAS:
    // u `getCurrentUser()` ni qaytadan yurgizardi, holbuki `me` yuqorida
    // allaqachon o'qilgan.
    canOrder
      ? Promise.all([getBranchScope(), employeeNameById(db, me.hrEmployeeId)])
          .then(([s, author]) => loadOrders(db, sinceMs, s, author))
      : Promise.resolve(null),
    canTask ? loadTasks(db, sinceMs, nowMs) : Promise.resolve(null),
  ]);

  if (payRows) {
    sources.payment.state = "on";
    picked.payment = payRows.rows.map((r) => {
      const person = String(r.studentName ?? "").trim();
      const method = String(r.paymentType ?? "").trim();
      const suffix = method ? ` (${method})` : "";
      const isOut = r.txType === "payOut";
      // KASSA EGASI — qo'ng'iroqda eng kerakli ma'lumot: pul QAYSI
      // kassaga tushgani. Ilgari faqat o'quvchi ismi chiqardi va admin
      // uchta kassaning yozuvlarini bir-biridan ajrata olmasdi.
      const owner = payRows.owners.get(Number(r.cashboxId)) ?? "";
      // HAR QANDAY `payIn` o'quvchi to'lovi EMAS: kassa oynasi ismsiz kirim
      // yozishga ruxsat beradi (app/api/cashboxes/[id]/adjust). Ismsiz
      // qatorni "Yangi to'lov — 2 000 000 UZS" deb chizish uni o'quvchi
      // to'lovi deb ko'rsatardi; sarlavha va matn shu bois ajratiladi.
      // Matn tartibi: KASSA — SUMMA — KIM. Bo'sh bo'lagi tushib qoladi,
      // ya'ni ismsiz kirimda ham qator to'g'ri o'qiladi (kassa oynasi
      // ismsiz kirim yozishga ruxsat beradi — /api/cashboxes/[id]/adjust).
      //
      // VAQT bu yerda YOZILMAYDI: panel uni `at` dan o'zi chizadi
      // ("2 daqiqa oldin"). `meta` to'ldirilsa esa u vaqtning O'RNIGA
      // chiqardi (components/shared/NotificationsPanel.tsx) — ya'ni
      // "qachon" degan ma'lumot yo'qolardi.
      const body = [
        owner ? `${owner} kassasi` : "",
        `${uzMoney(Math.abs(Number(r.amount)))} UZS${suffix}`,
        person || String(r.txName ?? "").trim(),
      ].filter(Boolean).join(" · ");

      return {
        id: `payment:${r.id}`,
        kind: "payment" as const,
        title: isOut ? "Yangi chiqim" : "Yangi kirim",
        body,
        meta: null,
        at: String(r.createdAt),
        href: canPayAll ? PAY_ALL : PAY_OWN,
        unread: false,
      };
    });
  }

  if (orderRows) {
    sources.order.state = "on";
    picked.order = orderRows.map((r) => ({
      id: `order:${r.id}`,
      kind: "order" as const,
      title: "Yangi buyurtma",
      // `source` chizilmaydi: bazadagi HAR BIR buyurtmada u "Sayt"
      // (lib/ordersData.ts qattiq yozadi), ya'ni hech narsa ajratmaydi.
      body: [r.name, r.course, r.phone].map((v) => String(v ?? "").trim()).filter(Boolean).join(" — "),
      meta: null,
      at: (r._id as ObjectId).getTimestamp().toISOString(),
      href: ORDERS,
      unread: false,
    }));
  }

  if (taskRows) {
    sources.task.state = "on";
    picked.task = taskRows;
  }

  // Har manba MUSTAQIL kesiladi — umumiy chegara yo'q. Jonli kassa kuni
  // to'lovlar lidlarni va topshiriqlarni ro'yxatdan siqib chiqara olmaydi.
  let unread = 0;
  let unreadIsFloor = false;
  const items: NotifItem[] = [];
  for (const k of KINDS) {
    if (sources[k].state !== "on") continue;
    const all = picked[k].sort(byAtDesc);
    const cursor = cursorOf(k);
    const n = all.filter((it) => it.at > cursor).length;
    const shown = all.slice(0, SOURCE_SHOW).map((it) => ({ ...it, unread: it.at > cursor }));
    // `capped` — skanerlash chegarasiga yetildi VA o'qilgan qator umuman
    // uchramadi, ya'ni ortida yana bo'lishi mumkin. Shundagina sanoq
    // "kamida" bo'lib qoladi va nishon "N+" chizadi.
    const capped = all.length >= SOURCE_SCAN && n === all.length;
    sources[k] = { state: sources[k].state, unread: n, shown: shown.length, capped };
    unread += n;
    if (capped) unreadIsFloor = true;
    items.push(...shown);
  }
  items.sort(byAtDesc);

  return NextResponse.json({
    ok: true,
    serverNow: now.toISOString(),
    unread,
    unreadIsFloor,
    items,
    sources,
  });
}

/**
 * Xodimga birorta kassa biriktirilganmi.
 *
 * `ownsCashbox` (lib/currentEmployee.ts) BITTA kassani tekshiradi, bu yerda
 * esa "umuman kassa egasimi" degan savol bor.
 */
async function ownsAnyCashbox(
  db: Awaited<ReturnType<typeof ensureIndexes>>,
  hrEmployeeId: number | null,
): Promise<boolean> {
  const name = await employeeNameById(db, hrEmployeeId);
  if (!name) return false;
  const box = await db
    .collection("cashboxes")
    .findOne({ moderator: nameEq(name) }, { projection: { _id: 1 } });
  return !!box;
}

/**
 * Kassaga tushgan to'lovlar.
 *
 * QAMROV `GET /api/cashboxes` bilan BIR XIL: kassa — shaxsiy javobgarlik
 * obyekti, `/finance-cash` ruxsatining o'zi boshqa moderatorning daftarini
 * ochmaydi. Aks holda qo'ng'iroq sahifa ko'rsatmaydigan pulni ko'rsatib
 * qo'yardi.
 *
 * FILIAL BO'YICHA KESILMAYDI — ATAYIN, va bu O'ZGARTIRILGAN qaror.
 * Ilgari bu yerda `withBranch` turardi. Lekin `cashboxes` da `branchId`
 * bor bo'lsa ham uni HECH KIM o'qimaydi: `GET /api/cashboxes` faqat
 * moderator bo'yicha kesadi. Bazadagi uchala kassa ham 1-filialda, ya'ni
 * navbardan boshqa filial tanlangan zahoti qo'ng'iroq "Bu filialda sizga
 * biriktirilgan kassa yo'q" deb turar, /finance-cash esa o'sha uchala
 * kassani ochib ko'rsatardi. Qo'ng'iroq o'zi ochadigan sahifa bilan bir
 * xil qamrovda bo'lishi kerak; `cashboxes` filial bo'yicha kesiladigan
 * bo'lsa IKKALASI birga o'zgaradi.
 */
async function loadPayments(
  db: Awaited<ReturnType<typeof ensureIndexes>>,
  me: NonNullable<Awaited<ReturnType<typeof getCurrentUser>>>,
  canPayAll: boolean,
  sinceMs: number,
  sinceIso: string,
  sources: Record<NotifKind, NotifSource>,
) {
  const isAdmin = me.role === "admin";
  let boxFilter: Record<string, unknown> = {};
  if (!isAdmin && !canPayAll) {
    // Faqat `/finance-cash` — o'ziga biriktirilgan kassalar. Ism
    // `hr_employees` dan olinadi: `cashboxes.moderator` o'sha ismning
    // NUSXASI (id emas) — lib/currentEmployee.ts izohiga qarang.
    const emp = me.hrEmployeeId === null
      ? null
      : await db.collection("hr_employees").findOne({ id: me.hrEmployeeId }, { projection: { name: 1, _id: 0 } });
    const name = String(emp?.name ?? "").trim();
    if (!name) {
      sources.payment.state = "no-cashbox";
      return null;
    }
    boxFilter = { moderator: nameEq(name) };
  }

  const boxes = await db
    .collection("cashboxes")
    // `moderator` ham olinadi: qo'ng'iroqda pul QAYSI kassaga tushgani
    // ko'rinishi kerak, kassa nomida esa faqat ism bo'lagi bo'ladi
    // ("Akademiya 1 Chortoq (Nilufar)"), ism-familiya emas.
    .find(boxFilter, { projection: { id: 1, moderator: 1, _id: 0 } })
    .toArray();
  const owners = new Map<number, string>();
  for (const b of boxes) owners.set(Number(b.id), String(b.moderator ?? "").trim());
  const boxIds = boxes.map((b) => Number(b.id)).filter(Number.isFinite);
  if (boxIds.length === 0) {
    // Bo'sh ro'yxat "to'lov yo'q" DEB DA'VO QILMASIN — xodimga umuman
    // kassa biriktirilmagan bo'lishi mumkin.
    sources.payment.state = "no-cashbox";
    return null;
  }

  const rows = await db
    .collection("transaction_entries")
    .find(
      {
        // KIRIM ham, CHIQIM ham. Ilgari faqat `payIn` olinardi va sabab
        // shu edi: `payOut` da `studentName` — XODIM ismi (oylik/avans),
        // uni "yangi to'lov" deb chizish yolg'on bo'lardi. Endi sarlavha
        // "Yangi kirim" / "Yangi chiqim" deb ANIQ ajratiladi, ya'ni
        // yolg'on yo'q — kassadan chiqqan pul ham ko'rinadi.
        // `transfer` kirmaydi: u tasdiq kutadigan alohida oqim.
        txType: { $in: ["payIn", "payOut"] },
        // Bekor qilingan yozuv o'chirilmaydi, belgilanadi. Har so'rovda
        // qayta tekshiriladi — bekor qilingan to'lov 60 soniyada
        // ro'yxatdan o'zi chiqib ketadi. ("waiting" faqat `transfer`
        // qatorlarida bo'ladi, ya'ni bu filtrga tushmaydi.)
        status: { $ne: "cancelled" },
        cashboxId: { $in: boxIds },
        // ISO satr — leksikografik tartib xronologik tartibga teng.
        createdAt: { $gte: sinceIso },
        // IMPORT QO'RIQCHISI. `createdAt` ni `logEntry` YOZUV lahzasida
        // qo'yadi, to'lov lahzasida emas. Kelajakda eski tarix shu darvoza
        // orqali qayta yuklansa minglab yozuv bugungi `createdAt` bilan
        // tug'ilardi va qo'ng'iroq to'lib ketardi. `date` — kassirning
        // sanasi; oynadan tashqarida bo'lsa qator chiqmaydi.
        date: { $gte: uzDateIso(new Date(sinceMs)) },
      },
      { projection: { _id: 0, id: 1, studentName: 1, txName: 1, amount: 1, paymentType: 1, createdAt: 1, cashboxId: 1, txType: 1 } },
    )
    .sort({ createdAt: -1 })
    .limit(SOURCE_SCAN)
    .toArray();

  return { rows, owners };
}

/**
 * Yangi buyurtmalar (lidlar).
 *
 * QAMROV SAHIFA BILAN AYNAN BIR XIL — `withLeadScope`, GET /api/orders
 * bilan bitta funksiya.
 *
 * Ilgari bu yerda kesish yo'q edi va izohda sabab yozilgan edi: "`orders`
 * da `branchId` maydoni yo'q, GET /api/orders ham kesmaydi". O'sha izoh
 * eskirdi — 8de8b4e dan beri ikkalasi ham bor. Natijada qo'ng'iroq boshqa
 * filialning lidini ko'rsatib turardi, bosilganda esa ro'yxatda u lid
 * yo'q edi. Izohda aytilganidek, ikkalasi BIRGA o'zgaradi.
 */
async function loadOrders(
  db: Awaited<ReturnType<typeof ensureIndexes>>,
  sinceMs: number,
  scope: BranchScope | null,
  authorName: string,
) {
  // Qamrovsiz (sessiyasiz) holat bu yergacha yetib kelmaydi — chaqiruvchi
  // allaqachon `getCurrentUser()` ni tekshirgan. Shunga qaramay `null`
  // bo'lsa manba JIM YOPILADI: kesilmagan ro'yxat qaytarish bu yerda eng
  // yomon tanlov bo'lardi.
  if (!scope) return [];
  // `created` — "DD.MM.YYYY | HH:mm" satri, Mongo uni saralay olmaydi va
  // `createdAt` maydoni umuman yo'q. `_id` ning tamg'asi esa aniq lahza va
  // sukutdagi indeksda yotadi — na migratsiya, na yangi indeks kerak.
  const minId = ObjectId.createFromTime(Math.floor(sinceMs / 1000));
  return db
    .collection("orders")
    .find(
      withLeadScope({ _id: { $gte: minId } }, scope, authorName),
      { projection: { _id: 1, id: 1, name: 1, course: 1, phone: 1 } },
    )
    .sort({ _id: -1 })
    .limit(SOURCE_SCAN)
    .toArray();
}

/**
 * Muddati o'tgan topshiriqlar.
 *
 * FILIAL VA MAS'UL BO'YICHA KESILMAYDI — ATAYIN. `tasks` da `branchId` yo'q,
 * `staff` esa erkin matn (topshiriq shablonlari u yerga "Siz" deb yozadi),
 * ya'ni foydalanuvchi bilan solishtirib bo'lmaydi. Ismni taxminan
 * solishtirish bitta imlo farqida odamning ishini JIMGINA yashirardi.
 * `GET /api/tasks` ham kesmaydi, ya'ni qo'ng'iroq sahifa bilan bir xil.
 * Mas'ul ismi qatorning o'zida chiziladi — kimning ishi ekani ko'rinadi.
 */
async function loadTasks(
  db: Awaited<ReturnType<typeof ensureIndexes>>,
  sinceMs: number,
  nowMs: number,
): Promise<NotifItem[]> {
  // `$ne: "bajarilgan"` EMAS: inkor indeksda chegaralangan sakrash bermaydi.
  // Ro'yxat yopiq va yozuvda `isTaskState` tekshiradi — uchta aniq sakrash.
  const state = { $in: ["yangi", "jarayonda", "kutilmoqda"] };
  // Xom oyna ATAYIN keng (±12 soat): `date` ikki xil shaklda saqlangan
  // (devor-soati va haqiqiy lahza), satr chegarasi 5 soatgacha adashishi
  // mumkin. HAQIQIY oyna pastda, JS'da, format-xabardor parser bilan
  // kesiladi.
  const lo = uzWall(new Date(sinceMs - 12 * 3_600_000));
  const hi = uzWall(new Date(nowMs + 12 * 3_600_000));
  const projection = { _id: 1, id: 1, student: 1, staff: 1, description: 1, date: 1 };
  const col = db.collection("tasks");
  const [byDeadline, byBirth] = await Promise.all([
    col.find({ state, date: { $gte: lo, $lt: hi } }, { projection }).sort({ date: -1 }).limit(SOURCE_SCAN).toArray(),
    // IKKINCHI so'rov "tug'ilishidanoq kechikkan" topshiriq uchun: bugun
    // yaratilgan, muddati kecha bo'lgan yozuvning `date` i eng PAST va
    // birinchi so'rovning limiti aynan uni tashlab yuborardi.
    col.find({ state, date: { $gte: lo, $lt: hi } }, { projection }).sort({ _id: -1 }).limit(SOURCE_SCAN).toArray(),
  ]);

  const seen = new Set<number>();
  const out: NotifItem[] = [];
  for (const r of [...byDeadline, ...byBirth]) {
    const id = Number(r.id);
    if (!Number.isFinite(id) || seen.has(id)) continue;
    seen.add(id);
    const dl = uzParseStamp(r.date);
    // Yaroqsiz sana — qator TASHLANADI, xato otilmaydi. Bitta buzuq yozuv
    // butun qo'ng'iroqni har 60 soniyada 500 qilib turmasin.
    if (dl === null) continue;
    if (dl >= nowMs || dl < sinceMs) continue;
    const born = (r._id as ObjectId).getTimestamp().getTime();
    // `max` ORQAGA SANALASH uchun: bugun soat 16:00 da yaratilgan, muddati
    // kecha bo'lgan topshiriq faqat muddat bo'yicha olinsa kursor ortida
    // qolib, allaqachon "o'qilgan" bo'lib kelardi.
    const at = new Date(Math.max(dl, born)).toISOString();
    const student = String(r.student ?? "").trim();
    const staff = String(r.staff ?? "").trim();
    out.push({
      id: `task:${id}`,
      kind: "task",
      title: "Kechikkan topshiriq",
      body: `${student || "—"}${staff ? ` (${staff})` : ""} — ${String(r.description ?? "").trim() || "tavsifsiz"}`,
      // Topshiriqda nisbiy vaqt O'RNIGA muddat chiziladi: `at` — kursor
      // kaliti, ko'rsatiladigan qiymat emas. Muddati olti kun oldin
      // o'tgan topshiriq uchun "Hozirgina" deb yozish yolg'on bo'lardi.
      meta: `Muddat: ${uzStamp(new Date(dl))} — ${overdueUz(Math.floor((nowMs - dl) / 60_000))}`,
      at,
      href: TASKS,
      unread: false,
    });
  }
  return out;
}

// PATCH /api/notifications — panel ochilganda kursorni suradi.
//
// Klient O'ZI CHIZGAN eng yangi `at` ni yuboradi (server "hozir" ini emas):
// GET bilan PATCH orasida tushgan yozuv o'qilmagan bo'lib qolishi kerak.
export async function PATCH(req: Request) {
  const me = await getCurrentUser();
  if (!me) return NextResponse.json({ ok: false, error: "Tizimga kirmagansiz" }, { status: 401 });

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Noto'g'ri so'rov" }, { status: 400 });
  }

  const seen = (body as { seen?: unknown })?.seen;
  if (!seen || typeof seen !== "object" || Array.isArray(seen)) {
    return NextResponse.json({ ok: false, error: "Noto'g'ri so'rov" }, { status: 400 });
  }

  const nowIso = new Date().toISOString();
  const set: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(seen as Record<string, unknown>)) {
    if (!KINDS.includes(k as NotifKind)) {
      return NextResponse.json({ ok: false, error: "Noto'g'ri so'rov" }, { status: 400 });
    }
    // Qat'iy kenglikdagi UTC shakli SHART: quyidagi `v <= nowIso`
    // leksikografik taqqoslash faqat shunda to'g'ri ishlaydi.
    if (typeof v !== "string" || !ISO_UTC.test(v) || v > nowIso) {
      return NextResponse.json({ ok: false, error: "Noto'g'ri so'rov" }, { status: 400 });
    }
    // Agregatsiya-quvuridagi `$max`: kursor HECH QACHON orqaga ketmaydi.
    // Ikki tab yoki ikki qurilma teskari tartibda yozsa ham eng yangisi
    // qoladi. `$max` yo'q maydonni e'tiborsiz qoldiradi, ya'ni birinchi
    // yozuv qo'shimcha shartsiz ishlaydi.
    set[`lastSeenNotifAt.${k}`] = { $max: [`$lastSeenNotifAt.${k}`, v] };
  }
  if (Object.keys(set).length === 0) {
    return NextResponse.json({ ok: false, error: "Noto'g'ri so'rov" }, { status: 400 });
  }

  const db = await ensureIndexes();
  await db.collection("users").updateOne({ _id: new ObjectId(me.id) }, [{ $set: set }]);
  return NextResponse.json({ ok: true });
}
