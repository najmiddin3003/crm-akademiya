#!/usr/bin/env bash
# MongoDB 8 ni SHU serverga o'rnatadi: faqat 127.0.0.1, parol bilan (auth), kesh 1 GB.
# Yangi markaz serveri uchun (30.10.2026) — setup-server.sh dan keyin, root sifatida:
#
#   DB=crm bash /root/deploy/setup-mongo.sh
#
# Natija (faqat root o'qiydi, 600):
#   /root/.mongo-admin-uri — root huquqli foydalanuvchi (zaxira, qo'lda ishlar)
#   /root/.mongo-app-uri   — ilova foydalanuvchisi (faqat $DB ga readWrite) → .env.local
# Qayta ishga tushirilsa zarar qilmaydi: o'rnatilgan bo'lsa o'tkazib yuboradi,
# foydalanuvchilar bor bo'lsa parollar o'zgarmaydi.
set -euo pipefail

DB="${DB:-crm}"

# MongoDB 5+ AVX'siz protsessorda ishga tushmaydi. Eskiz VM'lari sukutda
# AVX'siz CPU modeli bilan keladi — tiket orqali «host-passthrough» so'raladi.
if ! grep -qw avx /proc/cpuinfo; then
  echo "XATO: protsessorda AVX yo'q — MongoDB 8 ishlamaydi."
  echo "Eskiz'ga tiket: «VM uchun CPU host-passthrough (AVX) yoqib bering», keyin VM'ni qayta yoqing."
  exit 1
fi

if ! command -v mongod >/dev/null 2>&1; then
  echo "== MongoDB 8 o'rnatilmoqda"
  apt-get install -y -q gnupg curl >/dev/null
  curl -fsSL https://www.mongodb.org/static/pgp/server-8.0.asc \
    | gpg --dearmor --yes -o /usr/share/keyrings/mongodb-server-8.0.gpg
  CODENAME="$(. /etc/os-release && echo "$VERSION_CODENAME")"
  echo "deb [ arch=amd64,arm64 signed-by=/usr/share/keyrings/mongodb-server-8.0.gpg ] https://repo.mongodb.org/apt/ubuntu $CODENAME/mongodb-org/8.0 multiverse" \
    > /etc/apt/sources.list.d/mongodb-org-8.0.list
  apt-get update -q >/dev/null
  apt-get install -y -q mongodb-org >/dev/null
fi

# WiredTiger keshi: ilova va build uchun joy qolsin — 4 GB serverda 1 GB, 1–2 GB
# serverda (kichik markaz, ~150 o'quvchi) 0.25 GB yetadi. MONGO_CACHE_GB bilan almashtirsa bo'ladi.
MEM_MB="$(awk '/MemTotal/ { print int($2 / 1024) }' /proc/meminfo)"
CACHE_GB="${MONGO_CACHE_GB:-$([[ "$MEM_MB" -lt 2500 ]] && echo 0.25 || echo 1)}"
if ! grep -q "cacheSizeGB" /etc/mongod.conf; then
  sed -i "s/^#  wiredTiger:\$/  wiredTiger:\n    engineConfig:\n      cacheSizeGB: $CACHE_GB/" /etc/mongod.conf
fi

systemctl enable --now mongod >/dev/null 2>&1
for _ in $(seq 1 30); do
  mongosh --quiet --eval 'db.runCommand({ ping: 1 }).ok' >/dev/null 2>&1 && break
  sleep 1
done

if [[ ! -s /root/.mongo-admin-uri ]]; then
  echo "== Foydalanuvchilar va auth"
  ADMIN_PW="$(openssl rand -hex 24)"
  APP_PW="$(openssl rand -hex 24)"
  mongosh --quiet admin --eval "db.createUser({ user: 'admin', pwd: '$ADMIN_PW', roles: ['root'] })" >/dev/null
  mongosh --quiet admin --eval "db.createUser({ user: 'crm', pwd: '$APP_PW', roles: [{ role: 'readWrite', db: '$DB' }] })" >/dev/null
  (
    umask 077
    echo "mongodb://admin:$ADMIN_PW@127.0.0.1:27017/admin" > /root/.mongo-admin-uri
    echo "mongodb://crm:$APP_PW@127.0.0.1:27017/$DB?authSource=admin" > /root/.mongo-app-uri
  )
  grep -q "^security:" /etc/mongod.conf || printf "\nsecurity:\n  authorization: enabled\n" >> /etc/mongod.conf
  systemctl restart mongod
  for _ in $(seq 1 30); do
    mongosh --quiet "$(cat /root/.mongo-admin-uri)" --eval 'db.runCommand({ ping: 1 }).ok' >/dev/null 2>&1 && break
    sleep 1
  done
fi

echo "== Tekshiruv"
mongosh --quiet "$(cat /root/.mongo-app-uri)" --eval 'db.runCommand({ ping: 1 }).ok ? "ilova foydalanuvchisi: ulandi" : "ulanmadi"'
systemctl is-active mongod
grep -E "bindIp|cacheSizeGB|authorization" /etc/mongod.conf | sed 's/^ */  /'
