// `.env.local` dagi jadval ID larini almashtiradi (faqat shu ikki qator).
//
//   node scripts/_set-sheet-id.mjs <yangi-id>
//
// Fayldagi boshqa hech narsaga tegilmaydi: satrlar birma-bir yuriladi,
// faqat kerakli ikkitasining qiymati almashadi. Maxfiy qiymatlar
// ekranga CHIQARILMAYDI.
import fs from "node:fs";

const id = process.argv[2];
if (!id || id.length < 20) {
  console.error("Foydalanish: node scripts/_set-sheet-id.mjs <yangi-jadval-id>");
  process.exit(1);
}

const KEYS = ["SHEET_ID_PAYMENTS", "SHEET_ID_SALARIES"];
const path = ".env.local";
const backup = `${path}.zaxira-${Date.now()}`;
fs.copyFileSync(path, backup);

const lines = fs.readFileSync(path, "utf8").split(/\r?\n/);
const changed = [];
const out = lines.map((line) => {
  for (const k of KEYS) {
    if (line.startsWith(`${k}=`)) {
      const old = line.slice(k.length + 1).trim();
      if (old === id) return line;
      changed.push(`${k}: ${old.slice(0, 12)}… -> ${id.slice(0, 12)}…`);
      return `${k}=${id}`;
    }
  }
  return line;
});

fs.writeFileSync(path, out.join("\n"));
console.log("zaxira:", backup);
console.log(changed.length ? changed.join("\n") : "o'zgarish yo'q (allaqachon shu ID)");
for (const k of KEYS) {
  const found = out.some((l) => l.startsWith(`${k}=${id}`));
  console.log(`  ${k}: ${found ? "yangi ID qo'yildi" : "TOPILMADI — qo'lda tekshiring"}`);
}
