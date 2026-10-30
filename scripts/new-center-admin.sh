#!/usr/bin/env bash
# Yangi markazning BIRINCHI admini va birinchi filiali (30.10.2026). Parolni admin o'zi
# kiritadi — ekranga ham, buyruqlar tarixiga ham chiqmaydi. Lokal kompyuterdan:
#
#   ssh -t root@SERVER_IP sudo -iu crm bash /var/www/crm/current/scripts/new-center-admin.sh
#
# Qayta ishga tushirilsa: shu raqamli admin parolini yangilaydi, filial bor bo'lsa tegmaydi.
set -euo pipefail
cd "$(dirname "$0")/.."

# Buyruqni yuborgan terminalning ortiqcha Enter'i (Windows \r\n) birinchi savolga bo'sh javob
# bo'lib tushardi (30.10: telefon bo'sh ketib, seed-admin.js sukut raqamini qo'ygan) — kutib
# turgan kiritishni tashlab yuboramiz (faqat terminalda — quvur orqali javoblar yo'qolmasin).
if [[ -t 0 ]]; then while read -r -t 0.5 _; do :; done; fi

while true; do
  read -r -p "Admin telefoni (masalan 90 123 45 67): " PHONE
  DIGITS="${PHONE//[^0-9]/}"
  [[ "$DIGITS" =~ ^(998)?[0-9]{9}$ ]] && break
  echo "Telefon 9 ta raqam bo'lsin (masalan 90 123 45 67) — qaytadan."
done
while true; do
  read -r -p "Ism familiya: " NAME
  [[ -n "${NAME// /}" ]] && break
done
while true; do
  read -r -s -p "Parol (kamida 8 belgi): " PW; echo
  read -r -s -p "Parolni takrorlang: " PW2; echo
  if [[ "$PW" == "$PW2" && ${#PW} -ge 8 ]]; then break; fi
  echo "Parollar mos emas yoki 8 belgidan qisqa — qaytadan."
done
while true; do
  read -r -p "Birinchi filial nomi: " BRANCH
  [[ -n "${BRANCH// /}" ]] && break
done

# seed-admin.js natija qatorida parolni ham yozadi — uni kesib tashlaymiz.
node scripts/seed-admin.js "$DIGITS" "$PW" "$NAME" | sed -E 's# / .*  \(# (#'
unset PW PW2
BRANCH_NAME="$BRANCH" node scripts/seed-branch.mjs
