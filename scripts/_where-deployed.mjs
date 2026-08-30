// FAQAT O'QISH — ishlab turgan sayt QAYERDA ishlayotganini aniqlaydi va
// serverdan bazagacha bo'lgan masofani o'lchaydi (zip.md 6.1 bandi uchun).
//
//   node scripts/_where-deployed.mjs [domen]
//
// NIMA QILADI:
//  1) `x-vercel-id` sarlavhasidan edge va FUNKSIYA regionini o'qiydi.
//     Shakli "hkg1::iad1::..." — birinchisi edge (foydalanuvchiga yaqin),
//     oxirgisi funksiya haqiqatan ishlayotgan region.
//  2) Bitta baza amalining narxini BILVOSITA o'lchaydi:
//       bo'sh token   -> funksiya bazaga BORMAYDI (erta 400 qaytaradi)
//       yaroqsiz token -> funksiya bazaga BITTA so'rov yuboradi
//     Farq = server <-> baza borib-kelish narxi.
//
// Ikkala so'rov ham hech narsa YOZMAYDI va parol talab qilmaydi.

const HOST = process.argv[2] || "tizimli24.uz";
const URL_ = `https://${HOST}/api/auth/verify-token`;

const REGIONS = {
  iad1: "AQSh, Virjiniya", cle1: "AQSh, Ogayo", pdx1: "AQSh, Oregon",
  sfo1: "AQSh, San-Fransisko", fra1: "Frankfurt", dub1: "Dublin", lhr1: "London",
  cdg1: "Parij", arn1: "Stokgolm", sin1: "Singapur", hnd1: "Tokio", icn1: "Seul",
  syd1: "Sidney", bom1: "Mumbay", gru1: "San-Paulu", hkg1: "Gonkong",
  kix1: "Osaka", cpt1: "Keyptaun", dxb1: "Dubay",
};

async function call(body) {
  const t0 = performance.now();
  const r = await fetch(URL_, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const ms = performance.now() - t0;
  await r.text();
  const vid = r.headers.get("x-vercel-id") || "";
  return { ms, status: r.status, vid, codes: [...vid.matchAll(/\b([a-z]{3}\d)\b/g)].map((m) => m[1]) };
}

const name = (c) => `${c} (${REGIONS[c] || "noma'lum"})`;

console.log(`tekshirilmoqda: https://${HOST}\n`);

// Sovuq start hisobga tushmasin.
for (let i = 0; i < 3; i++) await call({});

const probe = await call({});
if (!probe.codes.length) {
  console.log("x-vercel-id topilmadi — sayt Vercel'da bo'lmasligi mumkin.");
  console.log("javob sarlavhasi:", probe.vid || "(bo'sh)");
  process.exit(0);
}
console.log("x-vercel-id :", probe.vid);
console.log("edge        :", name(probe.codes[0]));
console.log("FUNKSIYA    :", name(probe.codes[probe.codes.length - 1]));

const med = (a) => { const s = [...a].sort((x, y) => x - y); return s[Math.floor(s.length / 2)]; };
const noDb = [], withDb = [];
for (let i = 0; i < 6; i++) {
  noDb.push((await call({})).ms);
  withDb.push((await call({ token: "yaroqsiz-token-tekshiruv-uchun" })).ms);
}

console.log("\nbazaga TEGMAYDIGAN so'rov :", Math.round(Math.min(...noDb)), "ms (eng tez) |",
            Math.round(med(noDb)), "ms (o'rta)");
console.log("bazaga TEGADIGAN so'rov   :", Math.round(Math.min(...withDb)), "ms (eng tez) |",
            Math.round(med(withDb)), "ms (o'rta)");
console.log("-".repeat(56));
console.log("BITTA baza amali          :", Math.round(Math.min(...withDb) - Math.min(...noDb)), "ms");
console.log("\nKUTILGAN: funksiya va baza BIR REGIONDA bo'lsa bu son o'nlab");
console.log("millisekund bo'lishi kerak. Yuzlab bo'lsa — ular hali ham uzoqda.");
