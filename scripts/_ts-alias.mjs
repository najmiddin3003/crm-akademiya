// Node'da loyihaning TypeScript modullarini TO'G'RIDAN-TO'G'RI import
// qilish uchun kichik yuklagich. Sinov skriptlari uchun:
//
//   node --import ./scripts/_ts-alias.mjs scripts/_test-gender-parse.mjs
//
// Ikki ishni qiladi:
//   • "@/..." taxallusini loyiha ildiziga o'giradi (tsconfig'dagi `paths`
//     ni Node bilmaydi);
//   • kengaytmasiz yo'llarga ".ts" / ".tsx" ni o'zi topib qo'shadi
//     (Next importlari kengaytmasiz yoziladi, Node esa aniq yo'l kutadi).
//
// Turlarni Node 22.6+ o'zi tashlab yuboradi, kompilyatsiya kerak emas.
import { register } from "node:module";
register("./_ts-alias-hooks.mjs", import.meta.url);
