import { MongoClient, Db } from "mongodb";
import { ARCHIVED_GROUPS_COLLECTION } from "@/lib/groups";
import { LEGACY_COLLECTION } from "@/lib/legacyEntries";
import { SETTINGS_LIST_KINDS } from "@/lib/settingsLists";

// MongoDB ulanishi — dev rejimida HMR har safar yangi ulanish ochib
// yubormasligi uchun global keshda saqlaymiz.
const uri = process.env.MONGODB_URI;
const dbName = process.env.MONGODB_DB || "crm_akademiya";

if (!uri) {
  // Ilk chaqiruvda tushunarli xato beramiz (build vaqtida emas, so'rov vaqtida).
  console.warn("[mongodb] MONGODB_URI .env.local da o'rnatilmagan");
}

let clientPromise: Promise<MongoClient> | undefined;

declare global {
  var _mongoClientPromise: Promise<MongoClient> | undefined;
}

// ULANISHLAR POOLI ATAYLAB KICHIK.
//
// Klaster — Atlas M0 (bepul tarif), unda JAMI 500 ta ulanish chegarasi bor.
// Drayverning standart `maxPoolSize` qiymati esa 100. Ya'ni bitta dev
// server + bir nechta o'lchov skripti (scripts/_*.mjs, har biri o'z
// MongoClient'ini ochadi) chegarani to'ldirib qo'yishi mumkin — o'shanda
// Atlas YANGI ulanishlarni rad etadi va butun ilova "ishlamay qoladi".
// Bu amalda bir marta sodir bo'lgan.
//
// NEGA 20 EMAS, 5 — CHEGARA POOL EMAS, NUSXALAR SONI.
//
// Ilgari bu yerda 20 turardi va hisobi shunday edi: "har bir so'rov
// ~150 ms, ya'ni 20 ta ulanish sekundiga ~130 ta amalni bajaradi".
// Hisob to'g'ri, lekin u BITTA jarayonni nazarda tutgan. Vercel'da esa
// jarayon bitta emas: har bir serverless NUSXA o'z poolini ochadi va
// chegara pool hajmiga emas, NUSXALAR SONIGA ko'paytiriladi.
//
//     maxPoolSize 20  ->  500 / 20  =  atigi 25 nusxa sig'adi
//     maxPoolSize 5   ->  500 / 5   =  100 nusxa
//
// Bu ko'paytuvchi bu ilovada ayniqsa katta, chunki bitta sahifa
// ochilishi 5-10 ta /api so'rovini PARALLEL yuboradi va Vercel ularni
// turli nusxalarga tarqatishi mumkin — ya'ni bitta foydalanuvchining
// bitta harakati bir necha pool ochadi.
//
// 2026-09-04 da o'lchandi: 354/500 band, Atlas ogohlantirish xati
// yubordi va yangi ulanishlar TLS darajasida rad etila boshladi
// (`SSL alert 80`, drayverda `SystemOverloadedError`). 354 / 20 ~ 18
// nusxa — ya'ni chegarani to'ldirish uchun 18 ta issiq nusxa yetarli
// bo'lgan.
//
// 5 ta ulanish bitta so'rov uchun yetarli: bu yerdagi eng "keng"
// yo'llar ham 3-5 ta parallel so'rov qiladi. `ensureIndexes` dagi 72 ta
// `createIndex` bundan mustasno, lekin u FONDA ketadi (natijasi
// kutilmaydi), ya'ni navbatda turishi hech kimni to'smaydi.
//
// `maxIdleTimeMS` ataylab 60 s da qoldirildi: uni qisqartirish bo'sh
// ulanishni tezroq qaytaradi-yu, har qaytishdan keyin yangi TLS qo'l
// siqishini (~100-200 ms) so'rov yo'liga qo'shardi. Asosiy bosim
// pool HAJMIDA edi, bo'sh turish muddatida emas.
const POOL = {
  maxPoolSize: 5,
  minPoolSize: 0,
  maxIdleTimeMS: 60_000,
};

function createClient() {
  const client = new MongoClient(uri as string, POOL);
  return client.connect();
}

// MUVAFFAQIYATSIZ ULANISH KESHDA QOLMASLIGI KERAK.
//
// NIMA BO'LGAN EDI: bu yerda `clientPromise = createClient()` turardi.
// Agar o'sha birinchi `connect()` rad etilsa (masalan Atlas ulanishlar
// chegarasi to'lib, TLS darajasida rad javob bersa), REDDETILGAN promise
// modul darajasida keshlanib qolardi. Vercel'dagi har bir nusxa uni butun
// umri davomida qayta ishlatadi, ya'ni o'sha nusxaga tushgan HAR BIR
// keyingi so'rov ham yiqiladi — baza allaqachon tiklangan bo'lsa ham.
//
// Amalda shunday bo'ldi: ulanishlar chegarasi bir necha daqiqaga to'ldi,
// lekin sayt undan keyin ham 500 qaytaraverdi va o'zi tiklanmadi — qo'lda
// qayta deploy qilishga to'g'ri keldi.
//
// ENDI: xato bo'lsa kesh tozalanadi va KEYINGI so'rov qaytadan urinadi.
// Bu lib/clientCache.ts dagi bilan bir xil qoida (u ham xato natijani
// keshda qoldirmaydi).
function getClientPromise(): Promise<MongoClient> {
  const cached = process.env.NODE_ENV === "development"
    ? global._mongoClientPromise
    : clientPromise;
  if (cached) return cached;

  const p = createClient().catch((err) => {
    // Faqat O'ZIMIZNING yozuvni tozalaymiz — shu orada boshqa urinish
    // muvaffaqiyatli bo'lgan bo'lishi mumkin.
    if (process.env.NODE_ENV === "development") {
      if (global._mongoClientPromise === p) global._mongoClientPromise = undefined;
    } else if (clientPromise === p) {
      clientPromise = undefined;
    }
    throw err;
  });

  if (process.env.NODE_ENV === "development") global._mongoClientPromise = p;
  else clientPromise = p;
  return p;
}

export async function getDb(): Promise<Db> {
  if (!uri) throw new Error("MONGODB_URI o'rnatilmagan (.env.local ni tekshiring)");
  const client = await getClientPromise();
  return client.db(dbName);
}

let indexesEnsured = false;

// Kerakli indekslarni bir marta yaratamiz: telefon unikal, verification kodlar
// uchun TTL (rate-limit oynasidan keyin avtomatik o'chadi).

/**
 * Baza allaqachon indekslanganmi? Bitta arzon so'rov (~150 ms).
 *
 * Tekshiruv nima uchun kerakligi `ensureIndexes` izohida.
 */
async function alreadyIndexed(db: Db): Promise<boolean> {
  try {
    const idx = await db.collection("pupils").indexes();
    return idx.some((i) => i.name === "id_1");
  } catch {
    return false;
  }
}

/**
 * Barcha indekslarni yaratadi. `createIndex` mavjud indeks uchun ham
 * to'liq round-trip turadi, shuning uchun chaqiruvlar PARALLEL ketadi.
 *
 * Deploy paytida bir marta ishga tushirish uchun:
 *   node scripts/ensure-indexes.mjs
 */
async function createAllIndexes(db: Db): Promise<void> {
  const tasks: Promise<unknown>[] = [];
  tasks.push(db.collection("users").createIndex({ phone: 1 }, { unique: true }));
  tasks.push(db.collection("users").createIndex({ "invite.token": 1 }, { sparse: true }));
  tasks.push(db.collection("employees").createIndex({ phone: 1 }));
  tasks.push(db.collection("verification_codes").createIndex({ phone: 1, purpose: 1 }));
  // user_sessions — "Aktiv qurilmalar". Bitta yozuv = bitta qurilmadagi login;
  // yozuv o'chirilsa, o'sha qurilma keyingi sahifada tizimdan chiqariladi.
  tasks.push(db.collection("user_sessions").createIndex({ sid: 1 }, { unique: true }));
  tasks.push(db.collection("user_sessions").createIndex({ userId: 1 }));
  // purgeAt vaqti kelganda hujjat avtomatik o'chadi (TTL).
  tasks.push(db.collection("verification_codes").createIndex({ purgeAt: 1 }, { expireAfterSeconds: 0 }));
  tasks.push(db.collection("tasks").createIndex({ id: 1 }, { unique: true }));
  // Navbardagi qo'ng'iroq: muddati o'tgan topshiriqlar
  // (app/api/notifications). `state` yopiq ro'yxatdan uchta aniq qiymat
  // ($in — uchta chegaralangan sakrash), keyin `date` oralig'i va saralashi.
  // `$ne: "bajarilgan"` ishlatilmaydi: inkor indeksda sakrash bermaydi.
  tasks.push(db.collection("tasks").createIndex({ state: 1, date: -1 }));
  // task_types — Topshiriqlar sahifasidagi "Topshiriq turi" boshqaruvi.
  tasks.push(db.collection("task_types").createIndex({ id: 1 }, { unique: true }));
  tasks.push(db.collection("orders").createIndex({ id: 1 }, { unique: true }));
  // Filial ichidagi tartib raqami (Order.branchNo) — POST /api/orders har
  // safar shu filialning eng kattasini qidiradi.
  tasks.push(db.collection("orders").createIndex({ branchId: 1, branchNo: -1 }));
  tasks.push(db.collection("pupils").createIndex({ id: 1 }, { unique: true }));
  // Aktiv/Arxiv o'quvchilar sahifalari `?status=` bilan SERVERDA
  // filtrlaydi (6 732 tadan 4 276 va 2 456). Saralash `id` bo'yicha
  // teskari, shu bois indeks juft.
  tasks.push(db.collection("pupils").createIndex({ status: 1, id: -1 }));
  // Filial qamrovi (lib/branchScope.ts) — har bir ro'yxat so'rovi endi
  // `branchId` bo'yicha kesiladi. Saralash `id` bo'yicha teskari, shu
  // bois indeks juft; xona va guruh ro'yxatlari kichik, ularga oddiy
  // indeks yetadi.
  tasks.push(db.collection("pupils").createIndex({ branchId: 1, id: -1 }));
  tasks.push(db.collection("groups").createIndex({ branchId: 1 }));
  tasks.push(db.collection("rooms").createIndex({ branchId: 1 }));
  // XODIM FILIALI — ikkita ALOHIDA maydon, ikkita alohida indeks
  // (lib/employeeBranches.ts izohiga qarang):
  //   `branchIds`       — MASSIV (multikey): xodim ro'yxatlari va profil;
  //   `payrollBranchId` — skalyar: oylik ro'yxati, aynan bitta filial.
  // 54 hujjatda tezlik farqi sezilmaydi — indeks bu yerda QOIDANI
  // HUJJATLASHTIRADI va o'sish uchun joy qoldiradi.
  tasks.push(db.collection("hr_employees").createIndex({ branchIds: 1, id: 1 }));
  tasks.push(db.collection("hr_employees").createIndex({ payrollBranchId: 1, id: 1 }));
  // Oylik chiqarish qulfi — bir filial × bir oy uchun bitta amal.
  // TTL zaxira sifatida: jarayon o'ldirilsa qulf 120 soniyada o'chadi va
  // filial abadiy qulflanib qolmaydi (odatda `finally` uni o'zi o'chiradi).
  tasks.push(
    db.collection("salary_run_locks").createIndex({ createdAt: 1 }, { expireAfterSeconds: 120 }),
  );
  tasks.push(db.collection("offline_courses").createIndex({ id: 1 }, { unique: true }));
  tasks.push(db.collection("online_courses").createIndex({ id: 1 }, { unique: true }));
  tasks.push(db.collection("groups").createIndex({ id: 1 }, { unique: true }));
  // Guruhlar arxivi — `id` bu yerda ham unique: ko'chirish skripti qayta
  // ishga tushsa dublikat qilmaydi, nextGroupId esa shu indeks bo'yicha
  // eng katta id'ni bitta o'qishda topadi.
  tasks.push(db.collection(ARCHIVED_GROUPS_COLLECTION).createIndex({ id: 1 }, { unique: true }));
  tasks.push(db.collection("group_tasks").createIndex({ id: 1 }, { unique: true }));
  tasks.push(db.collection("group_tasks").createIndex({ groupId: 1 }));
  // group_lessons — Guruh tafsiloti > "Mashg'ulot qo'shish" tabi.
  // `id` global ketma-ket (group_tasks kabi), so'rov esa doim groupId bo'yicha.
  tasks.push(db.collection("group_lessons").createIndex({ id: 1 }, { unique: true }));
  tasks.push(db.collection("group_lessons").createIndex({ groupId: 1 }));
  // attendance — guruh davomati. Bitta yozuv = (guruh, o'quvchi, sana)
  // uchligi, shuning uchun kalit unique. `date` — "YYYY-MM-DD" satri, oy
  // bo'yicha so'rov shu indeksdan prefiks sifatida foydalanadi.
  tasks.push(db.collection("attendance").createIndex(
    { groupId: 1, pupilId: 1, date: 1 },
    { unique: true },
  ));
  tasks.push(db.collection("attendance").createIndex({ groupId: 1, date: 1 }));
  // O'QUVCHI bo'yicha — o'quvchilar Telegram boti (lib/studentBot/data.ts)
  // "Davomat" va "Baholar" bo'limlarida guruhni BILMAY so'raydi: o'quvchi
  // bir nechta guruhda bo'lishi mumkin va hammasi birga ko'rsatiladi.
  // Yuqoridagi qo'shma indeks bunga yaramaydi — uning birinchi ustuni
  // `groupId`, ya'ni u berilmasa indeks ochilmaydi.
  tasks.push(db.collection("attendance").createIndex({ pupilId: 1, date: -1 }));
  // attendance_history — Davomat katakchasi bo'yicha o'zgarishlar tarixi
  // ("Tarixi" bo'limi). Yozuvlar hech qachon o'chirilmaydi.
  tasks.push(db.collection("attendance_history").createIndex({ id: 1 }, { unique: true }));
  tasks.push(db.collection("attendance_history").createIndex({ groupId: 1, pupilId: 1, date: 1 }));
  // group_notes — Davomat > "Izoh" ustunidagi o'quvchiga yozilgan xabarlar.
  tasks.push(db.collection("group_notes").createIndex({ id: 1 }, { unique: true }));
  tasks.push(db.collection("group_notes").createIndex({ groupId: 1, pupilId: 1 }));
  // hr_employees — edutizim dizaynidagi to'liq xodim roster (invite oqimidagi
  // `employees` kolleksiyasidan ALOHIDA; ular turli shakl/vazifada).
  tasks.push(db.collection("hr_employees").createIndex({ id: 1 }, { unique: true }));
  // employee_notes — Xodim profili > "Eslatma". Demo bilan to'ldirilmaydi.
  tasks.push(db.collection("employee_notes").createIndex({ id: 1 }, { unique: true }));
  tasks.push(db.collection("employee_notes").createIndex({ employeeId: 1 }));
  // Imtihon bo'limi — Oylik imtihon va UzBMB natijalari.
  tasks.push(db.collection("monthly_exams").createIndex({ id: 1 }, { unique: true }));
  tasks.push(db.collection("monthly_exams").createIndex({ month: 1 }));
  tasks.push(db.collection("uzbmb_exams").createIndex({ id: 1 }, { unique: true }));
  tasks.push(db.collection("uzbmb_exams").createIndex({ month: 1 }));
  // group_exams — "Natija kiritish" paneli (guruh bo'yicha imtihon).
  // Sarhisob sahifasi joriy filialnikini sana bo'yicha teskari o'qiydi.
  tasks.push(db.collection("group_exams").createIndex({ id: 1 }, { unique: true }));
  tasks.push(db.collection("group_exams").createIndex({ branchId: 1, date: -1 }));
  // cv_applications — Boshqaruv > Ishga qabul (CV). `sid` ommaviy /ariza
  // sahifasi va Google Sheets'dan kelgan yozuvlarni takrorlamaslik uchun.
  tasks.push(db.collection("cv_applications").createIndex({ id: 1 }, { unique: true }));
  tasks.push(db.collection("cv_applications").createIndex({ sid: 1 }, { sparse: true }));
  tasks.push(db.collection("edu_categories").createIndex({ id: 1 }, { unique: true }));
  tasks.push(db.collection("seasonal_assessments").createIndex({ id: 1 }, { unique: true }));
  tasks.push(db.collection("contracts").createIndex({ id: 1 }, { unique: true }));
  tasks.push(db.collection("cashboxes").createIndex({ id: 1 }, { unique: true }));
  tasks.push(db.collection("bonuses").createIndex({ id: 1 }, { unique: true }));
  tasks.push(db.collection("penalties").createIndex({ id: 1 }, { unique: true }));
  tasks.push(db.collection("salary_runs").createIndex({ id: 1 }, { unique: true }));
  tasks.push(db.collection("transactions").createIndex({ id: 1 }, { unique: true }));
  tasks.push(db.collection("transactions").createIndex({ date: 1 }));
  // Journal tab'i sana oralig'i bo'yicha sahifalab o'qiydi va bir kun
  // ichida `id` bo'yicha saralaydi. Bitta `date` indeksi tiebreak'ni
  // qoplamaydi — qolgani xotirada saralanardi.
  tasks.push(db.collection("transactions").createIndex({ date: 1, id: 1 }));
  tasks.push(db.collection("transaction_types").createIndex({ id: 1 }, { unique: true }));
  tasks.push(db.collection("transaction_entries").createIndex({ id: 1 }, { unique: true }));
  // O'quvchi va xodim profillari har ochilganda shu ikki maydon bo'yicha
  // so'rov ketadi (app/api/transaction-entries/route.ts).
  tasks.push(db.collection("transaction_entries").createIndex({ studentName: 1, date: -1 }));
  tasks.push(db.collection("transaction_entries").createIndex({ moderator: 1, date: -1 }));
  // Kassalar sahifasi doim BITTA kassani va standart holatda bugungi
  // kunni ko'rsatadi — server tomondagi filtr shu indeksdan foydalanadi.
  tasks.push(db.collection("transaction_entries").createIndex({ cashboxId: 1, date: -1 }));
  // Jadval sahifalab o'qiladi va `id` bo'yicha teskari saralanadi. Bu indeks
  // bo'lmasa Mongo `id_1` ni teskari yurib kerakli kassani QIDIRARDI: 50 qator
  // uchun 5 079 hujjat o'qilardi (explain bilan o'lchangan).
  tasks.push(db.collection("transaction_entries").createIndex({ cashboxId: 1, id: -1 }));
  // Oylik hisobi bir oydagi hamma kirim/chiqimni `txType` + sana prefiksi
  // bo'yicha o'qiydi (lib/payrollSources.ts → loadCollectedByTeacher,
  // loadPaidByEmployee). Oy tanlagich qo'shilgach bu so'rov har oy
  // almashtirilganda takrorlanadi; mos indeks bo'lmasa butun kolleksiya
  // skanerlanardi. `^YYYY-MM-` — prefiksga bog'langan regex, ya'ni indeks
  // oralig'idan foydalana oladi.
  tasks.push(db.collection("transaction_entries").createIndex({ txType: 1, date: 1 }));
  // Navbardagi qo'ng'iroq: so'nggi kirimlar (app/api/notifications).
  // Tenglik (`txType`) → ro'yxat (`cashboxId: $in`) → oraliq va saralash
  // (`createdAt`) — maydonlar tartibi aynan shu bo'lishi kerak.
  tasks.push(db.collection("transaction_entries").createIndex({ txType: 1, cashboxId: 1, createdAt: -1 }));
  // Moliya > Sinxronizatsiya (lib/sync). `sync_outbox` — Google Sheets va
  // Telegram'ga yetkazib berish navbati. Unikal indeks ENG MUHIMI: u
  // bitta yozuvning bitta hodisasi ikki marta navbatga tushishiga yo'l
  // qo'ymaydi, ya'ni jadvalda dublikat qator, guruhda takroriy xabar
  // paydo bo'lmaydi (tugma ikki marta bosilsa ham).
  tasks.push(db.collection("sync_outbox").createIndex({ kind: 1, entryId: 1, event: 1 }, { unique: true }));
  // Yuborishga tayyorlarini tanlash uchun (status + kutish vaqti).
  tasks.push(db.collection("sync_outbox").createIndex({ status: 1, nextAttemptAt: 1 }));
  tasks.push(db.collection("sync_runs").createIndex({ id: 1 }, { unique: true }));
  // Oyliklar xulosasi — bitta davrga BITTA xabar. Unikal indeks buni
  // SERVER tomonda ushlab turadi, kodning ehtiyotkorligiga tayanmaydi:
  // cron kuniga o'nlab marta chaqirilishi mumkin (scripts/sync-backfill.mjs
  // uni ketma-ket 40 martagacha uradi), va ikkita Vercel nusxasi bir
  // vaqtda ishga tushsa ham faqat bittasi hujjatni yarata oladi.
  tasks.push(db.collection("sync_digests").createIndex({ period: 1 }, { unique: true }));
  tasks.push(db.collection("planned_expenses").createIndex({ id: 1 }, { unique: true }));
  tasks.push(db.collection("finance_contracts").createIndex({ id: 1 }, { unique: true }));
  tasks.push(db.collection("turnstile_io").createIndex({ id: 1 }, { unique: true }));
  tasks.push(db.collection("turnstile_io").createIndex({ date: 1 }));
  tasks.push(db.collection("support_analytics").createIndex({ id: 1 }, { unique: true }));
  tasks.push(db.collection("roles").createIndex({ id: 1 }, { unique: true }));
  // `key` — lavozim kaliti (teacher/moderator). Ruxsatlar shu bo'yicha
  // o'qiladi, va bir kalitli ikkita yozuv bo'lishi mumkin emas.
  tasks.push(db.collection("roles").createIndex({ key: 1 }, { unique: true, sparse: true }));
  // `branches` — Boshqaruv > Filiallar (CRUD ro'yxati). Nazorat >
  // "Filiallar holati" bundan foydalanmaydi, u constants'dan hisoblaydi.
  tasks.push(db.collection("branches").createIndex({ id: 1 }, { unique: true }));
  tasks.push(db.collection("work_schedules").createIndex({ id: 1 }, { unique: true }));
  tasks.push(db.collection("surveys").createIndex({ id: 1 }, { unique: true }));
  tasks.push(db.collection("news").createIndex({ id: 1 }, { unique: true }));
  tasks.push(db.collection("stories").createIndex({ id: 1 }, { unique: true }));
  tasks.push(db.collection("sms_templates").createIndex({ id: 1 }, { unique: true }));
  tasks.push(db.collection("sms_messages").createIndex({ id: 1 }, { unique: true }));
  tasks.push(db.collection("sms_messages").createIndex({ date: 1 }));
  // Plan moderator ISMI bo'yicha kalitlanadi — lib/salesPlan.ts izohiga qarang.
  tasks.push(db.collection("sales_plans").createIndex({ moderatorName: 1 }, { unique: true }));
  tasks.push(db.collection("settings").createIndex({ key: 1 }, { unique: true }));
  // O'quvchi profilidagi "Harakatlar tarixi" tabi shu kolleksiyadan o'qiydi
  // (app/api/pupils/[id]/activity). Yozuvlar o'quvchi va sana bo'yicha
  // olinadi, shuning uchun qo'shma indeks.
  tasks.push(db.collection("pupil_activity").createIndex({ pupilId: 1, date: -1 }));
  tasks.push(db.collection("pupil_activity").createIndex({ id: 1 }, { unique: true }));
  // legacy_entries — edutizimdan ko'chirilgan to'lov arxivi (25 561 yozuv).
  // O'quvchi profili ham, o'quvchilar boti ham uni `pupilId` bo'yicha
  // so'raydi va `at` bo'yicha saralaydi. Indekssiz bu har safar to'liq
  // skaner edi.
  tasks.push(db.collection(LEGACY_COLLECTION).createIndex({ pupilId: 1, at: -1 }));
  // student_bot_users — Telegram hisobi ↔ o'quvchi bog'lanishi
  // (lib/studentBot/users.ts).
  //
  // `chatId` UNIQUE: bitta Telegram suhbati bitta hujjat. Usiz
  // `linkBotUser` dagi upsert poyga holatida takror hujjat yaratardi va
  // o'quvchi ikkita bir xil xabar olardi.
  tasks.push(db.collection("student_bot_users").createIndex({ chatId: 1 }, { unique: true }));
  // Avtomatik xabar yuborishda "shu o'quvchiga kim ulangan" so'raladi.
  // `links` — massiv, ya'ni multikey indeks.
  tasks.push(db.collection("student_bot_users").createIndex({ "links.pupilId": 1 }));
  // Sozlamalardagi CRUD ro'yxatlari — kolleksiya nomlari SETTINGS_LIST_KINDS
  // dan olinadi, shunda yangi ro'yxat qo'shilganda bu yer o'zi yangilanadi.
  for (const c of Object.values(SETTINGS_LIST_KINDS)) {
    tasks.push(db.collection(c).createIndex({ id: 1 }, { unique: true }));
  }
  // Hisobotlar bo'limidagi o'quvchi to'lov/davomat hisobotlari
  // (app/api/student-reports/route.ts).
  for (const c of [
    "unpaid_students",
    "price_differences",
    "cancelled_payments",
    "student_discounts",
    "cancelled_attendance",
    "leave_reasons",
  ]) {
    tasks.push(db.collection(c).createIndex({ id: 1 }, { unique: true }));
  }
  await Promise.all(tasks);
}

/**
 * Bazani qaytaradi va indekslar borligiga kafolat beradi.
 *
 * NEGA HAMMA VAQT KUTMAYMIZ: 72 ta `createIndex` PARALLEL ketganda ham
 * Atlas'da ~3.6 soniya turadi (o'lchandi: scripts/_time-indexes.mjs) va
 * deyarli har doim HECH NARSA qilmaydi — indekslar allaqachon joyida.
 * Bu vaqt har sovuq startda birinchi so'rovning oldida turardi.
 *
 * Shuning uchun:
 *   - baza allaqachon indekslangan bo'lsa -> tekshiruv FONDA ketadi,
 *     so'rov kutmaydi;
 *   - baza YANGI bo'lsa -> KUTAMIZ. Unique indekslar takror yozuvdan
 *     saqlaydi (masalan `pupils.id`), ular yo'q paytda yozuvga ruxsat
 *     berib bo'lmaydi.
 */
export async function ensureIndexes(): Promise<Db> {
  const db = await getDb();
  if (indexesEnsured) return db;
  indexesEnsured = true;

  // TARTIB MUHIM: tekshiruv `createAllIndexes` dan OLDIN bo'lishi SHART.
  // Aks holda tekshiruv O'ZIMIZ endi jo'natgan `pupils.createIndex` ning
  // natijasini ko'radi va yangi bazada ham "indekslangan" deb xulosa qilib,
  // kutish kafolatini buzadi.
  const indexed = await alreadyIndexed(db);

  const work = createAllIndexes(db).catch((e) => {
    indexesEnsured = false; // keyingi so'rov qayta urinsin
    throw e;
  });

  if (indexed) {
    // Fonda — natijasini kutmaymiz, lekin xatosi yutilib ketmasin.
    void work.catch((e) => console.error("[mongodb] indekslarni tekshirishda xatolik:", e));
    return db;
  }

  await work;
  return db;
}
