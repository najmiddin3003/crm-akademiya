import type { Db } from "mongodb";
import { eskizConfigured } from "@/lib/eskiz";
import { paymentSmsEnabled } from "@/lib/paymentSms";
import { studentBotPushEnabled } from "@/lib/studentBot/config";
import { BOT_USERS } from "@/lib/studentBot/users";
import type { DeliveryPayload, DeliveryRow, DeliveryState, PurposeRow } from "@/lib/messageDeliveryTypes";

// XABARLAR YETKAZILISHI (34-qism, rasm «Xabarlar yetkazilishi»). Tizim yuborgan xabarlar — Telegram bot va
// SMS — `sms_messages` jurnalidan (lib/smsLog.ts). Holat:
//   Telegram + «Qabul qilindi» → Yetkazildi (bot egasining chatiga tushdi);
//   SMS + «Qabul qilindi» → Operatorga topshirildi (Eskiz qabul qildi — telefonga yetgani EMAS);
//   simulated → Sinov (Eskiz sozlanmagan, hech qayerga ketmagan);
//   «Yuborilmadi» → Yetmadi (sabab — providerError); «Kutilmoqda» → Kutilmoqda.
// Jurnalda filial yo'q — sahifa barcha filiallarni ko'rsatadi. Matn maxfiy bo'lsa jurnalning o'zida yashirilgan.

const ROW_LIMIT = 300;

export function stateOf(m: Record<string, unknown>): DeliveryState {
  if (m.status === "Yuborilmadi") return "failed";
  if (m.status === "Kutilmoqda") return "pending";
  if (m.simulated) return "simulated";
  return m.channel === "telegram" ? "delivered" : "operator";
}

export async function messageDelivery(db: Db, from: string, to: string): Promise<DeliveryPayload> {
  const filter = { date: { $gte: from, $lte: to } };
  const col = db.collection("sms_messages");
  const docs = await col
    .find(filter, { projection: { _id: 0, id: 1, date: 1, time: 1, recipientName: 1, purpose: 1, channel: 1, status: 1, simulated: 1, text: 1, providerError: 1, moderator: 1 } })
    .sort({ date: -1, time: -1, id: -1 })
    .toArray();
  const all: DeliveryRow[] = docs.map((d) => ({
    id: Number(d.id),
    date: String(d.date ?? ""),
    time: String(d.time ?? ""),
    recipientName: String(d.recipientName ?? ""),
    purpose: String(d.purpose ?? "other"),
    channel: d.channel === "telegram" ? "telegram" : "sms",
    state: stateOf(d),
    text: String(d.text ?? ""),
    error: String(d.providerError ?? ""),
    moderator: String(d.moderator ?? ""),
  }));

  const byP = new Map<string, PurposeRow>();
  const reasons = new Map<string, { reason: string; purpose: string; n: number }>();
  for (const r of all) {
    const p = byP.get(r.purpose) ?? { key: r.purpose, total: 0, telegram: 0, sms: 0, failed: 0, pending: 0, channels: [] };
    p.total += 1;
    if (!p.channels.includes(r.channel)) p.channels.push(r.channel);
    if (r.state === "failed") {
      p.failed += 1;
      const reason = r.error || "Sabab yozilmagan";
      const k = `${r.purpose}|${reason}`;
      const x = reasons.get(k) ?? { reason, purpose: r.purpose, n: 0 };
      x.n += 1;
      reasons.set(k, x);
    } else if (r.state === "pending") p.pending += 1;
    else if (r.channel === "telegram") p.telegram += 1;
    else p.sms += 1;
    byP.set(r.purpose, p);
  }

  const users = await db.collection(BOT_USERS).find({ blocked: { $ne: true } }, { projection: { _id: 0, links: 1 } }).toArray();
  const linked = new Set<number>();
  for (const u of users) for (const l of (u.links ?? []) as { pupilId?: number }[]) if (Number.isFinite(l?.pupilId)) linked.add(Number(l.pupilId));
  const activePupils = await db.collection("pupils").countDocuments({ status: "Aktiv" });
  const activeLinked = linked.size ? await db.collection("pupils").countDocuments({ status: "Aktiv", id: { $in: [...linked] } }) : 0;

  const n = (s: DeliveryState) => all.filter((r) => r.state === s).length;
  return {
    ok: true,
    from,
    to,
    kpi: {
      total: all.length,
      purposes: byP.size,
      telegram: n("delivered"),
      sms: n("operator"),
      smsPending: all.filter((r) => r.channel === "sms" && r.state === "pending").length,
      failed: n("failed"),
      simulated: n("simulated"),
    },
    failReasons: [...reasons.values()].sort((a, b) => b.n - a.n).slice(0, 4),
    purposes: [...byP.values()].sort((a, b) => b.total - a.total),
    channels: { botEnabled: studentBotPushEnabled(), botLinked: activeLinked, activePupils, eskiz: eskizConfigured(), paymentSms: paymentSmsEnabled() },
    rows: all.slice(0, ROW_LIMIT),
    truncated: all.length > ROW_LIMIT,
  };
}
