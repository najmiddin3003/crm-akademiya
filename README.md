# CRM Akademiya

`akademiya.edutizim.uz` referens saytining Next.js 16 (App Router) ustidagi nusxasi.
Ma'lumotlar MongoDB'da, har bo'lim uchun `app/api/*/route.ts` orqali.

## Ishga tushirish

```bash
npm run dev
```

`.env.local` da kerak: `MONGODB_URI`, `MONGODB_DB` (standart — `crm_akademiya`).

Kolleksiya indekslari `lib/mongodb.ts` dagi `ensureIndexes()` da bir marta yaratiladi.
Ro'yxatlar bo'sh bo'lsa `constants/*.js` dagi seed'lardan to'ldiriladi.

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

**Tuzoq (ikki marta uchradi):** JSX'da `{expr} matn&apos;li-so'z` shaklida
yozilganda son bilan matn orasidagi **probel yo'qoladi** (`x 2000o'quvchi`,
`0ta bo'lim`). Yagona shablon-satrga o'tkazish kerak:
`{`x ${n} o'quvchi uchun`}`. Yangi kod yozganda shu shakldan qochiladi.


## Qurilmaydigan

**Gamifikatsiya** (`gamification:general`, `gamification:auto-coin`) — referensda ikkala tab ham butunlay bo'sh render bo'ladi. Obuna sahifasida «Gamifikatsiya to'lovi» alohida qator sifatida turibdi: bu **pullik qo'shimcha modul** va referens akkauntda yoqilmagan. Yoqilmaguncha xaritalab ham, qurib ham bo'lmaydi.

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

**Hali tekshirilmagan:** ilova ichidagi sahifalarning 375px'dagi ko'rinishi —
ular login talab qiladi, sessiyali brauzer esa o'sha paytda uzilgan edi.
Til/bildirishnoma/mavzu boshqaruvlari ham mobilda hamon yo'q (faqat profil
amallari qo'shildi).
