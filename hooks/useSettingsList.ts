"use client";

import { useEffect, useMemo, useState } from "react";
import type { SettingsListItem, SettingsListKind } from "@/lib/settingsLists";

// Sozlamalardagi ixtiyoriy CRUD ro'yxatining klient manbasi
// (/api/settings-lists?kind=…). Sozlamalar sahifasining o'zi
// SettingsListTab orqali tahrirlaydi; TANLASH ro'yxatlari esa shu hook'dan
// o'qiydi — aks holda foydalanuvchi qo'shgan sabab/kategoriya hech qayerda
// tanlanmasdi.
//
// usePaymentMethods.ts allaqachon shu naqshning `payment-methods` uchun
// maxsus varianti; bu esa qolgan 13 ta `kind` uchun umumiysi.
export function useSettingsList(kind: SettingsListKind) {
  const [items, setItems] = useState<SettingsListItem[]>([]);
  const [loading, setLoading] = useState(true);

  // `kind` chaqiruv joyida o'zgarmas (har bir joy bitta ro'yxatni so'raydi),
  // shuning uchun `loading` ni effekt ichida qayta `true` qilmaymiz —
  // React compiler buni "kaskadli render" deb rad etadi.
  useEffect(() => {
    let cancelled = false;
    fetch(`/api/settings-lists?kind=${kind}`)
      .then((r) => r.json())
      .then((d) => { if (!cancelled && d.ok) setItems(d.items); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [kind]);

  const names = useMemo(() => items.map((i) => i.name).filter(Boolean), [items]);

  return { items, names, loading };
}

/**
 * Tanlash ro'yxatlari uchun: sozlamalarda ro'yxat TO'LDIRILGAN bo'lsa o'shani,
 * hali bo'sh bo'lsa `fallback` ni qaytaradi.
 *
 * Bu ro'yxatlarda seed yo'q — yangi bazada ular bo'sh boshlanadi. To'g'ridan-
 * to'g'ri ulasak, foydalanuvchi Sozlamalarga kirib to'ldirmaguncha select
 * BUTUNLAY bo'sh bo'lib qolardi, ya'ni ilgarigi qattiq ro'yxatdan ham yomon.
 * Shu bois: sozlamada bor bo'lsa — u ustun, yo'q bo'lsa — kelishilgan
 * standart ro'yxat.
 */
export function useSettingsListNames(kind: SettingsListKind, fallback: string[]) {
  const { names, loading } = useSettingsList(kind);
  return {
    names: names.length > 0 ? names : fallback,
    /** `true` — ro'yxat sozlamalardan keldi (standart emas). */
    fromSettings: names.length > 0,
    loading,
  };
}

/**
 * Sabablar ro'yxati turi bo'yicha ("Ketdi" | "Bekor qilindi" | "Davomat" —
 * lib/settingsLists.ts LEAVE_REASON_TYPES). Sozlamalar → O'quv → Sabablar'da
 * har bir sabab shu turlardan biriga tegishli qilib kiritiladi.
 */
export function useReasons(type: string) {
  const { items, loading } = useSettingsList("reasons");
  const names = useMemo(
    () => items.filter((i) => i.type === type).map((i) => i.name).filter(Boolean),
    [items, type],
  );
  return { names, loading };
}
