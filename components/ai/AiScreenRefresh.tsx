"use client";

import { Fragment, useEffect, useState, type ReactNode } from "react";

// SAHIFANI QAYTA CHIZISH — AI yozuvni saqlagach (08.10.2026).
//
// AI paneli kirim yoki lidni saqlaganda xodim ko'pincha AYNAN o'sha
// sahifada turadi (panel uni oldindan ochib qo'ygan: Kassalar, Lidlar).
// Sahifalar ma'lumotni klientda, ochilganda bir marta oladi — yangi yozuv
// o'z-o'zidan chiqmaydi, `router.refresh()` esa faqat Server Component'larni
// yangilaydi (components/shared/BranchContext.tsx izohi). `location.reload()`
// AI panelini ham yopib yuborardi.
//
// Shuning uchun app/(app)/layout.tsx sahifani shu o'ram ichiga qo'yadi:
// `refreshScreen()` chaqirilsa sahifa kaliti almashadi va u qaytadan
// o'rnatiladi (ma'lumotini qayta oladi). Robot (SpeedFab) o'ramdan
// TASHQARIDA — suhbat saqlanib qoladi.

const EVENT = "tizimli:ai-screen-refresh";

export function refreshScreen(): void {
  window.dispatchEvent(new Event(EVENT));
}

export default function AiScreenRefresh({ children }: { children: ReactNode }) {
  const [version, setVersion] = useState(0);
  useEffect(() => {
    const bump = () => setVersion((v) => v + 1);
    window.addEventListener(EVENT, bump);
    return () => window.removeEventListener(EVENT, bump);
  }, []);
  return <Fragment key={version}>{children}</Fragment>;
}
