// pm2 sozlamasi — VPS'da CRM'ni ishlatib turadi (deploy/deploy.sh
// `pm2 startOrReload` bilan chaqiradi). Nusxasi /var/www/crm/shared/ da.
//
// `cwd` — `current` HAVOLASI: deploy yangi relizga burgach `pm2 reload`
// jarayonni qayta ochadi va u yangi papkadan ko'tariladi. Fork rejimi
// (bitta nusxa) — ilova ichida xotira keshlari bor (Eskiz tokeni, sync
// navbati), ikki nusxa ularni ikki marta yuritardi; ~3 soniya uzilish
// qabul qilinadi.
//
// `-H 127.0.0.1` — port tashqariga ochilmaydi, faqat Nginx orqali.
// TZ=UTC — kod serverni UTC deb hisoblab Toshkent vaqtini o'zi qo'shadi
// (lib/uzTime.ts); boshqa zona qo'yilsa sanalar ikki marta siljiydi.
module.exports = {
  apps: [
    {
      name: "crm",
      cwd: "/var/www/crm/current",
      script: "node_modules/next/dist/bin/next",
      args: "start -p 3000 -H 127.0.0.1",
      exec_mode: "fork",
      instances: 1,
      env: { NODE_ENV: "production", TZ: "UTC", PORT: "3000" },
      // Xotira oshib ketsa (sizib chiqish) o'zi qayta ochadi — 4 GB dan
      // build uchun ham joy qolsin.
      max_memory_restart: "1500M",
      // Yopishga 8 s — ochiq so'rovlar (import, sync) tugab ulgursin.
      kill_timeout: 8000,
      restart_delay: 2000,
      max_restarts: 10,
      time: true,
      merge_logs: true,
      out_file: "/var/www/crm/shared/logs/out.log",
      error_file: "/var/www/crm/shared/logs/err.log",
    },
  ],
};
