// translate() ni tekshirish — lug'at, ko'plik, kiril, param'lar, darvoza.
//   node --experimental-transform-types --import ./scripts/_ts-alias.mjs scripts/_i18n-check.mjs
const { translate } = await import("@/lib/i18n");
const cases = [
  ["en", "Saqlash", undefined, "Save"],
  ["en", "{n} ta o'quvchi", { n: 1 }, "1 student"],
  ["en", "{n} ta o'quvchi", { n: 5 }, "5 students"],
  ["uz", "{n} ta o'quvchi", { n: 5 }, "5 ta o'quvchi"],
  ["uz-cyrl", "{n} ta o'quvchi", { n: 5 }, "5 та ўқувчи"],
  // Param qiymati (ism) o'girilmaydi.
  ["uz-cyrl", "O'qituvchi: {teacher}", { teacher: "Odina Arifjanova" }, "Ўқитувчи: Odina Arifjanova"],
  // Lug'atda yo'q kalit — hech qaysi tilda o'zgarmaydi (darvoza: bazadan
  // kelgan matn `t()` ga tushsa ham transliteratsiya qilinmaydi).
  ["en", "Bunday kalit yo'q", undefined, "Bunday kalit yo'q"],
  ["uz-cyrl", "Bunday kalit yo'q", undefined, "Bunday kalit yo'q"],
  ["uz-cyrl", "Alisher Navoiy", undefined, "Alisher Navoiy"],
  ["en", "So'nggi 7 kunda {kinds} yo'q.", { kinds: "new payments" }, "Nothing in the last 7 days: new payments."],
  // Lug'atdagi kalit: unlisiz "Esc" lotincha qoladi.
  ["uz-cyrl", "Yopish (Esc)", undefined, "Ёпиш (Esc)"],
  ["uz-cyrl", "Eslatma qoldirish… (Ctrl+Enter — yuborish)", undefined, "Эслатма қолдириш… (Ctrl+Enter — юбориш)"],
];
let bad = 0;
for (const [lang, key, params, want] of cases) {
  const got = translate(lang, key, params);
  const ok = got === want;
  if (!ok) bad++;
  console.log(`${ok ? "✓" : "✗"} [${lang}] ${key} → ${got}${ok ? "" : `   (kutilgan: ${want})`}`);
}
console.log(bad ? `\n${bad} ta noto'g'ri.` : "\nHammasi to'g'ri.");
process.exit(bad ? 1 : 0);
