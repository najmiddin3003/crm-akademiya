"use client";

import { useEffect, useState } from "react";
import type { ManagementBranch } from "@/lib/managementBranches";

// Filiallar ro'yxatining YAGONA klient manbasi — /api/branches (MongoDB
// `branches`, Boshqaruv → Filiallar sahifasi boshqaradi).
//
// Ilgari loyihada filiallarning bir nechta mustaqil, qattiq yozilgan ro'yxati
// bor edi (Navbar, buyurtma transfer modali, xodim qo'shish, oflayn kurs
// formalari) va ular bir-biriga mos kelmasdi. Filial kerak bo'lgan har qanday
// klient komponent shu hook'dan foydalanishi kerak.
export function useBranches() {
  const [branches, setBranches] = useState<ManagementBranch[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/branches")
      .then((r) => r.json())
      .then((d) => { if (!cancelled && d.ok) setBranches(d.branches); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  return { branches, loading };
}
