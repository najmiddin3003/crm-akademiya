// FAQAT O'QIYDI (Atlas + lokal baseline). 14.09.2026: Atlas'ga Vercel
// orqali tushgan BARCHA o'zgarishlarni topish — kechagi zaxira
// (baseline_20260913) bilan hujjatma-hujjat solishtirish.
// Natija: /var/www/crm/shared/atlas-diff-20260914.json
//
// VPS'da, root sifatida (URI fayllari faqat root'niki):
//   ADMIN_URI="$(sed 's#/admin$#/?authSource=admin#' /root/.mongo-admin-uri)"
//   mongorestore --uri="$ADMIN_URI" --gzip --archive=/var/backups/crm/crm-20260913.gz \
//     --nsFrom='crm-akademiya-nextjs.*' --nsTo='baseline_20260913.*' --drop --quiet
//   cd /var/www/crm/current && node scripts/_diff-atlas-baseline.mjs
//
// NEGA ZAXIRA BILAN: Atlas har kecha shu zaxiradan `--drop` bilan qayta
// yoziladi, ya'ni zaxira = Atlas'ning kun boshidagi holati. Undan farq
// qilgan har hujjat — kun davomida Vercel orqali tushgan yozuv. Faqat
// yangi `_id` larni sanash yetmasdi: o'zgartirilgan (masalan guruhga
// qo'shilgan) hujjatlar ko'rinmay qolardi.
// Keyin: scripts/_merge-atlas-20260914.mjs (ko'chirish).
import fs from "fs";
import { MongoClient, BSON } from "mongodb";

// Ko'zgu vaqtincha o'chirilgan bo'lsa fayl `.off` nomi bilan turadi
// (backup-mongo.sh faylsiz Atlas qadamini o'tkazib yuboradi).
const atlasUriFile = fs.existsSync("/root/.mongo-atlas-uri") ? "/root/.mongo-atlas-uri" : "/root/.mongo-atlas-uri.off";
const atlasUri = fs.readFileSync(atlasUriFile, "utf8").trim();
const adminUri = fs.readFileSync("/root/.mongo-admin-uri", "utf8").trim().replace(/\/admin$/, "/?authSource=admin");
const A = new MongoClient(atlasUri, { maxPoolSize: 3, serverSelectionTimeoutMS: 30000 });
const L = new MongoClient(adminUri, { maxPoolSize: 3 });
await A.connect(); await L.connect();
const atlas = A.db("crm-akademiya-nextjs");
const base = L.db("baseline_20260913");

const sortKeys = (v) => Array.isArray(v) ? v.map(sortKeys)
  : v && typeof v === "object" ? Object.fromEntries(Object.keys(v).sort().map((k) => [k, sortKeys(v[k])]))
  : v;
const canon = (doc) => JSON.stringify(sortKeys(JSON.parse(BSON.EJSON.stringify(doc, { relaxed: false }))));
const plain = (doc) => JSON.parse(BSON.EJSON.stringify(doc, { relaxed: true }));

const names = (await atlas.listCollections().toArray()).map((x) => x.name).sort();
const baseNames = new Set((await base.listCollections().toArray()).map((x) => x.name));
const report = { generatedAt: new Date().toISOString(), collections: {} };
console.log("kolleksiya".padEnd(30), "atlas".padStart(7), "base".padStart(7), "yangi".padStart(6), "o'zgar".padStart(7), "o'chgan".padStart(8));
for (const name of names) {
  const aDocs = await atlas.collection(name).find({}).toArray();
  const bDocs = baseNames.has(name) ? await base.collection(name).find({}).toArray() : [];
  const bMap = new Map(bDocs.map((d) => [String(d._id), d]));
  const aIds = new Set();
  const added = [], changed = [];
  for (const d of aDocs) {
    const k = String(d._id); aIds.add(k);
    const b = bMap.get(k);
    if (!b) { added.push(plain(d)); continue; }
    if (canon(d) !== canon(b)) {
      const pd = plain(d), pb = plain(b);
      const keys = [...new Set([...Object.keys(pd), ...Object.keys(pb)])].filter((key) => JSON.stringify(pd[key]) !== JSON.stringify(pb[key]));
      changed.push({ after: pd, before: pb, keys });
    }
  }
  const deleted = bDocs.filter((d) => !aIds.has(String(d._id))).map(plain);
  if (added.length || changed.length || deleted.length) {
    report.collections[name] = { added, changed, deleted };
    console.log(name.padEnd(30), String(aDocs.length).padStart(7), String(bDocs.length).padStart(7), String(added.length).padStart(6), String(changed.length).padStart(7), String(deleted.length).padStart(8));
  }
}
const label = (d) => [d.id, d.fullName || d.name || [d.firstName, d.lastName].filter(Boolean).join(" ") || d.studentName || d.recipientName || d.title || d.sid || ""].join(" ");
for (const [name, r] of Object.entries(report.collections)) {
  console.log(`\n== ${name} ==`);
  for (const d of r.added.slice(0, 40)) console.log("  + ", label(d), "|", JSON.stringify(d).slice(0, 160));
  if (r.added.length > 40) console.log("  + … yana", r.added.length - 40);
  for (const c of r.changed.slice(0, 40)) console.log("  ~ ", label(c.after), "| maydonlar:", c.keys.join(","));
  if (r.changed.length > 40) console.log("  ~ … yana", r.changed.length - 40);
  for (const d of r.deleted.slice(0, 20)) console.log("  - ", label(d));
}
fs.writeFileSync("/var/www/crm/shared/atlas-diff-20260914.json", JSON.stringify(report, null, 1));
console.log("\nSaqlandi: /var/www/crm/shared/atlas-diff-20260914.json");
await A.close(); await L.close();
