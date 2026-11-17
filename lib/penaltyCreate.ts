import type { Db } from "mongodb";
import { studentPaidBalanceByName } from "@/lib/pupilsDb";
import type { Penalty } from "@/lib/penalties";
import { toUz } from "@/lib/uzTime";

// JARIMA YOZISH — Moliya → Jarima (app/api/penalties) va Nazorat → Davomat nazorati («Jarima
// yozish», 34-qism) uchun BITTA yo'l. 17.11.2026 da route ichidan ko'chirildi (mantiq o'zgarmagan):
// «Oldingi miqdor» shu odamga oldin berilgan SO'NGGI jarimadagi «keyingi miqdor»dan davom etadi;
// birinchi jarimada o'quvchi — haqiqiy to'lov balansidan, xodim — null (balans yuritilmaydi).

export type PenaltyRecord = Omit<Penalty, "before" | "after"> & {
  before: number | null;
  after: number | null;
};

export interface PenaltyInput {
  type?: string;
  recipientName?: string;
  amount?: number;
  note?: string;
  image?: string;
  cashboxId?: number | null;
}

function fmtNow(raw: Date): string {
  const d = toUz(raw);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(d.getDate())}.${p(d.getMonth() + 1)}.${d.getFullYear()} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

export async function createPenalty(db: Db, body: PenaltyInput): Promise<{ ok: true; penalty: PenaltyRecord } | { ok: false; error: string; status: number }> {
  const type = body.type === "employee" || body.type === "student" ? body.type : "";
  const recipientName = (body.recipientName || "").trim();
  const amount = Number(body.amount);
  if (!type) return { ok: false, error: "Tranzaksiya turini tanlang", status: 400 };
  if (!recipientName) return { ok: false, error: type === "employee" ? "Xodimni tanlang" : "O'quvchini tanlang", status: 400 };
  if (!Number.isFinite(amount) || amount <= 0) return { ok: false, error: "Qiymatni to'g'ri kiriting", status: 400 };

  const col = db.collection("penalties");
  const prior = await col.find({ type, recipientName }).sort({ id: -1 }).limit(1).toArray();
  let before: number | null;
  if (prior[0]) {
    // Oldingi yozuvdagi "keyingi miqdor" noma'lum bo'lsa (xodim) — zanjir
    // ham noma'lum bo'lib qolaveradi, null 0 ga aylanmaydi.
    before = typeof prior[0].after === "number" ? prior[0].after : null;
  } else if (type === "student") {
    before = await studentPaidBalanceByName(db, recipientName);
  } else {
    before = null;
  }

  const last = await col.find({}).sort({ id: -1 }).limit(1).toArray();
  const nextId = (last[0]?.id ?? 0) + 1;
  const cashboxId = Number.isFinite(Number(body.cashboxId)) && body.cashboxId != null ? Number(body.cashboxId) : null;

  const penalty: PenaltyRecord = {
    id: nextId,
    type,
    cashboxId,
    recipientName,
    before,
    amount,
    after: before === null ? null : before - amount,
    note: (body.note || "").trim(),
    reason: "",
    status: "",
    image: (body.image || "").trim(),
    createdAt: fmtNow(new Date()),
  };
  await col.insertOne({ ...penalty });
  return { ok: true, penalty };
}
