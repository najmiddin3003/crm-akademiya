# Tezlik (performance) — tahlil va reja

> Holat: **o'lchandi, hali hech narsa tuzatilmadi.** 2026-08-29.
> Barcha raqamlar haqiqiy bazadan (6 732 o'quvchi, 25 569 tranzaksiya).

---

## 1. O'lchov natijalari

| Endpoint | Hajmi | Qatorlar | Vaqti | Qayerda yuklanadi |
|---|---|---|---|---|
| `/api/transaction-entries` (filtrsiz) | **11.4 MB** | 25 569 | ~15 s | 3 ta moliya sahifasi |
| `/api/pupils` | **3.6 MB** | 6 732 | ~3.3 s | **HAR BIR sahifada** |
| `/api/people/directory` | 197 KB | 6 732 | 0.9 s | har bir sahifada |
| `/api/groups` | 42 KB | 91 | 0.4 s | ko'p sahifada |
| `/api/hr-employees` | 17 KB | 53 | 0.2 s | ko'p sahifada |
| Butun statik JS | 3.6 MB | 125 fayl | — | **keshlanadi**, bir marta |

O'lchovni qayta olish (brauzer konsolida, tizimga kirgan holda):

```js
const urls = ["/api/pupils","/api/hr-employees","/api/people/directory",
              "/api/branches","/api/groups","/api/transaction-entries"];
for (const u of urls) {
  const t0 = performance.now();
  const b = await (await fetch(u, { cache: "no-store" })).arrayBuffer();
  console.log(u, Math.round(b.byteLength/1024) + " KB",
                 Math.round(performance.now() - t0) + " ms");
}
```

---

## 2. Ildiz sabab

**API'lar butun kolleksiyani brauzerga yuboradi, filtrlash esa klientda bo'ladi.**

Eng og'rituvchi joy — [components/shared/Navbar.tsx:58](components/shared/Navbar.tsx).
Navbar `AppShell` ichida, ya'ni **har bir sahifada** render bo'ladi. U
`useStudents()` chaqiradi va butun o'quvchilar ro'yxatini (3.6 MB) yuklaydi —
faqat tepadagi qidiruv oynasi uchun (`searchAll(searchQuery, students)`).

Ustiga-ustak [hooks/useStudents.ts](hooks/useStudents.ts) da umumiy kesh yo'q:
har bir chaqiruv o'z `useEffect` ida alohida `fetch` qiladi. Sahifaning o'zi
ham `useStudents()` ishlatsa (masalan `/groups`, `/parents`, moliya
sahifalari), bitta yuklashda **7.2 MB** ketadi.

---

## 3. Reja — tartib bilan (ishonchli foydadan boshlab)

### 1-band. Navbar qidiruvini API'ga o'tkazish ⭐

- **Foyda:** har bir sahifadan 3.6–7.2 MB va ~3–7 soniya olib tashlanadi.
- **Xavfi:** past, bitta fayl.
- **Loyihada tayyor namuna bor:** [app/api/people/directory/route.ts:32](app/api/people/directory/route.ts)
  xuddi shu 6 732 o'quvchini `projection` bilan **197 KB** qilib qaytaradi —
  18 barobar kichik.
- **Ikki yo'l:**
  1. Navbar `useStudents()` o'rniga allaqachon yuklangan
     `PersonDirectory` kontekstidan foydalansin (qo'shimcha so'rov umuman
     yo'q), yoki
  2. serverda qidiruv endpoint'i — `/api/search?q=…`, klientda debounce.

### 2-band. `/api/transaction-entries` ni filtrsiz chaqirmaslik

- **Foyda:** 11.4 MB → o'nlab KB, ~15 s → ~0.3 s.
- **Xavfi:** o'rtacha — yig'indilar hozir klientda hisoblanadi, ularni Mongo
  aggregation'ga ko'chirish kerak. **Raqamlar moliyaviy, ehtiyot bo'lish shart.**
- **Muhim:** route'da filtrlar **allaqachon bor** —
  [app/api/transaction-entries/route.ts](app/api/transaction-entries/route.ts):
  `studentName`, `moderator`, `txType`, `month`, `excludeCancelled`.
  Uchta sahifa ularni ishlatmaydi:
  - [components/finance/CashboxesPage.tsx:667](components/finance/CashboxesPage.tsx)
  - [components/finance/RevenuePlanPage.tsx:80](components/finance/RevenuePlanPage.tsx)
  - [components/finance/TransactionEntriesPage.tsx:58](components/finance/TransactionEntriesPage.tsx)
- Indekslar bor: `transaction_entries` da `{studentName, date}` va
  `{moderator, date}` ([lib/mongodb.ts](lib/mongodb.ts)).

### 3-band. `/api/pupils` ga `projection`

- Hozir to'liq hujjat qaytadi (~550 bayt/qator), parol xeshlaridan boshqa
  hech narsa kesilmaydi — [app/api/pupils/route.ts:9](app/api/pupils/route.ts).
- **Foyda:** 3.6 MB → ~300 KB.
- **Xavfi:** o'rtacha — avval qaysi maydonlar haqiqatan ishlatilishini
  tekshirish kerak (`Pupil` tipida 30+ maydon bor).

### 4-band. Ro'yxat endpoint'lariga sahifalash

Deyarli hamma joyda `find({})` — sahifalash yo'q. Jadvallarda `Pagination`
komponenti bor, lekin u faqat klientda kesadi.

### 5-band. `useStudents` ga umumiy kesh

Takroriy so'rovlar yo'qoladi (bitta sahifada 2× `/api/pupils`).

---

## 4. Hozircha vaqt sarflamaslik kerak

- **JS to'plamini optimallashtirish.** 3.6 MB ko'p ko'rinadi, lekin u route
  bo'yicha bo'lingan va brauzerda **keshlanadi** — bir marta yuklanadi. Har
  sahifada qaytadan keladigan 3.6 MB JSON esa keshlanmaydi. Ma'lumot qatlami
  taxminan **10 barobar** kattaroq muammo.
- **`proxy.ts` dagi ruxsat tekshiruvi.** So'rovga ~0.7 s qo'shadi va
  10 soniyalik keshi bor ([lib/rolePermissions.ts](lib/rolePermissions.ts)) —
  15 soniyalik so'rov yonida ahamiyatsiz.


---

## 5. Baza tomoni (MongoDB Atlas) — o'lchandi

O'lchov: `node scripts/_db-perf.mjs` (faqat o'qiydi, bazaga yozmaydi).

| Ko'rsatkich | Qiymat |
|---|---|
| Atlas'gacha RTT | **145 ms** (5 o'lchov: 143–148) |
| Ulanish o'rnatish | 1 463 ms |
| Baza hajmi | 19.1 MB ma'lumot + **15.9 MB indeks**, 72 kolleksiya |
| `pupils` to'liq o'qish | 6 732 hujjat → **2 400–4 400 ms** |
| `pupils` + `projection` | shu 6 732 hujjat → **790 ms** |
| `transaction_entries` to'liq | 25 569 hujjat → **3 600–5 700 ms** |
| `moderator` filtri (explain) | 41 ms, indeksdan foydalanadi (1942 ko'rildi = 1942 topildi) |

Indekslar: `transaction_entries` da `studentName_1_date_-1` va
`moderator_1_date_-1` bor va **ishlayapti**. `pupils`, `groups`,
`hr_employees` da faqat `_id_` va `id_1` — lekin bu joyda muammo emas,
chunki ular baribir "hammasini ol" bilan chaqiriladi.

### 5.1. ⭐ ENG KATTA TOPILMA: `ensureIndexes()` har ishga tushishda ~11.6 s

[lib/mongodb.ts](lib/mongodb.ts) dagi `ensureIndexes()` da **71 ta
`createIndex`** ketma-ket chaqiriladi. Mavjud indeksni qayta yaratish ham
to'liq round-trip turadi:

```
mavjud indeksni qayta yaratish: 164 ms/chaqiruv -> 71 ta ketma-ket ≈ 11.6 s
```

Bu har bir API so'rovi yo'lida turadi (`ensureIndexes()` → `getDb()`).
`indexesEnsured` bayrog'i bor, ya'ni **jarayonga bir marta** — lekin:

- dev'da HMR moduli qayta yuklanganda qaytadan ishlaydi;
- **Vercel'da har bir sovuq start (cold start) = yana 11.6 s.**

Bu dev loglaridagi `GET /api/roles 200 in 32.6s`,
`/api/hr-employees 17.4s` kabi raqamlarni to'liq tushuntiradi.

**Tuzatish (xavfi deyarli yo'q):**

1. Eng tez yechim — ketma-ket emas, `Promise.all` bilan: 71 × 145 ms
   o'rniga bir necha yuz millisekund.
2. To'g'ri yechim — indekslarni ish vaqtida umuman yaratmaslik:
   `scripts/ensure-indexes.mjs` qilib, deploy paytida bir marta ishga
   tushirish. `getDb()` esa oddiy `getDb()` bo'lib qoladi.

Kutilayotgan natija: sovuq startdan keyingi birinchi so'rov ~15 s dan
~1 s ga tushadi.

### 5.2. Projection — 3 barobar tezroq (va brauzerga 12× kam)

`pupils` ni to'liq o'qish 2 400 ms, `projection` bilan **790 ms**.
Bu 3-band bilan bir xil ish: bitta o'zgarish ikkala tomonni ham
tezlatadi (baza→server va server→brauzer).

### 5.3. ❌ Wire-siqish YORDAM BERMADI — sinab ko'rildi

Gipoteza: `compressors: ["zstd"]` 3.6 MB ni siqib, o'qishni tezlatadi.
**Natija — foyda yo'q:**

```
siqishsiz (hozirgi)    pupils  2359 ms | tx  4030 ms
zstd siqish bilan      pupils  4411 ms | tx  3566 ms
```

Sabab: bo'g'iz kenglik emas, **kursor paketlari (batch)**. 6 732 hujjat
bir necha paketda keladi va har biri 145 ms round-trip. Shu bois hujjat
SONINI yoki HAJMINI kamaytirish (projection, filtr, aggregation) yordam
beradi, siqish esa yo'q.

> Bu yo'lga qaytadan vaqt sarflamang — o'lchandi.

### 5.4. 145 ms RTT — infratuzilma masalasi

Har bir round-trip 145 ms. Bitta so'rovda bir nechta round-trip bo'ladi
(ulanish, so'rov, kursor paketlari), shuning uchun bu hamma narsaga
ko'paytma. Taqqoslash uchun: bir region ichida odatda < 5 ms.

**Tekshirish kerak:** Atlas konsolida klaster qaysi regionda. Agar u
Yevropa yoki AQSh'da bo'lsa, foydalanuvchilarga yaqinroq regionga
ko'chirish (yoki o'sha yerda yangi klaster) barcha so'rovlarni birdaniga
tezlatadi — kod o'zgarishisiz.

### 5.5. Round-trip'larni kamaytirish

- Bir marshrutda ketma-ket `await` qilingan mustaqil so'rovlarni
  `Promise.all` ga yig'ish. Yaxshi namuna allaqachon bor:
  [app/api/people/directory/route.ts](app/api/people/directory/route.ts).
- Yig'indilarni (moliya sahifalaridagi jamilar) klientda emas, Mongo
  `aggregate` bilan serverda hisoblash — 25 569 qatorni tortib olish
  o'rniga bitta natija qaytadi.

---

## 6. Yangilangan tartib

| # | Ish | Foyda | Xavfi |
|---|---|---|---|
| **0** | `ensureIndexes` ni tuzatish (5.1) | sovuq start −11 s | **juda past** |
| 1 | Navbar qidiruvi (3-bo'lim, 1-band) | har sahifa −3.6 MB, −3 s | past |
| 2 | `transaction-entries` filtrlari | −11.4 MB, −15 s | o'rtacha |
| 3 | `pupils` projection | −3.3 MB, baza 3× tez | o'rtacha |
| 4 | Atlas regionini tekshirish (5.4) | hamma narsa | kod tegmaydi |
| 5 | Sahifalash + aggregation | katta | o'rtacha |

**0-band birinchi:** bir fayl, xavfi eng past, natijasi eng katta.
