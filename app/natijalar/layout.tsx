import type { Metadata } from "next";
import type { ReactNode } from "react";
import { CENTER_NAME, IS_AKADEMIYA } from "@/lib/center";

// OCHIQ IMTIHON NATIJALARI — /natijalar va /natijalar/<kalit> uchun umumiy metadata
// (01.11.2026): kirishsiz sahifa, qidiruv tizimlariga berilmaydi. Sahifa `(app)` guruhidan
// tashqarida — sidebar/navbar yo'q (proxy.ts → PUBLIC_PATHS). Guruh sahifasi sarlavhaga
// guruh nomini qo'shadi (Telegram havola ko'rinishida chiqadi).

export const metadata: Metadata = {
  title: `Imtihon natijalari — ${CENTER_NAME}`,
  description: "Oylik imtihon natijalari: guruh o'quvchilari natijasi, o'rni va guruh o'rtachasi.",
  robots: { index: false, follow: false },
  ...(IS_AKADEMIYA ? { icons: { icon: "/sorovnoma/favicon.png" } } : {}),
};

export default function NatijalarLayout({ children }: { children: ReactNode }) {
  return children;
}
