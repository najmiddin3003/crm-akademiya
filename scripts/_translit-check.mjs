// Lotin → kiril transliteratsiyasini namunalar bilan sinash (lib/translit.ts).
//   node --experimental-transform-types --import ./scripts/_ts-alias.mjs scripts/_translit-check.mjs
const { toCyrillic } = await import("@/lib/translit");
const cases = [
  ["O'quvchilar", "Ўқувчилар"],
  ["Sozlamalar", "Созламалар"],
  ["Chiqish", "Чиқиш"],
  ["Tug'ilgan kunlar", "Туғилган кунлар"],
  ["Ma'lumot yo'q", "Маълумот йўқ"],
  ["Eng yaxshi", "Энг яхши"],
  ["Elektron pochta", "Электрон почта"],
  ["Yangiliklar", "Янгиликлар"],
  ["Yetti yulduz", "Етти юлдуз"],
  ["SHANBA", "ШАНБА"],
  ["To'lov turi", "Тўлов тури"],
  ["Sentyabr 2026", "Сентябрь 2026"],
  ["Bosh sahifa", "Бош саҳифа"],
  ["Xodimlar", "Ходимлар"],
  ["Ko'chirish: Naqd → Plastik", "Кўчириш: Нақд → Пластик"],
  ["{n} ta o'quvchi", "{n} та ўқувчи"],
  ["Qidirish...", "Қидириш..."],
  ["Bildirishnomalar", "Билдиришномалар"],
  ["Aeroport", "Аэропорт"],
  ["Teatr", "Театр"],
  ["Poezd", "Поезд"],
  ["Sertifikat", "Сертификат"],
  ["Litsey", "Лицей"],
  ["Dunyo", "Дунё"],
  ["G'arb", "Ғарб"],
  ["Oʻzbekcha", "Ўзбекча"],
  ["Ishonch telefoni", "Ишонч телефони"],
  ["Ctrl K", "Ctrl K"],
];
let bad = 0;
for (const [src, want] of cases) {
  const got = toCyrillic(src);
  const ok = got === want;
  if (!ok) bad++;
  console.log(`${ok ? "✓" : "✗"} ${src}  →  ${got}${ok ? "" : `   (kutilgan: ${want})`}`);
}
console.log(bad === 0 ? "\nHammasi to'g'ri." : `\n${bad} ta noto'g'ri.`);
process.exit(bad ? 1 : 0);
