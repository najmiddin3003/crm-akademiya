#!/usr/bin/env bash
# Yangi Ubuntu 24.04 VPS'ni CRM uchun BIR MARTA tayyorlaydi (Eskiz VPS 3:
# 2 yadro / 4 GB / 80 GB NVMe). root sifatida ishga tushiriladi:
#
#   DOMAIN=www.tizimli24.uz bash deploy/setup-server.sh
#
# Nima qiladi: Node 24 LTS, pm2, Nginx, certbot, 2 GB swap (build uchun),
# UTC vaqt zonasi, ufw, `crm` tizim foydalanuvchisi va /var/www/crm
# papkalari. SSL sertifikat BU YERDA OLINMAYDI — avval DNS yangi IP ga
# qarashi kerak (deploy/README.md, 5-qadam).
#
# Skript IDEMPOTENT — qayta ishga tushirsa bo'ladi, bor narsani buzmaydi.
set -euo pipefail

DOMAIN="${DOMAIN:?DOMAIN=www.tizimli24.uz kabi bering}"
APEX="${APEX:-${DOMAIN#www.}}"          # www.tizimli24.uz → tizimli24.uz
APP_DIR=/var/www/crm
APP_USER=crm
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo "== Paketlar"
export DEBIAN_FRONTEND=noninteractive
apt-get update -q
apt-get upgrade -yq
apt-get install -yq curl git nginx libnginx-mod-http-brotli-filter ufw unattended-upgrades ca-certificates

echo "== Node 24 LTS (NodeSource; lokal ishlab chiqish bilan bir xil) + pm2"
if ! command -v node >/dev/null || [[ "$(node -v | cut -d. -f1 | tr -d v)" -lt 24 ]]; then
  curl -fsSL https://deb.nodesource.com/setup_24.x | bash -
  apt-get install -yq nodejs
fi
npm i -g pm2@latest >/dev/null
node -v; npm -v; pm2 -v
# `pm2 -v` root uchun alohida daemon ochib qo'yadi (~50 MB) — u kerak emas,
# ilova `crm` foydalanuvchisining daemonida yuradi.
pm2 kill >/dev/null 2>&1 || true

echo "== 2 GB swap (next build 4 GB RAM da swapsiz qotishi mumkin)"
# Eskiz obrazida 512 MB /swapfile bor — kichik bo'lsa 2 GB ga almashtiriladi.
if [[ -f /swapfile ]] && [[ "$(stat -c %s /swapfile)" -lt $((2 * 1024 * 1024 * 1024)) ]]; then
  swapoff /swapfile 2>/dev/null || true
  rm -f /swapfile
fi
if ! swapon --show | grep -q /swapfile; then
  fallocate -l 2G /swapfile
  chmod 600 /swapfile
  mkswap /swapfile
  swapon /swapfile
  grep -q /swapfile /etc/fstab || echo '/swapfile none swap sw 0 0' >> /etc/fstab
fi
# Swap'ga faqat zarurat bo'lganda tushsin
sysctl -w vm.swappiness=10 >/dev/null
grep -q vm.swappiness /etc/sysctl.conf || echo 'vm.swappiness=10' >> /etc/sysctl.conf

echo "== Vaqt zonasi: UTC (kod serverni UTC deb hisoblaydi — lib/uzTime.ts)"
timedatectl set-timezone UTC

echo "== Firewall: faqat SSH, 80, 443"
ufw allow OpenSSH >/dev/null
ufw allow 'Nginx Full' >/dev/null
ufw --force enable >/dev/null
ufw status | head -5

echo "== Foydalanuvchi va papkalar"
if ! id -u "$APP_USER" >/dev/null 2>&1; then
  adduser --system --group --home "$APP_DIR" --shell /bin/bash "$APP_USER"
fi
mkdir -p "$APP_DIR"/{releases,shared/logs}
chown -R "$APP_USER:$APP_USER" "$APP_DIR"

echo "== pm2 tizim bilan birga ko'tarilsin (crm foydalanuvchisi ostida)"
env PATH="$PATH:/usr/bin" pm2 startup systemd -u "$APP_USER" --hp "$APP_DIR" >/dev/null

echo "== Nginx (HTTP; certbot keyin HTTPS qo'shadi)"
# Eskiz VPS'da nginx "could not build server_names_hash … bucket_size: 32"
# bilan yiqildi (CPU kesh qatori 32 deb aniqlanadi) — 64 qilinadi.
sed -i -E 's/^[[:space:]]*#?[[:space:]]*server_names_hash_bucket_size .*/\tserver_names_hash_bucket_size 64;/' /etc/nginx/nginx.conf
grep -q 'server_names_hash_bucket_size 64' /etc/nginx/nginx.conf || sed -i '/^http {/a \\tserver_names_hash_bucket_size 64;' /etc/nginx/nginx.conf
# server_tokens off + `timed` jurnal formati (sayt bloki ishlatadi) — 27.09.2026.
install -m 0644 "$HERE/nginx-common.conf" /etc/nginx/conf.d/crm-common.conf
sed -e "s/__DOMAIN__/$DOMAIN/g" -e "s/__APEX__/$APEX/g" "$HERE/nginx.conf.template" > /etc/nginx/sites-available/crm
ln -sfn /etc/nginx/sites-available/crm /etc/nginx/sites-enabled/crm
rm -f /etc/nginx/sites-enabled/default
nginx -t
systemctl enable --now nginx >/dev/null
systemctl reload nginx

echo "== certbot (sertifikat DNS ulangach olinadi)"
apt-get install -yq certbot python3-certbot-nginx

echo "== Deploy skriptlari shared/ ga (birinchi deploy uchun; keyin deploy.sh o'zini yangilab turadi)"
install -o "$APP_USER" -g "$APP_USER" -m 0755 "$HERE/deploy.sh" "$APP_DIR/shared/deploy.sh"
install -o "$APP_USER" -g "$APP_USER" -m 0644 "$HERE/ecosystem.config.cjs" "$APP_DIR/shared/ecosystem.config.cjs"
install -o "$APP_USER" -g "$APP_USER" -m 0755 "$HERE/cron.sh" "$APP_DIR/shared/cron.sh"
if [[ ! -f "$APP_DIR/shared/.env.local" ]]; then
  install -o "$APP_USER" -g "$APP_USER" -m 0600 /dev/null "$APP_DIR/shared/.env.local"
fi

cat <<EOF

Tayyor. Keyingi qadamlar (deploy/README.md):
  1) sudo -iu $APP_USER        → ssh-keygen -t ed25519 → GitHub Deploy key (read-only)
  2) $APP_DIR/shared/.env.local ni to'ldirish (Vercel'dagi qiymatlar)
  3) sudo -iu $APP_USER bash $APP_DIR/shared/deploy.sh
  4) DNS: $APEX va $DOMAIN → shu server IP
  5) certbot --nginx -d $DOMAIN -d $APEX --redirect
  6) HTTP/2: /etc/nginx/sites-available/crm dagi har bir "listen … 443 ssl" qatoriga
     "http2" qo'shing (masalan "listen 443 ssl http2;") → nginx -t && systemctl reload nginx
EOF
