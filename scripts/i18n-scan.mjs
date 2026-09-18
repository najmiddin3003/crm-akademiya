// I18N TEKSHIRUVI — koddagi `t("...")` kalitlari va lug'at holati.
//
//   node scripts/i18n-scan.mjs            — inglizcha tarjimasi YO'Q kalitlar ro'yxati
//   node scripts/i18n-scan.mjs --unused   — lug'atda bor, kodda uchramaydigan kalitlar
//   node scripts/i18n-scan.mjs --todo     — yo'q kalitlarni messages/en.todo.json ga yozadi
//                                           (qiymat = kalit; tarjima qilib en.json ga ko'chiriladi)
//   node scripts/i18n-scan.mjs --raw      — hali `t()` bilan O'RALMAGAN JSX matnlari (fayl bo'yicha son)
//
// Kalit = o'zbekcha manba matn (lib/i18n.ts). Bu skript faqat STATIK
// kalitlarni ko'radi: `t("Saqlash")`. `t(item.label)` kabi dinamik
// chaqiruvlar uchun konstantalardagi yorliqlar alohida yig'iladi
// (quyidagi CONSTANT_SOURCES) — sidebar, tezkor havolalar, yordam
// mavzulari va h.k.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const args = process.argv.slice(2);

function walk(dir, out = []) {
  for (const f of fs.readdirSync(dir)) {
    const p = path.join(dir, f);
    const st = fs.statSync(p);
    if (st.isDirectory()) {
      if (f === "node_modules" || f.startsWith(".")) continue;
      walk(p, out);
    } else if (/\.(tsx?|jsx?|mjs)$/.test(f)) out.push(p);
  }
  return out;
}

const CODE_DIRS = ["app", "components", "lib", "hooks"].map((d) => path.join(ROOT, d)).filter(fs.existsSync);
const files = CODE_DIRS.flatMap((d) => walk(d));

/** `t("...")`, `t('...')`, `t(\`...\`)` (param'siz) — statik kalitlar. */
const keys = new Map(); // kalit -> fayllar
const callRe = /\bt\(\s*(["'`])((?:\\.|(?!\1)[^\\])*)\1/g;
for (const f of files) {
  const s = fs.readFileSync(f, "utf8");
  let m;
  while ((m = callRe.exec(s))) {
    const raw = m[2];
    // Template literal ichida ${} bo'lsa — dinamik, o'tkazib yuboriladi.
    if (m[1] === "`" && raw.includes("${")) continue;
    const key = raw.replace(/\\(["'`])/g, "$1");
    if (!keys.has(key)) keys.set(key, new Set());
    keys.get(key).add(path.relative(ROOT, f));
  }
}

/** Konstantalardagi yorliqlar — kodda `t(item.label)` bilan o'giriladi. */
const CONSTANT_SOURCES = [
  { file: "constants/sidebar.js", re: /\b(?:label|title):\s*"([^"]+)"/g },
  { file: "constants/navbar.js", re: /\bname:\s*"([^"]+)"/g, skip: true },
  { file: "constants/helpTopics.js", re: /\btitle:\s*"([^"]+)"/g },
  { file: "constants/notifications.js", re: /\b(?:payment|order|task):\s*"([^"]+)"/g },
  { file: "components/shared/Navbar.tsx", re: /\blabel:\s*"([^"]+)"/g },
  { file: "components/ui/DateRangePicker.tsx", re: /\blabel:\s*"([^"]+)"/g },
  { file: "components/ui/RichTextEditor.tsx", re: /\blabel:\s*"([^"]+)",\s*tag:/g },
  { file: "lib/taskInbox.ts", re: /\b(?:bajarildi|bajarilmadi):\s*"([^"]+)"/g },
  { file: "lib/tasksData.ts", re: /\b(?:kritik|yuqori|orta|past):\s*\{\s*label:\s*"([^"]+)"/g },
  { file: "lib/selectPlaceholder.ts", re: /(?:LOADING_TEXT =|ready =)\s*"([^"]+)"/g },
];
for (const src of CONSTANT_SOURCES) {
  if (src.skip) continue;
  const p = path.join(ROOT, src.file);
  if (!fs.existsSync(p)) continue;
  const s = fs.readFileSync(p, "utf8");
  let m;
  while ((m = src.re.exec(s))) {
    const key = m[1];
    if (!keys.has(key)) keys.set(key, new Set());
    keys.get(key).add(src.file);
  }
}

const enPath = path.join(ROOT, "messages/en.json");
const en = JSON.parse(fs.readFileSync(enPath, "utf8"));

if (args.includes("--raw")) {
  // Hali o'ralmagan JSX matni — fayl bo'yicha son (taxminiy: >Matn< qolipi).
  const jsxRe = />\s*([^<>{}\n]*[A-Za-zЀ-ӿ][^<>{}\n]*?)\s*</g;
  const rows = [];
  for (const f of files) {
    if (!f.endsWith(".tsx")) continue;
    const s = fs.readFileSync(f, "utf8");
    let n = 0;
    let m;
    while ((m = jsxRe.exec(s))) if (!/^[\s\d.,:%()/-]*$/.test(m[1])) n++;
    if (n) rows.push([n, path.relative(ROOT, f)]);
  }
  rows.sort((a, b) => b[0] - a[0]);
  for (const [n, f] of rows) console.log(String(n).padStart(5), f);
  console.log("\njami:", rows.reduce((s, r) => s + r[0], 0), "ta matn,", rows.length, "ta fayl");
  process.exit(0);
}

if (args.includes("--unused")) {
  const unused = Object.keys(en).filter((k) => !keys.has(k));
  for (const k of unused) console.log(k);
  console.log(`\n${unused.length} ta ishlatilmaydigan kalit.`);
  process.exit(0);
}

const missing = [...keys.keys()].filter((k) => !(k in en)).sort((a, b) => a.localeCompare(b));
if (args.includes("--todo")) {
  const todo = Object.fromEntries(missing.map((k) => [k, k]));
  fs.writeFileSync(path.join(ROOT, "messages/en.todo.json"), JSON.stringify(todo, null, 2) + "\n");
  console.log(`${missing.length} ta kalit messages/en.todo.json ga yozildi.`);
  process.exit(0);
}

for (const k of missing) console.log(`${k}    ← ${[...keys.get(k)].slice(0, 2).join(", ")}`);
console.log(`\nkalitlar: ${keys.size} | inglizchasi bor: ${keys.size - missing.length} | yo'q: ${missing.length}`);
