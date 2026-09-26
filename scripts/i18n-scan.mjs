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
  // Faqat teskari moslash bilan ishlatiladigan andozalar (lib/i18n.ts RENDERED_KEYS).
  { file: "lib/i18n.ts", re: /RENDERED_KEYS = \[([^\]]*)\]/g, list: true },
  { file: "constants/sidebar.js", re: /\b(?:label|title):\s*"([^"]+)"/g },
  // Tizimli to'lov turlari nomlari ("Naqd", "Plastik") — kassa kartalarida `t(m.name)`.
  { file: "constants/settingsLists.js", re: /\bname:\s*"([^"]+)"/g },
  // Ommaviy ish arizasi tanlovlari (vakansiya, fan, bandlik, ta'lim, tajriba, manba) — `t(r)`.
  { file: "constants/managementCv.js", re: /\b(?:roles|subjects):\s*\[([^\]]*)\]/g, list: true },
  { file: "constants/managementCv.js", re: /\bCV_(?:LOADS|EDU_LEVELS|EXP_LEVELS|SOURCES) = \[([^\]]*)\]/g, list: true },
  { file: "constants/managementCv.js", re: /\bCV_ANY_BRANCH = "([^"]+)"/g },
  { file: "constants/navbar.js", re: /\bname:\s*"([^"]+)"/g, skip: true },
  { file: "constants/helpTopics.js", re: /\btitle:\s*"([^"]+)"/g },
  { file: "constants/notifications.js", re: /\b(?:payment|order|task):\s*"([^"]+)"/g },
  { file: "components/shared/Navbar.tsx", re: /\blabel:\s*"([^"]+)"/g },
  { file: "components/ui/DateRangePicker.tsx", re: /\blabel:\s*"([^"]+)"/g },
  { file: "components/ui/RichTextEditor.tsx", re: /\blabel:\s*"([^"]+)",\s*tag:/g },
  { file: "lib/taskInbox.ts", re: /\b(?:bajarildi|bajarilmadi):\s*"([^"]+)"/g },
  { file: "lib/tasksData.ts", re: /\b(?:kritik|yuqori|orta|past):\s*\{\s*label:\s*"([^"]+)"/g },
  { file: "lib/selectPlaceholder.ts", re: /(?:LOADING_TEXT =|ready =)\s*"([^"]+)"/g },
  // Gamifikatsiya: tizim sabablari nomi va «Kim beradi», daraja/rol/yozuv turi yorliqlari — `t(r.name)`, `t(sys.who)`.
  { file: "lib/gamification/types.ts", re: /\b(?:name|who):\s*"([^"]+)"/g },
  // Sozlama maydonlari nomlari — server xatosida «{label}» bo'lib keladi va teskari moslashda o'giriladi.
  { file: "lib/gamification/rules.ts", re: /^\s+[A-Za-z0-9]+:\s*"([^"]+)",\s*$/gm },
  {
    file: "lib/gamification/types.ts",
    re: /\b(?:director|branch_admin|teacher|both|attendance|absence|homework_done|homework_missed|activity|exam_result|growth|streak|referral|reason|shop):\s*"([^"]+)"/g,
  },
];
for (const src of CONSTANT_SOURCES) {
  if (src.skip) continue;
  const p = path.join(ROOT, src.file);
  if (!fs.existsSync(p)) continue;
  const s = fs.readFileSync(p, "utf8");
  let m;
  while ((m = src.re.exec(s))) {
    // `list: true` — bitta moslik ichida bir nechta "…" satr (massiv).
    const found = src.list ? [...m[1].matchAll(/"((?:[^"\\]|\\.)*)"/g)].map((x) => x[1]) : [m[1]];
    for (const key of found) {
      if (!keys.has(key)) keys.set(key, new Set());
      keys.get(key).add(src.file);
    }
  }
}

/**
 * BACKEND XABARLARI — API route va lib'dagi `error: "…"`, `fail("…")`,
 * `throw new Error("…")` matnlari. Ular mijozga o'zbekcha (kalit) holida
 * keladi va ekranda `t()` orqali o'giriladi (ToastProvider, ErrorBanner,
 * `t(data.error)`). Andozali (`${x}`) xabarlar `{x}` ko'rinishida kalit
 * bo'ladi: lib/i18n.ts render bo'lgan xabarni shu andozaga TESKARI
 * moslab (reverse match) o'giradi — serverda til bilish shart emas.
 *
 * Tashqi kanallar (Telegram bot, SMS, Google Sheets) o'zbekcha qoladi —
 * ular skanerdan chiqarilgan.
 */
const SERVER_DIRS = ["app/api", "lib"];
const SERVER_SKIP = /[\\/](staffBot|studentBot|sync|telegram|eskiz|paymentSms|exportTable|receipt|referenceCache|fetchJson)/i;
const SERVER_FIELDS = "error|reason|message|msg|hint|title|text|detail|label";
// `fail(403, "…")`, `new GamError(422, "…")` — xabar oldida HTTP kodi bo'lishi
// mumkin (lib/gamification/http.ts, wallet.ts); u o'tkazib yuboriladi.
const serverRe = new RegExp(
  `\\b(?:(?:${SERVER_FIELDS})\\s*:|\\b(?:fail|bad|throw new Error|throw new ApiError|new GamError|new GamBusyError)\\((?:\\s*\\d+\\s*,)?)\\s*(?:"((?:[^"\\\\\\n]|\\\\.)+)"|\`((?:[^\`\\\\]|\\\\.)+?)\`)`,
  "g",
);
/** `${expr}` → `{name}` — nom ifodadagi oxirgi identifikator (kodmod 6-o'tishi bilan bir xil). */
function templateKey(body) {
  const params = [];
  return body.replace(/\$\{([^}]*)\}/g, (_, expr) => {
    // Satr literallari (`"ru-RU"`) nom bermasin.
    const ids = expr.replace(/"[^"]*"|'[^']*'/g, "").match(/[A-Za-z_]\w*/g) || [];
    let name = ids.length ? ids[ids.length - 1] : "v";
    if (/^(String|Number|Math|toLocaleString|toFixed|padStart|length|trim|join|map|abs|round|name|id)$/.test(name) && ids.length > 1) name = ids[ids.length - 2];
    let unique = name, k = 2;
    while (params.includes(unique)) unique = `${name}${k++}`;
    params.push(unique);
    return `{${unique}}`;
  });
}
/**
 * CSS klass satri — "text-[12px] dark:text-amber-400", "border-t". Har bir
 * bo'lak faqat kichik harf/raqam/belgi VA kamida bittasida harfdan keyin
 * "-", ":", "[", "/" yoki "." bor. "1 oy", "3 - shaxs" kabi o'zbekcha
 * iboralar klass EMAS (bo'lagida bunday belgi yo'q).
 */
function classLike(v) {
  const toks = v.trim().split(/\s+/);
  return toks.every((t) => /^[a-z0-9\-_:/.%[\]#!,]+$/.test(t)) && toks.some((t) => /^[a-z]+[-:[/.][a-z0-9\-_:/.%[\]#!,]*$/.test(t));
}
const serverKeys = new Map();
// Ternar bilan yasalgan xabarlar: `fail(\n  cond\n    ? \`…\`\n    : "…",\n)` yoki
// `error: left > 0 ? \`…\` : "…"` — maydon/chaqiruvdan keyin 4 qatorgacha
// ichidagi barcha satr literallari olinadi (yuqoridagi regex faqat bevosita
// kelgan satrni ko'radi).
const ternaryRe = new RegExp(`(?:\\b(?:${SERVER_FIELDS})\\s*:|\\b(?:fail|bad|throw new Error|throw new ApiError)\\()\\s*(?=(?:[^"\`\\n]*\\n){0,2}[^"\`\\n]*\\?)((?:[^\\n]*\\n){0,4}[^\\n]*)`, "g");
const litRe = /"((?:[^"\\\n]|\\.)+)"|`((?:[^`\\]|\\.)+?)`/g;
for (const f of SERVER_DIRS.flatMap((d) => (fs.existsSync(path.join(ROOT, d)) ? walk(path.join(ROOT, d)) : []))) {
  if (!/\.ts$/.test(f) || SERVER_SKIP.test(f)) continue;
  const s = fs.readFileSync(f, "utf8");
  const found = [];
  let m;
  while ((m = serverRe.exec(s))) found.push(m[1] !== undefined ? m[1].replace(/\\(.)/g, "$1") : templateKey(m[2]));
  while ((m = ternaryRe.exec(s))) {
    const block = m[1].split(/\n/).filter((ln) => !/^\s*\/\//.test(ln)).join("\n");
    let lm;
    while ((lm = litRe.exec(block))) found.push(lm[1] !== undefined ? lm[1].replace(/\\(.)/g, "$1") : templateKey(lm[2]));
    // Ichki `${a ? "x" : "y"}` bo'laklari ham satr sifatida tushadi — ular
    // gap emas (kichik harf, qisqa) — pastdagi filtr ushlab qoladi.
  }
  for (const key of found) {
    // Param'dan tashqari harf yo'q (`{d}.{m}.{y}`), kod, URL, kalit — o'tkazib yuboriladi.
    if (!/[A-Za-zЀ-ӿ]/.test(key.replace(/\{\w+\}/g, "")) || /^[A-Z_]+$/.test(key) || /^[a-z0-9_./:-]+$/.test(key)) continue;
    if (/<\w|=>|\bhttp|_id\b|\bmongodb\b/i.test(key) || classLike(key)) continue; // klass ("text-amber-600 dark:…")
    const rel = path.relative(ROOT, f);
    if (!keys.has(key)) keys.set(key, new Set());
    keys.get(key).add(rel);
    if (!serverKeys.has(key)) serverKeys.set(key, new Set());
    serverKeys.get(key).add(rel);
  }
}

/**
 * MODUL DARAJASIDAGI KONSTANTALAR — tab/ustun/holat ro'yxatlari
 * (`{ key: "x", label: "Matn" }`, `["Aktiv", "Arxiv"]`). Kodda `{t(tab.label)}`
 * / `{t(row.status)}` bilan o'giriladi — kalit shu yerdan yig'iladi.
 * Faqat ko'rsatiladigan nomlar (label/title/…) va `constants`/`lib`
 * dagi qiymat ro'yxatlari (`value:`). Komponent ichidagilari allaqachon
 * `t("…")` bilan o'ralgan — `label: "…"` naqshiga tushmaydi.
 */
const CONST_FIELDS = "label|title|hint|placeholder|description|tableLabel|shortLabel|menuLabel|sub|subtitle|emptyText|tooltip|heading|caption";
const constRe = new RegExp(`\\b(?:${CONST_FIELDS})\\s*:\\s*"((?:[^"\\\\\\n]|\\\\.)+)"`, "g");
const enumRe = /\b(?:value|status|holat|type|turi|kind|source|day|category|level|reason|stage|priority|method)\s*:\s*"((?:[^"\\\n]|\\.)+)"/g;
const constDirs = ["components", "constants", "lib", "app"].map((d) => path.join(ROOT, d)).filter(fs.existsSync);
for (const f of constDirs.flatMap((d) => walk(d))) {
  if (SERVER_SKIP.test(f) || /[\\/]api[\\/]/.test(f)) continue;
  const s = fs.readFileSync(f, "utf8");
  // constants/ dagi DEMO (seed) ma'lumot fayllari — ular interfeys matni
  // emas, bazaga urug' (bosh izohida "demo" so'zi bor).
  if (/[\\/]constants[\\/]/.test(f) && /demo/i.test(s.slice(0, 600))) continue;
  const rel = path.relative(ROOT, f);
  const add = (key) => {
    if (!/[A-Za-zЀ-ӿ]/.test(key) || /^[A-Z_]+$/.test(key) || classLike(key) || /^\d+(px|%|ms|s|em|rem)$/.test(key)) return; // klass, "12px"
    if (/<\w|=>|\bhttp|^\/|^#|^[a-z]+\.[A-Za-z]+$/.test(key)) return; // kod, URL, `keys.x` token
    if (!keys.has(key)) keys.set(key, new Set());
    keys.get(key).add(rel);
  };
  let m;
  while ((m = constRe.exec(s))) add(m[1].replace(/\\(.)/g, "$1"));
  if (/[\\/](constants|lib)[\\/]/.test(f)) {
    while ((m = enumRe.exec(s))) {
      const v = m[1].replace(/\\(.)/g, "$1");
      // Faqat o'zbekcha ko'rinishdagi qiymatlar: bosh harf yoki bo'shliq/apostrof.
      if (/^[A-Z]/.test(v) || /[\s'’ʻ]/.test(v)) add(v);
    }
  }
}

if (args.includes("--server")) {
  for (const [k, fs_] of serverKeys) console.log(`${k}    ← ${[...fs_].slice(0, 2).join(", ")}`);
  console.log(`\n${serverKeys.size} ta backend xabari.`);
  process.exit(0);
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
