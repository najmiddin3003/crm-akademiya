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

### 4.14. Kassalar jadvali: 8.10 MB → 22.2 KB

[/finance-cash](components/finance/CashboxesPage.tsx) sana oralig'i
tozalanganda BUTUN kassani tortardi — kassa 4 uchun **18 597 qator,
8.10 MB**. Sahifalash ham, beshta filtr ham brauzerda edi: "O'quvchini
qidiring" katagiga har harf yozilganda 18 597 obyekt qayta filtrlanardi.

| | eski | yangi |
|---|---|---|
| Javob hajmi | 8.10 MB | **22.2 KB** (373×) |
| Bazada o'qilgan hujjat | 18 597 | **50** |
| Indeks | `id_1` teskari, 5 079 hujjat / 50 qator | `{cashboxId, id}`, 50 / 50 |

Uch narsa to'liq ro'yxatga tayanardi va ularning har biri alohida
hal qilindi:

- **Yuqoridagi Kirim/Chiqim** — endi `?withTotals=1` aggregatsiyasidan,
  butun filtr bo'yicha. Qatorlar soni ham SHU YERDAN: aks holda aynan
  bir xil filtr bo'yicha `countDocuments()` ikkinchi marta yurardi.
- **Beshta filtr** — serverga ko'chdi. Yangi parametrlar: `txName`,
  `paymentType`, `studentLike`, `teacherLike`. Oxirgi ikkisi ATAYLAB
  alohida nomda — mavjud `?studentName=` anchor'li (`^…$`), jadval
  filtri esa ICHIDAN qidiradi. Ularni aralashtirish §6.2 dagi tuzoqni
  takrorlardi.
- **Eksport** — bosilganda to'liq ro'yxatni o'zi tortadi. Kamdan-kam va
  ataylab qilinadigan amal, og'ir so'rov o'sha yerda o'rinli.

Yo'l-yo'lakay topilgan **regressiya**: filtr TANLOVLARI (`txNameOptions`,
`teacherOptions`, `studentOptions`) `entries` dan yig'ilardi. 50 qatorda
ular qisqarib qolardi — kassa 4 da katalogda yo'q 5 ta tranzaksiya nomi
va 51 ta o'qituvchi ro'yxatdan tushib ketardi. Yangi
[/api/transaction-entries/facets](app/api/transaction-entries/facets/route.ts)
ularni `distinct` bilan qaytaradi, kassa almashgandagina (64 KB).

**Tekshirish** — uch bosqichda, hammasi jonli baza bo'yicha:

1. 28 ta filtr kombinatsiyasi: eski (hammasini tortib, klientda filtrlash)
   va yangi (Mongo filtri + aggregatsiya) — son, kirim, chiqim va
   1-sahifadagi 50 qatorning ID lari **aynan mos**.
2. Route handler'ning O'ZI chaqirildi (`next/server` va `mongodb` stub
   bilan): 18 ta tasdiq — sahifalar kesishmasligi, oxirgi sahifa,
   regex belgilari literal, eski chaqiruvchilar buzilmagani.
3. `.toLowerCase().includes()` va Mongo `$options:"i"` ekvivalentligi —
   239 ta qidiruv so'zi (apostrof, kirill, aralash registr): farq **0**.

> Bu §5.2 ni INKOR ETMAYDI. U yerda rad etilgani — `groups` (46 KB) kabi
> KICHIK ro'yxatlar. Bu jadval 8.10 MB, ya'ni boshqa toifadagi masala.

---

### 4.15. Moliya analitikasi: oxirgi ikkita sahifa

§4.7 da beshta analitika sahifasidan uchtasi `/api/transactions/summary`
ga o'tkazilgan edi. Qolgan ikkitasi ham tugadi — endi **hech bir sahifa
butun `transactions` kolleksiyasini tortmaydi**.

**[/finance-analytics](components/finance/FinancialAnalyticsPage.tsx)** —
ota komponent 21 921 qatorni (3.03 MB) bir marta yuklab, uchala tabga
uzatardi. Endi har biri o'ziga kerakli kesimni so'raydi:

| | |
|---|---|
| chap panel (`groupBy=method`) | 0.3 KB |
| Kalendar tabi (`day,sign` + `before`) | 2.9 KB |
| Pul oqimi (`month,sign` + `category,sign`) | 2.5 KB |
| Journal (50 qator, sahifalangan) | 7.1 KB |
| **Sahifa ochilganda** | **3.3 KB — 953×** |
| Uchala tab ham ochilsa | 12.8 KB — 242× |

**[/finance-reports](components/finance/FinanceReportsPage.tsx)** — to'rtta
so'rov, chunki ular boshqa-boshqa kesimlar: `day,sign` (grafik va
kartalar), `category,sign`, `method,sign`, va oldingi davr uchun
`sign`. **3.03 MB → 4.3 KB (722×)**; butun tarix tanlansa ham 37 KB (84×).

Journal tabi uchun `/api/transactions` ga sahifalash qo'shildi
(`?from/to/page/limit/sort=desc`) va `{date, id}` indeksi — bitta
`date` indeksi bir kun ichidagi `id` tiebreak'ini qoplamasdi.

**Nozik joylar** — ikkalasi ham summary route'idagi qoidalar tufayli
to'g'ri chiqdi:

- **Nol turlicha talqin qilinadi.** Kalendar tabi nolni KIRIMGA qo'shadi
  (`t.amount >= 0`), Pul oqimi esa ikkalasidan ham chiqarib tashlaydi
  (`> 0` va `< 0`). Ishora uch qiymatli bo'lgani uchun ikkalasi ham
  o'z qoidasini saqlab qoldi.
- **Kategoriya taqsimoti BUTUN TARIX bo'yicha**, 12 oy bo'yicha emas —
  eski kodda ham shunday edi. Shu bois Pul oqimi tabi ikkita alohida
  so'rov yuboradi; bittaga qo'shilsa ko'rinadigan raqamlar o'zgarardi.

**Tekshirish** — jonli baza bo'yicha, eski va yangi mantiq yonma-yon:

1. `/finance-analytics`: umumiy qoldiq, 8 ta to'lov usuli, 4 ta oy uchun
   kalendar (123 kun), 12 oylik pul oqimi, 21 ta kategoriya, Journal
   sahifalash va tartibi — **xato 0**.
2. `/finance-reports`: 15 ta holat (sana oralig'i × kassa × to'lov
   usuli), har birida kartalar, kunlik grafik, ikkala taqsimot va
   oldingi davr — **xato 0**.
3. Parametrsiz `/api/transactions` chaqiruvi avvalgidek — to'liq ro'yxat,
   o'sish tartibida.

Yo'l-yo'lakay **ikkita float artefakti** tuzaldi (`$toDecimal` tufayli):
naqd qoldiq `43 743 210.899999976` → `43 743 210.9`, va 2026-mart oyi
oldidagi qoldiq `-0.0000000298` → **aniq `0`**. Ikkinchisi zanjir
bo'ylab keyingi oylarga tarqalardi.

> Natijada [lib/transactionsClient.ts](lib/transactionsClient.ts) —
> butun kolleksiyani keshlaydigan qatlam — **o'lik kodga aylandi**.
> To'qqiz joy hali `invalidateTransactions()` ni chaqiradi, lekin
> o'sha keshni endi hech kim o'qimaydi. Zararsiz, alohida tozalanadi.

---

### 4.16. `/api/pupils` — so'ralgan maydonlargina

`pupils` 6 732 hujjat, javob 2.66 MB edi va u **13 ta sahifaga bir xil**
ketardi. Tekshirganda ma'lum bo'ldiki, 13 tadan **9 tasi** qo'shimcha
maydonlarning birortasini ham o'qimaydi.

Undan ham qizig'i — hujjatdagi **33 maydondan 19 tasi 6 732 tadan
0 tasida** to'ldirilgan (`fatherName`, `motherPhone`, `source`,
`paymentDate`, `email`, `tags`, `note`, `language` …). Bo'sh bo'lsa
ham joy egallaydi: JSON'da `"fatherName":""` ham baytlar. Faqat oltita
ota-ona maydoni **0.63 MB**.

**Yechim — sahifalash EMAS.** `useStudents` 26 ta joyda chaqiriladi va
ko'pchiligiga to'liq ro'yxat kerak (ism→id xaritalari, qidiruvli
tanlovlar). Buning o'rniga so'rov aniqlashtirildi:

```
GET /api/pupils              -> asosiy 13 maydon
GET /api/pupils?extra=a,b    -> ustiga qo'shimcha (OQ RO'YXAT)
GET /api/pupils?status=Aktiv -> holat bo'yicha SERVER filtri
GET /api/pupils?light=1      -> 4 maydon (o'zgarmagan)
```

| Sahifa | Eski | Yangi |
|---|---|---|
| Qolgan 9 ta sahifa | 2.66 MB | **1.64 MB** |
| Aktiv o'quvchilar (4 276 qator) | 2.66 MB | **1.08 MB** |
| Arxiv o'quvchilar (2 456 qator) | 2.66 MB | **0.63 MB** |
| Tug'ilgan kunlar | 2.66 MB | 1.74 MB |
| O'quvchilar manzillari | 2.66 MB | 1.83 MB |
| Ota-onalar | 2.66 MB | 2.37 MB |

**Turlar orqali xavfsizlik.** `useStudents` endi generik:

```ts
const { pupils } = useStudents({ extra: ["birthDate"] as const });
pupils[0].birthDate   // OK
pupils[0].address     // kompilyatsiya XATOSI — so'ralmagan
```

Ya'ni so'ralmagan maydon `undefined` bo'lib jimgina ekranga chiqmaydi.
Aynan shu `tsc` matnli auditim **o'tkazib yuborgan** bitta joyni topdi:
[OrderDetailPage](components/orders/OrderDetailPage.tsx) `birthDate` ni
`PupilsContext` orqali o'qir ekan.

Kesh kaliti so'rovning HAMMA qismini o'z ichiga oladi — aks holda
`?extra=birthDate` so'ragan sahifa qo'shimchasiz keshga tushib qolardi.

**Tekshirildi** (jonli baza, route handler'ning o'zi chaqirilib): 18 ta
tasdiq — standart javobda aynan 13 maydon, har bir `extra` to'plami,
`?extra=studentPasswordHash` → 400, `?status=` natijasi eski klient
filtri bilan **aynan bir xil id ro'yxati** (4 276 va 2 456).

> **OCHIQ SAVOL.** `lib/parentsData.ts:92` qatorni faqat
> `father.name || father.phone` bo'lganda qo'shadi. Bu maydonlar
> 6 732 tadan **0 tasida** to'ldirilgan, ya'ni **Ota-onalar sahifasi
> bugun bo'sh jadval ko'rsatadi** va buning uchun 2.37 MB yuklaydi.
> `SmsModal` ham shu telefonlardan o'qiydi. Funksiya tashlab
> yuborilganmi yoki kiritish buzuqmi — hal qilinmagan.

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

### 6.1. Region — TUZATILDI va o'lchov bilan tasdiqlandi

> **Diqqat: bu bandning oldingi tahriri NOTO'G'RI edi.** Unda "sayt
> Vercel'da joylashmagan" deb yozilgan, chunki tekshiruv ulangan
> akkauntga qaragan va u yerda proyekt yo'q edi. Aslida sayt boshqa
> akkaunt ostida ishlab turgan. Undan ham muhimi — o'sha tahrir
> NOTO'G'RI MASOFANI o'lchagan.

**Ishlab turgan sayt:**

| | |
|---|---|
| Vercel proyekti | `crm-akademiya` |
| Akkaunt | `Najmiddin's projects` (hobby) |
| GitHub | `najmiddin3003/crm-akademiya` |
| Domenlar | **`tizimli24.uz`**, `www.tizimli24.uz`, `crm-akademiya-777777.vercel.app` |

**Zanjir (o'lchandi, 2026-08-31):**

```
Foydalanuvchi (O'zbekiston)
      ▼  edge — hkg1 (Gonkong), foydalanuvchiga yaqin
Serverless funksiya — iad1 (AQSh, VIRJINIYA)
      ▼  ~215 ms HAR BIR baza amaliga
MongoDB Atlas — SINGAPUR
```

**Bu qanday o'lchandi:** `/api/auth/verify-token` ikki xil chaqirildi —
bo'sh token bilan (funksiya bazaga bormay 400 qaytaradi) va yaroqsiz token
bilan (bazaga bitta so'rov ketadi). Farq = bitta baza amalining narxi.
Natija: 386 ms → 604 ms, ya'ni **~215 ms**. Region esa `x-vercel-id`
sarlavhasidan (`hkg1::iad1::...`).

**Eski tahrirdagi xato:** u O'zbekistondan regionlargacha bo'lgan masofani
o'lchagan va shunga qarab Frankfurtni tavsiya qilgan. Lekin foydalanuvchi
bazaga TO'G'RIDAN-TO'G'RI ulanmaydi — hal qiluvchi masofa **server ↔ baza**.

**Nima qilindi:** `vercel.json` ga funksiya regioni qo'shildi —

```json
{ "regions": ["sin1"] }
```

Funksiya bazaning yoniga (Singapur) ko'chadi, ya'ni har bir baza amali
~215 ms dan bir region ichidagi masofaga tushadi. Bazaga umuman tegilmadi
va bir tiyin ham sarflanmaydi.

**Nega aynan shunday — uchta variant solishtirildi:**

| | Server ↔ Baza | Foydalanuvchi → Server | Narxi |
|---|---|---|---|
| Ilgari (Virjiniya + Singapur) | **215 ms** (o'lchangan) | ~80 ms | — |
| **Server → Singapur** (qilindi) | bir region ichi | 147 ms | bepul |
| Server → Frankfurt, baza Singapurda | ~160 ms (taxmin) | 106 ms | bepul, lekin deyarli foydasiz |
| Ikkalasi → Frankfurt | bir region ichi | 106 ms | baza ko'chirish kerak |

**Xulosa: foyda "Frankfurt"dan emas, YONMA-YON qo'yishdan keladi.**
Serverni Frankfurtga olib bazani Singapurda qoldirish 215 → ~160 ms, ya'ni
deyarli hech nima. Ikkalasini Frankfurtga ko'chirish esa Singapur
variantiga nisbatan yana ~41 ms beradi — bu faqat foydalanuvchi hopida,
har so'rovga bir marta.

**Ta'sirining kattaligi.** `getCurrentUser` har sahifa render'ida ishlaydi
va 3 ta ketma-ket baza so'rovi qiladi:

| | Har sahifadagi auth narxi |
|---|---|
| Boshida (5 so'rov × 215 ms) | ~1 075 ms |
| 4.7-banddan keyin (3 × 215) | ~645 ms |
| **Funksiya baza yonida (3 × ~5)** | **~15 ms** |

Ya'ni bu bitta konfiguratsiya qatori bu hujjatdagi barcha kod
optimizatsiyalaridan ko'ra ko'proq beradi.

**DEPLOY QILINDI VA O'LCHANDI (2026-08-31).** Natija kutilganidan yaxshi:

```
funksiya : sin1 (Singapur)          — x-vercel-id: hkg1::sin1::...
issiq so'rov, bazaga tegadigan : 352 ms
issiq so'rov, bazaga tegmaydigan: 353 ms
--------------------------------------------
BITTA BAZA AMALI               : ~0 ms
```

Ya'ni **215 ms dan o'lchab bo'lmaydigan darajaga** tushdi. Qolgan ~350 ms —
o'lchayotgan kompyuterdan Gonkong edge'igacha bo'lgan masofa, saytning
narxi emas.

Yo'l-yo'lakay: bazaga tegmaydigan so'rov ham 505 → 346 ms ga tushdi,
chunki funksiya endi edge'ga yaqinroq.

> **Diqqat — o'lchaganda ADASHMANG.** Birinchi o'lchovda "146 ms" chiqqan
> edi va bu chalg'ituvchi: u SOVUQ START narxi edi. Vercel funksiyasi
> nolga tushadi, yangi nusxa esa Mongo ulanishini noldan ochadi (TCP +
> TLS + autentifikatsiya). Ketma-ket 12 ta so'rov yuborilganda 1-si
> 1 470 ms, qolganlari ~360 ms bo'ldi. Shuning uchun o'lchashdan oldin
> bir necha so'rov bilan isitish shart.

**Endi nima qoldi:** sovuq start. Kam trafikli sahifada birinchi so'rov
~1.1 soniya qo'shimcha to'laydi — bu region emas, serverless tabiati.


**Deploy'dan keyin TEKSHIRING** — taxmin qolmasin:

```bash
node scripts/_where-deployed.mjs
```

`x-vercel-id` da `sin1` chiqishi va bitta baza amalining narxi 215 ms dan
tushgani ko'rinadi.

**Keyingi qadam (ixtiyoriy):** M10 ga o'tishda ikkalasini Frankfurtga
ko'chirish — qo'shimcha ~41 ms. Baza ko'chirish yo'li: `_backup-db.mjs` →
yangi klaster → `_restore-db.mjs`, keyin `MONGODB_URI` va `vercel.json`
dagi region `fra1` ga almashtiriladi.

**Yo'l-yo'lakay topildi:** `APP_BASE_URL` hamon
`https://crm-akademiya-777777.vercel.app` ga qarab turibdi, haqiqiy domen
esa `tizimli24.uz`. Bu qiymat SMS orqali yuboriladigan faollashtirish
havolasini yasaydi (lib/invite.ts). Hozir ishlaydi, lekin o'sha vercel.app
aliasi olib tashlansa havolalar buziladi — Vercel muhit o'zgaruvchisida
`https://tizimli24.uz` ga almashtirilsa to'g'ri bo'ladi.


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

### 6.5. Atlas M0 — ULANISHLAR CHEGARASI (bir marta kuydirgan)

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
| `scripts/_region-latency.mjs` | AWS regionlarigacha RTT (foydalanuvchidan) |
| `scripts/_baseline.mjs` | **bazaviy o'lchov** — 8-bo'limga qarang |
| `scripts/_where-deployed.mjs` | sayt qaysi regionda ishlayapti + server↔baza masofasi |
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

## 8. BAZAVIY O'LCHOV — taqqoslash nuqtasi

> "Sayt tezlashdimi?" degan savolga faqat TAQQOSLASH javob beradi.
> Quyidagi skript bir xil sharoitda bir xil narsalarni o'lchaydi, ya'ni
> natijalarni yonma-yon qo'yish mumkin.

```bash
node scripts/_baseline.mjs
```

### O'lchov: 2026-08-31 (barcha ishlar deploy qilingandan keyin)

```
[1] PRODUCTION — region va server<->baza masofasi
  edge                : hkg1 (Gonkong)
  FUNKSIYA            : sin1 (Singapur)
  sovuq so'rov        : 1203 ms
  issiq, bazasiz      :  339 ms
  issiq, baza bilan   :  347 ms
  BAZA AMALI          :    8 ms      <- ilgari 215-224 ms

[2] BAZA — hajm
  hujjatlar           : 54 511
  ma'lumot + indeks   : 28.4 MB      <- M0 chegarasi 512 MB
  transaction_entries : 25 567
  pupils              :  6 732
  transactions        : 21 921
  groups              :     91
  attendance          :      0

[3] BAZA — og'ir o'qishlar (o'lchagan kompyuterdan)
  pupils (ro'yxat rejimi)   1828 ms   2727 KB
  pupils (light)             506 ms    544 KB
  transactions              1744 ms   3805 KB
  balanslar (aggregation)    394 ms    148 KB
```

### Qanday taqqoslash kerak — uchta tuzoq

1. **SOVUQ START.** Vercel funksiyasi nolga tushadi, yangi nusxa Mongo
   ulanishini noldan ochadi. Isitmasdan o'lchasangiz son bir necha
   barobar katta chiqadi. Skript o'zi isitadi — lekin qo'lda o'lchasangiz
   buni unutmang. Bugungi misol: birinchi so'rov 1 203 ms, keyingilari
   ~340 ms.
2. **QAYERDAN O'LCHAYAPSIZ.** [1] va [3] bo'limlari o'lchayotgan
   kompyuterning internetiga bog'liq. Taqqoslaganda bir xil joydan
   o'lchang, aks holda o'z uyingiz bilan ofisingizni solishtirasiz.
3. **[3] — SERVERDAN EMAS, sizning mashinangizdan.** Production'da
   funksiya baza bilan bir regionda, ya'ni u yerdagi haqiqiy raqamlar
   bundan ancha kichik. Bu bo'lim absolyut tezlik emas, O'SISHNI
   kuzatish uchun: hujjatlar ko'paygani sari bu sonlar ham o'sadi.

### Kirgandan keyingi sahifalar

Bu skript tizimga kirmaydi, shuning uchun eng og'ir sahifalar unda yo'q.
Ularni brauzer konsolida (tizimga kirgan holda) o'lchang:

```js
const urls = ["/api/pupils", "/api/pupils?light=1", "/api/transactions",
              "/api/students/balances", "/api/groups"];
for (const u of urls) {
  await fetch(u);                                   // isitish
  const t0 = performance.now();
  const b = await (await fetch(u, { cache: "no-store" })).arrayBuffer();
  console.log(u, Math.round(b.byteLength / 1024) + " KB",
                 Math.round(performance.now() - t0) + " ms");
}
```

Natijani shu jadvalga yozib boring:

| Sana | `/api/pupils` | `?light=1` | `/api/transactions` | `balances` | `/api/groups` |
|---|---|---|---|---|---|
| 2026-08-31 | _to'ldiring_ | _to'ldiring_ | _to'ldiring_ | _to'ldiring_ | _to'ldiring_ |

### 08-28 dagi holat — NEGA raqam yo'q

Bu hujjatdagi barcha ishlar 08-29 dan boshlangan (`826cd7f`). Undan
oldingi holat o'lchanmagan va endi qaytarib bo'lmaydi, shuning uchun
"necha barobar tezlashdi" degan savolga ANIQ javob yo'q — faqat
bo'laklardan yig'ilgan taxmin bor:

| | 08-28 | hozir |
|---|---|---|
| har bir baza amali | 215–224 ms | ~0–8 ms |
| sovuq start (indeks tekshiruvi) | +3 636 ms | +152 ms |
| auth, har sahifa render'ida | ~1 075 ms | ~0 ms |
| navbar, har sahifada | 3 654 KB | 0 KB |
| `/finance-transactions` | ~15.2 MB | 293 KB |
| `/finance-cash` | ~15.2 MB | 572 KB |
| boshlang'ich JS (moliya) | +752 KB | 0 |

Bo'laklar o'lchangan, yig'indi esa taxminiy: og'ir sahifalarda ~10–15
barobar, yengillarida ~3–5. **Shu sabab bu bo'lim bor** — keyingi safar
taxmin qilish shart bo'lmasin.

---

## 9. Tekshirilmagan joy (halol ta'rif)

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
