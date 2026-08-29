// Indekslarni deploy paytida BIR MARTA yaratish uchun.
//
//   node scripts/ensure-indexes.mjs
//
// Ilova ishga tushganda ham ularni tekshiradi (lib/mongodb.ts), lekin u
// yerda 71 ta chaqiruv birinchi so'rovni kutdiradi. Deploydan keyin shuni
// bir marta ishga tushirsangiz, ish vaqtidagi tekshiruv arzon bo'ladi.
import { ensureIndexes } from "../lib/mongodb.ts";

const t = Date.now();
await ensureIndexes();
console.log(`Indekslar tayyor — ${((Date.now() - t) / 1000).toFixed(1)} s`);
process.exit(0);
