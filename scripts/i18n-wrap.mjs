// I18N O'RASH KODMODI — komponentdagi qattiq matnlarni `t("...")` bilan o'raydi.
//
//   node scripts/i18n-wrap.mjs components/finance            — papka (yoki fayl) bo'yicha
//   node scripts/i18n-wrap.mjs components/finance --dry      — faqat sanaydi, yozmaydi
//
// NIMA QILADI (faqat "use client" fayllarda, faqat KOMPONENT tanalari ichida —
// bosh harfli funksiya/arrow; modul darajasidagi yordamchilarga tegmaydi):
//   1) JSX matni  `>Saqlash<`                → `>{t("Saqlash")}<`
//   2) atributlar `placeholder="Ism"`        → `placeholder={t("Ism")}`
//   3) chaqiruvlar `showError("…")`, `confirm("…")`, `setError("…")` … → `t("…")`
//   4) ternar `cond ? "A" : "B"`             → `cond ? t("A") : t("B")`
//   5) `showError(x || "…")`                 → `showError(t(x || "…"))`
//   6) andozali satr `\`Jami: ${x} so'm\``   → `t("Jami: {x} so'm", { x })`
//   7) `import { useT }` va har komponent boshiga `const { t } = useT();`
//
// NIMA QILMAYDI (qo'lda): massiv/obyekt ichidagi yorliqlar, aralash JSX
// (`Jami: {n} so'm`), ichma-ich andozalar, modul darajasidagi yordamchi
// funksiyalar (ularda `t` yo'q — `t` ni parametr qiling yoki kalit qaytaring).
// Izoh va backtick andoza ichiga tegmaydi. `scripts/i18n-left.mjs` qolganini sanaydi.
//
// Har faylda natija SINOVDAN o'tishi shart: `npx tsc -p tsconfig.check.json`,
// `npx eslint` (react-hooks qoidalari hook noto'g'ri joyga tushsa ushlaydi).
import fs from "node:fs";
import path from "node:path";

const args = process.argv.slice(2);
const target = args.find((a) => !a.startsWith("--"));
if (!target) {
  console.log("papka yoki fayl bering");
  process.exit(1);
}
const DRY = args.includes("--dry");

function walk(p, out = []) {
  const st = fs.statSync(p);
  if (st.isDirectory()) {
    for (const f of fs.readdirSync(p)) walk(path.join(p, f), out);
  } else if (p.endsWith(".tsx")) out.push(p);
  return out;
}

const ATTRS = ["placeholder", "title", "label", "aria-label", "alt", "emptyText", "hint", "subtitle", "description"];
const CALLS = ["showError", "showSuccess", "showInfo", "showWarning", "confirm", "alert", "setError", "setSaveError"];
// Obyekt xususiyatlari — faqat ekranga chiqadigan nomlar. `text`, `name`,
// `value`, `status` YO'Q: ular ko'pincha bazaga ketadigan qiymat.
const PROPS = ["label", "title", "placeholder", "hint", "tooltip", "caption", "heading", "subtitle", "description", "emptyText", "helper", "tableLabel", "shortLabel", "menuLabel"];
// `{row.status}` kabi ko'rsatiladigan maydonlar (4d-o'tish): yorliqlar + holat/tur
// kabi sanab o'tiladigan qiymatlar. Ism/izoh maydonlari (`name`, `text`) yo'q.
const FIELDS = [...PROPS, "sub", "status", "holat", "holati", "type", "turi", "kind", "source", "manba", "category", "kategoriya",
  "level", "daraja", "reason", "sabab", "sababi", "stage", "bosqich", "priority", "muhimlik", "txType", "paymentType", "paymentMethod", "method",
  "outcome", "salaryType", "gender", "jins", "jinsi", "role", "lavozim", "lavozimi", "weekday", "mainType", "entryType"];

/** HTML entity'lar → belgi (JSX matnida `&apos;` ko'p). */
function decodeEntities(s) {
  return s
    .replace(/&apos;/g, "'")
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&rarr;/g, "→")
    .replace(/&larr;/g, "←")
    .replace(/&nbsp;/g, " ")
    .replace(/&middot;/g, "·")
    .replace(/&mdash;/g, "—")
    .replace(/&ndash;/g, "–")
    .replace(/&hellip;/g, "…")
    .replace(/&amp;/g, "&");
}

/** Matn o'rashga arziydimi — kamida bitta harf, faqat belgi/raqam emas. */
function worthy(text) {
  if (!/[A-Za-zЀ-ӿ]/.test(text)) return false;
  if (/^[A-Z_]+$/.test(text)) return false; // "UZS", "ID", "PATCH", "__DATE__" — bitta katta harfli so'z: kod
  if (/^Ctrl \w$/.test(text) || text === "Tizimli") return false; // klaviatura ishorasi, brend
  if (/^https?:/.test(text)) return false;
  return true;
}

/** Klass/URL/kalitga o'xshash satr — matn emas (`"flex items-center"`, `"/api/x"`). */
const classLike = (v) => /^[a-z0-9\s\-_:/.%[\]#!,]+$/.test(v) || /^\/|^https?:|^#|^data:/.test(v);

const jsKey = (text) => JSON.stringify(text);

/** Izoh oraliqlari — ichida hech narsa o'ralmaydi. */
function commentRanges(s) {
  const out = [];
  const re = /\/\*[\s\S]*?\*\/|(?:^|[^:"'`])\/\/[^\n]*/g;
  let m;
  while ((m = re.exec(s))) out.push([m.index, m.index + m[0].length]);
  return out;
}

/** Backtick andozalari — skaner bilan (`${}` ichida yana backtick bo'lishi mumkin). */
function templateRanges(s) {
  const out = [];
  for (let i = 0; i < s.length; i++) {
    if (s[i] !== "`") continue;
    let j = i + 1, depth = 0, nested = false, ok = false;
    while (j < s.length) {
      const c = s[j];
      if (c === "\\") { j += 2; continue; }
      if (depth === 0 && c === "`") { ok = true; break; }
      if (c === "$" && s[j + 1] === "{") { depth++; j += 2; continue; }
      if (depth > 0 && c === "}") { depth--; j++; continue; }
      if (depth > 0 && c === "`") nested = true;
      j++;
    }
    if (!ok) break;
    out.push({ start: i, end: j + 1, body: s.slice(i + 1, j), nested });
    i = j;
  }
  return out;
}

/** Komponent tanalarini topadi — bosh harfli funksiya/arrow, ENG TASHQI lari. */
function componentBodies(s) {
  const fnRe = /(?:^|\n)(?:export\s+(?:default\s+)?)?(?:async\s+)?function\s+([A-Z]\w*)\s*(?:<[^>]*>)?\(/g;
  const arrowRe = /(?:^|\n)(?:export\s+)?const\s+([A-Z]\w*)\s*(?::[^=]*)?=\s*(?:React\.)?(?:memo\()?(?:forwardRef[^(]*\()?\s*(?:\([^)]*\)|\w+)\s*(?::\s*[^=]+)?=>\s*\{/g;
  const findClose = (openIdx) => {
    let depth = 0;
    for (let i = openIdx; i < s.length; i++) {
      const ch = s[i];
      if (ch === "{") depth++;
      else if (ch === "}") { depth--; if (depth === 0) return i; }
    }
    return -1;
  };
  const bodies = [];
  let m;
  while ((m = fnRe.exec(s))) {
    let i = m.index + m[0].length, paren = 1;
    while (i < s.length && paren > 0) { if (s[i] === "(") paren++; else if (s[i] === ")") paren--; i++; }
    const open = s.indexOf("{", i);
    if (open < 0) continue;
    const close = findClose(open);
    if (close > open) bodies.push({ name: m[1], open, close });
  }
  while ((m = arrowRe.exec(s))) {
    const open = m.index + m[0].length - 1;
    const close = findClose(open);
    if (close > open) bodies.push({ name: m[1], open, close });
  }
  bodies.sort((a, b) => a.open - b.open);
  return bodies.filter((b) => !bodies.some((o) => o !== b && o.open < b.open && o.close > b.close));
}

/** Bitta komponent tanasini o'raydi. */
function transformSegment(seg, wrapped) {
  let count = 0;
  const masked = [...commentRanges(seg), ...templateRanges(seg).map((t) => [t.start, t.end])];
  const inMasked = (idx) => masked.some(([a, b]) => idx >= a && idx < b);
  // Bo'shliq SAQLANADI: yangi qatorli bo'lsa o'zi, bir qatorli bo'lsa `{" "}`.
  const ws = (w) => (w === "" ? "" : w.includes("\n") ? w : '{" "}');

  // 1) JSX matni.
  const overlaps = (from, to) => masked.some(([a, b]) => from < b && to > a);
  seg = seg.replace(/>([^<>{}]+)</g, (m, inner, offset) => {
    if (inMasked(offset) || overlaps(offset, offset + m.length)) return m;
    // `) : (` / `} : {` — JSX orasidagi kod; `//` — izoh.
    if (/^\s*[)}:,]/.test(inner) || inner.includes("//")) return m;
    // `>` TEG OXIRI bo'lishi shart: oldida bo'shliq (`a > b`) yoki `=` (`=>`) — kod.
    // Istisno: `>` QATOR BOSHIDA (ko'p qatorli teg `<button\n  …\n>`) — teg oxiri.
    const before = seg[offset - 1] ?? "";
    const lineStart = /^[ \t]*$/.test(seg.slice(seg.lastIndexOf("\n", offset - 1) + 1, offset));
    if (before === "" || (/[\s=-]/.test(before) && !lineStart)) return m;
    if ((inner.match(/\n/g) || []).length > 3) return m;
    const text = decodeEntities(inner).replace(/\s+/g, " ").trim();
    if (!text || !worthy(text)) return m;
    // `;` va `=` — kod. Qavs faqat muvozanatli va ibora ichida bo'lsa mumkin
    // ("Davomiyligi (daqiqa)"); `a.b`, `f(` — kod. "F.I.Sh." — qisqartma, mumkin.
    if (/[;=]/.test(text)) return m;
    if (/[()]/.test(text) && !(/^[A-Za-zЀ-ӿ+"«]/.test(text) && (text.match(/\(/g) || []).length === (text.match(/\)/g) || []).length)) return m;
    if (/&&|\|\||\s\?\s|[a-z_]\.[a-z_]|\w\(/.test(text)) return m;
    count++;
    wrapped.push(text);
    return `>${ws(inner.match(/^\s*/)[0])}{t(${jsKey(text)})}${ws(inner.match(/\s*$/)[0])}<`;
  });

  // 2) Atributlar.
  const attrRe = new RegExp(`\\b(${ATTRS.join("|")})="([^"{}]+)"`, "g");
  seg = seg.replace(attrRe, (m, name, value, offset) => {
    if (inMasked(offset)) return m;
    const text = decodeEntities(value).trim();
    if (!worthy(text) || classLike(text)) return m;
    count++;
    wrapped.push(text);
    return `${name}={t(${jsKey(text)})}`;
  });

  // 3) Chaqiruvlar.
  // Qo'shtirnoq ichida `\"` bo'lishi mumkin — escape'ni tushunadigan naqsh.
  const callRe = new RegExp(`\\b(${CALLS.join("|")})\\(\\s*"((?:[^"\\\\\\n]|\\\\.)+)"`, "g");
  seg = seg.replace(callRe, (m, fn, raw, offset) => {
    const value = raw.replace(/\\(.)/g, "$1");
    // `setError("error" in json ? …)` — bitta kichik harfli so'z kalit, matn emas.
    if (inMasked(offset) || !worthy(value) || /^[a-z_]+$/.test(value)) return m;
    count++;
    wrapped.push(value);
    return `${fn}(t(${jsKey(value)})`;
  });

  // 4) Ternar — bir qatorli, ikki tomoni ham matn.
  seg = seg.replace(/\? "((?:[^"\\\n]|\\.)+)" : "((?:[^"\\\n]|\\.)+)"/g, (m, ra, rb, offset) => {
    if (inMasked(offset)) return m;
    const a = ra.replace(/\\(.)/g, "$1");
    const b = rb.replace(/\\(.)/g, "$1");
    if (!worthy(a) || !worthy(b) || classLike(a) || classLike(b)) return m;
    count += 2;
    wrapped.push(a, b);
    return `? t(${jsKey(a)}) : t(${jsKey(b)})`;
  });
  // 4b) Ternar — ko'p qatorli yoki bir tomoni bo'sh/null. Faqat GAPGA o'xshagan
  // matn (bo'shliq yoki apostrof bor) — `? "kirim" : "chiqim"` kabi qiymatlar
  // (bazaga ketadigan) tegilmaydi.
  const sentence = (v) => worthy(v) && !classLike(v) && /[\s'’ʻ]/.test(v) && !/^[a-z]/.test(v);
  const strLit = `"((?:[^"\\\\\\n]|\\\\.)*)"`;
  const unesc = (v) => v.replace(/\\(.)/g, "$1");
  const wrapSide = (raw) => {
    const v = unesc(raw);
    if (!sentence(v)) return null;
    count++;
    wrapped.push(v);
    return `t(${jsKey(v)})`;
  };
  seg = seg.replace(new RegExp(`\\?(\\s*)${strLit}(\\s*):(\\s*)${strLit}`, "g"), (m, w1, ra, w2, w3, rb, offset) => {
    if (inMasked(offset)) return m;
    const a = wrapSide(ra), b = wrapSide(rb);
    if (!a && !b) return m;
    return `?${w1}${a ?? `"${ra}"`}${w2}:${w3}${b ?? `"${rb}"`}`;
  });
  seg = seg.replace(new RegExp(`\\?(\\s*)${strLit}(\\s*):(\\s*)(null|undefined)\\b`, "g"), (m, w1, ra, w2, w3, other, offset) => {
    if (inMasked(offset)) return m;
    const a = wrapSide(ra);
    return a ? `?${w1}${a}${w2}:${w3}${other}` : m;
  });
  seg = seg.replace(new RegExp(`\\?(\\s*)(null|undefined)(\\s*):(\\s*)${strLit}`, "g"), (m, w1, other, w2, w3, rb, offset) => {
    if (inMasked(offset)) return m;
    const b = wrapSide(rb);
    return b ? `?${w1}${other}${w2}:${w3}${b}` : m;
  });

  // 4c) Obyekt xususiyati — faqat KO'RSATILADIGAN nomlar (`label: "…"`).
  seg = seg.replace(new RegExp(`\\b(${PROPS.join("|")})(\\s*):(\\s*)${strLit}`, "g"), (m, name, w1, w2, raw, offset) => {
    if (inMasked(offset)) return m;
    const v = unesc(raw);
    if (!worthy(v) || classLike(v) || /^[a-z_]+$/.test(v)) return m;
    count++;
    wrapped.push(v);
    return `${name}${w1}:${w2}t(${jsKey(v)})`;
  });

  // 4d) Ko'rsatiladigan MAYDONLAR: `{tab.label}`, `{row.status}`, `title={col.title}`
  // → `t(...)`. Qiymat modul konstantasidan yoki bazadan keladi; lug'atda
  // bo'lsa o'giriladi, bo'lmasa (foydalanuvchi ma'lumoti) o'z holicha qoladi
  // (lib/i18n.ts darvozasi). `name`/`text` ATAYIN yo'q — ular ism, izoh.
  const fieldExpr = `((?:\\w+\\??\\.)+(?:${FIELDS.join("|")}))`;
  seg = seg.replace(new RegExp(`([>\\s])\\{${fieldExpr}\\}`, "g"), (m, before, expr, offset) => {
    if (inMasked(offset)) return m;
    count++;
    return `${before}{t(${expr})}`;
  });
  seg = seg.replace(new RegExp(`\\b(${ATTRS.join("|")})=\\{${fieldExpr}\\}`, "g"), (m, name, expr, offset) => {
    if (inMasked(offset)) return m;
    count++;
    return `${name}={t(${expr})}`;
  });

  // 5) `showError(x || "…")`.
  const orCallRe = new RegExp(`\\b(${CALLS.join("|")})\\(([^()\\n]*?\\|\\|\\s*)"([^"\\n]+)"\\)`, "g");
  seg = seg.replace(orCallRe, (m, fn, lhs, value, offset) => {
    if (inMasked(offset) || !worthy(value)) return m;
    count++;
    wrapped.push(value);
    return `${fn}(t(${lhs}${jsKey(value)}))`;
  });

  // 6) Andozali satrlar — orqadan oldinga (indekslar surilmasin).
  const comments = commentRanges(seg);
  const inComment = (idx) => comments.some(([a, b]) => idx >= a && idx < b);
  for (const tpl of templateRanges(seg).reverse()) {
    const { start, end, body, nested } = tpl;
    if (nested || inComment(start) || !body.includes("${") || body.includes("\n")) continue;
    if (/<\w|class=/.test(body)) continue; // HTML andoza (chek) — qo'lda
    const line = seg.slice(seg.lastIndexOf("\n", start) + 1, start);
    if (/console\.|className|href=|fetch\(|\/api\/|key=|url|URL|src=|filename|writeFile|download/.test(line)) continue;
    const staticText = body.replace(/\$\{[^}]*\}/g, " ").replace(/\s+/g, " ").trim();
    if (!/[A-Za-zЀ-ӿ]{3,}/.test(staticText) || !/[\s'’ʻ]/.test(staticText) || classLike(staticText)) continue;
    if (/\bpx\b|repeat\(|minmax|font-weight|\w+:\s*\w+;|\b(?:hsl|rgb)a?\(|%\)|\b(?:rotate|translate|scale)\(|\bdeg\b|cubic-bezier|^(?:transform|transition)\b/.test(staticText)) continue; // CSS / SVG andozasi
    const params = [];
    const key = body.replace(/\$\{([^}]*)\}/g, (_, expr) => {
      const ids = expr.match(/[A-Za-z_]\w*/g) || [];
      let name = ids.length ? ids[ids.length - 1] : "v";
      if (/^(String|Number|Math|toLocaleString|toFixed|padStart|length|trim|join|map|abs|round)$/.test(name) && ids.length > 1) name = ids[ids.length - 2];
      let unique = name, k = 2;
      while (params.some((p) => p.name === unique)) unique = `${name}${k++}`;
      params.push({ name: unique, expr: expr.trim() });
      return `{${unique}}`;
    });
    if (params.some((p) => /["`]/.test(p.expr))) continue; // `${cond ? "a" : "b"}` — qo'lda
    count++;
    wrapped.push(key);
    const argList = params.map((p) => (p.name === p.expr ? p.name : `${p.name}: ${p.expr}`)).join(", ");
    seg = seg.slice(0, start) + `t(${jsKey(key)}, { ${argList} })` + seg.slice(end);
  }

  return { seg, count };
}

function wrapFile(file) {
  const raw = fs.readFileSync(file, "utf8");
  const nl = raw.includes("\r\n") ? "\r\n" : "\n";
  let s = raw.split("\r\n").join("\n");
  if (!/^"use client";/m.test(s)) return { file, skipped: "server komponent" };

  const wrapped = [];
  let count = 0;
  let inserted = 0;
  // Faqat KOMPONENT tanalari o'raladi (orqadan oldinga — indekslar surilmasin).
  for (const b of componentBodies(s).reverse()) {
    let original = s.slice(b.open, b.close + 1);
    // Komponentda `t` nomli o'z o'zgaruvchisi bo'lsa (`const t = …`,
    // `.map((t) => …)`) — tarjimon bilan to'qnashadi: lokal `t` → `tv`.
    // `.t` (xususiyat) va `t(` ning o'zi (allaqachon tarjimon) tegilmaydi.
    if (/\b(?:const|let|var)\s+t\b|\(\s*t\s*\)\s*=>|\(\s*t\s*,|,\s*t\s*\)\s*=>|\bfunction\s+t\b/.test(original)) {
      original = original.replace(/\bt\b/g, (m, offset, str) => {
        const prev = str[offset - 1] ?? "";
        // `obj.t` — xususiyat (tegilmaydi); `...t` — spread (lokal `t`, o'zgaradi).
        if (prev === "." && str[offset - 2] !== ".") return m;
        if (str[offset + 1] === "(") return m;
        // `border-t` (klass ichida) va `{ t } = useT()` (tarjimonning o'zi) — tegilmaydi.
        if (prev === "-") return m;
        if (/\{\s*$/.test(str.slice(Math.max(0, offset - 3), offset)) && /^\s*\}\s*=\s*useT/.test(str.slice(offset + 1, offset + 12))) return m;
        // Qo'shtirnoqli satr ichida (qatorda undan oldingi qo'shtirnoqlar soni toq).
        const lineStart = str.lastIndexOf("\n", offset) + 1;
        if (((str.slice(lineStart, offset).match(/"/g) || []).length % 2) === 1) return m;
        return "tv";
      });
    }
    const r = transformSegment(original, wrapped);
    if (!r.count) continue;
    count += r.count;
    let seg = r.seg;
    if (!/useT\(\)/.test(seg)) {
      seg = seg.slice(0, 1) + "\n  const { t } = useT();" + seg.slice(1);
      inserted++;
    }
    s = s.slice(0, b.open) + seg + s.slice(b.close + 1);
  }
  if (count === 0) return { file, count: 0 };

  // 7) Import.
  if (!s.includes(`from "@/components/shared/Language"`)) {
    // Ko'p qatorli importlar ham (`import {\n … } from "…";`) — oxirgisidan keyin.
    const imports = [...s.matchAll(/^import\s+(?:type\s+)?(?:[^;]*?from\s+)?["'][^"']+["'];?[ \t]*\n/gm)];
    const last = imports[imports.length - 1];
    const uc = s.match(/^"use client";\n/m);
    const at = last ? last.index + last[0].length : uc ? uc.index + uc[0].length : 0;
    s = s.slice(0, at) + `import { useT } from "@/components/shared/Language";\n` + s.slice(at);
  } else if (!/\buseT\b/.test(s.match(/import \{[^}]*\} from "@\/components\/shared\/Language"/)?.[0] ?? "")) {
    s = s.replace(/import \{([^}]*)\} from "@\/components\/shared\/Language"/, (m, names) => `import {${names.replace(/\s*$/, "")}, useT } from "@/components/shared/Language"`);
  }

  if (!DRY) fs.writeFileSync(file, s.split("\n").join(nl));
  return { file, count, inserted, wrapped };
}

const files = walk(target);
let total = 0;
for (const f of files) {
  const r = wrapFile(f);
  if (r.skipped) { console.log(`  —  ${path.relative(process.cwd(), f)} (${r.skipped})`); continue; }
  if (!r.count) continue;
  total += r.count;
  console.log(`${String(r.count).padStart(4)}  ${path.relative(process.cwd(), f)}  (hook: ${r.inserted})`);
}
console.log(`\njami ${total} ta o'ram${DRY ? " (quruq)" : ""}`);
