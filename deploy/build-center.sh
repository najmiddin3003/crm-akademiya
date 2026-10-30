#!/usr/bin/env bash
# KICHIK MARKAZ SERVERI uchun tayyor to'plam (30.10.2026). 1 GB serverda `next build`
# sig'maydi, shuning uchun to'plam boshqa (katta) serverda quriladi va standalone
# holda (~100 MB, node_modules ichida) yuboriladi — deploy/deploy-standalone.sh.
#
# Build serverida, ilova foydalanuvchisi sifatida (toza muhit bilan — o'sha serverning
# o'z sozlamalari va bazasi build'ga TUSHMASIN):
#
#   env -i HOME="$HOME" PATH=/usr/bin:/bin CENTER_ENV=/path/center.env bash build-center.sh
#
# center.env dan FAQAT `NEXT_PUBLIC_*` olinadi (markaz nomi va h.k. build'da kodga yoziladi).
# Maxfiylar, MONGODB_URI — yo'q: build bazaga ulanmaydi.
# Natija: /tmp/center-<id>-<commit>.tar.gz
set -euo pipefail

CENTER_ENV="${CENTER_ENV:?CENTER_ENV=/yo'l/center.env bering}"
REPO="${REPO:-git@github.com:najmiddin3003/crm-akademiya.git}"
BRANCH="${BRANCH:-main}"
[[ -s "$CENTER_ENV" ]] || { echo "XATO: $CENTER_ENV yo'q"; exit 1; }
ID="$(grep -m1 '^NEXT_PUBLIC_CENTER_ID=' "$CENTER_ENV" | cut -d= -f2- | tr -d '\r' | xargs)"
[[ -n "$ID" && "$ID" != "akademiya" ]] || { echo "XATO: NEXT_PUBLIC_CENTER_ID bo'sh yoki akademiya"; exit 1; }

WORK="$(mktemp -d /tmp/center-build-XXXXXX)"
trap 'rm -rf "$WORK"' EXIT

echo "== Klon: $REPO ($BRANCH)"
GIT_SSH_COMMAND="ssh -o ConnectTimeout=20 -o ServerAliveInterval=15" \
  timeout 180 git clone --quiet --depth 1 --branch "$BRANCH" "$REPO" "$WORK/src"
cd "$WORK/src"
SHA="$(git rev-parse --short HEAD)"

grep -E '^NEXT_PUBLIC_[A-Z0-9_]+=' "$CENTER_ENV" | tr -d '\r' > .env.production.local
echo "   build sozlamalari: $(cut -d= -f1 .env.production.local | tr '\n' ' ')"

echo "== npm ci"
nice -n 15 npm ci --no-audit --no-fund --loglevel=error

echo "== next build (standalone, past ustuvorlik — asosiy sayt sekinlashmasin)"
NEXT_OUTPUT=standalone NODE_OPTIONS="--max-old-space-size=2048" nice -n 15 npx next build

echo "== To'plam"
cp -r public .next/standalone/
cp -r .next/static .next/standalone/.next/
rm -f .next/standalone/.env*
OUT="/tmp/center-$ID-$SHA.tar.gz"
tar -C .next/standalone -czf "$OUT" .
echo "== Tayyor: $OUT ($(du -h "$OUT" | cut -f1))"
