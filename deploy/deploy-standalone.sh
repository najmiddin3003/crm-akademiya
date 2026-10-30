#!/usr/bin/env bash
# KICHIK MARKAZ SERVERIDA tayyor to'plamni ishga tushirish (30.10.2026). To'plam boshqa
# joyda quriladi (deploy/build-center.sh) — bu yerda faqat ochish, ulash va pm2.
#
#   sudo -iu crm bash /var/www/crm/shared/deploy-standalone.sh /var/www/crm/shared/center-<id>-<sha>.tar.gz
#
# Orqaga qaytish: ln -sfn /var/www/crm/releases/<oldingi> /var/www/crm/current && pm2 reload crm
set -euo pipefail

APP_DIR=/var/www/crm
PKG="${1:?to'plam yo'lini bering}"
KEEP="${KEEP:-3}"
[[ -s "$PKG" ]] || { echo "XATO: $PKG yo'q"; exit 1; }
[[ -s "$APP_DIR/shared/.env.local" ]] || { echo "XATO: shared/.env.local yo'q (deploy/new-center-env.sh)"; exit 1; }

TS="$(date -u +%Y%m%d%H%M%S)"
REL="$APP_DIR/releases/$TS"
PREV="$([[ -L "$APP_DIR/current" ]] && readlink -f "$APP_DIR/current" || true)"

echo "== [$TS] Ochish: $(basename "$PKG")"
mkdir -p "$REL"
tar -C "$REL" -xzf "$PKG"
[[ -f "$REL/server.js" ]] || { echo "XATO: to'plamda server.js yo'q"; rm -rf "$REL"; exit 1; }
ln -sfn "$APP_DIR/shared/.env.local" "$REL/.env.local"

echo "== current → $REL"
ln -sfn "$REL" "$APP_DIR/current"

echo "== pm2"
if pm2 describe crm >/dev/null 2>&1; then
  pm2 reload crm --update-env >/dev/null
else
  pm2 start "$APP_DIR/shared/ecosystem.standalone.config.cjs" >/dev/null
fi
pm2 save >/dev/null

for i in $(seq 1 40); do
  if curl -fsS -o /dev/null -m 5 http://127.0.0.1:3000/; then echo "   ilova javob berdi ($i s)"; break; fi
  if [[ "$i" -eq 40 ]]; then
    echo "Ilova 40 s ichida javob bermadi: pm2 logs crm --lines 50"
    [[ -n "$PREV" ]] && echo "Orqaga: ln -sfn $PREV $APP_DIR/current && pm2 reload crm"
    exit 1
  fi
  sleep 1
done

echo "== Eski relizlar (oxirgi $KEEP ta qoladi)"
ls -1dt "$APP_DIR"/releases/* | tail -n +$((KEEP + 1)) | xargs -r rm -rf
[[ -n "$PREV" ]] && echo "   oldingi reliz: $PREV"
echo "== Tayyor: $REL"
