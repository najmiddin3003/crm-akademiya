// YORDAMCHINING NOMI — MohirAI (09.10.2026, foydalanuvchi qarori: «Mohira
// emas, Mohir bo'lsin»; 08.10 dan bir kun MohiraAI edi).
//
// Brend nomi tarjima ham, kirilga translit ham qilinmaydi: `t()` dan
// o'tmaydi, gap ichida esa `{name}` parametri bo'lib turadi (param
// qiymatlari o'girilmaydi — lib/i18n.ts). Panel sarlavhasi, robot tugmasi
// va tizim ko'rsatmasi (lib/ai/prompt.ts) shu yerdan oladi. Kod ichidagi
// nomlar (MohiraAvatar, `.mh-*`, `tizimli:mohira-hello`) eski — ichki,
// foydalanuvchiga ko'rinmaydi.
export const ASSISTANT_NAME = "MohirAI";

/** Sarlavhada nom yonidagi kichik belgi (konsept: «MohirAI · AI») — u ham o'girilmaydi. */
export const ASSISTANT_TAG = "AI";
