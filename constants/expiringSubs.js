// O'quvchilar → Joriy oyda obunasi tugaydiganlar (crm-akademiya
// #view-expiring-subs, sidebar: O'quvchilar > Joriy oyda obunasi
// tugaydiganlar, href /expiring-subs). Manbada o'zining alohida generatoriga
// ega (STUDENTS_LIST'dan mustaqil) — buildExpiringSubs(370), maydonlar
// { name, phone, totalCost, currentBalance, status }. Manbada `id` maydoni
// umuman yo'q (shu sabab u yerda ism ustidagi havola ham amalda ishlamaydi) —
// bu yerda o'quvchi ismi/"Batafsil" /student-edit/[id]ga olib borishi uchun
// deterministik `id` qo'shildi (6016 dan pastroq diapazon — studentsList.js
// ID diapazoni 823-6731 bilan to'qnashmasligi uchun 1-370 oralig'ida).

const FIRST_NAMES = ["Akmal", "Bobur", "Davron", "Elyor", "Farrux", "Jasur", "Olim", "Rustam", "Sherzod", "Toxir", "Umid", "Zafar", "Aziz", "Dilshod", "Komil", "Shuxratjon", "Ismoiljon", "Toshpolat", "Azizbek", "Sardor"];
const LAST_NAMES = ["Abdullayev", "Abduvaliyev", "Abduhalilov", "Abduhalimov", "Abdulhamidov", "Abdulhakimov", "Xudayberdiyev", "Ahmedov", "Ilyasov", "Alijanov", "Abdurahmanova", "Azamjanov", "Azamxanov", "Bahtiyarov", "Bahtiyarova"];
const COST_BUCKETS = [810000, 900000, 1050000, 1400000, 1620000, 2160000];

function pad2(n) {
  return String(n).padStart(2, "0");
}

function seededRnd(seedIn) {
  let seed = seedIn * 9301 + 49297;
  return (min, max) => {
    seed = (seed * 9301 + 49297) % 233280;
    return Math.floor((seed / 233280) * (max - min + 1)) + min;
  };
}

function buildExpiringSubs(n) {
  const out = [];
  for (let i = 0; i < n; i++) {
    const rnd = seededRnd(i + 60000);
    const fn = FIRST_NAMES[rnd(0, FIRST_NAMES.length - 1)];
    const ln = LAST_NAMES[rnd(0, LAST_NAMES.length - 1)];
    const phone = `+998${50 + rnd(0, 49)}${pad2(rnd(0, 99))}${pad2(rnd(0, 99))}${pad2(rnd(0, 99))}${rnd(0, 9)}`;
    const totalCost = COST_BUCKETS[rnd(0, COST_BUCKETS.length - 1)];

    // ~70% qarzdorlikda chuqur (critical), ~15% ozgina musbat lekin
    // yetarli emas (debt), ~15% to'liq to'langan (paid) — skrinshotdagi
    // og'ir manfiy og'irlikka yaqin taqsimot.
    const r = rnd(0, 9);
    let currentBalance;
    let status;
    if (r < 7) {
      currentBalance = -(rnd(0, 800) * 10000 + 200000);
      status = "critical";
    } else if (r < 8) {
      currentBalance = rnd(0, 100) * 10000 + 100000;
      status = "debt";
    } else {
      currentBalance = totalCost + rnd(0, 50) * 10000 + 100000;
      status = "paid";
    }

    out.push({ id: i + 1, name: `${fn} ${ln}`, phone, totalCost, currentBalance, status });
  }
  return out;
}

export const EXPIRING_SUBS = buildExpiringSubs(370);
export const ES_STATUS_OPTIONS = [
  { value: "paid", label: "To'langan" },
  { value: "debt", label: "Qarzdor" },
  { value: "critical", label: "Kritik" },
];
