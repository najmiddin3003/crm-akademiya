// Kodmoddan KEYIN qolgan qattiq matnlar — ternar, massiv, andozali satr va h.k.
//   node scripts/i18n-left.mjs components/finance          — ro'yxat (fayl:qator: matn)
//   node scripts/i18n-left.mjs components/finance --count  — faqat fayl bo'yicha son
// Taxminiy: qo'shtirnoqli, ichida bo'shliq yoki apostrof bor, `t(` bilan
// o'ralmagan satrlar. Klass, URL, kalit va importlar tashlab yuboriladi.
import fs from "node:fs";
import path from "node:path";

const target = process.argv[2];
const COUNT = process.argv.includes("--count");
function walk(p, out = []) {
  const st = fs.statSync(p);
  if (st.isDirectory()) for (const f of fs.readdirSync(p)) walk(path.join(p, f), out);
  else if (p.endsWith(".tsx")) out.push(p);
  return out;
}
// Bo'sh "" ham mos keladi — aks holda ikki bo'sh satr ORASIDAGI kod "satr" bo'lib qolardi.
const strRe = /"((?:[^"\\\n]|\\.)*)"/g;
const tplRe = /`((?:[^`\\]|\\.)*?)`/g;
const rows = [];
for (const f of walk(target)) {
  const lines = fs.readFileSync(f, "utf8").split(/\r?\n/);
  lines.forEach((ln, i) => {
    if (/^\s*(\/\/|\*|\/\*)/.test(ln)) return;
    if (/^import |from "/.test(ln.trim())) return;
    let m;
    while ((m = strRe.exec(ln))) {
      const v = m[1];
      if (!/[A-Za-z]/.test(v)) continue;
      if (!/[\s'’ʻ]/.test(v)) continue; // bitta so'z — ko'pincha kalit/klass
      if (/className|href=|#i-|\.svg|\/api\//.test(ln.slice(Math.max(0, m.index - 30), m.index + m[0].length))) continue;
      if (ln.slice(0, m.index).endsWith("t(")) continue;
      if (/^[a-z0-9\s\-_:/.%()#,]+$/.test(v)) continue; // "flex items-center" kabi
      // SVG yo'li, atribut nomi (`fill=`), andoza bo'lagi (`}${x ?`), faqat tinish.
      if (/^[MmLlHhVvCcSsQqTtAaZz][\d.\s-]/.test(v) || /^\s*[\w-]+=$/.test(v) || /\$\{|\}\$/.test(v) || /^[\s}{)(?:]*$/.test(v)) continue;
      rows.push([f, i + 1, v.slice(0, 80)]);
    }
    while ((m = tplRe.exec(ln))) {
      const v = m[1];
      if (!/[A-Za-z]{3,}\s/.test(v) || !/['’ʻ]|\s(ta|so'm|yo'q|bor|uchun|bilan)\b/.test(v)) continue;
      rows.push([f, i + 1, "`" + v.slice(0, 80) + "`"]);
    }
  });
}
if (COUNT) {
  const by = {};
  for (const r of rows) by[r[0]] = (by[r[0]] || 0) + 1;
  for (const [f, n] of Object.entries(by).sort((a, b) => b[1] - a[1])) console.log(String(n).padStart(4), f);
} else {
  for (const r of rows) console.log(`${r[0]}:${r[1]}: ${r[2]}`);
}
console.log(`\njami ${rows.length}`);
