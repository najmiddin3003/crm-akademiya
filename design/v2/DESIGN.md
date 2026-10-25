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
   `brand` chegara) → **«Yana filtrlar»** (ikonka — kamayuvchi uch chiziq; yopiq va bo'sh
   paytida **uzuq** `border-strong` chegara, ochiq paytida `brand` chegara + fokus halqasi,
   filtr qo'llansa `brand-bg` + soni). O'ng chetda **«Ustunlar»** — pastdagi «Ustunlar oynasi».
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

## Tezkor panel — ro'yxatdan chiqmasdan (O'quvchi misolida, 18.10.2026)

Ro'yxatda qator (yoki ism) bosilganda o'ngdan ~420 px panel chiqadi: kompyuterda kontent
hududi ichida (yon menyu va yuqori panel ochiq qoladi), ro'yxat yarim shaffof fon bilan
xiralashadi, tanlangan qator `brand-bg` + chapda 3 px `brand` chiziq. Telefonda — butun ekran.
Fon bosilsa yoki Esc — yopiladi. Ctrl/Cmd + ism — to'liq profil yangi oynada.

1. **Sarlavha**: avatar, ism (`section`), holat belgisi + «kurs · xona» (`small`, `text-2`);
   o'ngda «to'liq profil» (chegarali ikonka) va × (chegarasiz).
2. **Amallar**: asosiy «To'lov qabul qilish» (keng), «SMS», qo'ng'iroq (ikonka), «⋯».
3. **Ko'rsatkich kartasi** — Balans | Tanga (bitta karta, ikki katak).
4. **Ma'lumotlar** — yorliq (`text-2`) va qiymat (qalin) ikki ustunda; telefon yonida «nusxa».
5. **Guruh** — sarlavha o'ngida «Guruhga qo'shish» (havola rangida); har guruh — karta:
   fan nuqtasi + kurs (qalin) + guruh holati belgisi, ostida «o'qituvchi · xona»,
   «kunlar · vaqt» (`text-2`).
6. **To'lovlar** — bo'sh holat: ikonka + «Hali to'lov qilinmagan» + izoh; bo'lsa — oxirgi 5 ta.
7. **Tarix** — vaqt chizig'i: oxirgisi `brand` nuqta, qolganlari `border-strong`.

Guruh holati belgilari: Yig'ilmoqda — brend, Faol — muvaffaqiyat, Muzlatilgan — ma'lumot,
Arxiv — betaraf. Kodda: `components/v2/students/StudentQuickPanel.tsx`; fan rangi —
`components/v2/ui/fan.ts` (kurs nomidan); guruh holati — `components/v2/ui/groupStatus.ts`.

## Ustunlar oynasi — har ro'yxatda bir xil (Guruhlar misolida, 18.10.2026)

«Ustunlar» tugmasi bosilganda o'ng chetga tekislangan ~296 px oyna (tugma ochiq paytida
`brand` chegara + fokus halqasi, fon o'zgarmaydi):

1. **Sarlavha**: «Ustunlar» (qalin) va o'ngda «Standartga qaytarish» (`small`, qalin,
   `brand-text`) — ustunlar, tartib va zichlik sukutga qaytadi.
2. **«Ko'rinib turadi · N»** (`caption`, `text-3`; son qulflangan ustunni ham sanaydi):
   - qulflangan ustun — qulf ikonka + nom (qalin) + o'ngda «doim»; o'chmaydi, surilmaydi,
     doim birinchi («Guruh nomi», «O'quvchi»);
   - qolganlari — chapda ⠿ tutqich, nom, o'ngda belgilangan katakcha; sichqoncha ustida
     `bg-v2-hover`. **⠿ ni tortib tartiblanadi** (sichqoncha va barmoq; band boshqasining
     o'rtasidan o'tganda joyi almashadi, jadval shu zahoti yangilanadi; ushlangan band —
     oq fon + `shadow-v2-md`), klaviaturada ⠿ ga fokus + ↑ / ↓.
3. Ajratgich, **«Yashirilgan · N»** — tutqichsiz (nom tekislangan), nom `text-2`, bo'sh
   katakcha; yoqilgan ustun ko'rinadiganlarning OXIRIGA qo'shiladi.
4. Pastda chiziq ustida **«Qator zichligi»** — segment «Ixcham» / «Keng» (faol bo'lak oq +
   `shadow-v2-sm`). Ixcham — rasmdagi qator (~52 px; ism + telefonli qator o'z chekinishi
   bilan ~58 px), Keng — 64 px.

Qator bosilsa ham katakcha almashadi. Tanlov har brauzerda saqlanadi (`localStorage`, har
ro'yxat o'z kaliti). Kodda: `components/v2/ui/ColumnsControl.tsx` (tugma + oyna),
`components/v2/ui/columnPrefs.ts` (saqlash, tartib, zichlik → `DENSITY_ROW` / `DENSITY_CELL`).

## Guruhlar ro'yxati (rasm «Guruhlar · Ustunlar», 18.10.2026)

O'quvchilar ro'yxati qolipida: «Guruhlar» + «Akademiya 3 Uychi · 5 ta guruh»; «Export» va
«+ Guruh qo'shish»; qidiruv «Guruh nomi bo'yicha» → Kurs / O'qituvchi / Guruh holati →
«Yana filtrlar» → «Ustunlar»; xulosa «5 ta guruh • O'quvchilar 12 • Muzlatilgan 0»; jadval;
«1–5 / 5 ta».

- **Ustunlar** (sukut — rasmdagidek): Guruh nomi (qulflangan; fan rangidagi nuqta + qalin
  nom), Kurs (`text-2`), O'qituvchi (`text`, o'rtacha qalin), Kun va vaqt («Toq kunlar ·
  14:00–16:00», `text-2`), Xona, O'quvchilar, Guruh holati (belgi). Yashirilgan: Daraja,
  Guruh vaqti (muddati o'tgan — `danger-bg` belgi), Telegram havola, Ta'lim turi (teg), Dars
  davomiyligi («2 soat»), Boshlanish sanasi, Tugash sanasi.
- **Bugun davomat qilinmagan guruh** (eski sahifadagi sariq qator): `warning-bg` fon + chapda
  3 px `warning` chiziq; xulosada «• Bugun davomat qilinmagan N» (`warning` rangida).
- Qator bosilsa — guruh sahifasi; «⋯» — Guruhni ochish, Davomat, Guruh tarixi, Tahrirlash.
  «Export» ichida Excel, CSV va «CSV fayldan import» (eski sahifa bilan bir xil fayl).
- Kodda: `components/v2/groups/GroupsListV2.tsx`; ma'lumot eski sahifa bilan umumiy —
  `components/groups/useGroupsList.ts`, `lib/groupsList.ts`, `lib/groupsExport.ts`.

## Kassalar (rasm «Kassalar», 18.10.2026)

Ikki ustun (≥1280 px; torroqda kartochkalar tepada to'r bo'lib, jadval ostida):

- **Sarlavha**: «Kassalar» + «4 ta filial kassasi · bosh kassa»; o'ngda ikkinchi darajali
  «Umumiy hisobot» (kassalar qoldig'i Excel/CSV + «Moliya hisobotlari») va «+ Yangi kassa» —
  ikkalasi faqat admin.
- **Chapda** segment «Aktiv N / Arxiv / Barchasi» (son faqat faol bo'lakda) va **kassa
  kartochkalari**: chegarali kvadratda hamyon ikonka (bosh kassada toj), nomi (qalin), ostida
  «mas'ul · oxirgi qabul qilingan topshiruv vaqti» (`caption`, `text-3`; bugun — soat, aks holda
  kun); o'ngda qoldiq (16 px qalin + «so'm» `text-2`) va «ko'z» — SHU kassa summasini yashirish
  («•••••• so'm», har kassada alohida, brauzerda saqlanadi). Ostida «Oxirgi topshiruvdan beri
  tushum: **N so'm**»; bosh kassada o'rniga «Kutilayotgan ko'chirma» va «Kunlik topshiruv»
  havolasi. Pastki qator `surface-2` fonda: chegarali «↙ Kirim» (ikonka `success`), «↗ Chiqim»
  (`danger`), «⇄ Ko'chirish», o'ngda hisobot (admin) va «⋯» (to'lov turlari qoldig'i — bosilsa
  turlar orasida ko'chirish, Dividend, Sarmoya, admin: Tahrirlash, Bosh kassa qilish).
  Kartochka bosilsa — `brand` chegara + halqa, o'ngdagi jadval shu kassaga toraytiriladi.
- **O'ngda «Tranzaksiyalar»** (`surface` karta): sarlavha + «Barcha kassalar» (yoki tanlangan
  kassa nomi), o'ngda sana tanlovi («Bugun, 18-oktyabr ⌄» — `components/v2/ui/V2DateRange.tsx`)
  va «Hisobot ⌄» (admin); filtrlar: «Ism yoki izoh», Turi, To'lov turi, Kassa, «Yana» (uzuq);
  uch katakli qator **Kirim · N ta** (`success`) / **Chiqim · N ta** (`danger`) / **Farq**;
  jadval: Chek (chegarali printer tugma), «Kim / nima» (yo'nalish belgisi och fonli kvadratda +
  ism qalin + «Kirim · izoh» `caption`; holat belgilari «Tasdiq kutmoqda», «Bekor qilingan»,
  «Tahrirlangan», kelayotgan ko'chirmada ✓ / ×), Kassa, Sana, «Summa, so'm» (ishorali, rangli,
  ostida to'lov turi), «⋯». Pastda «N ta amal ko'rsatildi» va izoh.
- Jadval **qat'iy ustunli** (`table-fixed` + `colgroup`): katakdagi `truncate` ustunni
  toraytirmaydi, uzun ism butun jadvalni kengaytirardi. Bitta kun tanlangan bo'lsa tor ekranda
  sana o'rnida faqat soat.
- Kodda: `components/v2/finance/CashboxesV2.tsx`, `CashboxCardV2.tsx`, `CashTransactionsV2.tsx`;
  oynalar eski (`components/finance/*`); chek va tahrir tarixi — `cashReceipt.tsx`,
  `EditHistoryModal.tsx`, eksport — `lib/cashEntriesExport.ts` (eski sahifa ham shulardan).
  API: `?cashboxIds=` (bir nechta kassa, admin bo'lmasa hammasi o'ziniki), `?q=`, yig'indida
  `incomeCount` / `expenseCount`.

## Oylik chiqarish (rasmlar «Oylik chiqarish» va «Oylikni chiqarish oynasi», 19.10.2026)

- **Sarlavha**: «Oylik chiqarish» + «filial · 1–19-oktyabr hisobi (19/31 kun)»; tugagan / yopilgan /
  kelajak oyda yonida belgi (`warning-bg` / `danger-bg` / `info-bg`). O'ngda **oy tanlagich**
  «‹ Oktyabr 2026 ›» (`components/v2/ui/V2MonthNav.tsx`: strelkalar, yozuv bosilsa yil va 12 oy to'ri,
  joriy oy — brend chegara, tanlangani — brend fon), «Chiqarishlar tarixi», «Qayta hisoblash»
  (ikkinchi darajali). 1+2 binoda — segment «1-bino / 2-bino».
- **Ko'rsatkichlar** — BITTA kartochkada 6 katak (to'r oralig'i 1 px chiziq bo'lib ko'rinadi):
  Jami tushum · Sof foyda (manfiy — `danger`) · Jami oylik · N xodim · Jami avans · Soliq (· 12%) ·
  **Qolgan oylik** (`brand-bg`, yorlig'i `brand-text`, ostida «kartaga · naqd»). Yorliq `small text-2`,
  raqam 17 px qalin + «so'm» `small text-2`, izoh `caption text-3`.
- **Filtr**: «Xodim ismi yoki telefoni» → Xodim turi, Hisoblash usuli (chip) → o'ngda «Ustunlar».
- **Jadval kartasi**: tepada **tanlov qatori** — tanlansa `brand-bg`: «✓ N ta xodim tanlandi»
  (`brand-text`, qalin) + «Chiqariladigan summa: **N so'm** · kartaga …, naqd …», o'ngda «Bekor
  qilish» (matnli) va asosiy «Oylikni chiqarish» + ⌄ (ikkinchi usul — «Faqat kartani chiqarish»);
  tanlanmasa oq fonda izoh; chiqarib bo'lmaydigan oyda — sababi. Ustunlar: Xodim (qalin ism + teg
  «Oklad» / «Oklad + 30%», ishga kirgan sana), Hisob-kitob («3 500 000 × 19/31 kun», ostida
  «+ 30% × N tushum» `caption text-3`), Jami oylik, Jami avans, [To'langan], [O'tgan oydan], Bonus,
  Jarima, Soliq (`danger`, ostida «N × 12%»), [Kartaga] (ostida «rasmiy N» / «faqat naqd»),
  **Qolgan oylik** (qulflangan, doim oxirida). Qavsdagilar — qiymati bo'lsa o'zi chiqadi. Sarlavhada
  asosiy pul ustunlari qalin. Pastda qotgan «Jami · N xodim» qatori (`surface-2`, oxirgi summa
  `brand-text`). Ustun ko'p bo'lsa jadval yonga aylanadi — belgilash va «Xodim» chapda qotadi.
- **Ostida izoh** — info ikonka + `caption text-2`.
- **Oyna** (`ui/Modal` qobig'i, ichki blok `data-ui="v2"`, ~576 px): sarlavha + «1-oktyabrdan 19-oktyabr |
  11:02 gacha hisoblandi»; `brand-bg` blokda «Chiqariladigan summa» va katta raqam (`text-v2-number`),
  o'ngda «N xodim / oy»; chegarali ro'yxat — avatar (bosh harflar), ism, «kartaga · naqd · soliq»,
  summa; ikki ustun: «Qaysi kassadan» (maydon, bosh kassada `warning-bg` kvadratda toj, ostida
  «Qoldiq») va «To'lov turi» (`surface-2` blok: binafsha kvadrat «Plastik · kartaga», yashil «Naqd»;
  bosilsa tur menyusi; ostida «Kassada Naqd: N so'm», yetmasa qizil); «Izoh (ixtiyoriy)»; ogohlantirishlar
  (sabablari doim yoziladi); `info-bg` blokda nima bo'lishi; pastki qator `surface-2` + chegara:
  «Bekor qilish», «✓ Tasdiqlash va chiqarish». Telefonda tugmalar to'liq kenglikda, asosiysi tepada.
- Kodda: `components/v2/finance/PayrollV2.tsx`, `PayoutModalV2.tsx`, `payrollColumns.ts`
  (`v2:payroll:columns:1`); ma'lumot, hisob va so'rov eski sahifa bilan BITTA —
  `components/finance/usePayroll.ts` (eski `SalaryCreatePage` ham shundan). API: ixtiyoriy `note`.
  Rasmdan farqlar (soliq va karta qoidasi tizimdagidek va h.k.) — `SAVOLLAR.md` 61–70.

## Formalar (rasmlar «To'lov qabul qilish», «Kassa amali», «Yangi o'quvchi», «Formalar — qoidalar», 19.10.2026)

- **Qaysi oyna**: qisqa forma (~7 maydongacha) — **markazda** (To'lov qabul qilish, Kassa amali, Oylik
  chiqarish), orqa fon xiralashadi; uzun forma — **o'ngdan panel** (Yangi o'quvchi, Yangi lid, Xodim) —
  chapda ro'yxat ko'rinib turadi. **Telefonda ikkalasi ham pastdan** chiqadi (92 dvh gacha), asosiy tugma
  pastda, to'liq kenglikda.
- **Tuzilishi** (`components/v2/form/V2Dialog.tsx`, `ui/Modal` ustida): sarlavha amalni aytadi + izoh
  qatori («Akademiya 4 Uchqo'rg'on kassasi») + ×; yorliq maydon TEPASIDA (`small`, o'rtacha qalin),
  majburiy bo'lmagani «(ixtiyoriy)» (`text-3`); ochilganda birinchi maydon fokusda; pastki qator
  `surface-2` + chegara: chapda «Enter saqlash · Esc yopish» (`kbd`) yoki katakcha («Saqlab, yana
  qo'shish»), o'ngda «Bekor qilish» + **amal nomli** asosiy tugma («✓ To'lovni qabul qilish», «✓ Chiqimni
  saqlash»). Enter — saqlash (ko'p qatorli matnda, ochiq ro'yxatda va qidiruvda emas); o'zgarish
  kiritilgan forma yopilmoqchi bo'lsa — «Saqlanmagan o'zgarishlar bor» (`V2Confirm`, qizil «Yopish» /
  «Davom etish»).
- **Maydonlar** (`fields.tsx`): h-10, `border-field`, fokusda brend chegara + halqa; **summa** — h-12,
  20 px qalin, o'ngda «so'm», 3 xonadan bo'linadi; telefon — chapda «+998» bo'lagi; segment (to'lov
  turi, tablar) — `surface-2` konteyner, faol bo'lak oq + chegara + soya, turlarda rangli nuqta (naqd
  yashil, plastik binafsha, terminal ko'k, inkassa sariq); chip (oy, kategoriya) — tanlangani
  `brand-bg` + brend chegara + ✓. Boy tanlov (`V2Picker`): ikki qatorli variant (qalin nom +
  «· ustoz · kunlar vaqt»), chapda nuqta/ikonka, o'ngda izoh («6 o'quvchi»), bo'lim sarlavhasi
  («Chet tillari · 3 ta guruh»), 7 tadan ko'pida qidiruv, pastki qator («Kategoriya bo'yicha saralangan ·
  Hammasini ko'rsatish»). Sana — «📅 19-oktyabr | 12:20» (vaqt — saqlash payti); tug'ilgan sana —
  «kk.oo.yyyy» niqobi.
- **Tekshiruv**: xato — maydondan chiqqanda (yozib turganda emas) yoki saqlashda; qizil chegara + ostida
  ikonkali xabar («⚠ Raqam to'liq emas — 9 ta raqam kerak»); saqlashda fokus BIRINCHI xatoga o'tadi.
  Ogohlantirish to'xtatmaydi — sariq blok («Bu raqam O'quvchilarda bor: … Ochish»). Saqlab bo'lmaydigan
  holat (izohdagi oy farqi, oylik chegarasi) — qizil blok + asosiy tugma o'chiq.
- **Saqlangach** — toast pastki o'ngda (telefonda yuqoriroq): ✓ `success-bg`, sarlavha («To'lov qabul
  qilindi»), tafsilot qatorlari (ism; «280 000 so'm · Naqd · Rahbar kassasi»), havola («Chekni ko'rish»),
  ×; 5 s, sichqoncha ustida kutadi; xato o'zi yopilmaydi (`showToast`, `components/ui/Toast.tsx`).
- **«+ Yangi»** (yuqori panel): Lid, O'quvchi, To'lov qabul qilish, Kassa amali, Topshiriq; rahbarga
  qo'shimcha Guruh, Xodim, Bonus / jarima. O'quvchi, To'lov va Kassa amali — SHU JOYDA
  (`components/v2/shell/CreateContext.tsx`), qolganlari o'z sahifasida (`?add=1`, `?new=1`).
- Kodda: `components/v2/form/` (V2Dialog, V2Confirm, fields, V2Picker, V2DateField, MonthChips,
  StudentSearchField, V2SuggestInput, BirthDateField); oynalar — `components/v2/finance/
  StudentPaymentModalV2.tsx`, `CashOperationModalV2.tsx`, `components/v2/students/NewStudentDrawerV2.tsx`.
  Mantiq eski oynalar bilan BITTA: `components/finance/useKirimForm.ts`, `useChiqimForm.ts`,
  `useTransferToForm.ts`, `components/orders/useStudentSources.ts`. Rasmdan farqlar — `SAVOLLAR.md` 71–86.

## Lidlar (rasmlar «Lidlar», «Lid paneli — bosqichlar chizig'i», «Guruhga qo'shish oynasi», 20.10.2026)

- **Sarlavha**: «Lidlar» + «Akademiya 3 Uychi · shu oy 29 ta lid»; o'ngda «So'rovnoma havolasi» (ikkinchi
  darajali, menyu: nusxalash / ochish), «⋯» (Excel, CSV, Birinchi darsga yozilganlar, Lidlar sozlamalari)
  va asosiy «+ Lid qo'shish».
- **Holat kartalari** — bitta kartochkada 6 katak (1 px ajratgich): rangli nuqta (kvadratroq, 8 px) +
  yorliq (`small text-2`), raqam 22 px qalin, ostida izoh (`caption text-3`): Barchasi («shu oy»), Yangi
  («5 tasi 24 soatdan oshdi» — `warning`), Bog'lanildi, Birinchi darsga yozildi («shu hafta»), Guruhga
  qo'shildi, Rad etdi. Tanlangani `brand-bg` + ostida 2 px `brand` chiziq, yorlig'i `brand-text`; bosilsa
  jadval shu holatga filtrlanadi. Telefonda yonga suriladi.
- **Filtrlar**: «Ism yoki telefon» → Yo'nalish (yo'nalish yoki aniq kurs), Manba, Filial (chip) → davr
  («📅 Shu oy ⌄» — `V2DateRange`, tugmada tez tanlash nomi) → **«Bugun birinchi dars · 2»** (tezkor filtr:
  uzuq `warning` chegara, `warning` yozuv; yoqilsa `warning-bg` + ✓ ×; davrga qaramaydi) → o'ngda «Ustunlar».
- **Lid holati belgilari** (sahifa rasmidan): Yangi — info, Bog'lanildi — binafsha, Birinchi dars —
  ogohlantirish, Guruhga qo'shildi — muvaffaqiyat, **Rad etdi — BETARAF** (`surface-2` + `text-2`,
  kulrang nuqta; komponentlar rasmidagi qizil emas — `SAVOLLAR.md` 88). Nom «Birinchi dars» (8).
- **Jadval**: belgilash; **Lid** (qulflangan: avatar `surface-2` + chegara, ism qalin, telefon `text-3`,
  takroriy raqamda telefon yonida sariq «nusxa» ikonka); **Yo'nalish** (fan nuqtasi + kurs · daraja/sinf
  `text-2`); **Holat**; **Keyingi qadam** — nima qilish kerak: «→ Qo'ng'iroq qilish · 2 soatdan beri»
  (o'q `brand`, amal qalin; kechikkanda sariq soat va sariq yozuv), «Bugun birinchi dars» belgisi (to'liq
  `warning` fon, `on-color` yozuv, `rounded-v2-sm`) + soat qalin + «· 205-xona», kelajakdagi dars va yakun
  — `text-2` oddiy matn; sukut saralash shu ustun (shoshilinchi tepada); **Manba**, **Qo'shilgan**
  («11-oktyabr | 09:15»), **Mas'ul**. Yashirilgan: Filial, Qayerdan bildi, Qulay vaqt, ID, Izoh.
  Belgilansa jadval tepasida `brand-bg` qator: «✓ N ta lid tanlandi» + Excel / CSV + «Bekor qilish».
- **Lid paneli** (o'ngdan ~440 px, O'quvchi tezkor paneli qolipi): avatar **`brand-bg` + `brand-text`**,
  ism, ostida holat belgisi, «telefon · manba»; to'liq karta va ×; «📞 Qo'ng'iroq qilish» (keng,
  ikkinchi darajali), «SMS», «⋯». **Bosqich kartasi** (`surface-2` + chegara): «Bosqich · 3 / 4», chiziq —
  4 doira 22 px (o'tilgani `brand` + ✓, joriysi oq + 2 px `brand` halqa + nuqta, keyingilari oq +
  `border-strong`), orasidagi chiziq o'tilgan qismda `brand`; joriy bosqich yozuvi qalin. Ostida asosiy
  tugma 40 px — keyingi bosqich («Guruhga qo'shish →») va qizil chegarali «⊗ Rad etdi»; izoh «Kerak bo'lsa
  bosqichni o'tkazib yuborish mumkin — tarixda belgilanadi» (oldindagi doira bosilsa — o'tkazib yuboradi);
  «Oxirgi o'zgarishni bekor qilish · N daq qoldi». Keyin: **Birinchi dars** (karta, bugun bo'lsa chapda 3 px
  `warning` chiziq + «Bugun birinchi dars» belgisi; «sana | vaqt» qalin; «kurs · o'qituvchi · xona»;
  o'ngda «O'zgartirish» `brand-text`), **So'rovnoma javoblari** (yo'nalish · kurs, taxminiy daraja, qulay
  vaqt, filial), Izoh, **Tarix** (yangisi tepada, oxirgisi `brand` nuqta, nuqtalar orasida chiziq, «sana |
  vaqt · Abdulloh R.»). Bo'lim sarlavhalari `small text-2`.
- **Guruhga qo'shish oynasi** (markazda, ~540 px): «Kurs · liddan | Filial · liddan» (`surface-2` blok, ikki
  katak); **Guruh** — radio kartalar (tanlangani `brand` chegara + `brand-bg`; fan nuqtasi + kurs qalin +
  «Birinchi dars shu guruhda» `warning-bg` belgi, o'ngda «6 o'quvchi»; ostida «o'qituvchi · kunlar vaqt ·
  xona»); **Boshlash sanasi** — chiplar «✓ 14-oktyabr, chorshanba · keyingi dars» va «Boshqa sana 📅»
  (taqvim); katakcha «Saqlagach, to'lov oynasini ochish»; `info-bg` izoh; pastki qator «Enter saqlash · Esc
  yopish», «Bekor qilish», «✓ Guruhga qo'shish». «Birinchi darsga yozish» va «Rad etish» oynalari — shu
  qolipda (rasm berilmagan — `SAVOLLAR.md` 92).
- Kodda: `components/v2/leads/` — LeadsV2 (sahifa), LeadPanelV2, LeadGroupModalV2, LeadSinovModalV2,
  LeadRadModalV2, leadBits (holat belgisi, «liddan» bloki, guruh radio kartalari), leadUtils (keyingi qadam,
  sinov guruhini topish, keyingi dars, tarix), leadsColumns (`v2:leads-list:columns:1`); vaqt maydoni —
  `components/v2/form/V2TimeField.tsx`. Ma'lumot, eksport va so'rovlar eski sahifa bilan BITTA:
  `components/leads/useLeadsCore.ts`, `leadsExport.ts`, `LeadHolatModals.tsx → postHolat`,
  `lib/enrollStudent.ts`. Rasmdan farqlar — `SAVOLLAR.md` 87–98.

## Moliya analitikasi (rasmlar «Moliya analitikasi», «Hisobotni yuklab olish», 20.10.2026)

- **Sarlavha**: «Moliya analitikasi» + «Pul qayerdan kelib, qayerga ketyapti va lidlar qanchalik
  o'quvchiga aylanyapti».
- **Filtrlar** — BITTA qator, sahifaning hammasini qamraydi: davr («📅 Shu oy · 1–20-oktyabr ⌄» —
  `V2DateRange`, «Barcha vaqt» yo'q), keyin uchta **qiymatli tanlov** (`V2Select variant="value"`: neytral
  chegarali tugma «Solishtirish: **o'tgan oy** ⌄», «Filial: **Barchasi** ⌄», «Kassa: **Barchasi** ⌄» —
  yorliq `text-2`, qiymat qalin, × yo'q); o'ngda «⬇ Hisobot yuklab olish» (ikkinchi darajali). Davr bugungacha.
- **Ko'rsatkichlar** — bitta kartochkada 4 katak (1 px ajratgich; telefonda 1, planshetda 2 ustun): Tushum,
  Chiqim, Sof foyda (so'mda, 22 px qalin + «so'm» `text-2`), **Lid → o'quvchi** («25%» + «· 28 / 112»). Ostida
  o'zgarish: o'q + foiz qalin — **yaxshi tomonga yashil, yomoniga qizil** (chiqim ko'paysa qizil), «0» —
  kulrang chiziqcha; keyin «1–20-sentyabrga nisbatan» `text-2`. Konversiya o'zgarishi — «p.p.».
- **«Kirim va chiqim · oyma-oy»** (karta): izoh «Barcha filiallar · mln so'm · oktyabr hali davom etmoqda (20
  kun)»; o'ngda belgilar (kvadrat 10 px) va «Grafik | Jadval» almashtirgichi. Oxirgi 6 oy, guruhlangan
  ustunlar: **Kirim — `series-1` ko'k, Chiqim — `series-2` to'q sariq** (dataviz palitrasi, validator o'tdi;
  qorong'ida o'z qadamlari), ustun ≤ 22 px, tepasi 4 px yumaloq; davom etayotgan oy — shu rangning 55%
  (och). O'q chapda «60 mln», chiziqlar `border`. Raqam faqat eng katta kirim va oxirgi oy ustida; sichqoncha
  yoki fokus — ustun ortida `hover` fon + maslahat oynasi (oy, Kirim, Chiqim, Sof foyda). Ostida «Sof foyda»
  qatori (eng kattasi qalin, manfiysi `danger`, yozuvsiz oy «—»). «Jadval» — xuddi shu raqamlar so'mda + Jami.
- **«Lid → o'quvchi»** (karta): izoh «Shu oy kelgan 112 ta lid qayerga yetib bordi va qaysi manba yaxshi
  ishladi». Chapda **Bosqichlar** — Lidlar → Bog'lanildi → Birinchi darsga yozildi → Guruhga qo'shildi, bitta
  ko'k shkala (`ord-1…4`: yorug'da och → to'q, qorong'ida teskari), «son · foiz»; ostida izoh `caption text-3`.
  O'ngda **Manba bo'yicha** — chiziq uzunligi = manbadan kelgan lidlar, ichida `series-1` qismi — o'quvchi
  bo'lganlar, qolgani `track`, oralarida 2 px; o'ngda «**9 / 38** · 24%». 7 tadan ko'p manba — 6 tasi +
  «Boshqalar». Bu karta ham «Grafik | Jadval».
- **Hisobotni yuklab olish** (markazda, 560 px): **Davr** — chiplar «Shu oy · 1–20-oktyabr», «O'tgan oy»,
  «Chorak», «Boshqa davr 📅» (taqvim; tanlansa chipda davr); **Nimalar kirsin** — katakchalar: Kirim va
  chiqim · oyma-oy, Sof foyda · solishtirish bilan, Lid → o'quvchi · bosqichlar va manbalar, Kassalar bo'yicha
  tranzaksiyalar (sukut o'chiq); **Format** — «Excel | PDF | CSV»; pastki qator «Enter yuklab olish · Esc
  yopish», «Bekor qilish», «⬇ Yuklab olish». Sahifadagi filial/kassa va solishtirish hisobotga o'tadi.
- **Holatlar**: birinchi yuklanish — skelet; filtr o'zgarsa eski rasm xira turadi (sakramaydi); xato —
  `danger-bg` qator + «Qayta urinish»; ma'lumot yo'q — grafik ustida «Bu davrda kirim yoki chiqim yo'q», voronkada
  «Bu davrda lid kelmagan».
- Kodda: `components/v2/finance/` — FinanceAnalyticsV2 (sahifa), AnalyticsCashChart, AnalyticsLeadFunnel,
  AnalyticsReportModal, analyticsReport (Excel/CSV/PDF), analyticsShared (so'm/mln, o'q qadami). Hisoblar —
  `lib/financeAnalytics.ts` (bekor qilingan amal o'z tomonidan ayriladi, solishtirish davri, lid bosqichlari);
  lidlar — `GET /api/analytics/leads`; kassa bo'yicha guruhlash — `/api/transactions/summary?groupBy=…,cashbox`.
  Ranglar — `tokens.css` `--v2-series-1/2`, `--v2-ord-1…4`, `--v2-track`. Rasmdan farqlar — `SAVOLLAR.md` 99–110.

## Sozlamalar ramkasi va Kurslar (rasm «Sozlamalar · Kurslar», 20.10.2026)

- **Ramka**: chapda ichki menyu ~240 px (`surface-2`, o'ng chegara) — «Sozlamalar» (20 px qalin), «Sozlamani
  qidirish» (h-8), bo'limlar Umumiy · O'quv · Moliya · Lidlar · Topshiriqlar · Gamifikatsiya · Nazorat (`caption
  text-3`), bandlar h-8; faol band — oq kartochka + chegara + soya (yon menyudagi faol band bilan bir xil);
  tizimda yo'q band — `text-3`, bosilmaydi. O'ngda sahifa (`surface`). Telefonda menyu tepada yig'iq
  («Sozlamalar · Kurslar ⌄»).
- **Kurslar**: «O'quv» (`caption`) → «Kurslar» (20 px) → izoh; o'ngda «⋯» (Excel/CSV/import) va «+ Kurs qo'shish».
  Qidiruv «Kurs nomi» + kategoriya CHIPLARI (`rounded-full`, h-8): tanlangani `brand-bg` + brend chegara + ✓,
  «Barchasi · 13», «Chet tillari · 4» …, kategoriyasizlar bo'lsa «Kategoriyasiz · N».
- **Jadval**: Kurs nomi (qalin) · Kategoriya (belgi: och fon + nuqta + yozuv — Chet tillari `info`, Fanlar
  `success`, Arab tili `warning`, boshqalari nomidan barqaror rang) · Holat («● Faol» — fonsiz, yashil nuqta;
  «● Nofaol» — kulrang) · ✎ va ⋯ (doim ko'rinadi, `text-3`). Qator 52 px.
- **Qatorda tahrir**: qator `brand-bg`; nom maydoni (h-9, fokusda), kategoriya tanlovi (ichida belgi), o'ngda
  «Bekor» / «Saqlash» (h-9); ostida «ⓘ Nom o'zgarsa, shu kursdagi barcha guruh va o'quvchilarda ham yangilanadi.»
  Enter — saqlash, Esc — bekor. Jadval oxirida uzuq chegarali «+ Yangi kurs qo'shish» — o'sha tahrir yangi kurs uchun.
- Kodda: `components/v2/settings/` — SettingsFrameV2 (ramka), settingsNav (bandlar va manzillar), CoursesSettingsV2,
  courseBits (kategoriya/holat belgilari). Kategoriya va holat — `lib/courseCategories.ts`, nom ko'chishi —
  `lib/courseRename.ts`; eksport — `components/offline-courses/coursesExport.ts` (eski sahifa bilan bitta).
  Rasmdan farqlar — `SAVOLLAR.md` 111–118.

## Xodimlar (rasm «Xodimlar», 20.10.2026)

- **Sarlavha**: «Xodimlar» + «Akademiya 3 Uychi · 4 ta xodim · oylik 1–12-oktabr bo'yicha»; o'ngda «⋯»,
  «Ishga qabul (CV)» (ikkinchi darajali, odam+ ikonkasi) va «+ Xodim qo'shish».
- **Filtrlar**: «Ism yoki telefon» → chiplar Lavozim, Hisoblash usuli, Holati → o'ngda «Ustunlar».
- **Jadval**: Xodim (bosh harfli doira `surface-2` + ism qalin) · Lavozim (`text-2`) · Guruhlar («3 ta» qalin +
  nomlari `caption text-2`) · Hisoblash usuli (belgi `surface-2` + chegara «Oklad + 30%», ostida «01.10.2026 dan») ·
  Jami oylik · Qolgan oylik (o'ngga, qalin) · ⋯. Oyligi boshqa filial ro'yxatidagi xodimda ikki pul katagi o'rnida
  «⚠ Shu filial oylik ro'yxatida yo'q» (`warning`). Pastda `surface-2` qator «Jami · oylikdagi 3 xodim» + yig'indilar
  (qolgani `brand-text` + «so'm»). Kartochka mazmun balandligida (bo'sh joyga cho'zilmaydi).
- Kodda: `components/v2/employees/` — EmployeesListV2, employeesColumns (`v2:employees-list:columns:1`), employeeBits.
  Ma'lumot eski sahifa bilan bitta: `components/employees/useEmployeesCore.ts`, `employeesExport.ts`. Rasmdan
  farqlar — `SAVOLLAR.md` 119–125.

## Xodim profili (rasm «Xodim profili», 20.10.2026)

- **Sarlavha**: «Xodimlar › Ism» (`small`); avatar 48 px (`brand-bg` + `brand-text`), ism 20 px qalin, ostida
  «O'qituvchi · Akademiya 3 Uychi · [Oklad + 30%] · ⚷ Huquqlar: rol bo'yicha · login bor»; o'ngda «Topshiriq berish»,
  «Avans berish» (ikkinchi darajali) va «⋯».
- **Guruhlar va jadval** (chapda, keng): «3 ta guruh · haftada 12 soat»; haftalik jadval — Du…Sha ustunlar (darsi bor
  kun qalin), soat chiziqlari 44 px, guruh bloklari fan rangida (och fon + chegara, nom va xona raqami); bir vaqtga
  to'g'ri kelganlari yonma-yon, chegarasi `warning`; ostida `warning-bg` ogohlantirish («Toq kunlar 14:00–16:00 da
  ikki guruh bir vaqtga to'g'ri kelgan: …»); guruhlar ro'yxati — fan nuqtasi, nom, «Toq kunlar · 14:00–16:00 ·
  205-xona», «6 o'quvchi», holat belgisi.
- **Oylik · oktabr 2026** (o'ngda): «1–12-oktabr hisobi (12/31 kun)»; qatorlar (ajratgich bilan) Oklad («1 000 000 ×
  12/31 kun»), Foiz · 30% («0 so'm tushum × 30%»), Bonus, Jarima, Avans, O'tgan oydan; `brand-bg` blokda «Qolgan oylik
  387 097 so'm» (22 px); «Oylik chiqarishda ochish →».
- **Topshiriqlar** (o'ngda): «Hammasi»; qator — muhimlik raqami (kvadrat `surface-2`), nom qalin, muddat («Muddat:
  15-oktabr | 18:00 · ko'rildi»), o'ngda holat belgisi.
- **Batafsil** (chapda, rasmda yo'q): eski profil tablari chiplari — eski ko'rinishda ochiladi.
- Kodda: `components/v2/employees/` — EmployeeProfileV2, EmployeeScheduleCard (+ scheduleUtils — kunlar, to'qnashuv,
  haftalik soat), EmployeeSalaryCard, EmployeeTasksCard. Fan bloklari — `ui/fan.ts` FAN_BG / FAN_BORDER. Rasmdan
  farqlar — `SAVOLLAR.md` 126–133.

## Imtihon → Sarhisob → Natija kiritish (rasm «Sarhisob · Natija kiritish», 23.10.2026)

- **Sarlavha**: yo'l «Sarhisob › Natija kiritish» (`small text-2`, «Sarhisob» — ro'yxatga qaytadi), «Imtihon», o'ngda
  «⤓ Eksport» (ikkinchi darajali). Ostida tablar «Sarhisob | UzBMB» — faol tab qalin yozuv + 2 px `brand` chiziq,
  qator ostida `border` chiziq.
- **Tanlovlar paneli** (`surface-2` kartochka, 6 ustun): Fan (yorliq yonida «avto» — `brand-bg` + `brand-text`,
  guruhdan olinganda), Ustoz, Guruh («Ingliz tili · 205»), Oy («Oktabr 2026»), Sana («12-oktabr ⌄»), Savollar soni
  («25 ta»). Maydonlar 36 px, qiymat qalin, yorliq `small text-2`.
- **O'quvchilar kartasi** (chapda): «6 ta o'quvchi» qalin + «guruhdan avtomatik olindi» (`text-2`), o'ngda «+ O'quvchi
  qo'shish», «⤒ Excel'dan yuklash» (32 px). Jadval: № · O'quvchi (qalin) · To'g'ri javob (maydon «22 / 25», sarlavha
  qalin) · O'zlashtirish (132 px chiziq `brand` / izi `brand-bg` + foiz qalin; < 60% — `warning` chiziq, izi
  `warning-bg`, foiz `warning` + «past»; bo'sh — «kiritilmagan» `text-3`) · o'ngda ✓ (`success`) yoki fokusdagi qatorda
  «[Enter] keyingisi». Fokusdagi qator `brand-bg`. Pastda `surface-2` qator: «5 / 6 kiritildi • Guruh o'rtachasi 80%»,
  «Bekor qilish», «✓ Natijalarni saqlash».
- **Taqqoslash** (o'ngda, 300 px): «Taqqoslash · oktabr»; qatorlar nom + foiz, ostida 8 px chiziq (izi `hover`): «Bu
  guruh» — `series-1` (ko'k), «Ingliz tili · markaz o'rtachasi», «Barcha fanlar · markaz» — `track` (kulrang);
  ajratgich; «Guruh ichida» — uch katak `surface-2` (≥ 80%, 60–79%, < 60% soni); izoh «O'quvchi qatoriga bosilsa…».
  O'quvchi bosilsa karta o'sha o'quvchiga almashadi («← Taqqoslash», guruhdagi o'rni, oylar bo'yicha natijalari).
- Klaviatura: natija maydonida Enter / ↓ — keyingi o'quvchi, ↑ — oldingisi.
- Sarhisob RO'YXATI (`/imtihon`, rasmi kelmagan): Oy (qiymatli tugma) va Fan (chip) filtri, to'rt ko'rsatkich bitta
  kartochkada (Topshiriqlar kartalari qolipida), jadval — Sana, Fan (nuqta), Ustoz, Guruh, O'quvchi, Savol, Guruh
  o'rtachasi (chiziq + foiz); qator bosilsa o'ngdan tafsilot (taqqoslash va o'quvchilar natijasi).
- Kodda: `components/v2/imtihon/` — ImtihonV2 (manzil: `?kiritish=1&oy=`, `?tab=uzbmb`), ExamEntryV2, ExamSideCard,
  SarhisobListV2, SarhisobDetailV2, examBits (ImtihonHeader, ScoreBar, CompareRow, examBand). Ro'yxat, oy nomi va CSV
  eski tab bilan bitta: `components/imtihon/sarhisobCore.ts`. UzBMB — «Imtihon → UzBMB» bo'limi (12-qism). Rasmdan farqlar —
  `SAVOLLAR.md` 139–145, 148.

## Topshiriqlar (rasm «Topshiriqlar · Rahbar», 23.10.2026)

- **Sarlavha**: «Topshiriqlar» + kimning topshiriqlari (`small text-2`); o'ngda «⋯» (Jarimalar, Statistika, Jarima va
  muddatlar, O'quvchi vazifalari turlari) va «+ Topshiriq berish».
- **Kartalar** — to'rttasi BITTA kartochkada, orasi 1 px `border`: rangli nuqta + nom (Faol `info`, Tasdiq kutilmoqda
  `violet`, Muddati o'tgan `warning`, Bajarilmadi · shu oy `danger`), son 22 px qalin, izoh `caption text-2`.
  Bosilsa holat filtri; tanlangani `brand-bg` + pastida 2 px `brand` chiziq.
- **Filtrlar**: «Topshiriq nomi» qidiruvi (240 px) → chiplar Xodim, Muhimlik (variant yonida jarima summasi),
  Filial, 📅 Muddat (+ Holat).
- **Jadval**: Topshiriq (nom qalin + ostida holatga qarab izoh: «Bajardim: 12-oktabr | 09:40 · fayl biriktirilgan»,
  tavsif, «Tasdiqlandi: …») · Xodim (28 px doira `surface-2` + chegara, bosh harflar; ism) · Muhimlik (28 px kvadrat:
  1–2 `skeleton` foni + `text-2`, 3–4 `warning-bg` + `warning`, 5 `danger-bg` + `danger`) · Muddat («14-oktabr | 12:00»,
  ostida «2 kun qoldi» `text-2`, «qayta muddat: …» va «bugun · 5 soat 45 daqiqa» — `warning`) · Holat (belgi: nuqta +
  yozuv, och fon; ostida 👁 «ko'rildi / hali ko'rilmagan» `text-3`) · amal. «Tasdiq kutilmoqda» qatori `violet-bg`,
  amalda «✓ Tasdiqlash» (32 px, brend) + «↩» (32 px ikkinchi darajali); qolganida «⋯». Pastda «1–6 / 10 ta» va
  «Holat avtomatik o'zgaradi: …» (`caption text-2`).
- Kodda: `components/v2/tasks/` — TasksRouteV2 (`?tab=fines|stats|settings` — eski tablar), TasksV2, taskBitsV2
  (V2_STATUS_LABEL, holat belgisi, muhimlik, muddat katagi), TaskActionDialogV2. Mantiq eski sahifa bilan bitta:
  `components/staff-tasks/useStaffTasksCore.ts`, `taskListCore.ts`, `useTaskForm.ts`, `useTaskAction.ts`. Batafsil
  panel — eski (TaskDrawer). Rasmdan farqlar — `SAVOLLAR.md` 134–137, 146–147.

## Yangi topshiriq oynasi (rasm «Yangi topshiriq», 23.10.2026)

- Markazdagi oyna (V2Dialog, 560 px): «Yangi topshiriq» + filial; Sarlavha; Tavsif (ixtiyoriy); Kimga — tanlangan
  xodimlar chip (`surface-2` + chegara, 20 px `brand-bg` doirada bosh harflar, ×), oxirida «Xodim qo'shish…»
  qidiruvi; ostida izoh «har biriga alohida nusxa…». Muddat — «📅 15-oktabr, payshanba» + soat (ikonkasiz, 112 px);
  Muhimlik — beshta 52 px tugma (raqam qalin + jarima `caption`), tanlangani `brand` chegara + `brand-bg` +
  `brand-text`; ostida «Bajarilmasa: **30 000 so'm** jarima. Summalar Sozlamalar → Jarima va muddatlar'da.»; Ilova
  (ixtiyoriy) — uzuq chegarali maydon «📎 Rasm, PDF yoki havola biriktiring» (bosilsa fayl, sudrab tashlash ham) +
  «Havola». Pastda «Enter saqlash · Esc yopish», «Bekor qilish», «✓ Topshiriq berish».
- Tahrirlash ham shu oyna («Topshiriqni tahrirlash», xodim o'zgarmaydi). Kodda: `components/v2/tasks/TaskFormDialogV2.tsx`
  (StaffTagPicker — «Kimga»). Rasmdan farqlar — `SAVOLLAR.md` 138.

## O'quvchi sahifasi (rasmlar «O'quvchi sahifasi · Umumiy / To'lovlar / Davomat», «Yangi o'quvchi · Bo'sh holatlar», 23.10.2026)

- **Sarlavha**: «← O'quvchilar ro'yxati › Ism» (`small`). Ikki ustun: chapda kartochka (≈300 px), o'ngda tablar
  «Umumiy | To'lovlar [qarz] | Davomat | Tarix» (faol — qalin + 2 px `brand` chiziq; «qarz» — `danger-bg` belgi).
- **Chap kartochka**: avatar 48 px (`brand-bg` + `brand-text`), ism 18 px qalin, holat belgisi («Aktiv» `success`,
  «Yangi o'quvchi» `info` — to'lovi yo'q faol o'quvchi) + «N guruh»; ikki katak «Balans» (qarz — `danger` + «ⓘ
  Qarzdorlik») | «Tanga»; «To'lov qabul qilish» (to'liq kenglik, asosiy), «SMS», «Qo'ng'iroq», «⋯»; «Ma'lumotlar» +
  «✎ Tahrirlash» (Telefon + nusxa, Tug'ilgan sana · yosh yoki «Kiritilmagan · Qo'shish», Kategoriya, Filial, Manba,
  Qo'shilgan); «Ota-ona» — 32 px doira, ism, «otasi · telefon», qo'ng'iroq tugmasi; bo'sh — chegarali quti izoh bilan va
  «+ Ota-ona qo'shish».
- **Ko'rsatkichlar** (bitta kartochka, orasi 1 px): Qarzdorlik («470 000 so'm», «oktyabr · 2 guruh bo'yicha»; bo'sh —
  «0 so'm · to'lov hali qilinmagan») | Davomat · oy (22 px foiz, chiziq: 85%+ `success`, 60–84% `warning`, pastroq
  `danger`; «7 / 9 dars · 1 kelmadi, 1 sababli») | Keyingi dars («Bugun, 16:00», «Ingliz tili · 205-xona»; bo'sh — «—
  guruh yig'ilmoqda»). Davomat tabida to'rtta: foiz | Keldi | Kelmadi | Sababli (oxirgisi «3-oktyabr · Matematika»).
- **Umumiy**: Guruhlar (fan nuqtasi, «Ingliz tili · 2-bosqich» + holat, ustoz · xona · kunlar soat; o'ngda «320 000 so'm
  / oyiga · sana dan», 32 px «⇄ Ko'chirish», «⋯»); ikki kartochka yonma-yon — To'lovlar (oxirgi oylar: «Iyun … Noy»,
  joriy oy chegarali katakda, belgilar ✓ ◐ ⓘ ◷ —; `danger-bg` quti «Oktyabr uchun **470 000 so'm** qarz · To'lash»,
  chegarasi `danger`) va Davomat (oy darslari 24 px doirachalarda + kun, rejadagi — soat; foiz va chiziq); So'nggi
  harakatlar (32 px doira ikonka — kelmadi `danger-bg`, sababli `warning-bg`, qolgani chegarali; sarlavha qalin, izoh,
  o'ngda «7-oktyabr | 16:05»; «Butun tarix →»).
- **To'lovlar**: «Oylar bo'yicha» — guruh × oy jadvali, joriy oy ustuni `brand-bg/45` + «joriy» belgi; katakda «✓
  320 000», qisman — `warning-bg` belgi «◐ 150 000» + «qoldi · 300 000 dan», qarz — `danger` chegarali belgi «ⓘ 320 000» +
  joriy oyda «Shu oyni to'lash →», kelgusi — «◷ 320 000 · kelgusi oy», guruhda emas — «—»; pastda «Oy bo'yicha qarz, so'm»,
  izoh-legend. «To'lovlar tarixi» — Chek (chop etish tugmasi, birinchi ustun) · Sana («6-oktyabr | 18:07») · Summa (qalin,
  o'ngga) · To'lov turi (nuqta) · Qaysi oy uchun · Guruh · Kassa; guruh segmenti; «Jami» qatori.
- **Davomat**: kalendar dushanbadan (Yak ustuni `surface-2`, bugun — 2 px `brand` ichki chegara + «Bugun»); chiplar 24 px
  `rounded-full`: keldi `success-bg` ✓, kelmadi `danger-bg` ✕, sababli `warning-bg` —, rejada — oq + chegara + fan nuqtasi,
  bugungi — `brand` chegara «◷ 16:00», belgilanmagan — uzuq «?»; tor ekranda chip faqat belgi. «Qoldirilgan darslar» va
  «Oylar bo'yicha» (ustunli grafik `series-1`, joriy oy och «*», ustiga kelganda maslahat; jadvalga almashadi).
- Kodda: `components/v2/students/profile/` — StudentProfileV2 (tablar `?tab=` — window.history.replaceState),
  StudentSideCardV2, ProfileOverviewTab, ProfilePaymentsTab, ProfileAttendanceTab, ProfileHistoryTab, ActivityList,
  StudentEditDialogV2; hisoblar — profileLedger.ts (qarz, oylar, darslar), profileActivity.ts (tarix), profileKpis.tsx.
  Ma'lumot — bitta so'rov `GET /api/pupils/:id/profile` (lib/pupilProfile.ts tiplari). Manzil: bazadagi o'quvchi
  (`/student-edit/:id?src=list`) — yangi sahifa; `?classic=1`, eski tablar va buyurtma id'lari — eski. Rasmdan farqlar —
  `SAVOLLAR.md` 149–159.

## Guruh sahifasi (rasmlar «Guruh · Bugungi dars, davomat», «Guruh · Tanga berish», «Guruh · Davomat jurnali», 24.10.2026)

- **Sarlavha**: «← Guruhlar › Ingliz tili · 2-bosqich» (`small`). Kartochka: 44 px kvadratda kitob (fan rangi —
  `FAN_BG` + `FAN_TEXT`), nom 20 px qalin + holat belgisi («Faol» — `GROUP_TONE`); ostida ikonka bilan ustoz (20 px
  doira), xona, kunlar · vaqt, «320 000 so'm/oy» (Oflayn kurslar narxi, `GET /api/groups/:id` → `monthlyPrice`),
  «02.03.2026 dan»; o'ngda «O'quvchi qo'shish» (ikkinchi darajali) va «⋯». Kartochka pastida tablar «Bugungi dars |
  Davomat jurnali | O'quvchilar N» (faol — qalin + 2 px `brand` chiziq; aylantirish chizig'i yashirin).
- **Bugungi dars**: «‹ Bugun, 12-oktyabr · dushanba ›» + ostida «16:00–18:00 · 205-xona · ustoz», holat belgisi
  («Belgilanmoqda» `warning`, «Belgilandi» `success`, «Rejada» betaraf, «Belgilanmagan» `danger`), o'ngda «Dars
  boshlanganiga 7 daqiqa». `info-bg` qatori: «Hamma «keldi» deb ochildi — faqat kelmaganlarni bosing. Tanga shu
  yerning o'zida beriladi.» (cheklovda — qulf ikonka, `warning-bg`, sababi). Jadval: № | O'quvchi (24 px doira + ism) |
  Davomat — uch tugmali segment (tanlangani o'z rangida chegara + fon: Keldi `success`, Kelmadi `danger`, Sababli
  `warning`) | Izoh (faqat darsda yo'q o'quvchida, 32 px maydon) | Bugungi tanga (chiplar «+1 Uy vazifasi» `success-bg`,
  «−1 …» `danger-bg`, bosilsa — «Ortga»; «+ Tanga» 24 px tabletka) | Tanga jami (tanga ikonkasi + son). Pastki qator:
  «✓ 8 keldi ✕ 1 kelmadi – 1 sababli | ◎ +5 tanga berildi», o'ngda «Saqlanmagan o'zgarishlar», «Bekor qilish»,
  «✓ Saqlash» (32 px). Tor konteynerda (<50rem) qator kartochkaga aylanadi: ism + tanga jami, ostida segment (to'liq
  kenglik), izoh, tangalar.
- **Tanga berish** (320 px suzuvchi oyna, «+ Tanga» ostidan): sarlavha + «Ism · hozir 45 tanga», ✕; bandlar — nom +
  o'ngda miqdor belgisi (`success-bg` / `danger-bg`), tanlangani `brand` chegara + `brand-bg` + ✓; «Yoki boshqa miqdor»
  — 32 px stepper; izoh maydoni (qo'shimcha sababda); pastda `surface-2` qator: «⚙ Qoidalar Sozlamalarda» va asosiy
  tugma «◎ +2 tanga berish».
- **Davomat jurnali**: to'rt ko'rsatkich (bitta kartochka): O'rtacha davomat · oy (foiz + `brand` chiziq, «42 / 50
  qatnashuv») | O'tgan darslar («13 tadan · 8 tasi oldinda») | Diqqat talab (ⓘ, «1 o'quvchi», «Behruz Olimov · 40%») |
  Berilgan tanga · oy («+51», «10 o'quvchiga»). Oy tanlagich + o'ngda izoh (✓ Keldi ✕ Kelmadi – Sababli • Rejada).
  Jadval: o'quvchi (yopishqoq chap ustun) | dars kunlari (raqam + qisqa hafta kuni; bugungisi `brand-bg` ustun + «bugun»)
  — kataklarda 20 px belgilar, rejada — kulrang nuqta | Davomat (foiz; 70% dan past — `danger` + ⓘ) | Tanga · okt. Pastda
  «Kelganlar» qatori (`surface-2`: «9/10», foiz, tanga jami) va izoh «Katakni bosib belgini tuzatish mumkin…».
- Kodda: `components/v2/groups/detail/` — GroupDetailV2 (sarlavha, tablar `?tab=bugun|jurnal|oquvchilar` —
  window.history.replaceState), TodayLessonTab, CoinPanel, JournalTab, GroupStudentsTab; groupDetailBits.tsx (holatlar,
  dars kunlari, cheklov taqlidi), useGroupDetail.ts, attendanceApi.ts. Manzil `/groups/:id` — yangi sahifa; `?classic=1`
  va eski tablar (`tasks`, `lesson`, `history`) — eski. Rasmdan farqlar — `SAVOLLAR.md` 160–171.

## Gamifikatsiya — Reyting, Do'kon, Tanga qoidalari (rasmlar «Reyting · oylik va umumiy», «Do'kon · So'rovlar», «Do'kon · Sovg'alar», «Sozlamalar · Tanga qoidalari», 24.10.2026)

- **Reyting**: sarlavha «Reyting» + «Filial · N o'quvchi · oktyabr 1–12 bo'yicha»; o'ngda segment «Oktyabr · oylik |
  Umumiy», «Guruh: Hammasi» (V2Select `value`), proyektor ikonkasi. Uchlik — `surface-2` qutida uch kartochka (2 · 1 · 3):
  o'rin belgisi (birinchisi `warning-bg` + 👑), 40 px doira, ism, guruh, «+12 tanga» (22 px) va «jami 84»; birinchisi
  `brand` chegara + `brand-bg`. Jadval: O'rin (1-o'rin — `warning-bg` kvadrat) | O'quvchi | Guruh | «Oktyabr, tanga»
  (`series-1` chiziq + qiymat) | Jami tanga; o'ngda 17.5rem ustun — «O'tgan oylar g'oliblari», «Qanday hisoblanadi» +
  «⚙ Tanga qoidalari». Uchlik va «1» belgisi faqat tangasi 0 dan katta bo'lsa.
- **Do'kon**: «Do'kon» + «Sovg'alar tanga evaziga · o'quvchi kabinetdan so'rov yuboradi, siz tasdiqlaysiz», o'ngda «⋯» va
  «+ Sovg'a qo'shish»; tablar «So'rovlar [N yangi — `brand` tabletka] | Sovg'alar N». So'rovlar — `info-bg` izoh, ikki
  kartochka-jadval: «Yangi so'rovlar · N ta · eng eskisi pastda» (o'quvchi + guruh, 32 px `brand-bg` sovg'a belgisi +
  «qoldiq N ta», 🪙 narx, «45 → 20», «12-oktyabr | 18:12», «Rad etish» + «✓ Tasdiqlash») va «Topshirish kutilmoqda · N
  ta · tanga ayirilgan» («🎁 Topshirildi», «⋯ → Bekor qilish»), o'ngda «Tarix: topshirilgan va rad etilganlar →» (o'ngdan
  oyna). Tor ekranda amal ustuni o'ngga yopishgan. Sovg'alar — qidiruv + chiplar «Hammasi · Mavjud · Tugagan», kartochkalar
  (`brand-bg` tepada chiziqli ikonka, tugagani `surface-2` kulrang + «Tugagan»), «✎ Tahrirlash» + «⋯», oxirida uzuq
  chegarali «+ Sovg'a qo'shish».
- **Tanga qoidalari** (Sozlamalar ramkasida): «Gamifikatsiya» + sarlavha + izoh, «+ Qoida qo'shish»; jadval Qoida | Tanga
  (`success-bg` / `danger-bg` tabletka) | Turi (Berish / Ayirish) | Holat (● Faol) | ✎ ⋯, oxirida uzuq «+ Yangi qoida
  qo'shish»; ostida yig'iq «Avtomatik tangalar» va «Reyting» izohi.
- Kodda: `components/v2/gamification/` — RankingV2, ShopV2 (+ ShopRequestsTab, ShopGiftsTab, ShopDialogs, shopTypes,
  gamBits — sovg'a ikonkasi nom bo'yicha); `components/v2/settings/CoinRulesV2.tsx`. Server: lib/gamification/
  rankingBoard.ts (GET /api/gamification/ranking/board), shopRequests.ts (GET /api/gamification/shop/requests,
  …/approve, …/reject, …/history, POST /api/gamification/shop/orders/:id/handover). Eski oynalar (sovg'a formasi,
  berish, qaytarish, sabab formalari, o'quvchi profili) qayta ishlatilgan. `?classic=1` — eski sahifalar. Rasmdan
  farqlar — `SAVOLLAR.md` 172–184.

## Imtihon → UzBMB (rasmlar «UzBMB · Natija kiritish», «Natijalar va taqqoslash», «Excel eksport», «Sozlamalar · Imtihon fanlari», 25.10.2026)

- **Sarlavha** (ikkala ko'rinishda): yo'l «UzBMB › Natija kiritish» / «UzBMB › Natijalar», «Imtihon», o'ngda «⤒ Excel'dan
  yuklash» va «⤓ Eksport ⌄» (ikkinchi darajali); tablar «Sarhisob | UzBMB».
- **Natija kiritish — tanlovlar** (`surface-2` kartochka, 5 ustun): Test, Sana («10-oktabr ⌄»), Guruh, Yo'nalish (yorliq
  yonida «avto» — `brand-bg`), «Maks. ball» qutisi — «189» qalin + «= 93 + 63 + 33» `caption text-3`. Yo'nalish ro'yxati —
  ikki ustun (1-blok fani | 2-blok fani), band qilingan fan ikkinchi ustunda `text-3`.
- **Jadval**: sarlavha uch qatorli — «1-blok» `caption text-3`, fan nomi qalin, «30 × 3,1» `caption text-3`; Jami ball — «189
  dan». Katak — 28 px maydon (son qalin, o'ngda «/30» `text-3`), ostida «= 74,4 ball» (11 px `text-3`). Sertifikat — maydon
  `brand-bg` + brend chegara, «93,0 ball», ostida 🎖 «Sertifikat» `brand-text`; belgi maydon ichida faqat fokus/hover'da.
  Jami — qalin + 72 px `series-1` chiziq; ✓ `success`; fokusdagi qator `brand-bg`, o'ngda «[Tab]», jami o'rnida
  «kiritilmoqda…»; qisman — «to'liq emas» `warning`; bo'sh — «kiritilmagan». Pastda `surface-2`: «6 / 8 kiritildi • Guruh
  o'rtachasi 145,5 ball», izoh 🎖 «Sertifikati bor fan…», «Bekor qilish», «✓ Natijalarni saqlash».
- **Natijalar**: Test («… №3 · 10-oktabr»), Guruh, o'ngda «✎ Natija kiritish». Jadval: O'rin (1 — `warning-bg` doira, qolgani
  oddiy son), O'quvchi (bosh harflar doirasi `surface-2` + qalin ism), 1-blok /93 (sertifikat belgisi `brand-text`),
  2-blok /63, Majburiy /33, Jami /189 (qalin + 84 px `series-1` chiziq), «№2 testdan» (↑ `success` / ↓ `danger`, yo'q —
  «—»); to'liq emaslar pastda — «—» va «natija to'liq kiritilmagan» `text-3`.
- **Taqqoslash** (o'ngda, 300 px): «o'rtacha ball, 189 dan»; «Bu guruh · №3» — `series-1`, filial va oldingi test — `track`
  (8 px chiziq, izi `hover`); «Fanlar bo'yicha o'zlashtirish» — 6 px chiziq `brand` (izi `brand-bg`), eng pasti `warning`;
  ostida `warning-bg` quti «⚠ Kimyo eng past — 69%. Keyingi testgacha shu fanga e'tibor.»; «Ball oralig'i» — uch katak
  `surface-2`.
- **Eksport paneli** (tugma ostida, 340 px): «Natijalarni yuklab olish» + ×; ikki radio kartochka (tanlangani brend chegara +
  `brand-bg`), ikki katakcha, to'liq enli asosiy tugma «Excel (.xlsx) yuklab olish».
- **Sozlamalar · Imtihon fanlari**: sarlavha «O'quv» / «Imtihon fanlari» / izoh, o'ngda «+ Fan qo'shish». «UzBMB ball
  tuzilishi» — Bo'lim (nomi qalin + izoh `caption`) | Savollar | Koeffitsiyent (64 px maydonlar) | Maks. ball (o'ngda,
  «33 · 3 × 11»); «Jami 189»; o'zgarsa kartochka ostida `surface-2` qator «O'zgarish saqlanmagan» + «Bekor qilish» /
  «Saqlash». «Fanlar» — Fan (majburiylarda 🔒), Qayerda (teg `surface-2` + chegara: «Majburiy», «Majburiy · blokda ham»,
  «Blok fani»), Holat (nuqta + «Faol»), ✎ ⋯; uzuq chegarali «+ Yangi fan qo'shish»; ostida 🎖 izoh.
- Kodda: `components/v2/imtihon/uzbmb/` — UzbmbV2 (manzil `?tab=uzbmb&test=&guruh=&rejim=kiritish`, `&eski=1` — eski
  oyna), UbEntry, UbResults, UbSideCard, ubExport, ubDialogs (test, o'quvchi qo'shish, Excel'dan yuklash), ubPickers,
  ubCore; sozlama — `components/v2/settings/ExamSubjectsV2.tsx`; hisob — `lib/uzbmb.ts`, server — `lib/uzbmbServer.ts`.
  Rasmdan farqlar — `SAVOLLAR.md` 185–197.

## Boshqaruv → Ishga qabul (CV) (rasmlar «Nomzodlar ro'yxati», «Nomzod paneli», «Ishga olish oynasi», «Ochiq anketa (#ariza)», 25.10.2026)

- **Ro'yxat**: sarlavha «Ishga qabul (CV)», izoh «Nomzodlar ochiq anketa orqali keladi · barcha filiallar»; o'ngda «🔗 Anketa
  havolasini nusxalash» (ikkinchi darajali), «⋯» (anketani ochish, eski ko'rinish), «+ Nomzod qo'shish» (asosiy). Holat
  kartalari — 6 ta (Hammasi · Yangi `info` · Ko'rildi `text-3` · Suhbat `violet` · Ishga olindi `success` · Rad etildi
  `danger` nuqtasi), ostida izoh `caption text-3` («javob kutmoqda», «13–14-oktabr»); tanlangani `brand-bg` + brend chegara.
  Filtrlar: qidiruv «Ism yoki telefon», chiplar Yo'nalish/Filial/Tajriba, o'ngda «Ustunlar».
- **Jadval**: Nomzod (bosh harflar doirasi `surface-2`, qalin ism, yangisida `info` nuqta, ostida telefon `caption`),
  Yo'nalish, Tajriba («Tajribasiz» `text-2`), Sertifikat (🎖 + matn), Filial, Kelgan («11-oktabr | 21:14»), Holat (belgi +
  ostida suhbat vaqti / ishga olingan kun / rad sababi `caption text-3`), ⋯. Ochiq qator — `brand` foni. Pastda «1–8 / 8 ta»
  va ⓘ «Ishga olinganlar avtomatik «Xodimlar» ro'yxatiga o'tadi».
- **Nomzod paneli** (o'ngdan, 460 px, kontent hududi ichida): avatar (bosh harflar `brand-bg`), ism, holat belgisi +
  «Ingliz tili · 4 yil tajriba», ×. Bosqich chizig'i — 22 px doiralar: o'tgani `brand` + ✓, joriysi brend halqa + nuqta,
  keyingisi `border-strong`; chiziqlar 2 px. Suhbat kartasi — `violet-bg`, oq kvadratda 📅, «Suhbat · 14-oktabr | 15:00»
  qalin, joy `caption`, o'ngda «O'zgartirish» `violet`. Bo'limlar (Aloqa, Ma'lumot, Tajriba, Ish sharoiti, Rezyume) —
  sarlavha `caption text-2`, qator: yorliq `text-2` | qiymat o'rtacha qalin; rezyume — fayl kartasi (qizil PDF belgisi, nom
  qalin, «PDF · 240 KB», ↗). Pastda «8-oktabr | 10:05 da kelgan», «Rad etish» (`danger` chegarali), «💼 Ishga olish».
- **Ishga olish oynasi** (markazda, 480 px): «Ishga olish», izoh «Maftuna Ismoilova · Ingliz tili · suhbatdan o'tdi»;
  ikki ustun — Lavozim | Filial, Ish boshlash sanasi | Yo'nalish; «Oylik hisoblash usuli» segment (Oklad + foiz · Oklad ·
  Foiz); Oklad (so'm) | Foiz (%) izohlari bilan; `info-bg` quti — «Xodimlar» ro'yxatiga qo'shilishi va oklad kunlarga
  bo'linishi; «Bekor qilish», «✓ Ishga olish».
- **Ochiq anketa (/ariza)**: oq yuqori chiziq — «A» belgisi (`brand`), «Akademiya o'quv markazi / Ishga qabul anketasi»
  (o'ngda til va tungi rejim); fon `bg`; 640 px ustun: sarlavha 26 px, izoh; bosqich chizig'i (o'tgani ✓ `brand`, joriysi
  halqa + raqam, keyingisi `border-strong` + raqam `text-3`; telefonda faqat joriy nomi); oq karta — «2. Ma'lumot va
  tajriba» + «Ixtiyoriy savollar alohida belgilangan, qolganlari majburiy»; chiplar (✓ bilan `brand-bg`), segment
  (tajriba), «Daraja yoki ball» yonma-yon; pastda «← Orqaga» · «2 / 4 bo'lim» · «Keyingisi →» (oxirida «Arizani yuborish»).
- Kodda: `components/v2/cv/` — CvListV2, CvPanelV2, cvDialogs (suhbat, rad etish, ishga olish), CvAddDialogV2, CvApplyFields
  (anketa bo'limlari va tekshiruvi — ikkala joyda), CvApplyPageV2, cvBits, cvColumns; server — `lib/cvHire.ts`,
  `lib/cvApplyServer.ts`, `lib/hrEmployeeCreate.ts`, `planCvPatch` (lib/managementCv.ts). Rasmdan farqlar — `SAVOLLAR.md`
  198–211.

## Kirish sahifasi, Filial tanlash, Amallar jurnali (rasmlar «Kirish sahifasi», «Filial tanlash», «Amallar jurnali · namuna», yorug'/qorong'i, 25.10.2026)

- **Kirish sahifasi**: chapda brend paneli (45 %, ≥1024 px) — teal gradient (`teal-500` → `teal-700`, o'ng tepada oq yorug'
  dog'), ikkala temada bir xil; «Tizimli» belgisi (oq shaffof kvadrat), sarlavha 30 px «O'quv markazingiz — bitta tizimda»,
  uchta imkoniyat (36 px oq/15 % kvadratda ikonka, qalin nom, ostida `white/80`), pastda «© 2026 Tizimli · tizimli24.uz».
  O'ngda 368 px ustun: «Tizimga kirish» 24 px, izoh `text-2`; «Telefon raqam» (+998 prefiksli maydon), «Parol» (👁),
  «☑ Meni eslab qol» · o'ngda «Parolni unutdim?» (`brand-text`, qalin), asosiy tugma «→ Kirish» to'liq kenglikda; ostida
  `surface` quti 🛡 + «Login yoki parol bo'lmasa…». Xato — tugma ustida `danger-bg` qator, bo'sh maydon qizil chegarada. Telefonda panel yo'q — tepada
  faqat belgi.
- **Filial tanlash** (kirishdan keyin, filial >1 bo'lsa): markazda 420 px karta — belgi, «Xush kelibsiz, {ism}!» 22 px,
  «Qaysi filialda ishlaysiz?»; qatorlar (raqam kvadrati `surface-2`, nom qalin, lavozim `caption text-2`, oxirgisida
  «oxirgi marta shu yerda» `brand-text`), o'ngda radio; tanlangani `brand-bg` + brend chegara. «Davom ettirish →» asosiy,
  ostida izoh `caption text-2`. Klaviatura: ↑/↓, Enter; ikki marta bosish — darhol kirish.
- **Amallar jurnali**: sarlavha «Amallar jurnali», izoh «Barcha filiallar · kim, qachon, nima qildi»; o'ngda qidiruv «Ism,
  summa yoki guruh». Toifa chiplari (soni bilan, tanlangani `brand-bg`; telefonda yon tomonga suriladi), o'ngda «Xodim:
  Hammasi», «Filial: Barchasi», sana oralig'i. Chapda ro'yxat kartasi: kun sarlavhasi «**Bugun** 25-oktabr, yakshanba · 11
  ta amal»; qator — vaqt `small text-2` (44 px), 28 px toifa doirasi (kirim `success-bg`, chiqim `danger-bg`, o'quvchi/guruh
  `info-bg`, lid `violet-bg`, xodim `brand-bg`, o'chirish `danger-bg` 🗑, rad etilgan `warning-bg` 🛡, kirish/boshqa —
  chegarali `surface-2`) va ular orasida 1 px chiziq; «**Ism** fe'l — obyekt», ostida meta `caption text-2` (toifa · usul
  · kassa · filial · …); o'ngda summa (+ `success` / − `danger`, «so'm» `caption`), «O'chirilgan» / «Rad etildi» belgisi
  yoki ochiq qatorda «Yopish ⌃». Tahrir qatori bosilsa — `surface-2` foni, ichida jadval «Maydon | Oldin | Keyin» (oldin —
  `danger-bg` ustidan chizilgan, keyin — `success-bg` qalin). Telefonda summa/belgi sarlavha ostiga tushadi. O'ngda 280 px:
  «Davr bo'yicha» (toifa nomi, `series-1` chizig'i, son) va «Nima yoziladi» (toifa: izoh).
- Kodda: `components/v2/auth/` — LoginV2 (kirish, parolni tiklash), BranchPickV2, AuthBrandPanel; `components/v2/actionLog/`
  — ActionLogV2, logBits; server — `lib/actionLogView.ts` (yozuv → odam tili, toifa, farq), `lib/actionLogSnapshot.ts`
  (tahrirdan oldingi holat, proxy.ts), `/api/action-log/feed`, `/api/auth/branches`. Rasmdan farqlar — `SAVOLLAR.md` 212–220.

## Hisobotlar (rasmlar «Hisobotlar katalogi», «Kelgan va ketgan · namuna», «Qarzdorlar · namuna», «Qarzdorlar → PDF · namuna», yorug'/qorong'i, 25.10.2026)

- **Katalog** (`/reports`): «Hisobotlar», izoh «Barcha filiallar · 9 ta hisobot · har biri Excel va PDF'ga yuklanadi»,
  o'ngda «Hisobot nomi» qidiruvi. Guruh sarlavhasi — 28 px rangli kvadratda ikonka (Moliya `success-bg` hamyon, O'quvchilar
  oqimi `info-bg` ayri, Davomat `warning-bg` kalendar, Xodimlar va oylik `violet-bg` odamlar) + qalin nom + «3 ta» `text-3`.
  Kartochkalar 3 ustun (planshetda 2, telefonda 1): nomi qalin, o'ngda → `text-3`, izoh `small text-2`, pastda «Excel»
  «PDF» belgilari (20 px, `surface-2`, chegara, 11 px qalin).
- **Hisobot qolipi**: yo'l «Hisobotlar › guruh › nomi» (oxirgisi `text`), sarlavha, izoh «guruh · …»; o'ngda «Excel»
  (yashil fayl ikonkasi) va «PDF» (qizil) — ikkinchi darajali tugmalar. Filtrlar qatori (oy oralig'i / «… holatiga»,
  «Filial: …», «Kurs/Guruh: …»), o'ngda segment. Ko'rsatkichlar — BITTA karta, ustunlar 1 px chiziq bilan: yorliq `small
  text-2`, son 24 px qalin (birlik `body text-2`), izoh `caption`; kichik chiziqli grafik — yuqori o'ngda. Grafik —
  «Oyma-oy» (6-qism tizimi: ko'k/to'q sariq, davom etayotgan oy och va «*», ustiga kelinsa — kulrang ustun, sonlar va
  maslahat oynasi + «sof o'sish»). Jadval — `surface-2` sarlavha, raqamlar o'ngda, «Jami» qatori qalin; ostida ⓘ izoh.
- **Kelgan va ketgan**: oylar oralig'i (sukut — oxirgi 6 oy), Filial: Barchasi, Kurs: Hammasi; Guruhga kelgan · Guruhdan
  ketgan · Sof o'sish · Faol o'quvchilar (+ grafik, «+24 sentabr oxiriga nisbatan»); jadval Oy · Guruhga kelgan · Guruhdan
  ketgan · Sof o'sish (manfiy — qizil) · Oy oxirida faol; joriy oy «Oktyabr · 1–25»; tarix boshlanmagan oy — «—».
- **Qarzdorlar**: «25-oktyabr holatiga» (sana tanlovi), Filial, Guruh, o'ngda Hammasi / 1 oy / 2+ oy; ko'rsatkichlar
  (!) Jami qarz · Qarzdorlar · 2 oy va undan ko'p («… so'm · birinchi navbatda»); jadval — bosh harflar doirasi + qalin
  ism, guruh(lar) `small text-2`, oylar + qizil «3 oy» belgisi, qarz qalin, oxirgi to'lov «12-iyul | 16:30», telefon,
  amallar 💬 💳; «Jami · 7 o'quvchi».
- **PDF oynasi** (markazda, 820 px): chapda `bg` ustida A4 varaq (chop etiladigan HTML'ning o'zi, kichraytirilgan),
  o'ngda 288 px: «PDF'ga chiqarish» · «Qarzdorlar · 1 sahifa» · ×; «Sahifa» — A4 · tik / A4 · yotiq; galochkalar
  (Markaz nomi va filial, Sana va kim tayyorlagani, hisobotniki — Ota-ona telefonlari); «Joriy filtrlar bilan» qutisi
  (`surface-2`); pastda «PDF yuklab olish» (asosiy) va «Chop etish», ostida izoh. Varaq: logotip + markaz va filial,
  o'ngda sana va kim; teal chiziq; sarlavha; kulrang ko'rsatkich qutilari; jadval; pastda «Tizimli · tizimli24.uz» va
  «1 / 1».
- Kodda: `components/v2/reports/` — ReportsCatalogV2, ReportView, reportUi (qolip, ko'rsatkichlar, jadval), ReportBarChart,
  V2MonthRange, ReportPdfDialog, reportExport (Excel/chop etish), reportHooks; hisobotlar — KelganKetganReport,
  QarzdorlarReport, MoliyaReports, FaolOquvchilarReport, DavomatReports, XodimReports. Server — lib/reportsCatalog.ts,
  lib/reportStudents.ts, lib/reportAttendance.ts, lib/reportScope.ts, lib/debtors.ts (`unpaid`, `lastPayment`,
  `parentPhone`). Rasmdan farqlar — `SAVOLLAR.md` 221–233.

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

### Sahifalar yangi dizaynga qanday o'tadi (18.10.2026, birinchisi — O'quvchilar ro'yxati)

- **Server sahifa versiyani tanlaydi**: `app/(app)/students-list/page.tsx` —
  `currentUiVersion()` bo'yicha eski komponent yoki `components/v2/<bo'lim>/…V2.tsx`.
  Birinchi chizishdayoq to'g'ri ko'rinish, miltillash yo'q.
- **Ma'lumot va mantiq BITTA**: qatorlar, filtr variantlari, holat o'zgarishi —
  `components/students/useStudentsList.ts`; filtrlash — `lib/studentsData.ts`; eksport —
  `lib/studentsExport.ts`. Eski sahifa ham shulardan foydalanadi: versiyani almashtirgan
  xodim aynan o'sha ro'yxat va o'sha summalarni ko'radi.
- **Sahifa ildizi** `data-ui="v2"` + `bg-v2-surface` + `font-v2` (shundan keyin `color-scheme`
  ham yangi tizimdan). Oynalar (o'quvchi qo'shish, guruh, SMS, holat) hozircha eski.
- **Yangi UI bloklari — `components/v2/ui/`** (eski `ui/Select`, `ui/Pagination` v2 sahifada
  ishlatilmaydi):
  - `FloatingPanel` — `<body>` ga portal, o'zi `data-ui="v2"` oladi (aks holda tokenlar
    yo'q); ichma-ich panel (oyna ichidagi tanlov) uchun ochilish tartibi: o'zidan keyin
    ochilgan panelga bosish yopmaydi, Esc faqat eng ustdagini yopadi;
  - `V2Select` — `field` («Hammasi ⌄», `border-field`) va `chip` («Kurs: Ingliz tili ×»,
    `brand-bg` + `brand`); `ActionMenu` — «⋯», «Export», qator menyusi; `V2Checkbox`
    (`indeterminate` bilan); `V2Pagination`.
- **Jadval**: eski `.table-scroll` / `.table-box` klasslari ISHLATILMAYDI — globals.css dagi
  qotgan sarlavha qoidasi eski rangni (`--secondary`) beradi va qatlamsiz bo'lgani uchun
  utilitlardan kuchli. O'rniga `th` ga `sticky top-0 bg-v2-surface-2
  shadow-[inset_0_-1px_0_var(--v2-border)]`; ≥1024 px jadval kartada ichidan aylanadi
  (sahifa ildizi `lg:h-full`), torroqda — 70vh quti.
- **Maydon foni**: globals.css dagi `input:focus { background … !important }` — v2 maydonida
  `bg-v2-surface!` (yoki `bg-transparent!`).
- **Ikkinchi ro'yxat — Guruhlar** (`app/(app)/groups/page.tsx`, 18.10.2026): xuddi shu andoza;
  eski `GroupsListPage` ham umumiy hook'ga o'tkazildi (`useGroupsList`) — ko'rinishi o'zgarmadi.
  Umumiy bloklar ko'paydi: `ColumnsControl` + `columnPrefs` (Ustunlar oynasi), `buttons.ts`
  (tugma klasslari, «Yana filtrlar» holatlari), `table.ts` (qator foni), `groupStatus.ts`,
  `StaffName.tsx`.
- **Qator foni — tirqish tuzog'i** (`components/v2/ui/table.ts`): Chrome `<tr>` fonini har
  katakka alohida chizadi, kataklar eni kasr bo'lsa chegarada 1 px och/to'q chiziq qoladi
  (sariq va tanlangan qatorda ko'rinadi). Rangli qatorga fon + o'sha rangdagi ichki soya
  (`shadow-[inset_0_0_0_9999px_…]`) — `ROW_TINT`; chap chiziq — birinchi katakdagi soya
  (`ROW_BAR`).
- **Eski qatlamsiz CSS — ikki tuzoq** (19.10.2026, Oylik chiqarishda o'lchandi):
  1. `globals.css` dagi eski `.sm\:grid-cols-3` (qatlamsiz) qatlamli `xl:grid-cols-6` dan KUCHLI —
     1440 px da ham 3 ustun qolardi. Yangi sahifada `sm:` + kattaroq breakpoint juftligi kerak bo'lsa
     `min-[40rem]:` / `min-[80rem]:` yoziladi (ikkalasi rem — Tailwind tartiblaydi).
  2. `input:focus { background … !important }` bosilgan katakchani oqartirardi (belgi ko'rinmasdi) —
     `V2Checkbox` fonlari `!` bilan (qatlamli `!important` qatlamsizdan kuchli). O'quvchilar va Guruhlar
     ro'yxatlaridagi katakchalar ham shu bilan tuzaldi.
- **Qotgan chap ustunlar** (Oylik chiqarish): katak `sticky -left-px` va `left-[38px]` + `bg-inherit`
  (qator foni: oddiy qatorga `bg-v2-surface`); kasr kenglikda 1 px tirqishdan surilgan raqamlar
  ko'rinardi — kataklar 1 px ustma-ust. Sarlavha/«Jami» burchaklari `z-20`.

## Ochiq savollar

Hammasi bir joyda — [`SAVOLLAR.md`](SAVOLLAR.md) (oxirida birga ko'rib chiqiladi).
