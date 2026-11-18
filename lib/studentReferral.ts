import type { Db } from "mongodb";
import { addReferrer, loadRefSettings, loadReferrals, requestGift, REF_REFERRERS } from "@/lib/referrals";
import { REF_STATE_LABELS, type RefState } from "@/lib/referralTypes";

// O'QUVCHI KABINETI → «TAKLIF QILISH» (44-qism, rasm «Kabinet · Taklif qilish»). Manba — Sotuv → Referallar
// (29-qism, lib/referrals.ts): o'quvchi yoki ota-ona TAKLIF QILUVCHI bo'lsa (`ref_referrers.pupilId`), kodi,
// takliflari va sovg'a do'koni shu yerda ko'rinadi. Hali taklif qiluvchi bo'lmasa — «Kodimni olish» bilan o'zi
// qo'shiladi (Sozlamalar → Referal dasturida o'quvchi/ota-ona turi yoqilgan bo'lsa).
// Taklif qilinganlar ismi faqat birinchi harf bilan («Asal N.») — boshqa oilaning ma'lumoti ochilmaydi.
// Sovg'a so'rovi — rahbar tasdiqlaydi (Referallar → So'rovlar), kabinet faqat «pending» so'rov yaratadi.

const maskName = (full: string) => {
  const [a = "", b = ""] = full.trim().split(/\s+/);
  return b ? `${a} ${b[0].toUpperCase()}.` : a;
};

export async function myReferral(db: Db, pupilId: number, role: "student" | "parent") {
  const settings = await loadRefSettings(db);
  const kind = role === "parent" ? "ota-ona" : "oquvchi";
  const allowed = settings.kinds[kind];
  const ref = await db.collection(REF_REFERRERS).findOne({ pupilId }, { projection: { _id: 0 } });
  if (!ref) return { joined: false as const, canJoin: allowed };
  const data = await loadReferrals(db, [Number(ref.branchId)]);
  const me = data.referrers.find((r) => r.id === Number(ref.id));
  if (!me) return { joined: false as const, canJoin: allowed };
  const links = data.links
    .filter((l) => l.referrerId === me.id)
    .map((l) => ({
      id: l.id,
      name: maskName(l.name),
      group: l.groupLabel,
      state: l.state as RefState,
      stateLabel: REF_STATE_LABELS[l.state],
      stateSub: l.stateSub,
      date: (l.countedAt ?? l.createdAt).slice(0, 10),
    }));
  const myRequests = data.requests.filter((q) => q.referrerId === me.id).slice(0, 10);
  return {
    joined: true as const,
    code: me.code,
    invited: me.invited,
    paid: links.filter((l) => l.state === "hisoblandi" || l.state === "qisman").length,
    counted: me.counted,
    spent: me.spent,
    balance: me.balance,
    pending: me.pending ? { giftId: me.pending.giftId, createdAt: me.pending.createdAt } : null,
    links,
    gifts: data.gifts.filter((g) => g.active).map((g) => ({ id: g.id, name: g.name, desc: g.desc, price: g.price, stock: g.stock })),
    requests: myRequests.map((q) => ({ id: q.id, giftName: q.giftName, price: q.price, status: q.status, createdAt: q.createdAt, comment: q.comment })),
  };
}

export async function joinReferral(db: Db, pupil: { id: number; branchId?: number }, role: "student" | "parent") {
  const r = await addReferrer(db, Number(pupil.branchId) || 1, "Kabinet", { kind: role === "parent" ? "ota-ona" : "oquvchi", pupilId: pupil.id });
  return r.ok ? { ok: true as const } : { ok: false as const, error: r.error };
}

export async function askReferralGift(db: Db, pupilId: number, giftId: number) {
  const ref = await db.collection(REF_REFERRERS).findOne({ pupilId }, { projection: { _id: 0, id: 1, branchId: 1 } });
  if (!ref) return { ok: false as const, error: "Avval kodingizni oling" };
  const data = await loadReferrals(db, [Number(ref.branchId)]);
  const me = data.referrers.find((r) => r.id === Number(ref.id));
  const g = data.gifts.find((x) => x.id === giftId);
  if (!me || !g) return { ok: false as const, error: "Sovg'a topilmadi" };
  if (me.balance < g.price) return { ok: false as const, error: `Referal yetmaydi: ${me.balance} / ${g.price}` };
  if (g.stock <= 0) return { ok: false as const, error: "Sovg'a hozir omborda yo'q" };
  const r = await requestGift(db, [Number(ref.branchId)], "Kabinet", me.id, giftId, false);
  return r.ok ? { ok: true as const } : { ok: false as const, error: r.error };
}
