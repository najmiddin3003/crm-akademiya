import { MongoClient, Db } from "mongodb";
import { SETTINGS_LIST_KINDS } from "@/lib/settingsLists";

// MongoDB ulanishi — dev rejimida HMR har safar yangi ulanish ochib
// yubormasligi uchun global keshda saqlaymiz.
const uri = process.env.MONGODB_URI;
const dbName = process.env.MONGODB_DB || "crm_akademiya";

if (!uri) {
  // Ilk chaqiruvda tushunarli xato beramiz (build vaqtida emas, so'rov vaqtida).
  console.warn("[mongodb] MONGODB_URI .env.local da o'rnatilmagan");
}

let clientPromise: Promise<MongoClient>;

declare global {
  var _mongoClientPromise: Promise<MongoClient> | undefined;
}

function createClient() {
  const client = new MongoClient(uri as string);
  return client.connect();
}

if (process.env.NODE_ENV === "development") {
  if (!global._mongoClientPromise) {
    global._mongoClientPromise = createClient();
  }
  clientPromise = global._mongoClientPromise;
} else {
  clientPromise = createClient();
}

export async function getDb(): Promise<Db> {
  if (!uri) throw new Error("MONGODB_URI o'rnatilmagan (.env.local ni tekshiring)");
  const client = await clientPromise;
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
  // task_types — Topshiriqlar sahifasidagi "Topshiriq turi" boshqaruvi.
  tasks.push(db.collection("task_types").createIndex({ id: 1 }, { unique: true }));
  tasks.push(db.collection("orders").createIndex({ id: 1 }, { unique: true }));
  tasks.push(db.collection("pupils").createIndex({ id: 1 }, { unique: true }));
  tasks.push(db.collection("offline_courses").createIndex({ id: 1 }, { unique: true }));
  tasks.push(db.collection("online_courses").createIndex({ id: 1 }, { unique: true }));
  tasks.push(db.collection("groups").createIndex({ id: 1 }, { unique: true }));
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
  tasks.push(db.collection("transaction_types").createIndex({ id: 1 }, { unique: true }));
  tasks.push(db.collection("transaction_entries").createIndex({ id: 1 }, { unique: true }));
  // O'quvchi va xodim profillari har ochilganda shu ikki maydon bo'yicha
  // so'rov ketadi (app/api/transaction-entries/route.ts).
  tasks.push(db.collection("transaction_entries").createIndex({ studentName: 1, date: -1 }));
  tasks.push(db.collection("transaction_entries").createIndex({ moderator: 1, date: -1 }));
  // Kassalar sahifasi doim BITTA kassani va standart holatda bugungi
  // kunni ko'rsatadi — server tomondagi filtr shu indeksdan foydalanadi.
  tasks.push(db.collection("transaction_entries").createIndex({ cashboxId: 1, date: -1 }));
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

  const work = createAllIndexes(db).catch((e) => {
    indexesEnsured = false; // keyingi so'rov qayta urinsin
    throw e;
  });

  if (await alreadyIndexed(db)) {
    // Fonda — natijasini kutmaymiz, lekin xatosi yutilib ketmasin.
    void work.catch((e) => console.error("[mongodb] indekslarni tekshirishda xatolik:", e));
    return db;
  }

  await work;
  return db;
}
