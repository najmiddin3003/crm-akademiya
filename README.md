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

---

# Sozlamalar bo'limi — holat va qolgan ishlar

Referens marshruti: `/settings/<bo'lim>?status=<tab>`
Bu loyihada: `/settings-<bo'lim>?tab=<tab>` (`constants/settings.js` — 8 bo'lim, 32 tab).

**Hozir: 32 tabdan 24 tasi qurilgan.** Kalitlar mosligini tekshirish:

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

## Qolgan 8 ta tab

Quyidagi tuzilishlar referens saytdan aynan ko'chirilgan (2026-08-03).

### 1. Chek — `system:check`

Referens: `/settings/system?status=check` · Bizda: `/settings-general?tab=check`

Ikkita ichki tab: **Moliya** va **Buyurtma**. Chapda sozlamalar, o'ngda **jonli chek namunasi**.

Sozlamalar:
- `Logo` (fayl yuklash)
- **Sarlavha**: `Matni` (text) · `Hajmi (px)` (number) · `Bold` (toggle)
- **Chek tag yozuvi**: `Matni` · `Hajmi (px)` · `Bold`
- `Chek tili` (select — O'zbekcha)
- `Auto Print` · `QR kodini ko'rsatish` · `Guruh va guruh darslarini vaqtini ko'rsatish` · `O'qituvchi ismini ko'rsatish` (toggle)
- `E'lon` (text)
- **Chekning sarlavhasi** (checkbox guruhi): Filial nomi · Sarlavha · Logotip
- **Tranzaksiya ma'lumotlari** (checkbox guruhi): Kassir Nomi · Kassir Raqami · O'quvchi Nomi · Sana · Kassa · Miqdor · To'lov Turi · Transaktsiya Turi · Izoh · Qolgan Qarzdorlik

Namuna ("To'lov ruxsatnomasi"): O'quvchi · Sana · To'lov turi · Izoh · To'lov · Guruh jadvali (Kurs kunlari) · O'qituvchi + Tel.

> Kerak: yangi `CheckSettingsTab.tsx` (jonli namuna bilan). Saqlash kalitlari: `system.check.finance`, `system.check.order`.

### 2. So'raladigan bo'limlar — `sale-marketing:field`

Referens: `/settings/sale-marketing?status=field` · Bizda: `/settings-sales?tab=field`

**Qolganlarining eng yengili** — mavjud `SettingsForm` ustiga ichki tab almashtirgich va `Qaytarish` tugmasi qo'shilsa yetadi.

Uchta ichki tab: `O'quvchi` · `Buyurtma` · `Birinchi darsga keladiganlar`.
Har birida bir xil 19 ta toggle:

Izoh · Familiya · Telefon raqam · Elektron pochta · Rasm · Kategoriya · Tug'ilgan sana · So'rovnoma · Til · To'lov sanasi · Uy manzili · Maqsad qilgan universitet · Tashkilot · Otasining ismi · Otasining telefon raqami · Otasining elektron pochtasi · Onasining ismi · Onasining telefon raqami · Onasining elektron pochtasi

Tugmalar: `Qaytarish` (standartga qaytarish) · `Saqlash`.
Saqlash kalitlari: `sales.field.student`, `sales.field.order`, `sales.field.first-lesson`.

### 3. Avto sms — `sale-marketing:auto-sms`

Referens: `/settings/sale-marketing?status=auto-sms` · Bizda: `/settings-sales?tab=auto-sms`

**Eng katta tab.** Yuqorida: `Avto sms yoqish` (toggle) · `Filiallar` (ko'p tanlov — `/api/branches` ga ulanadi).

Sakkizta stsenariy, har birida SMS matni + o'zgaruvchilar jadvali (`Key` / `Tavsif`):

| Stsenariy | Qo'shimcha sozlamalari | O'zgaruvchilar |
|---|---|---|
| Kurs puli to'lansa | — | `{name}` `{oldBalance}` `{balance}` `{amount}` |
| Darsga kelmasa | `Davomat holati` (select: Sababsiz) · «Yo'qlama qilgandan __ minut keyin» · «Ketma-ket __ marta kelmasa» · qabul qiluvchi: `Bolaga` / `Ota-onaga` | bola: `{name}` `{groupName}` `{teacherName}` · ota-ona: `{parentName}` + o'shalar |
| Tug'ilgan kunida | — | `{name}` |
| Yangi guruxga qo'shilganda | — | `{name}` `{groupName}` `{teacherName}` `{courseName}` `{days}` `{hours}` `{branchName}` `{subCourseName}` |
| Birinchi darsga kelish vaqti | «Nechi soat qolganda sms yuborilsin?» — `3` / `24` | `{name}` `{hours}` |
| Qarzdorlar | — | `{name}` `{balance}` |
| OTP | — | `{name}` `{otp}` `{phoneNumber}` |
| Ketma-ket davomat | — | `{name}` `{groupName}` `{teacherName}` `{consecutiveAttendanceCount}` |

Tugmalar: `Bekor qilish` · `Saqlash`.

> Kerak: `AutoSmsTab.tsx` — akkordeon + har stsenariy uchun matn maydoni va o'zgaruvchilar jadvali. Saqlash kaliti: `sales.auto-sms` (stsenariy kaliti bo'yicha ichma-ich obyekt).

### 4. Bot eslatmalari — `sale-marketing:bot-notes`

Referens: `/settings/sale-marketing?status=bot-notes` · Bizda: `/settings-sales?tab=bot-notes`

Chapda shablon formasi, o'ngda **jonli Telegram namunasi**, pastda mavjud shablonlar kartalari.

Forma: `Shablon nomi` · `Shablon turi` (select) · `Yuborish vaqti (minutda)` (number) · `Xabar matni` (textarea) · `Shablonni faollashtirish` (toggle) · `Orqaga` / `Saqlash`

Shablon turlari: `Dars boshlanishidan oldin` · `Dars davomida` · `Darsdan tugagandan keyin`

O'zgaruvchilar: `{groupName}` `{teacherName}` `{courseName}` `{days}` `{hours}` `{branchName}` `{subCourseName}`

Mavjud shablonlar (referensdagi 3 ta karta — nomi, Aktiv belgisi, vaqti, turi, `Tahrirlash` / `O'chirish`):
`Oldin - 10 daqiqa` (10 daq, dars boshlanishidan oldin) · `Keyin - 1 daqiqa` (1 daq, darsdan keyin) · `davomida - 60 daqiqa` (60 daq, dars davomida)

> Kerak: `BotNotesTab.tsx` + `settings-lists` ga `bot-templates` turi (matn maydoni uzun bo'lgani uchun `textarea` input turi qo'shilishi kerak).

### 5. Obuna — `system:billing`

Referens: `/settings/system?status=billing` · Bizda: `/settings-general?tab=billing`

Ikkita ichki tab: `Obuna` · `Gamifikatsiya to'lovi`.

Holat matni: «Hisobingiz `<sana>` yilgacha cheklovlarsiz sinov obunasida» · `O'quvchilar soni: 2000`

Tarif kartalari (o'quvchi soniga ko'paytiriladi): `1 oy` 1 500 000 · `3 oy` 4 500 000 · `6 oy (+1 oy)` 9 000 000 · `12 oy (+3 oy)` 18 000 000 UZS

O'ngda xulosa paneli: tanlangan muddat · amal qilish sanasi · `x 2000 o'quvchi uchun` · `Summa` · `To'lash` tugmasi.

> Asosan ko'rsatish sahifasi — haqiqiy to'lov integratsiyasi yo'q, tanlov va summa hisobi yetarli.

### 6. Ommaviy oferta — `system:public-oferta`

Referens: `/settings/system?status=public-oferta` · Bizda: `/settings-general?tab=public-oferta`

- **PDF fayl (zaxira nusxa)** — `Oferta fayli`, `Almashtirish`. «To'liq hujjatni ko'rish» havolasida ishlatiladi.
- **Bo'limlar** — CRUD ro'yxat, har bo'limda sarlavha + matn + `Majburiy` / `Ixtiyoriy`. Yuqorida `N ta bo'lim` hisoblagichi, `Yangi bo'lim qo'shish` tugmasi, bo'sh holatda «Hozircha bo'lim qo'shilmagan».
- Izoh: majburiy bo'limlarning barchasi tasdiqlanmaguncha o'quvchi ilovaga kira olmaydi.

> Kerak: `settings-lists` ga `oferta-sections` turi (`textarea` + `Majburiy/Ixtiyoriy` select) + fayl yuklash maydoni.

---

## Qurilmaydigan

**Gamifikatsiya** (`gamification:general`, `gamification:auto-coin`) — referensda ikkala tab ham butunlay bo'sh render bo'ladi. Obuna sahifasida «Gamifikatsiya to'lovi» alohida qator sifatida turibdi: bu **pullik qo'shimcha modul** va referens akkauntda yoqilmagan. Yoqilmaguncha xaritalab ham, qurib ham bo'lmaydi.
