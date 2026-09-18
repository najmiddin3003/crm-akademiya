# CRM Akademiya

`akademiya.edutizim.uz` referens saytining Next.js 16 (App Router) ustidagi nusxasi.
Ma'lumotlar MongoDB'da, har bo'lim uchun `app/api/*/route.ts` orqali.

## Ishga tushirish

```bash
npm run dev
```

`.env.local` da kerak: `MONGODB_URI`, `MONGODB_DB` (standart — `crm_akademiya`).

Kolleksiya indekslari `lib/mongodb.ts` dagi `ensureIndexes()` da bir marta
yaratiladi.

**Prod'ni o'z VPS'ga joylash** (pm2 + Nginx, reliz papkalari, cron,
Vercel'dan ko'chish tartibi) — [deploy/README.md](deploy/README.md).

**Demo seed YO'Q.** Ilgari har bir `app/api/*/route.ts` "kolleksiya bo'sh
bo'lsa demo bilan to'ldir" qilardi — bu olib tashlandi. Har bir ro'yxat bo'sh
holatdan boshlanadi. Test uchun `scripts/seed-test-*.js` skriptlari bor
(o'quvchilar, o'qituvchilar, guruhlar, moderatorlar).

## Keyinchalik qilinadigan ishlar

### Buyurtma MANBASI qayerdan kelishi (2026-08-22)

Buyurtmalar ro'yxatidagi **Manba** filtrida referens saytda quyidagi qiymatlar
turadi: `bot`, `interface`, `kommo`, `survey`, `tilda`.

Bular hech qaysi sozlamalar sahifasidan boshqarilmaydi — lid qaysi KANALDAN
tushganini bildiradi (Telegram bot, CRM interfeysi, Kommo integratsiyasi,
so'rovnoma, Tilda sayti). Ya'ni ular tashqi integratsiyalar bilan birga
keladi.

Hozircha `lib/ordersData.ts` dagi `ORDER_SOURCES` da QO'LDA yozib qo'yilgan.
Integratsiyalar ulanganda bu ro'yxat o'sha manbadan (yoki sozlamalar
ro'yxatidan) olinishi kerak.

Xuddi shunday hali bo'sh: **Ichki manba** va **So'rovnoma** filtrlari —
referensda ham ular bo'sh (ma'lumot manbai yo'q).

---

# Qolgan ishlar — umumiy ro'yxat

`akademiya.edutizim.uz`ning sidebar submenyularini (har bo'limni hover qilib) va Sozlamalar
tablarini local bilan solishtirib chiqilgan holat (2026-08-04). `constants/sidebar.js`dagi
referensda umuman yo'q ~38 ta "kelajakdagi" band (Moliya/Nazorat/Sotuv/Boshqaruv/Hisobotlar
dashboard'lari va h.k.) bu ro'yxatga kirmagan — ular referensning o'zida yo'q, demak nusxa
oladigan joy yo'q.

## 1. ✅ Butun bir modul yo'q edi — "Blok test" — qilindi (2026-08-07)

Referensda alohida top-level sidebar bo'limi, ichida 2 ta sahifa: **Blok test turlari**
(`/block-test/types`) va **Blok testlar** (`/block-test/exams`). Referens saytdan ichki
tuzilishi (forma maydonlari) hujjatlashtirilib, to'liq qurildi:

- `constants/sidebar.js` — yangi top-level band (`key: "blok-test"`, O'quv bo'limi bilan
  Moliya orasida — referensdagi joyi bilan bir xil)
- `app/(app)/blok-test-turlari/page.tsx` + `components/blockTest/BlockTestTypesPage.tsx` +
  `BlockTestTypeModal.tsx` — Nomi, Turi (Haftalik/Oylik/Choraklik/Sinov (mock)/Mavzu
  bo'yicha/Kirish/Chiqish/Boshqa), Davomiyligi (daqiqa), Fanlar (dinamik ro'yxat: Fan +
  Savollar soni + Har bir to'g'ri javob uchun ball), Faol
- `app/(app)/blok-testlar/page.tsx` + `components/blockTest/BlockTestExamsPage.tsx` +
  `BlockTestExamModal.tsx` — Nomi, Tur (turlardan tanlanadi), Sana, Boshlanish vaqti,
  Guruhlar (ko'p tanlov), Mas'ul xodim, Izoh; Holati sanaga qarab hisoblanadi
  (Rejalashtirilgan/Bugun/Tugagan — rangi Topshiriqlar sahifasining "O'tib
  ketgan/Bugun/Keyinchalik keladigan" ustunlari bilan bir xil: qizil/yashil/ko'k)
- `lib/blockTestTypes.ts`, `lib/blockTestExams.ts`, `constants/blockTest.js`,
  `app/api/block-test-types/*`, `app/api/block-test-exams/*` — MongoDB
  `block_test_types`/`block_test_exams`

> Tekshirilgani: brauzerda qo'shish/ro'yxatlash to'liq sinaldi (turlar, testlar, guruh
> ko'p tanlovi, mas'ul xodim tanlovi). `tsc --noEmit` va `eslint` toza.

## 2. ✅ "O'quvchilar manzillari" — qilindi (2026-08-04)

`O'quvchilar` bo'limida referensda 7-band sifatida bor edi: **O'quvchilar manzillari**
(referens route: `/students/locations`) — to'liq ekranli Leaflet/OpenStreetMap xaritasi,
har bir pin bitta o'quvchi manzili.

Qilingan: `leaflet` + `react-leaflet` o'rnatildi, `app/(app)/student-addresses/page.tsx` +
`components/students/StudentAddressesPage.tsx` (sarlavha, filial filtri) +
`components/students/StudentAddressesMap.tsx` (xarita, `next/dynamic({ ssr:false })` bilan
faqat client'da yuklanadi) + `constants/studentAddresses.js` (140 ta seed manzil, id 9000-9199).

> Tekshirilgani: `tsc --noEmit` va `eslint` toza, route 500'siz compile bo'ldi (login'ga
> 307 redirect — kutilgan holat). Ilova login talab qilgani uchun brauzerda vizual tasdiqlab
> bo'lmadi — birinchi ochganda `/student-addresses`ni ko'rib, xaritada muammo bo'lsa ayting.

## 3. Sozlamalar — 6 ta tab

Batafsil pastda, "Sozlamalar bo'limi — holat va qolgan ishlar" bo'limida. Qisqacha: **Chek**,
**Obuna**, **Ommaviy oferta** (Umumiy sozlamalar) + **So'raladigan bo'limlar**, **Avto sms**,
**Bot eslatmalari** (Sotuv va marketing).

## 4. Qurilmaydi — Gamifikatsiya

Sababi pastda, "Qurilmaydigan" bo'limida — pullik qo'shimcha modul, referens akkauntda
yoqilmagan.

## 5. ✅ Guruh → Jihozlar yo'q edi — qilindi (2026-08-07)

Referensda Guruh submenyusida 6 ta band bor edi (bizda 5 ta — **Jihozlar** yo'q edi, Xonalar
bilan Guruh o'quvchilari orasida). Qo'shildi: `app/(app)/groups-equipments/page.tsx` +
`components/groups/EquipmentListPage.tsx` + `EquipmentModal.tsx` — Jihoz nomi, Inventar kodi
(bo'sh qoldirilsa avtomatik: `INV-0001`), Narxi (dona uchun). `lib/equipment.ts`,
`constants/equipment.js`, `app/api/equipment/*` (MongoDB `equipment`).

## 6. ✅ Sidebar'dagi "Hali tayyor emas" qulflari eskirgan edi — tuzatildi (2026-08-07)

`components/shared/Sidebar.tsx` dagi `IMPLEMENTED_ROUTES` ro'yxati eskirib qolgan edi —
Sotuv va marketing, Hisobotlar, Sozlamalar, Nazorat → Turniket kirish-chiqish/Support
analitikasi kabi allaqachon qurilgan ko'plab sahifalar sidebarda xiraroq va bosilmaydigan
("Hali tayyor emas") ko'rinib turardi. `constants/sidebar.js` dagi har bir href
`app/(app)/` papkasi bilan solishtirilib, ro'yxat to'liq (76 ta) qayta tuzildi, bo'lim
bo'yicha guruhlangan izohlar bilan. Referensda yo'q "kelajakdagi" ~38 stub band hamon
to'g'ri qulflangan qoldi.

## 7. ✅ Diagrammalar haqiqiy kutubxonaga o'tkazildi — recharts (2026-08-07)

`components/ui/DonutChart.tsx` qo'lda SVG (`stroke-dasharray`/`stroke-dashoffset`) bilan
yozilgan edi — hech qanday kutubxonasiz. `recharts` o'rnatildi, komponent uning
`Pie`/`Cell`/`Tooltip`'i asosida qayta yozildi (tashqi interfeys — `slices`/`centerLabel`/
`size`/`showLabels` — o'zgarmadi, shuning uchun barcha 5 ta chaqiruvchi joy — Moliya →
Kirim chiqim, Moliya hisobotlari, Moliya analitikasi, Nazorat → Turniket kirish-chiqish —
avtomatik yangi kutubxonaga o'tdi, boshqa fayl tegilmadi). Yon foyda: bepul hover-tooltip
qo'shildi; bo'sh holat (`total===0`) rangidagi eski xato ham tuzatildi (`stroke="var(--secondary)"`
— bu loyihada CSS o'zgaruvchilar HSL uchlik sifatida saqlanadi, `hsl(var(--secondary))`
shaklida ishlatilishi kerak edi).

> Tekshirilgani: bitta segmentli, bo'sh holat, va 3 segmentli (oralarida bo'shliq bilan)
> holatlar brauzerda vizual sinaldi. `tsc`/`eslint` toza.

## 8. ✅ Boshqaruv → Xodimlar: filtrlar ishlamas edi — tuzatildi (2026-08-07)

`components/employees/EmployeesListPage.tsx`:
- **Holat** (Aktiv/Arxiv) va **Ketish sababi** filtrlari — state bor edi, lekin filtrlash
  mantig'ida ishlatilmagan edi (tanlash hech narsani o'zgartirmasdi). Endi `archReason`
  maydoniga qarab ishlaydi (bo'sh = aktiv, to'ldirilgan = arxiv).
- **Faollik sanasi** / **Ketish sanasi** — oddiy, hech narsaga bog'lanmagan matn maydonlari
  edi. Endi umumiy `components/ui/DateRangePicker.tsx` (kalendar + Bugun/Kecha/Bu hafta va
  h.k. presetlar) — `lastActive`/`archDate` maydonlari bo'yicha haqiqiy oraliq filtri.
- Jadval qatoriga bosish (avval faqat "To'liq nomi" ustuni ishlardi) — endi istalgan
  katakka bosilsa ham xodim profiliga (`/management-xodimlar/:id`) o'tadi.
- Yon ta'sir: `DateRangePicker` to'liq kenglikka cho'zilmas edi (`inline-flex` ota-div
  kontent kengligiga qisilib qolardi) — tuzatildi, boshqa sahifalarda ham to'g'ri ko'rinadi.

> Tekshirilgani: uchala tuzatish ham DOM darajasida (JS orqali, chunki avtomatlashtirilgan
> hover/click koordinatasi bu sessiyada bir necha marta noto'g'ri ishladi) va vizual
> brauzerda sinaldi — Holat filtri 63↔0 orasida to'g'ri almashdi, sana oralig'i tanlansa
> mos ravishda filtrladi, qatorga bosish profilga olib bordi.

## 9. ✅ Xodim qo'shishda faollashtirish SMS'i yo'q edi — ulandi (2026-08-07)

Loyihada mavjud invite/SMS zanjiri (`lib/invite.ts` + `lib/eskiz.ts` — Eskiz.uz'ga haqiqiy
HTTP integratsiya) faqat eski `components/employees/EmployeesPage.tsx` (`employees`/`users`
kolleksiyasi) oqimiga ulangan edi. Boshqaruv → Xodimlar'dagi haqiqiy "Xodim qo'shish"
(`AddEmployeeModal` → `POST /api/hr-employees`, `hr_employees` kolleksiyasi) unga umuman
tegmasdi — ikkala kolleksiya orasida bog'lovchi kalit ham yo'q edi.

Qilingan (`app/api/hr-employees/route.ts` POST):
- Telefon tekshiriladi/normallashtiriladi (`isValidPhone`/`normalizePhone`, `lib/invite.ts`)
- `users` kolleksiyasida shu raqam allaqachon bo'lsa — `409`, hech narsa yaratilmaydi
  (dublikat himoyasi — foydalanuvchi tanlovi bilan)
- `hr_employees` qatori + bog'langan `users` yozuvi yaratiladi (`users.hrEmployeeId` →
  `hr_employees.id`; `employees` kolleksiyasiga alohida yozuv YARATILMAYDI — activate/
  verify-token/resend-invite faqat `users`ga qaraydi, shuning uchun bu farq ularga
  ta'sir qilmaydi), `status: "invited"`
- 72 soatlik faollashtirish tokeni + 6 xonali kod generatsiya qilinadi, SMS yuboriladi
  (`activationMessage` — havola + kod)
- `components/employees/AddEmployeeModal.tsx`: telefon formatiga klient tomon tekshiruv
  qo'shildi (avval umuman yo'q edi), muvaffaqiyat/xatolik toast'i SMS holatiga
  (`smsSent`) qarab ko'rsatiladi

> Tekshirilgani: API darajasida haqiqiy (simulated emas) SMS so'rovi Eskiz'ga jonli
> yuborildi (`smsSent:true, smsSimulated:false`) — foydalanuvchining o'z raqamiga test
> yozuv qo'shib sinaldi (fizik yetib borgani alohida tasdiqlanishi kerak). Dublikat
> raqam bilan qayta urinish `409` qaytardi va qo'shimcha yozuv yaratmadi (63→64→64,
> "Dublikat" qatori paydo bo'lmadi). `tsc`/`eslint` toza.
>
> Ochiq qolgan: `POST /api/hr-employees`da admin-auth yo'q (eski `POST /api/employees`da
> ham xuddi shunday TODO bor) — ataylab tegilmadi, alohida masala.

## 10. ✅ Navbar + Sidebar referens dizayniga o'tkazildi (2026-08-15)

Struktura teskari edi: sidebar to'liq balandlikda chapda turib, logoni o'zida saqlardi,
header esa faqat o'ngdagi joyni egallardi. Referensda **header butun kenglikda tepada**
(56px), logo uning ichida, sidebar header **ostidan** boshlanadi.

O'lchamlar jonli referensdan `getComputedStyle` bilan olingan: sidebar `173px`, element
`44px`/radius `10px`, ikonka `20px` `#3D68FF` (har doim ko'k), badge ikonka ustida,
flyout `220px` va sidebar chetidan `+3px`. Primary `#3D68FF`, border `#DBE0E6`,
shrift **Nunito** (`next/font`).

Navbar ikonkalari referensdagi vazifalarga moslandi: `Yangiliklar`, `Qanday ishlaydi?`
(video qo'llanmalar ro'yxati — `constants/helpTopics.js`), `Tezkor bo'limlar`.

Sidebar flyouti sichqoncha yurgizilganda titrardi — ikkita panel bir vaqtda animatsiya
qilardi. Yechim: 90ms ochilish kechikishi + menyular orasida animatsiyasiz almashish
(`.flyout-instant`).

## 11. ✅ Jadvallar: thead tepada, paginatsiya pastda qotib turadi (2026-08-15)

49 sahifada qo'llandi. CSS zanjiri (`app/globals.css`):

```
.page-frame → .table-frame → .table-scroll → th { position: sticky }
```

Har bo'g'inda `min-height: 0` SHART, aks holda flex element kontentidan kichrayolmaydi
va scroll ichki emas, tashqi (`main`) bo'lib qoladi.

Sticky `<thead>` emas, **`<th>`** — `border-collapse: collapse` bilan `thead` ba'zi
brauzerlarda fon/chegara chizmaydi.

Grid va ikki ustunli sahifalar uchun alohida klasslar: `.page-frame-row` /
`.page-frame-col` (yo'nalishga tegmaydi, faqat balandlik beradi) va `.page-frame-lg` /
`.grid-frame` (ramka faqat desktopda).

Ataylab tegilmagan: `FinanceAnalyticsPage`, `SalesFunnelPage` — bular ro'yxat emas,
dashboarddagi kichik xulosa jadvallari.

## 12. ✅ Davomat moduli — yangi (2026-08-15)

Guruh → Davomat tabi. Ustunlar **qattiq yozilmagan**: guruhning dars kunlaridan
(`group.day`) tanlangan yil+oy ichida hisoblanadi — `"Toq kunlar"` → Du/Ch/Ju.

- 4 holat: Keldi / Birinchi dars / Sababli / Sababsiz (ranglar referensdan)
- 1..5 baho — holatdan mustaqil, menyu ochiq qoladi
- `Sababli` → sabab + izoh oynasi
- `O'rtacha baho` ustuni, o'quvchiga xabar paneli, katakcha o'zgarishlari tarixi

Fayllar: `lib/attendance.ts`, `components/groups/AttendanceTab.tsx`,
`app/api/groups/[id]/attendance/`, `.../notes/`.
Kolleksiyalar: `attendance`, `attendance_history`, `group_notes`.

## 13. ✅ Profil menyusi va sessiyalar (2026-08-15)

Ilgari uchalasi ham `alert()` chiqarardi.

- **Aktiv qurilmalar** — `/settings-devices`, `user_sessions` kolleksiyasi. Sessiya
  cookie'si holatsiz (HMAC), shuning uchun qurilmani uzish uchun alohida ro'yxat
  kerak: cookie'dagi `sid` ro'yxatda bo'lmasa, keyingi sahifada chiqarib yuboriladi.
- **Qulflash** — sessiya saqlanadi, `locked` cookie qo'yiladi, middleware hamma
  sahifani `/lock` ga yo'naltiradi, parol bilan ochiladi.
- **Chiqish** — endi qurilma yozuvini ham o'chiradi.

`sid` yo'q eski cookie'lar amal qilaveradi (hamma birdan chiqib ketmasligi uchun) —
keyingi loginda o'zi to'g'rilanadi.

## 14. ✅ Interfeys tili sana tanlagichlarga ham ta'sir qiladi (2026-08-15)

Sana komponentlari oy/kun nomlarini **inglizcha qattiq yozgan** edi (`January`,
`Su/Mo/Tu`), navbar esa "O'zbekcha"da turardi.

`lib/i18n.ts` (uz/en/ru) + `components/shared/Language.tsx`. Til `localStorage`da,
`useSyncExternalStore` orqali — SSR bilan to'g'ri ishlaydi va effekt ichida
`setState` chaqirishni talab qilmaydi (loyihadagi lint qoidasi buni taqiqlaydi).

---

# Referens bilan solishtirish — davom etayotgan ish

## Sidebar manzillari

Referensning barcha submenyu havolalari yig'ib olingan — 12 bo'lim, ~70 havola.
To'liq jadval loyiha ildizidagi [`reference-urls.md`](./reference-urls.md) da.
Eng kerakli bir nechtasi:

| Referens | Bizda |
|---|---|
| `/home` (BOSH sahifa) | `/groups-schedule` |
| `/orders/order-list/table` | `/orders-list` |
| `/group/groups` | `/groups` |
| `/students/student-list` | `/students-list` |
| `/students/attendance` | `/nazorat-davomat` |
| `/finance/cash` | `/finance-cash` |
| `/hr/employees` | `/management-xodimlar` |

**Manzilni qanday olish kerak.** Referens tabi ba'zan render bo'lmaydi
(`window.innerWidth === 0`) — u holda sichqoncha koordinatalari ishlamaydi. MUI
flyoutini sintetik hodisalar bilan ochish mumkin:

```js
for (const t of ['pointerover','pointerenter','mouseover','mouseenter'])
  el.dispatchEvent(new MouseEvent(t, {bubbles:true, cancelable:true, view:window}));
```

Yopilgan menyular DOM'da qolib ketadi — har bo'lim uchun hoverdan OLDIN va KEYIN
anchor to'plamini olib, **farqini** hisoblash kerak, aks holda ro'yxatlar aralashadi.

## Solishtirilgan bo'limlar (2026-08-16 holati)

Referensning **hamma bo'limi** sahifama-sahifa solishtirildi. Har bir sahifada
ustunlar, filtrlar, tugmalar va jamlanma ko'rsatkichlar tekshirildi.

| Bo'lim | Sahifa | Natija |
|---|---|---|
| Sozlamalar | 31 tab | 23 ta qurilgan edi → **6 tasi qurildi** (29/31). Qolgan 2 tasi — Gamifikatsiya, qurib bo'lmaydi |
| Hisobotlar | 12 | 7 tasi to'liq mos. Sotuv voronkasida **lid holati filtri qo'shildi** (`Hammasi`/`Hozir ishlanayotgan lidlar`/`Yopilganlar`) |
| Moliya | 14 | Hammasi mos. `Voucher` → **`Vaucher`** |
| Nazorat | 9 | Hammasi mos. `Filter` → **`Filtr`** |
| Lidlar | 2 | Kanban topildi va mos chiqdi. `Ketdim` emojisi 😠 → **🤬**, kanban kartasidagi sana ajratgichi olib tashlandi |
| Guruh | 6 | Xonalarda **`Analitika` tabi qo'shildi**, Jihozlarga **sana filtri** va `Qidirish` → `Qidiruv` |
| O'quvchilar | 7 | **Farq yo'q** |
| O'quv bo'limi | 5 | Bo'sh holat emojisi 😞 → **☹️** |
| Boshqaruv | 4 | **Farq yo'q** |
| Blok test | 2 | `Blok testlar` 10/10 mos. Turlar jadvalida `Fanlar` → **`Kurslar`** |
| Topshiriqlar | 1 | **Farq yo'q** — bizniki kengroq (KPI qatori, `Vaqt/Kanban/Kalendar`, `Shablon`) |

Aniq mos chiqqan yirik jadvallar: `Filiallar holati` 17/17, `Turniket analitikasi` 12/12,
`Oylik chiqarish` 10/10, `Shartnoma` 9/9, `O'qituvchilar samaradorligi` (3 guruh × 4 holat,
belgima-belgi), `So'rovnomalar` 6/6, `Vazifalar` 9/9.

### Ataylab qilingan farqlar

Bular kamchilik emas — ma'lumot yo'qligi sababli ongli ravishda qoldirilgan:

- **O'quvchilar ro'yxati** — referensning 6 filtri qo'yilmadi (`Teglar`, `Bloklanganlar`,
  `Oferta`, `Ilova holati`, `Referal`, `Shartnoma`): maydon yo'q.
- **Xabarlar ro'yxati** — `Integratsiyalar` va `SMS qurilmalar` filtrlari qo'yilmadi:
  loyiha bitta shlyuz bilan ishlaydi (`lib/eskiz.ts`), `SMS_DEVICES_SEED` bo'sh
  (referensda ham qurilma sozlanmagan). Izoh `SmsMessagesPage.tsx` boshida.
- **Chek / Ommaviy oferta** — fayl yuklash backend'i yo'q, faqat fayl nomi saqlanadi.
- **Obuna** — `To'lash` haqiqiy to'lov qilmaydi.
- **Xonalar → Analitika** — "Xonalar bo'yicha" jadvali bo'sh: jihozga xona biriktirish
  maydoni **referensda ham** yo'q (uning "Jihoz qo'shish" formasi bizniki bilan bir xil).

### ✅ Ustunlari yashirin sahifalar — hal qilindi

Referens hisobida quyidagi jadvallarda ustunlar **yashirilgan** — ekranda faqat `№`
(yoki `№ + 1 ustun`) ko'rinadi. Ilgari shu sabab solishtirib bo'lmasdi; endi
ustunlarni yoqmasdan o'qish yo'li topildi (pastdagi bo'limga qarang):

`Buyurtmalar ro'yxati` (576 qator, filtrlari ham o'chirilgan) · `Guruh o'quvchilari` (4221) ·
`O'quvchining umumiy to'lanmagani` (118) · `Bekor qilingan to'lovlar` · `Umumiy chegirmalar` ·
`Kurs narxidan farqli to'lovlar` · `Davomati bekor qilinganlar` · `Feedback` ·
`Yangi/Aktiv/Arxiv o'quvchilar` · `Ota-onalar` · `Jihozlar` · `Rollar` · `Yangiliklar` · `Hikoyalar`

### Yashirin ustunlarni o'qish — usul (2026-08-16)

Referens hisobida ko'p jadvalda ustunlar yashirilgan (faqat `№` ko'rinadi).
Ularni **yoqmasdan** o'qish mumkin — ikki yo'l bor:

1. **Ustun menyusi** (faqat ba'zi sahifalarda): sarlavha ustiga hover →
   menyu ikonkasi → `Ustunlarni boshqarish`. Panel barcha ustun nomlarini
   ro'yxat qiladi.
2. **React fiber** (hamma joyda ishlaydi) — MUI DataGrid'ning `columns`
   propini o'qish:

```js
const fiberOf = el => { const k = Object.keys(el).find(k => k.startsWith('__reactFiber$')); return k ? el[k] : null; };
let f = fiberOf(document.querySelector('.MuiDataGrid-root')), d = 0;
while (f && d < 60) { const p = f.memoizedProps;
  if (p && Array.isArray(p.columns) && p.columns.length) { console.log(p.columns.map(c => c.headerName || c.field)); break; }
  f = f.return; d++; }
```

Ikkinchi usul `disableColumnMenu` qilingan jadvallarda ham ishlaydi.

### Ustunlar bo'yicha natija

**Aynan mos (18 sahifa):** `Guruhlar` 12/12 · `Guruh o'quvchilari` 6/6 ·
`Tranzaksiyalar` 15/15 · `Davomati bekor qilinganlar` 7/7 · `Feedback` 8/8 ·
`Jarima` 11/11 · `Yangi o'quvchilar` 10/10 · `O'quvchining umumiy to'lanmagani` ·
`Kurs narxidan farqli to'lovlar` · `Bekor qilingan to'lovlar` · `Umumiy chegirmalar` ·
`Jihozlar` · `Rollar` · `Yangiliklar` · `Hikoyalar` · `Shartnoma` ·
`Xodimlar reytingi` · `Support analitikasi`

**Tuzatilgan (5 sahifa):**

| Sahifa | Nima qilindi |
|---|---|
| Xodimlar | `Lavozim`, `Tug'ilgan sana`, `Maosh hisoblanadi` qo'shildi → 16/16 |
| Bonus | `To'lov tranzaksiyasi` qo'shildi → 12/12 |
| Aktiv o'quvchilar | `Shartnoma` qo'shildi (eksport ro'yxati ham) |
| Ota-onalar | yorliq `… yuklab olish` → `… yuklab olish sanasi` |
| Buyurtmalar ro'yxati | **ortiqcha** `Birinchi dars guni` olib tashlandi → 10/10 |
| Arxiv o'quvchilar | arxivga xos 14 ustunga to'liq qayta qurildi → 14/14 |

Yangi qo'shilgan ustunlar demo ma'lumotda bo'sh (`—`) chiqadi — modelda mos
maydon yo'q, referensda ham shu ustunlar bo'sh. CSV/Excel eksport ro'yxatlari
jadvaldan alohida kuratsiya qilingan (ularda `Kurs darajasi`/`Izoh` ham yo'q),
shuning uchun `Birinchi dars guni` eksportda qoldirildi.

**Arxiv o'quvchilar** ham moslandi (14/14). Referensda bu jadval aktiv
o'quvchilarnikidan butunlay farq qiladi. Yetishmagan maydonlar (`Arxivlangan
guruh`, `Arxiv o'qituvchisi`, `Pro arxivlangan sana`, `Arxivlangan sana`,
`Oldingi holati`) `lib/archiveStudents.ts` da `order.id` dan DETERMINISTIK
hisoblanadi — o'quvchi haqiqiy `GROUP_SEED` guruhiga bog'lanadi, arxiv sanalari
esa yaratilgan sanadan keyin keladi (yaratilgan < pro arxiv < arxiv).


## Keyingi qadamlar

Barcha bo'lim tekshirib chiqildi. Qolgan ishlar:

1. Referensda ustunlari yashirin sahifalarda ustunlarni yoqib, qayta solishtirish
   (ro'yxat yuqorida)
2. `Gamifikatsiya` moduli referensda sotib olinmagan — yoqilsa, 2 ta tab qurilishi mumkin

### ✅ Qurilmagan 37 ta havola — hal qilindi (2026-08-16)

`constants/sidebar.js` da referensda mavjud bo'lmagan 37 ta havola bor edi (bo'lim
dashboardlari, qo'shimcha analitika sahifalari va h.k.) — hech biri qurilmagan,
sidebarda faqat **qulf** bo'lib turardi.

- **35 tasi olib tashlandi.** Sidebar endi referens tuzilishiga mos; har bir
  havolaning ishlaydigan sahifasi bor (83 havola, 83 sahifa).
- **2 tasi qurildi** — `Profil` (`/settings-profile`) va `Xavfsizlik`
  (`/settings-security`). Bular mavjud sessiya/qurilma ishimizning davomi:
  `Profil` — o'z ismini tahrirlash (telefon va rol o'zgarmaydi);
  `Xavfsizlik` — parol almashtirish (`POST /api/auth/change-password`,
  `lib/invite.ts` yordamchilari orqali), `Aktiv qurilmalar` ga o'tish va
  `Ekranni qulflash`.

Tekshirish: `node` bilan `constants/sidebar.js` ni `IMPLEMENTED_ROUTES` bilan
solishtirish — farq bo'lmasligi kerak.


---

# ⚠️ Ish jarayonidagi tuzoqlar

Bularni bilmasangiz vaqt yo'qotasiz.

## `globals.css` o'zgarishi yetib bormaydi

Hot-reload ishlamaydi va **oddiy restart ham yetarli emas**. Har safar:

```bash
rmdir /s /q .next & npm run dev
```

Sabab — fayl 345KB va Turbopack uning keshini to'g'ri yangilamaydi. Bitta sessiyada
6 marta shunday qilishga to'g'ri keldi. CSS "ishlamayotgandek" tuyulsa — birinchi
navbatda shuni qiling.

## Tungi rejim skripti gidratatsiya xatosini keltirib chiqaradi

`app/layout.tsx` dagi bloklovchi skript yorug' rejim chaqnashini yo'qotadi, lekin
u `dark` klassini `<html>` ga React gidratatsiyasidan OLDIN qo'shadi. Server
HTML'ida esa u klass yo'q — natijada konsolda:

> A tree hydrated but some attributes of the server rendered HTML didn't match

Yechim — `<html>` ga `suppressHydrationWarning` qo'yish (2026-08-19 da qo'shildi).
Bu atribut FAQAT o'sha elementning o'z atributlariga tegishli, ichidagi daraxtga
tarqalmaydi — ya'ni boshqa haqiqiy nomuvofiqliklar baribir ko'rinadi.
`next-themes` ham aynan shu usuldan foydalanadi.

Klass keyin `components/shared/Theme.tsx` dagi effektda ham qayta qo'yiladi,
shuning uchun React uni hech qachon o'chirib yubormaydi.

## Tailwind responsive prefikslari — qachon ishlaydi, qachon yo'q

**Ular O'LIK EMAS.** 2026-08-16 da brauzerda o'lchab tekshirildi:

| Sinov | 1280px | 375px |
|---|---|---|
| `hidden md:flex` | `flex` | `none` |
| `p-4 md:p-5` | `20px` | `16px` |
| `grid-cols-1 md:grid-cols-3` | 3 ustun | 1 ustun |

Breakpointlar standart: `sm`=640px, `md`=768px, `lg`=1024px.

**Haqiqiy cheklov tor:** `app/globals.css` ning 1-qatorida `@import "tailwindcss"`
(v4 JIT), undan **keyin** esa Tailwind v3.4.6 ning kompilyatsiya qilingan bloki va
loyihaning maxsus klasslari (`.nav-btn`, `.table-frame`, `.page-frame` …) turibdi.
Bir xil spesifiklikda **keyingi** qoida ustun keladi, media so'rov esa spesifiklikni
oshirmaydi. Shuning uchun:

- `hidden md:flex` — **ishlaydi** (ikkalasi ham v4 utility, tartib to'g'ri)
- lekin `.nav-btn md:flex` kabi aralashma — **ishlamaydi**, chunki `.nav-btn` ning
  o'z `display` qiymati keyinroq turadi va utility'ni bosib ketadi

Shu sabab shell qismida maxsus klasslar yaratilgan: `.shell-only-mobile`,
`.shell-from-sm`, `.shell-from-lg`. `globals.css` dagi izoh buni aniq aytadi:
*"Bular `.nav-btn` / `.nav-field` dan KEYIN turishi shart"*.

**Amaliy qoida:** oddiy elementlarda `md:`/`lg:` bemalol ishlating. Agar element
allaqachon `globals.css` dagi maxsus klassga ega bo'lsa (`.nav-btn`, `.table-frame`
va h.k.) va siz o'sha klass belgilaydigan xususiyatni (`display`, `padding`,
`grid-template-columns`) o'zgartirmoqchi bo'lsangiz — utility emas, o'sha klassning
yoniga media so'rov yozing.


## Lightning CSS bo'sh qoidani o'chiradi

```css
.flyout-instant { transition: none; transform: none; }   /* brauzerga YETIB BORMAYDI */
```

`transform: none` — boshlang'ich qiymat, `transition: none` ham `0s` ga tushadi.
Optimizator ikkalasini "ortiqcha" deb tashlaydi, qoida bo'sh qolib butunlay o'chadi.
`!important` qo'shilsa saqlanadi.

## Yangi lucide ikonkasi Turbopack keshini buzishi mumkin

"module factory is not available" xatosi chiqsa — kod aybdor emas, `.next` ni tozalang.

## Brauzerdan o'lchashda ehtiyot bo'ling

- Tab **fonda** turganda CSS animatsiyalari yurmaydi: `width`/`opacity` kabi
  transition bilan o'zgaradigan qiymatlar eski holatda qotib qoladi va noto'g'ri
  xulosa chiqarasiz. `offsetWidth` bilan tekshiring yoki skrinshot oling.
- Faqat `<select>` va `placeholder` bo'yicha qidirish **yolg'on "kamchilik"** beradi:
  `<input type="time">` ikkalasiga ham kirmaydi. Guruhlar sahifasida shu sabab
  "3 ta filtr yo'q" deb xato xulosa qilingan edi — aslida hammasi bor edi.

---

# Sozlamalar bo'limi — holat va qolgan ishlar

Referens marshruti: `/settings/<bo'lim>?status=<tab>`
Bu loyihada: `/settings-<bo'lim>?tab=<tab>` (`constants/settings.js` — 8 bo'lim, 32 tab).

**Hozir: 31 tabdan 29 tasi qurilgan** (qolgan 2 tasi — Gamifikatsiya, pastga qarang). Kalitlar mosligini tekshirish:

```bash
node -e "const f=require('fs'),p=f.readFileSync('components/settings/SettingsSectionPage.tsx','utf8');console.log([...p.matchAll(/^  \"([^\"]+)\":/gm)].length+' ta tab ro\\'yxatda')"
```

## Asosiy fayllar

| Fayl | Vazifasi |
|---|---|
| `constants/settings.js` | Bo'lim/tab xaritasi (slug'lar referens bundle'idan) |
| `components/settings/SettingsSectionPage.tsx` | `BUILT` xaritasi — `"<bo'lim>:<tab>"` → komponent |
| `components/settings/SettingsForm.tsx` | Umumiy forma (toggle/number/text/time/select/radio, `suffix`) |
| `components/settings/SettingsListTab.tsx` | Umumiy CRUD jadval (`text/select/toggle/date/color`, `readOnly`, `onLabel`/`offLabel`) |
| `lib/settingsLists.ts` | `SETTINGS_LIST_KINDS`, `LIST_FIELD_TYPES`, `pickListFields()` |
| `app/api/settings/route.ts` | `GET ?key=` / `PUT` — forma qiymatlari (`settings` kolleksiyasi) |
| `app/api/settings-lists/route.ts` | `?kind=` bo'yicha generic CRUD |

**Yangi ro'yxat qo'shish:** `SETTINGS_LIST_KINDS` ga kalit + `constants/settingsLists.js` ga seed + `SEEDS` ga qator + `BUILT` ga yozuv. Route va indekslarga tegilmaydi.

**Yangi forma qo'shish:** `constants/settingsForms.js` ga guruh + `BUILT` ga `<SettingsForm storageKey="…" groups={…} />`.

---

## Qurilgan 6 ta tab (2026-08-16)

Tuzilishlar referens saytdan **jonli o'lchab** olingan (yorliqlar, boshlang'ich
holatlar, o'zgaruvchilar ro'yxati) — taxmin qilinmagan.

| Tab | Kalit | Fayllar | Saqlash kaliti |
|---|---|---|---|
| So'raladigan bo'limlar | `sale-marketing:field` | `constants/settingsFields.js` · `components/settings/FieldSettingsTab.tsx` | `sale-marketing.field` |
| Chek | `system:check` | `constants/settingsCheck.js` · `components/settings/CheckTab.tsx` | `system.check` |
| Bot eslatmalari | `sale-marketing:bot-notes` | `constants/settingsBotNotes.js` · `components/settings/BotNotesTab.tsx` | `sale-marketing.bot-notes` |
| Avto sms | `sale-marketing:auto-sms` | `constants/settingsAutoSms.js` · `components/settings/AutoSmsTab.tsx` | `sale-marketing.auto-sms` |
| Ommaviy oferta | `system:public-oferta` | `constants/settingsOferta.js` · `components/settings/PublicOfertaTab.tsx` | `system.public-oferta` |
| Obuna | `system:billing` | `constants/settingsBilling.js` · `components/settings/BillingTab.tsx` | `system.billing` |

Backend qo'shilmagan — hammasi mavjud generic `/api/settings` (`{key, values}`)
ustida ishlaydi, `values` ichida massiv/obyekt ham bo'laveradi.

**Referensdan ataylab farq qiladigan joylar:**

- `Chek` → `Chek tili` referensda avtoto'ldiruvchi input, bizda oddiy `select`
  (O'zbekcha / Ruscha / Inglizcha).
- `Chek` → `Logo` va `Ommaviy oferta` → PDF: fayl yuklash backend'i yo'q,
  shuning uchun faqat **fayl nomi** saqlanadi.
- `Obuna` → `To'lash` haqiqiy to'lov qilmaydi, «To'lov tizimi hali ulanmagan»
  xabarini chiqaradi. Amal qilish sanasi qattiq yozilmagan — tanlangan tarif
  (+ bonus oylar) bo'yicha hisoblanadi.
- `Avto sms` → referensda «Avto sms yoqish» **sarlavha**, umumiy kalit emas;
  har bir ssenariy o'z toggle'i bilan mustaqil yoqiladi.

**Tuzoq (to'rt marta uchradi):** JSX matni ifoda bilan yonma-yon yozilganda
ular orasidagi **probel yo'qoladi** (`x 2000o'quvchi`, `0ta bo'lim`,
`Ziyamovaarxivga`).

Aniq qoida (2026-08-19 da o'lchandi): kompilyator har bir JSX matn tugunini
qatorma-qator **trim** qiladi va qatorlarni bitta probel bilan qo'shadi.
Agar matn tuguni **ko'p qatorli** bo'lsa — uning eng boshidagi va eng
oxiridagi probel ham qirqiladi. Ya'ni:

```jsx
{/* YOMON — ko'p qatorli, probel yo'qoladi */}
<span>{name}</span> arxivga o'tkaziladi.
U ro'yxatdan yo'qolmaydi.
```

Ikkita ishonchli yechim:

```jsx
{/* 1. Yagona shablon-satr */}
{`${n} ta o'quvchi uchun`}

{/* 2. Matnni JSX matni emas, satr IFODASI qilib yozish */}
<span>{name}</span>
{" arxivga o'tkaziladi. U ro'yxatdan yo'qolmaydi."}
```

Bitta qatorda turgan matn (`<b>{n}</b> ta`) shikastlanmaydi — muammo faqat
matn bir necha qatorga cho'zilganda paydo bo'ladi. Yangi kod yozganda shu
ikki shakldan biri ishlatiladi.


## Qurilmaydigan

**Gamifikatsiya** (`gamification:general`, `gamification:auto-coin`) — referensda ikkala tab ham butunlay bo'sh render bo'ladi. Obuna sahifasida «Gamifikatsiya to'lovi» alohida qator sifatida turibdi: bu **pullik qo'shimcha modul** va referens akkauntda yoqilmagan. Yoqilmaguncha xaritalab ham, qurib ham bo'lmaydi.

Bu ikki tab endi umumiy «hali qurilmagan» belgisi o'rniga aynan shu sababni
ko'rsatadi (`components/settings/ModuleNotEnabledTab.tsx`) — «maydonlari
referensdan ko'chirilishi kerak» degani noto'g'ri edi, ko'chiriladigan maydon
umuman yo'q.

**Statik klondagi gamifikatsiya sahifasi spesifikatsiya EMAS.**
`crm-akademiya/index.html:18853` da 4 bo'limli (`tangalar` / `yutuqlar` /
`darajalar` / `dokon`) chiroyli sahifa bor, lekin u referensdan ko'chirilmagan —
qo'lda chizilgan maket:

* Uning bo'lim kalitlari o'zbekcha, holbuki mahsulotning barcha 31 ta haqiqiy
  tab kaliti inglizcha kebab-case (`general`, `auto-coin`, `check`, …) —
  bu kalitlar mahsulotning o'z `assets/tabItems-*.js` bandlidan olingan.
* Klonning hech bir joyida «Auto coin» so'zi uchramaydi.
* Klonda tugatilmagan tugmalar odatda `showToast()` chaqiradi (butun faylda
  260 marta), gamifikatsiya blokida esa bittasi ham yo'q: «Saqlash»,
  «Yutuq qo'shish», «Daraja qo'shish», «Sovrin qo'shish», «Tahrirlash» —
  hammasida ishlov beruvchi umuman yozilmagan, qo'shish formasi ham yo'q.

Ya'ni undan forma yasash = maydonlarni ham, ular qaysi tabda turishini ham
to'qib chiqarish. Tizimda tangani hisoblaydigan mexanizm ham yo'q:
`pupils.coin` faqat e'lon qilingan (`lib/pupilsData.ts:19`), yaratishda 0
qo'yiladi va hech qachon o'zgartirilmaydi.

## Mobil ko'rinish (2026-08-16)

Tekshirilgani: breakpointlar brauzerda o'lchandi (yuqoridagi jadval), login
sahifasi 375px'da gorizontal toshishsiz, jadvallar `.table-scroll`
(`overflow: auto`) ichida siljiydi, desktop sidebar 1024px'dan pastda
yashirinib o'rniga chekma menyu chiqadi.

**Tuzatilgan kamchilik:** Navbar'ning o'ng bloki `hidden md:flex` bilan
o'ralgan — 768px'dan pastda til tanlash, yangiliklar, bildirishnomalar,
mavzu va **profil menyusi** butunlay yashirinardi. Mobil chekma menyuda esa
faqat navigatsiya bor edi, ya'ni **telefondan tizimdan chiqib bo'lmasdi**.
`components/shared/Sidebar.tsx` dagi mobil chekma menyu pastiga profil
amallari qo'shildi (`Aktiv qurilmalar` / `Qulflash` / `Chiqish`) — mantiq
`Navbar.onProfileAction` bilan bir xil.

**Mobil chekma menyu to'liq:** navigatsiyadan tashqari til tanlash
(🇺🇿/🇺🇸/🇷🇺), bildirishnomalar (o'qilmagan soni bilan), mavzu almashtirgichi va
profil amallari (`Aktiv qurilmalar` / `Qulflash` / `Chiqish`).

Buning uchun ikkita umumiy manba yaratildi — aks holda Navbar bilan mobil menyu
holati rassinxron bo'lardi:

- `constants/navbar.js` + `lib/navbar.ts` — LANGUAGES / NOTIFICATIONS /
  NOTIF_STYLES (ilgari Navbar ichida yopiq edi)
- `components/shared/Theme.tsx` — mavzu do'koni, `Language.tsx` bilan bir xil
  namunada (`useSyncExternalStore` + localStorage). Yon foyda: mavzu endi
  sahifa yangilanganda ham saqlanadi — ilgari `useState(false)` edi va
  yo'qolib ketardi.

**Hali tekshirilmagan:** ilova sahifalarining 375px'dagi ko'rinishi — Chrome
viewport'ini kichraytirib bo'lmadi (o'lchash nosozligi), shuning uchun chekma
menyu DOM darajasida tekshirildi (barcha 8 boshqaruv joyida) va mavzu do'koni
brauzerda sinaldi (klass + localStorage + tugma sarlavhasi almashadi).


## Tug'ilgan kunlar sahifasi (2026-08-16)

Navbardagi "Tug'ilgan kunlar" tugmasi `/birthdays` ga havola qilardi, lekin
sahifa yo'q edi. Referens: `/hr/birthdays?type=monthly&month=N`.

Qurildi — `components/birthdays/BirthdaysPage.tsx` + `lib/birthdays.ts`:

- Filtr: `Hammasi` / `O'quvchilar` / `Xodimlar`
- Ko'rinish: **Oylik** (dushanbadan boshlanadigan kalendar to'ri; har katakda
  kun raqami va 3 tagacha ism, qolgani `+N Ko'proq`) va **Yillik** (12 oy
  kartasi, bo'shida `Ma'lumot yo'q`)
- Yil va oy tanlagichlari
- Oy/kun nomlari navbardagi tilga qarab o'zgaradi (`lib/i18n.ts`)

**Ma'lumot:** o'quvchilar `createInitialOrders()` dan, xodimlar
`EMPLOYEES_DATA` dan olinadi. Ikkala to'plamda ham tug'ilgan sana maydoni
yo'q, shuning uchun sana `id` dan DETERMINISTIK hisoblanadi (loyihadagi
odat). Haqiqiy maydon paydo bo'lsa faqat `birthOf()` almashtiriladi.
29-fevral chetlab o'tiladi — sana har yili takrorlanishi kerak.

`lib/i18n.ts` ga `WEEKDAYS_FULL` qo'shildi (dushanbadan boshlanadi — mavjud
`WEEKDAYS_SHORT` esa yakshanbadan boshlanadi va sana tanlagichlarda
ishlatiladi, ikkalasini aralashtirmang). Shu bilan birga oy imlosi
referensga moslandi: `Sentabr` -> `Sentyabr`, `Oktabr` -> `Oktyabr`.

Katak bosilganda modal ochiladi (referensdagidek): sarlavha
`4 Avgust 2026 - Tug'ilgan kunlar`, ichida har bir odam uchun ism +
`Telefon: ...` kartasi, pastda `Orqaga`. Katakka 3 tagacha ism sig'adi,
qolgani `+N Ko'proq` bo'lib ko'rsatiladi — modalda esa hammasi chiqadi.
Kartaga bosilsa profilga o'tadi: o'quvchi `/student-edit/[id]`, xodim
`/management-xodimlar/[id]`. Modal `Orqaga`, tashqariga bosish va Escape
bilan yopiladi.

Dizayn referensdan o'lchab olindi (`getComputedStyle` + styled-components
qoidalari) va `app/globals.css` dagi `.bd-*` klasslariga ko'chirildi:

| Element | Qiymat |
|---|---|
| Katak | 140px qat'iy balandlik, fon `#F0F2F2`, ramka `1px` border rangi, radius 8px, padding 8px |
| Katak hover | ramka `--primary` + `0 2px 4px rgba(0,0,0,.1)` soya |
| Ism chipi | oq fon, matn `--primary`, 12px/500, padding `4px 8px`, radius 4px, `text-overflow: ellipsis` |
| Ism hover | fon `--primary`, matn oq |
| Kun raqami | 28×28 doira, 14px/600; bugungi kun `--primary` fonda oq matn |
| `+N Ko'proq` | 11px/600, fon `#F2FBFF`, radius 4px |
| Hafta sarlavhasi | 14px/600, markazda, katta harfsiz |

Tailwind utilitasi emas, alohida klass — aniq piksel va `:hover` kerak
bo'lgani uchun (loyihadagi odat). Xodim chipi sariq rangda: referensda
hammasi ko'k, bizda esa o'quvchi va xodim bitta kalendarga birlashtirilgan.

## Tungi rejim — tekshiruv (2026-08-16)

Tug'ilgan kunlar kalendari dastlab faqat yorug' rejimga moslangan edi
(`#f0f2f2` katak, oq chip, `#f2fbff`). Tuzatildi:

- `.bd-chip` foni `hsl(var(--card))` ga o'tkazildi (ikkala rejimda to'g'ri)
- `.dark .bd-cell` -> `--card-dim`, `.dark .bd-more` -> `--primary / .16`,
  `.dark .bd-chip.is-employee` -> ochiqroq sariq

Tekshirilgani (tungi rejimda o'lchandi): katak `rgb(18,21,28)`, chip
`rgb(27,30,40)` fonda `rgb(71,142,255)` matn, `+N Ko'proq`
`rgba(71,142,255,.16)`.

### Butun loyiha bo'yicha audit

| Tekshiruv | Natija |
|---|---|
| Qattiq quyuq matn klasslari (`text-black`, `text-slate-900` …) | **yo'q** |
| `bg-white` (15 fayl) | hammasi toggle tugmachasi yoki rangli fon ustidagi `hover:bg-white/15` — to'g'ri |
| `globals.css` dagi qattiq oq fon (9 ta) | 8 tasi toggle tugmachasi, 1 tasi sertifikat shabloni (qog'oz) — to'g'ri |
| Inline hex ranglar (5 ta) | aksent ranglar, ikkala rejimda o'qiladi |
| Yuzalar (`kpi-card`, `shell-header`, `bg-card`, `bg-secondary`) | tokenlardan, tungi rejimda to'g'ri qorayadi |

### ✅ Holat belgilari ham tuzatildi

Belgilar (`bg-emerald-100 text-emerald-600` kabi, ~167 joyda) tungi rejimda
ochiq pastel bo'lib qolardi. 167 joyni tahrirlash o'rniga `globals.css` ga
markazlashgan blok yozildi:

- fon → mos **500** tusning ~16% shaffofi
- matn → **400** tus

Tailwind'ning `dark:` varianti bu loyihada **generatsiya bo'lmaydi** (sinab
ko'rilgan: `dark:bg-emerald-500/15` hech qanday qoida bermaydi), shuning
uchun markazlashgan yechim tanlandi. `.dark .bg-…` spesifikligi (0,2,0)
Tailwind'nikidan (0,1,0) yuqori, shu sabab ustun keladi.

Matn ranglari fonsiz ham ishlatiladi (masalan manfiy balans `text-rose-600`) —
u holda ham 400 tus quyuq fonda 600/700 dan yaxshiroq o'qiladi.

Tekshirilgani: **yorug' rejim o'zgarmadi** (`bg-emerald-100` hamon
`rgb(209,250,229)`), tungi rejimda `rgba(16,185,129,.16)` fonda
`rgb(52,211,153)` matn. Qamrab olingan: emerald, blue, rose, red, amber,
violet, purple, slate, sky, cyan.


**Diqqat:** `globals.css` o'zgargach dev serverni qayta ishga tushirish shart
(`.next` tozalab) — aks holda brauzer eski CSS'ni ko'rsatadi. Bundan tashqari
eski DOM tugunlari yangi CSS bilan yangilanmay qolishi mumkin; o'lchashdan
oldin sahifani toza yuklang.

## Yuklanish indikatori (2026-08-17)

Ilgari yuklanish holati hamma joyda "Yuklanmoqda…" matni edi. Referensda esa
aylanadigan doira ko'rsatiladi. Qo'shildi:

- `components/ui/Spinner.tsx` — `<Spinner size={28} />` va markazlashgan
  `<SpinnerBlock size={28} />`
- `globals.css` da `.spinner` + `@keyframes tz-spin`. Tailwind'ning
  `animate-spin` i ishlatilmadi — u eski v3 blobi bilan to'qnashadi.
  Ranglar tokenlardan: yoy `--primary`, halqa `--border` (tungi rejimda
  avtomatik moslashadi). `prefers-reduced-motion` da sekinlashadi.
- **`app/(app)/loading.tsx`** — bitta fayl `(app)` guruhidagi BARCHA
  sahifalarni qamrab oladi (Next.js uni Suspense chegarasi sifatida
  ishlatadi): sahifadan sahifaga o'tganda markazda spinner chiqadi.
- 63 faylda ichki yuklanish matni `<SpinnerBlock />` ga o'tkazildi.

**Ataylab tegilmagan 2 joy** — u yerda komponent ishlatib bo'lmaydi, chunki
matn satri kerak:
- `EmployeeEditModal.tsx` — `value={passwordLoading ? "Yuklanmoqda..." : …}`
  (input qiymati)
- `AddStudentModal.tsx` — `<option>{loading ? "Yuklanmoqda…" : …}</option>`

## Qobiq (shell) — referens bilan aniqlangan farqlar (2026-08-17)

**Sidebarni yig'adigan tugma.** Bizda u header ichida, logo yonida turardi.
Referensda esa **sidebarning o'ng chegarasida**, markazi aynan chegara
chizig'ida. O'lchangan: tugma markazi `x=174`, sidebar chegarasi `x=173`,
o'lchami `28x28`, `border-radius: 8px`, `position: absolute`,
`z-index: 99999`.

Bizda `#sidebar-toggle` `globals.css` da `position: fixed` +
`left: calc(var(--shell-sidebar-w) - 14px)` bilan qo'yildi — markaz `x=173`.
Sidebar yig'ilganda tugma `left: 6px` ga suriladi (mavjud collapse
animatsiyasi bilan bir xil `transition` egri chizig'i).

**Filial tanlagich.** Referensda matn oldida bino ikonkasi bor edi, bizda
yo'q edi. `i-landmark` sprite'ga qo'shildi va select'ning chap paddingi
`pl-2` -> `pl-9` ga o'zgardi.

### Kalendar tartibi — skrinshot bilan solishtirilgan (2026-08-18)

Chrome kengaytmasiga sayt ruxsati berilgach skrinshot ishlay boshladi va
referens bilan yonma-yon solishtirildi. Uchta farq topilib tuzatildi:

| | Referens | Bizda edi |
|---|---|---|
| Boshqaruv tartibi | yil → oy → `Hammasi/O'quvchilar/Xodimlar` → `Oylik/Yillik` | teskari: tablar oldin, sana keyin |
| Hafta sarlavhalari | alohida ramkali blok (radius 10, padding 20, karta foni) | oddiy matn, umumiy karta ichida |
| `+N Ko'proq` | katakning to'liq kengligi, matn markazda | kontentga yopishgan kichik chip |

Kun kataklari referensda umumiy kartasiz — to'g'ridan-to'g'ri sahifa fonida
turadi (har birining o'z ramkasi bor). Bizda ham shunday qilindi.

---

## Xodimni arxivlash (2026-08-19)

Referensda (`akademiya.edutizim.uz`) xodimni **o'chirish yo'q** — faqat
arxivlash bor, va u qaytariladi. Bu brauzerda tekshirildi (hech narsa
bosilmasdan, React props va DOM o'qib):

| Nima | Referensdagi joyi |
|---|---|
| Tugma | `/hr/employees/profile/:id` — kartochkadagi 4 ikonkadan **2-chisi** |
| Tooltip | `Moderatorni arxivlash` (rolga qarab o'zgaradi) |
| Modal maydonlari | `reasonResignId` (sabab) + `dateResign` (sana) |
| Saqlash | `POST hr/employee/archive` |
| Teskarisi | `POST /hr/employee/activate` |
| Tekshiruv | `hasOrders`, `hasStudents` |
| Arxivdagilar | o'sha `/hr/employees` jadvali, `Holat` filtri: `active` / `archive` |

Ro'yxat sahifasida amallar ustuni, checkbox yoki o'ng-tugma menyusi **yo'q**
(16 ustunning hammasi ma'lumot) — arxivlash faqat profildan.

### Bizdagi amalga oshirilishi

- `components/employees/EmployeeArchiveModal.tsx` — bitta komponent ikkala
  amalni bajaradi (`mode: "archive" | "activate"`).
- `components/employees/EmployeeProfilePage.tsx` — 4 ta amal tugmasi
  referens tartibida: `[Parol qo'shish] [<Rol>ni arxivlash] [Qo'ng'iroq
  qilish] [Tahrirlash]`. Ilgari birinchisi "Guruhlar" edi — referensda
  bunday tugma yo'q. Arxivdagi xodimda tugma "arxivdan chiqarish"ga
  aylanadi va kartochkada sabab/sana bandi chiqadi.
- Saqlash: mavjud `PATCH /api/hr-employees/:id` (Partial<HrEmployee>) —
  yangi endpoint kerak emas.

### Nega alohida "holat" maydoni qo'shilmadi

`archReason` bo'sh emasligi arxiv belgisi — `EmployeesListPage` dagi
"Holat" filtri (`:128`) allaqachon shunga qaraydi. Alohida `state` maydoni
qo'shilsa ikkita manba paydo bo'lardi va ular uch joyda mos kelishi kerak
bo'lardi, ustiga eski hujjatlarni to'ldirish (backfill) talab qilinardi.

### Nega sabablar `EMP_LEAVE_REASONS` dan olinadi

`constants/employees.js:51` — `["Shaxsiy", "Ish o'zgarishi", "Boshqa"]`.
Ro'yxat sahifasidagi "Ketish sababi" filtri aynan shu massivdan yasaladi va
`archReason` bilan **satrma-satr** solishtiradi. Modal boshqa manbadan
yozsa, saqlangan sabab filtrda hech qachon topilmasdi. Sozlamalardagi
`reasons` ro'yxati bunga to'g'ri kelmaydi — u o'quvchilarga oid
(`LEAVE_REASON_TYPES = ["Ketdi", "Bekor qilindi", "Davomat"]`).

### Tekshirilgani

`PATCH` → `GET` → ro'yxatda `archive` filtriga tushishi → `PATCH` (tiklash)
zanjiri curl bilan, so'ng brauzerda modal orqali to'liq o'tkazildi; ma'lumot
asl holiga qaytarildi. Yorug' va tungi rejim ham ko'rildi.

### Ochiq savol

`app/api/hr-employees/[id]/route.ts` da `DELETE` handleri bor, lekin uni
**hech qayerdan chaqirilmaydi** va referensda ham qattiq o'chirish yo'q.
Olib tashlanadimi — hal qilinmagan.


## Kassa → Chiqim: kim tanlanishi turga bog'liq (2026-08-19)

Ilgari Chiqim oynasida tranzaksiya turidan qat'i nazar doim "O'quvchini
tanlang" chiqardi — hatto "Hodimga oylik" yoki "Printer" tanlanganda ham.
Referensda esa:

| Tranzaksiya turi | Pastda nima chiqadi |
|---|---|
| `Hodimga oylik`, `Hodimga avans` | **Xodimlar** ro'yxati |
| `O'quvchiga pul qaytarildi` | **O'quvchilar** ro'yxati |
| `List`, `Printer`, `Suv`, `Arenda`, … | hech narsa |

Xodim tanlanganda ostida `Oylik: … UZS` va **Xodim ma'lumotlarini ko'rish**
tugmasi chiqadi; tugma "Xodimlar" modalini ochadi. Modal sarlavhasidagi
ikonka — **akkordeon**: bosilganda jadval yig'iladi, faqat sarlavha qoladi.

### Fayllar

- `lib/txTarget.ts` — tur nomiga qarab `"employee" | "student" | null`.
  Tranzaksiya turlari admin boshqaradi (/finance-tx-types), ya'ni nomlar
  o'zgarishi mumkin — shuning uchun qat'iy satr emas, kalit so'z bo'yicha
  ("hodim"/"xodim", "o'quvchi"), apostrof variantlari normallashtiriladi.
- `lib/employeeSalary.ts` — oylik hisobi. Backend yo'q, qiymatlar xodim
  `id` sidan deterministik. Referens arifmetikasi saqlangan:
  `Davomatdan foizi = Davomat × 50%`, `Oylik = foizi + Bonus + Akladi −
  Avans − Jarima`, `Balans = Oylik`.
- `components/finance/EmployeeSalaryModal.tsx` — akkordeonli modal
  (z-300, chekmadan tepada).
- `components/finance/CashboxAdjustDrawer.tsx` — ulanishi.

### Ikki nozik joy

1. **Escape.** Chekma ham, modal ham `useEscapeClose` ishlatadi va ikkalasi
   ham `window` ni tinglaydi. Modal ochiq bo'lganda chekmanikini o'chirib
   qo'yamiz: `useEscapeClose(salaryOpen ? () => {} : onClose)`.
2. **Jurnalning "KIM" ustuni** `studentName` maydonidan o'qiladi
   (`TransactionEntriesPage.tsx:155`). Xodim tanlanganda ham nom o'sha
   maydonga yoziladi — referensda ham "KIM" ustuni ikkalasini ko'rsatadi.
   `moderator` maydoniga tegilmadi: u kassa mas'ulini bildiradi.

### Akkordeon animatsiyasi — ikki usul ishlamadi

"Xodimlar" modali silliq ochilib-yopiladi (300 ms). Yo'lda ikkita odatiy
usul brauzerda o'lchab rad etildi — qaytarib urinmaslik uchun:

1. **Tailwind klasslari ishonchsiz.** (TUZATISH: dastlab bu yerda "bu
   klasslar mavjud emas" deb yozilgan edi — xato. Ular BOR, lekin
   qatlamsiz v3 blobi ularni bosib ketishi mumkin — pastdagi
   "qatlamsiz v3 blobi" bo'limiga qarang.) Shu sabab animatsiya inline
   `style` bilan yozilgan — u ikkala manbadan ham ustun.
2. **`grid-template-rows: 1fr → 0fr`** — zamonaviy usul, lekin bu brauzerda
   interpolatsiya QILINMAYDI. O'lchov: 150 ms da hali to'liq balandlik
   (400px), so'ng birdan 0 ga sakraydi.

Ishlagan usul — `scrollHeight` dan o'lchangan px balandlikni animatsiya
qilish. Ikki nozik joyi bor:

- Yig'ishda `auto` dan animatsiya bo'lmaydi: avval aniq balandlik qo'yiladi,
  `void el.offsetHeight` bilan reflow majburlanadi, keyin 0 ga tushiriladi.
  `requestAnimationFrame` ATAYIN ishlatilmadi — oyna fonda bo'lsa u
  chaqirilmaydi va akkordeon ochiq holda qotib qolardi (kuzatildi).
- Ochilgach balandlik `auto` ga qaytariladi (kontent yoki oyna kengligi
  o'zgarsa kesilmasin). `transitionend` ga tayanilmaydi — u ham fondagi
  oynada yetkazilmasligi kuzatildi; zaxira taymer qo'yilgan.

`hooks/useReducedMotion.ts` — tizimda animatsiya kamaytirilgan bo'lsa
davomiylik 0 ga tushadi. `useSyncExternalStore` orqali (Theme.tsx naqshi),
effekt ichida setState qilinmaydi.

### Tegilmagani

`CashboxKirimDrawer.tsx` da ham xuddi shu naqsh bor (doim o'quvchi
tanlanadi). Lekin kirim turlari orasida `Oylik imtihon` va `Olimpiada` bor
— ular o'quvchi to'lovimi yoki yo'qmi noaniq, shuning uchun taxmin
qilinmadi. Hal qilinishi kerak.


## Xodim qo'shish — o'qituvchi maydonlari va toggle (2026-08-19)

### 1. Vazifa "O'qituvchi" bo'lsa yana 3 maydon

Referensda vazifa `O'qituvchi` tanlangandagina pastda qo'shimcha qator
ochiladi. Uchala ro'yxat ham BACKENDDAN keladi va bizda allaqachon mavjud
edi — faqat ulanmagan edi:

| Maydon | Manba | Qiymatlar |
|---|---|---|
| `Oladigan foizi*` | `/api/settings-lists?kind=monthly-percents` | Yashil (40%), Sariq (50%), Qizil (60%), Qora (70%)… |
| `Darajasi` | `/api/settings-lists?kind=degrees-teacher` | Yordamchi o'qituvchi, O'qituvchi, Katta o'qituvchi |
| `Kurslar*` | `/api/offline-courses` | 16 ta kurs |

Foizlar ro'yxati referens skrinshotidagi bilan AYNAN bir xil chiqdi —
demak sozlamalar ma'lumoti to'g'ri ko'chirilgan ekan.

So'rovlar faqat o'qituvchi tanlanganda ketadi. Boshqa vazifaga o'tilsa
uchala maydon tozalanadi. `HrEmployee` ga `percent?` va `degree?`
IXTIYORIY maydon sifatida qo'shildi (eski hujjatlar buzilmasin).

`Kurslar` hozircha BITTA kurs tanlaydi — `HrEmployee.kurs` bitta satr va
ro'yxatdagi "KURS" ustuni ham bitta qiymat ko'rsatadi. Referensda ko'plik
("Kurslar") — bir nechta tanlash kerakmi, aniqlanmagan.

### 2. Toggle surilmasdi — yana o'sha CSS sababi

`EmployeeToggle` tugmachani `transform` + `translate-x-1` /
`translate-x-5` bilan surardi va tugmacha QIMIRLAMASDI.

TUZATISH: dastlab sababni "bu klasslar mavjud emas" deb yozgan edim — bu
xato. Haqiqiy sabab: `translate-x-*` Tailwind v4 da bor va u
`--tw-translate-x` ni o'rnatadi, lekin QATLAMSIZ v3 blobidagi
`.transform` qoidasi undan ustun turib, o'zining bo'sh
`var(--tw-translate-x)` ini qo'llaydi. Natijada siljish nolga teng
bo'lardi. Batafsil — "qatlamsiz v3 blobi" bo'limida.

Endi holat inline uslub bilan: `translateX(4px)` ↔ `translateX(24px)`.
Toggle 4 joyda ishlatiladi (xodim qo'shish modali, maxsus maydon
drawer'i, guruh o'quvchilari sahifasi), ya'ni hammasi tuzaldi.

Bu SESSIYADA UCHINCHI marta shu sabab uchradi (shevron `rotate-180`,
`duration-300`, endi `translate-x-*`). **Yangi Tailwind utilitasi
ishlatishdan oldin uning CSS'da borligini tekshiring** — yo'q bo'lsa
inline uslub ishlating.


### 3. Rollar, filial qatorlari va profil rasmi

- **Rollar** endi Boshqaruv → Rollar dan (`/api/roles`): IT, Nazorotchi,
  O'qituvchi, Administrator, Filial direktori.
- **Ish jadvali** — Boshqaruv → Ish jadvali (`/api/work-schedules`), faqat
  `active: true` bo'lganlari.
- **Filial qatorlari** endi mustaqil holatga ega. Galochka qo'yilmaguncha
  o'sha qatordagi Rol / Ish jadvali / Ish haqi O'CHIQ turadi
  (`disabled`, `opacity: 0.4`). Bitta filialni belgilash boshqasiga
  ta'sir qilmaydi.
- **Ish haqi** maydoni `MoneyInput` ga o'tkazildi — uch xonadan ajratiladi.
- **Profil rasmi** endi haqiqiy fayl tanlagich: yashirin
  `<input type="file" accept="image/png,image/jpeg">` + ko'rinadigan tugma
  (loyihadagi naqsh, `PenaltyDrawer.tsx` dagidek). Tanlangach dumaloq
  ko'rinish (preview), fayl nomi va olib tashlash tugmasi chiqadi.
  PNG/JPG va 5 MB cheklovi bor; `URL.revokeObjectURL` bilan xotira
  bo'shatiladi.

**Hali yuborilmaydi:** filial/rol/jadval/ish haqi biriktiruvlari va profil
rasmi POST tanasiga qo'shilmagan — buning uchun backendda sxema va rasm
yuklash endpointi kerak (loyihada hali yo'q).

### ⚠️ Tailwind: qatlamsiz v3 blobi v4 utilitalarini bosib ketadi

**2026-08-19 da brauzerda o'lchab TEKSHIRILDI.** Undan oldin bu yerda
"`opacity-50`, `cursor-not-allowed`, `rotate-180` kabi klasslar mavjud
emas" deb yozilgan edi — **XATO**. Ular bor va ishlaydi. Haqiqiy muammo
tor va aniq: faqat **transform oilasi**.

#### Sabab

`globals.css` ikki manbadan iborat:

1. Kompilyatsiya qilingan **Tailwind v3 blobi** — oddiy, **qatlamsiz** CSS.
2. `@import "tailwindcss"` — **v4**, utilitalari `@layer utilities` ichida.

CSS qoidasi: **qatlamsiz CSS qatlamlidan har doim ustun**, spesifiklikdan
qat'i nazar. Blobda universal reset bor:

```css
*, ::backdrop, ::after, ::before { --tw-translate-x: 0; --tw-skew-x: 0; ... }
```

v4 ning `.translate-x-5` esa `--tw-translate-x` ni `@layer utilities`
ichida o'rnatadi — ya'ni **reset g'olib chiqadi** va siljish nolga aylanadi.

#### O'lchangan natija

| Klass | Holat | Sabab |
|---|---|---|
| `opacity-50` / `opacity-60` | ✅ ishlaydi | to'g'ridan-to'g'ri `opacity` |
| `disabled:opacity-40/50/60` | ✅ ishlaydi | — |
| `cursor-not-allowed` | ✅ ishlaydi | — |
| `pointer-events-none` | ✅ ishlaydi | — |
| `object-cover` | ✅ ishlaydi | — |
| `duration-300` | ✅ ishlaydi | — |
| `rounded-*`, `gap-*`, `text-center` | ✅ ishlaydi | — |
| `ring-2` | ✅ ishlaydi | blobdan keladi |
| `rotate-180` | ✅ ishlaydi | v4 `rotate:` xossasini beradi |
| **`translate-x-*`** | ❌ **ishlamaydi** | `--tw-translate-x` reset bilan 0 ga tushadi |
| **`scale-*`** | ❌ **ishlamaydi** | juft o'zgaruvchi yo'q, `scale` yaroqsiz |
| **`skew-*`** | ❌ **ishlamaydi** | `--tw-skew-x` reset bilan 0 |
| **`h-*` `<img>` da** | ❌ **ishlamaydi** | preflight `img,video{height:auto}` |

**Qoida:** to'g'ridan-to'g'ri CSS xossasini qo'yadigan utilitalar ishlaydi.
`--tw-*` o'zgaruvchisi orqali ishlaydigan **transform oilasi** ishlamaydi —
u yerda inline `style` ishlating.

Yana bir nozik joy: `rotate-180` ishlaydi, lekin u `rotate` XOSSASINI
qo'yadi, `transform` ni emas. Shuning uchun `transition-transform` uni
animatsiya QILMAYDI — burilish sakrab o'tadi. Animatsiya kerak bo'lsa
inline `transform: rotate(...)` + `transition: transform ...` yozing.

#### To'g'ri tekshirish usuli

Qoida bor-yo'qligiga qaramang — **natijani o'lchang**:

```js
const el = document.createElement('div');
el.className = 'KLASS';
document.body.appendChild(el);
getComputedStyle(el).XOSSA;   // haqiqiy natija
el.remove();
```

Qoidalarni ko'rish kerak bo'lsa, `@media`/`@layer` ICHIGA ham kiring
(avvalgi xato xulosa aynan shundan chiqqan edi):

```js
function* barcha(rs){ for (const r of rs) { yield r; if (r.cssRules) yield* barcha(r.cssRules); } }
```

## Profil rasmi (Cloudinary) va filial biriktiruvlari (2026-08-19)

### Cloudinary sozlash — QILISH KERAK

`.env.local` ga uchta kalit qo'shiladi (Cloudinary Dashboard →
Product Environment Credentials):

```
CLOUDINARY_CLOUD_NAME=
CLOUDINARY_API_KEY=
CLOUDINARY_API_SECRET=
```

`.env.local` `.gitignore` da (`.env*`), ya'ni commit bo'lmaydi.
**API Secret'ni hech qayerga — chat, commit, skrinshot — chiqarmang.**

Diqqat: `.env.example` ham `.env*` qoidasiga tushadi va git'da
kuzatilmaydi, shuning uchun kalitlar shu yerda hujjatlashtirildi.

Sozlanmagan bo'lsa ilova ishlayveradi — faqat rasm tanlab saqlashga
urinilganda aniq xato chiqadi: "Cloudinary sozlanmagan (.env.local dagi
CLOUDINARY_* kalitlarini to'ldiring)".

### `lib/cloudinary.ts` + `POST /api/upload/image`

`cloudinary` npm paketi ATAYIN qo'shilmadi — imzolangan yuklash oddiy REST
so'rovi, `fetch` va `crypto` yetarli (loyihadagi `lib/invite.ts` naqshi).
Imzo: `file`/`api_key`/`resource_type`/`cloud_name` dan tashqari barcha
parametrlar alifbo tartibida ulanadi, oxiriga API secret qo'shiladi, SHA-1.

Endpoint himoyasi (middleware `/api/` ni tekshirmaydi, shuning uchun
qo'lda qilingan):

| Tekshiruv | Natija |
|---|---|
| Sessiyasiz | `401 Avtorizatsiya talab qilinadi` |
| PNG/JPG/WEBP emas | `400 Faqat PNG, JPG yoki WEBP` |
| 5 MB dan katta | `400 Rasm hajmi 5 MB dan oshmasin` |
| `folder` mijozdan | E'tiborsiz — faqat "xodimlar" yoki "boshqa" |

Oxirgisi muhim: papkani mijozdan olsak, uni o'zgartirib boshqa joyga
yozib yuborish mumkin bo'lardi.

Rasm yuklanmasa saqlash TO'XTAYDI — xodim rasmsiz yaratilib, foydalanuvchi
buni sezmay qolmasligi uchun.

### Filial biriktiruvlari

`HrEmployee` ga ikkita ixtiyoriy maydon qo'shildi (eski hujjatlar buzilmasin):

```ts
photoUrl?: string;                                 // Cloudinary secure_url
branchAssignments?: EmployeeBranchAssignment[];    // { branchId, roleId, scheduleId, salary }
```

Faqat galochka qo'yilgan filiallar yuboriladi. Server tomonda
`sanitizeAssignments()` mijozdan kelganini tozalaydi — sinovdan o'tkazildi:
satrlar songa o'giriladi, yaroqsiz `branchId` tashlanadi, manfiy maosh 0
bo'ladi, kasr kesiladi, ortiqcha maydonlar olib tashlanadi.

### Tekshirilmagani

Xodim YARATISH oqimi (POST /api/hr-employees) uchidan uchiga
ishlatilmadi: u haqiqiy yozuv yaratadi va real raqamga SMS yuboradi.
So'rov tanasi ushlab tekshirildi, server tozalagichi alohida sinaldi,
lekin to'liq yaratish sinovi qilinmadi.


# Dizayn solishtiruvi — qayerda to'xtadik (2026-08-18)

## Bajarilgani

Referensning **hamma bo'limi** sahifama-sahifa solishtirilgan (ustunlar,
filtrlar, tugmalar) — natijasi yuqoridagi "Solishtirilgan bo'limlar"
bo'limida. Undan keyin **dizayn/piksel** darajasidagi solishtiruv boshlandi:

| Bo'lim | Holat |
|---|---|
| Tug'ilgan kunlar | ✅ tugadi — kalendar dizayni, modal, tungi rejim, tartib |
| Qobiq (navbar/sidebar) | ✅ sidebar tugmasi chegaraga ko'chirildi, filial select'iga ikonka |
| Topshiriqlar | ✅ ustunlar kartasizga o'tkazildi (rangli chiziq tepada) |
| Lidlar va qolganlari | ⏳ **keyingi safar shu yerdan** |

Yo'l-yo'lakay tuzatilgan umumiy nuqsonlar:
- yorug' rejim chaqnashi (`app/layout.tsx` da bloklovchi skript)
- butun ilovaga aylanadigan yuklanish indikatori (`loading.tsx` + 63 sahifa)
- tungi rejimda holat belgilari ranglari (~167 joy, markazlashgan yechim)

## Keyingi safar uchun

**Qolgan bo'limlar:** Lidlar, Guruh, O'quvchilar, O'quv bo'limi, Blok test,
Moliya, Nazorat, Boshqaruv, Sotuv va marketing, Hisobotlar, Sozlamalar.

**Ochiq savol:** Topshiriqlar sahifasida bizda referensda YO'Q qo'shimchalar
bor — 5 ta KPI kartasi, `Shablon` tugmasi, uchinchi ustun (`Keyinchalik
keladigan`) va `Vaqt/Kanban/Kalendar` almashtirgichi. Hozircha qoldirildi
(ishlaydi, zarar qilmaydi). Referensga qat'iy moslik kerak bo'lsa —
olib tashlanadi.

## ⚠️ Brauzer bilan ishlash — muhim eslatma

Skrinshot **faqat oldinda turgan (active) tabda** ishlaydi. Ikki saytni
navbatma-navbat ko'rganda biri "hidden" bo'lib qoladi va:
- `computer{action:"screenshot"}` -> `Failed to deserialize params.clip.scale`
- o'lchamlar `0x0`, `visibilityState: "hidden"`

Bundan tashqari bu sessiyada renderer tez-tez muzladi (45s CDP timeout) va
tab ID'lari har necha daqiqada almashdi — `tabs_context_mcp` ni har safar
qayta chaqirish kerak.

**Eng samarali usul bo'lgani:** foydalanuvchi skrinshot yuboradi, men
o'zimizni brauzerdan/koddan o'lchab solishtiraman. Filial select, sidebar
tugmasi va kalendar farqlari aynan shu yo'l bilan tez topildi.

Yana bir tuzoq: `globals.css` o'zgargach dev serverni `.next` tozalab qayta
ishga tushirish shart, VA sahifani toza yuklash kerak — eski DOM tugunlari
yangi CSS bilan yangilanmay qolib, `getComputedStyle` yolg'on qiymat
qaytarishi mumkin (bu sessiyada bir marta chalg'itgan).

---

# Soxta ma'lumot auditi (2026-08-24)

Butun kod bazasi bo'lim-bo'lim tekshirildi, har bir topilma alohida
tasdiqlandi. **117 ta topilmadan 102 tasi tuzatildi**; qolgan 15 tasi xato
emas — bazada mos maydon yo'qligi uchun ataylab qoldirilgan cheklovlar,
har biri kodda izoh bilan yozilgan.

Commitlar: `4036500` (olti bo'lim), `90be153` (xodimlar hisoblagichi),
`7dc262a` (oxirgi sahifalar va profil tablari).

## Amal qiladigan qoida

Bu qoida butun loyihaga tegishli va keyingi ishda ham saqlanishi kerak:

1. Ma'lumot bazadan kelsa ko'rsatiladi; kelmasa **`—`** turadi.
2. **`0` hech qachon "noma'lum" o'rniga ishlatilmaydi** — nol bu faktik
   da'vo ("bu o'qituvchining guruhi yo'q", "bu xodimning balansi nol").
3. Hech narsa qilmaydigan tugma **ishlatiladi yoki olib tashlanadi**.
   `(demo)` yozuvli toast qolmasligi kerak.
4. Yozuv `id` sidan yoki massiv indeksidan son hosil qilish taqiqlanadi
   (`(p.id * 137) % 6000`, `i % 13`, LCG generatorlar).

## ⚠️ Hech qachon o'qilmasligi kerak bo'lgan maydonlar

Bular bazada bor, lekin **hech bir API ularni yangilamaydi** — ya'ni
ko'rsatilsa yolg'on chiqadi. Har biri bir marta haqiqiy xatoga sabab
bo'lgan:

| Maydon | Nima o'rniga |
|---|---|
| `pupils.balance` | `/api/students/balances` (bekor qilinmagan `payIn` yig'indisi, ism bo'yicha) |
| `groups.students` | `groups.studentIds.length` |
| `hr_employees.groups` | `/api/groups` dan `teacher` bo'yicha sanash |
| `hr_employees.aktivOq` | shu guruhlarning `studentIds` i, takrorsiz |

## Yozuv tomoni yetishmaydigan ikki joy

Ikkalasi ham **ko'rinadi va o'qiydi, lekin to'lmaydi** — o'qish tomoni
tayyor, yozadigan kod yo'q:

### 1. Harakatlar tarixi (o'quvchi profili)

- Tayyor: `app/api/pupils/[id]/activity/route.ts` (GET), tab, va
  `lib/mongodb.ts` dagi `pupil_activity` indekslari.
- Yetishmaydi: `PATCH /api/pupils/[id]` o'zgargan har bir maydon uchun
  bitta yozuv qo'shishi kerak:
  `{ id, pupilId, field, from, to, staff, kind, device, date: "YYYY-MM-DD", time: "HH:mm" }`
- Shu yozuv qo'shilsa tab o'zi ishlab ketadi, tabga tegish shart emas.
  Hozircha u jurnal bo'shligini halol aytadi.

### 2. Shartnoma andozasi (o'quvchi profili)

- Tanlangan andoza **saqlanmaydi**: na `contracts` (title/type/content),
  na `finance_contracts` (moderator/izoh/summalar) da o'quvchiga
  biriktirilgan shartnoma nusxasi uchun maydon yo'q.
- Hozir ekranda shu ochiq yozilgan, aks holda Saqlash tugmasi uni ham
  saqlagandek tuyulardi. Formaning qolgan 21 maydoni esa haqiqiy
  `pupils` maydonlari va `PATCH /api/pupils/:id` orqali saqlanadi.
- Kerak bo'lsa: `lib/financeContracts.ts` + `app/api/finance-contracts/route.ts`
  ga `contractId`/`content` maydoni qo'shilishi kerak.

## Boshqa ochiq nuqtalar

- **Ism bo'yicha bog'lanish.** `tasks.student`, `sms_messages.recipientName`,
  `transaction_entries.studentName` — hammasi ism satri, `pupilId` emas.
  Bir xil ismli ikki o'quvchi bir-birining yozuvini ko'radi. Yozuvga
  `pupilId` qo'shilsa hammasi hal bo'ladi.
- **`?src=list` majburiy.** `/student-edit/:id` havolasi bu parametrsiz
  noto'g'ri odamni ochishi mumkin — buyurtma va o'quvchi id fazolari
  ustma-ust tushadi. Yangi havola yozganda unutmang.
- **Marketing havolalari.** `lib/surveys.ts` dagi lid manbasi havolalari
  klon qilingan production saytga ishora qilardi; tuzatildi, lekin
  `?survey=` kodini lid yaratishda **o'qiydigan kod hali yo'q** — ya'ni
  lid manbasini kuzatish to'liq ishlamaydi.
- **`tsc` xotirasi.** To'liq `npx tsc --noEmit` bu mashinada RAM bo'sh
  bo'lmasa "Zone Allocation failed" beradi. Bu kod xatosi emas — dev
  serverni to'xtatib qayta urinib ko'ring.

## Yakuniy hisobot

Bo'lim-bo'lim ro'yxat va qolgan 15 ta cheklov:
<https://claude.ai/code/artifact/fb38bf60-66c1-4479-98ac-103abcd67b31>

## Sinxronizatsiya: Google Sheets + Telegram (2026-08-26)

Kassadagi har bir Kirim/Chiqim ikki tashqi manzilga ko'chiriladi. Ikki
oqim bir-biridan mustaqil — har birining o'z jadvali va o'z guruhi bor:

| Oqim | Baza filtri | Manzil |
| --- | --- | --- |
| O'quvchi to'lovlari | `txType: "payIn"` | `SHEET_ID_PAYMENTS` + `TELEGRAM_CHAT_PAYMENTS` |
| Xodim oyliklari | `txType: "payOut"` + `txName` da `avans`/`oylik` | `SHEET_ID_SALARIES` + `TELEGRAM_CHAT_SALARIES` |

Qolgan chiqimlar (ijara, kommunal) va kassalar orasidagi ko'chirish
(`transfer`) **hech qayerga yuborilmaydi** — kelishuvda yo'q.

**To'lov — kassa filialining topigiga (2026-09-12).** Markaz so'rovi:
"qaysi filialda to'lov bo'lsa o'sha topikka tushsin". Guruh o'sha
(`TELEGRAM_CHAT_PAYMENTS`), lekin har filialga o'z topigi —
`branches.paymentTopicId` (Boshqaruv → Filiallar → "Telegram to'lov
topigi"). Filial to'lovning **kassasi** orqali aniqlanadi
(`cashboxes.branchId` → `branches`, `lib/sync/lookups.ts`), kassir ismi
orqali emas: `hr_employees.filial` da 48 xodimda shunchaki "Akademiya"
yozilgan (o'lchandi). Kassada filial bo'lmasa yoki filialda topik bo'lmasa
— umumiy "To'lovlar" topigi (`TELEGRAM_TOPIC_PAYMENTS`), ya'ni to'lov hech
qachon yo'qolmaydi. Bekor qilish xabari ham o'sha topikka. Kassa endi
yaratilganda navbardagi filialni oladi; eskilarini
`node scripts/telegram-branch-topics.mjs --payments --cashbox <kassa> <filial>`
bilan biriktiriladi (holat: `--payments`, topik ochish: `--payments --create`).
Xabar/Sheet'dagi "Filial" ham endi kassadan — ilgari "Akademiya" chiqardi.
Eski to'lovlarni filial topiklariga ko'chirish (12.09.2026 da bajarildi):
`scripts/resend-payments-telegram.mjs` — sukutda `sync_outbox` da Telegram
izi bor to'lovlar (umumiy topikda turganlar), `--all` — ilova orqali
kiritilgan hammasi, `--since YYYY-MM-DD`; quruq rejim sukut, `--send`
yuboradi. Bekor qilingan yozuv "BEKOR QILINDI" ko'rinishida ketadi.

### Yangi lid → Telegram "Lidlar" topigi (2026-09-07)

Bu oqim yuqoridagi ikkitasidan **alohida** turadi (`lib/leadNotify.ts`):

| | Kassa oqimi | Lid xabari |
| --- | --- | --- |
| Qachon | kunlik cron + `after()` | faqat `after()`, **darhol** |
| Google Sheets | ha | **yo'q** |
| Filial | qamrovda | **hammasi** (foydalanuvchi so'rovi) |
| Qayta urinish | `sync_outbox` orqali | yo'q — xato faqat jurnalga yoziladi |

Shu sabab `SyncKind` ga beshinchi qiymat qo'shilmadi: outbox, reconcile va
Sinxronizatsiya sahifasi lid uchun "qaysi jadval?" degan savolga javob
berishi kerak bo'lardi. Faqat yuboruvchi qayta ishlatiladi
(`lib/sync/telegram.ts` — 429 va 5xx uchun qayta urinish o'sha yerda).

Sozlamalar:

| O'zgaruvchi | Ma'nosi |
| --- | --- |
| `TELEGRAM_CHAT_LEADS` | "Lidlar" guruhining id'si — filial topiklari shu guruhda. Ko'rsatilmasa `TELEGRAM_CHAT_PAYMENTS` ishlatiladi (eski o'rnatma: lid topigi to'lovlar guruhida edi). |
| `branches.leadTopicId` | **Filialning o'z topigi** (bazada, muhit o'zgaruvchisi emas — quyida). |
| `TELEGRAM_TOPIC_LEADS` | Topigi biriktirilmagan filial uchun UMUMIY topik. **Bo'sh bo'lsa bunday lid umuman yuborilmaydi** — umumiy oqimga aralashib ketgandan ko'ra jim turgani yaxshi (jurnalga `[leadNotify] … topigi yo'q` yoziladi). |
| `TELEGRAM_WEBHOOK_SECRET` | Status tugmalari uchun (quyida). **Bo'sh bo'lsa tugmalar ishlamaydi.** |

### Har filialga o'z topigi (2026-09-12)

Markaz so'rovi: "1-filialdan tushayotgan lidlar filial 1 lidlar topigiga,
filial 2 dagilar filial 2 ga tushsin". Lidlar uchun **alohida forum-guruh**
ochildi, unda har filialga bittadan topik.

Filial → topik bog'lanishi **`branches.leadTopicId`** da (Boshqaruv →
Filiallar → tahrirlash → "Telegram lid topigi"). Nega bazada, `.env` da
emas: bu filialning o'z xususiyati — yangi filial qo'shilganda topik ham
shu yerda biriktiriladi, serverga kirib `.env` tahrirlash va qayta ishga
tushirish shart emas. Ro'yxatda topigi yo'q filial sariq belgi bilan
ko'rinadi. Maydon raqamni ham, Telegram'dan nusxalangan topik havolasini
ham (`https://t.me/c/<guruh>/<TOPIK>/…`) qabul qiladi.

Tartib (`lib/leadNotify.ts` → `leadThreadId`): filial topigi → bo'lmasa
`TELEGRAM_TOPIC_LEADS` → u ham bo'lmasa yuborilmaydi.

**Bir marta sozlash** (`scripts/telegram-branch-topics.mjs`):

1. Yangi guruh: "Topics" yoqiladi, bot **admin** + "Manage Topics" huquqi
   bilan qo'shiladi.
2. Serverdagi `.env.local` ga `TELEGRAM_CHAT_LEADS=<yangi guruh id>`;
   `TELEGRAM_TOPIC_LEADS` eski guruhning topigi bo'lsa — **bo'shatiladi**
   (topik raqami guruhga bog'liq, yangi guruhda u "message thread not
   found" beradi). Keyin `pm2 reload crm`.
3. `node scripts/telegram-branch-topics.mjs --create` — topigi yo'q har
   filial uchun bot guruhda topik ochadi (nomi = filial nomi) va raqamini
   bazaga yozadi. Bot API topiklar ro'yxatini bermaydi, webhook tufayli
   `getUpdates` ham yopiq — shuning uchun bot o'zi ochgani eng ishonchli.
   Qo'lda ochilgan topik bo'lsa: `--set <filial id> <raqam yoki havola>`.
4. `--test` — har topikka bittadan sinov xabari. Argumentsiz — holat.

Skript bazaga yozadi, ya'ni **prod uchun serverda** yurgiziladi
(`/var/www/crm/current`); lokal `.env.local` Atlas ko'zgusiga qaraydi.

Skript umumiy: `--leads` (sukut) va `--payments` — to'lovlar uchun
`branches.paymentTopicId`, guruh `TELEGRAM_CHAT_PAYMENTS`, topik nomi
"<filial> to'lovlari" (yuqoridagi "To'lov — kassa filialining topigiga").

Ishga tushdi 12.09.2026: guruh "Akademiya Lidlar", topiklar 1→10, 2→11,
3→12, 4→13. Eski guruhdagi 85 lid (07.09 dan beri) yangi guruhga
**bazadan qayta yuborildi** — `scripts/resend-leads-telegram.mjs`
(argumentsiz quruq rejim, `--send` yuboradi, `--since DD.MM.YYYY`,
`--all`). Bot API xabarni o'qiy/ko'chira olmaydi va eski xabarlarning
id'lari saqlanmagan, shu bois "ko'chirish" — matnni `leadMessage` bilan
qayta yig'ib yuborish; xabar jonli lid bilan bir xil (status, tugmalar).
Bitta guruhga daqiqasiga ~20 xabar chegarasi — har xabardan keyin 3.1 s.
Ilova filial hujjatini har lidda o'qiydi — topik o'zgarganda qayta ishga
tushirish kerak emas. Status tugmalari o'zgarishsiz ishlaydi: webhook
xabarni `callback_query` dagi chat id bo'yicha tahrirlaydi, eski guruhdagi
xabarlar ham ishlayveradi.

### Lid statusi — guruhdagi tugmalar

Har bir lid xabarining tagida to'rtta tugma turadi (`lib/leadStatus.ts`):
🟢 Birinchi darsga yozildi · 🕒 Keyinroq keladi · 💳 O'qish niyatida /
to'lov qilmoqchi · ❌ Rad etdi. Bosilgani xabarning sarlavhasi ostidagi
`Status:` qatorini almashtiradi; hech biri bosilmagan bo'lsa u yerda
"⚪ Hali bog'lanilmadi" turadi.

Oqim: tugma → Telegram `callback_query` → `POST /api/telegram/webhook` →
`orders.leadStatus` yoziladi → xabar `editMessageText` bilan qayta
chiziladi (tugmalar joyida qoladi, status keyin ham o'zgartiriladi).

`orders.leadStatus` buyurtmaning `status` maydonidan ALOHIDA: u CRM'dagi
ish jarayoni ("Yangi", "Qabul qilindi" …), bu esa aloqa natijasi.

**Bir marta sozlash** (aks holda tugmalar bosilganda hech narsa bo'lmaydi):

1. `TELEGRAM_WEBHOOK_SECRET` — uzun tasodifiy satr, `.env.local` VA Vercel
   > Environment Variables ga qo'yiladi.
2. `APP_BASE_URL` saytning tashqi HTTPS manzili ekanini tekshiring.
3. `node scripts/set-telegram-webhook.mjs` (holatni ko'rish: `--info`,
   o'chirish: `--delete`).

Webhook `allowed_updates: ["callback_query"]` bilan ro'yxatdan o'tadi —
guruhdagi oddiy xabarlar serverga umuman yuborilmaydi.

### Qanday ishlaydi

```
Kassir "Kirim" bosdi
  → transaction_entries  (asosiy yozuv + createdAt)
  → sync_outbox          (status: pending)
  → after() — javob ketgandan keyin, kassirni kutdirmay
       → Google Sheets qatori + Telegram xabari
       → status: done
  ✗ xato bo'lsa pending qoladi → keyingi to'lovda yoki kunlik cron'da qayta yuboriladi
```

**Kunlik cron** (`/api/sync/cron`, `vercel.json` da `0 22 * * *` = Toshkent
03:00) ikki ish qiladi: navbatni bo'shatadi, keyin jadvalni baza bilan
solishtiradi. Natija `sync_runs` ga yoziladi va **Moliya →
Sinxronizatsiya** sahifasida ko'rinadi (Telegram'ga yuborilmaydi —
kelishuv shunday).

### Asosiy fayllar

| Fayl | Vazifa |
| --- | --- |
| `lib/sync/config.ts` | `.env` kalitlari, `SYNC_ENABLED`, sozlama kamchiliklari |
| `lib/sync/googleSheets.ts` | Sheets API v4 — `googleapis` paketisiz, JWT `node:crypto` bilan |
| `lib/sync/telegram.ts` | Bot API, HTML eskeypi, 429 bilan ishlash |
| `lib/sync/lookups.ts` | Filial / lavozim / guruh bog'lash (keshlangan) |
| `lib/sync/mappers.ts` | Yozuv → jadval qatori va Telegram matni |
| `lib/sync/outbox.ts` | Navbat: `enqueue`, `claimPending`, `recordOutcome` |
| `lib/sync/dispatch.ts` | Yuborish; `flushSoon()` — `after()` ichida |
| `lib/sync/reconcile.ts` | Jadval ↔ baza solishtirish |
| `lib/sync/run.ts` | To'liq sikl (cron ham, qo'lda ham shuni chaqiradi) |

### Sozlash

1. `.env.example` dagi yangi kalitlarni `.env.local` ga ko'chiring.
2. `node scripts/sync-get-chat-id.mjs` — Telegram guruh id'larini topadi.
3. Google jadvallarni service account emailiga **Editor** qilib share qiling.
4. `node scripts/sync-backfill.mjs` — eski yozuvlarni jadvalga ko'chiradi
   (**Telegram'ga yubormaydi**).

Varaq (tab) va sarlavha qatorini kod o'zi yaratadi — qo'lda yozish shart emas.

### Tuzoqlar — kelajakda vaqt yeydiganlar

- **Filial `transaction_entries` da yo'q.** U faqat `hr_employees` da bor.
  Shuning uchun to'lov filiali **kassir orqali** aniqlanadi
  (`lookups.ts` → `branchOfPayment`). Kassaga filial maydoni qo'shilsa,
  shu bitta funksiyani o'zgartirish yetadi.
- **Chiqim yozuvida xodim ismi `studentName` da turadi** — g'alati, lekin
  bazadagi mavjud kelishuv shunday (`adjust/route.ts`).
- **`valueInputOption=RAW` majburiy.** `USER_ENTERED` bo'lsa Google
  "26.08.2026" ni sanaga aylantirib, o'qiganda seriya raqami qaytaradi va
  solishtirish har kuni "farq bor" deb butun jadvalni qayta yozadi.
- **`signatureOf` ga ustunlar soni beriladi.** Google o'ngdagi bo'sh
  kataklarni tashlab yuboradi, ya'ni o'qilgan qator kaltaroq keladi.
  Ustunlar sonisiz oxirgi ustun noto'g'ri kesilardi.
- **Varaq nomida apostrof bor** ("To'lovlar") — A1 notatsiyasida u
  ikkilantirilishi shart (`quoteSheetName`).
- **Navbat oldin, solishtirish keyin.** Teskari bo'lsa solishtirish
  navbatdagi yozuvni "yetishmayapti" deb qo'shadi, keyin navbat yana
  qo'shadi → dublikat.
- **Import kodi `logEntry(db, entry, { notifyTelegram: false })`
  ishlatishi SHART** — aks holda edutizim tarixini yuklashda guruhga
  minglab xabar ketadi.
- **`SYNC_ENABLED=false`** — butun modul jim turadi, kassa avvalgidek
  ishlayveradi. Sinxron buzilsa ham to'lov qabul qilish to'xtamaydi.
- **`_` bilan boshlangan papka Next'da route bo'lmaydi** (private folder).
  `app/api/sync/_selftest` 404 bergani shundan edi.

## SMS havolasi va jinsni avtomatik aniqlash (2026-09-09)

### 1. Faollashtirish SMS'i tizimli24.uz ga olib boradi

`activationMessage()` (`lib/invite.ts`) havolani `APP_BASE_URL` dan
qurardi, u esa Vercel'da texnik domenga
(`crm-akademiya-777777.vercel.app`) sozlangan — SMS'da odam tanimaydigan
o'sha manzil ketardi, ustiga 14 belgi uzunroq (SMS uzunligi segment
narxiga ta'sir qiladi).

Endi manba alohida: `PUBLIC_SITE_URL`, sukut qiymati **qattiq yozilgan**
`https://www.tizimli24.uz`. Ataylab shunday — sozlanmagan holatda ham
to'g'ri manzil chiqsin, SMS matni Vercel oynasidagi qiymatga bog'liq
bo'lib qolmasin. (O'lchandi: `tizimli24.uz` → **308** → `www.` bilan,
ya'ni kanonik shakl aynan `www.tizimli24.uz`.)

`APP_BASE_URL` o'chirilmadi — uni skriptlar ishlatadi
(`set-telegram-webhook.mjs`, `sync-backfill.mjs`).

### 2. Jinsi ism-familiyadan avtomatik tanlanadi

Xodim qo'shishda Ism + Familiya yozilgach `Jinsi` maydoni sun'iy intellekt
modeli orqali o'zi to'ldiriladi (`POST /api/gender-guess`, mantiq
`lib/genderGuess.ts` da).

Qoidalar — maydon TAKLIF beradi, majburlamaydi:

- **qo'lda tanlangan jins hech qachon bosilmaydi** (`genderTouched`).
  Bo'sh maydonni tekshirish yetmasdi: odam "Erkak" deb qo'yib keyin
  familiyani tuzatsa, taxmin uning tanlovini jimgina almashtirardi;
- **tahrirlashda umuman ishlamaydi** — saqlangan jins taxminga
  almashmasin;
- so'rov **kechiktirilgan** (700 ms), ya'ni har harfda API'ga chiqmaydi;
- kalit sozlanmagan yoki so'rov yiqilgan bo'lsa maydon **bo'sh qoladi** va
  route baribir `200` qaytaradi — xodim qo'shish hech qachon shu so'rovga
  bog'lanib qolmasin. Sabab javobdagi `reason` da va brauzer konsolida
  turadi (eng ko'p uchraydigani — model nomi noto'g'ri).

| O'zgaruvchi | Ma'nosi |
| --- | --- |
| `OPENAI_URL_API` | API kaliti. **Bo'sh bo'lsa maydon qo'lda to'ldiriladi.** |
| `OPENAI_MODEL` | Model nomi. Sukut — `lib/genderGuess.ts` dagi qiymat. |
| `OPENAI_BASE_URL` | Proksi orqali ishlatilsa. Sukut `https://api.openai.com/v1`. |

Kalit **serverda qoladi** — klient faqat ismni yuboradi.

So'rov tanasi ataylab eng oddiy shaklda: `temperature`, `max_tokens` va
`response_format` **yuborilmaydi**. Yangi modellar ularning bir qismini
rad etadi (masalan `max_tokens` o'rniga `max_completion_tokens` talab
qiladi) va model almashtirilganda so'rov jimgina buzilardi.

Sinov (tarmoqqa chiqmaydi):

```
node --import ./scripts/_ts-alias.mjs scripts/_test-gender-parse.mjs
```

> TUZOQ: `"female"` ichida `"male"` bor. `includes("male")` bilan yozilsa
> har bir ayol erkakka aylanib ketardi — shuning uchun so'z chegarasi
> (`\bmale\b`) va "female" birinchi tekshiriladi. Sinovda shu holat bor.

## Ikki bosqichli kirish va "Vaqtinchalik" filtrlari (2026-09-09)

### Ikki bosqichli kirish

Jadvaldagi "2 bosqich" ustuni OLIB TASHLANDI va tugmacha **SMS yuborish
oynasiga** ko'chdi. Sabab: qaror aynan taklif yuborilayotganda qabul
qilinadi. Ustun bo'lganda u SMS'dan mustaqil o'zgarardi va "yoqilgan,
lekin taklif eski qoida bilan ketgan" degan chalkash holat chiqardi.

Oqim: admin SMS'ni tugmacha yoqiq holda yuboradi → xodim havoladan o'tib
**parol qo'yadi** (`status: "active"`) → lekin **tizimga kira olmaydi**,
ruxsat kutib turadi → admin "Vaqtinchalik" sahifasida **✓** bosgach
kiradi (**✗** bosilsa kirmaydi).

Maydon: `users.adminApproval` = `pending` | `approved` | `rejected`
(`lib/adminApproval.ts`). **Maydon yo'q = tekshiruv yo'q** — mavjud hamma
hisob avvalgidek ishlaydi, cheklov faqat ongli ravishda yoqilgan xodimga
tegadi.

`users.status` ga to'rtinchi qiymat qo'shilmadi: u faollashtirish oqimi
bilan bog'langan (`invited` → `active`) va uni o'nlab joy o'qiydi.
Tasdiq — ALOHIDA o'lchov.

Tekshiruv UCH joyda, chunki uchtasi uch xil savolga javob beradi:

| Joy | Nima uchun |
| --- | --- |
| `app/api/auth/login` | kirishga yo'l qo'ymaydi (parol solishtirilgandan KEYIN — aks holda begona odam "bu raqamda hisob bor" ma'lumotini olardi) |
| `lib/auth.ts` | sahifalar — admin ALLAQACHON kirgan xodimni rad etsa, u cookie muddati tugaguncha ichkarida qolardi |
| `lib/rolePermissions.ts` | `/api/*` — o'sha sabab, proxy yo'lida |

Xato matni "parol noto'g'ri" DEMAYDI: parol to'g'ri va odam uni qayta-qayta
terib o'tirmasligi kerak.

### Filtrlar

Uchta ALOHIDA select (bittaga qo'shilsa "1-filialdagi arxivdagi tasdiq
kutayotganlar" kabi savolga javob berib bo'lmasdi):

| Select | Variantlar |
| --- | --- |
| Filial | Barcha filiallar / har biri (xodim bir nechta filialda bo'lishi mumkin — a'zolik tekshiriladi) |
| Holat | Aktiv / Arxivda |
| Hisob | Hisob yo'q / SMS ketgan — hali faollashmagan / Tasdiq kutmoqda / Rad etilgan / Faollashgan |

## Xodimlar boti: kassa amallari Telegram'dan (2026-09-18)

@tizimli_akademiya_bot — o'sha bot (guruhlarga to'lov/oylik/lid xabarlari,
lid tugmalari) — endi kassir bilan SHAXSIY yozishmada ham ishlaydi.
Foydalanuvchi bilan kelishilgan: 6 tugma (Kirim · Chiqim · Ko'chirish ·
Lid qo'shish · Kassam · Chiqish), kirish web'dagi telefon + parol bilan,
yozuv uchta joyga ketadi (VPS baza, Google Sheets, Telegram guruh).
Bosqichlar (hammasi 18.09.2026 da qilindi, har biri alohida commit):
1) kirish + Kirim + Kassam; 2) Chiqim; 3) Ko'chirish + qabul ✓/✗; 4) Lid —
har birining tafsiloti pastda.

### Qanday ishlaydi

- **Yadro bitta.** Kirim/Chiqim mantiqi `app/api/cashboxes/[id]/adjust`
  dan `lib/cashboxAdjust.ts` ga ko'chdi; route yupqa qobiq. Bot HTTP
  route'ni chaqirmaydi (sessiya cookie'si yo'q), aynan shu funksiyani
  chaqiradi — chegara tekshiruvlari (oylik/karta, o'quvchi balansi),
  jurnal, `transactions`, Sheets/Telegram navbati, o'quvchi botiga xabar
  web bilan bir xil. Yagona farq — yozuvda `origin: "telegram"`
  (`lib/transactionEntries.ts`), "Bugungi yozuvlar" da 🤖 belgisi.
- **Kirish** (`lib/staffBot/auth.ts`) — `POST /api/auth/login` ning
  nusxasi: `users.phone` + `passwordHash`, `status`, `adminApproval`.
  Parol yozilgan xabarni bot DARHOL o'chiradi (`deleteMessage`; shaxsiy
  chatda kiruvchi xabarni o'chirishga Telegram ruxsat beradi). 10 daqiqada
  5 muvaffaqiyatsiz urinish → qulf (`lib/telegramAttempts.ts`).
- **Ruxsat va kassa HAR AMALDA qayta yechiladi** — `users.status`,
  `/finance-cash` ruxsati (`resolvePermissions`), kassa `moderator` ism
  bo'yicha. Admin uchun sukut — bosh kassa, "Kassani almashtirish" bilan
  boshqasi. CRM'da bloklangan xodim botda ham keyingi bosishda to'xtaydi.
- **Holat bazada** (`staff_bot_users.draft`) — qoralama 30 daqiqa yashaydi.
  Tasdiq tugmasi bir martalik kalit bilan (`nonce`): Telegram
  yangilanishni takror yuborsa `claimDraftForSave` ikkinchisini rad etadi —
  pul ikki marta yozilmaydi.
- **O'quvchi qidiruvi** web'dagi navbar qidiruvi bilan bitta filtr
  (`lib/pupilSearch.ts`), qamrov — kassaning filiali (o'quvchilar hovuzi
  bilan). Tanlangan o'quvchining ustozi ID orqali guruhidan olinadi
  (`pupilGroupInfo`) va yozuvga aynan shu ustoz tushadi.
- Sana doim bugun (Toshkent); orqaga sana va bekor qilish — web'da.

### Fayllar

`lib/staffBot/` — `config` (token = `TELEGRAM_BOT_TOKEN`), `session`
(`staff_bot_users`), `auth`, `attempts`, `api` (yuborish/tahrirlash/o'chirish),
`keyboards` (`s:` prefiksli kalitlar — lid tugmalari `lead:` bilan
to'qnashmaydi), `views`, `data`, `screen`, `kirim` (oqim), `router`.
Webhook: `app/api/telegram/webhook/route.ts` — `lead:` tugmalar eskicha,
qolgani routerga; guruh xabarlari tashlanadi.

### Sozlash (deploydan keyin, bir marta)

1. `node scripts/set-telegram-webhook.mjs` — `allowed_updates` endi
   `["callback_query", "message"]`. ESKI sozlama qolsa bot xabarlarni
   KO'RMAYDI (`--info` da "qabul qilinadi: callback_query" bo'lsa — shu).
2. `node scripts/set-telegram-webhook.mjs --commands` — `/start /kassa /chiqish`.
3. Kassir botga `/start` yozadi → raqam → parol.

Sinov (Telegram'ga yubormaydi, faqat terminalda chizadi):
`node --experimental-transform-types --import ./scripts/_ts-alias.mjs scripts/_diag-staff-bot.mjs --as 998941558855`
(`--phone … --password …` — haqiqiy kirish; `--apply` — tasdiqni ham bosadi,
PUL YOZILADI va lokal `.env` prod kalitlariga qarasa haqiqiy guruhga xabar ketadi).

### Tuzoqlar

- Kassa `moderator` ismi `hr_employees.name` bilan AYNAN (katta-kichik
  harfsiz) mos bo'lishi shart — "Najmiddin turgunpolatov" ≠ "Najmiddin
  Turg'unpo'latov": bunday kassir botda "kassa biriktirilmagan" ko'radi
  (web'da ham ko'rmaydi). Sinov kassasi (#9) aynan shunday.
- Bot guruhlarda admin — `message` yoqilgach guruhdagi har xabar webhook'ga
  keladi; router `chat.type !== "private"` ni darhol tashlaydi.
- `lib/auth.ts`/`lib/branchScope.ts` `next/server`, `next/headers` ni
  import qiladi — Node skriptida `scripts/_ts-alias-hooks.mjs` ularni
  `next/server.js` ga o'giradi; `lib/sync/dispatch.ts` dagi parameter
  property uchun `--experimental-transform-types` shart.

### 2-bosqich — Chiqim (2026-09-18)

`lib/staffBot/chiqim.ts`. Web'dagi Chiqim oynasi bilan bir xil qoidalar:
tur (HAMMA 24 tur, 8 tadan sahifalab — foydalanuvchi qarori) → KIM
(`txTarget`: xodim / o'quvchi / hech kim) → to'lov turi (faqat kassada
qoldig'i borlari, tugmada qoldiq) → summa → izoh → tasdiq.

- **Avans/Oylik** (`isEmployeePayoutCategory`): xodim tanlangach oylik
  hisobi ko'rsatiladi (`employeeSalaryInfo` — `buildPayrollRows` +
  `lib/salary.ts`, server bilan aynan bir xil): hisoblangan · soliq ·
  karta · olingan → "chiqarish mumkin: naqd X · plastik Y". Chegara
  to'lov turiga bog'liq (naqd `payrollCashLeg`, plastik `payrollPayout`),
  shu bois to'lov turi SUMMADAN OLDIN so'raladi. **"Oylik"** da summa
  qo'lda terilmaydi — qoldiqning o'zi (18.09 qoidasi), to'g'ridan-to'g'ri
  izohga o'tadi. Qoldiq 0 bo'lsa sabab aytiladi ("karta qoplanmagan" /
  "oylik chiqarilgan") va boshqa to'lov turi tanlanadi. Oyligi sozlanmagan
  xodimga chegara yo'q (server ham shunday).
- **O'quvchiga pul qaytarildi**: balans (`studentPaidBalanceByName`) va
  ustoz (`refundTeacherOf` — oxirgi to'lovdan) ko'rsatiladi, summa balansdan
  oshmaydi; yozuvga `teacherName` = o'sha ustoz.
- Boshqa xodim turlari (KPI, mukofot) — chegarasiz; oddiy xarajat — kim
  so'ralmaydi. "💯 Hammasi" tugmasi faqat chegarali turlarda (oddiy
  xarajatda "hammasi" butun kassa bo'lardi).
- Yozuv: `studentName` = kim (xodim ham, o'quvchi ham — web kelishuvi),
  `teacherName` = xodim / qaytarish ustozi. Chiqim guruhga alohida xabar
  bo'lib ketmaydi (`TELEGRAM_KINDS` faqat `payment`), faqat Sheets.
- Xodim qidiruvi (`searchEmployees`): ism/telefon, faqat faollar
  (`archReason` bo'sh), filialga kesilmaydi (`/api/hr-employees/ref` kabi).

Sinov: `--flow chiqim --type "Avans" --person Nilufar --method Naqd --amount 150000`
(`--type Oylik --method Plastik` — qulflangan summa; `--type "O'quvchiga pul
qaytarildi" --person "93 065 34 35"` — balans chegarasi).

### 3-bosqich — Ko'chirish va qabul ✓/✗ (2026-09-18)

`lib/staffBot/transfer.ts`. Uch yo'l: **📤 Boshqa kassaga** (qabul qiluvchi
→ to'lov turi → summa → izoh → tasdiq; mavjud = qoldiq − tasdiq
kutayotgani; pul tasdiqgacha jo'natuvchida), **🔄 Turlar orasida** (qayerdan
→ qayerga → summa → tasdiq; izohsiz — web oynasi ham so'ramaydi),
**📥 Kelayotganlar** (tasdiq kutayotgan ro'yxat, har qatorga ✅/❌; qaror
IKKI bosish — "rostdan ham?" ekrani).

- Yadrolar `lib/cashboxTransfer.ts` (`applyMethodTransfer`,
  `applyCashboxTransferTo`) — route'lardan ko'chirildi, route'lar yupqa
  qobiq. `lib/transferDecision.ts` ikkiga bo'lindi: `decideTransferAs(db,
  actor, …)` — sof qoidalar + CAS himoyasi; `decideTransfer` — sessiyali
  HTTP qobig'i. Bot aktorni bog'lanishdan beradi (`isAdmin`, `name`),
  `ownsCashbox` tekshiruvi o'sha.
- **Push** (`lib/staffBot/notify.ts` → `notifyTransferPending`): ko'chirma
  yaratilganda — web'dan ham, botdan ham (yadro `defer` ichida) — qabul
  qiluvchi kassaning egasi botda "📥 Ko'chirma keldi" xabarini ✅/❌ bilan
  oladi. Kimga: `staff_bot_users` da kirgan va (kassa `moderator` i
  nomiga mos | admin shu kassani tanlagan | admin tanlamagan va kassa
  bosh kassa). Tugma bosilganda ruxsat baribir qayta tekshiriladi.
- Kassam ekranida kelayotgan ko'chirma bo'lsa "📥 Kelayotganlarni
  tasdiqlash (N)" tugmasi chiqadi.
- Ko'chirma guruhga xabar bo'lib ketmaydi (faqat Sheets); qaror Sheets
  qatorining holat ustunini yangilaydi (`flushSoon` `defer` da).

Sinov: `--flow transfer --method Naqd --amount 500000`, `--flow methods
--method Terminal --amount max`, `--flow inbox` (✓ so'rovigacha; 2-bosish
faqat `--apply` bilan).

### 4-bosqich — Lid qo'shish (2026-09-18)

`lib/staffBot/lead.ts`: o'quvchi (CRM'da MAVJUD o'quvchi — web oynasi ham
ro'yxatdan tanlatadi; telefon o'sha yozuvdan; topilmasa "avval web'da
qo'shing") → kurs (`offline_courses`) → dars kunlari (Toq / Juft / Har
kuni) → izoh → tasdiq. Oynadagi ixtiyoriy maydonlar (referal, boshlanish
vaqti, o'qituvchi, guruh, birinchi dars) botda so'ralmaydi — CRM'da
to'ldiriladi.

- Yadro `lib/ordersCreate.ts` (`createOrder`) — `POST /api/orders` dan
  ko'chirildi: id, filial ichidagi raqam (`branchNo`), manba o'quvchi
  yozuvidan (`pupilSourceFor`), Telegram "Lidlar" topigi (`notifyNewLead`,
  `defer` ichida). Route yupqa qobiq: muallif sessiyadan, filial cookie'dan.
- Botda muallif = kassir ismi, filial = kassaning filiali (yo'q bo'lsa
  xodimning birinchi filiali → bazadagi birinchi filial;
  `employeeBranchIds`/`allBranchIds` endi eksport qilinadi).
- Ruxsat: `/orders-list` (`StaffAccess.canLead`).

Sinov: `--flow lead --student "93 065 34 35"`.

Shu bilan 4 bosqich ham tayyor — 6 tugmaning hammasi ishlaydi.

## Uch tilli interfeys — i18n (2026-09-18)

Tillar: `uz` (lotin o'zbek — MANBA), `uz-cyrl` (kiril), `en`. `ru` olib
tashlandi. Til QURILMAGA bog'langan (localStorage + cookie), hisobga emas.
Foydalanuvchi ma'lumoti (ism, kurs, izoh) o'girilmaydi — faqat interfeys.

### Qanday ishlaydi

- **Kalit = o'zbekcha matn** (gettext uslubi): `const { t } = useT();`
  `t("Saqlash")`, `t("{n} ta o'quvchi", { n })`. Tarjima yo'q kalit
  o'zbekcha chiqadi — sayt hech qachon "yarim" bo'lmaydi.
- **Lug'at** `messages/en.json` (`"Saqlash": "Save"`); ko'plik ICU'ning
  kichik qismi bilan: `"{n, plural, one {# student} other {# students}}"`.
  Kalitlar alifbo tartibida saqlanadi.
- **Kiril lug'at EMAS** — `lib/translit.ts` lotin matnni qoida bilan
  o'giradi (sh→ш, o'→ў, so'z boshida e→э, tutuq→ъ, bosh harf saqlanadi);
  istisnolar (oylar — сентябрь, ц li so'zlar) shu faylda, qo'lda tuzatish
  kerak bo'lsa `messages/uz-cyrl.json`. Unlisiz so'zlar va brendlar (Ctrl,
  PDF, Excel, Telegram) lotincha qoladi. Sinov: `scripts/_translit-check.mjs`.
- **Til almashganda sahifa yangilanmaydi**: barcha matn klient
  komponentlarda, `useLang` store'iga obuna (`useSyncExternalStore`) —
  `setLang` hammasini shu zahoti qayta chizadi.
- **Birinchi chizish ham to'g'ri tilda**: `app/layout.tsx` `tizimli_lang`
  cookie'sini o'qib `LangProvider` ga beradi, `<html lang>` ham shundan.
  Narxi: har sahifa dinamik chiziladi (ilova baribir sessiyali).
- `lib/i18n.ts` — `translate()`, `MONTHS`/`WEEKDAYS`/`LOCALE` jadvallari
  (sana tanlagichlar uchun), `normalizeLang`, `htmlLang`.
  `components/shared/Language.tsx` — store, `LangProvider`, `useLang`, `useT`.

### Qoidalar (yangi kod yozganda)

- Matn `"use client"` komponentda `t()` orqali; server komponentda matn
  bo'lmasin (sahifalar faqat ma'lumot yuklaydi).
- `t` nomi BAND — sikl o'zgaruvchisini `t` deb nomlamang (TaskInboxModal da
  `task` ga o'zgartirildi).
- Konstantalardagi yorliqlar (`constants/sidebar.js`, `SOURCE_LABELS`,
  `OUTCOME_LABELS` …) o'zbekcha qoladi, chizishda `t(item.label)`.
- Server xato xabari toast'ga chiqsa `t(error)` — lug'atda bo'lsa o'giriladi.

### Skriptlar

- `node scripts/i18n-scan.mjs` — inglizchasi yo'q kalitlar (`--todo` →
  `messages/en.todo.json` skeleti, `--unused`, `--raw` — hali o'ralmagan JSX
  matnlar soni fayl bo'yicha).
- `node --experimental-transform-types --import ./scripts/_ts-alias.mjs scripts/_i18n-check.mjs`
  — `translate()` sinovi; `scripts/_translit-check.mjs` — kiril qoidalari.

### Bosqichlar

1) Yadro + til tanlovi + qobiq (navbar, sidebar, bildirishnomalar,
   topshiriq inbox, umumiy UI: tugmalar, sana/vaqt maydonlari, select,
   paginatsiya, modal, matn muharriri) — QILINDI 18.09.2026 (249 kalit).
2) Bo'limlar: Moliya → O'quvchilar → Guruhlar → Xodimlar → qolganlari.
3) API xato xabarlari va sahifa sarlavhalari.
