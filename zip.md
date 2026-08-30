# Tezlik (performance) — tahlil va bajarilgan ishlar

> Holat: **2026-08-30 — rejadagi asosiy bandlar bajarildi.**
> Barcha raqamlar haqiqiy bazadan o'lchangan (6 732 o'quvchi,
> 25 567 tranzaksiya yozuvi, 21 921 tranzaksiya).

---

## 1. Qisqacha natija

| Sahifa / joy | Ilgari | Hozir | Izoh |
|---|---|---|---|
| **Har bir sahifa** (Navbar) | 3.6 MB | **0 KB** | qidiruv serverga ko'chdi |
| `/finance-transactions` | 11 600 KB | **293 KB** | server sahifalash |
| `/finance-cash` | ~11.6 MB | **572 KB** | kassa + sana filtri |
| `/finance-revenue-plan` | ~11.6 MB | **0 KB** | aggregation, 4 ta son |
| **Sovuq start** (birinchi so'rov) | +3 636 ms | **+152 ms** | indeks tekshiruvi fonda |
| Analitika sahifalari orasida yurish | har safar 2.8 MB | **1 marta** | umumiy kesh |
| Bitta sahifada o'quvchilar ro'yxati | 2 marta | **1 marta** | umumiy kesh |

### Brauzerda o'lchangan A/B (bir xil mashina, bir xil baza, bir xil yo'l)

Usul: `window.fetch` sanagichga o'raldi, keyin `/parents` -> `/active-students`
-> `/parents` yo'li bosib o'tildi. "Keshsiz" holat `TTL_MS = 0` qilib
olindi — bu keshni butunlay o'chiradi, ya'ni aynan eski xulq.

| | `/api/pupils` chaqiruvi | Trafik |
|---|---|---|
| Keshsiz (eski xulq) | **4 ta** | 4 × 3 654 KB = **14 616 KB** |
| Kesh bilan | **1 ta** | **3 654 KB** |

Sanagich vaqtlari eski xulqda: `102942, 102973, 106116, 106126` —
ya'ni **har bir sahifa 2 ta bir xil so'rovni bir vaqtda** yuborardi
(31 ms va 10 ms farq bilan). Bu takrorlanish endi TTL'dan qat'i nazar
yo'qoladi: in-flight dedup ularni bitta so'rovga birlashtiradi.

---

## 2. Ildiz sabab (tasdiqlangan)

**API'lar butun kolleksiyani brauzerga yuborardi, filtrlash esa klientda
bo'lardi.** Ikkinchi sabab — **kesh yo'qligi**: bir xil og'ir ro'yxat bitta
sahifada bir necha marta, va har navigatsiyada qaytadan so'ralardi.

---

## 3. Qaysi to'plam haqiqatan og'ir (o'lchandi)

`node scripts/_collection-sizes.mjs`

| To'plam | Hujjat | Hajm |
|---|---|---|
| `transaction_entries` | 25 567 | **11 929 KB** |
| `pupils` | 6 732 | **3 976 KB** |
| `transactions` | 21 921 | **3 506 KB** |
| `groups` | 91 | 46 KB |
| `hr_employees` | 53 | 19 KB |
| qolgan 60+ to'plam | — | ≤ 14 KB |

> **Muhim xulosa:** faqat **uchta** to'plam og'ir. Qolganlariga sahifalash
> yoki proyeksiya qo'shish — o'lchanadigan foydasi yo'q ish. Eski rejadagi
> "hamma ro'yxat endpoint'iga sahifalash" bandi shu sababli yopildi.

---

## 4. Bajarilgan ishlar

### 4.1. Navbar qidiruvi serverga (`826cd7f`)

Navbar `AppShell` ichida, ya'ni har bir sahifada. U `useStudents()` orqali
6 732 o'quvchini (3.6 MB) faqat qidiruv oynasi uchun yuklardi.

Endi: [app/api/search/students/route.ts](app/api/search/students/route.ts) —
qidiruv Mongo'da, 200 ms debounce, LIMIT 20. Sahifa ochilishida **hech narsa
yuklanmaydi**.

### 4.2. `transaction-entries` (`2de933a`)

Uchta moliya sahifasi 25 567 qatorni to'liq yuklab, yig'indini brauzerda
hisoblardi. Endi:

- route'ga `cashboxId`, `dateFrom`/`dateTo`, `status`, `page`/`limit`
  qo'shildi; `total` — `countDocuments`, sahifalashdan OLDIN;
- [revenue-summary](app/api/transaction-entries/revenue-summary/route.ts) —
  4 ta son `aggregate` bilan;
- [students](app/api/transaction-entries/students/route.ts) — `distinct`,
  3 357 ism ≈ 73 KB (ilgari 11 MB dan `new Set(...)`);
- indeks: `{ cashboxId: 1, date: -1 }`.

**Moliyaviy raqamlar o'zgarmaganligi isbotlangan:**
`scripts/_verify-revenue.mjs` (6 oy, hammasi MOS) va
`scripts/_verify-cashbox.mjs` (4 holat, qator id'lari va kirim/chiqim aynan).

### 4.3. `ensureIndexes()` endi so'rovni to'smaydi

O'lchov (`scripts/_time-indexes.mjs`):

```
72 ta createIndex, PARALLEL:  3 636 ms
bitta listIndexes tekshiruvi:   152 ms
```

Ya'ni parallel qilingandan keyin ham har sovuq startda birinchi so'rov
**3.6 soniya** kutardi — va bu vaqt deyarli har doim bekorga ketardi,
chunki indekslar allaqachon joyida.

Endi [lib/mongodb.ts](lib/mongodb.ts):

- baza allaqachon indekslangan bo'lsa → tekshiruv **fonda**, so'rov kutmaydi;
- baza **yangi** bo'lsa → **kutamiz**. Unique indekslar takror yozuvdan
  saqlaydi (`pupils.id`), ular yo'q paytda yozuvga ruxsat berib bo'lmaydi.

Deploy paytida bir marta: `node scripts/ensure-indexes.mjs`.

### 4.4. Umumiy klient keshi

[lib/clientCache.ts](lib/clientCache.ts) — ikki vazifasi bor:

1. **in-flight dedup** — ayni paytda ketayotgan bir xil so'rovlar bitta
   so'rovga birlashadi (sahifa + ichidagi oyna bir vaqtda so'raganda);
2. **qisqa muddatli kesh** — sahifalar orasida yurganda qayta yuklanmaydi.

Qo'llanilgan joylar:

| Manba | TTL | Kim ishlatadi |
|---|---|---|
| `/api/pupils` | 30 s | [useStudents](hooks/useStudents.ts) + hook'ni chetlab o'tgan **6 ta** joy |
| `/api/transactions` | 15 s | [5 ta analitika sahifasi](lib/transactionsClient.ts) |

Hook'ni chetlab o'tib alohida 3.6 MB yuklaydigan joylar topildi va ulandi:
`AddStudentModal`, `FirstLessonsPage`, `PupilsContext`, `SmsModal`,
`NewStudentsPage`, `lib/enrollStudent.ts`. Ulardan to'rttasi endi **yengil**
ro'yxatni oladi — kod tekshirib chiqildi, ularga faqat id/ism/telefon
kerak. `SmsModal` to'liq qoladi (ota/ona telefonlari kerak).

**Yozuvdan keyin kesh aniq bekor qilinadi** — o'quvchi o'zgarganda 9 joyda
`invalidateStudents()`, tranzaksiya yozilganda 9 joyda
`invalidateTransactions()`.

> **Eskirish — nima o'zgardi (halol ta'rif).** Dastlab bu yerda "kesh mavjud
> xulqdan eskiroq ma'lumot ko'rsata olmaydi" deb yozilgan edi. Bu **noto'g'ri**
> — mustaqil tekshiruv aniqladi.
>
> Ilgari komponent har MOUNT bo'lganda yangi so'rov ketardi, ya'ni sahifaga
> o'tish amalda "yangilash" edi. Endi bunday emas: TTL ichidagi mount keshdagi
> suratni qayta chizadi va buni bildiradigan ko'rsatkich yo'q.
>
> - **Qoplangan:** foydalanuvchining o'z yozuvlari (aniq bekor qilish);
>   sahifada qimirlamay o'tirish (bu holat oldin ham shunday edi —
>   avtomatik yangilash umuman yo'q).
> - **Qoplanmagan:** boshqa foydalanuvchi yoki fon jarayoni (sinxronizatsiya,
>   cron) yozgan ma'lumot TTL tugaguncha ko'rinmaydi.
>
> Misol: 10:00:00 da kassir 3 000 000 kirim yozadi; buxgalter 09:59:55 da
> hisobotlarda bo'lib, 10:00:05 da o'sha sahifaga qaytsa — eski suratni
> ko'radi. Shu sabab `transactions` TTL'i qisqaroq (15 s) qilingan.
> Kerak bo'lsa uni pasaytirish yoki ko'tarish bitta o'zgarmas son:
> `lib/transactionsClient.ts` dagi `TTL_MS`.

### 4.5. `/api/pupils?light=1`

`{ id, firstName, lastName, phone }` — **3 654 KB → 544 KB**.
Balans/holat kerak bo'lgan sahifalar to'liq rejimda qoladi.

### 4.6. Mustaqil so'rovlarni parallellashtirish

`Promise.all` ga yig'ildi (har biri bitta ~150 ms round-trip tejaydi):

- [app/api/cashboxes/route.ts](app/api/cashboxes/route.ts) — GET, sahifa
  yuklash yo'lida;
- [app/api/bonuses/route.ts](app/api/bonuses/route.ts);
- `app/api/hr-employees/[id]/notes/route.ts`.

**Ataylab tegilmadi:** `cashboxes/[id]/transfer-to` (pul o'tkazmasi —
debet/kredit tartibi), `employees` (insert zanjiri), `salary-runs`.
Ularda ketma-ketlik mantiqning bir qismi.

---

## 5. Sinab ko'rilgan va RAD ETILGAN yo'llar

> Bu yo'llarga qaytadan vaqt sarflamang — o'lchandi.

### 5.1. Wire-siqish (zstd) — foyda bermadi

```
siqishsiz (hozirgi)    pupils  2359 ms | tx  4030 ms
zstd siqish bilan      pupils  4411 ms | tx  3566 ms
```

Sabab: bo'g'iz kenglik emas, **kursor paketlari (batch)**. Hujjat SONINI
yoki HAJMINI kamaytirish yordam beradi, siqish esa yo'q.

### 5.2. Hamma ro'yxat endpoint'iga sahifalash

3-bo'limdagi jadval: `groups` 46 KB, `hr_employees` 19 KB, qolganlari
14 KB dan kichik. Sahifalash u yerda faqat kod murakkabligini oshiradi.

### 5.3. `transactions` ga proyeksiya

Hujjat allaqachon ixcham — `id`, `date`, `time`, `amount`, `category`,
`method`, `methodLabel`, `cashboxId`, va **hammasi ishlatiladi**.
Kesadigan joyi yo'q. Shuning uchun u yerda kesh qo'llanildi.

### 5.4. Ko'p "ketma-ket await" — aslida bog'liq

Avtomatik qidiruv 11 ta nomzod topdi, lekin qo'lda tekshirilganda
ko'pchiligi **bog'liq** bo'lib chiqdi (guruhni o'qib, keyin uning
`studentIds` bo'yicha o'quvchilarni olish kabi) yoki yozuv tartibi muhim
bo'lgan joylar. Faqat 3 tasi haqiqatan mustaqil edi (4.6-band).

### 5.5. JS to'plamini optimallashtirish

3.6 MB ko'p ko'rinadi, lekin u route bo'yicha bo'lingan va brauzerda
**keshlanadi** — bir marta yuklanadi.

---

## 6. Qolgan ish

### 6.1. Atlas regioni — O'LCHANDI, qaror kutilmoqda

Klaster **AWS / Singapur (ap-southeast-1)**, foydalanuvchilar O'zbekistonda.

`node scripts/_region-latency.mjs` — sof TCP ulanish vaqti (1 round-trip),
har region uchun 6 o'lchov, eng tezi olindi:

| Region | Joy | RTT | Farq |
|---|---|---|---|
| `eu-north-1` | Stokgolm | **90 ms** | **−57 ms** |
| `eu-central-1` | Frankfurt | **106 ms** | **−41 ms** |
| `ap-southeast-1` | **Singapur (hozirgi)** | **147 ms** | — |
| `ap-northeast-1` | Tokio | 166 ms | +19 ms |
| `us-east-1` | AQSh (Virjiniya) | 190 ms | +43 ms |
| `ap-south-1` | Mumbay | 205 ms | +58 ms |
| `eu-west-1` | Irlandiya | 212 ms | +65 ms |
| `me-central-1` | BAA (Dubay) | 220 ms | +73 ms |

**O'lchov o'zini o'zi tasdiqlaydi:** Singapur uchun 147 ms chiqdi, bu
`scripts/_db-perf.mjs` dagi mustaqil Atlas o'lchovi (145–154 ms) bilan
aynan mos. Ya'ni usul to'g'ri.

**Kutilmagan natija:** Dubay va Mumbay geografik jihatdan yaqinroq bo'lsa
ham SEKINROQ. O'zbekiston tranziti Yevropa orqali ketadi, shuning uchun
masofa emas, marshrut hal qiladi.

**Tavsiya — Frankfurt (`eu-central-1`):** 147 ms → 106 ms, ya'ni **har bir
round-trip 28% qisqaradi**, kodga umuman tegmasdan. Stokgolm yana 16 ms
tezroq, lekin u Atlas'ning bepul (M0) tarifida yo'q — Frankfurt esa hamma
tarifda bor.

**Diqqat:** Atlas klasterning regionini joyida o'zgartirib bo'lmaydi
(ayniqsa M0 da). Yangi klaster yaratib, ma'lumotni ko'chirish kerak:
`scripts/_backup-db.mjs` → yangi klaster → `scripts/_restore-db.mjs`,
keyin `.env.local` va deploy muhitidagi `MONGODB_URI` almashtiriladi.

**Vercel tomoni:** ulangan Vercel akkauntida (`Abdulloh's projects`,
hobby) **birorta ham proyekt yo'q** — sayt Vercel'da joylashmagan.
Shuning uchun `vercel.json` dagi `regions` masalasi hozircha ochilmaydi.
Sayt qayerda ishlayotgani aniqlangach, o'sha yerning regioni ham
klasterga yaqin bo'lishi kerak — aks holda Frankfurt'ga ko'chirishning
foydasi yo'qoladi.

### 6.2. `/api/pupils` standart rejimi

Hali to'liq hujjat qaytaradi. Balans/holat ko'rsatadigan sahifalar
(`ActiveStudentsPage`, `ArchiveStudentsPage`, `ParentsPage`,
`ExpiringSubsPage`, `NazoratDavomatPage`) shuni ishlatadi. Ularga o'rtacha
proyeksiya (kerakli 10–12 maydon) qo'shsa bo'ladi — lekin avval har bir
sahifada qaysi maydon ishlatilishini tekshirish shart.

---

## 7. O'lchov skriptlari

| Skript | Nima qiladi |
|---|---|
| `scripts/_collection-sizes.mjs` | qaysi to'plam og'ir |
| `scripts/_db-perf.mjs` | RTT, ulanish, o'qish vaqtlari |
| `scripts/_time-indexes.mjs` | `ensureIndexes()` narxi |
| `scripts/_region-latency.mjs` | AWS regionlarigacha RTT (qaysi region tezroq) |
| `scripts/_verify-revenue.mjs` | tushum raqamlari o'zgarmaganini tekshiradi |
| `scripts/_verify-cashbox.mjs` | kassa raqamlari o'zgarmaganini tekshiradi |

Brauzer tomonini o'lchash (tizimga kirgan holda, konsolda):

```js
const urls = ["/api/pupils", "/api/transactions", "/api/people/directory",
              "/api/groups", "/api/transaction-entries?limit=50"];
for (const u of urls) {
  const t0 = performance.now();
  const b = await (await fetch(u, { cache: "no-store" })).arrayBuffer();
  console.log(u, Math.round(b.byteLength / 1024) + " KB",
                 Math.round(performance.now() - t0) + " ms");
}
```
