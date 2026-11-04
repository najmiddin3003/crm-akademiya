#!/usr/bin/env bash
# Markaz serverida O'QUVCHILAR BOTINI ulaydi (04.11.2026). Lokal kompyuterdan, Git Bash'da
# (PowerShell'da `<` ishlamaydi):
#
#   ssh root@SERVER_IP bash -s < deploy/center-student-bot.sh
#
# Bundan OLDIN:
#   1) @BotFather'da yangi bot ochiladi (/newbot) — xodimlar botining kaliti EMAS;
#   2) kalitni ODAMNING O'ZI kiritadi:
#        ssh -t root@SERVER_IP bash /root/deploy/set-center-secret.sh TELEGRAM_STUDENT_BOT_TOKEN
#   3) serverda o'quvchi kartasi va ota-ona kirishi bor reliz turishi kerak.
#
# Nima qiladi (qayta yurgizsa bo'ladi — mavjud maxfiy kalit almashmaydi):
#   • TELEGRAM_STUDENT_WEBHOOK_SECRET — yo'q bo'lsa yaratadi, ekranga chiqmaydi;
#   • STUDENT_BOT_SIGNUP_PUPIL=true — anketa lid bilan birga o'quvchi kartasini ochadi;
#   • TELEGRAM_STUDENT_BOT_USERNAME — Telegram'dan;
#   • .env.local ni qayta yig'adi va ilovani qayta yuklaydi;
#   • ilova yangi kalitni ko'rganini tekshiradi, shundan keyingina webhook va menyu buyruqlarini yozadi.
#
# STUDENT_BOT_PUSH_ENABLED ga (davomat/to'lov avtomatik xabarlari) TEGMAYDI — bu alohida qaror.
#
# Bot webhook'i boshqa xizmatda tursa (ManyChat va h.k.) to'xtaydi, chunki bot bitta webhook oladi
# va o'sha xizmat uzilib qoladi. Ataylab bo'lsa:
#
#   ssh root@SERVER_IP bash -s -- --force < deploy/center-student-bot.sh
set -euo pipefail

SRC=/root/center.env
OUT=/var/www/crm/shared/.env.local
DEPLOY=/root/deploy

read_key() { { grep -m1 "^$2=" "$1" || true; } | cut -d= -f2- | tr -d '\r'; }

put_key() {
  umask 077
  { grep -v "^$1=" "$SRC" || true; printf '%s=%s\n' "$1" "$2"; } > "$SRC.tmp"
  mv "$SRC.tmp" "$SRC"
  chmod 600 "$SRC"
}

# Kalit tirikmi, webhook begona xizmatda emasmi. Chiqishi — bot nomi. Hali hech narsa o'zgarmagan.
# Kalitlar muhitdan o'qiladi: buyruq qatoriga (ps ga) ham, ekranga ham chiqmaydi.
check_bot() {
  node - <<'JS'
(async () => {
  const { TOKEN, BASE, FORCE } = process.env;
  const tg = (method) => fetch(`https://api.telegram.org/bot${TOKEN}/${method}`).then((r) => r.json());
  const me = await tg("getMe");
  if (!me.ok) {
    console.error(`XATO: Telegram kalitni qabul qilmadi (${me.description})`);
    process.exit(1);
  }
  const info = await tg("getWebhookInfo");
  if (!info.ok) {
    console.error(`XATO: getWebhookInfo (${info.description})`);
    process.exit(1);
  }
  const current = String(info.result.url || "");
  if (current && new URL(current).host !== new URL(BASE).host && FORCE !== "--force") {
    console.error(`To'xtadi: bot webhook'i hozir BOSHQA xizmatda: ${new URL(current).host}`);
    console.error("Davom etsangiz o'sha xizmat botdan uziladi. Ataylab bo'lsa, --force bilan yurgizing.");
    process.exit(1);
  }
  console.log(me.result.username);
})().catch((e) => {
  console.error(`XATO: ${e.message}`);
  process.exit(1);
});
JS
}

connect_bot() {
  node - <<'JS'
(async () => {
  const { TOKEN, SECRET, BASE, BOT_NAME } = process.env;
  const tg = (method, body) =>
    fetch(`https://api.telegram.org/bot${TOKEN}/${method}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body ?? {}),
    }).then((r) => r.json());

  // Ilova yangi kalitni ko'rguncha kutamiz (pm2 reload bir zum oladi). Bo'sh yangilanishni route jim
  // o'tkazadi. Yo'naltirishga ergashilmaydi: Telegram ham ergashmaydi, 301 bu yerda xato hisoblanadi.
  const url = `${BASE}/api/telegram/student`;
  let status = 0;
  for (let i = 0; i < 15 && status !== 200; i++) {
    if (i > 0) await new Promise((r) => setTimeout(r, 2000));
    status = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Telegram-Bot-Api-Secret-Token": SECRET },
      body: "{}",
      redirect: "manual",
    })
      .then((r) => r.status)
      .catch(() => 0);
  }
  if (status !== 200) {
    console.error(`XATO: ${url} ${status || "javob bermadi"} — webhook YOZILMADI.`);
    process.exit(1);
  }

  const set = await tg("setWebhook", {
    url,
    secret_token: SECRET,
    // `message` KERAK — raqam (kontakt) va anketa javoblari shu orqali keladi.
    allowed_updates: ["message", "callback_query"],
    max_connections: 20,
  });
  if (!set.ok) {
    console.error(`XATO: setWebhook (${set.description})`);
    process.exit(1);
  }
  // scripts/set-student-bot-webhook.mjs --commands bilan bir xil ro'yxat.
  const commands = await tg("setMyCommands", {
    commands: [
      { command: "start", description: "Boshlash / asosiy menyu" },
      { command: "menu", description: "Asosiy menyu" },
      { command: "yozilish", description: "Kursga yozilish (yangi o'quvchilar)" },
      { command: "otaona", description: "Ota-ona: farzandni ulash" },
    ],
  });
  if (!commands.ok) {
    console.error(`XATO: setMyCommands (${commands.description})`);
    process.exit(1);
  }

  const info = await tg("getWebhookInfo");
  console.log(`Bot:     @${BOT_NAME}`);
  console.log(`Webhook: ${info.result?.url || "(o'rnatilmagan)"}`);
  console.log(`Navbat:  ${info.result?.pending_update_count ?? 0}`);
  if (info.result?.last_error_message) console.log(`Oxirgi xato: ${info.result.last_error_message}`);
})().catch((e) => {
  console.error(`XATO: ${e.message}`);
  process.exit(1);
});
JS
}

main() {
  [[ -s "$SRC" ]] || { echo "XATO: $SRC yo'q"; exit 1; }
  [[ -s "$OUT" ]] || { echo "XATO: $OUT yo'q"; exit 1; }

  export FORCE="${1:-}"
  export TOKEN BASE SECRET BOT_NAME
  TOKEN="$(read_key "$SRC" TELEGRAM_STUDENT_BOT_TOKEN)"
  if [[ -z "$TOKEN" ]]; then
    echo "XATO: TELEGRAM_STUDENT_BOT_TOKEN yo'q. Avval kalitni kiriting:"
    echo "  ssh -t root@SERVER_IP bash $DEPLOY/set-center-secret.sh TELEGRAM_STUDENT_BOT_TOKEN"
    exit 1
  fi

  # Xodimlar botining kaliti adashib kiritilsa, webhook ustiga yoziladi va guruhdagi lid tugmalari
  # to'xtaydi. Manzil bir xil bo'lgani uchun begona xizmat tekshiruvi buni ushlamaydi, --force ham o'tmaydi.
  local staff
  staff="$(read_key "$OUT" TELEGRAM_BOT_TOKEN)"
  if [[ -n "$staff" && "${TOKEN%%:*}" == "${staff%%:*}" ]]; then
    echo "XATO: bu xodimlar botining kaliti. O'quvchilar uchun @BotFather'da alohida bot oching."
    exit 1
  fi

  BASE="$(read_key "$OUT" APP_BASE_URL)"
  BASE="${BASE%/}"
  [[ "$BASE" == https://* ]] || { echo "XATO: APP_BASE_URL https:// bilan boshlanishi kerak"; exit 1; }

  BOT_NAME="$(check_bot)"

  SECRET="$(read_key "$SRC" TELEGRAM_STUDENT_WEBHOOK_SECRET)"
  if [[ -z "$SECRET" ]]; then
    SECRET="$(openssl rand -hex 32)"
    put_key TELEGRAM_STUDENT_WEBHOOK_SECRET "$SECRET"
  fi
  put_key STUDENT_BOT_SIGNUP_PUPIL true
  put_key TELEGRAM_STUDENT_BOT_USERNAME "$BOT_NAME"

  bash "$DEPLOY/new-center-env.sh" "$SRC" >/dev/null
  sudo -iu crm pm2 reload crm --update-env >/dev/null

  connect_bot
  echo "Tayyor: bot ulandi."
}

# `bash -s` da skript stdin'dan o'qiladi: hammasi funksiyada bo'lsa, oxirigacha o'qilgandan keyingina
# ishlaydi, ichki buyruqlar esa skriptning davomini yutib yubormaydi.
main "$@" </dev/null
