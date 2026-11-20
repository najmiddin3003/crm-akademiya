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

## O'quvchilar bo'limi — 6 ta ro'yxat (30-qism, rasmlar «Yangi / Aktiv / Arxiv o'quvchilar», «Joriy oyda obunasi tugaydiganlar», «Ota-ona», «O'quvchilar manzillari», yorug'/qorong'i, 16.11.2026)

Hammasi «Sahifa qolipi — ro'yxat» ustida: sarlavha + izoh «filial · …», o'ngda Export (+ asosiy amal); filtr qatori
(qidiruv → chip'lar → o'ngda «Ustunlar»); xulosa «N ta … • … • …»; jadval (belgilash, bosh harflar doirasi + qalin ism +
telefon, ustunlar, o'ngda amallar); pastda «1–10 / N ta» va «10 qator». Rasmdagi «Namuna» — dizayner izohi, interfeysda yo'q.

- **Umumiy qismlar**: holat «tabletkalari» (h 32, `rounded-full`, tanlangani `brand-bg` + brend chegara + brend matn, son
  `text-3`) — Aktiv va Ota-onada; guruh katagi — fan nuqtasi + «Kurs · bosqich», ostida o'qituvchi `small text-3`
  (+«+1 guruh»); holat belgilari (`rounded-full`, nuqta + matn): `success-bg` «To'langan», «Kirgan · 11-okt»; `danger-bg`
  «Qarzdor · 2 oy»; `info-bg` «Taklif ketdi» / «Taklif · 3-okt»; `surface-2` «To'lov kuni · 15-okt», «Kirmagan».
- **Yangi o'quvchilar**: tepada `info-bg` qator (ⓘ + matn, o'ngda «Birinchi darsga yozilganlar →»); filtrlar Kurs, Guruh,
  Birinchi to'lov; xulosa «N ta yangi o'quvchi • Birinchi to'lov kutilmoqda … so'm • Ota-ona kabinetida N tasi»; ustunlar
  Guruh · Qo'shilgan (sana + «birinchi darsdan / to'g'ridan») · Birinchi oy to'lovi («160 000 / 320 000» + 6 px brend
  progress) · Ota-ona kabineti · Manba (+ brend «… orqali»); qatorda «To'lov» + ⋯.
- **Aktiv o'quvchilar**: tabletkalar Hammasi / «{Oy} to'langan» / Qarzdor / To'lov kuni kelmagan; asosiy amal «To'lov
  qabul qilish»; ustunlar Guruh · {joriy oy} (belgi) · Balans (o'ngda, «+80 000 so'm» yashil, «−640 000 so'm» qizil) ·
  Oxirgi to'lov · Taklif qilgani («5 kishi» qalin + «3 tasi to'ladi»).
- **Arxiv o'quvchilar**: tepada `surface-2` blok «Ketish sabablari · davr» — sabab chiplari (oq, chegara, son qalin;
  bosilsa jadval shu sabab bilan) + «Hisobotda ko'rish →»; filtr «Arxivlangan: davr ×» (sukut oxirgi 2 oy), Kurs;
  ustunlar Oxirgi guruh · Arxivlangan · O'qidi («2 oy», «2 hafta») · Sabab (sabab + izoh `text-3`) · Balans; qatorda
  «↺ Qaytarish» + ⋯; pastda izoh.
- **Obunasi tugaydiganlar**: `surface-2` qator (soat ikonkasi + avtomatik eslatma matni + «Sozlash»); filtrlar Kurs,
  Eslatma; ism ostida «ota-ona: telefon»; Obuna tugaydi («14-oktabr» + kichik belgi «2 kun» — 3 kungacha `warning-bg`);
  Keyingi to'lov (qalin, ostida «300 000 − 40 000 balansda»); Eslatma («Yuborildi · 11-okt» + «avtomatik / qo'lda · kim»
  yoki «Yuborilmagan»); qatorda 💬 + «To'lov». Belgilansa jadval tepasida `brand-bg` qator: «N ta tanlandi», «Bekor
  qilish», «✈ Eslatma yuborish · N SMS» → SMS oynasi.
- **Ota-ona**: asosiy amal «✈ Kabinetga taklif · N»; tabletkalar Hammasi / Kabinetga kirgan / Taklif yuborilgan / Kirmagan;
  filtrlar Qarindoshligi, Balans; xulosa «N ta ota-ona • N ta farzand • N oilada 2 va undan ko'p farzand»; ustunlar Kim ·
  Farzandlari (har farzand — fan nuqtasi + qalin ism, ostida guruh) · Ish joyi · Umumiy balans · Kabinet; qatorda 📞 💬 ⋯.
- **O'quvchilar manzillari**: tepada ikki blok — chapda «Mahallalar bo'yicha» (eng ko'p 5 ta: nom · 8 px brend chiziq ·
  «24 · 20%»; ostida «Yana N ta mahalla — N», «Mahalla kiritilmagan — N»), o'ngda 300 px uch qatorli karta (Manzil
  kiritilgan «112 / 118», Ijara uyda yashaydi, Mahallasi noma'lum + «Reklama natijasi →»); ustunlar Mahalla (qalin;
  bo'lmasa «Kiritilmagan» `text-3`) · Manzil (bo'lmasa brend «+ Manzil qo'shish») · Mo'ljal · Turi · Manba; manzilsiz
  qator `surface-2`.
- **Oynalar** (rasm yo'q, «Formalar» qoidasi): «To'lov eslatmasi» / «Kabinetga taklif» — kimlarga ro'yxati (raqami yo'q —
  qizil), shablon, matn ({name} {amount} {date} {link}), namuna; «Manzil qo'shish» — Mahalla, Manzil, Mo'ljal, Turi
  (Doimiy / Ijara segment).
- Kodda: `components/v2/students/lists/` — listKit (ma'lumot hook'i, qolip, kataklar, belgilar), NewStudentsV2,
  ActiveStudentsV2, ArchiveStudentsV2, ExpiringSubsV2, ParentsV2, StudentAddressesV2, BulkSmsDialogV2, AddressDialogV2.
  Server — `GET /api/students/lists` (lib/studentLists.ts; tanlov qoidalari lib/studentListsTypes.ts). Eski ko'rinish —
  `?classic=1`. Rasmdan farqlar — `SAVOLLAR.md` 410–419.

## Guruh va Boshqaruv — Yangi guruh, Barcha vazifalar, Guruh o'quvchilari, Jihozlar, Yangi xodim, Ish jadvallari (31-qism, yorug'/qorong'i, 16.11.2026)

- **Yangi guruh** (o'ngdan panel, 560 px): bo'limlar `caption text-3` sarlavha bilan — Guruh (nomi; Kurs + Daraja;
  Oylik narx — `surface-2` faqat o'qish maydoni, fan nuqtasi + qalin summa, kurs narxidan; Sig'im «12 o'rin»; Guruh
  holati Yig'ilmoqda / Aktiv va Ta'lim turi — segmentlar) → Dars jadvali (kunlar — tabletkalar «✓ Toq kunlar», Juft,
  Hafta kunlari, Boshqa kunlar → 7 kun tugmasi; sarlavha yonida «Du, Ch, Ju»; Boshlanish sanasi · vaqti · Davomiyligi;
  O'qituvchi + Yordamchi, ostida «… band»; Xona — kartalar: raqam katta, sig'im `caption`, sig'im kam — `warning`,
  band — o'chiq, tanlangan — `brand-bg` + ✓; ostida izoh «Sig'im 12 ga faqat 205-xona yetadi»; hammasi bo'sh bo'lsa
  `success-bg` qator «O'qituvchi va xona … da bo'sh · Jadvalda ko'rish») → «+ Qo'shimcha» (uzuq chegara, ochiladi).
  Pastda chapda «☐ Keyin o'quvchi qo'shish», o'ngda «Bekor qilish» + «✓ Guruhni saqlash».
- **Barcha vazifalar**: `info-bg` qator + «Tanga qoidalari →»; tablar (tagiga chiziq) Hammasi / Uy vazifasi / Test va
  imtihon; filtrlar Vazifa nomi, Guruh, O'qituvchi, «Berilgan: oy ×»; jadval Vazifa (qalin + tur belgisi `brand-bg` /
  `violet-bg` + «berilgan 09.10») · Guruh (fan nuqtasi, o'qituvchi) · Muddat (sana + «muddati o'tdi» `surface-2` /
  «2 kun qoldi» `info-bg`) · Maks. ball · ⋯. «Vazifa berish» — o'ngdan panel.
- **Guruh o'quvchilari**: bitta jadval, guruhlar bo'limlarga bo'lingan — `surface-2` sarlavha qatori (fan nuqtasi,
  qalin nom, «o'qituvchi · kunlar vaqt · xona», holat belgisi, o'ngda 80 px chiziq + «6 / 12 o'rin», kerak bo'lsa
  `warning` «xonada 8 o'rin»); a'zo qatori: o'quvchi, Qo'shilgan, Holati (Yangi `info` / Faol `success`), Davomat ·
  joriy oy («2 / 2 dars», kelmagani 0 — `danger`), Balans, «Ko'chirish» + ⋯; pastda izoh.
- **Jihozlar**: 4 ko'rsatkich bitta kartada (Jami jihoz «91 dona · 10 nom», Umumiy qiymati, Ta'mirda `warning`,
  Kafolati 30 kunda tugaydi); xonalar tabletkalari, o'ngda Turi / Holati; jadval Jihoz (qalin + «INV · turi») · Xona
  («5 ta xonada») · Soni · Holati (Ishlayapti `success` / Ta'mirda `warning` + izoh «lampa · 9-oktabrdan») · Qiymati
  (qalin + «450 000 × 24») · Olingan (sana + manba) · Mas'ul.
- **Yangi xodim** (o'ngdan panel): Shaxsiy (Ism, Familiya, Telefon «+998» + «Login shu raqam · parol SMS bilan»,
  Tug'ilgan sana) → Ish (Rol «O'qituvchi · o'z guruhlari», Yo'nalish, Ishga kirgan sana, Ish jadvali, Filiallar —
  chiplar + «+ Filial qo'shish», o'qituvchiga «Guruhni biriktirish» kartalari) → Oylik (Hisoblash usuli segment, Oklad
  + «Oktabr: 580 645 · 18/31 kun», Foiz %); pastda «☑ Login berish».
- **Ish jadvallari**: `info-bg` qator; Faol / Arxiv (kichik segment), qidiruv, Filial, Rol; jadval Jadval (rangli nuqta +
  qalin + kimlar uchun) · Ish vaqti (qalin + tanaffus) · Ish kunlari (7 ta kun belgisi, ishlaydigani `brand-bg`;
  «guruh kunlari», «har 3-kunda») · Haftada · Xodimlar (avatarlar + «8 xodim · 3 filialda»); tanlangan qator `brand-bg`
  + chapda 3 px. Pastda tanlangan jadval: sarlavha + «Xodimlar · 8», «Tahrirlash»; haftalik chiziq 06:00–22:00 (ish vaqti
  brend, tanaffus `warning-bg`, dam olish kuni yozuvi), o'ngda «Qoidalar» (rangli nuqta + qalin nom + izoh); pastda izoh.
- Kodda: `components/v2/groups/` — GroupFormDrawerV2, GroupTasksV2, GroupStudentsV2, EquipmentV2;
  `components/v2/employees/` — EmployeeCreateDrawerV2, WorkSchedulesV2. Server — `GET /api/groups/roster`
  (lib/groupRoster.ts); yangi maydonlar: `groups.capacity`, jihoz (lib/equipment.ts → equipmentExtras), ish jadvali
  (lib/workSchedules.ts → scheduleExtras), `login` (lib/hrEmployeeCreate.ts). Rasmdan farqlar — `SAVOLLAR.md` 420–428.

## Sotuv va marketing — Referallar, Sozlamalar → Referal dasturi (29-qism, yorug'/qorong'i, 17.11.2026)

- **Referallar** (`/sales-referrals`, yon menyuda Sotuv va marketing): «Qoidalar» (→ Sozlamalar) + «Taklif qiluvchi
  qo'shish»; 4 ko'rsatkich (Taklif qiluvchilar · turlari, Taklif qilinganlar · to'lov qildi %, Hisoblangan referallar ·
  shu / o'tgan oy, 🎁 Sovg'alar · so'rov); tablar Taklif qiluvchilar · Taklif qilinganlar · Sovg'alar va so'rovlar
  («N yangi» `brand` belgi).
  - Taklif qiluvchilar: tur tabletkalari, filial, qidiruv; jadval avatar + ism + tur belgisi (Maktab ustozi `info`,
    O'quvchi `success`, Ota-ona `violet`, Boshqa neytral) + izoh · Filial · Kod (mono, chegarali) · Taklif qildi · To'lov
    qildi · Balans (qalin) · Keyingi sovg'a (so'rov bo'lsa `warning-bg` «So'rov: …» + «tasdiq kutilmoqda · 6 → 1»; aks
    holda chiziq «nom · 2 / 3», «olishi mumkin: …» `success`).
  - Taklif qilinganlar: Hammasi / Hisoblangan / Kutilmoqda / Rad etdi, «Qo'lda biriktirish»; jadval O'quvchi (guruh) ·
    Filial · Kim taklif qildi (tur belgisi) · Qanday (ikonka: Kod, Havola, Tavsiya, sertifikat raqami) · Holat (Lid
    neytral, Birinchi dars / Guruhda `info`, To'lov qisman `warning`, «+1 · sana» `success`, Rad `danger`; ostida izoh) ·
    Taklif sanasi.
  - Sovg'alar va so'rovlar: `info-bg` izoh; «Yangi so'rovlar» jadvali (Balans a → b, «Rad etish» + «✓ Tasdiqlash»);
    «Referal do'koni» kartalari (tepasi `brand-bg`, «N referal» belgi, qoldiq · berilgan, «N kishi hozir ola oladi»,
    «Tahrirlash») + uzuq chegarali «+ Sovg'a qo'shish»; «Berilgan sovg'alar» jadvali.
- **Taklif qiluvchi paneli** (o'ngdan, 560 px): 3 ko'rsatkich (Balans, Taklif qildi, To'lov qildi); so'rov kartasi
  `warning-bg` + `warning` chegara («Rad etish» / «✓ Tasdiqlash»); Sovg'alar ro'yxati («So'radi», «Berish», «yana N ta»);
  «Kod va havola» — QR, kod va havola nusxalash; «Takliflari».
- **Referal biriktirish** oynasi: o'quvchi yoki lid qidiruvi, «Kim taklif qildi», «Qanday» — 3 radio karta (Tavsiya
  qildi, Kodni aytdi, Sertifikat), sertifikat raqami, izoh, `info-bg` oqibat qatori.
- **Sozlamalar → Lidlar → Referal dasturi**: «Kim taklif qila oladi» (4 almashtirgich), «Referal qachon hisoblanadi»
  (birinchi oy to'liq to'langanda · avtomatik), «Rag'bat sertifikati», «Kod va havola».
- Kodda: `components/v2/sales/ReferralsV2.tsx`, `components/v2/settings/ReferralSettingsV2.tsx`; server
  `lib/referrals.ts` (+ `lib/referralTypes.ts`), `/api/referrals`; so'rovnoma `?ref=KOD` → `linkByCode`.
  Rasmdan farqlar — `SAVOLLAR.md` 467–473.

## Moliya — Kunlik topshiruv (32-qism, rasmlar «Kunlik topshiruv», «Qabul qilish oynasi», yorug'/qorong'i, 16.11.2026)

- **Sahifa** (`/finance-handover`, yon menyuda Moliya → Kassalar ostida): sarlavha + «bugun, 16-noyabr | 18:00», o'ngda
  «Hisobot» (CSV); `info-bg` qator (ko'chirma — kirim emas, farqqa izoh majburiy).
- **Kartalar** «Bugun topshirilishi kerak» (o'ngda «3 kassa · 1 970 000 so'm»): avatar + kassa nomi + egasi; holat belgisi —
  Tasdiq kutilmoqda `info` (karta chegarasi `brand`), N kun topshirilmagan / Hali topshirmagan `warning`, Bugun
  topshirgan `neutral`, Topshirilgan (kassa bo'sh) `success`; katta summa + «so'm kassada» / «so'm topshirildi»; usullar (nuqta + qalin summa,
  naqd birinchi); pastda «Oxirgi topshiruv: sana | vaqt · farq»; tugmalar «Qabul qilish» + «🔔 Eslatish» yoki kassir
  jo'natgan bo'lsa «✓ Tasdiqlash» + «Qaytarish».
- **Oy jadvali** «Noyabrdagi topshiruvlar»: Kassa / Oy tanlovlari (`V2Select` «value»); ustunlar Sana · Kassa (qalin +
  egasi) · Naqd · Plastik · Jami (qalin) · Farq (`danger`) · Qabul qildi · Holat (belgi + izoh); «Jami» qatori `surface-2`,
  Jami summa `brand`, o'ngda «Kassalar → Rahbar kassasi ko'chirmalari bilan bir xil». Ostida 3 ta izoh (ikonka + matn).
- **Qabul oynasi** (markazda, 520 px): tizim bo'yicha (naqd / plastik / jami) `surface-2` qutida; «Naqd pulni sanash» —
  8 ta kupyura qatori (200 000 … 1 000), − / son / + va qator jami; plastik maydoni + «☐ Kartamga tushganini tekshirdim»;
  farq qatori (`success-bg` «Farq yo'q» / `danger-bg` «Farq −260 000»), farq bo'lsa izoh majburiy; pastda ko'chirma
  izohi, «Bekor qilish» + «Qabul qilish · summa». Qaytarish — kichik oyna, sabab majburiy.
- Kodda: `components/v2/finance/DailyHandoverV2.tsx` (ikkala versiyada shu sahifa — eski versiyada bu sahifa yo'q edi);
  server `lib/dailyHandover.ts` (+ `lib/dailyHandoverTypes.ts` — klient uchun), `GET/POST /api/cashboxes/daily`.
  Ko'chirma — mavjud `applyCashboxTransferTo` / `decideTransferAs`; yozuv — `cash_handovers` (kupyuralar, farq, izoh,
  kim qabul qildi). Rasmdan farqlar — `SAVOLLAR.md` 429–433.

## Moliya — Moliyaviy reja, Shartnomalar, Integratsiyalar, kassir topshiruvi (32-qism davomi, yorug'/qorong'i, 17.11.2026)

- **Moliyaviy reja** (`/finance-revenue-plan`, yon menyuda «Moliyaviy reja»): oy (`V2MonthNav`), filial, Excel; tablar
  Tushum rejasi · Xarajat rejasi · Pul oqimi · Foyda va zarar (`?tab=`). Har tab tepasida 4 ko'rsatkichli bitta karta
  (birinchisi/asosiysi `brand-bg`; telefonda 2×2).
  - Tushum: bajarilish chizig'i (Tushdi `success`, Muddati o'tgan `danger`, Kutilmoqda — chiziqli), filiallar jadvali
    (Reja qalin, Qarz `danger` + «N qarzdor», bajarilish mini-chiziq + %), «Jami» `surface-2`; o'ngda «Eng katta qarzdorlar»
    (+ «Qarzdorlar · N →»); pastda «Reja qanday tuziladi».
  - Xarajat: moddalar jadvali (Reja, Sarflandi — summa + % + chiziq, oshsa `danger`; Qoldi; Oxirgi chiqim), rejada yo'q
    modda — «rejada yo'q» `warning`; «Rejani tahrirlash» → Rejalashtirilgan xarajatlar.
  - Pul oqimi: haftalar ustunlari (Kirim `info`, Chiqim `warning`, prognoz — chiziqli + chegarali; tepada qoldiq tabletkasi
    «N mln»), jadval Hafta (+ «prognoz» belgisi) · Boshida · Kirim `success` · Chiqim `danger` · Oxirida · Asosiy to'lovlar.
  - Foyda va zarar: `info-bg` izoh (kassa usuli), jadval Modda · 3 oy · joriy oy «hozircha» · «reja» ustuni (`brand-bg`
    xira); bo'limlar DAROMAD / XARAJATLAR (kichik bosh harf), Jami qatorlari qalin, «Sof foyda» `brand-bg`, «Foyda ulushi».
- **Shartnomalar** (`/finance-fin-contract`): «Shablon» + «Shartnoma tuzish»; `info-bg` izoh; tabletkalar Hammasi ·
  Imzolangan · Imzo kutilmoqda · Muddati tugaydi · Bekor qilingan; qidiruv, Filial. Jadval Raqam (tabular) · O'quvchi (fan
  nuqtasi + guruh · filial) · Imzolovchi (+ «onasi / otasi / o'zi, 18 yoshdan katta») · Oylik narx · Amal qilish muddati ·
  Holat (Imzolangan `success`, Imzo kutilmoqda `warning`, «N kunda tugaydi» `info`, Muddati tugagan `danger`, Bekor
  qilingan neytral; ostida «qog'ozda · sana | vaqt») · amal («Imzolandi», «Uzaytirish», ×). Pastda 3 izoh kartasi
  `surface-2`. Oynalar: tuzish (o'quvchi qidiruvi → guruh, imzolovchi segmenti, ism, telefon, narx, muddat), uzaytirish,
  bekor qilish (sabab chiplari, `danger` tugma).
- **Integratsiyalar** (Sozlamalar → Moliya): 6 karta (harf belgisi, nom, tur, holat tabletkasi — Ulangan `success`,
  Qo'lda `info`, Muammo/Qisman `warning`, Ulanmagan neytral; 2 qator izoh; pastda tugma), «Biriktirilmagan to'lovlar»
  kartasi (son belgisi) → mavjud biriktirish oynasi.
- **Kunlik topshiruv · kassir** (telefon): «Bugun kassada» kartasi (holat belgisi, katta summa, Naqd/Plastik), «Naqd pulni
  sanang» + «✓ N · mos» / farq, 8 kupyura qatori (− son +, qator jami), «☑ Plastik … rahbar kartasiga o'tkazdim», farq
  qatori (`success-bg` / `warning-bg`), pastda yopishqoq «✓ Topshirish · summa».
- Kodda: `components/v2/finance/` — FinancialPlanV2, ContractsV2, CashierHandoverV2; `components/v2/settings/IntegrationsV2`.
  Server: `lib/financialPlan.ts`, `lib/studentContracts.ts`, `lib/integrationsStatus.ts`, `/api/cashboxes/daily/send`.
  Rasmdan farqlar — `SAVOLLAR.md` 457–466.

## Gamifikatsiya — Tanga berish, Reyting, Hamyonlar, Guruhlar musobaqasi, Do'kon, Sozlamalar, Tangalarim (33-qism, yorug'/qorong'i, 17.11.2026)

- **Tanga berish** (`/gamification-lesson`, `?groupId=`): sarlavha + «Bugungi dars · sana, hafta kuni · vaqt · xona · ustoz»,
  o'ngda guruh tanlovi va «🏆 Guruh reytingi». Uch bo'lakli karta: Davomat · avtomatik (belgilar «N keldi · +5» `success`,
  «N kelmadi · −10» `danger`, «N sababli · 0», belgilanmagan — `warning`; «Davomatga o'tish»), Darsdagi faollik · guruhga
  («26 / 30 tanga», «qoldi 4» `warning`, chiziq), Bugun guruhga («+104», «+124 berildi · −20 ayirildi»). Sarhisob kartasi
  (`info-bg` ikonka, chegaralar tabletkalari, muddat). Jadval: O'quvchi (🔥 N dars · ● balans), Davomat, Uy vazifasi
  (✓ +5 `success` / ✗ −5 `danger`), Faollik +1…+5 (tanlangani `brand` to'la; limitdan oshadigani o'chiq), «± Sabab» + sabab
  chiplari + «ayirildi N / 20», Sarhisob o'tgan → joriy, Bugun; pastda «Qoidalar». Har amaldan keyin pastda qora qator
  «Ism · amal · ±N» + «↶ Ortga · 8» (soniya sanog'i). ≤1024 px — o'quvchi kartalari (✓ ✗, «− Faollik +3 +», ±).
- **Sabab bo'yicha tanga** (oyna, telefonda pastdan): Balans va «Bugun qo'lda ayirildi N / 20» kartalari, «+ Berish / − Ayirish»
  segment, sabablar — radio kartalar (tanlangani `brand` chegara + `brand-bg`; limit tugagani o'chiq + sababi `warning`),
  oraliqli sababda miqdor qadamchasi, izoh, `info-bg` oqibat qatori; tugma «N tanga ayirish / berish».
- **Reyting · guruh ichida** (`?groupId=`): «Oktabr | Jami» segment, guruh, «Ekranga chiqarish» (`primary`). Uchlik `surface-2`
  ichida (2 · 1 · 3, birinchisi `brand-bg` + `brand` chegara, 👑 `warning-bg`), daraja belgisi, «89 reyting tangasi», «bugun +35 ·
  balans ● 412». Jadval: O'rin (1–3 rangli doira), Daraja (`LevelBadge`: raqam doirada; 1 — neytral, 2 — `success`, 3 — `info`,
  4 — `violet`, 5 — `warning`), Reyting tangasi (chiziq + son), Bugun, Balans, O'quvchilarga («👁 Top-5» / «faqat o'ziga»); top-5
  dan keyin `surface-2` ajratgich qator. O'ngda: «Qanday hisoblanadi», «Sentabr yakuni» (uchlik), «Guruhlar musobaqasida · N-o'rin».
- **Hamyonlar** (yon menyuda «O'quvchilar» o'rniga): 5 ko'rsatkich kartasi (oxirgisi — darajalar chizig'i), Hammasi / Faol /
  Muzlatilgan tabletkalari, qidiruv, Toifa / Daraja / Guruh chiplari; jadval O'quvchi (toifa · sinf), Guruh(lar) (fan nuqtasi),
  Daraja, Oy (+N), Jami topilgan, Balans, Holat (Faol `success` / Muzlatilgan `info` + «8-oktabrdan · arxivda»), ›.
- **O'quvchi hamyoni** (o'ngdan panel, 620 px): Balans (`warning-bg`), Daraja (chiziq, ««Bilimdon»gacha 288»), Uzluksiz davomat;
  «± Sabab bo'yicha tanga», «Do'st olib keldi», «🎁 Sovg'a berish»; Guruhlar jadvali; Nishonlar 5 ustunli to'r (olinmagani uzuq
  chegara, kulrang); Istaklari (♥, «Tanga yetadi», «Berish»); Tanga tarixi (filtr tabletkalari) va «O'quvchi havolasi va Telegram».
- **Guruhlar musobaqasi**: filial tablari, oy; peshqadam banneri `brand-bg` (🏆, guruh, «o'rtacha tanga», «Oy tugashiga N kun»,
  «● G'olib o'quvchilariga +30 tangadan» `warning-bg`); jadval (o'rtacha — chiziq, 1-o'rin `warning`), kam o'quvchili guruh
  `surface-2` qatorda «Qatnashmaydi · 5 tadan kam»; o'ngda «Qanday hisoblanadi», o'tgan oy g'olibi (👑), boshqa filiallar.
- **Do'kon**: «Sovg'alar» (sukut) | «So'rovlar». Byudjet kartasi (filiallar ustunlari, chiziq, «Cheklanmagan» `warning`), toifa
  segmenti + ombor, kartalar (tepasi `brand-bg` / chegirma `violet-bg` / tugagan `surface-2`; tur va ♥N belgilari, narx, toifa,
  ombor qatori — kam `warning`, tugagan `danger`), «Berish» + ✎; pastda «O'quvchilar istaklari» (ism chiplari `success-bg`) va
  «Oyda berilganlar». **Sovg'a berish** oynasi: sovg'a kartasi, qidiruv + «♥ Istak qilganlar · N», radio ro'yxat («Tanga yetadi»
  `success-bg`, «Yetmaydi · 241 / 250» neytral), `info-bg` oqibat qutisi (balans, daraja, byudjet, ombor).
- **Sozlamalar → Tanga tizimi**: modul kartasi (almashtirgich), Cheklovlar (qator: nom + izoh, o'ngda 80 px maydon + birlik),
  Toifalar va chegirma (`violet-bg` chegirma kartasi), Guruhlar musobaqasi («Taklif» `violet` belgi), Darajalar (nom, chegara,
  «Hozir · N faol hamyon»; o'zgargan qator `brand-bg`, «27 → 58 o'quvchi · chegara 300 edi»), Doimiy qoidalar (`surface-2`);
  o'zgarish bo'lsa pastda yopishqoq qator «● N ta o'zgarish saqlanmagan · …» + «Bekor qilish» / «O'zgarishni saqlash».
- **Sozlamalar → Tanga sabablari**: `info-bg` 🔒 izoh; bitta jadval, guruh qatorlari «● Tanga beriladi N ta sabab» / «● Tanga
  ayiriladi · N tasi to'xtatilgan»; Sabab (🔒 tizim, «izoh majburiy» `warning-bg`), Tanga (`success` / `danger`), Kim beradi,
  Cheklov, Faol (almashtirgich), ✎ va 🗑 (tizimda o'chiq).
- **O'quvchi kabineti → Tangalarim** (telefon): Balansim (`warning-bg`, 44 px son, «Do'kon — sovg'alar»), Darajam / Ketma-ket
  kartalari, «Reyting · Top-5» (guruh segmenti, «siz» qatori `brand-bg`), Nishonlarim (gorizontal aylanadi), Istaklarim.
- Kodda: `components/v2/gamification/` — LessonV2 (+ ReasonDialogV2, lessonTypes), RankingGroupV2, levelBits (LevelBadge,
  CoinDot), WalletsV2 + WalletDrawerV2, CompetitionV2, ShopV2 → ShopBoardV2 + GiveDialogV2; `components/v2/settings/` —
  CoinSystemV2, CoinRulesV2 (yangilandi); `components/student-web/v2/TangaTab.tsx`. `PageShell flow` — bir nechta bo'limli
  sahifa o'zi aylanadi; `V2Dialog` `footer` ixtiyoriy. Rasmdan farqlar — `SAVOLLAR.md` 434–444.

## Nazorat — Davomat nazorati, Xodimlar davomati, Ustozlar reytingi, Darsni baholash, Fikr-mulohaza, Support darslari, Xabarlar (34-qism, yorug'/qorong'i, 17.11.2026)

- **Davomat nazorati** (`/nazorat-davomat`): «Bugun | Yozuvlar | Belgilanmagan darslar» tablari. Bugun — guruhlar holati
  (belgilangan `success`, muddat ichida `warning` + sanoq, muddati o'tgan `danger`), «Eslatish» va «Jarima» (faqat admin).
  Yozuvlar — tahrirlar jurnali (kim, qachon, nima o'zgardi). Belgilanmagan — o'tgan darslar, «Sababli» / «Jarima» oynalari.
- **Xodimlar davomati** (`/nazorat-qr`): «Bugun | Belgilash usuli | Kirish-chiqish». QR kioski yo'q (egasi qarori — bot +
  joylashuv + Face ID); qatorlar: o'z vaqtida `success`, kechikdi `warning`, kelmadi `danger`, kutilmoqda, jadvaldan tashqari.
- **Ustozlar reytingi** (`/nazorat-staff-rating`): oy, filial, kurs; 4 ko'rsatkich, jadval (o'rtacha ★, 5…1 taqsimot chizig'i,
  o'tgan oy, past baholar), «Diqqat» kartasi va izohlar (o'quvchi ismi ko'rinmaydi).
- **Darsni baholash** (o'quvchi kabineti → Darslar, telefon): «Darsni baholang» kartasi, pastdan oyna — 5 yulduz, baho nomi
  (`warning`), teg chiplari, izoh, 🔒 «Ustozga ismingiz ko'rinmaydi»; «Oxirgi baholarim».
- **Fikr-mulohaza** (`/nazorat-feedback`): 4 karta (Shikoyat `danger`, Taklif `info`, Maqtov `success`, o'rtacha hal qilish
  kuni), Hammasi / Yangi / Ko'rib chiqilmoqda / Hal qilindi tabletkalari, qidiruv + Turi / Kimdan / Filial; jadval Turi
  (rangli tabletka), Kimdan (ism · kimligi · o'quvchi), Mazmuni, Holat · mas'ul («mas'ul tayinlanmagan» `warning`), Kelgan
  (sana | vaqt · manba). Qator — boshqarish oynasi (holat segmenti, mas'ul, natija). «Fikr qo'shish» oynasi: Kimdan segmenti,
  o'quvchi qidiruvi (o'quvchi / ota-ona), Ism, Telefon, Turi chiplari, Izoh, Mas'ul, Filial.
- **Support darslari** (`/nazorat-support-analytics`): sana oralig'i, Kurs, Excel, «Support dars ochish»; 4 karta (darslar ·
  o'tdi / rejada, yozilganlar, keldi %, navbatda); jadval Dars (sana | vaqt · xona), Mavzu (fan nuqtasi + kurs), Support ustoz,
  Yozildi (N / joy, «+N navbatda» `warning`), Keldi, Holat (Yozilish ochiq `success`, Joy to'ldi `warning`, O'tdi neytral,
  Davomat qilinmagan `danger`); o'ngda «Support ustozlar» (% — chiziq `success`). Qator — yozilganlar, navbat, keldi/kelmadi.
- **Xabarlar yetkazilishi** (`/nazorat-sms-analytics`): 4 karta (nuqta rangi bilan; Yetmadi — `danger` son), yetmaganlar banneri
  `danger-bg` (sabablar ro'yxati), «Maqsad bo'yicha» — to'rt rangli chiziq (Telegram `success`, SMS `info`, Yetmadi `danger`,
  Kutilmoqda kulrang), «Kanallar» (Ulangan `success-bg` / Ulanmagan `warning-bg`), «Oxirgi xabarlar» (Yetmadi qatori `danger-bg`,
  matn o'rnida sabab).
- Kodda: `components/v2/nazorat/` — AttendanceControlV2, StaffAttendanceV2, TeacherRatingsV2, FeedbackV2, SupportLessonsV2,
  MessageDeliveryV2; `components/student-web/v2/LessonRatingCard.tsx`. Yon menyu nomlari: Davomat nazorati, Xodimlar davomati,
  Ustozlar reytingi, Support darslari, Xabarlar. Eski sahifalar — `?classic=1`. Rasmdan farqlar — `SAVOLLAR.md` 445–456.

## Hisobotlar — katalog va yetti yangi hisobot (35-qism, yorug'/qorong'i + telefon, 17.11.2026)

- **Katalog** (`/reports`): «N ta hisobot · har biri Excel va PDF'ga yuklanadi», qidiruv «Hisobot nomi yoki
  ko'rsatkich»; «📌 Tez-tez ochiladi» — 4 karta (★ `warning`; Qarzdorlar `danger` summa, Sotuv voronkasi %, Kirim va
  chiqim ± `success`/`danger`, Faol o'quvchilar). Guruh kartalari 3 ustunda (ikonka + nomi + «N ta»), ichida qatorlar
  (nomi qalin, izoh, ›; boshqa bo'limga havola — →). Guruhlar: Moliya, O'quvchilar oqimi, Xodimlar va oylik, Sotuv,
  O'quv sifati (oldin «Davomat»), Resurslar; «Nazoratda» — `danger-bg` ikonka va tabletka-havolalar.
- **Umumiy qolip** (mavjud ReportShell): yo'l, sarlavha, izoh · filial, Excel / PDF; filtrlar qatori (sana oralig'i
  `V2DateRange` yoki oy `V2MonthNav`, Filial / Kurs / … `V2Select value`), o'ngda segment-almashtirgich; KpiStrip;
  `Panel` (sarlavha + izoh + o'ng qism), `Meter` (ingichka chiziq), `StackBar` (segmentli), `Callout`
  (`info-bg` 💡 / `warning-bg` ⚠ + tugma) — `components/v2/reports/report35.tsx`.
- **Sotuv voronkasi**: «Bosqichlar» (besh qator: nom + izoh, keng chiziq `info`, oxirgisi `brand`, son + %, ostida
  «−N» `danger-bg` · «N yopildi · N tasi …»), «Jarayonda · N» tabletkalari (`warning`/neytral/`info`/`success`);
  o'ngda «Nega yopildi · N» (sabab, `warning` chiziq, izoh). «Kesimlar» — Manba/Filial/Admin/Kurs segmenti, jadval
  «Liddan o'quvchiga» chizig'i bilan; pastda 💡 eng past filial. Telefonda chiziq nom ostiga tushadi.
- **Ketish sabablari**: Hammasi / To'lab ketgan / To'lamay ketgan; 4 KPI; Sabablar · Qachon ketadi (birinchi oy
  `danger`) · Kurslar bo'yicha (fan nuqtasi, % belgisi); «Ketganlar» jadvali (to'lov holati, sabab tabletkasi, izoh,
  «Qaytdi» `success`).
- **O'qituvchilar / Administratorlar samaradorligi**: o'ngda «O'qituvchilar | Administratorlar» (har biri o'z
  hisoboti). O'qituvchilar: jadval + «Tarkib» StackBar (qolgan `brand`, qo'shilgan `success`, ketgan `danger`,
  bitirgan/muzlatilgan kulrang) + «Saqlab qolish» tabletkasi (≥90 `success`, <85 `danger`); ⚠ Callout; telefonda —
  ustoz kartalari. Administratorlar: voronka admin bo'yicha, «Konversiya» tabletkasi, «Birinchi javob» rangli;
  «Birinchi javob tezligi» (StackBar 15 daq / 15–60 / 1 soat+) va «Kechki lidlar».
- **Ustozlar tushumi**: oy; jadval Tushum qalin, «Oylik ulushi» chizig'i (>40% `danger`), «Markazga qoldi», «1
  o'quvchidan»; pastda 💡 va «Guruhga bog'lanmagan to'lovlar».
- **Xonalar bandligi**: Toq / Juft kunlar segmenti; vaqt jadvali (08–22, xona qatorlari, eng band soat ustuni
  `warning-bg`, guruh bloklari — chap chegara `brand`, fan nuqtasi, «o'quvchi / sig'im · vaqt»), o'ngda «N soat · %»
  va to'liqlik; uchta maslahat kartasi (bo'sh vaqt, kam ishlatilgan, sig'imga yetgan).
- **Chegirma va istisnolar**: oy, filial, «Kim ruxsat bergan», «+ Imtiyoz»; o'ngda jami va ulush; 4 KPI; `warning-bg`
  banner «N ta imtiyoz direktor tasdig'ini kutmoqda» + «Ko'rib chiqish»; «Kim ruxsat bergan» gorizontal qatori
  (tanlanadi); turlar tablari; jadval Turi tabletkasi (Chegirma `violet`, Alohida narx `info`, Kechirilgan qarz `danger`,
  Dars haqi neytral), Farq, Sabab, Kim · qachon, Holat. Oynalar: «Imtiyoz qo'shish» (o'quvchi, turi segmenti, guruh,
  foiz/summa/narx/darslar, qaysi oygacha, sabab, oqibat qatori) va «… so'rovi» (narxlar qutisi, sabab, kim necha
  imtiyoz yozgani, izoh; «Rad etish» `danger` chegarali + «Tasdiqlash»).
- Kodda: `components/v2/reports/` — ReportsCatalogV2 (yangilandi), SotuvVoronkasiReport, KetishSabablariReport,
  SamaradorlikReport, UstozlarTushumiReport, XonalarReport, ChegirmalarReport, report35; server `lib/reportLeads.ts`,
  `lib/reportRetention.ts`, `lib/reportResources.ts`, `lib/priceExceptions.ts`, `/api/reports/{funnel,admins,
  leave-reasons,teachers,teacher-revenue,rooms,exceptions,summary}`. Yangi versiya menyusida eski hisobotlar yangi
  sahifalarga olib boradi (`V2_ITEM_HREFS`). Rasmdan farqlar — `SAVOLLAR.md` 474–484.

## Sotuv va O'quv bo'limi — Savdo plani, Kampaniya havolalari, Yangiliklar, Avtomatik xabarlar, Kurs sahifasi, Mavsumiy baholash, Onlayn kurslar (36-qism, 17.11.2026)

- **Savdo plani** (`/sales-plan`): oy (`V2MonthNav`), filial, o'ngda «12-noyabr · oyning 12 / 30 kuni o'tdi»; Excel,
  «Rejani sozlash». 4 KPI (Yangi o'quvchilar reja/bajarilish %, Oy oxiriga prognoz, Liddan o'quvchiga, Rejadan orqada
  — `danger`). «Adminlar bo'yicha»: bajarilish chizig'i (`success` / orqada `danger`) va «bugungi kutilgan joy»
  qora belgisi; Holat tabletkasi (Rejada, Biroz orqada, Orqada, Reja yo'q). «Kunma-kun» — jamlanma ustunlar
  (`info`, bugun `brand` + son), reja — uzuq chiziq; «bugun rejadan +N oldinda / N orqada». Orqada qolgan filial —
  `warning-bg` banner + «Sotuv voronkasi →». «Rejani sozlash» oynasi: har admin — o'tgan oy natijasi va rejasi, son
  maydoni; «Keyingi oyga ham qo'llash»; pastda «Jami: N o'quvchi».
- **Kampaniya havolalari** (`/sales-campaigns`, yangi): sana, filial, Turi; 4 KPI (Manbasi ma'lum lidlar, Havola
  orqali kelgan, Havolalar ochildi, Natijasiz havola `warning`). Jadval: tur nuqtasi (Instagram `violet`, Sayt `brand`,
  Telegram `info`, Flyer `warning`, Banner), kod (mono, `surface-2`), Ochildi / Lid / O'quvchi, Konversiya tabletkasi
  (0% `danger`, «yangi» neytral), QR tugmasi; «Havolasiz» qatori; o'ngda tanlangan havola: QR, qisqa havola + «Nusxa
  olish», «QR · PNG», «Chop etish · A6», Ochildi/Ariza/O'quvchi, Xarajat va bir o'quvchi narxi, «Tahrirlash»,
  «To'xtatish». Qisqa havola `/s/KOD` → `/sorovnoma?c=KOD` (so'rovnomada manba savoli chiqmaydi).
- **Yangiliklar va hikoyalar** (`/sales-news`; `/sales-stories` ham shu, menyuda «Hikoya» yashirildi): «Hikoya
  qo'shish» / «Yangilik qo'shish»; «Hikoyalar» qatori (doira `brand` halqa, «N ko'rdi · N soat qoldi», «+ Qo'shish»);
  jadval tablari (Hammasi, E'lon qilingan, Rejalashtirilgan, Qoralama), Kimga / Filial; ustunlar Yangilik (belgi
  kvadrati + sarlavha + matn), Kimga (asosiy + izoh), Ko'rdi (chiziq + N / jami), Vaqti, Holat, «⋯». Qo'shish oynasi
  (960): rasm (16:9), belgi (8 ta rangli), sarlavha, matn, Kimga segmenti (Hammaga / Filial / Kurs / Guruh) + «kim
  ko'radi», Qachon (hozir yoki sana + soat), «Telegram botga ham yuborish» almashtirgichi; o'ngda «Kabinetda shunday
  ko'rinadi». O'quvchi kabinetida: tepada hikoya doiralari (bosilsa to'liq), Asosiy oxirida «Yangiliklar» kartalari
  (rasm yoki rangli sarlavha-yorliq: SARHISOB, TA'TIL …).
- **Avtomatik xabarlar** (`/sales-auto-messages`, yangi): sana; 4 KPI (Yuborildi, Yetkazildi, Yetmadi, Navbatda);
  «Hodisalar» jadvali (holat nuqtasi `success`/kulrang, qachon, kimga, kanal tabletkasi, davrda yuborildi / yetmadi
  `danger`; «ulanmagan», «o'chirilgan»); «Tizim xabarlari» qatori → Xabarlar ro'yhati, «Xabarlar yetkazilishi →».
  O'ngda tanlangan hodisa: Yoqilgan almashtirgichi, «Telegram bot | SMS zaxira · o'chiq», Matn (mono), o'zgaruvchi
  tugmalari (`{ism}` …), «Ota-ona shunday ko'radi» (bot pufagi), «Standart matn», «Saqlash».
- **Kurs sahifasi** (`/offline-courses/[id]`): fan nuqtasi + nom, «Tahrirlash», «Guruh ochish»; 4 KPI (Guruhlar
  filiallar bo'yicha, O'quvchilar, Ustozlar, Davomat · markaz o'rtachasi); «Darajalar va narx» (+ «Narxni o'zgartirish
  →»), «Ustozlar · N» (avatar, darajalar, o'quvchi soni, guruh · filial), «Dars vaqtlari» issiqlik jadvali (Toq / Juft
  / Boshqa kunlar; eng ko'pi `brand`), «Kitoblar · N» (rangli muqova, daraja, «N o'quvchida», «+ Kitob qo'shish»).
- **Mavsumiy baholash** (`/seasonal-assessment`): chorak, Kurs, Ustoz, o'ngda muddat `warning`; «Mezonlar»,
  «Ota-onalarga yuborish (N)». Chapda guruhlar (Jarayonda `warning`, Tayyor `info`, Yuborilgan `success`,
  Boshlanmagan neytral), o'ngda guruh jadvali — mezon baholari rangli kvadrat (5 `success`, 4 `info`, 3 `warning`,
  1–2 `danger`), O'rtacha, Ustoz izohi; «Guruh o'rtachasi» qatori + «eng bo'sh joy»; `info-bg` taklif bloki. Baholash
  varaqasi (telefonda pastdan): har mezon 1–5 tugmalari (tanlangan `brand`), izoh, O'rtacha / o'tgan chorak, «Saqlash
  va keyingisi». Kabinetda «Chorak bahosi keldi» kartasi (katta o'rtacha `success`, o'tgan chorak, mezonlar 2 ustunda,
  izoh).
- **Onlayn kurslar** (`/online-courses`): Hammasi / Faol / Qoralama, Ustoz; 4 KPI (O'quvchilar, Tugatganlar,
  O'rtacha test, Pullik kurs tushumi); kurs kartalari (rangli muqova, Faol/Qoralama, ustoz · darslar · modullar ·
  davomiylik, bepul/pullik, o'quvchi · tugatdi · test + chiziq); o'ngda «Tuzilma»: modullar (raqam kvadrati, «N video
  · test», «N% o'tdi» chizig'i), ochilganida darslar (▶ + davomiylik, «rejada») va «Test · N savol · o'rtacha»;
  «Dars qo'shish» oynasi (modul yoki yangi modul, nom, video yuklash — davomiylik o'zi o'qiladi, modul testi).
- Kodda: `components/v2/sales/` — SalesPlanV2, CampaignsV2, NewsV2, newsIcons, AutoMessagesV2;
  `components/v2/academic/` — CoursePageV2, SeasonGradesV2, OnlineCoursesV2; kabinet `components/student-web/v2/
  CabinetFeed.tsx`. Server `lib/salesTargets.ts`, `lib/campaignLinks.ts`, `lib/cabinetNews.ts`, `lib/autoMessages.ts`,
  `lib/coursePage.ts`, `lib/seasonGrades.ts`, `lib/onlineCourseAdmin.ts`. Rasmdan farqlar — `SAVOLLAR.md` 485–499.

## Mening hisobim va Sozlamalar — profil, xavfsizlik, qurilmalar, ekran qulfi, bayramlar, funksiyalar, obuna (37-qism, 17.11.2026)

- **Mening hisobim** (`/settings-profile`, `/settings-security`, `/settings-devices` — bitta sahifa, tab manzildan):
  sarlavhada katta avatar (rasm yoki harflar `brand`), «… · bu sahifani faqat siz ko'rasiz»; tablar Profil /
  Xavfsizlik / Qurilmalar (soni bilan), faoli `brand` tag chiziq.
- **Profil**: «Shaxsiy ma'lumotlar» (rasm yuklash, Ism, Familiya, Otasining ismi, Tug'ilgan kun — kun + oy, yilsiz;
  Lavozim — qulf belgisi, chiziq chegarali, «Rollar va huquqlar»), «Kirish va aloqa» (telefon «Tasdiqlangan»
  tabletkasi, Telegram — xodim boti holati va «Uzish» `danger`, pochta); pastda «Hisob yaratilgan …» va Saqlash.
  O'ngda «Boshqalar sizni shunday ko'radi» (xodimlar ro'yxati, chek, amallar jurnali namunasi — yozish bilan
  yangilanadi) va «Ko'rinish» (Til, Mavzu Yorug'/Qorong'i, kirgandan keyin ochiladigan filial, Jadval filtrlari,
  «Filtrlar ochiq tursin»).
- **Xavfsizlik**: 4 kichik karta (Parol yoshi — 90 kundan oshsa `warning`, Ikki bosqichli kirish «Tez orada», Ekran
  qulfi, Faol qurilmalar); «Parolni o'zgartirish» — ko'rsatish tugmali maydonlar, 4 bo'lakli kuch chizig'i
  (`danger` → `warning` → `info` → `success`), talablar ro'yxati (✓ `success`), «Mos keladi», «Boshqa N ta qurilmadan
  chiqarish»; o'ngda «Ekran qulfi» («Hozir qulflash», avtomatik qulflash tanlovi), «Faol qurilmalar» (3 ta, «Shu
  qurilma» `success`), «So'nggi kirishlar» (yashil/qizil nuqta, xato urinish sababi `danger`).
- **Qurilmalar**: «Hisobingiz N ta qurilmada ochiq» + «Boshqa qurilmalardan chiqish» (`danger` chegarali); jadval
  (qurilma belgisi, IP, kirgan, oxirgi faollik / «hozir» `success`, «Chiqarish» `danger`); «Notanish qurilma
  ko'rsangiz» (3 qadam, `danger-bg` raqamlar) va «Qurilma qanday aniqlanadi».
- **Ekran qulfi** (`/lock`): qobiqsiz, yuqorida logo va til; katta soat (56–64px) va sana; karta — avatar + qulf
  belgisi, ism, lavozim · filial, «Qulflangan · HH:MM dan beri» kulrang tabletka, parol, «Ochish» (to'liq enli),
  «Parolni unutdim?» va «Boshqa hisob bilan kirish»; ostida ✓ va ⚠ izohlar. Telefonda o'sha, to'liq enli.
- **Ish kunlari va bayramlar** (`/settings-holidays`, Sozlamalar → Umumiy): ish haftasi kun tugmalari (yoqilgani
  `brand-bg`), toq/juft guruhlar soni; o'quv yili jadvali (Kelayotgan / O'tgan / Hammasi), tur tabletkasi (Davlat
  `brand`, Diniy `warning`, Markaz qarori `violet`, «sana taxminiy» `warning`), qamrov, darsi o'tmaydigan guruhlar;
  tanlangan qator — chap `brand` chiziq. O'ngda: filiallar bo'yicha, o'quvchilar, «Shu kuni tizim» (✓), «Ota-onalarga
  xabar» («Hozir yuborish»). Oyna: nomi, boshlanish–tugash, turi, Barcha / Tanlangan filiallar (tabletka-tanlov),
  taxminiy, xabar.
- **Funksiyalar** (`/settings-features`, Sozlamalar → Tizimli): Hammasi / Yoqilgan / O'chiq / Tez orada + qidiruv;
  guruh kartalari (ikonka kvadrati, sarlavha, izoh, qatorlar — nom, izoh, almashtirgich; «Tez orada» `info`
  tabletkasi, almashtirgich o'chiq); o'ngda «Menyu bo'limlari» va «So'nggi o'zgarishlar».
- **Obuna va to'lov** (`/settings-subscription`): holat («Faol» `success`), «… gacha» katta sana, qolgan kun va
  keyingi to'lov, `brand` chiziq (bugun · N / M kun), 4 ko'rsatkich; tariflar (joriysi `brand` chegara, «+N oy»
  `success`), to'lovlar tarixi, modullar. «Muddatni uzaytirish» oynasi: davr kartalari, yangi muddat qatori, usul
  (Hisob raqam; Click/Payme «Tez orada»), «Jami to'lov».
- Kodda: `components/v2/account/MyAccountV2.tsx`, `components/v2/auth/LockScreenV2.tsx`,
  `components/v2/shell/AutoLock.tsx`, `components/v2/form/PasswordInput.tsx`, `components/v2/settings/` —
  HolidaysV2, FeaturesV2, SubscriptionV2. Server `lib/myAccount.ts`, `lib/holidays.ts`, `lib/features.ts`,
  `lib/subscription.ts`; `/api/my-account`, `/api/holidays`, `/api/features`, `/api/subscription`. Rasmdan
  farqlar — `SAVOLLAR.md` 500–511.

## MohirAI va ilovalar — AI sozlamalari, xodim va o'quvchi ilovasi (38-qism, 17.11.2026)

- **Sozlamalar → Ilovalar** (yangi bo'lim): Xodim ilovasi, O'quvchi ilovasi, MohirAI — faqat direktor.
- **MohirAI** (`/settings-mohirai`): sarlavha o'ngida Yoqilgan/O'chirilgan almashtirgichi (`success-bg`). «Kimlar
  foydalanadi» — rol qatorlari (nom, xodim soni, kunlik savol maydoni, ruxsat almashtirgichi; o'chirilgan rolda «—»);
  «Model va tezlik» — sukut model, sukut tezlik segmenti (Tezkor/Tez/O'rtacha/Chuqur), xodimlarga ochiq modellar
  (nom + mono ID, «Sukut» `success` yoki «Sukut qilish», almashtirgich), «Yana N ta model», model ID qo'shish.
  O'ngda «Amallar — faqat tasdiq bilan» (`warning` qulf ikonka; umumiy ruxsat + 11 amal turi, o'chirilsa xira),
  qulf izohli quti; «Maxfiylik» (4 qator ikonka bilan); «{oy}da foydalanish» (jami savol, rol bo'yicha `info`
  chiziqlar, tasdiqlangan / bekor qilingan amal, ko'p so'ralgan).
- **Xodim ilovasi** (`/settings-staff-app`): 3 ko'rsatkich (ilovaga kirgan, yuzi ro'yxatda — chiziqli, bugun
  kelgan); «Ishga kelish — «Keldim»» — usul segmenti (Joylashuv / Joylashuv + Face ID), filial qatorlari (radius
  tanlovi, «xaritada belgilangan» `success` yoki «nuqta belgilanmagan» `warning` → Filiallar), «Ishdan ketishni ham
  belgilash», «Yuz mos kelmasa — admin tasdiqlaydi» (Tez orada), qalqon izoh; o'ngda «Bugun ilovadan kelganlar»
  (avatar, vaqt · joy, «Face ID» `success`) + «Xodimlar davomati →».
- **O'quvchi ilovasi** (`/settings-student-app`): 3 ko'rsatkich (kabinetdan foydalanadi, ota-ona ham kiradi, oxirgi
  yangilikni ko'rdi); guruhlar — To'lovlar (balans va qarz; Click/Payme Tez orada), Kontent (hikoyalar, yangiliklar
  → Yangiliklar va hikoyalar), Kirish va profil, Support darslari (Tez orada); o'ngda telefon ramkasida «Kabinetda
  shunday ko'rinadi» (sozlamaga qarab o'zgaradi) va «So'nggi o'zgarishlar».
- **MohirAI to'liq oynasi**: keng ekranda (xl) «E'tibor talab qiladi · N» o'ng ustunda (320px, kartalar, «Ko'rish»,
  pastda izoh); torroq ekran va suzuvchi oynada — avvalgidek suhbat tepasidagi yig'iladigan karta.
- Kodda: `components/v2/settings/` — AiSettingsV2, StaffAppV2, StudentAppV2; `components/ai/AlertsCard.tsx`
  (`variant="column"`). Server: `lib/ai/settings.ts` (roles, disabledActions), `lib/ai/adminOverview.ts`,
  `lib/staffAppSettings.ts`, `lib/studentAppSettings.ts`; `/api/staff-app`, `/api/student-app`. Rasmdan farqlar —
  `SAVOLLAR.md` 512–519.

## Moliya sozlamalari — oylik, bonus va KPI, chegirmalar, hamkorlar, sinxronizatsiya, Bonusim (39-qism, 18.11.2026)

- **Sozlamalar → Moliya** guruhiga: Oylik va soliq, Bonus va KPI, Chegirmalar, Hamkorlar — faqat direktor; o'chiq
  «Bonus sabablari» bandi olib tashlandi. Umumiy bo'laklar — `components/v2/settings/financeKit.tsx` (almashtirgich,
  fokusdan chiqqanda saqlanadigan summa/foiz maydoni, ikonkali qoida qatori, karta, «Tez orada» `info` belgisi).
- **Oylik va soliq** (`/settings-payroll`): «Oylik turlari» — 3 karta (Tushumdan foiz / Oklad / Oklad + foiz;
  ko'p uchraydigan foiz, nechta ustoz/moderator; bosilsa jadval shu turga kesiladi, `brand` halqa); xodimlar jadvali
  (avatar, turi, «Sozlanmagan» `warning`, stavka, shu oy hozirgacha hisoblangani; 8 qator + «Yana N xodim»; ism
  bosilsa misolga o'tadi); «Hisoblash qoidalari» — 7 qator, har birida «tizim qoidasi» `success` belgisi
  (almashtirgich emas — qoidalar qat'iy). O'ngda «Soliq va ushlanmalar» (nom, nechta xodimga, foiz/summa),
  «Misol: xodim» (oklad × kun/oy kunlari, foiz × tushum, bonus, jarima `danger`, jami, soliq, «Qo'lga» `success`),
  «Foiz darajalari».
- **Bonus va KPI** (`/settings-bonus`): tepada «oylikka avtomatik tushmaydi» izohi; kartalar — Sotuv bonusi (har
  yangi o'quvchi, reja bajarilsa — summa + almashtirgich; «birinchi oyda ketsa» Tez orada), Moliya bo'limi bonusi
  (qarz undirish %, toza topshiruv — Tez orada), KPI (90%+ va 80–89% summalari — Tez orada). O'ngda «{oy} — sotuv
  bonusi» (admin, filial · yangi/reja, summa; ism → shu adminning Bonusim oynasi; «Jami · hozircha»; prognoz
  bo'yicha rejani bajaradiganlar `brand-bg` qutida), «Qanday ishlaydi», «So'nggi o'zgarishlar».
- **Chegirmalar** (`/settings-discounts`): «Avtomatik chegirmalar» (aka-uka, ikki kurs, oldindan to'lov — foiz +
  almashtirgich, «Mos keladi: N o'quvchi», Tez orada; pastda «qo'llanmaydi» izohi); «Qoidalar» — admin chegarasi
  foiz va summa (haqiqiy), «Qachondan», «Ustoz ulushi → Oylik va soliq». O'ngda «{oy}da imtiyozlar» (−summa, o'quvchi
  soni, tur chiplari), «Direktor tasdig'i kutmoqda» (avatar, tur · summa · kim), «Ko'rib chiqish».
- **Hamkorlar va 3-shaxslar** (`/settings-partners`): sarlavha o'ngida «Hamkor qo'shish» (ikkilamchi) va «3-shaxs
  qo'shish» (asosiy) — 460px oyna; hamkorlar jadvali + ulushlar chizig'i (100% bo'lsa `brand`, aks holda `warning`
  va izoh), «Jami N%» belgisi; 3-shaxslar ro'yxati; o'ngda «{o'tgan oy} foydasi» (daromad, xarajat `danger`, sof foyda
  % bilan `success`) → Foyda va zarar.
- **Google Sheets va Telegram** (`/finance-sync`, sozlamalar ramkasida, menyuda «Integratsiyalar» faol): holat
  banneri (Hammasi sinxron `success` / navbatda `info` / xato `warning` / o'chirilgan `surface-2`) + «Qayta
  yuborish»; 4 ko'rsatkich; «Oqimlar» jadvali (varaq, Telegram, oxirgi yozuv); «Yuborilmagan yozuvlar» (bo'sh bo'lsa
  punktir ramkada `success` izoh); «Tekshiruvlar tarixi» (vaqt, kim, navbat, 4 oqim ✓/!, holat belgisi).
- **Bonusim** (`/my-bonus`, telefon; profil menyusida «Bonusim»): `brand-bg` karta (shu oy bonusi, N × summa,
  reja chizig'i, «yana N ta → +summa»), Ko'rsatkichlar (liddan o'quvchiga %, prognoz), O'tgan oy, izoh.
- Kodda: `components/v2/settings/` — PayrollSettingsV2, BonusKpiV2, DiscountsV2, PartnersV2, SyncV2, financeKit;
  `components/v2/account/MyBonusV2.tsx`. Server: `lib/payrollSettings.ts`, `lib/bonusKpi.ts`, `lib/discountRules.ts`,
  `lib/discountSettingsPage.ts`, `lib/partnersPage.ts`; `/api/payroll-settings`, `/api/bonus-kpi`,
  `/api/discount-rules`, `/api/partners-overview`, `/api/my-bonus`. Rasmdan farqlar — `SAVOLLAR.md` 520–526.

## Lid, o'quv va umumiy sozlamalar — sabablar, lavozimlar, oferta, SMS qurilmalar, Rad etdi (40-qism, 18.11.2026)

- **Menyu**: Umumiy → Ommaviy oferta; O'quv → Sabablar; Moliya → Lavozim va stavkalar; Lidlar → Lid sozlamalari
  (hammasi faqat direktor). SMS qurilmalar — Integratsiyalar ichida (menyuda «Integratsiyalar» faol, SMS kartasida
  «SMS qurilmalar» tugmasi). Umumiy oyna — `ListItemDialogV2` (matn, summa, segment, tanlov maydonlari; 460px).
- **Lid sozlamalari** (`/settings-leads?tab=`): 3 tab (segment). «Yo'nalish va ro'yxatlar» — yo'nalish kartalari
  (rangli ikonka, «daraja/sinf so'raladi» belgisi, «So'rovnomada» almashtirgich, qalam; kurs chiplari soni bilan,
  o'chirish ×, punktir «+ Kurs» — Enter bilan qo'shadi), daraja bosqichlari (nuqtali chiplar), «Boshqa joyda
  sozlanadi» havolalari; o'ngda so'rovnoma ko'rinishi, Qulay vaqtlar, Sinflar, Rad etish sabablari. «Standartga
  qaytarish» — tasdiq oynasi. «Belgi va teglar» — raqam belgilari (rang nuqtasi), hashtag chiplari, o'quvchi turlari
  (Kategoriya'dan, soni bilan); tepada «kartaga hali chiqmaydi» izohi. «Forma maydonlari» — O'quvchi / Buyurtma /
  Birinchi dars segmenti, 2 ustun almashtirgichlar, «Ism — doim · majburiy».
- **Sabablar** (`/settings-reasons`): tur tablari (Hammasi/Ketdi/Bekor qilindi/Davomat, soni bilan), har tur kartasi
  (ikonka `danger`/`warning`/`info`), sabab · soni · qalam · ×; ro'yxat bo'sh bo'lsa standart ro'yxat xira + «Tahrirlash
  uchun ro'yxatga olish». O'ngda «Sabab turlari» va «Lid «Rad etdi» sabablari» → Lid sozlamalari.
- **Lavozim va stavkalar** (`/settings-positions`): xodim lavozimlari jadvali (yarim / bir stavka, xodimlar), o'qituvchi
  lavozimlari (bir stavka); o'ngda misol (stavka va kartadagi oklad, farq bo'lsa `warning` izoh), «Qanday ishlaydi».
- **Ommaviy oferta** (`/settings-oferta`): `info` izoh («Tanishdim» hali so'ralmaydi), bo'limlar (raqam doirasi,
  sarlavha, qisqa matn, Majburiy/Ixtiyoriy segmenti, ↑ ↓, qalam — joyida ochiladi: sarlavha + matn + «Bo'limni
  saqlash», o'chirish); o'ngda ilovadagi ko'rinish (o'chiq almashtirgichlar, xira «Ilovaga kirish»).
- **SMS qurilmalar** (`/settings-sms-devices`): `info` izoh; jadval (qurilma, kompaniya, `font-mono` yashirilgan IMEI,
  moderator, Aloqa — bosib almashtiriladigan nuqta, Faol almashtirgich, qalam/savat); «Qurilma qo'shish» 3 qadam,
  «SMS operatorlar» (ulangan `success`, sozlanmagan `warning`, Tez orada `info`).
- **Rad etdi** (lid paneli, telefon/kompyuter): sabablar — to'liq kenglikdagi radio qatorlar (tanlangan `brand-bg` +
  `brand` hoshiya), «Boshqa sabab», «Izoh (ixtiyoriy)», qizil «Rad etildi».
- Kodda: `components/v2/settings/` — LeadSettingsV2, ReasonsV2, PositionsV2, OfertaV2, SmsDevicesV2, ListItemDialogV2;
  `components/v2/leads/LeadRadModalV2.tsx`. Server: `lib/leadSettingsStats.ts`, `lib/reasonsPage.ts`,
  `lib/positionsPage.ts`, `lib/smsDevicesPage.ts`; `/api/lead-settings/stats`, `/api/reasons-overview`,
  `/api/positions-overview`, `/api/sms-devices-overview`. Rasmdan farqlar — `SAVOLLAR.md` 527–532.

## Qolgan sozlamalar — mashg'ulotlar, baholash darajalari, dars eslatmalari (41-qism, 18.11.2026)

- **Menyu** O'quv → Qo'shimcha mashg'ulotlar, Baholash (faqat direktor). Forma maydonlari — 40-qismdagi Lid sozlamalari.
- **Qo'shimcha mashg'ulotlar** (`/settings-activities`): raqamlangan ro'yxat (qalam, ×), pastda «Yangi mashg'ulot nomi»
  + «Qo'shish»; bo'sh bo'lsa punktir ramkada «Hali mashg'ulot yo'q». Sarlavhadagi tugma maydonga fokus beradi.
- **Baholash** (`/settings-assessment`): 0–100% rangli shkala chizig'i (har daraja o'z rangida, nomi ichida), jadval
  (nuqta + nom, minimal, maksimal, rang nomi, qalam/×), qamrov belgisi (`success` yoki `warning` — bo'shliq/ustma-ust).
  Qo'shish/tahrir — sahifa ichidagi karta: nomi, 2 ta foiz, 7 ta tayyor rang doirasi, to'qnashuv `warning` izohi.
  O'ngda namuna sarhisob (rangli belgilar) va «Qayerda ko'rinadi» (Tez orada) → Mavsumiy baholash.
- **Avtomatik xabarlar → Dars eslatmalari**: sahifa tablari «Hodisalar · N / Dars eslatmalari · N»; `info` izoh
  (yuboruvchi ulanmagan); shablonlar jadvali + «Bir dars misolida» vaqt chizig'i (oldin / davomida / keyin);
  o'ngda muharrir — «Qachon yuboriladi» segmenti, daqiqa, nomi, monospace matn, o'zgaruvchi chiplari, «O'quvchi
  shunday ko'radi», izoh, pastda o'chirish, «Faol», «Saqlash» (o'zgarsa «Saqlanmagan» belgisi).
- Kodda: `components/v2/settings/ActivitiesV2.tsx`, `AssessmentLevelsV2.tsx`, `components/v2/sales/LessonRemindersV2.tsx`.
  Rasmdan farqlar — `SAVOLLAR.md` 533–535.

## O'quvchi kabineti — oferta, bildirishnomalar, profil, fikr, shartnomalar (42-qism, 18.11.2026)

- Telegram ichidagi kabinet (`/oquvchi`, v2) — yuqori panelda qo'ng'iroqcha (o'qilmaganlar soni `danger` belgida) va
  ism menyusida «Profil»; ichki sahifalar tab o'rnida ochiladi (← orqaga, pastki tablar tanlanmagan holatda).
- **Bildirishnomalar**: filtr chiplari (Hammasi, Darslar, Vazifalar, To'lov, Natijalar, Yangiliklar — soni bilan,
  tanlangan `brand` to'la), kun sarlavhalari (Bugun / Kecha / sana), qator — rangli ikonka, sarlavha, vaqt, matn,
  «Bo'lim ›» havolasi, o'qilmaganida `brand-bg/30` fon va nuqta; ✓✓ — hammasini o'qilgan qilish.
- **Profil**: ism kartasi (avatar, telefon, guruhlar), Shaxsiy ma'lumotlar, Ko'rinish (til va mavzu segmentlari),
  Hujjatlar (oferta, shartnomalar), Yordam (Fikr bildirish, Markazga qo'ng'iroq — `tel:`).
- **Fikr bildirish**: Turi segmenti (Taklif / Shikoyat / Minnatdorchilik), «Nima haqida» tanlovi (guruhlar, markaz),
  matn, «Ustozga ismim ko'rinmasin», to'liq kenglikdagi «Yuborish»; «Murojaatlarim» — tur · sana, holat belgisi
  (Yuborildi / Ko'rib chiqilmoqda `info` / Hal qilindi `success`), javob kulrang qutida.
- **Shartnomalar** (faqat ko'rish): imzolanmagan bo'lsa `warning-bg` izoh, kartalar ochilib-yopiladi (markaz,
  imzolovchi, o'quvchi, kurs, narx, muddat).
- **Oferta (kirishda)**: sarlavha, «N / M tanishildi» + `success` chiziq, bo'limlar akkordeoni (raqam doirasi → ✓,
  majburiy/ixtiyoriy belgisi, ochilganda matn va «O'qidim, tanishdim»), pastda yopishgan «Kabinetga kirish».
- Kodda: `components/student-web/v2/CabinetPages.tsx`, `CabinetV2.tsx`; server `lib/studentCabinetExtras.ts`,
  `/api/student-web/extras`. Rasmdan farqlar — `SAVOLLAR.md` 536–539.

## O'quvchi kabineti → Darslar: vazifalar, support, onlayn kurslar (43-qism, 18.11.2026)

- Darslar tabi tepasida bo'lim chiplari (Jadval · Vazifalar N · Support · Onlayn kurslar; tanlangan `brand` to'la,
  telefonda gorizontal suriladi). «Jadval» — avvalgi ko'rinish.
- **Vazifalar**: kurs segmenti (bir nechta guruh bo'lsa), «Bajarish kerak · N» va «Muddati o'tgan · N» bo'limlari;
  qator — guruh belgisi (`info`), nom, izoh · muddat, o'ngda «Ertaga / N kun qoldi» (`warning`) yoki «muddati o'tdi».
  Tafsilot: belgilar, sarlavha, «Muddat» va «Maks. ball» kartalari, «Topshiriq» matni, izoh qutisi.
- **Support**: tepada karta (ikonka, izoh, «Bu hafta yozildingiz a / 2» chizig'i); dars kartasi — sana kvadrati (kun +
  hafta kuni), kurs belgisi, vaqt · xona, mavzu, ustoz; «N joy qoldi» `success` / «Joy to'ldi» `warning` + band chizig'i,
  to'qnashuv `warning` matni; «+ Yozilish» / «Navbatga yozilish» yoki «Yozilgansiz / Navbatda N» + «Chiqish».
  Tasdiq — telefonda pastdan chiqadigan oyna (dars kartasi, navbat o'rni doirasi, haftalik hisob, asosiy tugma).
  «Mening yozilishlarim» — Keldi `success` / Kelmadi `danger`.
- **Onlayn kurslar**: «Davom ettirish» kartasi; kurs kartasi — rangli muqova sarlavhasi (toifa, ▶ yoki qulf), Bepul
  `success` / Pullik `warning`, nom, ustoz · modul · daqiqa, progress chizig'i va «Davom etish / Boshlash» yoki narx.
  Pleer: video (yuklab olish yo'q), modul · davomiylik, sarlavha, «Oldingi / Keyingi (Tugatdim)», «Kurs tarkibi» —
  modul sarlavhalari, darslar (✓ `success`, joriy ▶ `brand-bg`), «Test · N savol — Tez orada».
- Kodda: `components/student-web/v2/LearningViews.tsx`, `DarslarTab.tsx`; server `lib/studentLearning.ts`
  (/api/student-web/extras). Rasmdan farqlar — `SAVOLLAR.md` 540–542.

## O'quvchi kabineti — keng ekran: Darslar, Natijalar, Tanga, Do'kon, Taklif, Yangiliklar (44-qism, 18.11.2026)

- **Bo'limlar** — chiziqli tablar (`UnderTabs`): tanlangani qalin matn + pastda `brand` chiziq, son — `surface-2` belgi.
  Darslar: Jadval · Davomat · Vazifalar N · Support · Onlayn kurslar. Natijalar: o'ngda «Sarhisob | UzBMB» segmenti.
- **Jadval** (kengda): soatlar to'ri — 7 ustun, soat qatori 52px, bugun ustuni `surface-2`, sana doirasi `brand`;
  dars bloki — fan foni + chap 3px chegara, nom (fan rangida), vaqt, xona, holat belgisi (Keldi `success`, Kelmadi
  `danger`, Ertaga `info`); kun sarlavhasida muddati shu kun bo'lgan vazifa — «Vazifa» `warning`. Telefonda — ro'yxat.
  O'ngda «Keyingi dars» (fan nuqtasi, kun · **vaqt** · xona, ustoz, eng yaqin vazifa `warning-bg` qutisi) va
  «Darsni baholash». «Guruhlarim» — kengda ikki ustunli kartalar (ustoz bosh harflari, kunlar · vaqt · narx).
- **Davomat**: chapda oy kalendari (katakda kun raqami, darslar chiplari: fan nuqtasi + belgi rangi; rejadagi —
  punktir, vaqt), tepada fanlar va belgilar izohi. O'ngda: foiz + chiziq + uch katak (keldi / sababli / kelmadi),
  «Qoldirilgan darslar» (ikonka katagi, sana va hafta kuni, guruh, sabab), «Oylar bo'yicha» (oxirgi 5 oy, joriy — `brand`).
- **Natijalar · Sarhisob**: guruh kartalari (2 ustun): fan belgisi, oldingidan farq (`success` / `warning`, «p.p.»),
  ustoz · oy imtihoni, katta foiz + «22 / 25 to'g'ri», Siz (`brand`) / Guruh / Filial o'rtachasi chiziqlari, guruhdagi
  o'rin, «Oylar bo'yicha» ustunlari (oxirgisi `brand`), joriy oy imtihoni bo'lmasa — izoh. «Chorak baholari» —
  mezon kataklari, o'rtacha `success`, izoh; baholanmagan guruh — punktir «Ustoz baholamoqda · muddat».
- **Natijalar · UzBMB**: 3 karta (oxirgi bal / 189 + farq + guruhdagi o'rin + formula izohi; Taqqoslash; Testlar
  bo'yicha ustunlar), «Fanlar bo'yicha» qatorlari (blok · savol × koeffitsient · to'g'ri, chiziq, bal / maksimum).
  O'nli kasr — vergul («141,6»). Ota-ona kabinetida «Siz» o'rniga farzand ismi.
- **Tangalarim** (kengda): 3 karta (Balans, Darajam, Ketma-ket), Reyting · Top-5 — guruhlar yonma-yon (telefonda
  segment), Istaklarim, Tanga tarixi (segment filtr), «Qanday tanga olaman» (+ `success`, − `danger`), Nishonlar to'ri.
- **Do'kon**: tur segmenti (Hammasi · Buyum · Xizmat · Chegirma), 3 ustunli kartalar (tur rangidagi rasm maydoni, tur,
  nom, «Bor / Tugagan», narx, «+ Istak» / «✓ Istakda» `brand`), o'ngda Qanday ishlaydi, Istaklarim, Olganlarim.
- **Taklif qilish**: raqamlar (referallar, takliflar, to'lov qildi) + keyingi sovg'a chizig'i; kod kartasi (QR, mono kod,
  havola + nusxa, «Ulashish» `brand`, «Kodni nusxalash»); Takliflarim (bosh harflar, holat belgisi); o'ngda Qanday ishlaydi
  va referal Sovg'alar («So'rash» `brand` yoki «a / b» + chiziq).
- **Yangiliklar**: Hikoyalar kartasi, e'lon kartalari (chapda turi rangli maydon, o'ngda sana, sarlavha, matn),
  o'ngda «Chorak bahosi keldi».
- **Farzand tanlash** (ota-ona): hisob menyusida «Farzandlarim» — qator (bosh harflar, ism, qarz `danger` / to'langan
  `success`, guruh · filial), tanlangani `brand-bg` + ✓, bosilsa faol farzand almashadi.
- Kodda: `components/student-web/v2/{DarslarTab,AttendanceView,NatijalarTab,TangaTab,CommunityPages,CabinetV2}.tsx`;
  server `lib/studentCabinet.ts` (attendanceHistory, branchAvg), `lib/studentUzbmb.ts`, `lib/studentReferral.ts`,
  `lib/gamification/studentPage.ts` (earnRules, inStock). Rasmdan farqlar — `SAVOLLAR.md` 543–549.

## O'qituvchi ish stoli: bosh sahifa, dars oynasi, vazifa tekshirish, guruhlarim (45-qism, 18.11.2026)

- **Bosh sahifa** (o'qituvchi `/home`; rahbar — `/home?teacher=ISM`, tepada «Rahbar ko'rinishi» `info` qatori): 4 ko'rsatkich
  (Keldim, bugungi dars, tekshirilmagan ish `warning`, qolgan oylik), «Keldim» bosilmagan — `warning` qator + «Keldim».
  «Bugungi darslar» — vaqt ustuni + `brand` chiziq, nom, holat belgisi (Hozir · N daqiqa `brand-bg` / boshlanadi /
  Yakunlandi `success`), 4 qadam kartasi (✓ `success` doira · qulf `warning` · raqam), «Darsni ochish» (hozir — asosiy).
  «Tekshirilmagan uy vazifalari» qatorlari, «Rolingiz» (Ko'rasiz ✓ / Ko'rinmaydi ×). O'ngda Oyligim, Birinchi darsga
  keladiganlar (lid telefoni ko'rinmaydi — qulf izohi), Topshiriqlarim. Telefonda ko'rsatkichlar 2×2.
- **Dars oynasi** (`/teacher-lesson?groupId=`): sarlavha «Dars · sana, kun», o'ngda «Davom etmoqda / Dars tugashiga N
  daqiqa» va «Darsni yakunlash» (oxirgi 10 daqiqada — asosiy). 4 qadam kartasi (telefonda — bo'lim tanlovi).
  «Davomat va tanga»: segment Keldi `success` / Kechikdi `warning` / Kelmadi `danger` / Sababli; ostida o'tgan vazifa
  natijasi (✓ ball `success`, × `danger`, tekshirilmagan `warning`); faollik −/+; «Bugun» jami; «±» sabab oynasi.
  Saqlanmagan bo'lsa — `warning-bg` qator «Qolganlarni «Keldi» deb saqlash». O'ngda «Mavzu» (matn, izoh, oldingi darslar)
  va «Uy vazifasi» (qulf holati `warning-bg` qutisi + «Tekshirish · N ta ish»; berilgan — ko'rinish + «Tahrirlash»).
- **Vazifa tekshirish** (`/teacher-check`): segment Kutmoqda / Tekshirilgan / Hammasi + guruh; chapda vazifa kartalari
  (ochilgani — baholandi chizig'i, o'quvchilar: tanlangani `brand-bg` + chap chiziq, «Ochiq»), «Darsda yo'q» bloki.
  O'ngda baholash: Bajarildi `success` / Bajarilmadi `danger`, ball kataklari (tanlangan `brand`), izoh, tanga izohi
  `warning-bg`, oxirgi ish — `success-bg` qulf izohi, «Saqlash» / «Saqlash va keyingisi».
- **Guruhlarim** (`/teacher-groups`): guruh kartalari (tanlangani `brand` chegara), o'quvchilar jadvali (sariq — oyda
  dars yoki vazifa qoldirgan), o'ng kartada o'quvchi — «Faqat ko'rish», guruhlari, 4 katak, mavsumiy mezon chiziqlari,
  ota-ona (bot), to'lov/qarz ko'rinmasligi izohi.
- Kodda: `components/v2/teacher/*`, server `lib/teacherDesk.ts`, `/api/teacher`. Rasmdan farqlar — `SAVOLLAR.md` 550–556.

## Qabul admin va Moderator: bosh sahifa, qo'ng'iroq navbati, natijalarim (46-qism, 18.11.2026)

- **Qabul admin · bosh sahifa** (`/home`; rahbar — `/home?front=ISM&mode=admin`): 4 ko'rsatkich (javobsiz lid `danger`,
  birinchi dars, qarzdor, kassam), «Bugungi ishlar» bo'limlari (`surface-2` sarlavha qatori): javobsiz lidlar (kutish
  vaqti belgisi — 15 daqiqadan oshsa `danger`), birinchi darsga keladiganlar (Bugun / Ertaga `info`, «Eslatish» yoki
  «✓ Eslatildi»), 2+ oy qarzdorlar, kassani topshirish; «Rolingiz». O'ngda Kassam (balans, to'lov turlari kataklari,
  bugungi amallar, Kirim / Chiqim / Topshirish) va Savdo planim (chiziq — rejada `success`, orqada `danger`, bonus
  `warning-bg`). Telefonda qator tugmalari matn ostiga tushadi.
- **Moderator · qo'ng'iroq navbati** (`/home` moderatorda yoki `/front-calls`): 4 ko'rsatkich, navbat bo'limlari
  (Shoshilinch · Yangi lidlar · Dars bo'yicha · Eslatmalar), qator — tur ikonkasi katagi (qayta `info`, yangi neytral,
  darsga kelmadi `danger`, birinchi darsdan keyin `success`, eslatma `violet`), belgi, muddat (`danger` o'tgan /
  `warning`), qo'ng'iroq tugmasi `brand-bg`. Tanlangani — `brand-bg` + chap chiziq. O'ngda natija paneli: telefon,
  Natija 2×2 (tanlangani `success`), Keyingi qadam chiplari (`brand`), guruh tanlovi va 3 ta dars kuni, izoh,
  «Saqlash · keyingisi». Pastda «Oxirgi qo'ng'iroqlar» (natija belgisi).
- **Natijalarim** (`/front-results`): davr segmenti, 4 ko'rsatkich, kunlar bo'yicha ustunlar (bugun `brand`), qo'ng'iroq
  turlari chiziqlari, «Liddan o'quvchigacha», Qoidalar (foiz belgisi ≥90 `success`, ≥70 `warning`, past `danger`),
  oxirgi qo'ng'iroqlar jadvali.
- Kodda: `components/v2/front/*`, server `lib/frontDesk.ts`, `/api/front`. Rasmdan farqlar — `SAVOLLAR.md` 557–563.

## Menejer, IT va xizmat xodimi: bosh sahifa, tasdiq kutmoqda, sozlamalar faqat ko'rish (47-qism, 19.11.2026)

- **Menejer · bosh sahifa** (`/home`; rahbar — `/home?desk=ISM&mode=manager`): 4 ko'rsatkich (tushum, yangi o'quvchi
  rejasi — orqada `danger`, davomat, qarzdor). «Tasdiq kutmoqda» bo'limlari (Topshiriqlar · Sovg'a so'rovi · Rahbarda —
  ko'rish), qatorda tur katagi (topshiriq `brand-bg`, sovg'a `warning-bg`, rahbarda `surface-2` qulf), «Qaytarish /
  Rad etish» va «Tasdiqlash» `brand`. «Xodimlar · bugun» jadvali (Vaqtida `success`, Kechikdi `warning`, Kelmadi
  `danger`), Kechikdi / Ketdi qatorlari. O'ngda Savdo plani (adminlar bo'yicha chiziq, liddan o'quvchigacha 4 katak —
  to'ladi `danger-bg`), Kassalar (kun — `warning`), «E'tibor talab qiladi» (ikonka katagi + ›). «Rolingiz» — 3 ustun
  (Boshqarasiz ✓, Faqat ko'rasiz 👁 `info`, Ko'rinmaydi ×).
- **Tasdiq kutmoqda** (`/approvals`): tur segmenti, chapda ro'yxat (tanlangani `brand-bg` + chap chiziq, tur belgisi,
  vaqt), «Bugun hal qilingan». O'ngda panel: topshiriq — holat, bajaruvchi, muddat, muhimlik/jarima, xodim izohi;
  Qaror: Tasdiqlash `success` / Qaytarish `warning` (izoh + yangi muddat majburiy, «Qaytarish · sana»). Sovg'a — taklif
  qiluvchi, sovg'a `warning-bg`, 3 katak (balans a → b), «Tasdiqlansa» ro'yxati; rahbarda — faqat ko'rish (qulf izohi).
- **Sozlamalar faqat ko'rish** (menejer, Nazorat qoidalari): tepada `info-bg` banner (qulf, matn, «Faqat ko'rish»),
  tugmalar o'chiq.
- **IT / xizmat xodimi · bosh sahifa** (telefon birinchi): «Keldingiz · vaqt» `success-bg` kartasi (bosilmagan —
  `warning-bg`), «Topshiriqlarim» — har biri katta «✓ Bajardim» tugmasi, qolgan vaqt `warning`; IT — «Tizim holati»
  (Ishlayapti `success` / Oflayn `warning`, qulf izohi); xizmat — «Bu hafta · ish vaqti» (bugun `brand`), «Qolgan oylik».
- Kodda: `components/v2/staffdesk/*`, server `lib/staffDesk.ts`, `/api/staff-desk`. Rasmdan farqlar — `SAVOLLAR.md` 564–570.

## Rahbar paneli: umumiy ko'rinish, Rahbar kassasi, ko'chirmalar, tasdiqlar (48-qism, 19.11.2026)

- **Menyu**: «Rahbar paneli» — faqat Rahbar (admin, `adminOnly`), «Bosh sahifa»dan yuqorida, `LayoutGrid` ikonka.
  Ichida: Umumiy ko'rinish `/owner`, Rahbar kassasi `/owner-cash`, Ko'chirmalar `/owner-transfers`, Tasdiqlar
  `/owner-approvals`, so'ng mavjud Oylik chiqarish, Moliyaviy reja, Bonus, Jarima, Moliya analitikasi.
- **Umumiy ko'rinish**: tepada 3 ustunli blok (1px chiziq bilan): «Jami pul» (ko'z — yashirish; chiziq: Rahbar kassasi
  `brand`, filial kassalari `border-strong`, yo'lda `info`), «Bugungi tushum» (to'lov turi nuqtalari `methodDot`,
  filiallar kataklari), «Oy tushumi · rejaning %» (chiziqda oyning o'tgan qismi — qora belgi; «reja bo'yicha oldinda»
  `success` / «rejadan orqada» `warning`). «Filiallar taqqoslash» jadvali (Moliya / Sotuv / O'quvchilar bo'limlari;
  eng yaxshi — `success-bg`, e'tibor kerak — `danger-bg`; «Jami» ustuni `surface-2`), «Xodimlar va nazorat · bugun»
  (filial doirasi 1–4 rangli, raqamlar `Pill`), o'ngda «Tasdiq kutmoqda», «E'tibor talab qiladi», «Foyda va prognoz»
  (filial chizig'i, zarar `danger`).
- **Rahbar kassasi**: chapda bosh kassa kartasi («Bosh kassa» `warning` toj belgisi, to'lov turlari chizig'i, 6 amal
  3×2 tugma), «Dividend va sarmoya · yil», «Filial kassalari» (kun / yo'lda / topshirilgan belgisi). O'ngda «Amallar»
  jadvali — chek tugmasi birinchi ustunda, tur katagi (kirim `success`, chiqim `danger`, ko'chirma `info`,
  almashtirish `violet`, dividend `warning`), segment tablar, sahifalash; pastda `brand-bg` qoida izohi.
- **Oynalar**: Almashtirish (qayerdan ⇄ qayerga, sabab segmenti, oldin → keyin jadvali, «o'zgarmaydi» `success`),
  Filialga pul berish (filial radio-kartalari, summa + to'lov turi, maqsad, 3 qadamli izoh), Dividend / Sarmoya
  (segment, tur, davr foydasi jadvali — «qoladi» `success`/`danger`, `warning-bg` izoh).
- **Ko'chirmalar**: 4 ko'rsatkich (yo'lda `info`, filial kassalarida, 2+ kun `warning`, oyda qabul), «Kutilayotgan va
  topshiriladigan» qatorlari (yo'lda — «Sanab qabul qilish» `brand` + Qaytarish; topshirmagan — Eslatish + Qabul
  qilish), o'ngda «Rahbar kassasidan filialga» va «Qoidalar», pastda oy tarixi (Farq bilan `warning`). Qabul oynasi —
  32-qismdagi (kupyuralar, plastik tekshiruvi, farq izohi).
- **Tasdiqlar**: tab segmenti, guruhlangan ro'yxat (sarlavha qatori `surface-2`), tanlangani `brand-bg` + chap chiziq;
  o'ng panel: avans — «So'ralgan avans» `warning-bg`, «Oylik holati» jadvali, ko'p bo'lsa `danger-bg` ogohlantirish va
  «X qilib tasdiqlash», kassa qatori; narx — tafsilot jadvali. Telefonda panel ro'yxat tepasida.
- **Avans so'rovi** (qabul admin / menejer bosh sahifasi → «Avans so'rovi»): xodim, 3 katak (hisoblangan, jarima,
  olishi mumkin), summa, ko'p bo'lsa `warning-bg`, izoh; tepada tasdiqlanganlar — «Berdim».
- Kodda: `components/v2/owner/*`, server `lib/ownerPanel.ts`, `lib/advanceRequests.ts`, `/api/owner`. Farqlar —
  `SAVOLLAR.md` 571–580.

## Umumiy tekshiruv — 1–48-qismlar moslandi (49-qism, 19.11.2026)

Rasm «49-qism · Tekshiruv natijasi» — 24 band; ko'pi namuna raqamlari va atamalarni taxtalararo moslash (kodga
tegmaydi). Koddagi o'zgarishlar:
- **Dividend va Sarmoya — faqat Rahbar kassasida** (23-band): Kassalar kartasi menyusida (yangi va eski versiya)
  faqat bosh kassada; server ham rad etadi (`lib/cashboxAdjust.ts` — «Dividend va Sarmoya faqat Rahbar kassasida»).
- **Kassalar** (5-band): adminga Rahbar kassasi kartasi ko'rinmaydi, sarlavha «N ta filial kassasi» + «Rahbar kassasi
  endi Rahbar panelida →». Bosh kassa egasi admin bo'lmasa — o'zgarishsiz.
- **Ko'chgan bo'limlar** (15-band): Kunlik topshiruv va Filiallar holati tepasida `info-bg` izoh — yangi joyi
  (Rahbar paneli → Ko'chirmalar / Umumiy ko'rinish) havolasi bilan; faqat admin.
- Atamalar (16–21) yangi versiyada avvalgi qismlarda kiritilgan: Tanga, Birinchi dars, Sarhisob, Qabul admin.
  Eski versiya matnlari o'zgarmadi. Farqlar — `SAVOLLAR.md` 581–584.

## Moliya — eski sahifalar yangi dizaynda: Kirim chiqim, Moliya hisobotlari, P&L, Pul oqimi, Tranzaksiyalar, Kirim-chiqim toifalari, Rejalashtirilgan xarajatlar, Bonus, Jarima (50-qism, rasmsiz, 20.11.2026)

Rasm yo'q — mavjud Moliya va Hisobotlar sahifalari qolipida. Versiya `page.tsx` da serverda tanlanadi
(`currentUiVersion()`); eski komponentlar, API va raqamlar o'zgarmagan.

- **Hisobot turidagi to'rttasi** — `components/v2/finance/FinanceCashflowV2.tsx`, `FinanceReportsV2.tsx`,
  `PnlReportsV2.tsx`, `CashFlowStatementV2.tsx`; umumiy: `finReportsCalc.ts` (hisob — eski sahifalardan aynan nusxa,
  eskisi bilan birga o'zgartiriladi), `finReportsKit.tsx` (yil tanlagich «‹ 2026 ›», oy tanlovi, o'zgarish belgisi,
  ulush qatorlari, `FIN_TH` jadval kataklari), `finReportsDailyChart.tsx`.
  - **Kirim chiqim** (`/finance-cashflow`): «Yuklab olish» (Excel/CSV, eskisicha); filtrlar — davr `V2DateRange`, Kassa,
    To'lov turi; 4 bosiladigan KPI katak (Kirim, Chiqim, Bonus, Jarima — tanlangani brend fon); ostida «{X} turlari
    bo'yicha» jadvali (Tur · Ulushi chizig'i — telefonda yashirin · Summa · Jami).
  - **Moliya hisobotlari** (`/finance-reports`): KpiStrip Kirim/Chiqim/Qoldiq + oldingi teng davrga o'zgarish va kichik
    chiziq; kunma-kun ustunli grafik (`series-1` kirim, `series-2` chiqim) «Grafik | Jadval»; Kirim va Chiqim taqsimoti
    «Tranzaksiya turi | To'lov usuli». Donutlar o'rniga ulush chiziqlari (kategoriya palitrasi yo'q).
  - **P&L** (`/finance-pnl`): yil, «Oy: Butun yil», Excel; KPI Jami daromad, Jami xarajat, Sof foyda, Eng yaxshi oy;
    jadval — chap ustun qotgan, DAROMAD/XARAJATLAR qatorlari, Sof foyda brend fonda, Foyda ulushi; kelgusi oylar «—».
  - **Pul oqimi** (`/finance-flow`): KPI Boshlang'ich balans, Kirim, Chiqim, Yakuniy balans; jadval — Operatsion
    faoliyat ichida yig'iladigan Kirim/Chiqim guruhlari («· N ta tur»), Sof; Investitsion/Moliyaviy — «—».
- **Ro'yxat turidagi beshtasi** — O'quvchilar ro'yxati qolipi (`PageShell`, `PageHead`, `SummaryLine` —
  `components/v2/students/lists/listKit.tsx`), jadval kartada ichidan aylanadi.
  - **Tranzaksiyalar** (`/finance-transactions`, `TransactionEntriesV2.tsx`): faqat ko'rish; filtr chiplari Kassa, Turi
    (Kirim / Chiqim / Ko'chirish), Holati, O'quvchi + `V2DateRange`; serverda sahifalash. 11 ustun (eski 15 tasi
    birlashtirilgan), summa +/− yashil/qizil, bekor qilingani chizilgan. Sana MAHALLIY kun bilan yuboriladi (eskisida
    `toISOString` — bir kun oldin, SAVOLLAR 599).
  - **Kirim-chiqim toifalari** (`/finance-tx-types`, Sozlamalar ramkasi `SettingsFrameV2` ichida —
    `components/v2/settings/TransactionTypesV2.tsx` + `TransactionTypeDialogV2.tsx`): bo'lim tabletkalari (Kirim /
    Chiqim / Vaucher / Jarima, soni bilan) + qidiruv; jadval Nomi, Mijoz teglari, Miqdor chegarasi, Kategoriyasi.
    Qo'shish/tahrirlash — oyna (eski /add va /[id]/edit yo'llari o'z holicha).
  - **Rejalashtirilgan xarajatlar** (`/finance-planned`, `PlannedExpensesV2.tsx`): «Hammasi / Faol / Nofaol» + qidiruv;
    oynada turi ostida Moliyaviy rejaga qanday tushishi (×kunlar, ÷7, ÷12); «Moliyaviy reja» tugmasi — ruxsat bo'lsa.
  - **Bonus** (`/finance-bonus`, `BonusesV2.tsx`): «Yuklab olish» (Excel/CSV — eski fayl bilan aynan bir xil), «Bonus
    yaratish»; filtrlar Bonus turi, Kimga, sana; «Ustunlar» oynasi (`v2:finance-bonus:columns:1`); o'chirish —
    `V2Confirm` (xodim bonusida «oylikdan ham chiqadi»).
  - **Jarima** (`/finance-penalty`, `PenaltiesV2.tsx`): «Hammasi / Amalda / Bekor qilingan» + ism qidiruvi; «Amalda»
    sariq, bekor qilingani kulrang va chizilgan; qatorda faqat «Bekor qilish» (sabab ixtiyoriy, o'sha PATCH).
  - **Bonus/Jarima yaratish oynasi** (`finAwardDialogV2.tsx`, umumiy): turi segment, Xodim (`V2Picker`) yoki O'quvchi
    (qidiruvli `V2Select`), Qiymat + Kassa, Izoh; jarimada rasm (saqlashda avval yuklanadi); xatolar maydon ostida.
- **Menyu**: «Hisobotlar → Qarzdor o'quvchilar» yangi versiyada /reports/qarzdorlar ga (`V2_ITEM_HREFS`, o'sha ruxsat).
- **Telefon (375 px)**: filtr va amallar o'raladi, KPI 2 ustun, jadval va grafik o'z qutisida aylanadi, oynalarda
  ikki ustunli qatorlar bitta ustunga tushadi. Rasmdan (yo'qligidan) farqlar — `SAVOLLAR.md` 585–613.

## Hisobotlar — eski sahifalar yangi dizaynda: Farqli to'lovlar, Bekor qilingan to'lovlar, Davomati bekor qilinganlar, O'quv markazga ishlab berilgan (51-qism, rasmsiz, 20.11.2026)

Rasm yo'q — /reports/<slug> hisobotlari qolipida. Versiya `page.tsx` da serverda tanlanadi (`currentUiVersion()`);
eski komponentlar, API va raqamlar o'zgarmagan.

- **Qolip** — `components/v2/reports/reportTableKit.tsx`: `ReportTableShell` (ReportShell bilan aynan bir xil — yo'l
  «Hisobotlar › guruh › nomi», sarlavha, «guruh · izoh», Excel / PDF, filtrlar qatori; katalog yozuvisiz, chunki bu
  sahifalar katalogda yo'q), `ReportTableTabs` (segment), `ReportTablePill`, `ReportTableGrid` (birinchi ustun «№»,
  qotgan sarlavha, quti ichida aylanadi — `max-h-[70vh]`, pastda `V2Pagination`).
- **Jadvalli uchtasi** — umumiy `ReportTableV2.tsx` (eski `ReportTablePage` juftligi: o'sha
  /api/student-reports?kind=…, o'sha tartib), sahifalar `reportTablePages.tsx`, eski versiya aynan
  `components/reports/reportTableLegacy.tsx` da. Qidiruv, segment, ustun qiymatidan tanlovlar va KpiStrip — brauzerda, so'rovsiz.
  - **Kurs narxidan farqli to'lovlar** (`/reports-diff-payments`, Moliya): qidiruv, Guruh, o'ngda «Hammasi | Chegirma |
    Qo'shimcha»; KPI Yozuvlar · Chegirma · Qo'shimcha; Turi tabletkasi (Chegirma `violet`, Qo'shimcha `info`),
    «Farq» (manfiy `violet`, musbat `info`).
  - **Bekor qilingan to'lovlar** (`/reports-cancelled`, Moliya): qidiruv, O'qituvchi, Guruh; KPI Yozuvlar · To'lanmagan
    darslar · Jami to'lanmagan summa (`danger`); Izoh 2 qatorgacha.
  - **Davomati bekor qilinganlar** (`/reports-cancelled-attend`, O'quv sifati): qidiruv, Kurs, «Kim bekor qildi?»;
    KPI Yozuvlar · Miqdori · Bekor qilganlar; «Kim bekor qildi?» gorizontal qatori (son, summa, `warning` chiziq —
    bosilsa filtr); Kurs katagida fan nuqtasi.
- **O'quv markazga ishlab berilgan** (`/reports-served`, Xodimlar va oylik) — `ServedReportV2.tsx`, hisob
  `servedReportCalc.ts` (eski `components/reports/ServedReportPage.tsx` dagi bilan aynan bir xil, birga o'zgartiriladi):
  `V2DateRange` (sukut — joriy oy, «Barcha sanalar» bor), O'qituvchi; o'ngda «Ustozlar tushumi →»; KPI Jami ishlab
  berilgan · O'qituvchilar (+ guruhlar) · O'qituvchisi ko'rsatilmagan kirim; o'qituvchi bog'lanmagan bo'lsa `warning`
  Callout; jadval O'qituvchi · Guruhlar · O'quvchilar · Ishlab berilgan summa · Ulushi (brend chiziq + %).
- **Excel / PDF** — har to'rttasida (eskisida yo'q edi): joriy filtrdagi barcha qatorlar, «Barcha filiallar».
- **Telefon (375 px)**: qidiruv butun qatorga, tanlovlar va segment o'raladi, KPI bitta ustun, «kim bo'yicha» qatori
  va jadval o'z qutisida aylanadi. Rasmdan (yo'qligidan) farqlar — `SAVOLLAR.md`.

## Nazorat — eski sahifalar yangi dizaynda: Davomat analitikasi, Davomat qilinmagan guruhlar, Turniket analitikasi, Turniket kirish-chiqish (52-qism, rasmsiz, 20.11.2026)

- **Tanlash** — `app/(app)/nazorat-davomat-analytics|nazorat-missed-groups|nazorat-turnstile|nazorat-turnstile-io/page.tsx` serverda `currentUiVersion()` bo'yicha yangi yoki eski komponentni beradi; eski komponentlar, API va raqamlar o'zgarmagan. Qolip — 34-qism Nazorat va 35-qism Hisobotlar (`PageShell`, `PageHead`, `Panel`, `Callout`, `NoteLine`).
- **Umumiy hisob** — `components/v2/nazorat/nazoratAttCalc.ts`: kunma-kun belgilar va «davomat qilinmagan» darslar — eski sahifalardan aynan nusxa (manba o'sha `useNazoratAttendance`: /api/groups + /api/attendance); eskisi o'zgarsa birga o'zgartiriladi.
- **Davomat analitikasi** (`/nazorat-davomat-analytics`, `NazoratDavomatAnalyticsV2.tsx`): sarlavha + «CSV» (eski fayl bilan aynan bir xil); filtr qatori — `V2DateRange` (sukut oy boshidan bugungacha), Kurs / Guruh / O'qituvchi / Holati chiplari + «Tozalash»; 6 katak (Jami belgilar + segmentli chiziq, besh holat — son va «N% belgilar»); «Kunlar bo'yicha» paneli «Grafik | Jadval» — ustunlar holatlar ustma-ust (`success` / `warning` / `info` / `text-3` / `danger`), Y o'qi 1-2-5 qadam, ko'p kunda o'z qutisida suriladi; `info-bg` izoh kartasi («Davomat qilinmagan» va «Muzlatilgan» sanalmaydi) + «Davomat qilinmagan guruhlar →»; pastda «Hisobotlar → Davomat» havolasi.
- **Davomat qilinmagan guruhlar** (`/nazorat-missed-groups`, `NazoratMissedGroupsV2.tsx`): ro'yxat qolipi (≥1024 px jadval kartada ichidan aylanadi); sarlavhada «Davomat nazorati →»; sana oralig'i; xulosa qatori — Qoldirilgan darslar (`danger`; muddati ma'lum guruh yo'q bo'lsa «—»), Guruhlar, «Jami summa —»; boshlanish sanasi yo'q guruhlar — `warning-bg` ogohlantirish, nomlari guruh sahifasiga havola; jadval №, Guruh (fan nuqtasi, kurs · daraja → jurnal, ostida nomi · vaqti), Sana (+ hafta kuni), O'qituvchi (`StaffName`); `V2Pagination`; bo'sh holat — `success` belgi «Bu davrda davomat qilinmagan dars yo'q».
- **Turniket analitikasi** (`/nazorat-turnstile`, `NazoratTurnstileV2.tsx`): manba yo'q (turniket ulanmagan, SAVOLLAR 447) — bo'sh holat kartasi (Unplug ikonka, sabab, «Turniket kirish-chiqish analitikasi →» asosiy va «Xodimlar davomati →» tugmalari) va «Qurilma ulanganda jadval ustunlari» — raqamli tabletkalar.
- **Turniket kirish-chiqish analitikasi** (`/nazorat-turnstile-io`, `NazoratTurnstileIoV2.tsx`): o'sha /api/turnstile-io; `info-bg` qatori «turniket ulanmagan — yozuvlar botdagi «Ishga keldim»dan» + «Xodimlar davomati →»; filtrlar — sana oralig'i (sukut bugun, «Barcha sanalar» bor), Foydalanuvchi turi (Xodim / O'quvchi), odam chipi; 4 bosiladigan katak (Jami + segmentli chiziq, Kelgan, Kechikkan, Kelmagan — tanlangani `brand-bg` + pastki chiziq, sonlar holat filtridan mustaqil); jadval: avatar + ism (xodim — profilga) + sana, Kirgan, Chiqqan, Joylashuv, Holat (`Badge`); sahifalash.
- **Joylashuv** — `nazoratTurnstileLocation.tsx`: katak (radius ichida — `success-bg` + masofa, aks holda kulrang) va `V2Dialog` (faqat ko'rish): manzil, koordinata + «© OpenStreetMap», masofa / aniqlik / «filial koordinatasi kiritilmagan» (`warning-bg`), xarita (eski vidjet), «Yandex xaritada ochish».
- **Telefon (375 px)** — filtrlar o'raladi, kataklar 2 ustun, grafik va jadvallar o'z qutisida suriladi, sahifada gorizontal surish yo'q. Rasmdan (yo'qligidan) farqlar — savollar ro'yxatida.

## Sotuv — eski sahifalar yangi dizaynda: Marketing, SMS shablonlari, Xabarlar ro'yhati, Shartnoma (53-qism, rasmsiz, 20.11.2026)

Rasm yo'q — 50-qism ro'yxat qolipida (`PageShell`, `PageHead`, `SummaryLine`, `SearchBox`, `SegmentPills` —
`components/v2/students/lists/listKit.tsx`). Versiya `page.tsx` da serverda tanlanadi (`currentUiVersion()`); eski
komponentlar, API, yuboriladigan maydonlar va tekshiruvlar o'zgarmagan.

- **Marketing** (`/sales-marketing`, `components/v2/sales/MarketingSurveysV2.tsx`): «O'quvchilar oqimi» + «So'rovnoma
  qo'shish»; `info-bg` qatori — havola yasalmaydi, ochiq so'rovnoma kodni o'qimaydi + «Kampaniya havolalari →» (ruxsat
  bo'lsa); «N ta manba» + qidiruv; jadval № · Manba (32 px rasm yoki kulrang belgi + nom) · Kod (mono, `surface-2`,
  nusxalash) · Tahrirlash / O'chirish ikonkalari. Oyna (480): Sarlavha, Rasm (URL) + kichik ko'rinish, Kod (mono; yangisida bo'sh — avtomatik).
- **SMS shablonlari** (`/sales-sms`, `SmsTemplatesV2.tsx`): «SMS shablon qo'shish»; «Turi» tabletkalari soni bilan +
  qidiruv; jadval № · Sarlavha · Turi (O'quvchi `success`, Ota-ona `info`, Moderator `warning`, O'qituvchi neytral) ·
  SMS matni (2 qatorgacha) · amallar; `V2Pagination`. Oyna (600): Sarlavha, Turi segmenti, matn, o'zgaruvchi tugmalari
  (kursor joyiga), «N belgi», «Namuna» pufagi (`renderSmsPreview`, namuna qiymatlar).
- **Xabarlar ro'yhati** (`/sales-messages`, `SmsMessagesV2.tsx`, faqat ko'rish): «Avtomatik xabarlar →»; tur tablari
  soni bilan; `V2DateRange`, Moderator / O'quvchi / Holati chiplari + «Tozalash»; «Guruhlangan sms» tabida `info-bg`
  sabab; xulosa — jami, Qabul qilindi `success`, Yuborilmadi `danger`; jadval ism + telefon, xabar + sababi · kassa,
  sana | vaqt, Kanal (Telegram bot `info`, SMS neutral), Moderator (`StaffName`), Holat belgisi + operator xatosi.
- **Shartnoma** (`/contract`, `components/v2/academic/ContractTemplatesV2.tsx`): sarlavha «Shartnoma andozalari» +
  «Shartnoma yaratish» (eski /contract/add); jadval № · Sarlavha + matn boshlanishi · Shartnoma turi (`info`) ·
  Maydonlar (N ta) · Yaratilgan sana · Ko'rish / Tahrirlash (eski /contract/[id]/edit) / O'chirish.
- **Shartnoma ko'rish oynasi** (760, faqat ko'rish): hujjat «qog'oz»da, {{token}} lar `brand-bg` yorliq — maydon nomi;
  HTML tozalanadi (script, iframe, on*, javascript:, matn rangi — qorong'i temada o'qilsin); «Tahrirlash».
- **O'chirish** — hammasida `V2Confirm` (amal nomli tugma, oqibati: shablon SMS oynalaridan, andoza «Shartnoma
  biriktirish»dan yo'qoladi).
- **Telefon (375 px)**: amallar, filtrlar va tabletkalar o'raladi, jadvallar o'z qutisida suriladi, oynalar pastdan
  chiqadi. Rasmdan (yo'qligidan) farqlar — savollar ro'yxatida.

## O'quv — eski sahifalar yangi dizaynda: Dars jadvali, Blok test turlari, Blok testlar (54-qism, rasmsiz, 20.11.2026)

Rasm yo'q — Xonalar hisoboti, Ish jadvali va Imtihon/Sozlamalar ro'yxatlari qolipida. Versiya `page.tsx` da serverda
tanlanadi (`currentUiVersion()`); eski komponentlar, API, yuboriladigan ma'lumot va ruxsatlar o'zgarmagan.

- **Dars jadvali** (`/groups-schedule`) — `components/v2/groups/GroupScheduleV2.tsx`: o'sha /api/groups, o'sha kun,
  filtr va ustun mantiqi. Tepada Du…Yak kun yorliqlari (dars soni, bugun nuqtasi), «Xona bo'yicha / O'qituvchi
  bo'yicha» va «Ustunlar / Qatorlar / Ro'yxat» segmentlari, O'qituvchi/Kurs/Xona/Kun turi chip-tanlovlari, SummaryLine
  (kun · darslar · o'quvchilar · band xonalar · kesishuvlar). Quti ichida aylanadi (`max-h-[70vh]`), pastda jadvalga
  tushmagan guruhlar izohi.
- **Ko'rinishlar** — `components/v2/groups/groupScheduleViews.tsx`: `GridView` (ustunlar × soatlar, qotgan sarlavha va
  soat o'qi, «hozir» chizig'i), `RowView` (qatorlar × gorizontal soatlar), `ListView` (telefon: boshlanish vaqti
  bo'yicha), `LessonHoverCard` (portal karta, «Guruh sahifasini ochish»). Blok — guruh sahifasiga havola: surface fon,
  chapda brand chiziq (kesishuvda warning), fan nuqtasi; o'lchami balandlikka qarab xs/sm/md.
- **Joylashuv** — `employees/scheduleUtils.layoutDay` bilan aniq daqiqa va yo'laklar: kesishgan darslar yonma-yon,
  soat o'qi kunning birinchi va oxirgi darsiga qarab qisqaradi. Telefonda (640 px dan tor) sukut «Ro'yxat».
- **To'liq ekran** — portal qatlam (Esc, body scroll qulfi, «Kichik xolatda ko'rish»); CSV «Yuklab olish» eskisi bilan
  aynan bir xil fayl.
- **Blok test turlari** (`/blok-test-turlari`) — `components/v2/blockTest/BlockTestTypesV2.tsx`: UzBMB izohi
  (Sozlamalar → Imtihon fanlari havolasi), PageHead + «Tur qo'shish», qidiruv (nomi/kodi) va «Hammasi / Faol /
  Nofaol». Jadval: № · Nomi (+turi) · Kodi · Davomiyligi · Fanlar (chiplar, jami savol · ball) · Holati · Qo'shilgan
  sana · amallar; V2Pagination, V2Confirm.
- **Tur oynasi** — `BlockTestTypeDialogV2.tsx` (V2Dialog 600): Nomi, Turi (kodi) V2Select, Davomiyligi, fan qatorlari
  (V2Picker + savollar + ball, qatordagi jami), «Fan qo'shish», Faol Switch; payload eskisi bilan bir xil.
- **Blok testlar** (`/blok-testlar`) — `BlockTestExamsV2.tsx`: UzBMB izohi (Imtihon → UzBMB), qidiruv (nomi/turi),
  «Hammasi / Rejalashtirilgan / Bugun / Tugagan». Jadval: № · Nomi (+tur · kod) · Holati (Badge) · Sana va vaqt ·
  Mas'ul xodim · Guruhlar (3 ta chip + «+N») · Qo'shilgan sana · amallar.
- **Blok test oynasi** — `BlockTestExamDialogV2.tsx`: Nomi, Tur (V2Picker, kod · davomiyligi), Sana (IsoDateField +
  tozalash), Boshlanish vaqti (V2TimeField, chala vaqt xatosi), Davomiyligi, Guruhlar (chiplar + FloatingPanel
  qidiruv va V2Checkbox), Mas'ul xodim, Izoh.
- **Umumiy bo'laklar** — `components/v2/blockTest/blockTestKit.tsx`: jadval th/td klasslari, qator amallari, «Yuklab
  olish» menyusi (Excel / CSV — eski `excelHtml`, `HEADERS`, `csvCell` dan), bo'sh/skelet qatorlar, UzBMB izohi,
  qo'shilgan sana. Eski `BlockTestTypesPage.tsx` / `BlockTestExamsPage.tsx` dan faqat yordamchilar eksport qilindi.

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
