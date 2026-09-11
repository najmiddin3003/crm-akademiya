#!/usr/bin/env bash
# MongoDB zaxira nusxasi — har kecha (root crontab, 21:00 UTC = Toshkent
# 02:00, sinxronizatsiya cron'idan bir soat oldin):
#
#   0 21 * * * /var/www/crm/shared/backup-mongo.sh >> /var/www/crm/shared/logs/backup.log 2>&1
#
# Ikki nusxa:
#   1) LOKAL — /var/backups/crm/crm-<sana>.gz (mongodump --archive --gzip,
#      ~1.5 MB), oxirgi 14 kun saqlanadi. Tiklash:
#        mongorestore --uri="$(cat /root/.mongo-admin-uri)" --gzip \
#          --archive=/var/backups/crm/crm-YYYYMMDD.gz --nsInclude="crm-akademiya-nextjs.*" --drop
#   2) TASHQI — o'sha arxiv Atlas klasteriga (eski bepul M0) qayta yoziladi
#      (--drop). Server yo'qolsa ham kechagi holat Atlas'da turadi; ilovani
#      unga qaytarish uchun .env.local dagi MONGODB_URI_ATLAS qatorini
#      ochish kifoya. Atlas URI /root/.mongo-atlas-uri da (faqat root).
#      Fayl bo'lmasa tashqi nusxa o'tkazib yuboriladi.
#
# Baza 13 MB — butun jarayon ~1 daqiqa. 30 Mb/s xalqaro kanal yetarli.
set -euo pipefail

DIR=/var/backups/crm
KEEP_DAYS=14
DB=crm-akademiya-nextjs
# URI oxiridagi /admin ni --db bilan birga berib bo'lmaydi → authSource sifatida.
ADMIN_URI="$(sed 's#/admin$#/?authSource=admin#' /root/.mongo-admin-uri)"
STAMP="$(date -u +%Y%m%d)"
OUT="$DIR/crm-$STAMP.gz"

mkdir -p "$DIR"; chmod 700 "$DIR"
echo "[$(date -u '+%F %T') UTC] dump → $OUT"
mongodump --uri="$ADMIN_URI" --db="$DB" --gzip --archive="$OUT" --quiet
echo "   hajmi: $(stat -c %s "$OUT") bayt"

# Eski nusxalar
find "$DIR" -name 'crm-*.gz' -mtime +"$KEEP_DAYS" -delete

# Tashqi nusxa — Atlas (bo'lsa)
if [[ -s /root/.mongo-atlas-uri ]]; then
  echo "   Atlas'ga ko'chirilmoqda…"
  if mongorestore --uri="$(cat /root/.mongo-atlas-uri)" --gzip --archive="$OUT" \
       --nsInclude="$DB.*" --drop --quiet; then
    echo "   Atlas: ok"
  else
    echo "   Atlas: XATO (lokal nusxa saqlangan)"
  fi
fi
echo "[$(date -u '+%F %T') UTC] tugadi"
