import type { ReactNode } from "react";

// Sozlamalardagi "bu sozlama saqlanadi, lekin hozircha hech qayerda ishlatilmaydi"
// izohi uchun umumiy blok.
//
// NEGA KERAK: Sozlamalar bo'limining bir qancha kartalari qiymatni bazaga
// to'g'ri yozadi, ammo mahsulotning boshqa joyida uni O'QIYDIGAN kod yo'q
// (masalan "Ilova sozlamalari" toggllari yoki menejer bonuslari). Toggle'ni
// hech qanday ogohlantirishsiz ko'rsatish — foydalanuvchiga "yoqdim, endi
// ishlaydi" degan yolg'on va'da beradi. Sozlamani o'chirib tashlash ham
// noto'g'ri bo'lardi: qiymat haqiqiy va saqlanadi. Shu bois karta o'z
// o'rnida qoladi, ustiga esa xira va qisqa rost izoh qo'yiladi.
//
// Qoida: har bir kartaga/bo'limga BITTA izoh, har bir toggle'ga emas.
export default function SettingsNote({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-xl border border-dashed border-border bg-secondary/20 px-4 py-3 text-[12px] leading-relaxed text-muted-foreground">
      {children}
    </div>
  );
}
