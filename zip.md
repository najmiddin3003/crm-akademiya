# Tezlik (performance) — tahlil va bajarilgan ishlar

> Holat: **2026-08-30 — rejadagi bandlar bajarildi, ustiga o'lchov bilan
> topilgan yangi ishlar ham.**
> Barcha raqamlar haqiqiy bazadan o'lchangan (6 732 o'quvchi,
> 25 567 tranzaksiya yozuvi, 21 921 tranzaksiya, 91 guruh).

---

## 1. Qisqacha natija

### Server tomoni (Atlas'gacha o'lchangan, eng tez natija)

| Joy | Ilgari | Hozir | Izoh |
|---|---|---|---|
| `/api/sales-plans` | 8 454 ms / 9.0 MB | **195 ms / 0.1 KB** | `$group` |
| Hisobot "Xizmat ko'rsatilgan" | 13 542 ms / 8 414 KB | **189 ms / 2 KB** | yangi aggregation |
| `lib/sync/dispatch.ts` (100 ta) | ~15 315 ms | **~480 ms** | N+1 yo'qoldi |
| `/api/students/balances` | 1 191 ms | **403 ms** | `$group` |
| `studentPaidBalanceByName` | 1 167 ms | **~200 ms** | `$group` |
| `getCurrentUser` (har sahifada) | 818 ms | **~490 ms** | 5 → 3 round-trip |
| `loadPaymentMethods` | 513 ms | **154 ms** | 3 → 1 so'rov |
| `ensureRoles` | 458 ms | **~155 ms** | 3 → 1 so'rov |
| `/api/pupils` (ro'yxat) | 2 189 ms / 3 654 KB | **1 610 ms / 2 727 KB** | proyeksiya |
| `/api/pupils?light=1` | — | 506 ms / 544 KB | ilgari ham bor edi |
| Nazorat davomat sahifalari | **91 ta** HTTP so'rov | **1 ta** | yangi route |
| **Sovuq start** (birinchi so'rov) | +3 636 ms | **+152 ms** | indeks fonda |

### Klient tomoni

| Joy | Ilgari | Hozir |
|---|---|---|
| **Har bir sahifa** (Navbar) | 3.6 MB | **0 KB** |
| `/finance-transactions` | 11 600 KB | **293 KB** |
| `/finance-cash` | ~11.6 MB | **572 KB** |
| `/finance-revenue-plan` | ~11.6 MB | **0 KB** |
| `/api/students/balances` | 11 ta komponent alohida | **umumiy kesh** |
| Yengil rejimga o'tgan joylar | 3 654 KB × 9 | **544 KB × 9** |
| Boshlang'ich JS: xlsx | 434 KB × 9 route | **0** (bosilganda) |
| Boshlang'ich JS: recharts | 318 KB × 4 route | **0** (kerak bo'lganda) |
| O'quvchi tanlash oynasi | ~67 000 DOM tuguni | **~500** |
| Nazorat `<select>` | 6 732 `<option>` | **ochilganda** |
| Hisobotlar kunlik grafigi (1 yil) | 220 ms | **5 ms** |

---

## 2. Ildiz sabab (tasdiqlangan)

Uchta naqsh, uchalasi ham qayta-qayta uchradi:

1. **API butun kolleksiyani yuboradi, filtr/yig'indi esa boshqa joyda
   hisoblanadi** — brauzerda yoki Node'da. Eng yomon holatlari: 18 822
   hujjat 3 ta sonni sanash uchun, 16 937 qator bitta o'quvchining
   balansini topish uchun.
2. **Kesh yo'qligi** — bir xil og'ir ro'yxat bitta sahifada bir necha
   marta, va har navigatsiyada qaytadan.
3. **Kerak bo'lmagan ish oldindan qilinadi** — bosilmagan tugma uchun
   431 KB kutubxona, ochilmagan ro'yxat uchun 67 000 DOM tuguni.

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
| `attendance` | **0** | — |
| qolgan 60+ to'plam | — | ≤ 14 KB |

> **Muhim xulosa:** faqat **uchta** to'plam og'ir. Qolganlariga sahifalash
> yoki proyeksiya qo'shish — o'lchanadigan foydasi yo'q ish.

---

## 4. Bajarilgan ishlar

### 4.1. Navbar qidiruvi serverga (`826cd7f`)

Navbar `AppShell` ichida, ya'ni har bir sahifada. U `useStudents()` orqali
6 732 o'quvchini (3.6 MB) faqat qidiruv oynasi uchun yuklardi. Endi
[app/api/search/students/route.ts](app/api/search/students/route.ts) —
qidiruv Mongo'da, 200 ms debounce, LIMIT 20.

### 4.2. `transaction-entries` (`2de933a`)

Uchta moliya sahifasi 25 567 qatorni to'liq yuklab, yig'indini brauzerda
hisoblardi. Route'ga `cashboxId`, `dateFrom`/`dateTo`, `status`,
`page`/`limit` qo'shildi; `revenue-summary` — 4 ta son `aggregate` bilan;
`students` — `distinct`; indeks `{ cashboxId: 1, date: -1 }`.

### 4.3. `ensureIndexes()` endi so'rovni to'smaydi (`b426297`, `abe2fc3`)

72 ta `createIndex` parallel ham 3 636 ms edi, bitta `listIndexes`
tekshiruvi esa 152 ms. Endi baza indekslangan bo'lsa tekshiruv **fonda**;
baza yangi bo'lsa **kutamiz** (unique indekslar takror yozuvdan saqlaydi).

### 4.4. Umumiy klient keshi (`b426297`)

[lib/clientCache.ts](lib/clientCache.ts) — in-flight dedup + qisqa muddatli
kesh. `/api/pupils` (30 s), `/api/transactions` (15 s).

### 4.5. `/api/pupils?light=1` (`b426297`)

`{ id, firstName, lastName, phone }` — 3 654 KB → 544 KB.

### 4.6. `/api/pupils` standart rejimiga proyeksiya (`f715faf`)

Ro'yxat rejimi 6 732 hujjatning HAMMA maydonini qaytarardi. Endi 23 ta
maydon: `MEDIUM_PROJECTION` ([app/api/pupils/route.ts](app/api/pupils/route.ts)).

**Nega atigi 25%:** javobning **62.3% i BO'SH ixtiyoriy maydonlar** edi —
`targetUniversity`, `paymentDate`, `lessonTime` va yana 15 tasi bazadagi
6 731 yozuvda ham bo'sh satr. Ular endi umuman yuborilmaydi.

Qaysi maydon qolgani tasodifiy emas: har bir sahifa qaysi maydonni
o'qishi alohida tekshirildi, keyin uchta mustaqil tekshiruv tashlanadigan
maydonlarni rad etishga urindi — hech biri ro'yxat yo'lida o'qilmadi.
`extraPhone`, `email`, `tags`, `lessonTime`, `language`, `survey`,
`targetUniversity`, `studyPlace`, `note`, `debtLimit` faqat **profil**
sahifalarida o'qiladi, ular esa `GET /api/pupils/:id` dan TO'LIQ hujjat
oladi.

Buni endi **kompilyator ham ushlaydi**: `PupilListItem` tipi
([lib/pupilsData.ts](lib/pupilsData.ts)) proyeksiyaning aynan aksi, va
ro'yxat yo'li shu tipda. Ro'yxatda yo'q maydonni o'qish — kompilyatsiya
xatosi, jimgina bo'sh qiymat emas.

> **Ikkalasi BIRGA o'zgartirilsin:** `MEDIUM_PROJECTION` va `PupilListItem`.

### 4.7. Server aggregatsiyalari (`48b3d4f`)

Yettita joy bir xil kasallikdan aziyat chekardi: Mongo'dan hammasini
tortib olib, keyin Node'da sanash yoki qo'shish.

- **`/api/sales-plans`** — 18 822 hujjat 3 ta moderatorni SANASH uchun
  kelardi. `$group` bilan: 8 454 ms → 195 ms, 9 051 KB → 0.1 KB.
- **`/api/students/balances`** — 16 937 qator Node'ga kelib, u yerda
  qo'shilardi; natija ~3 264 kalit. `$group` bilan 1 191 → 403 ms.
- **`studentPaidBalanceByName`** ([lib/pupilsDb.ts](lib/pupilsDb.ts)) —
  BUTUN kolleksiya bitta o'quvchining balansi uchun. 1 167 → ~200 ms.
- **`lib/sync/dispatch.ts`** — `findOne` tsikl ICHIDA edi: to'liq partiyada
  100 ta ketma-ket so'rov, ~15.3 s sof kutish, ya'ni 45 s lik `deadline`
  ning uchdan biri. Bitta `$in` bilan ~480 ms.
- **`getCurrentUser`** ([lib/auth.ts](lib/auth.ts)) — 5 ta KETMA-KET Atlas
  so'rovi, va u `(app)/layout.tsx` da, ya'ni HAR sahifa render'ida.
  Ikkita o'qish bir-biriga bog'liq emas edi (ikkalasining kaliti ham
  cookie'dan) → `Promise.all`; `lastSeenAt` yozuvi esa natijasi
  o'qilmaydigan bezak bo'la turib render'ni to'sardi → `after()`.
  818 → ~490 ms.
- **`loadPaymentMethods`**, **`ensureRoles`** — avval o'qib, keyin kerak
  bo'lsagina yozadigan qilib qayta yozildi. Migratsiyalar idempotent
  qoldi, lekin steady-state'da bepul bo'ldi.
- **`reports/balance`**, **`payrollSources`** — proyeksiya qo'shildi.
- **`transaction-entries`** — sahifalash so'ralmagan chaqiruvda ortiqcha
  `countDocuments` tashlandi (`total` = `rows.length`).

**Guruhlash Mongo'ga ko'chdi, lekin ism normalizatsiyasi (trim + kichik
harf) ATAYLAB JS'da qoldi:** bazada chetida bo'shliq bor 15 ta yozuv va
harfi farq qiladigan 38 ta ism juftligi bor — ular aynan shu qoida bilan
birlashadi, va o'sha qoida boshqa joylarda ham qo'llanadi.

### 4.8. Hisobot "Xizmat ko'rsatilgan" (`3924a76`)

Sahifa `/api/transaction-entries` ni LIMITSIZ chaqirardi: 18 757 ta to'liq
hujjat brauzerga tushardi, keyin ulardan atigi uchta maydon o'qilib
(`date`, `teacherName`, `amount`) ko'pi bilan 45 qator chiqarardi.
Yangi [served-summary](app/api/transaction-entries/served-summary/route.ts):
**13 542 ms / 8 414 KB → 189 ms / 2 KB**.

### 4.9. Balanslar keshi va yengil rejim (`ef42784`)

`/api/students/balances` ni **11 ta** komponent xom `fetch` bilan olardi —
na kesh, na dedup. `/parents` → `/active-students` → `/parents` yo'li
og'ir hisobni uch marta yugurtirardi; `/finance-cash` da esa drawer HAR
ochilganda. Endi [lib/balancesClient.ts](lib/balancesClient.ts), TTL 15 s,
yozuvdan keyin aniq bekor qilinadi.

**To'qqizta joy** `useStudents()` ni TO'LIQ rejimda chaqirardi, lekin faqat
ism/telefon/id o'qirdi (har biri kod bo'yicha tekshirildi) — yengil
rejimga o'tdi. `/finance-cash` da bu bundan ham yaxshi: sahifa allaqachon
yengil ro'yxatni olgan, ya'ni drawer ochilganda so'rov **umuman
ketmaydi**.

### 4.10. Boshlang'ich JS to'plami (`98e77fd`)

Ikkita eng katta klient chunk'i bosilmagan tugmalar uchun tashilardi:

- **xlsx (SheetJS) 434 KB** — 9 ta route'da, har bir ishlatilishi esa klik
  ichida. Endi `await import("xlsx")` funksiya ichida. Build tekshiruvi:
  chunk endi **birorta** route'ning client-reference-manifest'ida yo'q.
- **recharts 318 KB** — 4 ta route'da, faqat `DonutChart` ichida
  ishlatiladi va u hech qaysi sahifada birinchi bo'yoqda ko'rinmaydi.
  `DonutChart` ikkiga bo'lindi: `DonutChartImpl.tsx` va uni `next/dynamic`
  (`ssr: false`) bilan yuklaydigan yupqa o'rovchi. Tashqi interfeys
  o'zgarmadi.
- **leaflet + react-leaflet + @types/leaflet** o'chirildi — manbada ularga
  birorta import yo'q edi, lekin `node_modules` da 4.0 MB.
- **`next.config.ts`** bo'm-bo'sh edi → `staleTimes.dynamic = 30`.
  (app) ostidagi 106 route dinamik, standart qiymat 0, ya'ni sahifadan
  chiqib darhol qaytish har safar to'liq server render'ini qayta
  yugurtirardi.

### 4.11. Render (`e995134`, `345fc27`)

- **`StudentSearchSelect`** har ochilganda BUTUN ro'yxatni DOM'ga
  chizardi. `limit` propi buning uchun allaqachon bor edi (pastida
  "Yana N ta" ham), lekin 19 ta chaqiruvchidan faqat BITTASI uni
  berardi → standart qiymat 50. Qidiruvning O'ZI butun ro'yxat bo'yicha
  ketaveradi. Ikkinchi muammo: `filtered` render tanasida shartsiz
  hisoblanardi — ro'yxat YOPIQ bo'lganda ham.
- **Nazorat davomat** sahifasi ochilishidayoq 6 732 ta `<option>`
  chizardi → endi `mousedown`/`focus` da to'ldiriladi (ikkalasi ham
  ro'yxat ochilishidan oldin ishlaydi, ko'rinish o'zgarmaydi).
- **`ToastProvider`** kontekstga har renderda yangi obyekt literalini
  uzatardi → har bildirishnoma uchun 109 ta `useToast()` chaqiruvchisi
  ikki marta qayta render bo'lardi.
- **Moliya → Hisobotlar** dagi `dailyPoints` O(kun × tranzaksiya) edi:
  bir yillik oraliqda ~8 million solishtirish. Bitta o'tishga aylandi
  (220 ms → 5 ms), ustiga render tanasidagi yettita to'liq yig'indi
  `useMemo` ichiga olindi.

### 4.12. Ma'lumotnoma ro'yxatlari (`e2ee778`)

Filiallar, xonalar, ta'lim yo'nalishlari, tranzaksiya turlari umumiy
keshdan o'tadi ([lib/referenceCache.ts](lib/referenceCache.ts), TTL 60 s),
yozuvdan keyin 8 joyda bekor qilinadi.

> **FAQAT shu to'rttasi.** Qolgan oltitasi tekshirildi va ATAYLAB
> tegilmadi — sabablari kodda yozib qo'yilgan (5.6-bandga qarang).

### 4.13. Nazorat davomati: 91 → 1 so'rov (`7489554`)

`attendance` uchun global route yo'q edi, shu bois
`useNazoratAttendance` har bir guruh uchun alohida so'rov yuborardi —
91 ta guruh, ya'ni uchala Nazorat sahifasi har ochilganda **91 ta HTTP
so'rovi**, har biri o'zining `ensureIndexes()` va Atlas round-trip'i
bilan. Endi [/api/attendance](app/api/attendance/route.ts).

> Kolleksiya hozir BO'SH — bugungi yutuq baytlarda emas, round-trip'da.

---

## 5. Sinab ko'rilgan va RAD ETILGAN yo'llar

> Bu yo'llarga qaytadan vaqt sarflamang — o'lchandi.

### 5.1. Wire-siqish (zstd) — foyda bermadi

```
siqishsiz (hozirgi)    pupils  2359 ms | tx  4030 ms
zstd siqish bilan      pupils  4411 ms | tx  3566 ms
```

Bo'g'iz kenglik emas, **kursor paketlari**. Hujjat SONINI yoki HAJMINI
kamaytirish yordam beradi, siqish esa yo'q.

### 5.2. Hamma ro'yxat endpoint'iga sahifalash

3-bo'limdagi jadval: `groups` 46 KB, `hr_employees` 19 KB, qolganlari
14 KB dan kichik.

### 5.3. `transactions` ga proyeksiya

Hujjat allaqachon ixcham va **hamma maydoni ishlatiladi**.

### 5.4. Ko'p "ketma-ket await" — ko'pchiligi aslida bog'liq

Avtomatik qidiruv 11 ta nomzod topdi, qo'lda tekshirilganda faqat 3 tasi
mustaqil chiqdi. Keyinchalik `getCurrentUser` da yana ikkitasi topildi
(4.7-band) — u avtomatik qidiruvga tushmagan edi, chunki `/api/*` yo'lida
`accessForSession` keshi bor va muammo faqat SAHIFA render'ida ko'rinadi.

### 5.5. JS to'plamini "umumiy" optimallashtirish

`recharts` va `lucide-react` allaqachon Next'ning `optimizePackageImports`
ro'yxatida — ularni `next.config.ts` ga qo'shish hech nima bermaydi.
Muammo barrel tree-shaking emas, **route darajasidagi kod bo'linishi**
edi (4.10-band). `mongodb` ham allaqachon `serverExternalPackages` da.

### 5.6. Qolgan ma'lumotnoma ro'yxatlarini keshlash

Uchtasi tekshirildi va ATAYLAB keshlanmadi:

- **`/api/groups`** — javobdagi `highlighted` SO'ROV PAYTIDA hisoblanadi:
  bugungi hafta kuni + `attendance` kolleksiyasi. Ya'ni uni butunlay
  boshqa kolleksiyaga yozuv (davomat belgilash) va yarim tunning o'tishi
  eskirtiradi. "Davomat belgila → guruhlar ro'yxatiga qayt → qator hali
  ham sariq" — kunlik va eng ko'p takrorlanadigan yo'l.
- **`/api/teachers`, `/api/moderators`, `/api/hr-employees`** — bitta
  `hr_employees` ning uchta ko'rinishi, ustiga ikkita ekran sonlarni
  undan JONLI qayta sanaydi (xodimlardagi "Guruhlar" ustuni, oylik
  foizlaridagi daraja sonlari). Ikkalasida ham kod izohi bor: bu sonlar
  ilgari muzlab qolgan maydondan o'qilardi va ATAYLAB jonli hisobga
  o'tkazilgan. Keshlash o'sha xatoni qaytarardi.
- **`/api/settings-lists`** — `kind` filtr emas, u 15 ta har xil
  kolleksiyadan birini tanlaydi; ustiga to'lov usullari birinchi o'qishda
  seed bo'ladi va seed'dan oldingi javob `{ok:true, items:[]}`, ya'ni
  "xato bo'lsa keshlama" qoidasi bu teshikni yopmaydi.

### 5.7. `Cache-Control` sarlavhalarini ommaviy qo'shish

Dastlab yaxshi g'oya bo'lib ko'rindi (76 ta GET route'dan faqat bittasida
bor). Lekin brauzer HTTP keshini JS'dan BEKOR QILIB BO'LMAYDI — ya'ni u
5.6-banddagi aynan o'sha muammolarni oladi, ustiga yechimsiz. Faqat
haqiqatan statik ro'yxatlarga arziydi, ular esa allaqachon klient keshida.

---

## 6. Qolgan ish

### 6.1. Atlas regioni — O'LCHANDI, qaror kutilmoqda

Klaster **AWS / Singapur (ap-southeast-1)**, foydalanuvchilar O'zbekistonda.

`node scripts/_region-latency.mjs` — sof TCP ulanish vaqti, har region
uchun 6 o'lchov, eng tezi:

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
`scripts/_db-perf.mjs` dagi mustaqil Atlas o'lchovi (145–154 ms) bilan mos.

**Kutilmagan natija:** Dubay va Mumbay geografik jihatdan yaqinroq bo'lsa
ham SEKINROQ — masofa emas, marshrut hal qiladi.

**Tavsiya — Frankfurt (`eu-central-1`):** har round-trip 28% qisqaradi,
kodga umuman tegmasdan. Stokgolm yana 16 ms tezroq, lekin M0 tarifida yo'q.

**Diqqat:** regionni joyida o'zgartirib bo'lmaydi. Yangi klaster yaratib,
ma'lumotni ko'chirish kerak: `scripts/_backup-db.mjs` → yangi klaster →
`scripts/_restore-db.mjs`, keyin `MONGODB_URI` almashtiriladi.

**Vercel tomoni:** ulangan akkauntda birorta proyekt yo'q — sayt
Vercel'da joylashmagan. Sayt qayerda ishlayotgani aniqlangach, o'sha
yerning regioni ham klasterga yaqin bo'lishi kerak.

> Bu bandning ta'siri boshqa hamma ishdan KENGROQ: u har bir so'rovga
> ta'sir qiladi. Yuqoridagi server o'lchovlarining ko'pi 150 ms lik
> round-trip'ni o'z ichiga oladi.

### 6.2. Xodim profili — 6.5 MB (eng katta qolgan joy)

`components/employees/EmployeeProfilePage.tsx:249`
`/api/transaction-entries?moderator=<ism>&txType=payIn` ni LIMITSIZ
chaqiradi. Bazada 3 ta moderator bor va bittasida **14 842** ta to'lov
yozuvi: profilni ochish **6 493 KB / 5 695 ms**.

**Nega hali tuzatilmagan:** oddiy sahifalash yetmaydi. `studentPayments`
uchta joyda ishlatiladi va ikkitasiga BUTUN ro'yxat kerak:
- `unfinished` — bekor qilingan/kutilayotgan yozuvlar ro'yxati;
- `KpiTab` — yig'indilar;
- `studentOptions` — takrorlanmas ismlar.

Ya'ni to'g'ri yechim — sahifadagi ma'lumot oqimini qayta loyihalash:
KPI uchun aggregation, jadval uchun sahifalash, ismlar uchun `distinct`
(oxirgisi `transaction-entries/students` da allaqachon bor). Bu — alohida
ish, va uni tekshirish uchun tizimga kirish kerak.

### 6.3. Server tomonda ma'lumot yuklash (arxitektura)

`(app)` ostidagi 106 route — bu ikki qatorli server o'rovchilar, ichida
bitta katta `"use client"` komponent. Klientda **303 ta** `/api` chaqiruvi
bor, serverda esa bazani o'qiydigan atigi **bitta** sahifa
(`student-edit/[id]`). Ya'ni har navigatsiyada qat'iy shalola:
HTML/RSC → route chunk'i → gidratatsiya → `useEffect` → `/api/...` → render.

Eng oson boshlanish nuqtasi — sof hisobot sahifalari (`reports-unpaid`,
`reports-discounts`, `reports-diff-payments`, `reports-cancelled`,
`reports-cancelled-attend`): ular `ReportTablePage` ustidagi o'rovchilar,
o'z interaktivligi yo'q, ya'ni `"use client"` ni butunlay tashlab,
ma'lumotni server sahifasida olish mumkin.

### 6.4. `cacheComponents` (arxitektura)

`use cache` / `cacheLife` / `cacheTag` ni ochadi, ya'ni ma'lumotnoma
so'rovlarini HTTP sarlavhasiz, Atlas so'rovini ham olib tashlab keshlash
mumkin bo'ladi. Lekin u PPR'ni yoqadi va navigatsiyani React `<Activity>`
ga o'tkazadi — bu loyihadagi ko'p modalning unmount semantikasini
o'zgartiradi. **Flag emas, loyiha.**

---

## 6.5. Atlas M0 — ULANISHLAR CHEGARASI (bir marta kuydirgan)

Klaster bepul **M0** tarifida, unda jami **500 ta ulanish** chegarasi bor.

Bir marta shunday bo'ldi: o'lchov va tekshiruv skriptlari ketma-ket
yugurtirildi, har biri o'z `MongoClient` ini ochdi, drayverning standart
`maxPoolSize` qiymati esa **100**. Chegara to'ldi va Atlas yangi
ulanishlarni rad eta boshladi — tashqaridan bu "backend butunlay
ishlamayapti" bo'lib ko'rinadi, Atlas esa pochtaga ogohlantirish yuboradi
("connections to your cluster(s) have exceeded your threshold").

**Belgilari:** sahifalar ochilmaydi yoki bo'sh keladi; skriptlar
`MongoServerSelectionError` bilan yiqiladi; Atlas'dan ogohlantirish xati.

**Darhol tuzatish:** ilovani va barcha skriptlarni to'xtatish — ulanishlar
bo'shagach hammasi o'z-o'zidan tiklanadi. Tekshirish:

```js
const st = await db.admin().serverStatus();
console.log(st.connections.current, st.connections.available);
```

**Oldini olish (bajarildi):**
- [lib/mongodb.ts](lib/mongodb.ts) — `maxPoolSize: 20`, `minPoolSize: 0`,
  `maxIdleTimeMS: 60_000`. 20 ta ulanish bu yuk uchun yetarli: har so'rov
  ~150 ms, ya'ni sekundiga ~130 amal.
- `scripts/` dagi **42 ta** skript — `maxPoolSize: 5`. Ular bir martalik,
  katta pool kerak emas.

> **Qoida:** yangi skript yozganda `new MongoClient(uri, { maxPoolSize: 5 })`
> deb yozing va oxirida `await client.close()` ni unutmang. Bir vaqtda
> ko'p skriptni yugurtirmang.

---

## 7. O'lchov va tekshiruv skriptlari

| Skript | Nima qiladi |
|---|---|
| `scripts/_collection-sizes.mjs` | qaysi to'plam og'ir |
| `scripts/_db-perf.mjs` | RTT, ulanish, o'qish vaqtlari |
| `scripts/_time-indexes.mjs` | `ensureIndexes()` narxi |
| `scripts/_region-latency.mjs` | AWS regionlarigacha RTT |
| `scripts/_verify-revenue.mjs` | tushum raqamlari o'zgarmaganini tekshiradi |
| `scripts/_verify-cashbox.mjs` | kassa raqamlari o'zgarmaganini tekshiradi |
| `scripts/_verify-aggregations.mjs` | sales-plans / balances / pupilsDb |
| `scripts/_verify-served.mjs` | "Xizmat ko'rsatilgan" hisoboti |
| `scripts/_verify-finance-reports.mjs` | totals va kunlik grafik |

> **Moliyaviy o'zgarish qilsangiz — shu tekshiruvlarni yugurtiring.**
> Ular eski va yangi mantiqni haqiqiy baza ustida yonma-yon hisoblab
> solishtiradi. Oxirgi yurish: hammasi MOS, jumladan umumiy balans
> yig'indisi 31 347 449 002 va 2025-12 tushumi 27 357 414 000.

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

---

## 8. Tekshirilmagan joy (halol ta'rif)

Yuqoridagi ishlarning hammasi `npx tsc --noEmit`, `npx eslint` va
`npm run build` dan o'tdi; moliyaviy hisoblar haqiqiy baza ustida
skriptlar bilan solishtirildi; API route'lar dev serverda 401 qaytarishi
(ya'ni ro'yxatga tushgani va 500 bermasligi) tekshirildi.

**Lekin tizimga KIRIB, sahifalar ko'z bilan ko'rilmagan.** Ayniqsa
quyidagilarga bir marta qarab chiqilsa foydali:

- o'quvchi tanlash oynasi (endi 50 tadan ko'rsatadi + "Yana N ta");
- Nazorat → Davomat ko'rish sahifasidagi o'quvchi tanlagichi;
- Moliya → Hisobotlardagi donut diagrammalar (recharts endi kechroq
  yuklanadi);
- har qanday "Excel" tugmasi (xlsx endi bosilganda yuklanadi);
- Hisobotlar → "Xizmat ko'rsatilgan" (sana oralig'i endi serverga boradi).
