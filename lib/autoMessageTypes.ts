// AVTOMATIK XABARLAR (36-qism, rasm «Avtomatik xabarlar») — klient va server uchun umumiy katalog.
//
// Hodisa bo'lganda o'quvchi va ota-onaga botdan o'zi ketadigan xabarlar. `wired: true` — yuboruvchisi bor
// (lib/studentBot/notify.ts): shablon va yoqish/o'chirish darhol ishlaydi. `wired: false` — dizayndagi hodisa,
// yuboruvchisi hali yozilmagan (sahifada «ulanmagan» bo'lib turadi; SAVOLLAR).
// Matn sintaksisi: `{ism}` kabi o'zgaruvchilar, `*qalin*`, `_qiya_`. Matn bo'sh — tizimning standart matni.

export type AutoKey = "payment" | "attendance" | "due" | "group" | "first_lesson" | "birthday" | "result";

export interface AutoEvent {
  key: AutoKey;
  name: string;
  when: string;
  who: string;
  wired: boolean;
  vars: string[];
  /** Standart matn — bot hozir yuboradigan matn bilan bir xil ma'noda. */
  def: string;
  /** Oldindan ko'rish uchun namuna qiymatlar. */
  sample: Record<string, string>;
}

export const AUTO_EVENTS: AutoEvent[] = [
  {
    key: "payment",
    name: "To'lov qabul qilindi",
    when: "kassada to'lov saqlanganda",
    who: "o'quvchi va ota-ona",
    wired: true,
    vars: ["ism", "summa", "tolov_turi", "sana", "kassa"],
    def: "💳 *To'lov qabul qilindi*\n\n👤 {ism}\n💰 Summa: *{summa}*\n📅 {sana}\n💼 To'lov turi: {tolov_turi}\n\n_Rahmat! Batafsil tarixni botdagi «To'lovlar» bo'limida ko'rasiz._",
    sample: { ism: "Diyora Rahimova", summa: "170 000 so'm", tolov_turi: "Naqd", sana: "12.10.2026", kassa: "Asosiy kassa" },
  },
  {
    key: "attendance",
    name: "Davomat belgilandi",
    when: "davomatda belgi qo'yilganda (keldi, kechikdi, kelmadi)",
    who: "o'quvchi va ota-ona",
    wired: true,
    vars: ["ism", "holat", "sana", "guruh", "baho"],
    def: "*{holat}*\n\n👤 {ism}\n📅 {sana}\n👥 {guruh}",
    sample: { ism: "Diyora Rahimova", holat: "❌ Darsga kelmadingiz", sana: "12.10.2026", guruh: "Matematika · 7-sinf", baho: "5" },
  },
  {
    key: "due",
    name: "To'lov eslatmasi",
    when: "oyning 25-kuni va oxirgi kuni, to'lov qayd etilmagan bo'lsa",
    who: "o'quvchi va ota-ona",
    wired: true,
    vars: ["ism", "oy"],
    def: "💳 *To'lov eslatmasi*\n_{ism}_\n\n*{oy}* oyi uchun to'lov hali qayd etilmagan.\n\nTo'lovni o'quv markazida amalga oshirishingiz mumkin.\n\n_Agar to'lovni allaqachon qilgan bo'lsangiz, bu xabarga e'tibor bermang._",
    sample: { ism: "Diyora Rahimova", oy: "Noyabr" },
  },
  {
    key: "group",
    name: "Guruhga qo'shildi",
    when: "o'quvchi guruhga qo'shilganda",
    who: "o'quvchi va ota-ona",
    wired: true,
    vars: ["ism", "guruh", "ustoz", "kunlar", "vaqt", "xona"],
    def: "🎓 *Yangi guruhga qo'shildingiz*\n_{ism}_\n\n*{guruh}*\nUstoz: {ustoz}\nKunlar: {kunlar}\nVaqt: *{vaqt}*\nXona: {xona}",
    sample: { ism: "Diyora Rahimova", guruh: "Matematika · 7-sinf", ustoz: "Jasur Toshpo'latov", kunlar: "Toq kunlar", vaqt: "09:00", xona: "204" },
  },
  {
    key: "first_lesson",
    name: "Birinchi dars eslatmasi",
    when: "darsdan 1 kun oldin, 18:00 da",
    who: "lid",
    wired: false,
    vars: ["ism", "kurs", "sana", "vaqt", "filial"],
    def: "Assalomu alaykum, {ism}! Ertaga {vaqt} da *{kurs}* bo'yicha bepul sinov darsingiz bor. Manzil: {filial}.",
    sample: { ism: "Javohir", kurs: "Ingliz tili", sana: "18.11.2026", vaqt: "16:00", filial: "Akademiya 1 Chortoq" },
  },
  {
    key: "birthday",
    name: "Tug'ilgan kun tabrigi",
    when: "o'sha kuni 09:00 da",
    who: "o'quvchi",
    wired: false,
    vars: ["ism"],
    def: "🎉 *Tug'ilgan kuningiz bilan, {ism}!* Sizga sog'lik va yangi yutuqlar tilaymiz.",
    sample: { ism: "Diyora" },
  },
  {
    key: "result",
    name: "Sarhisob natijasi",
    when: "natija kiritilganda",
    who: "o'quvchi va ota-ona",
    wired: false,
    vars: ["ism", "fan", "ball"],
    def: "📊 *Sarhisob natijasi*\n{ism} — {fan}: *{ball}*\nBatafsil — kabinetdagi «Natijalar» bo'limida.",
    sample: { ism: "Diyora Rahimova", fan: "Matematika", ball: "86%" },
  },
];

export const autoEvent = (k: string) => AUTO_EVENTS.find((e) => e.key === k);

const escHtml = (s: string) => s.replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" })[c]!);

/** Shablon → Telegram HTML: matn va qiymatlar ekranlanadi, `*x*` → qalin, `_x_` → qiya. Bo'sh qiymatli qator tushib qoladi. */
export function renderAutoHtml(tpl: string, vals: Record<string, string>): string {
  return tpl
    .split("\n")
    .filter((line) => !/\{(\w+)\}/.test(line) || [...line.matchAll(/\{(\w+)\}/g)].some((m) => (vals[m[1]] ?? "").trim()))
    .map((line) =>
      escHtml(line)
        .replace(/\{(\w+)\}/g, (_, k: string) => escHtml(vals[k] ?? ""))
        .replace(/\*([^*\n]+)\*/g, "<b>$1</b>")
        .replace(/(^|[\s(«])_([^_\n]+)_(?=$|[\s.,!?)»])/g, "$1<i>$2</i>"),
    )
    .join("\n");
}

export interface AutoSetting {
  key: AutoKey;
  enabled: boolean;
  /** Bo'sh — standart matn. */
  text: string;
  updatedBy?: string;
  updatedAt?: string;
}

export interface AutoRow extends AutoEvent {
  enabled: boolean;
  text: string;
  custom: boolean;
  /** Davrda yuborilgan / yetmagan; null — jurnal yuritilmaydi. */
  sent: number | null;
  failed: number | null;
}

export interface AutoMessagesPayload {
  ok: true;
  from: string;
  to: string;
  rows: AutoRow[];
  kpi: { total: number; delivered: number; telegram: number; sms: number; failed: number; pending: number };
  system: { invite: number; reset: number; failed: number };
  pushOn: boolean;
}
