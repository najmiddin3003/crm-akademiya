// FAQAT SINOV — kalitni tozalash (`normalizePrivateKey`) va uning
// shaklini tasvirlash (`describePrivateKey`) to'g'ri ishlayaptimi.
// Maxfiy qiymat ishlatilmaydi, hammasi soxta.
import { describePrivateKey, normalizePrivateKeyForTest as normalize } from "../lib/sync/config.ts";

const body = Array.from({ length: 26 }, () => "M".repeat(64)).join("\n");
const pem = `-----BEGIN PRIVATE KEY-----\n${body}\n-----END PRIVATE KEY-----`;

const cases = [
  ["to'g'ri (ko'p qatorli)", pem],
  ["to'g'ri (env dagi \\n shakli)", `"${pem.replace(/\n/g, "\\n")}\\n"`],
  ["oldida qo'shtirnoq (juftsiz)", `"${pem}\n`],
  ["chetida bo'shliq va yangi qator", `\n   ${pem}   \n\n`],
  ["oldida BOM", `﻿${pem}`],
  ["chegara satrisiz (haqiqiy xato)", body],
  ["qisqa nusxalangan", "-----BEGIN PRIVATE KEY-----\nMIIEv\n-----END PRIVATE KEY-----"],
  ["bo'sh", ""],
];

let ok = 0;
for (const [label, raw] of cases) {
  const cleaned = normalize(raw);
  const desc = describePrivateKey(cleaned);
  // Birinchi beshtasi TOZALANGANDAN KEYIN aynan PEM ga teng bo'lishi kerak.
  const expectPem = ["to'g'ri (ko'p qatorli)", "to'g'ri (env dagi \\n shakli)",
    "oldida qo'shtirnoq (juftsiz)", "chetida bo'shliq va yangi qator", "oldida BOM"].includes(label);
  const pass = expectPem ? cleaned === pem : true;
  if (pass) ok++;
  console.log(`${pass ? "OK " : "XATO"} ${label.padEnd(32)} -> ${desc}`);
}
console.log(`\n${ok}/${cases.length}`);
