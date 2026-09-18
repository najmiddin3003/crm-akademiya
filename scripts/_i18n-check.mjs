// translate() ni tekshirish — lug'at, ko'plik, kiril, param'lar.
//   node --experimental-transform-types --import ./scripts/_ts-alias.mjs scripts/_i18n-check.mjs
const { translate } = await import("@/lib/i18n");
const cases = [
  ["en", "Saqlash", undefined, "Save"],
  ["en", "{n} ta o'quvchi", { n: 1 }, "1 student"],
  ["en", "{n} ta o'quvchi", { n: 5 }, "5 students"],
  ["uz", "{n} ta o'quvchi", { n: 5 }, "5 ta o'quvchi"],
  ["uz-cyrl", "{n} ta o'quvchi", { n: 5 }, "5 та ўқувчи"],
  ["uz-cyrl", "O'quvchi: {name}", { name: "Odina Arifjanova" }, "Ўқувчи: Odina Arifjanova"],
  ["en", "Bunday kalit yo'q", undefined, "Bunday kalit yo'q"],
  ["uz-cyrl", "Bunday kalit yo'q", undefined, "Бундай калит йўқ"],
  ["en", "So'nggi 7 kunda {kinds} yo'q.", { kinds: "new payments" }, "Nothing in the last 7 days: new payments."],
  ["uz-cyrl", "Ctrl K bilan qidiring", undefined, "Ctrl K билан қидиринг"],
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
