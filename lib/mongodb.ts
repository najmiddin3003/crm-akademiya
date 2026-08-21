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
export async function ensureIndexes(): Promise<Db> {
  const db = await getDb();
  if (indexesEnsured) return db;
  indexesEnsured = true;
  try {
    await db.collection("users").createIndex({ phone: 1 }, { unique: true });
    await db.collection("users").createIndex({ "invite.token": 1 }, { sparse: true });
    await db.collection("employees").createIndex({ phone: 1 });
    await db.collection("verification_codes").createIndex({ phone: 1, purpose: 1 });
    // user_sessions — "Aktiv qurilmalar". Bitta yozuv = bitta qurilmadagi login;
    // yozuv o'chirilsa, o'sha qurilma keyingi sahifada tizimdan chiqariladi.
    await db.collection("user_sessions").createIndex({ sid: 1 }, { unique: true });
    await db.collection("user_sessions").createIndex({ userId: 1 });
    // purgeAt vaqti kelganda hujjat avtomatik o'chadi (TTL).
    await db.collection("verification_codes").createIndex({ purgeAt: 1 }, { expireAfterSeconds: 0 });
    await db.collection("tasks").createIndex({ id: 1 }, { unique: true });
    await db.collection("orders").createIndex({ id: 1 }, { unique: true });
    await db.collection("pupils").createIndex({ id: 1 }, { unique: true });
    await db.collection("offline_courses").createIndex({ id: 1 }, { unique: true });
    await db.collection("groups").createIndex({ id: 1 }, { unique: true });
    await db.collection("group_tasks").createIndex({ id: 1 }, { unique: true });
    await db.collection("group_tasks").createIndex({ groupId: 1 });
    // attendance — guruh davomati. Bitta yozuv = (guruh, o'quvchi, sana)
    // uchligi, shuning uchun kalit unique. `date` — "YYYY-MM-DD" satri, oy
    // bo'yicha so'rov shu indeksdan prefiks sifatida foydalanadi.
    await db.collection("attendance").createIndex(
      { groupId: 1, pupilId: 1, date: 1 },
      { unique: true },
    );
    await db.collection("attendance").createIndex({ groupId: 1, date: 1 });
    // attendance_history — Davomat katakchasi bo'yicha o'zgarishlar tarixi
    // ("Tarixi" bo'limi). Yozuvlar hech qachon o'chirilmaydi.
    await db.collection("attendance_history").createIndex({ id: 1 }, { unique: true });
    await db.collection("attendance_history").createIndex({ groupId: 1, pupilId: 1, date: 1 });
    // group_notes — Davomat > "Izoh" ustunidagi o'quvchiga yozilgan xabarlar.
    await db.collection("group_notes").createIndex({ id: 1 }, { unique: true });
    await db.collection("group_notes").createIndex({ groupId: 1, pupilId: 1 });
    // hr_employees — edutizim dizaynidagi to'liq xodim roster (invite oqimidagi
    // `employees` kolleksiyasidan ALOHIDA; ular turli shakl/vazifada).
    await db.collection("hr_employees").createIndex({ id: 1 }, { unique: true });
    // Imtihon bo'limi — Oylik imtihon va UzBMB natijalari.
    await db.collection("monthly_exams").createIndex({ id: 1 }, { unique: true });
    await db.collection("monthly_exams").createIndex({ month: 1 });
    await db.collection("uzbmb_exams").createIndex({ id: 1 }, { unique: true });
    await db.collection("uzbmb_exams").createIndex({ month: 1 });
    // cv_applications — Boshqaruv > Ishga qabul (CV). `sid` ommaviy /ariza
    // sahifasi va Google Sheets'dan kelgan yozuvlarni takrorlamaslik uchun.
    await db.collection("cv_applications").createIndex({ id: 1 }, { unique: true });
    await db.collection("cv_applications").createIndex({ sid: 1 }, { sparse: true });
    await db.collection("edu_categories").createIndex({ id: 1 }, { unique: true });
    await db.collection("seasonal_assessments").createIndex({ id: 1 }, { unique: true });
    await db.collection("contracts").createIndex({ id: 1 }, { unique: true });
    await db.collection("cashboxes").createIndex({ id: 1 }, { unique: true });
    await db.collection("bonuses").createIndex({ id: 1 }, { unique: true });
    await db.collection("penalties").createIndex({ id: 1 }, { unique: true });
    await db.collection("salary_runs").createIndex({ id: 1 }, { unique: true });
    await db.collection("transactions").createIndex({ id: 1 }, { unique: true });
    await db.collection("transactions").createIndex({ date: 1 });
    await db.collection("transaction_types").createIndex({ id: 1 }, { unique: true });
    await db.collection("transaction_entries").createIndex({ id: 1 }, { unique: true });
    // O'quvchi va xodim profillari har ochilganda shu ikki maydon bo'yicha
    // so'rov ketadi (app/api/transaction-entries/route.ts).
    await db.collection("transaction_entries").createIndex({ studentName: 1, date: -1 });
    await db.collection("transaction_entries").createIndex({ moderator: 1, date: -1 });
    await db.collection("planned_expenses").createIndex({ id: 1 }, { unique: true });
    await db.collection("finance_contracts").createIndex({ id: 1 }, { unique: true });
    await db.collection("turnstile_io").createIndex({ id: 1 }, { unique: true });
    await db.collection("turnstile_io").createIndex({ date: 1 });
    await db.collection("support_analytics").createIndex({ id: 1 }, { unique: true });
    await db.collection("roles").createIndex({ id: 1 }, { unique: true });
    // `branches` — Boshqaruv > Filiallar (CRUD ro'yxati). Nazorat >
    // "Filiallar holati" bundan foydalanmaydi, u constants'dan hisoblaydi.
    await db.collection("branches").createIndex({ id: 1 }, { unique: true });
    await db.collection("work_schedules").createIndex({ id: 1 }, { unique: true });
    await db.collection("surveys").createIndex({ id: 1 }, { unique: true });
    await db.collection("news").createIndex({ id: 1 }, { unique: true });
    await db.collection("stories").createIndex({ id: 1 }, { unique: true });
    await db.collection("sms_templates").createIndex({ id: 1 }, { unique: true });
    await db.collection("sms_messages").createIndex({ id: 1 }, { unique: true });
    await db.collection("sms_messages").createIndex({ date: 1 });
    // Plan moderator ISMI bo'yicha kalitlanadi — lib/salesPlan.ts izohiga qarang.
    await db.collection("sales_plans").createIndex({ moderatorName: 1 }, { unique: true });
    await db.collection("settings").createIndex({ key: 1 }, { unique: true });
    // Sozlamalardagi CRUD ro'yxatlari — kolleksiya nomlari SETTINGS_LIST_KINDS
    // dan olinadi, shunda yangi ro'yxat qo'shilganda bu yer o'zi yangilanadi.
    for (const c of Object.values(SETTINGS_LIST_KINDS)) {
      await db.collection(c).createIndex({ id: 1 }, { unique: true });
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
      await db.collection(c).createIndex({ id: 1 }, { unique: true });
    }
  } catch (e) {
    indexesEnsured = false;
    throw e;
  }
  return db;
}
