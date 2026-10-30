import crypto from "node:crypto";
import { Binary, ObjectId, type Db } from "mongodb";

// FACE ID — «Ishga keldim / Ishdan ketdim» da yuz tekshiruvi (30.10.2026).
//
// Foydalanuvchi qarori: yuz XODIMNING O'Z TELEFONIDA tekshiriladi. Telegram
// «Ishga keldim» Mini App'i (/xodim/keldim) old kamerani ochadi, brauzer ichida
// (@vladmandic/face-api, components/employees/FaceCapture.tsx) yuzning 128
// o'lchamli raqamli izini (descriptor) hisoblaydi va bu yerga izlarni hamda
// kichik rasmni yuboradi. Server faqat SOLISHTIRADI — model serverda yo'q
// (kichik VPS yengil qoladi, tashqi xizmat yo'q, ma'lumot o'z serverimizda).
//
// Birinchi marta (yuz yo'q) — yuborilgan izlar YOZILADI (ro'yxatga olish);
// keyingi safar shu bilan solishtiriladi. Admin profilda o'chirsa, xodim
// keyingi safar qayta ro'yxatdan o'tadi.
//
// Natija — qisqa muddatli imzolangan RUXSAT (pass): /api/xodim/davomat uni
// QR kod bilan birga oladi. Yuz alohida qadamda tekshiriladi, shunda xodim
// mos kelmasa QR skanerlashdan OLDIN biladi.
//
// CHEKLOV (ochiq): iz klientda hisoblanadi — dasturchi darajasidagi odam
// soxta iz yubora oladi. Shuning uchun har tekshiruvning RASMI saqlanadi
// (SHOT_TTL_DAYS) va admin uni profilda ko'radi — asosiy to'siq shu. Masofa
// klientga hech qachon qaytarilmaydi (izni "taxmin qilib" yaqinlashtirib
// bo'lmasin), urinishlar soni cheklangan.
//
// Ma'lumot: `staff_faces` (xodimga bitta: izlar, o'rtachasi, ro'yxatga olish
// rasmi, ozodlik belgisi) va `staff_face_shots` (har urinish: rasm, natija,
// masofa — 60 kundan keyin o'zi o'chadi). Ikkalasi Atlas ko'zgusiga
// KO'CHIRILMAYDI (deploy/backup-mongo.sh) — biometrik ma'lumot faqat o'z
// serverimizda.

export const FACE_DIM = 128;
/** Ro'yxatga olishda nechta kadr izi (klient 5 ta yuboradi). */
export const ENROLL_MIN = 3;
/** Bir so'rovdagi izlar soni chegarasi. */
export const DESCRIPTORS_MAX = 8;
/** Ro'yxatga olishdagi kadrlar O'ZARO shundan uzoq bo'lmasin — bitta odam. */
const ENROLL_SPREAD_MAX = 0.5;
/** Boshqa xodimning yuziga shunchalik yaqin — bu o'sha odam. */
const DUPLICATE_MAX = 0.45;
const PHOTO_MIN_BYTES = 1_000;
const PHOTO_MAX_BYTES = 60_000;
/** Urinishlar rasmi shuncha kun saqlanadi (TTL indeksi lib/mongodb.ts da — bir xil son). */
export const SHOT_TTL_DAYS = 60;
/** Ruxsat (pass) shuncha vaqt amal qiladi: joylashuv + QR skanerlashga yetadi. */
export const FACE_PASS_TTL_MS = 5 * 60_000;
/** Shuncha muvaffaqiyatsiz urinishdan keyin… */
const FAIL_LIMIT = 8;
/** …shu oyna tugaguncha kutiladi. */
const FAIL_WINDOW_MS = 10 * 60_000;

const FACES = "staff_faces";
const SHOTS = "staff_face_shots";

export interface StaffFace {
  employeeId: number;
  /** Ro'yxatga olingan kadrlar izlari. */
  descriptors?: number[][] | null;
  /** O'rtachasi — solishtirish shu bilan. */
  mean?: number[] | null;
  /** Ro'yxatga olish rasmi (JPEG). */
  photo?: Binary | null;
  enrolledAt?: Date | null;
  /** Admin: bu xodim Face ID'siz belgilanadi (telefoni kamerani ochmaydi va h.k.). */
  exempt?: boolean;
  updatedAt?: Date;
}

export type FacePurpose = "enroll" | "verify";

export interface FaceShot {
  _id: ObjectId;
  employeeId: number;
  at: Date;
  purpose: FacePurpose;
  ok: boolean;
  /** O'rtacha izgacha masofa (tekshiruvda) — faqat adminga ko'rinadi. */
  distance: number | null;
  /** Rad etilgan bo'lsa — sabab kodi (mismatch / spread / duplicate:<id>). */
  reason: string | null;
  photo: Binary;
  /** Qaysi davomat yozuviga ishlatildi (/api/xodim/davomat). */
  attendance?: { recordId: number; kind: "in" | "out"; date: string; branchId: number };
}

// ── Kirish ma'lumotini tekshirish ───────────────────────────────────

/** Klient yuborgan izlar: [min, DESCRIPTORS_MAX] ta, har biri 128 ta chekli son. */
export function parseDescriptors(raw: unknown, min = 1): number[][] | null {
  if (!Array.isArray(raw) || raw.length < min || raw.length > DESCRIPTORS_MAX) return null;
  const out: number[][] = [];
  for (const d of raw) {
    if (!Array.isArray(d) || d.length !== FACE_DIM) return null;
    const v = d.map((x) => (typeof x === "number" ? x : NaN));
    if (!v.every((x) => Number.isFinite(x) && Math.abs(x) <= 2)) return null;
    // Nol vektor yoki shunga yaqin — iz emas.
    if (Math.sqrt(v.reduce((s, x) => s + x * x, 0)) < 0.1) return null;
    out.push(v);
  }
  return out;
}

/** `data:image/jpeg;base64,…` yoki toza base64 → JPEG bayt; noto'g'ri bo'lsa null. */
export function parsePhoto(raw: unknown): Buffer | null {
  if (typeof raw !== "string") return null;
  const b64 = raw.startsWith("data:image/jpeg;base64,") ? raw.slice("data:image/jpeg;base64,".length) : raw;
  if (b64.length > PHOTO_MAX_BYTES * 1.4 || !/^[A-Za-z0-9+/]+={0,2}$/.test(b64)) return null;
  const buf = Buffer.from(b64, "base64");
  if (buf.length < PHOTO_MIN_BYTES || buf.length > PHOTO_MAX_BYTES) return null;
  // JPEG imzosi: FF D8 FF.
  if (buf[0] !== 0xff || buf[1] !== 0xd8 || buf[2] !== 0xff) return null;
  return buf;
}

// ── Hisob ───────────────────────────────────────────────────────────

export function faceDistance(a: readonly number[], b: readonly number[]): number {
  let s = 0;
  for (let i = 0; i < FACE_DIM; i++) {
    const d = (a[i] ?? 0) - (b[i] ?? 0);
    s += d * d;
  }
  return Math.sqrt(s);
}

export function meanDescriptor(list: readonly (readonly number[])[]): number[] {
  const out = new Array<number>(FACE_DIM).fill(0);
  for (const d of list) for (let i = 0; i < FACE_DIM; i++) out[i] += d[i] / list.length;
  return out;
}

/** Kadrlar orasidagi eng katta masofa (bitta odammi?). */
export function maxSpread(list: readonly (readonly number[])[]): number {
  let max = 0;
  for (let i = 0; i < list.length; i++) {
    for (let j = i + 1; j < list.length; j++) max = Math.max(max, faceDistance(list[i], list[j]));
  }
  return max;
}

const round3 = (n: number) => Math.round(n * 1000) / 1000;

// ── Ruxsat (pass) ───────────────────────────────────────────────────
//
// `<xodim>.<urinish id>.<vaqt36>.<imzo>` — HMAC kaliti SESSION_SECRET dan
// ajratib olinadi (lib/attendanceQr.ts dagi kabi, alohida o'zgaruvchi shart emas).

function passKey(): Buffer {
  const base = process.env.SESSION_SECRET || "dev-insecure-session-secret-change-me";
  return crypto.createHmac("sha256", base).update("staff-face/v1").digest();
}

const passSig = (body: string) => crypto.createHmac("sha256", passKey()).update(body).digest("hex").slice(0, 32);

export function makeFacePass(employeeId: number, shotId: string, now = Date.now()): string {
  const body = `${employeeId}.${shotId}.${Math.floor(now / 1000).toString(36)}`;
  return `${body}.${passSig(body)}`;
}

/** Ruxsat shu xodimniki va hali amal qiladimi. Muvaffaqiyatli bo'lsa — urinish id si. */
export function readFacePass(pass: unknown, employeeId: number, now = Date.now()): string | null {
  const m = /^(\d{1,9})\.([0-9a-f]{24})\.([0-9a-z]{1,10})\.([0-9a-f]{32})$/.exec(String(pass ?? ""));
  if (!m || Number(m[1]) !== employeeId) return null;
  const age = now - parseInt(m[3], 36) * 1000;
  if (!(age >= -60_000 && age <= FACE_PASS_TTL_MS)) return null;
  const a = Buffer.from(passSig(`${m[1]}.${m[2]}.${m[3]}`), "hex");
  const b = Buffer.from(m[4], "hex");
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  return m[2];
}

// ── Baza ────────────────────────────────────────────────────────────

export async function loadFace(db: Db, employeeId: number): Promise<StaffFace | null> {
  return db.collection<StaffFace>(FACES).findOne({ employeeId }, { projection: { _id: 0 } });
}

export const isEnrolled = (f: StaffFace | null): boolean => Array.isArray(f?.mean) && f.mean.length === FACE_DIM;

export interface FaceState {
  enrolled: boolean;
  exempt: boolean;
}

export async function faceState(db: Db, employeeId: number): Promise<FaceState> {
  const f = await db.collection<StaffFace>(FACES).findOne({ employeeId }, { projection: { _id: 0, mean: 1, exempt: 1 } });
  return { enrolled: isEnrolled(f), exempt: f?.exempt === true };
}

async function saveShot(
  db: Db,
  shot: { employeeId: number; at: Date; purpose: FacePurpose; ok: boolean; distance: number | null; reason: string | null; photo: Buffer },
): Promise<string> {
  const _id = new ObjectId();
  await db.collection(SHOTS).insertOne({ _id, ...shot, photo: new Binary(shot.photo) });
  return _id.toHexString();
}

/** Davomat yozilgach — urinish qaysi yozuvga ishlatilgani (admin ko'rinishi uchun). */
export async function linkShot(db: Db, shotId: string, attendance: NonNullable<FaceShot["attendance"]>): Promise<void> {
  if (!ObjectId.isValid(shotId)) return;
  await db.collection(SHOTS).updateOne({ _id: new ObjectId(shotId) }, { $set: { attendance } });
}

export type FaceCheck =
  | { ok: true; enrolled: boolean; shotId: string; pass: string }
  | { ok: false; status: number; error: string; code: "face_mismatch" | "face_spread" | "face_duplicate" | "face_short" | "face_rate" };

/**
 * Yuzni tekshiradi: ro'yxatda yo'q bo'lsa — ro'yxatga oladi, bor bo'lsa —
 * solishtiradi. Har urinish (muvaffaqiyatsizi ham) rasmi bilan yoziladi.
 * Xodim kimligini CHAQIRUVCHI aniqlaydi (Mini App `initData`).
 */
export async function checkFace(
  db: Db,
  employeeId: number,
  descriptors: number[][],
  photo: Buffer,
  threshold: number,
  now = new Date(),
): Promise<FaceCheck> {
  const fails = await db
    .collection(SHOTS)
    .countDocuments({ employeeId, ok: false, at: { $gte: new Date(now.getTime() - FAIL_WINDOW_MS) } });
  if (fails >= FAIL_LIMIT) {
    return { ok: false, status: 429, error: "Urinishlar ko'p bo'ldi — 10 daqiqadan keyin qayta urinib ko'ring", code: "face_rate" };
  }

  const face = await loadFace(db, employeeId);
  const probe = meanDescriptor(descriptors);
  const shot = (ok: boolean, purpose: FacePurpose, distance: number | null, reason: string | null) =>
    saveShot(db, { employeeId, at: now, purpose, ok, distance, reason, photo });

  if (isEnrolled(face)) {
    const distance = round3(faceDistance(probe, face!.mean!));
    const ok = distance <= threshold;
    const shotId = await shot(ok, "verify", distance, ok ? null : "mismatch");
    if (!ok) {
      return {
        ok: false,
        status: 403,
        error: "Yuz mos kelmadi — yorug'roq joyda, kameraga to'g'ri qarab qayta urinib ko'ring",
        code: "face_mismatch",
      };
    }
    return { ok: true, enrolled: false, shotId, pass: makeFacePass(employeeId, shotId, now.getTime()) };
  }

  // ── Ro'yxatga olish ──
  if (descriptors.length < ENROLL_MIN) {
    return { ok: false, status: 400, error: "Yuz yetarlicha aniq olinmadi — qayta urinib ko'ring", code: "face_short" };
  }
  if (maxSpread(descriptors) > ENROLL_SPREAD_MAX) {
    await shot(false, "enroll", null, "spread");
    return {
      ok: false,
      status: 422,
      error: "Kadrlarda yuz bir xil chiqmadi — kadrda faqat siz bo'ling va qayta urinib ko'ring",
      code: "face_spread",
    };
  }
  // BOSHQA XODIM NOMIDA ro'yxatdan o'tgan yuz — bir odam ikki hisobga yozilmasin
  // (masalan, hamkasbi uning telefonida o'z yuzini ro'yxatga oldirsa). O'chirilgan
  // xodimlarning yuzi hisobga olinmaydi.
  const others = await db
    .collection<StaffFace>(FACES)
    .find({ employeeId: { $ne: employeeId }, mean: { $type: "array" } }, { projection: { _id: 0, employeeId: 1, mean: 1 } })
    .toArray();
  const close = others
    .filter((o) => isEnrolled(o))
    .map((o) => ({ id: o.employeeId, d: faceDistance(probe, o.mean!) }))
    .filter((o) => o.d < DUPLICATE_MAX)
    .sort((a, b) => a.d - b.d);
  if (close.length) {
    const alive = await db
      .collection("hr_employees")
      .find({ id: { $in: close.map((c) => c.id) } }, { projection: { _id: 0, id: 1 } })
      .toArray();
    const hit = close.find((c) => alive.some((a) => a.id === c.id));
    if (hit) {
      await shot(false, "enroll", round3(hit.d), `duplicate:${hit.id}`);
      return {
        ok: false,
        status: 409,
        error: "Bu yuz boshqa xodim nomida ro'yxatdan o'tgan — administratorga murojaat qiling",
        code: "face_duplicate",
      };
    }
  }

  const shotId = await shot(true, "enroll", null, null);
  await db.collection<StaffFace>(FACES).updateOne(
    { employeeId },
    {
      $set: { descriptors: descriptors.map((d) => d.map((x) => Math.round(x * 1e6) / 1e6)), mean: probe, photo: new Binary(photo), enrolledAt: now, updatedAt: now },
    },
    { upsert: true },
  );
  return { ok: true, enrolled: true, shotId, pass: makeFacePass(employeeId, shotId, now.getTime()) };
}

// ── Admin (xodim profili) ───────────────────────────────────────────

const dataUrl = (b: Binary | null | undefined) => (b ? `data:image/jpeg;base64,${b.toString("base64")}` : null);

export interface FaceAdminShot {
  id: string;
  at: string;
  purpose: FacePurpose;
  ok: boolean;
  distance: number | null;
  reason: string | null;
  photo: string | null;
  attendance: FaceShot["attendance"] | null;
}

export interface FaceAdminView {
  enrolled: boolean;
  enrolledAt: string | null;
  exempt: boolean;
  photo: string | null;
  shots: FaceAdminShot[];
}

export async function faceAdminView(db: Db, employeeId: number, limit = 8): Promise<FaceAdminView> {
  const [face, shots] = await Promise.all([
    db.collection<StaffFace>(FACES).findOne({ employeeId }, { projection: { _id: 0, descriptors: 0 } }),
    db.collection<FaceShot>(SHOTS).find({ employeeId }).sort({ at: -1 }).limit(limit).toArray(),
  ]);
  return {
    enrolled: isEnrolled(face),
    enrolledAt: face?.enrolledAt ? face.enrolledAt.toISOString() : null,
    exempt: face?.exempt === true,
    photo: isEnrolled(face) ? dataUrl(face?.photo) : null,
    shots: shots.map((s) => ({
      id: s._id.toHexString(),
      at: s.at.toISOString(),
      purpose: s.purpose,
      ok: s.ok,
      distance: s.distance,
      reason: s.reason,
      photo: dataUrl(s.photo),
      attendance: s.attendance ?? null,
    })),
  };
}

/** Yuzni o'chiradi — xodim keyingi safar qayta ro'yxatdan o'tadi. Ozodlik belgisi qoladi. */
export async function resetFace(db: Db, employeeId: number, now = new Date()): Promise<void> {
  await db.collection(FACES).updateOne(
    { employeeId },
    { $unset: { descriptors: "", mean: "", photo: "", enrolledAt: "" }, $set: { updatedAt: now } },
  );
}

export async function setFaceExempt(db: Db, employeeId: number, exempt: boolean, now = new Date()): Promise<void> {
  await db
    .collection(FACES)
    .updateOne({ employeeId }, { $set: { exempt, updatedAt: now } }, { upsert: true });
}

/** Xodim o'chirilganda — uning yuzi va urinishlari ham ketadi. */
export async function deleteFaceData(db: Db, employeeId: number): Promise<void> {
  await Promise.all([db.collection(FACES).deleteOne({ employeeId }), db.collection(SHOTS).deleteMany({ employeeId })]);
}
