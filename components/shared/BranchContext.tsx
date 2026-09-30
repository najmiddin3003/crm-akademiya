"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { RefreshCw } from "lucide-react";
import { useT } from "@/components/shared/Language";

// Navbardagi filial tanlovining KLIENT tomoni.
//
// Tanlovning o'zi cookie'da va kesish SERVERDA bo'ladi (lib/branchScope.ts).
// Bu kontekst navbar qaysi filiallarni ko'rsatishini biladi va tanlovni
// almashtiradi.
//
// ALMASHTIRGANDA SAHIFA TO'LIQ QAYTA YUKLANADI (`location.reload()`).
//
// NIMA UCHUN aynan shunday, "aqlliroq" yo'l emas: sahifalar ma'lumotni
// klientdan oladi va HAR BIRI o'zicha so'raydi — kimdir `useStudents`,
// kimdir `PupilsContext`, kimdir to'g'ridan-to'g'ri `fetch("/api/groups")`
// ni `useEffect(..., [])` ichida. Har biriga "filial o'zgardi" signalini
// ulash mumkin edi, lekin bittasini o'tkazib yuborish yetadi: o'sha
// sahifa BOSHQA FILIAL ma'lumotini ko'rsatib turaveradi va buni hech kim
// sezmaydi. Filial almashtirish — kuniga bir-ikki marta qilinadigan,
// butun ekranni o'zgartiradigan amal; bir soniyalik qayta yuklash uning
// evaziga arziydi va hech qanday teshik qoldirmaydi.
//
// `router.refresh()` bu yerda YORDAM BERMAYDI: u Server Component'larni
// qayta quradi, ma'lumot esa klientdan olinadi.
//
// BOSHQA OYNALAR (30.09.2026). Cookie brauzerning HAMMA oynalari uchun
// bitta, qayta yuklash esa faqat almashtirilgan oynada bo'lardi — qolgan
// oynalar eski filial ma'lumotini ko'rsatib turaverardi (Oylik sahifasida
// 34 xodimga «Xodim topilmadi» shundan chiqdi). Endi almashtirgan oyna
// qolganlariga `BroadcastChannel` orqali DARHOL xabar beradi (serverga
// so'rovsiz):
//   • `useBranchChangedElsewhere` bilan belgilangan sahifa (Oylik — pul
//     chiqaradi, forma yo'q) o'sha zahoti o'zi qayta yuklanadi;
//   • qolgan sahifalar AVTOMATIK yuklanmaydi — yarim to'ldirilgan forma
//     yo'qolmasin: tepada «Yangilash» tugmali ogohlantirish chiqadi.
// Foydalanuvchi tanlovi: "Oylik darhol + ogohlantirish".

const BRANCH_CHANNEL = "crm:branch";

export interface BranchOption {
  id: number;
  name: string;
}

interface BranchValue {
  /** Tanlangan filial. Yuklanmaguncha `null`. */
  branchId: number | null;
  branches: BranchOption[];
  isAdmin: boolean;
  loading: boolean;
  /** Tanlovni almashtiradi va sahifani qayta yuklaydi. */
  select: (id: number) => Promise<void>;
}

const EMPTY: BranchValue = {
  branchId: null,
  branches: [],
  isAdmin: false,
  loading: true,
  select: async () => {},
};

const Ctx = createContext<BranchValue>(EMPTY);

/** Boshqa oynada filial almashganda chaqiriladigan sahifa ishlovchilari. */
const elsewhereHandlers = new Set<() => void>();

/**
 * Sahifa: "boshqa oynada filial almashsa meni DARHOL qayta yukla". Bunday
 * sahifada ogohlantirish chiqmaydi — `handler` chaqiriladi. `handler` barqaror
 * bo'lsin (modul darajasidagi funksiya), aks holda har renderda qayta ulanadi.
 */
export function useBranchChangedElsewhere(handler: () => void) {
  useEffect(() => {
    elsewhereHandlers.add(handler);
    return () => { elsewhereHandlers.delete(handler); };
  }, [handler]);
}

export function BranchProvider({ children }: { children: React.ReactNode }) {
  const [branchId, setBranchId] = useState<number | null>(null);
  const [branches, setBranches] = useState<BranchOption[]>([]);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  // Shu oyna QAYSI filial bilan yuklangani va boshqa oynada tanlangan
  // (mos kelmaydigan) filial — ogohlantirish uchun.
  const loadedBranchId = useRef<number | null>(null);
  const [staleBranchId, setStaleBranchId] = useState<number | null>(null);
  const channel = useRef<BroadcastChannel | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/branch")
      .then((r) => r.json())
      .then((d) => {
        if (cancelled || !d?.ok) return;
        setBranchId(d.branchId ?? null);
        setBranches(d.branches ?? []);
        setIsAdmin(!!d.isAdmin);
        loadedBranchId.current = typeof d.branchId === "number" ? d.branchId : null;
      })
      .catch(() => {})
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  // Boshqa oynalardan kelgan "filial almashtirildi" xabari.
  useEffect(() => {
    if (typeof BroadcastChannel === "undefined") return;
    const ch = new BroadcastChannel(BRANCH_CHANNEL);
    channel.current = ch;
    ch.onmessage = (ev: MessageEvent) => {
      const id = Number((ev.data as { branchId?: unknown } | null)?.branchId);
      const loaded = loadedBranchId.current;
      if (!Number.isFinite(id) || loaded === null) return;
      // Boshqa oyna shu oynaning filialiga qaytdi — hammasi yana mos.
      if (id === loaded) {
        setStaleBranchId(null);
        return;
      }
      if (elsewhereHandlers.size > 0) {
        for (const h of elsewhereHandlers) h();
        return;
      }
      setStaleBranchId(id);
    };
    return () => {
      ch.close();
      channel.current = null;
    };
  }, []);

  const select = useCallback(async (id: number) => {
    const res = await fetch("/api/branch", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ branchId: id }),
    });
    const d = await res.json().catch(() => null);
    // Server RAD ETSA sahifa qayta yuklanmaydi — interfeys yolg'on
    // ko'rsatmasin (masalan xodim o'ziga biriktirilmagan filialni tanlasa).
    if (!d?.ok) return;
    // Qolgan oynalar DARHOL bilsin (yuqoridagi izoh). O'z kanalimiz orqali
    // yuboriladi — BroadcastChannel xabarni yuboruvchi obyektning o'ziga
    // qaytarmaydi.
    try { channel.current?.postMessage({ branchId: id }); } catch { /* eski brauzer — faqat shu oyna */ }
    window.location.reload();
  }, []);

  const value = useMemo<BranchValue>(
    () => ({ branchId, branches, isAdmin, loading, select }),
    [branchId, branches, isAdmin, loading, select],
  );

  return (
    <Ctx.Provider value={value}>
      {children}
      {staleBranchId !== null && (
        <StaleBranchBanner name={branches.find((b) => b.id === staleBranchId)?.name ?? ""} />
      )}
    </Ctx.Provider>
  );
}

/**
 * Boshqa oynada filial almashtirilgani haqida ogohlantirish. Yopish tugmasi
 * ATAYLAB yo'q: bu oynadagi ma'lumot eskirgan, uni bilmasdan davom etish
 * xato amalga olib boradi. Yangilash vaqtini esa foydalanuvchi tanlaydi
 * (masalan, formani saqlab bo'lgach).
 */
function StaleBranchBanner({ name }: { name: string }) {
  const { t } = useT();
  // IKKI QATLAM: tungi rejimda `bg-amber-50` markazan 16% SHAFFOF sariqqa
  // aylanadi (app/globals.css → ".dark .bg-amber-50"). Sahifa ustida suzib
  // turgan oynada orqadagi matn ko'rinib qolardi — tagida `bg-card` (ikkala
  // rejimda ham to'liq) turadi, sariq tus uning ustida.
  return (
    <div
      role="alert"
      className="fixed top-3 left-1/2 -translate-x-1/2 z-[300] w-[calc(100%-32px)] max-w-[560px] rounded-xl bg-card shadow-lg"
    >
      <div className="flex items-center gap-3 rounded-xl border border-amber-500/40 bg-amber-50 text-amber-700 px-4 py-3">
        <p className="flex-1 text-[13px] leading-snug">
          {name
            ? t("Boshqa oynada filial almashtirildi: {name}. Bu oynadagi ma'lumotlar eskirgan.", { name })
            : t("Boshqa oynada filial almashtirildi. Bu oynadagi ma'lumotlar eskirgan.")}
        </p>
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="shrink-0 inline-flex items-center gap-1.5 h-8 px-3 rounded-lg bg-amber-500 text-white text-[13px] font-medium hover:opacity-90"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          {t("Yangilash")}
        </button>
      </div>
    </div>
  );
}

export function useBranch(): BranchValue {
  return useContext(Ctx);
}
