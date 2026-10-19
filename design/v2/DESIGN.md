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
