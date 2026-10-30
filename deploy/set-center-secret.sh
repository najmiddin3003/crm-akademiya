#!/usr/bin/env bash
# Markaz serveriga MAXFIY qiymat yozish (bot kaliti, SMS/Cloudinary kalitlari va h.k.), 30.10.2026.
# Qiymatni ODAMNING O'ZI kiritadi — ekranga ham, buyruqlar tarixiga ham chiqmaydi. Lokal kompyuterdan:
#
#   ssh -t root@SERVER_IP bash /root/deploy/set-center-secret.sh TELEGRAM_BOT_TOKEN
#
# Qiymat /root/center.env ga yoziladi (root, 600), .env.local qayta yig'iladi (new-center-env.sh)
# va ilova qayta yuklanadi. Kalit avval bor bo'lsa — almashtiriladi.
set -euo pipefail

KEY="${1:-}"
[[ "$KEY" =~ ^[A-Z][A-Z0-9_]*$ ]] || { echo "Ishlatish: set-center-secret.sh KALIT_NOMI (masalan TELEGRAM_BOT_TOKEN)"; exit 1; }
SRC=/root/center.env
DIR="$(cd "$(dirname "$0")" && pwd)"
[[ -s "$SRC" ]] || { echo "XATO: $SRC yo'q"; exit 1; }

# Buyruqni yuborgan terminalning ortiqcha Enter'i birinchi savolga bo'sh javob bo'lib tushmasin.
if [[ -t 0 ]]; then while read -r -t 0.5 _; do :; done; fi

while true; do
  read -r -s -p "$KEY (joylashtiring, ekranda ko'rinmaydi): " VAL; echo
  VAL="${VAL//[[:space:]]/}"
  if [[ -z "$VAL" ]]; then echo "Bo'sh — qaytadan."; continue; fi
  if [[ "$KEY" == *BOT_TOKEN ]]; then
    if ! [[ "$VAL" =~ ^[0-9]{6,}:[A-Za-z0-9_-]{30,}$ ]]; then
      echo "Bot kaliti 1234567890:AAH... ko'rinishida bo'ladi — qaytadan."; continue
    fi
    # Kalit ishlashini Telegram'dan so'raymiz (kalit buyruq qatoriga emas, muhitga beriladi).
    if ! BOT="$(TOKEN="$VAL" node -e '
      fetch("https://api.telegram.org/bot" + process.env.TOKEN + "/getMe")
        .then((r) => r.json())
        .then((j) => { if (!j.ok) { console.log(j.description || "xato"); process.exit(1); } console.log(j.result.username); })
        .catch((e) => { console.log(e.message); process.exit(1); });')"; then
      echo "Telegram kalitni qabul qilmadi ($BOT) — qaytadan."; continue
    fi
    echo "Bot topildi: @$BOT"
  fi
  break
done

umask 077
{ grep -v "^$KEY=" "$SRC" || true; printf '%s=%s\n' "$KEY" "$VAL"; } > "$SRC.tmp"
mv "$SRC.tmp" "$SRC"
chmod 600 "$SRC"
unset VAL

bash "$DIR/new-center-env.sh" "$SRC" >/dev/null
sudo -iu crm pm2 reload crm --update-env >/dev/null
echo "$KEY yozildi, ilova qayta yuklandi."
