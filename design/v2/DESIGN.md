# Tizimli v2 — dizayn tizimi

Yangi interfeys (v2) uchun kelishilgan qarorlar. Eski versiya bilan yonma-yon
quriladi va foydalanuvchi «Yangi / Eski versiya» o'rtasida almashadi; 1–2 oydan
keyin to'liq yangi versiyaga o'tiladi.

**Qiymatlar (hex, px) — faqat [`tokens.css`](tokens.css) da.** Bu yerda faqat nom,
vazifa va qoida: ikki joyda yozilgan qiymat vaqt o'tib farq qilib qoladi.
Kodda Tailwind klasslari: `bg-v2-surface`, `text-v2-text-2`, `rounded-v2-md` va h.k.

## Ranglar

Ikki tema: **yorug'** — asosiy rejim, **qorong'i** — kechki ish uchun. Har tokenning
ikkala temada o'z qiymati bor; komponent faqat token nomini ishlatadi.

### Yuzalar va chiziqlar

| Token | Dizayndagi nomi | Vazifasi |
|---|---|---|
| `--v2-bg` | Fon | Sahifaning umumiy foni |
| `--v2-surface` | Sirt | Kartochka, modal, jadval, panel |
| `--v2-surface-2` | Sirt 2 | Sirt ichidagi ikkinchi qatlam: jadval sarlavhasi, hover, ichki blok |
| `--v2-border` | Chiziq | Ajratgich chiziqlar, kartochka cheti |
| `--v2-border-strong` | Kuchli chiziq | Kuchliroq ajratish: guruh chegarasi, faol bo'lmagan tugma cheti |
| `--v2-border-field` | Maydon chizig'i | **Kiritish maydonlari** (input, select, checkbox) cheti |

### Matn

| Token | Dizayndagi nomi | Vazifasi |
|---|---|---|
| `--v2-text` | Matn | Asosiy matn, sarlavhalar |
| `--v2-text-2` | Matn 2 | Ikkinchi darajali matn, yorliqlar |
| `--v2-text-3` | Matn 3 | Izoh, placeholder, vaqt belgisi |

### Brend

| Token | Dizayndagi nomi | Vazifasi |
|---|---|---|
| `--v2-brand` | Asosiy | Asosiy tugma foni, faol holat, urg'u (yorug' — teal 600, qorong'i — teal 400) |
| `--v2-brand-bg` | Asosiy fon | Tanlangan qator, faol menyu bandi, yengil tugma («MohirAI») foni |
| `--v2-brand-text` | Asosiy matn | Havola va brend rangidagi matn (ayniqsa Fon va Asosiy fon ustida) |

**Teal shkalasi** (`--v2-teal-50` … `--v2-teal-900`) — brend rangining 10 pog'onasi,
ikkala temada bir xil. Qoida: **600 — yorug' temada tugma (oq matn bilan), 400 — qorong'i
temada tugma (to'q matn bilan)**. Brend tokenlari shu pog'onalarga bog'langan; boshqa
pog'onalar — grafik, progress, illyustratsiya uchun.

### Holatlar va logotip

| Token | Dizayndagi nomi | Vazifasi |
|---|---|---|
| `--v2-success` | Muvaffaqiyat | To'landi, saqlandi, faol |
| `--v2-warning` | Ogohlantirish | Muddat yaqin, e'tibor kerak |
| `--v2-danger` | Xavf | Xato, qarz, o'chirish |
| `--v2-info` | Ma'lumot | Ma'lumot xabari, neytral belgi |
| `--v2-violet` | Binafsha | Qo'shimcha urg'u (yorug'da «Ona tili» fan rangi bilan bir xil) |
| `--v2-logo` | Logotip | Logotip — ikkala temada bir xil |
| `--v2-on-brand` | — | Brend tugma ustidagi matn: yorug'da oq, qorong'ida to'q teal |
| `--v2-on-danger` | — | Xavf tugmasi ustidagi matn: yorug'da oq, qorong'ida to'q qizil |
| `--v2-on-color` | *(qo'shimcha)* | Boshqa rangli fon (holatlar) ustidagi matn: yorug'da oq, qorong'ida to'q |

### Fan ranglari — jadval va guruh kartalarida

Har fanga uchta token: `--v2-fan-<fan>` (nuqta / urg'u), `-bg` (chip foni), `-border`
(1px chegara). **Chip yozuvi — oddiy `--v2-text`**, fanning rangida emas.

| Kalit | Fan |
|---|---|
| `ingliz` | Ingliz tili |
| `ona` | Ona tili |
| `matem` | Matematika |
| `rus` | Rus tili |
| `arab` | Arab tili |
| `bio` | Biologiya |
| `tarix` | Tarix |
| `boshqa` | Qolgan hamma fanlar |

Qiymatlar dizayn rasmidan pikselma-piksel o'lchangan (fon va nuqta — aniq; qorong'i
chegara juda sezilmas — taxminiy).

## Tipografiya

Shrift — **Onest** (400 oddiy, 500 o'rta, 600 yarim qalin, 700 qalin; lotin va kirill).
Klass: `font-v2`.

| Klass | Vazifasi | O'lcham / qator · qalinlik |
|---|---|---|
| `text-v2-page` | Sahifa sarlavhasi | 24 / 32 · 600 |
| `text-v2-section` | Bo'lim sarlavhasi | 16 / 24 · 600 |
| `text-v2-body` | Asosiy matn | 14 / 20 · 400 |
| `text-v2-small` | Kichik matn | 13 / 18 · 400 |
| `text-v2-caption` | Izoh | 12 / 16 · 500 |
| `text-v2-number tabular-nums` | Raqam (summa, statistika) | 28 / 34 · 600, teng kenglik |

O'lchamlar `rem`da: sukut bo'yicha dizayndagi px bilan aynan bir xil, foydalanuvchi
shrift o'lchamini o'zgartirsa (sozlama) — birga o'zgaradi.

## Oraliq, burchak, soya

- **Oraliq — 4 px qadam**: 4, 8, 12, 16, 20, 24, 32, 48. Tailwind'ning o'z shkalasi
  (`p-1`…`p-12`); boshqa qiymat ishlatilmaydi.
- **Burchak**: `rounded-v2-sm` 6 px — kichik belgi; `rounded-v2-md` 8 px — tugma, maydon;
  `rounded-v2-lg` 12 px — karta, panel; `rounded-v2-full` — holat belgisi.
- **Soya**: `shadow-v2-sm` — kartalar; `shadow-v2-md` — menyu, oyna. Qiymatlar rasmdan
  o'lchangan (taxminiy model). Qorong'ida soya qora (menyu/oyna ostida aniq ko'rinadi),
  kartochkani esa asosan chegara ajratadi.
- **Kartochka**: `bg-v2-surface` + 1 px `v2-border` chegara + `rounded-v2-lg` (+ `shadow-v2-sm`) —
  ikkala temada ham chegara bor.

## Ikonkalar

Chiziqli ikonkalar (lucide), chiziq qalinligi **1.75 px**, o'lcham **16 / 20 px**.
**Interfeysda emoji ishlatilmaydi.** (Telegram bot xabarlari bundan mustasno — ular
bot uslubida qoladi.)

## Komponentlar

Har bir sahifa shu bloklardan yig'iladi. O'lchamlar dizayn rasmidan (rasm ~0.6×
kichraytirilgan — ±2 px aniqlik, 4 px to'riga yaxlitlangan); ranglar tekis yuzalardan
aniq o'lchangan va hammasi mavjud tokenlarga tushadi.

### Tugmalar

| Turi | Tokenlar | Misol |
|---|---|---|
| Asosiy | `bg-v2-brand text-v2-on-brand` | «+ Lid qo'shish» |
| Ikkinchi darajali | `bg-v2-surface border border-v2-border-strong text-v2-text` | «Export» |
| Matnli | fonsiz, `text-v2-text-2`; hover — `bg-v2-surface-2` | «Bekor qilish» |
| Xavf | `bg-v2-danger text-v2-on-danger` | «O'chirish» |
| Yumshoq | `bg-v2-brand-bg text-v2-brand-text` | «MohirAI» |
| Ikonka | kvadrat, ikkinchi darajali uslubda; eni = bo'yi | Filtr |

- **O'lcham**: Kichik 32 (`h-8`), **O'rta 36 (`h-9`) — sukut**, Katta 40 (`h-10`).
  Tailwind'ning 4 px shkalasi bilan aynan mos.
- **Burchak** `rounded-v2-md` (8 px); ikonka matndan chapda, 16 px.
- **O'chiq** (disabled): `bg-v2-surface-2 text-v2-text-3`, bosilmaydi.
- **Yuklanmoqda**: o'z rangida qoladi, chapda aylanuvchi ikonka, matn «…moqda...»
  (masalan «Saqlanmoqda...»), qayta bosilmaydi.

### Kiritish maydonlari

- Yorliq maydon ustida; maydon `bg-v2-surface`, chegara **`border-v2-border-field`**
  (rasmda o'lchandi), `rounded-v2-md`, balandligi ~40 (`h-10`, Katta tugma bilan teng).
- Placeholder — `text-v2-text-3`.
- **Fokus**: chegara `border-v2-brand` + `shadow-v2-focus` (3 px halqa, brend 22%).
- **Xato**: chegara `border-v2-danger`, ostida ikonka bilan xabar —
  `text-v2-caption text-v2-danger` («Raqam to'liq emas»).
- Turlari: matn, telefon (`+998 93 173 65 25` niqobi), tanlov (o'ngda pastga ko'rsatkich),
  sana (o'ngda kalendar ikonka), qidiruv (chapda lupa), izoh (ko'p qatorli).
- **Checkbox** belgilangan — `bg-v2-brand` + oq belgi; **Toggle** yoqilgan — iz `brand`,
  dumaloq oq tugmacha.

### Ko'rsatkich kartalari

- **Holat bo'yicha** — bitta kartochka ichida yonma-yon katakchalar (chegara `v2-border`):
  rangli nuqta + yorliq + raqam. **Bosilsa ro'yxat shu holatga filtrlanadi**; tanlangani
  `bg-v2-brand-bg`. Lid holatlari ranglari: Yangi `holat-yangi` (info), Bog'lanildi
  `holat-bog` (binafsha), Sinov darsi `holat-sinov` (ogohlantirish), Guruhga qo'shildi
  `holat-guruh` (muvaffaqiyat), Rad etdi `holat-rad` (xavf).
- **Pul ko'rsatkichi** (Moliya analitikasi): sarlavha, katta raqam
  `text-v2-number tabular-nums` + kichik «so'm», o'ngda ko'z ikonka (summalarni yashirish),
  ostida bo'lingan chiziqli grafik va izoh (kvadrat belgi + nom + summa, o'ngga tekislangan).
  Grafik ranglari tartib bilan `chart-1…4` — teal 600 / 400 / 300 / 200, ikkala temada bir xil.

### Tablar va almashtirgichlar

- **Tablar** (sahifa ichidagi bo'limlar): faol — `text-v2-text`, qalin, ostida 2 px
  `brand` chiziq; qolganlari `text-v2-text-2`; butun qator ostida `v2-border` chiziq.
- **Segment** (ko'rinishni almashtirish, masalan Kalendar / Jurnal / Pul oqimi):
  konteyner `bg-v2-surface-2` + `v2-border`, faol bo'lak `bg-v2-surface` + `shadow-v2-sm`.
- **Sahifalash**: chapda «1–50 / 580 ta» (`text-v2-text-2`), o'rtada sahifa tugmalari —
  faol `bg-v2-brand text-v2-on-brand`, qolganlari fonsiz; strelkalar ikkinchi darajali
  ikonka tugma; «…» oraliq; o'ngda qator soni tanlovi («50 qator»).

### Holat belgilari

Belgi = **och fon + shu rangdagi nuqta va yozuv**, `rounded-v2-full`, `text-v2-caption`.
Fon tokenlari: `--v2-info-bg`, `--v2-violet-bg`, `--v2-warning-bg`, `--v2-success-bg`,
`--v2-danger-bg` (brend uchun `--v2-brand-bg`, betaraf uchun `--v2-surface-2`).

| Guruh | Belgi | Rang |
|---|---|---|
| Lid holatlari | Yangi · Bog'lanildi · Sinov darsi · Guruhga qo'shildi · Rad etdi | `holat-*` (info · binafsha · ogohlantirish · muvaffaqiyat · xavf) |
| Guruh, topshiriq, xodim | Faol | muvaffaqiyat |
| | Yig'ilmoqda | brend (`brand-bg` + `brand-text`) |
| | Yakunlandi | muvaffaqiyat |
| | Bekor qilindi | betaraf (`surface-2` + `text-2`) |
| | Muzlatilgan | info |
| | Takroriy | nuqtasiz, oq fon + `border-strong` chegara, `text-2` |

**Teglar** (to'lov va ish turi: Naqd, Plastik, Terminal, Inkassa, Oklad, «Foiz 35%»,
«Oklad + 30%») — nuqtasiz, `bg-v2-surface-2` + `v2-border` chegara + `text-v2-text-2`,
`rounded-v2-sm`.

### Filtr paneli — 10+ ta dropdown o'rniga

- Bir qatorda: **qidiruv** («Ism yoki telefon...») + **«Filtr»** tugmasi + o'ngda «Jami N ta».
- «Filtr» tugmasida faol filtr soni (brend doirachada). Faol bo'lsa tugma
  `bg-v2-brand-bg` + `brand` chegara.
- Ostida **faol filtr chiplari**: «Filial: Akademiya 3 Uychi ×» — `bg-v2-surface-2` +
  `v2-border`, nomi `text-2`, qiymati qalin; har biri × bilan o'chadi; oxirida «Tozalash».
- Tugma bosilganda **ochiladigan panel** (`bg-v2-surface`, `shadow-v2-md`, `rounded-v2-lg`):
  ikki ustunli tanlovlar (Filial, Yo'nalish, Manba, Davr) va **holat chiplari** — tanlangani
  `bg-v2-brand-bg` + `brand` chegara + ✓, qolgani oq + `border-strong`. Pastda
  «Tozalash» (matnli) va «Qo'llash» (asosiy) — filtr «Qo'llash» bosilgandagina qo'llanadi.

### Bo'sh holat va yuklanish

- **Bo'sh holat**: `bg-v2-surface-2` blok ichida ikonka (oq kvadratda), sarlavha
  («Hozircha kurs yo'q»), bitta jumla izoh va asosiy amal tugmasi («+ Kurs qo'shish»).
- **Yuklanish — skelet**: «Yuklanmoqda...» matni O'RNIGA sahifaning shakli —
  `bg-v2-skeleton` doira va chiziqlar (ro'yxat qatorlari ko'rinishida).

### Xabarlar (toast)

- `bg-v2-surface` + `v2-border` + `shadow-v2-md`, `rounded-v2-lg`. Chapda dumaloq ikonka:
  muvaffaqiyat — `success-bg` fonda ✓, xato — `danger-bg` fonda «!».
- Sarlavha (qalin) + bir qator tafsilot («Muxlisa Xoshimjanova · 300 000 so'm · Naqd»).
- Muvaffaqiyatda o'ngda × (yopish); xatoda — **amal tugmasi** («Qayta urinish»,
  ikkinchi darajali) va nima qilish kerakligi («Internet aloqasini tekshirib, qayta urinib ko'ring»).

### Jadval

Qoidalar (dizayndagi izohdan):

1. **Sarlavhalar oddiy yozuvda** (KATTA HARFLAR EMAS), `bg-v2-surface-2`, `text-v2-text-2`.
2. **Ism va telefon bitta katakda**: ism qalin, telefon ostida `text-v2-text-3`.
3. **Bo'sh qiymat — chiziqcha** «—».
4. **Chek tugmasi** — to'lov va kassa jadvallarida **doim birinchi ustunda**, ism-familiyadan
   oldin: scroll qilmasdan ko'rinadi.
5. Qatorlar orasida `v2-border` chiziq. **Sichqoncha ustida**: qator `bg-v2-hover`, ism
   tagiga chiziladi, o'ng chetda amallar tugmasi («⋯», ikonka tugma) paydo bo'ladi.
6. Saralanadigan ustun sarlavhasida ko'rsatkich (masalan «Kelgan vaqti ↓»).
7. Takror lid — ism yonida «Takroriy» belgisi. Holat — holat belgisi.
8. Pastda: «1–5 / 29 ta lid» va sahifalash.

## Navigatsiya — yon menyu

Yon menyu sahifa foni ustida (`bg-v2-bg`), eni ~250 px (rasm ~0.75×), band balandligi ~36.
Ichki menyular hozirgidek yon tomonga ochiladigan panel EMAS — **joyida ochiladi** (akkordeon).

**Tepada:**
- Logotip (`--v2-logo` kvadratda oq ikonka) + «Tizimli» + menyuni yig'ish tugmasi.
- **Filial tanlovi** — kartochka (`surface` + `border`, `rounded-v2-lg`): chapda filial raqami
  (`brand-bg` kvadratda `brand-text`), nomi (qalin) va «Joriy filial» (`caption`, `text-3`),
  o'ngda ⇅. Hozir u yuqori paneldagi tanlovda — yangi versiyada menyuga ko'chadi.

**Bandlar:** ikonka (16–20 px) + nom (`text-v2-body`, `text-v2-text-2`); o'ngda son
(`text-v2-text-3`, masalan «Lidlar 29») yoki ochiladigan bo'lsa › (`text-3`).
**Bo'lim sarlavhalari** — `caption`, `text-3`. **Ochiq guruh** — nomi `text-v2-text` qalin,
ikonkasi `brand`, ichki bandlar o'ngga surilgan va chapda ingichka `v2-border` chiziq bilan
bog'langan; **faol ichki band** — oq kartochka (`surface` + `border`, `rounded-v2-md`),
yozuvi `text-v2-text` qalin; qolganlari `text-2`.

**Tuzilish (rasmdagi tartib) va hozirgi menyu bilan solishtirish:**

| Bo'lim | Band | Hozirgi saytda |
|---|---|---|
| — | Rahbar paneli › | **YO'Q — yangi** |
| — | Bosh sahifa | `/home` |
| — | Topshiriqlar | `/tasks` |
| O'quv jarayoni | Lidlar (son) › | Lidlar: `/orders-list`, `/first-lessons` |
| | Guruh › | Guruh (6 ta ichki band) |
| | O'quvchilar › | O'quvchilar (7 ta) |
| | O'quv bo'limi › | O'quv bo'limi (5 ta) |
| | Imtihon › | Imtihon (Sarhisob, UzBMB) |
| | Gamifikatsiya › | Gamifikatsiya (5 ta) |
| | — | **Blok test — yangi menyuda yo'q** |
| Moliya va sotuv | Moliya ⌄: Kassalar, Kirim-chiqim, Kunlik topshiruv, Shartnomalar | Moliya — 15 ta band 3 ustunda; **«Kunlik topshiruv» — yangi** |
| | Sotuv va marketing › | Sotuv va marketing (7 ta) |
| | Hisobotlar › | Hisobotlar (keng panel) |
| Jamoa va nazorat | Boshqaruv › | Boshqaruv (5 ta) |
| | Nazorat › | Nazorat (11 ta) |
| pastda | Sozlamalar · Amallar jurnali · Vaqtinchalik bo'lim · Texnik yordam | bor («Vaqtinchalik tugma» → «Vaqtinchalik bo'lim») |

Ochiq savollar (yangi bandlar, yo'qolgan bandlar, son nimani sanaydi) — `SAVOLLAR.md` 13–17.

## Navigatsiya — yuqori panel

Yon menyudan o'ngda oq panel (`bg-v2-surface`, chap chetida `v2-border`). Ranglar rasmdan
o'lchandi — hammasi mavjud tokenlar.

**Chapda — global qidiruv**: «O'quvchi, guruh yoki xodimni qidiring» — `bg-v2-surface-2` +
`v2-border`, chapda lupa, o'ngda «Ctrl K» belgisi (oq + `border` + `text-3`).

**O'ngda (tartib bilan):**
1. **«+ Yangi ⌄»** — ikkinchi darajali tugma, tezkor yaratish menyusi (hozirgi «Tezkor amallar»).
2. **«MohirAI»** — yumshoq brend tugma (AI yordamchi).
3. Ajratgich (`v2-border`).
4. Ikonka tugmalar (`text-v2-text-2`): tug'ilgan kunlar (tort), mening topshiriqlarim (ro'yxat ✓),
   bildirishnomalar (qo'ng'iroq; son — `bg-v2-danger` doirachada oq), yordam («?»).
5. **Foydalanuvchi**: avatar (`bg-v2-brand` doira, oq bosh harflar), ism (`text-v2-text`, qalin),
   lavozim (`caption`, `text-v2-text-3`), ⌄ — profil menyusi.

**Hozirgi yuqori paneldan farqi:**

| Hozir | Yangi versiyada |
|---|---|
| Filial tanlovi | yon menyu tepasiga ko'chdi |
| «Qidirish…» | «O'quvchi, guruh yoki xodimni qidiring» |
| «Tezkor amallar» (+ ikonka) | «+ Yangi ⌄» — yozuvli tugma |
| MohirAI — pastdagi suzuvchi robot tugma | yuqori paneldagi «MohirAI» tugmasi |
| Tug'ilgan kunlar, Topshiriq, Bildirishnomalar | o'z joyida |
| «Qanday ishlaydi?» | «?» yordam |
| «Orqaga», til tanlash, kun/tun rejimi, «Yangiliklar» | **ko'rinmaydi** — `SAVOLLAR.md` 18–21 |

## Sahifa qolipi — ro'yxat (O'quvchilar misolida)

Dizayndagi birinchi to'liq sahifa: yon menyu + yuqori panel + kontent. Kontent oq panelda
(`bg-v2-surface`), yon menyu sahifa fonida. Ikkala temadagi ranglar o'lchandi — yangi rang yo'q.

1. **Sarlavha bloki**: «O'quvchilar» (`text-v2-page`) + ostida «Akademiya 3 Uychi · jami 12 ta
   o'quvchi» (`small`, `text-2`). O'ngda: «Export» (ikkinchi darajali), «⋯» (ikonka — qo'shimcha
   amallar), **asosiy amal** «+ O'quvchi qo'shish».
2. **Filtr qatori**: qidiruv («Ism, telefon yoki ID») → **asosiy filtrlar doim ko'rinadi**
   (Kurs, Guruh, Holati — tanlov tugmasi ⌄; tanlansa «Guruh: Ingliz tili ×», `brand-bg` +
   `brand` chegara) → **«Yana filtrlar»** (ochiq paytida `brand` chegara). O'ng chetda
   **«Ustunlar»** — jadvalda qaysi ustunlar ko'rinishini tanlash.
3. **«Yana filtrlar» paneli** («Qo'shimcha filtrlar», o'ngda «10 ta filtr»): bo'limlarga bo'lingan,
   3 ustunli to'r —
   - *O'quv*: O'qituvchi, Subkurs, Kategoriya, Guruhlar soni, Kun, Toq/Juft kunlar;
   - *Manba va mas'ul*: Manba, Moderator;
   - *Oraliqlar*: Balans, so'm (dan — gacha), Tanga (dan — gacha).
   Pastda izoh «Kurs, Guruh va Holati — yuqorida doim ko'rinadi», «Tozalash», «Qo'llash».
4. **Xulosa qatori**: «6 ta o'quvchi • Qarzdorlik 0 so'm • Haqdorlik …» — `small`, `text-2`,
   raqamlar `text` qalin.
5. **Jadval**: belgilash (checkbox) ustuni; «O'quvchi» — avatar (`surface-2` doira, bosh harflar
   `text-2`) + ism (qalin) + telefon (`text-3`); saralanadigan ustun ⌄; o'ngda «⋯».
6. **Pastki qator**: «1–6 / 6 ta», sahifalash, «50 qator».

**Hozirgi sahifa bilan solishtirish** (`components/students/StudentsListPage.tsx`): hozirgi 12 ta
filtrning hammasi bor (3 tasi tepada, 9 tasi panelda); **yangi** — «Tanga» oralig'i, «Ustunlar»
tanlovi, xulosa qatori, qidiruvda ID.

**Filtrning ikki ko'rinishi**: lidlarda — bitta «Filtr» tugmasi (soni bilan) va hammasi panelda;
o'quvchilarda — 3 ta asosiy filtr tepada + «Yana filtrlar». Qaysi sahifada qaysi biri — `SAVOLLAR.md` 22.

## Qoidalar (kontrast tekshiruvidan, WCAG 2.1)

17.10.2026 da hamma juftlik hisoblandi (matn: AA ≥ 4.5; katta matn va UI chegarasi ≥ 3).

1. **Matn uchala darajada ham o'qiladi.** Matn / Matn 2 / Matn 3 — Fon, Sirt va Sirt 2
   ustida ikkala temada AA yoki undan yuqori (eng pasti: yorug'da Matn 3 / Fon — 4.79).
2. **Rangli tugma ustidagi matn — `on-brand` / `on-danger` / `on-color`.** Qorong'i temada
   rangli fonlar och: oq matn ularda **o'qilmaydi** (2.0–2.6). Dizayn har tugmaga o'z to'q
   tusini beradi — brend tugmada to'q teal (7.38), xavf tugmasida to'q qizil (7.39), ikkalasi
   AAA. Tugmada hech qachon qattiq `#FFF` yozilmasin.
3. **Havola Fon ustida — `--v2-brand-text`.** Yorug'da Asosiy rang Fon ustida 4.45
   (chegaradan biroz past); Sirt ustida 4.87 — u yerda Asosiy ham bo'ladi.
4. **Kiritish maydoni cheti — faqat Maydon chizig'i** (3.1:1). Chiziq va Kuchli chiziq
   (1.2–1.5:1) — faqat bezak/ajratgich; ular bilan maydon chegarasi ko'rinmay qoladi.
5. **Holat ranglari matn sifatida ham ishlaydi** — Fon, Sirt, Sirt 2 ustida ikkala temada AA.
6. **Fan chiplari**: yozuv o'z fonida 13.5–16.4 (AAA); nuqta rangi ham matn sifatida
   ishlaydi (yorug' 4.6–6.8, qorong'i 7.5–10.2).
7. **Holat belgilari**: holat rangidagi yozuv o'z och fonida AA — yorug'da 4.65–6.27,
   qorong'ida 6.24–8.23. Jadval hover qatorida matn 16.2 / 13.9, Matn 2 — 6.8 / 7.5.
8. Logotip ikkala temada ham fondan ajralib turadi (3.4–5.3:1).

## Kodda: versiya almashtirgichi va yangi qobiq (17.10.2026)

- **Tanlov** — cookie `tizimli_ui` (`v1` / `v2`), manzillar o'zgarmaydi: `lib/uiVersion.ts`
  (brauzer), `lib/uiVersionServer.ts` (server). Almashtirgich sinov saytida (Vercel,
  `VERCEL=1`), lokal dev'da va 17.10.2026 dan prod'da ham — server `.env.local` dagi
  `UI_V2_SWITCH=on` bilan (o'chirish: `off` yoki qatorni olib tashlash + qayta ishga
  tushirish). Hammaga ko'rinadi, sukut — eski versiya.
- **Qobiq** — `app/(app)/layout.tsx` versiyaga qarab eski `AppShell` yoki yangi
  `components/v2/shell/AppShellV2.tsx` ni beradi; sahifalarning o'zi (`children`) bitta.
- **Yon menyu va yuqori panel** — `components/v2/shell/SidebarV2.tsx`, `TopbarV2.tsx`.
  Menyu bandlari, ruxsatlar va havolalar eski menyu bilan BITTA manbadan
  (`components/shared/sidebarModel.ts` ← `constants/sidebar.js`); yangi menyudagi bo'lim,
  ikonka va nom — `components/v2/shell/sidebarSections.ts`.
- **`data-ui="v2"` faqat menyu va panelda.** Kontent hududida yo'q — eski sahifalar o'z
  shrifti va ranglarida chiziladi. Sahifa yangi dizaynga o'tganda uning o'z ildizi
  `data-ui="v2"` oladi.
- **Eski CSS tuzog'i:** `app/globals.css` dagi `input:focus { background: … !important }`
  yangi maydonga ham tushadi — yangi kirish maydonida fon `bg-transparent!` (yoki
  `focus:bg-…!`) bilan yoziladi.
- Eski sahifalar ikonkalarni eski sprite'lardan oladi (`<use href="#i-search">`) — ikkala
  qobiq ham `components/shared/ShellSprites.tsx` ni ulaydi.
- **O'tish davri belgilari** (`components/v2/shell/DevNotice.tsx`, 17.10.2026): logotip
  yonida doim «Beta» (`info-bg` + `info`); yuqori panel ostida ingichka qator — kalit
  ikonka, «Yangi versiya ishlab chiqilmoqda.» + izoh (faqat `xl` dan — doim bir qatorli),
  «Eski versiyaga qaytish» (`sm` dan) va × (kun oxirigacha yopiladi, cookie
  `tizimli_ui_notice` — server ham o'qiydi). Rang — «Ma'lumot», ogohlantirish emas.
  To'liq o'tishda ikkalasi olib tashlanadi.

## Ochiq savollar

Hammasi bir joyda — [`SAVOLLAR.md`](SAVOLLAR.md) (oxirida birga ko'rib chiqiladi).
