#!/usr/bin/env bash
# Markaz serveriga CLOUDINARY kalitlarini yozish (13.11.2026) — /ariza (vakansiya anketasi) va
# xodim rasmlari fayl yuklashi shunga bog'liq (lib/cloudinary.ts: CLOUDINARY_CLOUD_NAME,
# CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET; kalitsiz «Cloudinary sozlanmagan» xatosi).
#
# Qiymatlarni ODAMNING O'ZI kiritadi — secret ekranga ham, buyruqlar tarixiga ham chiqmaydi.
# Lokal kompyuterdan:
#
#   ssh -t root@SERVER_IP bash /root/deploy/set-center-cloudinary.sh
#
# Uchala qiymat Cloudinary'ning o'zida tekshiriladi (Admin API «ping»), so'ng /root/center.env ga
# yoziladi (root, 600), .env.local qayta yig'iladi (new-center-env.sh) va ilova BIR MARTA qayta
# yuklanadi. Kalitlar avval bor bo'lsa — almashtiriladi. Qayta build kerak emas (server tomoni).
set -euo pipefail

SRC=/root/center.env
DIR="$(cd "$(dirname "$0")" && pwd)"
[[ -s "$SRC" ]] || { echo "XATO: $SRC yo'q"; exit 1; }
[[ -f "$DIR/new-center-env.sh" ]] || { echo "XATO: $DIR/new-center-env.sh yo'q"; exit 1; }

# Buyruqni yuborgan terminalning ortiqcha Enter'i birinchi savolga bo'sh javob bo'lib tushmasin.
if [[ -t 0 ]]; then while read -r -t 0.5 _; do :; done; fi

# ask SAVOL YASHIRIN(1/0) → $REPLY (bo'shliqlarsiz, bo'sh bo'lsa qayta so'raydi)
ask() {
  local v
  while true; do
    if [[ "$2" == 1 ]]; then read -r -s -p "$1: " v; echo; else read -r -p "$1: " v; fi
    v="${v//[[:space:]]/}"
    if [[ -n "$v" ]]; then REPLY="$v"; return; fi
    echo "Bo'sh — qaytadan."
  done
}

echo "Cloudinary → Settings → API Keys sahifasidagi qiymatlar kerak."
while true; do
  ask "Cloud name" 0; CLOUD="$REPLY"
  if ! [[ "$CLOUD" =~ ^[A-Za-z0-9_-]+$ ]]; then echo "Cloud name faqat harf, raqam, - va _ dan iborat — qaytadan."; continue; fi
  ask "API key" 0; KEY="$REPLY"
  if ! [[ "$KEY" =~ ^[0-9]{6,}$ ]]; then echo "API key faqat raqamlardan iborat bo'ladi — qaytadan."; continue; fi
  ask "API secret (joylashtiring, ekranda ko'rinmaydi)" 1; SECRET="$REPLY"

  # Tekshiruv: kalitlar buyruq qatoriga emas, muhitga beriladi. 0 — qabul qildi, 1 — rad etdi,
  # 2 — Cloudinary'ga ulanib bo'lmadi (tarmoq).
  set +e
  OUT="$(CLOUD="$CLOUD" KEY="$KEY" SECRET="$SECRET" node --no-network-family-autoselection --dns-result-order=ipv4first -e '
    const { CLOUD, KEY, SECRET } = process.env;
    const auth = Buffer.from(KEY + ":" + SECRET).toString("base64");
    fetch("https://api.cloudinary.com/v1_1/" + CLOUD + "/ping", { headers: { Authorization: "Basic " + auth }, signal: AbortSignal.timeout(20000) })
      .then(async (r) => {
        if (r.ok) { console.log("ok"); return; }
        let msg = "";
        try { const j = await r.json(); msg = (j && j.error && j.error.message) || ""; } catch {}
        console.log(r.status + (msg ? " " + msg : ""));
        process.exit(1);
      })
      .catch((e) => { console.log(e.message); process.exit(2); });')"
  RC=$?
  set -e

  if [[ $RC -eq 0 ]]; then echo "Cloudinary kalitlarni qabul qildi."; break; fi
  if [[ $RC -eq 2 ]]; then
    read -r -p "Cloudinary'ga ulanib bo'lmadi ($OUT). Baribir yozilsinmi? [ha/yo'q]: " A
    if [[ "$A" == "ha" ]]; then break; fi
    continue
  fi
  echo "Cloudinary rad etdi ($OUT) — cloud name, key yoki secret noto'g'ri. Qaytadan."
done

umask 077
{
  grep -v -e '^CLOUDINARY_CLOUD_NAME=' -e '^CLOUDINARY_API_KEY=' -e '^CLOUDINARY_API_SECRET=' "$SRC" || true
  printf 'CLOUDINARY_CLOUD_NAME=%s\nCLOUDINARY_API_KEY=%s\nCLOUDINARY_API_SECRET=%s\n' "$CLOUD" "$KEY" "$SECRET"
} > "$SRC.tmp"
mv "$SRC.tmp" "$SRC"
chmod 600 "$SRC"
unset SECRET

bash "$DIR/new-center-env.sh" "$SRC" >/dev/null
sudo -iu crm pm2 reload crm --update-env >/dev/null
echo "Cloudinary kalitlari yozildi, ilova qayta yuklandi. Endi /ariza da fayl yuklab sinab ko'ring."
