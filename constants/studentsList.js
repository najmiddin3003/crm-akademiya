// O'quvchilar → O'quvchilar ro'yxati (barcha o'quvchilar, crm-akademiya
// #view-students-list, sidebar: O'quvchilar > O'quvchilar ro'yxati,
// href /students-list). Manbada bu STUDENTS_LIST (~5909 yozuv) — Yangi/Aktiv/
// Arxiv o'quvchilar sahifalaridan farqli o'laroq (ular umumiy 502 ta Orders
// havzasidan hosil bo'ladi), bu sahifa app.js'dagi kabi o'zining alohida,
// mustaqil generatoriga ega (id/name/phone/balance/coin/createdAt/moderator/
// source/groups). Backend yo'q — deterministik LCG generator bilan qurilgan
// (constants/employees.js dagi buildRest() bilan bir xil urug' formulasi).

const FIRST_NAMES = [
  "Aziz", "Bobur", "Davron", "Eldor", "Farhod", "Gulnoza", "Hasan", "Iroda",
  "Jamol", "Kamol", "Laylo", "Maftuna", "Nargiza", "Olim", "Pulat", "Qodir",
  "Rustam", "Sayyora", "Temur", "Umida", "Vasila", "Yusuf", "Zarina", "Anvar",
  "Bakhtiyor", "Dilfuza", "Erkin", "Fotima", "Gulbahor", "Hilola", "Ibrohim",
  "Jasur", "Kamila", "Lobar", "Muslima", "Nodira", "Otabek", "Parvina",
  "Rayxona", "Shahnoza", "Timur", "Ulug'bek", "Xurshid", "Yulduz", "Zaynab",
  "Akmal", "Diyora", "Sardor", "Malika",
];
const LAST_NAMES = [
  "Tursunov", "Karimov", "Nurmatov", "Rasulov", "Saidov", "Yusupov",
  "Akbarov", "Dadaxojayev", "Komilov", "Madaminov", "Obidov", "Mahmudov",
  "Rahimjanov", "Abdullayev", "Pirmatov", "Olimov", "Yoqubov", "Toxtaboyev",
  "Erkinov", "Abduvayitov", "Sharipova", "Ismoilova", "Sobirjanova",
  "Ummatova", "Hakimova", "Satvoldiyeva", "Risligboyev", "Raximjanova",
  "Majidov", "Sobitova",
];
const SOURCES = ["", "", "", "", "Instagram", "Telegram", "Tavsiya", "Facebook", ""];
const MODERATORS = ["Dilmurod Komilov", "Nilufar Sharipova"];
const PHONE_PREFIXES = ["93", "94", "97", "99", "90", "91", "88", "98", "77", "50", "95"];

function pad(n) {
  return String(n).padStart(2, "0");
}

function buildStudentsList(n) {
  let seed = 74123;
  const rnd = (min, max) => {
    seed = (seed * 9301 + 49297) % 233280;
    return Math.floor((seed / 233280) * (max - min + 1)) + min;
  };

  const out = [];
  for (let i = 0; i < n; i++) {
    const fn = FIRST_NAMES[rnd(0, FIRST_NAMES.length - 1)];
    const ln = LAST_NAMES[rnd(0, LAST_NAMES.length - 1)];
    const pp = PHONE_PREFIXES[rnd(0, PHONE_PREFIXES.length - 1)];
    const phone = `${pp} ${rnd(100, 999)} ${rnd(10, 99)} ${rnd(10, 99)}`;

    // Balans: taxminan 60% ijobiy (haqdor), 40% manfiy (qarzdor) — turli
    // miqyosda, screenshot'dagi taqsimotga yaqin.
    let balance;
    const tier = i % 5;
    if (tier < 3) {
      const buckets = [230000, 250000, 270000, 300000, 450000, 500000, 350000];
      balance = buckets[rnd(0, buckets.length - 1)];
      if (i % 17 === 5) balance = rnd(1, 8) * 1000000;
    } else if (tier === 3) {
      balance = -(rnd(0, 99) * 10000 + 50000);
    } else {
      balance = -(rnd(0, 1999) * 10000 + 500000);
    }
    if (i % 29 === 0) balance = 0;

    const yr = rnd(0, 1) === 0 ? 2026 : 2025;
    const mm = yr === 2026 ? rnd(1, 7) : rnd(1, 12);
    const dd = rnd(1, 28);
    const hh = rnd(0, 23);
    const mi = rnd(0, 59);
    const createdAt = `${pad(dd)}.${pad(mm)}.${yr} ${pad(hh)}:${pad(mi)}`;

    const moderator = MODERATORS[rnd(0, MODERATORS.length - 1)];
    const source = SOURCES[rnd(0, SOURCES.length - 1)];
    const coin = i % 23 === 7 ? rnd(1, 50) : 0;

    out.push({
      id: 6731 - i,
      name: `${fn} ${ln}`,
      phone,
      balance,
      coin,
      createdAt,
      moderator,
      source,
      groups: "-",
    });
  }
  return out;
}

export const STUDENTS_LIST = buildStudentsList(5909);
