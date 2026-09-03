// lib/notifications.ts va lib/uzTime.ts dagi sof funksiyalarning nusxasi
// ustida tekshiruv (path alias tufayli fayllarni to'g'ridan-to'g'ri import
// qilib bo'lmaydi).
const p2 = (n) => String(n).padStart(2, "0");
const toUz = (d) => new Date(d.getTime() + (d.getTimezoneOffset() + 300) * 60000);
const uzDayKey = (d) => { const u = toUz(d); return u.getFullYear() * 10000 + (u.getMonth() + 1) * 100 + u.getDate(); };
const uzStamp = (d) => { const u = toUz(d); return `${p2(u.getDate())}.${p2(u.getMonth() + 1)}.${u.getFullYear()} | ${p2(u.getHours())}:${p2(u.getMinutes())}`; };
const uzMoney = (n) => Math.round(Math.abs(n)).toLocaleString("ru-RU").replace(/[\u00A0,]/g, " ");
function uzParseStamp(s) {
  if (typeof s !== "string") return null;
  const t = /(?:Z|[+-]\d{2}:?\d{2})$/.test(s) ? Date.parse(s)
    : /^\d{4}-\d{2}-\d{2}$/.test(s) ? Date.parse(`${s}T00:00:00+05:00`)
    : /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(s) ? Date.parse(`${s}:00+05:00`)
    : /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?$/.test(s) ? Date.parse(`${s}+05:00`)
    : NaN;
  return Number.isFinite(t) ? t : null;
}
function relativeUz(atIso, nowMs) {
  const t = Date.parse(atIso);
  if (!Number.isFinite(t)) return "";
  const d = Math.max(0, nowMs - t);
  if (d < 60000) return "Hozirgina";
  if (d < 3600000) return `${Math.floor(d / 60000)} daqiqa oldin`;
  const day = uzDayKey(new Date(t));
  if (day === uzDayKey(new Date(nowMs))) return `${Math.floor(d / 3600000)} soat oldin`;
  if (day === uzDayKey(new Date(nowMs - 86400000))) return "Kecha";
  return uzStamp(new Date(t));
}

let bad = 0;
const eq = (name, got, want) => { const ok = got === want; if (!ok) bad++; console.log(`${ok ? "OK  " : "XATO"} ${name}: ${JSON.stringify(got)}${ok ? "" : " != " + JSON.stringify(want)}`); };

console.log("--- uzMoney (uzilmas bo'shliq va kasr) ---");
eq("850000", uzMoney(850000), "850 000");
eq("850000.5 yaxlitlanadi", uzMoney(850000.5), "850 001");
eq("manfiy", uzMoney(-140000), "140 000");
eq("kichik", uzMoney(35000), "35 000");
eq("uzilmas bo'shliq qolmadi", /\u00A0/.test(uzMoney(1234567)), false);

console.log("\n--- uzParseStamp (uch xil shakl + axlat) ---");
const wall = uzParseStamp("2026-09-03T14:30:00");
eq("devor-soati +05:00 deb o'qiladi", new Date(wall).toISOString(), "2026-09-03T09:30:00.000Z");
eq("haqiqiy lahza o'z holicha", new Date(uzParseStamp("2026-09-02T04:00:00.000Z")).toISOString(), "2026-09-02T04:00:00.000Z");
eq("faqat sana", new Date(uzParseStamp("2026-09-03")).toISOString(), "2026-09-02T19:00:00.000Z");
eq("daqiqagacha", new Date(uzParseStamp("2026-09-03T14:30")).toISOString(), "2026-09-03T09:30:00.000Z");
eq("axlat -> null", uzParseStamp("salom"), null);
eq("bo'sh -> null", uzParseStamp(""), null);
eq("undefined -> null", uzParseStamp(undefined), null);
eq("son -> null", uzParseStamp(1757000000000), null);

console.log("\n--- relativeUz ---");
const now = Date.parse("2026-09-03T12:00:00.000Z");
eq("hozir", relativeUz("2026-09-03T11:59:30.000Z", now), "Hozirgina");
eq("5 daqiqa", relativeUz("2026-09-03T11:55:00.000Z", now), "5 daqiqa oldin");
eq("3 soat (ayni kun)", relativeUz("2026-09-03T09:00:00.000Z", now), "3 soat oldin");
// 12:00Z = 17:00 Toshkent 3-sentabr. 20:00Z (2-sent) = 01:00 Toshkent 3-sent -> AYNI KUN.
eq("16 soat, lekin ayni Toshkent kuni", relativeUz("2026-09-02T20:00:00.000Z", now), "16 soat oldin");
// 2-sentabr Toshkent kuni = kecha
eq("kecha", relativeUz("2026-09-02T10:00:00.000Z", now), "Kecha");
// 47 soat oldin "Kecha" BO'LMASLIGI kerak — bu avvalgi kun
eq("47 soat -> to'liq sana", relativeUz("2026-09-01T13:00:00.000Z", now), uzStamp(new Date(Date.parse("2026-09-01T13:00:00.000Z"))));
eq("kelajak (klok siljishi)", relativeUz("2026-09-03T12:05:00.000Z", now), "Hozirgina");
eq("axlat -> bo'sh", relativeUz("salom", now), "");

console.log(bad === 0 ? "\nHAMMASI O'TDI" : `\n${bad} TA XATO`);
process.exit(bad === 0 ? 0 : 1);
