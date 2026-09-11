import NextLink from "next/link";
import type { ComponentProps } from "react";

// `next/link` ning o'rami: PREFETCH STANDART HOLDA O'CHIQ.
//
// MUAMMO: Next.js `<Link>` ekranga kirgan zahoti manzilini oldindan
// yuklaydi (prod'da). Bu CRM'da (app) ostidagi HAMMA sahifa dinamik —
// har prefetch alohida server so'rovi bo'lib, proxy + layout'dagi
// `getCurrentUser()` (Mongo) orqali o'tadi. Ro'yxat sahifalarida esa
// har qatorda 2–5 tadan havola bor: /groups ochilishi 689 ta so'rov
// yuborib, yarmidan ko'pi 503 qaytgan (o'lchangan). Qaytgan 503 keshga
// tushmaydi, qator qayta chizilganda yana so'raladi — bo'ron kuchayadi.
//
// Foydasi esa deyarli yo'q: dinamik sahifa uchun "auto" prefetch faqat
// eng yaqin `loading.tsx` gacha bo'lgan qismni oladi, tafsilot sahifalari
// ma'lumotni baribir o'tgandan KEYIN API'dan so'raydi.
//
// SHUNING UCHUN butun ilova `next/link` o'rniga shu faylni ishlatadi
// (eslint.config.mjs buni majburlaydi). Prefetch chindan kerak bo'lgan
// yakka joyda `prefetch` ni aniq berish mumkin — o'ram uni ustidan
// yozmaydi.
type LinkProps = ComponentProps<typeof NextLink>;

export default function Link({ prefetch = false, ...rest }: LinkProps) {
  return <NextLink prefetch={prefetch} {...rest} />;
}
