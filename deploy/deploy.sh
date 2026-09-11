#!/usr/bin/env bash
# CRM'ni VPS'ga joylash / yangilash. `crm` foydalanuvchisi ostida:
#
#   sudo -iu crm bash /var/www/crm/shared/deploy.sh            # main
#   sudo -iu crm BRANCH=fix-x bash /var/www/crm/shared/deploy.sh
#
# QANDAY ISHLAYDI (reliz papkalari): har deploy alohida
# releases/<vaqt> papkasiga klon qilinib O'SHA YERDA build bo'ladi; ishlab
# turgan nusxaga build paytida TEGILMAYDI. Build muvaffaqiyatli bo'lgach
# `current` ko'rsatkichi yangi papkaga buriladi va pm2 ilovani qayta
# yuklaydi (~3 soniya uzilish). Build xato bersa `current` eskicha qoladi
# — sayt tushmaydi. `next build` .next ni boshdan yaratadi, shuning uchun
# ishlab turgan papkaning ustida build qilib bo'lmaydi.
#
# Orqaga qaytish: `ln -sfn /var/www/crm/releases/<oldingi> /var/www/crm/current`
# va `pm2 reload crm`. Oxirgi 3 ta reliz saqlanadi.
set -euo pipefail

APP_DIR=/var/www/crm
REPO="${REPO:-git@github.com:najmiddin3003/crm-akademiya.git}"
BRANCH="${BRANCH:-main}"
KEEP="${KEEP:-3}"
ENV_FILE="$APP_DIR/shared/.env.local"

[[ "$(id -un)" == "crm" ]] || { echo "crm foydalanuvchisi ostida ishga tushiring: sudo -iu crm bash $0"; exit 1; }
[[ -s "$ENV_FILE" ]] || { echo "$ENV_FILE bo'sh — avval Vercel'dagi env qiymatlarini ko'chiring (deploy/README.md, 4-qadam)"; exit 1; }
# `npm ci` devDependencies'ni ham o'rnatishi kerak (typescript, tailwind —
# build uchun). Qobiqda NODE_ENV=production turgan bo'lsa ular tashlab ketiladi.
unset NODE_ENV

TS="$(date -u +%Y%m%d%H%M%S)"
REL="$APP_DIR/releases/$TS"
PREV="$(readlink -f "$APP_DIR/current" 2>/dev/null || true)"

echo "== [$TS] Klon: $REPO ($BRANCH)"
git clone --quiet --depth 1 --branch "$BRANCH" "$REPO" "$REL"
echo "   commit: $(git -C "$REL" log -1 --format='%h %s')"

# Maxfiy sozlamalar relizga kirmaydi — shared/ dagi bitta faylga havola.
ln -sfn "$ENV_FILE" "$REL/.env.local"

cd "$REL"
echo "== npm ci"
npm ci --no-audit --no-fund --loglevel=error

echo "== next build (4 GB RAM: heap 2 GB bilan chegaralangan)"
NODE_OPTIONS="--max-old-space-size=2048" npm run build
[[ -f .next/BUILD_ID ]] || { echo "Build chiqmadi (.next/BUILD_ID yo'q)"; exit 1; }

echo "== current → $REL"
ln -sfn "$REL" "$APP_DIR/current"

# Deploy skriptlari o'zini yangilab turadi — keyingi safar repodagi yangi
# nusxa ishlaydi.
install -m 0755 "$REL/deploy/deploy.sh" "$APP_DIR/shared/deploy.sh"
install -m 0644 "$REL/deploy/ecosystem.config.cjs" "$APP_DIR/shared/ecosystem.config.cjs"
install -m 0755 "$REL/deploy/cron.sh" "$APP_DIR/shared/cron.sh"

echo "== pm2 reload"
pm2 startOrReload "$APP_DIR/shared/ecosystem.config.cjs" --update-env >/dev/null
pm2 save >/dev/null

# Ilova javob beryaptimi (30 soniyagacha kutadi)
for i in $(seq 1 30); do
  if curl -fsS -o /dev/null http://127.0.0.1:3000/; then echo "   ilova javob berdi ($i s)"; break; fi
  [[ "$i" -eq 30 ]] && { echo "Ilova 30 s ichida javob bermadi: pm2 logs crm --lines 50; orqaga: ln -sfn $PREV $APP_DIR/current && pm2 reload crm"; exit 1; }
  sleep 1
done

echo "== Eski relizlar (oxirgi $KEEP ta qoladi)"
ls -1dt "$APP_DIR"/releases/* | tail -n +"$((KEEP + 1))" | xargs -r rm -rf
[[ -n "$PREV" ]] && echo "   oldingi reliz: $PREV (orqaga qaytish uchun)"
echo "== Tayyor: $(git -C "$REL" log -1 --format='%h')  →  https://www.tizimli24.uz"
