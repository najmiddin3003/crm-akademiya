// FAQAT SINOV — `describePrivateKey` xabari kalitning shaklini to'g'ri
// aytadimi. Maxfiy qiymat ishlatilmaydi, hammasi soxta.
import { describePrivateKey } from "../lib/sync/config.ts";

/** `normalizePrivateKey` ning nusxasi (u eksport qilinmagan). */
const normalize = (raw) => {
  let k = raw.trim();
  if ((k.startsWith('"') && k.endsWith('"')) || (k.startsWith("'") && k.endsWith("'"))) k = k.slice(1, -1);
  return k.replace(/\\n/g, "\n");
};

const body = "M".repeat(1700);
const cases = [
  ["to'g'ri (ko'p qatorli)", `-----BEGIN PRIVATE KEY-----\n${body}\n-----END PRIVATE KEY-----\n`],
  ["to'g'ri (env dagi \\n shakli)", `"-----BEGIN PRIVATE KEY-----\\n${body}\\n-----END PRIVATE KEY-----\\n"`],
  ["IKKI MARTA ekranlangan", `-----BEGIN PRIVATE KEY-----\\\\n${body}\\\\n-----END PRIVATE KEY-----`],
  ["qisqa nusxalangan", `-----BEGIN PRIVATE KEY-----\nMIIEv\n-----END PRIVATE KEY-----`],
  ["chegara satrisiz", body],
  ["bo'sh", ""],
];

for (const [label, raw] of cases) {
  console.log(`${label.padEnd(30)} -> ${describePrivateKey(normalize(raw))}`);
}
