import type { Db } from "mongodb";
import { eskizConfigured } from "@/lib/eskiz";
import { SETTINGS_LIST_KINDS } from "@/lib/settingsLists";

// INTEGRATSIYALAR → «SMS QURILMALAR» (40-qism). Qurilmalar ro'yxati — `settings_sms_devices` (eski «SMS qurilmalar»
// tabi bilan umumiy, /api/settings-lists). DIQQAT: telefondagi SMS ilovasi bilan ulanish hali yo'q — SMS faqat
// operator (Eskiz) orqali ketadi; qurilmaning «Onlayn/Oflayn» belgisi qo'lda (SAVOLLAR 530). Operatorlar — muhit
// sozlamalaridan: Eskiz asosiy va zaxira akkaunti.
export async function smsDevicesPage(db: Db) {
  const [devices, moderators] = await Promise.all([
    db.collection(SETTINGS_LIST_KINDS["sms-devices"]).find({}, { projection: { _id: 0 } }).sort({ id: 1 }).toArray(),
    db.collection("hr_employees").find({ turi: "moderator", archived: { $ne: true } }, { projection: { _id: 0, name: 1 } }).sort({ name: 1 }).toArray(),
  ]);
  const mask = (imei: string) => {
    const d = imei.replace(/\D/g, "");
    return d.length >= 8 ? `${d.slice(0, 2)} •••• •••• ${d.slice(-4)}` : imei;
  };
  return {
    ok: true as const,
    devices: devices.map((d) => ({
      id: Number(d.id),
      name: String(d.name ?? ""),
      company: String(d.company ?? ""),
      imei: String(d.imei ?? ""),
      imeiMasked: mask(String(d.imei ?? "")),
      moderator: String(d.moderator ?? ""),
      online: d.online === true,
      active: d.active !== false,
    })),
    moderators: moderators.map((m) => String(m.name)),
    operators: { eskiz: eskizConfigured("main"), eskizFallback: eskizConfigured("fallback") },
  };
}
