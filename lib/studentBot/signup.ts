import type { Db } from "mongodb";
import type { AdjustDeps } from "@/lib/cashboxAdjust";
import { darajaMatnUz, hasDaraja } from "@/lib/leadSettings";
import { createBotLead } from "@/lib/ordersCreate";
import {
  cleanSurveyName,
  cleanSurveyNote,
  formatPhone9,
  phone9,
  uzPhone9,
  validateSurvey,
  type SurveyConfig,
} from "@/lib/survey";
import { loadSurveyConfig, surveyHash } from "@/lib/surveyServer";
import { esc, type InlineButton, type InlineKeyboard, type ReplyKeyboard } from "@/lib/telegramApi";
import { answerStudent, dropReplyKeyboard, editStudentMenu, sendToStudent } from "@/lib/studentBot/api";
import type { StudentBotConfig } from "@/lib/studentBot/config";
import { CB, SIGNUP_BUTTON, SIGNUP_START_CB } from "@/lib/studentBot/keyboards";

// 📝 KURSGA YOZILISH — yangi o'quvchining o'zi botda ariza qoldiradi (16.10.2026).
//
// Foydalanuvchi: «yangi o'quvchilar ro'yxatdan o'tishi uchun botga o'quvchi
// ro'yxatdan o'ta oladigan qilishimiz kerak, saytda yangi lid qo'shishdagi
// funksiyalar hammasi botda ishlashi kerak». Saytda yangi o'quvchi o'zi
// to'ldiradigan joy — ommaviy so'rovnoma (/sorovnoma). Bot AYNAN o'sha
// savollarni o'sha tartibda so'raydi va o'sha joydan oladi:
//   1) yo'nalish → kurs/fan → daraja (chet tili; «bilmayman — test») yoki sinf;
//   2) filial (manzil, telefon) → qulay vaqt;
//   3) ism familiya → telefon → «bizni qayerdan bildingiz?» → izoh (ixtiyoriy);
//   tasdiq → yuborish.
// Ro'yxatlar — lib/surveyServer.ts → loadSurveyConfig (Sozlamalar → Sotuv va
// marketing → Lidlar, Filiallar, O'quvchilar manbalari); oxirida javob
// `validateSurvey` bilan saytdagidek tekshiriladi. Lid — lib/ordersCreate.ts →
// createBotLead: Lidlar sahifasiga «Telegram bot» manbasi bilan, filial
// Telegram topigiga holat tugmalari bilan (saytdagi so'rovnoma lidi kabi).
// Xodimlar botidagi «Yangi buyurtma» (lib/staffBot/lead.ts) — boshqa narsa:
// u xodim uchun, CRM'dagi o'quvchiga.
//
// HOLAT — `student_bot_signups` (bitta suhbatga bitta hujjat, 24 soat TTL).
// `step: ""` — anketa ochilmagan, faqat eslab qolingan raqam (kirishda raqami
// topilmagan odamga telefon qadamida taklif qilinadi).
//
// TUGMALAR (`callback_data`, 64 baytdan qisqa; ro'yxatdagi o'rin — indeks):
//   yz:go     — boshlash (lib/studentBot/keyboards.ts → SIGNUP_START_CB)
//   yz:y:<id> — yo'nalish ("fan" | "til" | "pm")   yz:f:<i> — kurs/fan
//   yz:l:<i>  — daraja bosqichi, yz:l:t — «test»   yz:s:<i> — sinf
//   yz:b:<id> — filial                              yz:v:<i> — qulay vaqt
//   yz:nm     — Telegramdagi ism                    yz:keep — oldingi javob qolsin
//   yz:m:<i>  — «qayerdan bildingiz?»               yz:n — izohsiz
//   yz:ok     — yuborish   yz:re — qaytadan   yz:back — orqaga   yz:x — bekor
// Faqat JORIY qadam xabaridagi tugma ishlaydi (`messageId`) — eski xabardagi
// tugma anketani boshqa qadamga sakratib yubormasin.
//
// SPAM VA TAKRORDAN HIMOYA (`survey_hits`, so'rovnoma bilan bitta hisob):
// bir suhbatdan kuniga 5 tadan ortiq ariza yo'q; bir xil raqam + kurs + ism
// 10 daqiqa ichida qayta yuborilsa ikkinchi lid yaratilmaydi («Yuborish» ni
// ikki marta bosish ham `submitting` bilan to'silgan).

export const SIGNUPS = "student_bot_signups";
const DRAFT_TTL_MS = 24 * 3_600_000;
const PER_DAY = 5;
const SAME_LEAD_MS = 10 * 60_000;

export type SignupStep = "yon" | "fan" | "lvl" | "sinf" | "filial" | "vaqt" | "ism" | "tel" | "manba" | "izoh" | "tasdiq";
const STEPS: SignupStep[] = ["yon", "fan", "lvl", "sinf", "filial", "vaqt", "ism", "tel", "manba", "izoh", "tasdiq"];

export interface SignupAnswers {
  yonalish?: string;
  fan?: string;
  lvl?: number;
  test?: boolean;
  sinf?: string;
  filialId?: number;
  vaqt?: string;
  ism?: string;
  /** 9 raqam — "901234567". */
  tel?: string;
  manba?: string;
  izoh?: string;
}

export interface SignupDraft {
  chatId: number;
  step: SignupStep | "";
  a: SignupAnswers;
  /** Taklif qilinadigan raqam (9): kirishda topilmagan yoki bog'langan odamniki. */
  knownPhone?: string;
  /** Joriy qadam xabari — tugmali qadamlar shu xabarni tahrirlaydi. */
  messageId?: number;
  /** Telefon qadamida oddiy klaviatura chiqarilgan — keyingi qadamda olib tashlanadi. */
  replyKb?: boolean;
  submitting?: boolean;
  expireAt: Date;
}

export interface SignupCtx {
  db: Db;
  cfg: StudentBotConfig;
  chatId: number;
  from?: { id?: number; first_name?: string; last_name?: string; username?: string };
  /** Bog'langan o'quvchi/ota-ona — yakunda «Asosiy menyu» tugmasi. */
  linked: boolean;
  /** Bog'langan odamning raqami (oxirgi 9 raqam) — telefon qadamida taklif. */
  linkedPhone?: string | null;
  defer: AdjustDeps["defer"];
}

interface Screen {
  html: string;
  keyboard: InlineKeyboard | ReplyKeyboard;
  /** Oddiy (pastki) klaviatura — xabar tahrirlanmaydi, yangisi yuboriladi. */
  reply: boolean;
}

const col = (db: Db) => db.collection(SIGNUPS);
const expiry = () => new Date(Date.now() + DRAFT_TTL_MS);

export async function getSignup(db: Db, chatId: number): Promise<SignupDraft | null> {
  return ((await col(db).findOne({ chatId }, { projection: { _id: 0 } })) as SignupDraft | null) ?? null;
}

/** Anketa ochiqmi — lib/botDispatch.ts javobni (raqam bo'lsa ham) o'quvchilar routeriga beradi. */
export async function hasActiveSignup(db: Db, chatId: number): Promise<boolean> {
  return !!(await col(db).findOne({ chatId, step: { $in: STEPS } }, { projection: { _id: 1 } }));
}

/** Kirishda bazadan topilmagan raqam — anketaning telefon qadamida taklif uchun. */
export async function rememberSignupPhone(db: Db, chatId: number, phone: string): Promise<void> {
  const p = uzPhone9(phone);
  if (!p) return;
  await col(db).updateOne(
    { chatId },
    { $set: { knownPhone: p, expireAt: expiry() }, $setOnInsert: { step: "", a: {} } },
    { upsert: true },
  );
}

/** Anketani yopadi (raqam taklifi qoladi) — /start, «Ustozga savol» va h.k. */
export async function closeSignup(db: Db, chatId: number): Promise<void> {
  await col(db).updateOne(
    { chatId },
    { $set: { step: "", a: {} }, $unset: { messageId: "", replyKb: "", submitting: "" } },
  );
}

async function save(db: Db, d: SignupDraft): Promise<void> {
  const set: Record<string, unknown> = { step: d.step, a: d.a, replyKb: !!d.replyKb, expireAt: expiry() };
  if (d.messageId !== undefined) set.messageId = d.messageId;
  if (d.knownPhone) set.knownPhone = d.knownPhone;
  await col(db).updateOne({ chatId: d.chatId }, { $set: set }, { upsert: true });
}

const SIGNUP_CMD = /^\/(?:yozilish|royxat)(?:@\w+)?$/i;
const SIGNUP_LINK = /^\/start(?:@\w+)?\s+(?:yozilish|royxat|kurs)$/i;

/**
 * Anketani boshlaydigan xabar: pastki klaviaturadagi «📝 Kursga yozilish»,
 * `/yozilish` buyrug'i yoki havola `t.me/<bot>?start=royxat` (reklama, QR).
 */
export function isSignupStartText(text: string): boolean {
  const t = text.trim();
  return t === SIGNUP_BUTTON || SIGNUP_CMD.test(t) || SIGNUP_LINK.test(t);
}

export function isSignupCallback(data: string): boolean {
  return data.startsWith("yz:");
}

// ── Qadamlar tartibi ─────────────────────────────────────────────────

function nextStep(step: SignupStep, a: SignupAnswers): SignupStep {
  switch (step) {
    case "yon":
      return "fan";
    case "fan":
      return hasDaraja(a.yonalish) ? "lvl" : "sinf";
    case "lvl":
    case "sinf":
      return "filial";
    case "filial":
      return "vaqt";
    case "vaqt":
      return "ism";
    case "ism":
      return "tel";
    case "tel":
      return "manba";
    case "manba":
      return "izoh";
    default:
      return "tasdiq";
  }
}

function prevStep(step: SignupStep, a: SignupAnswers): SignupStep | null {
  switch (step) {
    case "fan":
      return "yon";
    case "lvl":
    case "sinf":
      return "fan";
    case "filial":
      return hasDaraja(a.yonalish) ? "lvl" : "sinf";
    case "vaqt":
      return "filial";
    case "ism":
      return "vaqt";
    case "tel":
      return "ism";
    case "manba":
      return "tel";
    case "izoh":
      return "manba";
    case "tasdiq":
      return "izoh";
    default:
      return null;
  }
}

/** So'rovnoma sahifasidagi 3 qadam — sarlavhadagi «1/3». */
const PHASE: Record<SignupStep, number> = {
  yon: 1, fan: 1, lvl: 1, sinf: 1, filial: 2, vaqt: 2, ism: 3, tel: 3, manba: 3, izoh: 3, tasdiq: 3,
};

// ── Ekranlar ─────────────────────────────────────────────────────────

const YON_EMOJI: Record<string, string> = { fan: "📚", til: "🌍", pm: "🏫" };
const BACK: InlineButton = { text: "⬅️ Orqaga", callback_data: "yz:back" };
const CANCEL: InlineButton = { text: "❌ Bekor qilish", callback_data: "yz:x" };
/** Telefon qadamidagi oddiy klaviatura tugmalari — bosilsa shu matn keladi. */
const TEXT_BACK = "⬅️ Orqaga";
const TEXT_CANCEL = "❌ Bekor qilish";
const CONTACT_TEXT = "📱 Raqamimni yuborish";

const mark = (on: boolean, s: string) => (on ? `✅ ${s}` : s);
const plusPhone = (p: string) => `+998 ${formatPhone9(p)}`;

/**
 * Tugmalarni qatorlarga teradi: qisqalari `per` tadan, uzun yozuvli tugma
 * (`maxLen` belgidan uzun) o'z qatorida — telefonda «Maktabni tugatgan»,
 * «Boshlang'ich (0 dan)» kabilar «…» bilan kesilib qolmasin. Tartib saqlanadi.
 */
function grid(buttons: InlineButton[], per: number, maxLen = 16): InlineButton[][] {
  const rows: InlineButton[][] = [];
  let row: InlineButton[] = [];
  for (const b of buttons) {
    if ([...b.text].length > maxLen) {
      if (row.length) rows.push(row);
      row = [];
      rows.push([b]);
      continue;
    }
    row.push(b);
    if (row.length === per) {
      rows.push(row);
      row = [];
    }
  }
  if (row.length) rows.push(row);
  return rows;
}

/** Telegramdagi ism — «👤 …» tezkor tugmasi va lid kartasi uchun. */
function tgName(from: SignupCtx["from"]): string {
  return [from?.first_name, from?.last_name].filter(Boolean).join(" ").trim();
}

function head(step: SignupStep, title: string, notice?: string): string[] {
  const lines: string[] = [];
  if (notice) lines.push(`⚠️ <b>${esc(notice)}</b>`, "");
  lines.push(step === "tasdiq" ? "📝 <b>Arizangizni tekshiring</b>" : `📝 <b>Kursga yozilish</b> · ${PHASE[step]}/3`);
  if (title) lines.push("", `<b>${esc(title)}</b>`);
  return lines;
}

function inline(lines: string[], rows: InlineButton[][]): Screen {
  return { html: lines.join("\n"), keyboard: { inline_keyboard: rows }, reply: false };
}

function lvlOf(i: number, n: number): number {
  return Math.round((i * 100) / Math.max(1, n - 1));
}

function summaryLines(sc: SurveyConfig, a: SignupAnswers): string[] {
  const yon = sc.yonalishlar.find((y) => y.id === a.yonalish);
  const branch = sc.filiallar.find((b) => b.id === a.filialId);
  const out: string[] = [];
  if (a.fan) out.push(`📚 Kurs: <b>${esc(a.fan)}</b>${yon ? ` <i>(${esc(yon.nom)})</i>` : ""}`);
  if (hasDaraja(a.yonalish) && (a.test || a.lvl !== undefined)) {
    out.push(`📊 Daraja: ${esc(darajaMatnUz({ lvl: a.lvl ?? 0, test: !!a.test }, sc.bosqichlar))}`);
  } else if (a.sinf) out.push(`🎒 Sinf: ${esc(a.sinf)}`);
  if (branch) out.push(`🏢 Filial: ${esc(branch.nom)}`);
  if (a.vaqt) out.push(`⏰ Vaqt: ${esc(a.vaqt)}`);
  if (a.ism) out.push(`👤 Ism: ${esc(a.ism)}`);
  if (a.tel) out.push(`📞 Telefon: ${plusPhone(a.tel)}`);
  if (a.manba) out.push(`🔎 Qayerdan bildingiz: ${esc(a.manba)}`);
  if (a.izoh) out.push(`📝 Izoh: ${esc(a.izoh)}`);
  return out;
}

function render(sc: SurveyConfig, d: SignupDraft, ctx: SignupCtx, notice?: string): Screen {
  const a = d.a;
  const step = (d.step || "yon") as SignupStep;
  const yon = sc.yonalishlar.find((y) => y.id === a.yonalish);
  const nav = [BACK, CANCEL];

  switch (step) {
    case "yon":
      return inline(
        [...head(step, "Qaysi yo'nalishda o'qimoqchisiz?", notice), "", "Javoblaringiz bo'yicha filial administratori siz bilan bog'lanadi."],
        [
          ...sc.yonalishlar.map((y) => [
            { text: mark(a.yonalish === y.id, `${YON_EMOJI[y.id] ?? "📘"} ${y.nom}`), callback_data: `yz:y:${y.id}` },
          ]),
          [CANCEL],
        ],
      );

    case "fan":
      return inline(head(step, yon?.savol || "Qaysi fan?", notice), [
        ...grid((yon?.fanlar ?? []).map((f, i) => ({ text: mark(a.fan === f.nom, f.nom), callback_data: `yz:f:${i}` })), 2),
        nav,
      ]);

    case "lvl": {
      const n = sc.bosqichlar.length;
      return inline(
        [...head(step, "Darajangiz qanday?", notice), "", "Bilmasangiz — daraja testini topshirasiz, administrator o'zi aniqlaydi."],
        [
          ...grid(
            sc.bosqichlar.map((s, i) => ({ text: mark(!a.test && a.lvl === lvlOf(i, n), s), callback_data: `yz:l:${i}` })),
            2,
          ),
          [{ text: mark(!!a.test, "🧪 Bilmayman — test topshiraman"), callback_data: "yz:l:t" }],
          nav,
        ],
      );
    }

    case "sinf":
      return inline(head(step, "Nechanchi sinf?", notice), [
        ...grid(sc.sinflar.map((s, i) => ({ text: mark(a.sinf === s, s), callback_data: `yz:s:${i}` })), 3, 10),
        nav,
      ]);

    case "filial": {
      const list = sc.filiallar.flatMap((b) => [
        "",
        `🏢 <b>${esc(b.nom)}</b>`,
        ...(b.manzil ? [`📍 ${esc(b.manzil)}`] : []),
        ...(b.telefon ? [`📞 ${esc(b.telefon)}`] : []),
      ]);
      return inline([...head(step, "Qaysi filial?", notice), ...list], [
        ...sc.filiallar.map((b) => [{ text: mark(a.filialId === b.id, `🏢 ${b.nom}`), callback_data: `yz:b:${b.id}` }]),
        nav,
      ]);
    }

    case "vaqt":
      return inline(head(step, "Qaysi vaqt qulay?", notice), [
        ...sc.vaqtlar.map((v, i) => [{ text: mark(a.vaqt === v, `⏰ ${v}`), callback_data: `yz:v:${i}` }]),
        nav,
      ]);

    case "ism": {
      const rows: InlineButton[][] = [];
      if (a.ism) rows.push([{ text: `✅ ${a.ism}`, callback_data: "yz:keep" }]);
      const nick = cleanSurveyName(tgName(ctx.from));
      if (nick && nick !== a.ism && [...nick].length <= 40) rows.push([{ text: `👤 ${nick}`, callback_data: "yz:nm" }]);
      rows.push(nav);
      return inline(
        [
          ...head(step, "Siz bilan qanday bog'lanamiz?", notice),
          "",
          "Ism familiyangizni shu yerga yozing (masalan: <i>Aliyev Vali</i>).",
          ...(rows.length > 1 ? ["Yoki pastdagi tugmani bosing."] : []),
        ],
        rows,
      );
    }

    case "tel": {
      const known = a.tel ?? d.knownPhone ?? (ctx.linkedPhone ? uzPhone9(ctx.linkedPhone) : null) ?? null;
      const keyboard: ReplyKeyboard = {
        keyboard: [
          [{ text: CONTACT_TEXT, request_contact: true }],
          ...(known ? [[{ text: `✅ ${plusPhone(known)}` }]] : []),
          [{ text: TEXT_BACK }, { text: TEXT_CANCEL }],
        ],
        resize_keyboard: true,
        input_field_placeholder: "90 123 45 67",
      };
      return {
        html: [
          ...head(step, "Telefon raqamingiz", notice),
          "",
          `Pastdagi "${CONTACT_TEXT}" tugmasini bosing yoki raqamni yozing: <code>90 123 45 67</code>`,
          ...(known ? ["", `Yoki shu raqam: <b>${plusPhone(known)}</b> — pastdagi ✅ tugmasi.`] : []),
        ].join("\n"),
        keyboard,
        reply: true,
      };
    }

    case "manba":
      return inline(head(step, "Bizni qayerdan bildingiz?", notice), [
        ...grid(sc.manbalar.map((m, i) => ({ text: mark(a.manba === m, m), callback_data: `yz:m:${i}` })), 2),
        nav,
      ]);

    case "izoh": {
      const rows: InlineButton[][] = [];
      if (a.izoh) rows.push([{ text: "✅ Izoh o'zgarmasin", callback_data: "yz:keep" }]);
      rows.push([{ text: "⏭ Izohsiz davom etish", callback_data: "yz:n" }], nav);
      return inline(
        [
          ...head(step, "Izoh (ixtiyoriy)", notice),
          "",
          "Masalan: qaysi kunlar qulay yoki savolingiz. Yozing yoki «⏭ Izohsiz davom etish» ni bosing.",
          ...(a.izoh ? ["", `Hozirgi izoh: <i>${esc(a.izoh)}</i>`] : []),
        ],
        rows,
      );
    }

    case "tasdiq":
      return inline([...head(step, "", notice), "", ...summaryLines(sc, a), "", "Hammasi to'g'rimi?"], [
        [{ text: "✅ Yuborish", callback_data: "yz:ok" }],
        [{ text: "✏️ Qaytadan to'ldirish", callback_data: "yz:re" }],
        [CANCEL],
      ]);
  }
}

function restartKeyboard(linked: boolean): InlineKeyboard {
  const rows: InlineButton[][] = [[{ text: "📝 Qaytadan boshlash", callback_data: SIGNUP_START_CB }]];
  if (linked) rows.push([{ text: "⬅️ Asosiy menyu", callback_data: CB.home }]);
  return { inline_keyboard: rows };
}

async function editOrSend(ctx: SignupCtx, messageId: number | undefined, html: string, keyboard: InlineKeyboard): Promise<void> {
  if (messageId !== undefined && (await editStudentMenu(ctx.cfg, ctx.chatId, messageId, html, keyboard))) return;
  await sendToStudent(ctx.cfg, ctx.chatId, html, keyboard);
}

/**
 * Joriy qadamni ko'rsatadi va holatni yozadi. Tugma bosilgan xabar joriy
 * qadamniki bo'lsa — o'sha xabar tahrirlanadi, aks holda (matn javobidan
 * keyin, telefon qadami) yangisi yuboriladi.
 */
async function show(ctx: SignupCtx, d: SignupDraft, opts: { editId?: number; notice?: string; sc?: SurveyConfig } = {}): Promise<void> {
  const sc = opts.sc ?? (await loadSurveyConfig(ctx.db));
  const screen = render(sc, d, ctx, opts.notice);
  let messageId: number | undefined;
  if (screen.reply) {
    const sent = await sendToStudent(ctx.cfg, ctx.chatId, screen.html, screen.keyboard);
    if (sent.ok) messageId = sent.messageId;
    d.replyKb = true;
  } else {
    if (d.replyKb) {
      await dropReplyKeyboard(ctx.cfg, ctx.chatId);
      d.replyKb = false;
    }
    const kb = screen.keyboard as InlineKeyboard;
    if (opts.editId !== undefined && opts.editId === d.messageId && (await editStudentMenu(ctx.cfg, ctx.chatId, opts.editId, screen.html, kb))) {
      messageId = opts.editId;
    } else {
      const sent = await sendToStudent(ctx.cfg, ctx.chatId, screen.html, kb);
      if (sent.ok) messageId = sent.messageId;
    }
  }
  if (messageId !== undefined) d.messageId = messageId;
  await save(ctx.db, d);
}

/** So'rovnoma yopiq (sozlamada yo'nalish, filial yoki vaqt yo'q) — saytdagidek. */
function surveyClosed(sc: SurveyConfig): boolean {
  return sc.yonalishlar.length === 0 || sc.filiallar.length === 0 || sc.vaqtlar.length === 0 || sc.manbalar.length === 0;
}

/** Anketani boshlaydi (yoki boshidan ochadi). `editId` — tugma bosilgan xabar. */
export async function startSignup(ctx: SignupCtx, editId?: number): Promise<void> {
  const sc = await loadSurveyConfig(ctx.db);
  if (surveyClosed(sc)) {
    const html = "📝 <b>Kursga yozilish</b>\n\nHozircha ariza qabul qilinmayapti — iltimos, filialga qo'ng'iroq qiling.";
    await editOrSend(ctx, editId, html, { inline_keyboard: ctx.linked ? [[{ text: "⬅️ Asosiy menyu", callback_data: CB.home }]] : [] });
    return;
  }
  const prev = await getSignup(ctx.db, ctx.chatId);
  const d: SignupDraft = {
    chatId: ctx.chatId,
    step: "yon",
    a: {},
    ...(prev?.knownPhone ? { knownPhone: prev.knownPhone } : {}),
    replyKb: !!prev?.replyKb,
    expireAt: expiry(),
  };
  if (editId !== undefined) d.messageId = editId;
  await show(ctx, d, { editId, sc });
}

async function cancel(ctx: SignupCtx, d: SignupDraft, messageId?: number): Promise<void> {
  await closeSignup(ctx.db, ctx.chatId);
  if (d.replyKb) await dropReplyKeyboard(ctx.cfg, ctx.chatId);
  await editOrSend(
    ctx,
    messageId,
    "❌ <b>Ariza bekor qilindi</b>\n\nIstalgan payt qaytadan boshlashingiz mumkin.",
    restartKeyboard(ctx.linked),
  );
}

// ── Matn va kontakt javoblari ────────────────────────────────────────

/** Anketa ochiq paytdagi matn xabari. */
export async function signupText(ctx: SignupCtx, d: SignupDraft, text: string): Promise<void> {
  const t = text.trim();
  // Matnsiz xabar (rasm, stiker …) — javob emas, qadam eslatiladi.
  if (!t) return show(ctx, d, { notice: "Iltimos, javobni matn bilan yozing yoki pastdagi tugmani bosing." });
  switch (d.step) {
    case "ism": {
      const name = cleanSurveyName(t);
      if (!name) return show(ctx, d, { notice: "Ism familiyani to'liq yozing — kamida 3 harf, havolasiz." });
      d.a.ism = name;
      d.step = "tel";
      return show(ctx, d);
    }
    case "tel": {
      if (t === TEXT_BACK) {
        d.step = "ism";
        return show(ctx, d);
      }
      if (t === TEXT_CANCEL) return cancel(ctx, d);
      const p = uzPhone9(t);
      if (!p) return show(ctx, d, { notice: "Raqamni to'liq yozing, masalan: 90 123 45 67" });
      d.a.tel = p;
      d.step = "manba";
      return show(ctx, d);
    }
    case "izoh": {
      const note = cleanSurveyNote(t);
      if (note === null) return show(ctx, d, { notice: "Izohda havola bo'lmasin." });
      d.a.izoh = note;
      d.step = "tasdiq";
      return show(ctx, d);
    }
    default:
      // Tugmali qadamda yozilgan matn — qadam qayta (yangi xabar bilan) ko'rsatiladi.
      return show(ctx, d, { notice: "Iltimos, pastdagi tugmalardan birini tanlang." });
  }
}

/** Telefon qadamida yuborilgan kontakt (o'ziniki yoki boshqasiniki — bu aloqa raqami, kirish emas). */
export async function signupContact(ctx: SignupCtx, d: SignupDraft, rawPhone: string): Promise<void> {
  if (d.step !== "tel") return show(ctx, d, { notice: "Iltimos, pastdagi tugmalardan birini tanlang." });
  const p = uzPhone9(rawPhone);
  if (!p) return show(ctx, d, { notice: "Faqat O'zbekiston raqami (+998) qabul qilinadi — raqamni yozing." });
  d.a.tel = p;
  d.step = "manba";
  return show(ctx, d);
}

// ── Tugmalar ─────────────────────────────────────────────────────────

export async function signupCallback(ctx: SignupCtx, callbackId: string, messageId: number | undefined, data: string): Promise<void> {
  const { db, cfg } = ctx;
  if (data === SIGNUP_START_CB) {
    await answerStudent(cfg, callbackId, "");
    await startSignup(ctx, messageId);
    return;
  }

  const d = await getSignup(db, ctx.chatId);
  if (!d || !d.step) {
    await answerStudent(cfg, callbackId, "Ariza eskirgan");
    await editOrSend(ctx, messageId, "⌛ <b>Bu ariza eskirgan</b>\n\nQaytadan boshlang — bir daqiqa oladi.", restartKeyboard(ctx.linked));
    return;
  }
  // Faqat joriy qadam xabari — eski xabardagi tugma anketani chalkashtirmasin.
  if (messageId !== undefined && d.messageId !== undefined && messageId !== d.messageId) {
    await answerStudent(cfg, callbackId, "Bu eski xabar — oxirgi xabardan davom eting");
    return;
  }

  const sc = await loadSurveyConfig(db);
  const a = d.a;
  const [, act = "", arg = ""] = data.split(":");
  const stale = async () => {
    await answerStudent(cfg, callbackId, "Bu tugma eskirgan");
    await show(ctx, d, { editId: messageId, sc });
  };
  const at = (s: SignupStep) => d.step === s;

  switch (act) {
    case "x":
      await answerStudent(cfg, callbackId, "Bekor qilindi");
      await cancel(ctx, d, messageId);
      return;
    case "back": {
      const p = prevStep(d.step as SignupStep, a);
      if (!p) {
        await answerStudent(cfg, callbackId, "Bekor qilindi");
        await cancel(ctx, d, messageId);
        return;
      }
      d.step = p;
      break;
    }
    case "y": {
      const y = sc.yonalishlar.find((x) => x.id === arg);
      if (!at("yon") || !y) return stale();
      // Yo'nalish o'zgarsa unga bog'liq javoblar (fan, daraja/sinf) tozalanadi.
      if (a.yonalish !== y.id) {
        delete a.fan;
        delete a.lvl;
        delete a.test;
        delete a.sinf;
      }
      a.yonalish = y.id;
      d.step = "fan";
      break;
    }
    case "f": {
      const f = sc.yonalishlar.find((x) => x.id === a.yonalish)?.fanlar[Number(arg)];
      if (!at("fan") || !f) return stale();
      a.fan = f.nom;
      d.step = nextStep("fan", a);
      break;
    }
    case "l": {
      if (!at("lvl")) return stale();
      if (arg === "t") {
        a.test = true;
        a.lvl = 0;
      } else {
        const i = Number(arg);
        if (!Number.isInteger(i) || i < 0 || i >= sc.bosqichlar.length) return stale();
        a.test = false;
        a.lvl = lvlOf(i, sc.bosqichlar.length);
      }
      d.step = "filial";
      break;
    }
    case "s": {
      const s = sc.sinflar[Number(arg)];
      if (!at("sinf") || !s) return stale();
      a.sinf = s;
      d.step = "filial";
      break;
    }
    case "b": {
      const b = sc.filiallar.find((x) => x.id === Number(arg));
      if (!at("filial") || !b) return stale();
      a.filialId = b.id;
      d.step = "vaqt";
      break;
    }
    case "v": {
      const v = sc.vaqtlar[Number(arg)];
      if (!at("vaqt") || !v) return stale();
      a.vaqt = v;
      d.step = "ism";
      break;
    }
    case "nm": {
      const name = cleanSurveyName(tgName(ctx.from));
      if (!at("ism") || !name) return stale();
      a.ism = name;
      d.step = "tel";
      break;
    }
    case "keep": {
      if (!((at("ism") && a.ism) || (at("izoh") && a.izoh))) return stale();
      d.step = nextStep(d.step as SignupStep, a);
      break;
    }
    case "m": {
      const m = sc.manbalar[Number(arg)];
      if (!at("manba") || !m) return stale();
      a.manba = m;
      d.step = "izoh";
      break;
    }
    case "n":
      if (!at("izoh")) return stale();
      a.izoh = "";
      d.step = "tasdiq";
      break;
    case "re":
      if (!at("tasdiq")) return stale();
      d.step = "yon";
      break;
    case "ok":
      if (!at("tasdiq")) return stale();
      await answerStudent(cfg, callbackId, "Yuborilmoqda…");
      await submit(ctx, d, messageId, sc);
      return;
    default:
      return stale();
  }
  await answerStudent(cfg, callbackId, "");
  await show(ctx, d, { editId: messageId, sc });
}

// ── Yuborish ─────────────────────────────────────────────────────────

async function submit(ctx: SignupCtx, d: SignupDraft, messageId: number | undefined, sc: SurveyConfig): Promise<void> {
  const { db, chatId } = ctx;
  // Ikki marta bosish — ikkinchisi hech narsa qilmaydi.
  const claimed = await col(db).findOneAndUpdate(
    { chatId, step: "tasdiq", submitting: { $ne: true } },
    { $set: { submitting: true } },
    { projection: { _id: 1 } },
  );
  if (!claimed) return;
  const release = () => col(db).updateOne({ chatId }, { $unset: { submitting: "" } });

  const a = d.a;
  const v = validateSurvey(sc, {
    yonalish: a.yonalish,
    fan: a.fan,
    lvl: a.lvl,
    test: a.test,
    sinf: a.sinf,
    filialId: a.filialId,
    vaqt: a.vaqt,
    ism: a.ism,
    tel: a.tel,
    manba: a.manba,
    izoh: a.izoh,
  });
  if (!v.ok) {
    // Masalan anketa to'ldirilayotganda sozlamada kurs o'chirilgan.
    await release();
    return show(ctx, d, { editId: messageId, sc, notice: `${v.error} «✏️ Qaytadan to'ldirish» ni bosing.` });
  }

  const hits = db.collection("survey_hits");
  const now = Date.now();
  const chatHash = surveyHash(`tg:${chatId}`);
  const tel = phone9(v.value.phone);
  const telHash = surveyHash(tel);
  const dupHash = surveyHash(`tg|${tel}|${v.value.course}|${v.value.name.toLowerCase()}`);
  const [inDay, same] = await Promise.all([
    hits.countDocuments({ chatHash, orderId: { $exists: true }, at: { $gte: new Date(now - 86_400_000) } }),
    hits.findOne({ dupHash, orderId: { $exists: true }, at: { $gte: new Date(now - SAME_LEAD_MS) } }, { projection: { _id: 1 } }),
  ]);
  if (same) {
    await closeSignup(db, chatId);
    return done(ctx, d, sc, messageId, true);
  }
  if (inDay >= PER_DAY) {
    await release();
    const branch = sc.filiallar.find((b) => b.id === v.value.branchId);
    return show(ctx, d, {
      editId: messageId,
      sc,
      notice: `Bugun ${PER_DAY} ta ariza yubordingiz — qolganini filialga qo'ng'iroq qilib ayting${branch?.telefon ? `: ${branch.telefon}` : ""}.`,
    });
  }

  const hit = await hits.insertOne({ chatHash, telHash, dupHash, via: "bot", at: new Date(now) });
  try {
    const order = await createBotLead(
      db,
      v.value,
      { chatId, username: ctx.from?.username, name: tgName(ctx.from) },
      { defer: ctx.defer },
    );
    await hits.updateOne({ _id: hit.insertedId }, { $set: { orderId: order.id } });
  } catch (e) {
    console.error("[student-bot] ariza saqlanmadi:", e instanceof Error ? e.message : e);
    await release();
    return show(ctx, d, { editId: messageId, sc, notice: "Saqlab bo'lmadi — birozdan keyin «✅ Yuborish» ni qayta bosing." });
  }
  await closeSignup(db, chatId);
  await done(ctx, d, sc, messageId, false);
}

async function done(ctx: SignupCtx, d: SignupDraft, sc: SurveyConfig, messageId: number | undefined, repeated: boolean): Promise<void> {
  const a = d.a;
  const branch = sc.filiallar.find((b) => b.id === a.filialId);
  const html = [
    repeated ? "✅ <b>Arizangiz allaqachon qabul qilingan</b>" : "✅ <b>Arizangiz qabul qilindi!</b>",
    "",
    `24 soat ichida <b>${plusPhone(a.tel ?? "")}</b> raqamiga qo'ng'iroq qilamiz.`,
    "",
    ...summaryLines(sc, { ...a, ism: undefined, tel: undefined, manba: undefined, izoh: undefined }),
    ...(branch?.telefon ? ["", `Savol bo'lsa: 📞 ${esc(branch.telefon)}`] : []),
  ].join("\n");
  const rows: InlineButton[][] = [];
  if (ctx.linked) rows.push([{ text: "⬅️ Asosiy menyu", callback_data: CB.home }]);
  rows.push([{ text: "📝 Yana ariza qoldirish", callback_data: SIGNUP_START_CB }]);
  await editOrSend(ctx, messageId, html, { inline_keyboard: rows });
}
