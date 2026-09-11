#!/usr/bin/env bash
# Kunlik sinxronizatsiya — Vercel Cron o'rnini bosadi (vercel.json:
# `0 22 * * *` UTC = Toshkent 03:00). `crm` foydalanuvchisining crontab'ida:
#
#   0 22 * * * /var/www/crm/shared/cron.sh >> /var/www/crm/shared/logs/cron.log 2>&1
#
# Route (app/api/sync/cron) `x-cron-secret` sarlavhasini qabul qiladi;
# maxfiy kalit URL'ga qo'yilmaydi. Ilova to'g'ridan-to'g'ri 127.0.0.1:3000
# da chaqiriladi — DNS/Nginx/TLS holatiga bog'liq emas.
set -euo pipefail

ENV_FILE=/var/www/crm/shared/.env.local
SECRET="$(grep -m1 '^CRON_SECRET=' "$ENV_FILE" | cut -d= -f2- | tr -d '"'"'"'\r' | xargs)"
[[ -n "$SECRET" ]] || { echo "CRON_SECRET $ENV_FILE da yo'q"; exit 1; }

echo "[$(date -u '+%F %T') UTC] cron boshlandi"
# Route o'zi ~60 s ga mo'ljallangan (Vercel Hobby chegarasi); zaxira bilan 3 daqiqa.
curl -fsS -m 180 -H "x-cron-secret: $SECRET" http://127.0.0.1:3000/api/sync/cron
echo
echo "[$(date -u '+%F %T') UTC] tugadi"
