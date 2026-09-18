// scripts/_ts-alias.mjs ro'yxatdan o'tkazadigan yechim ilgaklari.
// Alohida faylda: Node yuklagich ilgaklarini ALOHIDA ipda ishga tushiradi
// va ularni asosiy modul bilan bir faylda saqlab bo'lmaydi.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

// Loyiha ildizi — shu faylning bir pog'ona yuqorisi. `process.cwd()` EMAS:
// skript boshqa papkadan turib chaqirilsa taxallus buzilardi.
const ROOT = pathToFileURL(path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")).href + "/";

const EXTS = [".ts", ".tsx", ".js", ".mjs", "/index.ts", "/index.js"];

/** Kengaytmasiz yo'lga mavjud faylnikini qo'shadi. Topilmasa — o'zgarmaydi. */
function withExt(url) {
  const p = fileURLToPath(url);
  if (fs.existsSync(p) && fs.statSync(p).isFile()) return url;
  for (const ext of EXTS) if (fs.existsSync(p + ext)) return url + ext;
  return url;
}

export function resolve(specifier, context, next) {
  if (specifier.startsWith("@/")) {
    return next(withExt(new URL(specifier.slice(2), ROOT).href), context);
  }
  // `next/server`, `next/headers` — Next paketining `exports` xaritasi
  // yo'q, Node esa kengaytmasiz pastki yo'lni topa olmaydi ("Did you
  // mean next/server.js?"). Next ichida bu muammo yo'q, faqat skriptda.
  // Sessiya va filial modullari (lib/auth.ts, lib/branchScope.ts) shu
  // ikkisini import qiladi; ular yuklanadi, lekin `cookies()` ni
  // so'rovdan tashqarida chaqirib bo'lmaydi — skriptlar chaqirmaydi ham.
  if (specifier.startsWith("next/") && !specifier.endsWith(".js")) {
    const candidate = new URL(`node_modules/${specifier}.js`, ROOT);
    if (fs.existsSync(fileURLToPath(candidate))) return next(candidate.href, context);
  }
  if (specifier.startsWith("./") || specifier.startsWith("../")) {
    const parent = context.parentURL;
    if (parent && parent.startsWith("file:")) {
      const target = new URL(specifier, parent).href;
      const fixed = withExt(target);
      if (fixed !== target) return next(fixed, context);
    }
  }
  return next(specifier, context);
}
