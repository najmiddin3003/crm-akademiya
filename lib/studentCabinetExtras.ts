import type { Db } from "mongodb";
import { CENTER_PHONE } from "@/lib/center";
import { STUDENT_CONTRACTS, viewOf } from "@/lib/studentContracts";
import type { StudentContract } from "@/lib/studentContractTypes";
import { uzNow } from "@/lib/uzTime";

// O'QUVCHI KABINETI — 42-qism qo'shimchalari (Telegram ichida, `initData` bilan; SMS bilan kirish — keyinroq):
//   • ommaviy oferta — Sozlamalar → Ommaviy oferta bo'limlari (`settings` «system.public-oferta»); «Kirishda
//     tasdiq so'ralsin» yoqilgan bo'lsa (`app_settings` «student_app».ofertaGate) majburiy bo'limlar «Tanishdim»
//     qilinmaguncha kabinet ochilmaydi. Tasdiq — `oferta_accepts` (chat, o'quvchi, bo'lim id'lari, vaqt);
//   • fikr bildirish — `feedback` (Nazorat → Fikr-mulohaza bilan bir), manba «Kabinet», o'z murojaatlari holati bilan;
//   • shartnomalar — `student_contracts`, FAQAT KO'RISH (egasi qarori: imzolash markazda).

export const OFERTA_ACCEPTS = "oferta_accepts";
const OFERTA_KEY = "system.public-oferta";

export interface OfertaSection {
  id: string;
  title: string;
  text: string;
  required: boolean;
}

export async function ofertaState(db: Db, chatId: number) {
  const [doc, app, acc] = await Promise.all([
    db.collection("settings").findOne({ key: OFERTA_KEY }, { projection: { _id: 0, values: 1 } }),
    db.collection("app_settings").findOne({ key: "student_app" }, { projection: { _id: 0, ofertaGate: 1 } }),
    db.collection(OFERTA_ACCEPTS).findOne({ chatId }, { projection: { _id: 0 } }),
  ]);
  const raw = (doc?.values as { sections?: Partial<OfertaSection>[] } | undefined)?.sections;
  const sections: OfertaSection[] = (Array.isArray(raw) ? raw : [])
    .filter((s) => s && typeof s.id === "string" && String(s.title ?? "").trim())
    .map((s) => ({ id: String(s.id), title: String(s.title), text: String(s.text ?? ""), required: !!s.required }));
  const accepted: Record<string, string> = (acc?.sections as Record<string, string> | undefined) ?? {};
  // Bo'lim matni o'zgarsa ham eski tasdiq saqlanadi (qayta tasdiqlash — Taklif, SAVOLLAR 529).
  const missing = sections.filter((s) => s.required && !accepted[s.id]).map((s) => s.id);
  return { gate: app?.ofertaGate === true && sections.length > 0, sections, accepted, missing, done: missing.length === 0 };
}

export async function acceptOferta(db: Db, chatId: number, pupilId: number, ids: string[]) {
  const st = await ofertaState(db, chatId);
  const valid = ids.filter((id) => st.sections.some((s) => s.id === id));
  if (!valid.length) return { ok: false as const, error: "Bo'lim topilmadi" };
  const at = uzNow().toISOString();
  const set: Record<string, unknown> = { chatId, pupilId, updatedAt: at };
  for (const id of valid) set[`sections.${id}`] = at;
  await db.collection(OFERTA_ACCEPTS).updateOne({ chatId }, { $set: set }, { upsert: true });
  return { ok: true as const };
}

const FB_TYPES = ["Taklif", "Shikoyat", "Maqtov"] as const;

export async function myFeedback(db: Db, pupilId: number) {
  const rows = await db.collection("feedback").find({ pupilId, source: "Kabinet" }, { projection: { _id: 0 } }).sort({ id: -1 }).limit(20).toArray();
  return rows.map((r) => ({ id: Number(r.id), type: String(r.type), about: String(r.about ?? ""), izoh: String(r.izoh ?? ""), createdAt: String(r.createdAt ?? ""), status: String(r.status ?? "yangi"), resolution: String(r.resolution ?? "") }));
}

export async function sendFeedback(
  db: Db,
  who: { pupilId: number; pupilName: string; branch: string; role: "student" | "parent"; tgName: string; phone: string },
  b: { type?: unknown; about?: unknown; izoh?: unknown; hideName?: unknown },
) {
  const type = FB_TYPES.find((x) => x === b.type);
  if (!type) return { ok: false as const, error: "Turini tanlang" };
  const izoh = String(b.izoh ?? "").trim().slice(0, 2000);
  if (izoh.length < 5) return { ok: false as const, error: "Fikringizni yozing" };
  // Bir kunda 5 tadan ko'p murojaat — tasodifiy takror va spamdan himoya.
  const d = uzNow();
  const p = (x: number) => String(x).padStart(2, "0");
  const today = `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
  const n = await db.collection("feedback").countDocuments({ pupilId: who.pupilId, source: "Kabinet", createdAt: { $regex: `^${today}` } });
  if (n >= 5) return { ok: false as const, error: "Bugun murojaatlar soni chegarasiga yetdi" };
  const last = await db.collection("feedback").find({}).sort({ id: -1 }).limit(1).toArray();
  const about = String(b.about ?? "").trim().slice(0, 120);
  await db.collection("feedback").insertOne({
    id: (Number(last[0]?.id) || 0) + 1,
    filial: who.branch,
    from: who.role === "parent" ? "Ota-ona" : "O'quvchi",
    name: who.tgName || who.pupilName,
    phone: who.phone,
    type,
    izoh: about ? `${about}: ${izoh}` : izoh,
    about,
    createdAt: `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`,
    status: "yangi",
    assignee: "",
    resolution: "",
    resolvedAt: null,
    pupilId: who.pupilId,
    pupilName: who.pupilName,
    source: "Kabinet",
    createdBy: "",
    // «Ustozga ismim ko'rinmasin» — rahbariyat baribir ko'radi (Nazorat → Fikr-mulohaza).
    hideFromTeacher: b.hideName === true,
  });
  return { ok: true as const };
}

export async function myContracts(db: Db, pupilId: number) {
  const rows = (await db.collection(STUDENT_CONTRACTS).find({ pupilId, status: { $ne: "cancelled" } }, { projection: { _id: 0 } }).sort({ id: -1 }).toArray()) as unknown as StudentContract[];
  return rows.map((c) => ({ ...c, view: viewOf(c).view, centerPhone: CENTER_PHONE }));
}
