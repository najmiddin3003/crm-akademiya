// Brauzerdan kelgan JSON'ni faylga yozadigan LOKAL qabul qiluvchi server.
//
// NEGA KERAK: edutizim ma'lumotini faqat brauzerdan (tizimga kirgan seans
// bilan) olish mumkin, lekin javascript_tool javobi ~1500 belgi bilan
// cheklangan — 20 000 qatorni undan o'tkazib bo'lmaydi. Shuning uchun
// brauzer sahifasi qatorlarni SHU serverga POST qiladi, server esa
// scripts/data/ ichiga yozadi.
//
// MUHIM: brauzerda `localhost` EMAS, `127.0.0.1` yozilsin — localhost
// IPv6 (::1) ga ketib osilib qoladi. HTTPS sahifadan http://127.0.0.1
// ga so'rov Chrome uchun ruxsat etilgan (loopback ishonchli hisoblanadi),
// ammo Private Network Access preflight'i uchun
// `Access-Control-Allow-Private-Network: true` sarlavhasi shart.
//
//   node scripts/_api-sink.mjs            # 127.0.0.1:8787
//   POST /dump?name=<fayl>  body: JSON massiv  -> scripts/data/<fayl>.ndjson ga qo'shiladi
//   POST /reset?name=<fayl>                    -> faylni tozalaydi
//   GET  /status                               -> qabul qilingan qatorlar soni
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), "data");
fs.mkdirSync(DIR, { recursive: true });
const counts = new Map();
const file = (name) => path.join(DIR, String(name || "dump").replace(/[^\w.-]/g, "_") + ".ndjson");

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
  "Access-Control-Allow-Headers": "*",
  "Access-Control-Allow-Private-Network": "true",
  "Access-Control-Max-Age": "86400",
};

http.createServer((req, res) => {
  const u = new URL(req.url, "http://127.0.0.1");
  const name = u.searchParams.get("name") || "dump";
  if (req.method === "OPTIONS") { res.writeHead(204, CORS); return res.end(); }
  if (req.method === "GET" && u.pathname === "/status") {
    res.writeHead(200, { ...CORS, "Content-Type": "application/json" });
    return res.end(JSON.stringify(Object.fromEntries(counts)));
  }
  if (req.method === "POST" && u.pathname === "/reset") {
    fs.writeFileSync(file(name), ""); counts.set(name, 0);
    res.writeHead(200, CORS); return res.end("ok");
  }
  if (req.method === "POST" && u.pathname === "/dump") {
    const chunks = [];
    req.on("data", (c) => chunks.push(c));
    req.on("end", () => {
      let n = 0;
      try {
        const body = JSON.parse(Buffer.concat(chunks).toString("utf8"));
        const rows = Array.isArray(body) ? body : [body];
        fs.appendFileSync(file(name), rows.map((r) => JSON.stringify(r)).join("\n") + "\n");
        n = rows.length;
        counts.set(name, (counts.get(name) ?? 0) + n);
        console.log(`${name}: +${n} (jami ${counts.get(name)})`);
      } catch (e) {
        console.error("xato:", e.message);
        res.writeHead(400, CORS); return res.end("bad json");
      }
      res.writeHead(200, { ...CORS, "Content-Type": "application/json" });
      res.end(JSON.stringify({ ok: true, added: n, total: counts.get(name) }));
    });
    return;
  }
  res.writeHead(404, CORS); res.end("no");
}).listen(8787, "127.0.0.1", () => console.log("sink: http://127.0.0.1:8787"));
