"use client";

import { useSharedList } from "@/hooks/useSharedList";

import type { PaymentMethod } from "@/lib/paymentMethods";

// To'lov turlarining yagona KLIENT manbasi — Sozlamalar → Moliya → To'lov
// turlari bilan bir xil (/api/settings-lists?kind=payment-methods).
//
// `methods` — hammasi (jadvalda ko'rsatish uchun),
// `active` — faqat faol bo'lganlari (tanlash ro'yxatlari uchun): nofaol
// qilingan tur yangi amalda tanlanmasligi kerak, lekin eski summalar
// ko'rinib turishi kerak.
export function usePaymentMethods() {
  // Takroriy so'rov dedup qilinadi — hooks/useSharedList.ts (11 ta faylda).
  const { items: methods, loading } = useSharedList<PaymentMethod>(
    "shared:payment-methods",
    "/api/settings-lists?kind=payment-methods",
    (d) => (d as { items?: PaymentMethod[] }).items ?? [],
  );

  return { methods, active: methods.filter((m) => m.active), loading };
}
