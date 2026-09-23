import { NextResponse } from "next/server";
import { ensureIndexes } from "@/lib/mongodb";
import { getCurrentEmployee, ownsCashbox } from "@/lib/currentEmployee";
import type { TransactionEntry } from "@/lib/transactionEntries";
import { pupilEntryMatch, pupilNameOfDoc } from "@/lib/pupilEntries";

// Moliya → Tranzaksiyalar backend'i (MongoDB `transaction_entries`, faqat
// o'qish uchun — bu sahifada qo'shish/tahrirlash/o'chirish yo'q). Demo seed
// YO'Q — yozuvlar kassa amallaridan (Kirim/Chiqim) kelib chiqadi.
const TX_TYPES = ["payIn", "payOut", "transfer"];
const STATUSES = ["cancelled", "waiting"];

/** Foydalanuvchi kiritgan matnni $regex ichiga xavfsiz qo'yish uchun. */
function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// Ism bo'yicha solishtirish katta-kichik harf va ortiqcha bo'shliqqa
// bog'liq bo'lmasin — yozuvlar turli oqimlardan (demo seed, Kirim oynasi)
// keladi. components/finance/CashboxesPage.tsx dagi name→id xaritalari ham
// shu qoidada ishlaydi.
function nameFilter(value: string) {
  return { $regex: `^${escapeRegex(value.trim())}$`, $options: "i" };
}

// GET /api/transaction-entries
//   ?pupilId=…      — bitta o'quvchining yozuvlari ID bo'yicha (O'quvchi
//                    profili shuni ishlatadi; ismdoshlar aralashmaydi)
//   ?studentName=…   — ESKI, ism bo'yicha kesim (jurnal filtrlari)
//   ?moderator=…     — shu xodim QAYD ETGAN to'lovlar (kassir kesimi)
//   ?teacherName=…   — shu USTOZNING o'quvchilari qilgan to'lovlar
//   ?person=…        — shu xodimga OID hammasi (yuqoridagi uchtasining $or'i)
//   ?txType=payIn    — "payIn" | "payOut" | "transfer"
//   ?month=YYYY-MM   — shu oy ichidagilar
//   ?excludeCancelled=1 — bekor qilinganlarni tashlab ketadi
//
// Parametrsiz chaqirilsa javob avvalgidek — butun ro'yxat. Shu bois
// Tranzaksiyalar/Kassalar/Daromad rejasi sahifalari o'zgarishsiz ishlaydi.
export async function GET(req: Request) {
  const db = await ensureIndexes();
  const col = db.collection("transaction_entries");

  const sp = new URL(req.url).searchParams;
  const filter: Record<string, unknown> = {};

  const txType = sp.get("txType");
  if (txType) {
    if (!TX_TYPES.includes(txType)) {
      return NextResponse.json({ ok: false, error: "Noto'g'ri txType" }, { status: 400 });
    }
    filter.txType = txType;
  }

  const studentName = sp.get("studentName");
  if (studentName?.trim()) filter.studentName = nameFilter(studentName);

  // ?pupilId=… — BITTA O'QUVCHINING yozuvlari, ID bo'yicha.
  //
  // `?studentName=` NING O'RNIGA: ism yagona emas (bazada 545 ta ism
  // takrorlanadi) va o'quvchi profili ismdoshning to'lovlarini o'ziniki
  // qilib ko'rsatardi — foydalanuvchi aynan shundan shikoyat qildi
  // (23.09.2026). Shart lib/pupilEntries.ts dan: `pupilId` bor yozuvlar
  // + `pupilId` siz ESKI yozuvlar ism bo'yicha.
  //
  // O'quvchi topilmasa 404: bo'sh ro'yxat qaytarish "to'lovi yo'q" degan
  // ma'noni berardi va xatoni yashirardi.
  const pupilIdRaw = sp.get("pupilId");
  if (pupilIdRaw !== null) {
    const pupilId = Number(pupilIdRaw);
    if (!Number.isFinite(pupilId)) {
      return NextResponse.json({ ok: false, error: "Noto'g'ri pupilId" }, { status: 400 });
    }
    const p = await db
      .collection("pupils")
      .findOne({ id: pupilId }, { projection: { _id: 0, id: 1, firstName: 1, lastName: 1 } });
    if (!p) {
      return NextResponse.json({ ok: false, error: "O'quvchi topilmadi" }, { status: 404 });
    }
    // `$and` — pastdagi boshqa filtrlar (`$or: person`) bilan to'qnashmasin.
    const own = pupilEntryMatch({ id: pupilId, name: pupilNameOfDoc(p) });
    filter.$and = [...((filter.$and as unknown[]) ?? []), own];
  }

  const moderator = sp.get("moderator");
  if (moderator?.trim()) {
    filter.moderator = nameFilter(moderator);
    // Xodim profilidagi "O'quvchilar to'lovlari" — o'quvchisi ko'rsatilmagan
    // yozuv (masalan kassalar orasidagi ko'chirish) bu ro'yxatga tushmaydi.
    filter.studentName = { $nin: ["", null] };
  }

  // ?teacherName=… — SHU USTOZNING o'quvchilari qilgan to'lovlar.
  //
  // `moderator` bilan ADASHTIRMASLIK kerak: u to'lovni kassada QAYD ETGAN
  // xodim. O'qituvchi hech qachon kassir bo'lmaydi, shu bois "O'quvchilar
  // to'lovlari" tabi o'qituvchida doim bo'sh turardi (o'lchandi: bazadagi
  // 56 xodimdan ikkala maydonda ham uchraydigani 0 ta — ro'yxatlar
  // kesishmaydi).
  //
  // `teacherLike` dan farqi: u ANCHORSIZ ("ichidan qidirish", Kassalar
  // sahifasi filtri). Ikkalasi ham `filter.teacherName` ga yozadi, shuning
  // uchun birga berilmaydi — pastda tekshiriladi.
  const teacherName = sp.get("teacherName");
  if (teacherName?.trim()) {
    filter.teacherName = nameFilter(teacherName);
    filter.studentName = { $nin: ["", null] };
  }

  // ?person=… — SHU XODIMGA OID BARCHA yozuvlar: unga chiqarilgan avans/
  // oylik (`studentName`), o'quvchilari qilgan to'lovlar (`teacherName`) va
  // o'zi kassada qayd etganlari (`moderator`).
  //
  // Xodim profilidagi "Tranzaksiyalar tarixi" shuni ko'rsatadi. Bu yerda
  // `studentName` guard'i YO'Q: kassalar aro ko'chirish ham xodimga oid
  // amal va u ro'yxatdan tushib qolmasligi kerak.
  const person = sp.get("person");
  if (person?.trim()) {
    const n = nameFilter(person);
    filter.$or = [{ studentName: n }, { teacherName: n }, { moderator: n }];
  }

  const month = sp.get("month");
  if (month) {
    if (!/^\d{4}-\d{2}$/.test(month)) {
      return NextResponse.json({ ok: false, error: "Noto'g'ri month (YYYY-MM kutilgan)" }, { status: 400 });
    }
    filter.date = { $regex: `^${month}-` };
  }

  // Bekor qilingan yozuv summaga qo'shilmasligi kerak (app/api/
  // employee-salary-summary/route.ts bilan bir xil qoida). Jadvalda esa u
  // ko'rinib tursin — shuning uchun bu ixtiyoriy.
  if (sp.get("excludeCancelled") === "1") filter.status = { $ne: "cancelled" };

  // Bo'sh satr ham HAQIQIY qiymat ("" — oddiy yozuv), lekin interfeysda u
  // "filtr yo'q" degani. Klientdagi `if (status && ...)` bilan bir xil.
  //
  // Vergul bilan bir nechta holat berish mumkin: `?status=cancelled,waiting`.
  // Bu Xodim profilidagi "To'lanmagan tarixi" uchun kerak — u yerda klient
  // `e.status === "cancelled" || e.status === "waiting"` deb tekshiradi.
  const status = sp.get("status");
  if (status) {
    const parts = status.split(",").map((s) => s.trim()).filter(Boolean);
    if (parts.length === 0 || parts.some((p) => !STATUSES.includes(p))) {
      return NextResponse.json({ ok: false, error: "Noto'g'ri status" }, { status: 400 });
    }
    filter.status = parts.length > 1 ? { $in: parts } : parts[0];
  }

  // AYNAN TENGLIK bo'yicha o'quvchi filtri — yuqoridagi `studentName` dan
  // FARQ QILADI va uni qayta ishlatib bo'lmaydi.
  //
  // `?studentName=` nameFilter() dan o'tadi: chetlarini kesadi va
  // katta-kichik harfni farqlamaydi. Xodim profilidagi jadval filtri esa
  // klientda `e.studentName === fStudent` — XOM satrni aynan solishtiradi.
  // Farq nazariy emas: bazadagi 13 369 yozuvning 5 371 tasida `studentName`
  // chetida probel bor, va 2 818 ta xom ismning 1 162 tasida ikkala qoida
  // BOSHQA-BOSHQA qatorlar to'plamini qaytaradi (eng yomoni "Ismoilova
  // ezoza": aynan tenglikda 1 qator, regexda 7 qator).
  //
  // Shu bois bu yerda qiymat O'ZGARTIRILMASDAN qo'llanadi.
  const studentNameExact = sp.get("studentNameExact");
  if (studentNameExact !== null) filter.studentName = studentNameExact;

  // ?studentNames=…&studentNames=… — bir nechta o'quvchining yozuvlari.
  //
  // Xodim profilidagi "Guruh" filtri shu orqali ishlaydi: guruh yozuvda
  // SAQLANMAYDI (`transaction_entries.group` hech qachon to'ldirilmaydi),
  // shu bois guruh uning o'quvchilari ro'yxatiga aylantirilib yuboriladi.
  //
  // Aynan tenglik EMAS, anchor'li regex: bazadagi 13 369 yozuvning
  // 5 371 tasida `studentName` chetida ortiqcha probel bor va tenglikda
  // ular tushib qolardi. Mongo `$in` ichida regex qabul qiladi.
  const studentNames = sp.getAll("studentNames").map((s) => s.trim()).filter(Boolean);
  if (studentNames.length > 0) {
    // Ikkalasi ham `filter.studentName` ga yozadi — birga berilsa biri
    // ikkinchisini jimgina bosib ketardi (`teacherName`/`teacherLike` bilan
    // bir xil qoida).
    if (studentNameExact !== null) {
      return NextResponse.json(
        { ok: false, error: "studentNameExact va studentNames birga berilmaydi" },
        { status: 400 },
      );
    }
    filter.studentName = {
      $in: studentNames.map((s) => new RegExp(`^${escapeRegex(s)}$`, "i")),
    };
  }

  // Kassalar sahifasidagi jadval filtrlari — mijozdagi shartlarning AYNAN
  // ekvivalenti. components/finance/CashboxesPage.tsx `filteredEntries` da:
  //   txName      : e.txName !== txName                        → aynan tenglik
  //   paymentType : e.paymentType !== wantedPayLabel            → aynan tenglik
  //   o'quvchi    : e.studentName.toLowerCase().includes(q)     → ICHIDAN
  //   o'qituvchi  : e.teacherName.toLowerCase().includes(q)     → ICHIDAN
  //
  // "Ichidan qidirish" uchun ATAYLAB alohida nomlar. Yuqoridagi
  // `?studentName=` anchor'li (^…$) va uni bu yerda qayta ishlatib
  // BO'LMAYDI — boshqa qatorlar to'plamini qaytaradi.
  const txName = sp.get("txName");
  if (txName) filter.txName = txName;

  const paymentType = sp.get("paymentType");
  if (paymentType) filter.paymentType = paymentType;

  const studentLike = sp.get("studentLike");
  if (studentLike?.trim())
    filter.studentName = { $regex: escapeRegex(studentLike.trim()), $options: "i" };

  const teacherLike = sp.get("teacherLike");
  if (teacherLike?.trim()) {
    // Ikkalasi ham `filter.teacherName` ga yozadi — birga berilsa biri
    // ikkinchisini JIMGINA bosib ketardi va natija noto'g'ri chiqardi.
    // Hozircha hech bir chaqiruvchi ikkalasini yubormaydi; shart shu
    // holatni qulflab qo'yadi.
    if (teacherName?.trim()) {
      return NextResponse.json(
        { ok: false, error: "teacherName va teacherLike birga berilmaydi" },
        { status: 400 },
      );
    }
    filter.teacherName = { $regex: escapeRegex(teacherLike.trim()), $options: "i" };
  }

  const cashboxId = sp.get("cashboxId");
  if (cashboxId) {
    const n = Number(cashboxId);
    if (!Number.isFinite(n)) {
      return NextResponse.json({ ok: false, error: "Noto'g'ri cashboxId" }, { status: 400 });
    }
    // Kassa kesimidagi so'rov — faqat o'z kassasi. GET /api/cashboxes
    // ro'yxatni allaqachon kesadi, lekin uni chetlab o'tib bu yerga
    // to'g'ridan-to'g'ri `?cashboxId=3` yuborish mumkin edi.
    //
    // Boshqa kesimlar (`?person=`, `?studentName=`, `?moderator=`)
    // ATAYLAB tegilmaydi: ular o'quvchi va xodim profillarining manbai,
    // ularni kassa bo'yicha kesish o'quvchining boshqa kassada qilgan
    // to'lovini yo'qotib, balansni buzardi.
    const me = await getCurrentEmployee();
    if (!me) {
      return NextResponse.json({ ok: false, error: "Tizimga kirmagansiz" }, { status: 401 });
    }
    if (!me.isAdmin && !(await ownsCashbox(db, me.name, n))) {
      return NextResponse.json({ ok: false, error: "Bu kassa sizga biriktirilmagan" }, { status: 403 });
    }
    filter.cashboxId = n;
  }

  // Sana "YYYY-MM-DD" satr sifatida saqlanadi, shu bois oddiy satr
  // taqqoslash to'g'ri ishlaydi (leksikografik tartib = xronologik).
  const dateFrom = sp.get("dateFrom");
  const dateTo = sp.get("dateTo");
  const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/;
  if ((dateFrom && !ISO_DAY.test(dateFrom)) || (dateTo && !ISO_DAY.test(dateTo))) {
    return NextResponse.json({ ok: false, error: "Noto'g'ri sana (YYYY-MM-DD kutilgan)" }, { status: 400 });
  }
  if (dateFrom || dateTo) {
    // `month` ham `date` ni ishlatadi — ikkalasi berilganda biri
    // ikkinchisini bosib ketmasin.
    const range: Record<string, string> = {};
    if (dateFrom) range.$gte = dateFrom;
    if (dateTo) range.$lte = dateTo;
    filter.date = filter.date ? { ...(filter.date as object), ...range } : range;
  }

  let cursor = col.find(filter).sort({ id: -1 });
  const limitRaw = Number(sp.get("limit"));
  const paged = Number.isFinite(limitRaw) && limitRaw > 0;
  if (paged) {
    const limit = Math.min(limitRaw, 500);
    const page = Math.max(1, Number(sp.get("page")) || 1);
    cursor = cursor.skip((page - 1) * limit).limit(limit);
  }

  // `?slim=1` — jadval CHIZADIGAN maydonlargina. Xodim profilidagi jadval
  // 20 maydondan atigi 11 tasini o'qiydi, qolgani bekorga tashiladi
  // (o'rtacha hujjat 464 bayt, kerakli maydonlar bilan ~190 bayt).
  // Parametrsiz javob avvalgidek to'liq — boshqa chaqiruvchilar tegilmagan.
  if (sp.get("slim") === "1") {
    cursor = cursor.project({
      _id: 0, id: 1, date: 1, time: 1, studentName: 1, amount: 1,
      // Yozuvning EGASI — jadvaldagi ism qaysi o'quvchining profiliga
      // olib borishini shu hal qiladi (ism bo'yicha topish ismdoshda
      // noto'g'ri profilga olib borardi).
      pupilId: 1,
      before: 1, after: 1, txName: 1, status: 1, note: 1, paymentType: 1,
      // Xodim profilidagi jadval "Qabul qilgan" ustunini ko'rsatadi va
      // birlashgan ro'yxatda qator KIM orqali kelganini bilish kerak.
      // Qator boshiga ~25 bayt qo'shadi — 50 qatorda sezilmaydi.
      moderator: 1, teacherName: 1,
      // Kirim/chiqim va o'quvchiga qaytarim yozuvini ajratish uchun
      // (Kassalar sahifasi ranglari, lib/salaryLedger.ts bilan bir xil tip).
      txType: 1, studentRefund: 1,
      // Xodim profilidagi "avgust uchun" belgisi: yozuv o'z sanasining
      // oyiga emas, boshqa oyning oyligiga yozilgan bo'lsa qoldiq o'sha
      // oyning daftaridan keladi — belgisiz sakrash tushunarsiz edi.
      periodMonth: 1,
    });
  }

  const rows = await cursor.toArray();

  // `?withTotals=1` — Kirim/Chiqim yig'indisi BUTUN filtr bo'yicha, sahifadagi
  // qatorlar bo'yicha emas. Sahifalash joriy qilingach bu shart bo'ldi:
  // ilgari yig'indini klient butun ro'yxatdan hisoblardi.
  //
  // Qoida: amount > 0 → kirim, aks holda chiqim (manfiy ishorasiz).
  // amount === 0 ikkalasiga ham kirmaydi.
  //
  // FAQAT QABUL QILINGAN qatorlar sanaladi (`status` bo'sh yoki yo'q).
  // "waiting" — tasdiq kutayotgan ko'chirma: pul hali kelmagan (yoki
  // ketmagan), "cancelled" — bekor qilingan. Ilgari ikkalasi ham
  // yig'indiga kirardi va rahbar kassada kirim filiallar hali
  // topshirmagan summani ham ko'rsatardi (11.09.2026). Qatorlar SONI esa
  // filtr bo'yicha HAMMASI — jadval ularni ko'rsatadi va sahifalaydi.
  //
  // Qatorlar soni ham SHU YERDAN olinadi: aks holda aynan bir xil filtr
  // bo'yicha countDocuments() ikkinchi marta to'liq yurishga majbur bo'lardi.
  let totals: { income: number; expense: number } | undefined;
  let aggCount: number | undefined;
  if (sp.get("withTotals") === "1") {
    const accepted = { $not: [{ $in: [{ $ifNull: ["$status", ""] }, ["waiting", "cancelled"]] }] };
    const [agg] = await col
      .aggregate([
        { $match: filter },
        {
          $group: {
            _id: null,
            n: { $sum: 1 },
            income: { $sum: { $cond: [{ $and: [{ $gt: ["$amount", 0] }, accepted] }, "$amount", 0] } },
            expense: { $sum: { $cond: [{ $and: [{ $lt: ["$amount", 0] }, accepted] }, { $abs: "$amount" }, 0] } },
          },
        },
      ])
      .toArray();
    totals = { income: agg?.income ?? 0, expense: agg?.expense ?? 0 };
    aggCount = agg?.n ?? 0;
  }

  // JAMI son sahifalashdan OLDINGI holatni bildiradi — jadval ostidagi
  // "Umumiy soni" va sahifalar soni shunga tayanadi, sahifadagi qatorlar
  // soniga emas.
  //
  // Sahifalash SO'RALMAGAN bo'lsa kursor barcha mos qatorlarni qaytaradi,
  // ya'ni `total` aynan `rows.length`. Ilgari bunday chaqiruvlarda ham
  // countDocuments ishlardi — bir xil filtr bo'yicha ikkinchi to'liq
  // yurish, bepul olinadigan son uchun (~200 ms va bitta round-trip).
  // Chaqiruvchilarning to'rttasi limitsiz keladi.
  const total = !paged
    ? rows.length
    : aggCount !== undefined
      ? aggCount
      : await col.countDocuments(filter);
  const entries = rows.map(({ _id, ...rest }) => rest as unknown as TransactionEntry);
  return NextResponse.json({ ok: true, entries, total, ...(totals ? { totals } : {}) });
}
