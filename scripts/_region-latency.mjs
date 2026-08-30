// FAQAT O'LCHOV — hech narsa yozmaydi.
// Sof TCP ulanish vaqti = 1 round-trip (RTT). Atlas AWS'da ishlaydi,
// shuning uchun bu klasterni boshqa regionga ko'chirish foydasini
// baholash uchun to'g'ri o'lchov.
import net from "net";

const REGIONS = {
  "ap-southeast-1": "Singapur (HOZIRGI)",
  "eu-central-1":   "Frankfurt",
  "eu-north-1":     "Stokgolm",
  "eu-west-1":      "Irlandiya",
  "me-central-1":   "BAA (Dubay)",
  "ap-south-1":     "Mumbay",
  "ap-northeast-1": "Tokio",
  "us-east-1":      "AQSh (Virjiniya)",
};

const N = 6;

function tcp(host) {
  return new Promise((resolve) => {
    const t0 = process.hrtime.bigint();
    const s = net.connect({ host, port: 443 });
    s.setTimeout(6000);
    s.on("connect", () => { const ms = Number(process.hrtime.bigint() - t0) / 1e6; s.destroy(); resolve(ms); });
    s.on("error", () => { s.destroy(); resolve(null); });
    s.on("timeout", () => { s.destroy(); resolve(null); });
  });
}

const rows = [];
for (const [region, nom] of Object.entries(REGIONS)) {
  const host = `ec2.${region}.amazonaws.com`;
  const s = [];
  for (let i = 0; i < N; i++) { const ms = await tcp(host); if (ms !== null) s.push(ms); }
  s.sort((a, b) => a - b);
  rows.push({ region, nom, min: s.length ? Math.round(s[0]) : null,
              med: s.length ? Math.round(s[Math.floor(s.length / 2)]) : null, n: s.length });
}

const cur = rows.find((r) => r.region === "ap-southeast-1");
rows.sort((a, b) => (a.min ?? 9e9) - (b.min ?? 9e9));

console.log("region".padEnd(17), "joy".padEnd(20), "eng tez".padStart(8), "median".padStart(8), "  farq");
console.log("-".repeat(70));
for (const r of rows) {
  if (r.min === null) { console.log(r.region.padEnd(17), r.nom.padEnd(20), "— (ulanmadi)"); continue; }
  const d = cur && cur.min ? r.min - cur.min : null;
  const farq = d === null ? "" : (d < 0 ? `${d} ms TEZROQ` : d > 0 ? `+${d} ms sekinroq` : "hozirgi");
  console.log(r.region.padEnd(17), r.nom.padEnd(20), `${r.min} ms`.padStart(8), `${r.med} ms`.padStart(8), "  " + farq);
}
