import type { Db, Document } from "mongodb";
import { HOLATLAR, holatOf, type HolatSource } from "@/lib/leadHolat";
import { uzDateIso } from "@/lib/uzTime";
import type { GamActor } from "./actor";
import { toTxActor } from "./attendance";
import { GAM } from "./db";
import { pupilName } from "./ranking";
import { systemReasonMap } from "./reasons";
import { loadSettings } from "./settings";
import { canSeePupil } from "./students";
import { GamError, isFrozenStatus, withWallet } from "./wallet";

// «DO'ST OLIB KELDI» (TZ 4.12).
//
// Lidlarda «Referal bergan o'quvchi» — `referral` (ism) va 26.09.2026 dan
// `referralPupilId` (id). Bonus shartlari: lid «Guruhga qo'shildi»,
// kamida bitta to'lov (lid o'quvchisining payIn yozuvi), shu lid uchun
// faol bonus yo'q, tavsiya qilgan o'quvchi muzlatilmagan. Bonusni admin
// yoki direktor profil oynasida TASDIQLAYDI — avtomatik yozilmaydi (PO
// qarori). Bonus guruhsiz (reytingga kirmaydi). Bekor qilinsa, `uniqKey`
// bo'shaydi va lid yana bonusga ochiladi. Lid filiali cheklanmaydi.

export type ReferralState = "ok" | "given" | "no_payment" | "not_in_group";

export interface ReferralLead {
  id: number;
  name: string;
  course: string;
  holat: string;
  state: ReferralState;
}

const norm = (s: unknown) => String(s ?? "").trim().replace(/\s+/g, " ").toLowerCase();
const digits = (s: unknown) => String(s ?? "").replace(/\D/g, "").slice(-9);

/** Lid qaysi o'quvchiga aylangan: saqlangan `pupilId`, bo'lmasa ism + telefon bo'yicha YAGONA moslik. */
async function leadPupilId(db: Db, lead: Document): Promise<number | null> {
  if (Number.isFinite(Number(lead.pupilId)) && lead.pupilId !== null) return Number(lead.pupilId);
  const [first, ...rest] = String(lead.name ?? "").trim().split(/\s+/);
  if (!first) return null;
  const esc = (x: string) => x.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const cands = await db
    .collection("pupils")
    .find({ firstName: { $regex: `^${esc(first)}$`, $options: "i" } }, { projection: { _id: 0, id: 1, firstName: 1, lastName: 1, phone: 1 } })
    .toArray();
  const byName = cands.filter((p) => norm(pupilName(p)) === norm(lead.name) || (!rest.length && norm(p.firstName) === norm(first)));
  const ph = digits(lead.phone);
  const hit = ph ? byName.filter((p) => digits(p.phone) === ph) : byName;
  return hit.length === 1 ? Number(hit[0].id) : null;
}

export async function referralLeads(db: Db, actor: GamActor, pupilId: number): Promise<{ pupilName: string; leads: ReferralLead[] }> {
  const p = await db.collection("pupils").findOne({ id: pupilId }, { projection: { _id: 0, id: 1, firstName: 1, lastName: 1, branchId: 1 } });
  if (!p || !(await canSeePupil(db, actor, { id: pupilId, branchId: p.branchId }))) throw new GamError(404, "O'quvchi topilmadi");
  const name = pupilName(p);

  // Eski lidlarda faqat ism bor — ism bazada YAGONA bo'lsagina hisoblanadi
  // (ismdosh o'quvchiga begona bonus tushmasin).
  const [first, ...rest] = name.split(" ");
  const namesakes = await db.collection("pupils").countDocuments({ firstName: first, lastName: rest.join(" ") });
  const docs = await db
    .collection("orders")
    .find(
      namesakes === 1
        ? { $or: [{ referralPupilId: pupilId }, { referralPupilId: { $in: [null] }, referral: { $nin: ["", null] } }] }
        : { referralPupilId: pupilId },
      { projection: { _id: 0 } },
    )
    .toArray();
  const mine = docs.filter((o) => Number(o.referralPupilId) === pupilId || norm(o.referral) === norm(name));

  const bonuses = await db
    .collection(GAM.tx)
    .find({ type: "referral", status: "active", leadId: { $in: mine.map((o) => Number(o.id)) } }, { projection: { _id: 0, leadId: 1 } })
    .toArray();
  const given = new Set(bonuses.map((b) => Number(b.leadId)));

  const leads: ReferralLead[] = [];
  for (const o of mine) {
    const holat = holatOf(o as HolatSource);
    let state: ReferralState;
    if (given.has(Number(o.id))) state = "given";
    else if (holat !== "guruh") state = "not_in_group";
    else {
      const lp = await leadPupilId(db, o);
      const paid = lp !== null && (await db.collection("transaction_entries").countDocuments({ pupilId: lp, txType: "payIn", status: { $ne: "cancelled" } }, { limit: 1 })) > 0;
      state = paid ? "ok" : "no_payment";
    }
    leads.push({
      id: Number(o.id),
      name: String(o.name ?? ""),
      course: String(o.course ?? ""),
      holat: HOLATLAR.find((h) => h.id === holat)?.nom ?? holat,
      state,
    });
  }
  return { pupilName: name, leads };
}

export async function giveReferral(db: Db, actor: GamActor, input: { pupilId: number; leadId: number }) {
  const settings = await loadSettings(db);
  if (!settings.enabled) throw new GamError(409, "Gamifikatsiya moduli o'chiq");
  if (actor.role === "teacher") throw new GamError(403, "Do'st bonusini filial admini yoki direktor yozadi");
  const reason = (await systemReasonMap(db)).get("referral");
  if (!reason?.isActive) throw new GamError(422, "Bu tizim sababi to'xtatilgan");
  const { leads } = await referralLeads(db, actor, input.pupilId);
  const lead = leads.find((l) => l.id === input.leadId);
  if (!lead) throw new GamError(404, "Lid topilmadi");
  if (lead.state === "given") throw new GamError(409, "Bu lid uchun bonus allaqachon berilgan");
  if (lead.state === "not_in_group") throw new GamError(422, "Lid hali guruhga qo'shilmagan");
  if (lead.state === "no_payment") throw new GamError(422, "Lid hali to'lov qilmagan");

  const { result, wallet, levelUp } = await withWallet(db, input.pupilId, async (w) => {
    if (w.pupil.frozen || isFrozenStatus(w.pupil.status)) throw new GamError(422, "Ketgan o'quvchiga tanga yozilmaydi");
    if (actor.role === "branch_admin" && !actor.branchIds.includes(w.pupil.branchId)) {
      throw new GamError(403, "O'quvchi sizning filialingizda emas");
    }
    return w.add({
      groupId: null,
      date: uzDateIso(),
      type: "referral",
      reasonId: reason.id,
      reasonName: reason.name,
      amount: settings.referralBonusCoins,
      note: lead.course ? `Do'sti: ${lead.name} (${lead.course})` : `Do'sti: ${lead.name}`,
      actor: toTxActor(actor),
      leadId: lead.id,
      uniqKey: `ref:${lead.id}`,
    });
  });
  return { txId: result.id, amount: result.amount, applied: result.applied, balance: wallet.balance, levelUp };
}
