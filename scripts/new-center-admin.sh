#!/usr/bin/env bash
# Yangi markazning BIRINCHI admini va birinchi filiali (30.10.2026). Parolni admin o'zi
# kiritadi — ekranga ham, buyruqlar tarixiga ham chiqmaydi. Lokal kompyuterdan:
#
#   ssh -t root@SERVER_IP sudo -iu crm bash /var/www/crm/current/scripts/new-center-admin.sh
#
# Qayta ishga tushirilsa: shu raqamli admin parolini yangilaydi, filial bor bo'lsa tegmaydi.
set -euo pipefail
cd "$(dirname "$0")/.."

read -r -p "Admin telefoni (masalan 90 123 45 67): " PHONE
read -r -p "Ism familiya: " NAME
while true; do
  read -r -s -p "Parol (kamida 8 belgi): " PW; echo
  read -r -s -p "Parolni takrorlang: " PW2; echo
  if [[ "$PW" == "$PW2" && ${#PW} -ge 8 ]]; then break; fi
  echo "Parollar mos emas yoki 8 belgidan qisqa — qaytadan."
done
read -r -p "Birinchi filial nomi: " BRANCH

# seed-admin.js natija qatorida parolni ham yozadi — uni kesib tashlaymiz.
node scripts/seed-admin.js "$PHONE" "$PW" "$NAME" | sed -E 's# / .*  \(# (#'
unset PW PW2
BRANCH_NAME="$BRANCH" node scripts/seed-branch.mjs
