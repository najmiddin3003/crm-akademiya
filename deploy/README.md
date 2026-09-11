# VPS'ga joylash (Eskiz VPS 3 · Ubuntu 24.04 · pm2 + Nginx)

Prod hozir Vercel'da (`sin1`, vercel.json). Ilova Vercel'ga bog'lanmagan:
`@vercel/*` yo'q, fayllar Cloudinary'da, baza MongoDB Atlas'da — oddiy
`next build && next start` bilan ishlaydi. Bu papka o'sha ko'chirish
uchun to'plam:

| Fayl | Vazifasi |
|---|---|
| `setup-server.sh` | Yangi serverni BIR MARTA tayyorlash (Node 24, pm2, Nginx, certbot, swap, UTC, ufw, `crm` foydalanuvchisi) |
| `deploy.sh` | Har deploy: alohida reliz papkasiga klon → build → `current` ko'rsatkichini burish → `pm2 reload` |
| `ecosystem.config.cjs` | pm2 sozlamasi (`next start -p 3000 -H 127.0.0.1`, TZ=UTC) |
| `nginx.conf.template` | Teskari proksi; `tizimli24.uz` → `www.tizimli24.uz` |
| `cron.sh` | Kunlik `/api/sync/cron` (Vercel Cron o'rniga) |

Server: 2 yadro / 4 GB / 80 GB NVMe — `next build` uchun 2 GB swap
qo'shiladi, ilovaga 1,5 GB chegara. Barcha buyruqlar Toshkentdagi
kompyuterdan (`ssh`) bajariladi; server IP'si Eskiz panelida (VPS →
Parametrlar).

---

## 0. Oldindan kerak

- VPS'ga `root` SSH kirishi (Eskiz paneli → "Boshqarish paneliga o'tish" → parol/kalit).
- Vercel'dagi **production** env qiymatlari (Vercel → Project → Settings →
  Environment Variables). Lokal `.env.local` dev uchun — undan ko'chirilmaydi.
- `tizimli24.uz` DNS boshqaruvi (hozir Vercel'ga qaragan).
- GitHub'da repo Settings → Deploy keys ga kirish (repo yopiq).
- MongoDB Atlas → Network Access ga kirish.

## 1. To'plamni serverga ko'chirish (lokal kompyuterdan)

```bash
scp -r deploy root@SERVER_IP:/root/deploy
```

## 2. Serverni tayyorlash (serverda, root)

```bash
ssh root@SERVER_IP
DOMAIN=www.tizimli24.uz bash /root/deploy/setup-server.sh
```

~5 daqiqa. Oxirida keyingi qadamlar ro'yxati chiqadi. Skript qayta
ishga tushirilsa ham zarar qilmaydi.

## 3. GitHub Deploy key (serverda, `crm` foydalanuvchisi)

```bash
sudo -iu crm
ssh-keygen -t ed25519 -C "crm-vps" -N "" -f ~/.ssh/id_ed25519
ssh-keyscan github.com >> ~/.ssh/known_hosts 2>/dev/null
cat ~/.ssh/id_ed25519.pub
```

Chiqqan `ssh-ed25519 …` qatorni GitHub → `crm-akademiya` → Settings →
Deploy keys → **Add deploy key** (faqat o'qish, "Allow write access"
belgilanMAydi). Tekshiruv:

```bash
ssh -T git@github.com     # "Hi najmiddin3003/crm-akademiya! …" chiqishi kerak
exit
```

## 4. Muhit o'zgaruvchilari

Vercel'dagi production qiymatlarini `/var/www/crm/shared/.env.local` ga
yozing (fayl `crm` ga tegishli, 0600).

> **11.09.2026 da chiqqan tuzoq:** Vercel'da "Sensitive" deb belgilangan
> o'zgaruvchilar (MONGODB_URI, SESSION_SECRET, Cloudinary, Eskiz, webhook
> secret'lar…) CLI orqali ham, panel orqali ham O'QILMAYDI — `vercel env
> pull` ularni `[SENSITIVE]` deb beradi. Ular lokal `.env.local` dan
> olindi (o'sha Atlas, o'sha botlar); Vercel'dan faqat ochiq farqlar
> (OPENAI_*, SHEET_TAB_SALARIES) va bayroqlar. Prodda YO'Q bo'lganlari
> (ENCRYPTION_KEY, SYNC_ENABLED, TELEGRAM_*_SUPPORT) ataylab qo'yilmadi.
> STUDENT_BOT_PUSH_ENABLED lokalda `false` — serverda `true` qilindi.

Qulay yo'l — lokal kompyuterda Vercel CLI bilan olib, scp qilish:

```bash
npx vercel env pull .env.vercel.production --environment=production
scp .env.vercel.production root@SERVER_IP:/var/www/crm/shared/.env.local
ssh root@SERVER_IP 'chown crm:crm /var/www/crm/shared/.env.local && chmod 600 /var/www/crm/shared/.env.local'
rm .env.vercel.production
```

Tekshiring:
- `APP_BASE_URL=https://www.tizimli24.uz` (webhook skriptlari shu manzilga o'rnatadi).
- `VERCEL_*` qatorlari bo'lsa — o'chiring, kerak emas.
- `PAYMENT_SMS_ENABLED`, `SYNC_ENABLED`, `STUDENT_BOT_ENABLED` — Vercel'da
  qanday bo'lsa, shunday (lib/paymentSms.ts izohi).

## 5. Atlas'ga server IP'sini ruxsat berish

MongoDB Atlas → Network Access → **Add IP Address** → server IP'si.
Bu qilinmasa ilova ko'tariladi, lekin kirish "Serverga ulanib
bo'lmadi" beradi.

## 6. Birinchi deploy (serverda)

```bash
sudo -iu crm bash /var/www/crm/shared/deploy.sh
```

~4–6 daqiqa (`npm ci` ~300 MB yuklaydi — Eskiz'da xalqaro kanal
30 Mb/s; keyin `next build`). Oxirida `ilova javob berdi` chiqadi.
Tekshiruv:

```bash
pm2 status
curl -sI http://127.0.0.1:3000/ | head -1        # HTTP/1.1 200 OK
curl -sI -H 'Host: www.tizimli24.uz' http://127.0.0.1/ | head -1   # Nginx orqali
```

Birinchi deploydan keyin pm2 daemonini **systemd ostiga** o'tkazing
(aks holda reboot'dan keyin ilova ko'tarilmaydi — `pm2-crm.service`
pid faylini topolmay `failed` bo'ladi), root sifatida:

```bash
sudo -iu crm pm2 kill && systemctl start pm2-crm && systemctl is-active pm2-crm
```

Sayt hali HTTP, ammo kirish cookie'si faqat HTTPS'da yuradi
(`secure`, app/api/auth/login) — brauzerdan to'liq sinash DNS va
sertifikatdan keyin.

## 7. DNS almashtirish (ish vaqtidan tashqari)

DNS boshqaruvida:
- `tizimli24.uz` — `A` → `SERVER_IP` (Vercel'ning `76.76.21.21` yoki `A`/`ALIAS` yozuvi o'rniga)
- `www` — `A` → `SERVER_IP` (Vercel'ning `cname.vercel-dns.com` o'rniga)
- TTL — 300 (bir kun oldin tushirib qo'yilsa tarqalish tez bo'ladi).

Tekshiruv (lokal): `nslookup www.tizimli24.uz` server IP'sini qaytarguncha kuting.

## 8. SSL (serverda, root — DNS server IP'sini qaytargach)

```bash
certbot --nginx -d www.tizimli24.uz -d tizimli24.uz --redirect -m EMAIL --agree-tos -n
systemctl status certbot.timer --no-pager | head -3     # avtomatik uzaytirish yoqiq
```

Shu paytdan sayt `https://www.tizimli24.uz` da VPS'dan ishlaydi.
Brauzerda: kirish → Guruhlar → Moliya/Kassalar → SMS xabarlar (bitta
sinov SMS) → rasm yuklash (o'quvchi profili).

## 9. Telegram webhook'lari

Domen o'zgarmagani uchun webhook'lar (`https://www.tizimli24.uz/api/telegram/…`)
o'z-o'zidan yangi serverga keladi. Ammo ular hali Vercel texnik domeniga
(`crm-akademiya-777777.vercel.app`) qaragan bo'lishi mumkin — tekshirib,
kerak bo'lsa qayta o'rnating (skriptlar `.env.local` dagi `APP_BASE_URL`
ni oladi):

```bash
sudo -iu crm
cd /var/www/crm/current
node scripts/set-telegram-webhook.mjs        # hozirgi manzilni ko'rsatadi va o'rnatadi
node scripts/set-student-bot-webhook.mjs
```

## 10. Kunlik cron (serverda, `crm`)

```bash
sudo -iu crm crontab -e
```

qator:

```
0 22 * * * /var/www/crm/shared/cron.sh >> /var/www/crm/shared/logs/cron.log 2>&1
```

(Server UTC'da: 22:00 UTC = Toshkent 03:00 — Vercel'dagi bilan bir xil.)
Qo'lda sinov: `bash /var/www/crm/shared/cron.sh` → natija Moliya →
Sinxronizatsiya sahifasida (`sync_runs`).

## 11. Vercel'ni to'xtatish

Vercel'dagi nusxa ham **o'sha bazaga** qaraydi va **o'zining cron'ini**
har kuni yuritadi — ikkita cron bitta bazani ikki marta sinxronlaydi.
DARHOL: Vercel → Project → Settings → **Cron Jobs → Disable**
(11.09.2026 da qilindi). Loyihaning o'zini 1–2 hafta kuzatgach Pause
qilish mumkin — undan oldin orqaga qaytish yo'li ochiq turadi (13-band).

## 12. Keyingi yangilanishlar

```bash
ssh root@SERVER_IP 'sudo -iu crm bash /var/www/crm/shared/deploy.sh'
```

Har safar yangi reliz papkasi, ~3 s uzilish. Skript o'zini repodagi
yangi nusxa bilan almashtirib turadi.

## 13. Orqaga qaytish

- **Deploy buzilgan** (build o'tdi, lekin ilova xato): `ls /var/www/crm/releases`
  → `ln -sfn /var/www/crm/releases/<oldingi> /var/www/crm/current && pm2 reload crm`.
  Build o'tmasa `current` o'zi eskicha qoladi.
- **Server umuman yiqilgan**: DNS'ni Vercel'ga qaytaring (`www` →
  `cname.vercel-dns.com`, apex → `76.76.21.21`) — Vercel nusxasi
  to'xtatilmagan bo'lsa 5–10 daqiqada tiklanadi.

## Kuzatuv

```bash
pm2 status; pm2 logs crm --lines 100; pm2 monit
tail -f /var/www/crm/shared/logs/err.log
tail -f /var/log/nginx/access.log
free -m; df -h /
```

## Tuzoqlar

- **Vaqt zonasi UTC bo'lsin.** Kod serverni UTC deb hisoblab Toshkent
  vaqtini o'zi qo'shadi (`lib/uzTime.ts`); zona Toshkentga qo'yilsa
  "bugun" 19:00 dan keyin ertangi kunga o'tib ketadi.
- **Baza uzoqda.** Atlas klasteri Singapur atrofida: Toshkentdan har
  so'rov ~150 ms (o'lchandi). Vercel `sin1` da baza yonida edi. Ko'p
  ketma-ket so'rovli sahifalar sekinlashishi mumkin — quyidagi "Baza"
  bandiga qarang.
- **Nginx `server_names_hash_bucket_size`.** Eskiz VPS'da nginx
  standart 32 bilan `could not build server_names_hash` deb yiqildi —
  `setup-server.sh` uni 64 qiladi.
- **Eskiz obrazida 512 MB swap bor** — skript uni 2 GB ga almashtiradi.
- **Ishlab turgan papkada build qilmang** — `next build` `.next` ni
  o'chirib qayta yaratadi, sayt o'sha zahoti 500 beradi. Faqat `deploy.sh`.
- **`npm ci` NODE_ENV=production bilan chaqirilmasin** — devDependencies
  (typescript, tailwind) o'rnatilmay build yiqiladi; skript buni o'zi hal qiladi.
- **Cron'ni ikki joyda yuritmang** (Vercel + VPS) — 11-band.

## Baza (MongoDB) qayerda tursin — ko'chirishdan OLDIN hal qilinadigan savol

Ilova serveri Toshkentga ko'chganda foydalanuvchi → server yo'li
qisqaradi (TAS-IX, ~5 ms), lekin server → baza yo'li uzayadi. 11.09.2026
da Toshkentdan o'lchangan TCP ulanish vaqti:

| Manzil | ms |
|---|---|
| Hozirgi Atlas klasteri | **~150** |
| AWS Singapur (`ap-southeast-1`) | 146 |
| AWS Frankfurt (`eu-central-1`) | 109 |
| AWS Stokgolm (`eu-north-1`) | 96 |
| AWS Mumbay (`ap-south-1`) | 210 |

Ya'ni Atlas'ni yaqinroq regionga ko'chirish ham ~100 ms dan pastga
tushirmaydi. Bitta sahifa 4–6 ta ketma-ket so'rov qilsa (layout'dagi
`getCurrentUser()` + sahifa so'rovlari) — Vercel'dagiga nisbatan
+0,5–0,9 s.

Variantlar:

1. **Atlas qoladi** — ko'chirish 1 kun; sahifalar biroz sekinroq
   (o'lchab ko'rish: 8-banddan keyin Guruhlar, Kassalar, O'quvchilar
   sahifalarini ochib solishtirish). Atlas'ning zaxira nusxalari va
   boshqaruvi saqlanadi.
2. **MongoDB shu VPS'da** (`mongodb-org` 8, 127.0.0.1, ~1 GB kesh) —
   so'rov <1 ms, sahifalar Vercel'dagidan ham tez (foydalanuvchi ham,
   baza ham yonida). Narxi: +yarim kun (o'rnatish, `mongodump` →
   `mongorestore` ~10 daqiqa, har kecha `mongodump` + server tashqarisiga
   nusxa) va zaxira/yangilanish mas'uliyati o'zimizda. 4 GB RAM ikkalasiga
   yetadi (ilova 1,5 GB + Mongo 1 GB + build uchun swap).
3. **Alohida kichik VPS'da Mongo** — 2-variant, lekin ilova va baza
   bir-birini yiqitmaydi; +oylik to'lov.

Tavsiya: sinov uchun 1-variant bilan ko'tarib o'lchash; sekinlik
sezilsa 2-variantga o'tish (ilova tomonida faqat `MONGODB_URI`
o'zgaradi).
