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
| `--v2-on-color` | *(qo'shimcha)* | Rangli fon (brend, holatlar) ustidagi matn: yorug'da oq, qorong'ida to'q |

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
  o'lchangan (taxminiy); qorong'i temadagi soya — mening taxminim (dizaynda ko'rsatilmagan).

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
| Asosiy | `bg-v2-brand text-v2-on-color` | «+ Lid qo'shish» |
| Ikkinchi darajali | `bg-v2-surface border border-v2-border-strong text-v2-text` | «Export» |
| Matnli | fonsiz, `text-v2-text-2`; hover — `bg-v2-surface-2` | «Bekor qilish» |
| Xavf | `bg-v2-danger text-v2-on-color` | «O'chirish» |
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
  Grafik ranglari tartib bilan `chart-1…4` (yorug'da teal 600 / 400 / 300 / 200).

### Tablar va almashtirgichlar

- **Tablar** (sahifa ichidagi bo'limlar): faol — `text-v2-text`, qalin, ostida 2 px
  `brand` chiziq; qolganlari `text-v2-text-2`; butun qator ostida `v2-border` chiziq.
- **Segment** (ko'rinishni almashtirish, masalan Kalendar / Jurnal / Pul oqimi):
  konteyner `bg-v2-surface-2` + `v2-border`, faol bo'lak `bg-v2-surface` + `shadow-v2-sm`.
- **Sahifalash**: chapda «1–50 / 580 ta» (`text-v2-text-2`), o'rtada sahifa tugmalari —
  faol `bg-v2-brand text-v2-on-color`, qolganlari fonsiz; strelkalar ikkinchi darajali
  ikonka tugma; «…» oraliq; o'ngda qator soni tanlovi («50 qator»).

## Qoidalar (kontrast tekshiruvidan, WCAG 2.1)

17.10.2026 da hamma juftlik hisoblandi (matn: AA ≥ 4.5; katta matn va UI chegarasi ≥ 3).

1. **Matn uchala darajada ham o'qiladi.** Matn / Matn 2 / Matn 3 — Fon, Sirt va Sirt 2
   ustida ikkala temada AA yoki undan yuqori (eng pasti: yorug'da Matn 3 / Fon — 4.79).
2. **Rangli tugma ustidagi matn — `--v2-on-color`.** Qorong'i temada rangli fonlar och:
   oq matn ularda **o'qilmaydi** (2.0–2.6), to'q matn esa AAA (7.4–10.2). Dizayndagi
   «400 — to'q matn bilan» qoidasi shuni aytadi; tugmada hech qachon qattiq `#FFF` yozilmasin.
3. **Havola Fon ustida — `--v2-brand-text`.** Yorug'da Asosiy rang Fon ustida 4.45
   (chegaradan biroz past); Sirt ustida 4.87 — u yerda Asosiy ham bo'ladi.
4. **Kiritish maydoni cheti — faqat Maydon chizig'i** (3.1:1). Chiziq va Kuchli chiziq
   (1.2–1.5:1) — faqat bezak/ajratgich; ular bilan maydon chegarasi ko'rinmay qoladi.
5. **Holat ranglari matn sifatida ham ishlaydi** — Fon, Sirt, Sirt 2 ustida ikkala temada AA.
6. **Fan chiplari**: yozuv o'z fonida 13.5–16.4 (AAA); nuqta rangi ham matn sifatida
   ishlaydi (yorug' 4.6–6.8, qorong'i 7.5–10.2).
7. Logotip ikkala temada ham fondan ajralib turadi (3.4–5.3:1).

## Ochiq savollar

Hammasi bir joyda — [`SAVOLLAR.md`](SAVOLLAR.md) (oxirida birga ko'rib chiqiladi).
