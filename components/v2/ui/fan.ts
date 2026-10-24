// FAN RANGLARI (design/v2/DESIGN.md → «Fan ranglari — jadval va guruh kartalarida»).
//
// Kurs nomi erkin matn ("Ingliz tili", "IELTS", "Ona tili va adabiyot",
// "Matematika (abituriyent)"), shuning uchun "o'z ichiga oladi" bo'yicha
// tanlanadi; tanilmagani — `boshqa`. IELTS/CEFR/General English → ingliz
// (design/v2/SAVOLLAR.md 35-savol taxmini).

export type FanKey = "ingliz" | "ona" | "matem" | "rus" | "arab" | "bio" | "tarix" | "boshqa";

const RULES: [FanKey, RegExp][] = [
  ["ingliz", /ingliz|english|ielts|cefr|toefl/],
  ["ona", /ona tili|adabiyot/],
  ["matem", /matem|math|algebra|geometr/],
  ["rus", /rus/],
  ["arab", /arab/],
  ["bio", /bio/],
  ["tarix", /tarix|history/],
];

export function fanOf(course: string | undefined): FanKey {
  const s = (course || "").toLowerCase().replace(/[ʻʼ`‘’]/g, "'");
  for (const [key, re] of RULES) if (re.test(s)) return key;
  return "boshqa";
}

/**
 * Fan bloki — och fon va chegara rangi ALOHIDA (xodim profilidagi haftalik jadval,
 * 20.10.2026): to'qnashgan blokda chegara `warning` bo'ladi — bitta klassda ikki
 * chegara rangi to'qnashmasin.
 */
export const FAN_BG: Record<FanKey, string> = {
  ingliz: "bg-v2-fan-ingliz-bg",
  ona: "bg-v2-fan-ona-bg",
  matem: "bg-v2-fan-matem-bg",
  rus: "bg-v2-fan-rus-bg",
  arab: "bg-v2-fan-arab-bg",
  bio: "bg-v2-fan-bio-bg",
  tarix: "bg-v2-fan-tarix-bg",
  boshqa: "bg-v2-fan-boshqa-bg",
};
export const FAN_BORDER: Record<FanKey, string> = {
  ingliz: "border-v2-fan-ingliz-border",
  ona: "border-v2-fan-ona-border",
  matem: "border-v2-fan-matem-border",
  rus: "border-v2-fan-rus-border",
  arab: "border-v2-fan-arab-border",
  bio: "border-v2-fan-bio-border",
  tarix: "border-v2-fan-tarix-border",
  boshqa: "border-v2-fan-boshqa-border",
};

/** Ikonka rangi (guruh sahifasi sarlavhasidagi kitob, 24.10.2026). */
export const FAN_TEXT: Record<FanKey, string> = {
  ingliz: "text-v2-fan-ingliz",
  ona: "text-v2-fan-ona",
  matem: "text-v2-fan-matem",
  rus: "text-v2-fan-rus",
  arab: "text-v2-fan-arab",
  bio: "text-v2-fan-bio",
  tarix: "text-v2-fan-tarix",
  boshqa: "text-v2-fan-boshqa",
};

/** Nuqta rangi (Tailwind klassi to'liq yozilgan — JIT ko'rsin). */
export const FAN_DOT: Record<FanKey, string> = {
  ingliz: "bg-v2-fan-ingliz",
  ona: "bg-v2-fan-ona",
  matem: "bg-v2-fan-matem",
  rus: "bg-v2-fan-rus",
  arab: "bg-v2-fan-arab",
  bio: "bg-v2-fan-bio",
  tarix: "bg-v2-fan-tarix",
  boshqa: "bg-v2-fan-boshqa",
};
