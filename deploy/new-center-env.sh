#!/usr/bin/env bash
# Yangi markaz serverida /var/www/crm/shared/.env.local ni yig'adi (30.10.2026), root sifatida:
#
#   bash /root/deploy/new-center-env.sh /root/center.env
#
# center.env — OCHIQ qiymatlar (markaz nomi, sayt manzili, …; namuna: deploy/center.env.example),
# lokal kompyuterda yoziladi va scp bilan yuboriladi (o'zbekcha tutuq belgisi ssh buyrug'ida
# qo'shtirnoqni buzadi — shuning uchun fayl). Maxfiy qiymatlar shu yerda yaratiladi va
# ekranga chiqmaydi; qayta ishga tushirilsa ESKILARI saqlanadi (sessiyalar uzilmaydi).
set -euo pipefail

SRC="${1:-/root/center.env}"
OUT=/var/www/crm/shared/.env.local
[[ -s "$SRC" ]] || { echo "XATO: $SRC yo'q"; exit 1; }
[[ -s /root/.mongo-app-uri ]] || { echo "XATO: avval setup-mongo.sh"; exit 1; }

[[ -s "$OUT" ]] && cp -p "$OUT" "$OUT.bak-$(date -u +%Y%m%d%H%M%S)"

old() { grep -m1 "^$1=" "$OUT" 2>/dev/null | cut -d= -f2- || true; }
secret() { local v; v="$(old "$1")"; if [[ -n "$v" ]]; then echo "$v"; else openssl rand -hex 32; fi; }

{
  echo "# Yangi markaz serveri — deploy/new-center-env.sh ($(date -u +%F)). MAXFIY, chatga chiqarilmaydi."
  grep -vE "^\s*(#|$)" "$SRC" | tr -d '\r'
  echo "MONGODB_URI=$(cat /root/.mongo-app-uri)"
  echo "SESSION_SECRET=$(secret SESSION_SECRET)"
  echo "ENCRYPTION_KEY=$(secret ENCRYPTION_KEY)"
  echo "CRON_SECRET=$(secret CRON_SECRET)"
  echo "TELEGRAM_WEBHOOK_SECRET=$(secret TELEGRAM_WEBHOOK_SECRET)"
} > "$OUT.tmp"
install -m 600 -o crm -g crm "$OUT.tmp" "$OUT"
rm -f "$OUT.tmp"

echo "yozildi: $OUT"
echo "kalitlar: $(grep -oE '^[A-Z_]+=' "$OUT" | tr -d = | tr '\n' ' ')"
