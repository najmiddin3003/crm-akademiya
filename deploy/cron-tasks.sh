#!/usr/bin/env bash
# Xodim topshiriqlari — har 10 daqiqada (17.10.2026): avtomatika (muddati
# o'tdi, bajarilmadi/jarima) va xodimlar botidagi muddat eslatmalari
# (lib/staffTaskReminders.ts). CRM'ni hech kim ochmagan paytda ham eslatma
# o'z vaqtida ketsin — aks holda u faqat CRM ochiq turganda yurardi.
# `crm` foydalanuvchisining crontab'ida:
#
#   */10 * * * * /var/www/crm/shared/cron-tasks.sh >> /var/www/crm/shared/logs/cron-tasks.log 2>&1
#
# Muvaffaqiyatda JIM (log o'smasin) — faqat xato yoziladi. Route
# (app/api/sync/cron?only=tasks) `x-cron-secret` ni tekshiradi; kalit URL'da emas.
set -euo pipefail

ENV_FILE=/var/www/crm/shared/.env.local
SECRET="$(grep -m1 '^CRON_SECRET=' "$ENV_FILE" | cut -d= -f2- | tr -d '"'"'"'\r' | xargs)"
[[ -n "$SECRET" ]] || { echo "[$(date -u '+%F %T') UTC] CRON_SECRET $ENV_FILE da yo'q"; exit 1; }

if ! curl -fsS -m 60 -o /dev/null -H "x-cron-secret: $SECRET" "http://127.0.0.1:3000/api/sync/cron?only=tasks"; then
  echo "[$(date -u '+%F %T') UTC] topshiriqlar cron'i yiqildi"
  exit 1
fi
