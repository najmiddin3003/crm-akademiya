// Profil menyusi → "Qulflash".
//
// Qulflash sessiyani TUGATMAYDI — foydalanuvchi tizimda qoladi, lekin ekran
// qulflanadi va har qanday sahifaga o'tish /lock ga yo'naltiriladi. Ochish
// uchun o'z paroli so'raladi. Shu bois bu alohida cookie: sessiya cookie'si
// o'z joyida turaveradi.
//
// Cookie qiymati muhim emas — borligi qulflangan degani. `httpOnly` qilinadi,
// ya'ni klient JS uni o'chira olmaydi.
export const LOCK_COOKIE = "locked";
