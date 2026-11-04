import s from "./FaceGuide.module.css";

// QAHRAMON — kamera doirasi chetidagi pufakda 3D odamcha (04.11.2026; egasi besh
// variantdan birinchisini tanladi, chiziqli yuz maketi rad etilgan). Jonlilik
// paytida so'ralgan harakatni o'zi bajaradi va odam unga qarab takrorlaydi: ko'z
// yumib ochadi yoki chapga, keyin o'ngga buriladi. Kamera ustida hech narsa yo'q —
// odam o'z yuzini ochiq ko'radi.
//
// Faqat ko'rinish: yuz aniqlash <video> ni o'zi o'qiydi (FaceCapture), rasm
// kadrga ham, suratga ham tushmaydi.
//
// Chap va o'ng EKRAN bo'yicha: video ko'zgudek, odam o'z chapiga qarasa ekranda
// ham chapga buriladi — qahramonga ergashsa adashmaydi.
//
// Rasm public/xodim ostida: Mini App'da sessiya yo'q, proxy.ts esa sessiyasiz
// statik faylni faqat shu yo'lda beradi. O'lchami va joyi — className dan
// (position ham: pufak doira yonida absolute, alohida turganda relative).

export type FaceDemo = "blink" | "turn" | null;

const SPRITE = { backgroundImage: "url(/xodim/face-guide/hero.webp)" };

export default function FaceGuide({ demo, className }: { demo: FaceDemo; className: string }) {
  return (
    <div aria-hidden className={`${s.bubble} ${className}`} data-demo={demo ?? undefined}>
      <div className={s.sprite} style={SPRITE} />
    </div>
  );
}
