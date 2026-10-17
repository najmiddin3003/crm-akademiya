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
