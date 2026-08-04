"use client";

import { useEffect, useState } from "react";
import type { PaymentMethod } from "@/lib/paymentMethods";

// To'lov turlarining yagona KLIENT manbasi — Sozlamalar → Moliya → To'lov
// turlari bilan bir xil (/api/settings-lists?kind=payment-methods).
//
// `methods` — hammasi (jadvalda ko'rsatish uchun),
// `active` — faqat faol bo'lganlari (tanlash ro'yxatlari uchun): nofaol
// qilingan tur yangi amalda tanlanmasligi kerak, lekin eski summalar
// ko'rinib turishi kerak.
export function usePaymentMethods() {
  const [methods, setMethods] = useState<PaymentMethod[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/settings-lists?kind=payment-methods")
      .then((r) => r.json())
      .then((d) => { if (!cancelled && d.ok) setMethods(d.items); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  return { methods, active: methods.filter((m) => m.active), loading };
}
