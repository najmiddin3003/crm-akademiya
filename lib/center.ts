// O'QUV MARKAZI SOZLAMALARI — bitta kod bir nechta markazga xizmat qiladi
// (30.10.2026, foydalanuvchi: yangi markaz «alohida VPS, alohida domen,
// Akademiya ma'lumotlari boshqasiga ko'rinmaydi»).
//
// Har server o'z `.env.local` ida beradi. `NEXT_PUBLIC_*` — `next build`
// paytida koddagi qiymatga aylanadi (deploy.sh `.env.local` ni build'dan
// OLDIN ulaydi), shuning uchun mijoz komponentlari ham o'qiy oladi;
// qiymat o'zgarsa — qayta deploy.
//
// SUKUT — AKADEMIYA: o'zgaruvchi umuman berilmasa, asosiy sayt avvalgidek
// ishlaydi (tizimli24.uz ga hech narsa qo'shish shart emas). Bo'sh qiymat
// ("") — «yo'q» degani (masalan, Instagram havolasi yashiriladi).
//
// Bu fayl SERVERGA BOG'LIQ EMAS — mijoz va server kodi birdek import qiladi.

function pick(value: string | undefined, fallback: string): string {
  return value === undefined ? fallback : value.trim();
}

/** Markazning to'liq nomi: hujjat sarlavhasi, /ariza, PDF, bot salomi. */
export const CENTER_NAME = pick(process.env.NEXT_PUBLIC_CENTER_NAME, "Akademiya o'quv markazi");

/** Qisqa nomi: chek («… CRM»), SMS matni, xodimning sukut «filiali». */
export const CENTER_SHORT = pick(process.env.NEXT_PUBLIC_CENTER_SHORT, "Akademiya");

/** Chek va lid chiptasi ostidagi shior; bo'sh — chiqmaydi. */
export const CENTER_SLOGAN = pick(process.env.NEXT_PUBLIC_CENTER_SLOGAN, "Akademiya - ilm maskani!");

/** Instagram sahifasi (/ariza pastida, to'liq havola); bo'sh — havola yo'q. */
export const CENTER_INSTAGRAM = pick(process.env.NEXT_PUBLIC_CENTER_INSTAGRAM, "https://instagram.com/akademiya.rasmiy");

/** Havolaning ko'rinadigan nomi — «@sahifa». */
export const CENTER_INSTAGRAM_HANDLE =
  process.env.NEXT_PUBLIC_CENTER_INSTAGRAM === undefined
    ? "@Akademiya.rasmiy"
    : (/instagram\.com\/([^/?#]+)/i.exec(CENTER_INSTAGRAM)?.[1] ?? "").replace(/^(?=.)/, "@");

/** Logotip (/sorovnoma); bo'sh — o'rniga nomi yoziladi. */
export const CENTER_LOGO = pick(process.env.NEXT_PUBLIC_CENTER_LOGO, "/sorovnoma/logo.png");

/**
 * Bosh telefon raqami — /ariza («Savollar bo'lsa»; filial raqami bo'lmasa) va
 * to'lov SMS'idagi «Murojaat» (u yerda bo'shliqsiz — Eskiz'dagi tasdiqlangan
 * shablon aynan «+998941118855» ko'rinishida).
 */
export const CENTER_PHONE = pick(process.env.NEXT_PUBLIC_CENTER_PHONE, "+998 94 111 88 55");

/**
 * Akademiya'ning o'z nusxasimi. Faqat Akademiya'ga xos sukutlar (eski bot
 * nomlari, Chortoq 1+2 hovuzi) shunga qaraydi — boshqa markazda ular
 * o'z-o'zidan o'chadi.
 */
export const IS_AKADEMIYA = pick(process.env.NEXT_PUBLIC_CENTER_ID, "akademiya") === "akademiya";
