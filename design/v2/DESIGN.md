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

- **Fanlarni ranglarga bog'lash**: bazadagi kurslar ko'proq (Fizika, Kimyo, Nemis tili,
  IELTS, CEFR, Prezident maktablari …). Taklif: nomi aniq mos kelgani — o'z rangi, qolgani —
  «Boshqa». IELTS/CEFR/SAT «Ingliz tili» rangida bo'lsinmi?
- Holatlar uchun **och fon** kerakmi (masalan «To'landi» belgisining yashil foni)? Hozir
  faqat brend uchun bor (Asosiy fon). Kerak bo'lsa har holatga `-bg` token qo'shiladi.
- Soyaning aniq qiymatlari (dizaynerdan) va qorong'i temada soya qanday bo'lishi.
- Onest shriftini qanday yuklash: Google'dan (`next/font/google` — VPS build'da avval
  vaqtinchalik xato bergan) yoki loyiha ichiga joylab (`next/font/local`) — ikkinchisi ishonchliroq.
