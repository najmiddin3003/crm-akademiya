import type { Db } from "mongodb";
import { WEEKDAYS_FULL } from "@/lib/i18n";
import { guruhOf, holatOf, sinovOf, type LeadHolat } from "@/lib/leadHolat";
import type { Order } from "@/lib/ordersData";
import { loadSurveyConfig } from "@/lib/surveyServer";
import { esc, type InlineKeyboard } from "@/lib/telegramApi";
import { sendToStudent } from "@/lib/studentBot/api";
import { isStudentBotReady, loadStudentBotConfig } from "@/lib/studentBot/config";
import { SIGNUP_START_CB } from "@/lib/studentBot/keyboards";

// LID HOLATI O'ZGARSA — ARIZACHIGA BOTDA XABAR (16.10.2026).
//
// Foydalanuvchi: «agar saytda lid bilan bog'lanilsa botda xabar kelishi
// kerak, bironta status o'zgarsa botda xabar kelsin». Faqat botda o'zi
// ro'yxatdan o'tgan lidlarga (`orders.tgUser.chatId`, lib/studentBot/signup.ts)
// — boshqa lidning Telegram'i yo'q. Xabarni @tizimli_akademiya_bot yuboradi:
// odam u bilan yozishgan, ya'ni bot unga birinchi bo'lib yoza oladi.
//
// Qachon: holat o'zgargan har safar — Lidlar sahifasi (o'zgartirish va
// «Bekor qilish»), guruhdagi Telegram tugmalari, eski sahifalar (PATCH) va AI
// yordamchi. Hammasi shu bitta funksiyani `after`/`defer` bilan chaqiradi.
// Holat o'zgarmasa (tugma faqat javobni almashtirgan) — jim. Sinov darsi
// boshqa kunga ko'chirilsa (sinov → sinov) — yangi vaqt bilan xabar.
// «Bekor qilish» — tuzatish xabari: oldingi xabar xato bo'lgan bo'lishi mumkin.
//
// ICHKI MA'LUMOT CHIQMAYDI: rad sababi, moderator, izohlar — faqat odamning
// o'ziga kerak narsa (kurs, sinov darsi vaqti, guruh, filial manzili).
// HECH QACHON OTMAYDI — holat allaqachon bazada.

/** Arizachi tilida holat (Lidlar sahifasidagi nomlar emas). */
const STATE_TEXT: Record<LeadHolat, string> = {
  yangi: "arizangiz ko'rib chiqilmoqda",
  bog: "administrator siz bilan bog'lagan",
  sinov: "siz sinov darsiga yozilgansiz",
  guruh: "siz guruhga qo'shilgansiz",
  rad: "arizangiz yopilgan",
};

function dmy(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso || "");
  return m ? `${m[3]}.${m[2]}.${m[1]}` : iso;
}

/** "2026-10-20" → "Seshanba" — WEEKDAYS_FULL dushanbadan, getUTCDay yakshanbadan. */
function weekday(iso: string): string {
  const d = new Date(`${iso}T12:00:00Z`);
  return Number.isNaN(d.getTime()) ? "" : (WEEKDAYS_FULL.uz[(d.getUTCDay() + 6) % 7] ?? "");
}

interface BranchCard {
  nom: string;
  manzil: string;
  telefon: string;
}

async function branchCard(db: Db, branchId: number | undefined): Promise<BranchCard | null> {
  if (typeof branchId !== "number") return null;
  // So'rovnoma ko'rinishi — 1+2 «Akademiya Chortoq» bitta karta (lib/branchPools.ts).
  const sc = await loadSurveyConfig(db);
  const b = sc.filiallar.find((f) => f.id === branchId);
  return b ? { nom: b.nom, manzil: b.manzil, telefon: b.telefon } : null;
}

function branchLines(b: BranchCard | null): string[] {
  if (!b) return [];
  return [`🏢 ${esc(b.nom)}`, ...(b.manzil ? [`📍 ${esc(b.manzil)}`] : []), ...(b.telefon ? [`📞 ${esc(b.telefon)}`] : [])];
}

function sinovLines(o: Order, b: BranchCard | null): string[] {
  const s = sinovOf(o);
  const out: string[] = [];
  if (s) {
    const day = weekday(s.sana);
    out.push(`📅 <b>${esc(dmy(s.sana))}</b>${day ? ` (${esc(day)})` : ""}${s.vaqt ? `, ⏰ <b>${esc(s.vaqt)}</b>` : ""}`);
    if (s.oqituvchi) out.push(`🧑‍🏫 Ustoz: ${esc(s.oqituvchi)}`);
  }
  return [...out, ...branchLines(b)];
}

function guruhLines(o: Order, b: BranchCard | null): string[] {
  const g = guruhOf(o);
  const out: string[] = [];
  if (g) {
    out.push(`👥 Guruh: <b>${esc(g.nom)}</b>`);
    if (g.kun) out.push(`📆 Kunlar: ${esc(g.kun)}`);
    if (g.vaqt) out.push(`⏰ Vaqt: ${esc(g.vaqt)}`);
    if (g.boshlash) out.push(`🚀 Birinchi dars: ${esc(dmy(g.boshlash))}`);
  }
  return [...out, ...branchLines(b)];
}

/** Xabar matni — `null`: yuboriladigan narsa yo'q. Sinov uchun eksport. */
export function applicantMessage(
  before: Order,
  after: Order,
  branch: BranchCard | null,
): { html: string; keyboard?: InlineKeyboard } | null {
  const from = holatOf(before);
  const to = holatOf(after);
  const last = Array.isArray(after.holatTarix) ? after.holatTarix[after.holatTarix.length - 1] : undefined;
  const undo = last?.kind === "undo";
  const moved = from === "sinov" && to === "sinov" && (before.firstLesson || "") !== (after.firstLesson || "");
  if (from === to && !moved) return null;

  const course = after.course ? [`📚 ${esc(after.course)}`, ""] : [];
  const contact = branch?.telefon ? ["", `Savol bo'lsa: 📞 ${esc(branch.telefon)}`] : [];

  if (undo) {
    const extra = to === "sinov" ? ["", ...sinovLines(after, branch)] : to === "guruh" ? ["", ...guruhLines(after, branch)] : [];
    return {
      html: [
        "ℹ️ <b>Arizangiz holati yangilandi</b>",
        "",
        ...course,
        `Oldingi xabardagi o'zgarish bekor qilindi — hozir ${STATE_TEXT[to]}.`,
        ...extra,
        ...contact,
      ].join("\n"),
    };
  }

  switch (to) {
    case "bog":
      return {
        html: [
          "📞 <b>Arizangiz ko'rib chiqildi</b>",
          "",
          ...course,
          "Administrator siz bilan bog'landi. Keyingi qadam — sinov darsi: kuni va vaqtini birga kelishib olamiz.",
          ...contact,
        ].join("\n"),
      };
    case "sinov":
      return {
        html: [
          moved ? "📅 <b>Sinov darsi vaqti o'zgardi</b>" : "🎯 <b>Siz sinov darsiga yozildingiz!</b>",
          "",
          ...course,
          ...sinovLines(after, branch),
          "",
          "Sizni kutamiz! Kela olmasangiz, iltimos, oldindan xabar bering.",
        ].join("\n"),
      };
    case "guruh":
      return {
        html: [
          "🎉 <b>Tabriklaymiz! Siz guruhga qo'shildingiz</b>",
          "",
          ...course,
          ...guruhLines(after, branch),
          "",
          "Dars jadvali, davomat va to'lovlarni shu botda ko'rish uchun /start ni bosing va telefon raqamingizni yuboring.",
        ].join("\n"),
      };
    case "rad":
      return {
        html: [
          "ℹ️ <b>Arizangiz yopildi</b>",
          "",
          ...course,
          "Fikringiz o'zgarsa yoki boshqa kurs kerak bo'lsa — istalgan payt qayta ariza qoldirishingiz mumkin.",
          ...contact,
        ].join("\n"),
        keyboard: { inline_keyboard: [[{ text: "📝 Qayta ariza qoldirish", callback_data: SIGNUP_START_CB }]] },
      };
    default:
      return null;
  }
}

/**
 * Holat o'zgargach chaqiriladi (`before` — o'zgarishdan oldingi, `after` —
 * bazadagi yangi hujjat). Botdan kelmagan lidda va holat o'zgarmaganda jim.
 */
export async function notifyLeadApplicant(db: Db, before: Order, after: Order): Promise<void> {
  try {
    const chatId = Number(after.tgUser?.chatId);
    if (!Number.isFinite(chatId) || chatId <= 0) return;
    const cfg = loadStudentBotConfig();
    if (!isStudentBotReady(cfg)) return;
    const branch = await branchCard(db, after.branchId);
    const msg = applicantMessage(before, after, branch);
    if (!msg) return;
    const sent = await sendToStudent(cfg, chatId, msg.html, msg.keyboard);
    if (!sent.ok) {
      console.warn(`[lead-applicant] lid #${after.branchNo ?? after.id} arizachisiga yetmadi${sent.blocked ? " (botni bloklagan)" : ""}: ${sent.error}`);
    }
  } catch (e) {
    console.error("[lead-applicant]", e instanceof Error ? e.message : e);
  }
}
