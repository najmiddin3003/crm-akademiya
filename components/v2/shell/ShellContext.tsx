"use client";

import { createContext, useContext, type ReactNode } from "react";
import { isPathAllowed } from "@/lib/permissions";

// YANGI QOBIQ KONTEKSTI — sahifalar foydalanuvchi ruxsatini bilishi uchun
// (masalan O'quvchi tezkor panelidagi «To'lov qabul qilish» faqat Kassaga
// ruxsati borga). Qiymat app/(app)/layout.tsx → AppShellV2 dan keladi —
// sahifada `getCurrentUser()` ni qayta chaqirish (bazaga yana so'rov) shart emas.
//
// FAQAT KO'RINISH: tugmani yashirish/ko'rsatish. Haqiqiy tekshiruv o'sha
// sahifa va API'ning o'zida (proxy.ts, lib/permissions.ts).

interface ShellValue {
  /** Rol ruxsatlari — `null` = cheklovsiz. */
  permissions: string[] | null;
  isAdmin: boolean;
}

const ShellContext = createContext<ShellValue>({ permissions: null, isAdmin: false });

export function ShellProvider({ value, children }: { value: ShellValue; children: ReactNode }) {
  return <ShellContext.Provider value={value}>{children}</ShellContext.Provider>;
}

/** Shu sahifaga (masalan "/finance-cash") o'tish mumkinmi. */
export function useCanOpen(path: string): boolean {
  const { permissions } = useContext(ShellContext);
  return isPathAllowed(path, permissions);
}

/** Ruxsatlar va admin belgisi — bir nechta yo'lni birdan tekshirish uchun (Sozlamalar menyusi). */
export function useShell(): ShellValue {
  return useContext(ShellContext);
}
