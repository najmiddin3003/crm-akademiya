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

## 1. Butun bir modul yo'q — "Blok test"

Referensda alohida top-level sidebar bo'limi, ichida 2 ta sahifa:
- **Blok test turlari**
- **Blok testlar**

Bizda: na `constants/sidebar.js`da, na `app/(app)/`da — hech qanday iz yo'q. Kerak:
1. `constants/sidebar.js`ga yangi top-level band (`key: "blok-test"`, ikkita submenyu bandi bilan)
2. `app/(app)/blok-test-turlari/page.tsx` va `app/(app)/blok-testlar/page.tsx` (yoki mos nomlar)
3. Tegishli `components/blokTest/*` va kerak bo'lsa `app/api/blok-test*` route'lari

> Referens sahifalarining ichki tuzilishi hali o'rganilmagan — keyingi qadam sifatida saytdagi
> shu ikki sahifani ochib, maydonlarini hujjatlashtirish kerak.

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
