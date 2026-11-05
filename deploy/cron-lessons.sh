#!/usr/bin/env bash
# Xodimlar botining kunlik eslatmalari — HAR DAQIQADA (05.11.2026): 08:00 da
# «Ishga keldim» va har guruh darsidan 10 daqiqa oldin ustozga «Davomatni
# boshlang» (lib/staffBot/dayReminders.ts). Xabar bir marta ketadi — route o'zi
# kuzatadi (`staff_bot_reminders`). `crm` foydalanuvchisining crontab'ida:
#
#   * * * * * /var/www/crm/shared/cron-lessons.sh >> /var/www/crm/shared/logs/cron-lessons.log 2>&1
#
# Muvaffaqiyatda JIM (log o'smasin) — faqat xato yoziladi. Route
# (app/api/sync/cron?only=lessons) `x-cron-secret` ni tekshiradi; kalit URL'da emas.
set -euo pipefail

ENV_FILE=/var/www/crm/shared/.env.local
SECRET="$(grep -m1 '^CRON_SECRET=' "$ENV_FILE" | cut -d= -f2- | tr -d '"'"'"'\r' | xargs)"
[[ -n "$SECRET" ]] || { echo "[$(date -u '+%F %T') UTC] CRON_SECRET $ENV_FILE da yo'q"; exit 1; }

if ! curl -fsS -m 55 -o /dev/null -H "x-cron-secret: $SECRET" "http://127.0.0.1:3000/api/sync/cron?only=lessons"; then
  echo "[$(date -u '+%F %T') UTC] kunlik eslatmalar cron'i yiqildi"
  exit 1
fi
