"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { ApiError, fetchJson } from "@/lib/fetchJson";
import type { NotifItem, NotifKind, NotifPayload, NotifSource } from "@/lib/notifications";

// Qo'ng'iroq panelining YAGONA manbasi.
//
// NIMA NOTO'G'RI EDI: Navbar (desktop) va Sidebar'ning mobil chekma menyusi
// o'qilmaganlar sonini HAR BIRI ALOHIDA hisoblardi. Ikkalasi bir vaqtda
// mount bo'ladi (qo'ng'iroq tugmasida `hidden` klassi yo'q), ya'ni telefonda
// ikkita raqam yonma-yon turib bir-biriga zid bo'lishi mumkin edi. Endi
// ikkalasi ham shu kontekstdan o'qiydi.
//
// Filial almashtirilganda BranchContext `location.reload()` qiladi, ya'ni
// provider qaytadan mount bo'ladi — filialga bog'liq alohida kuzatuv shart
// emas.

const POLL_MS = 60_000;
/** Shuncha vaqt tegilmagan tab so'rov yubormaydi. */
const IDLE_MS = 15 * 60_000;
/** Tab qaytganda shundan eski ma'lumot darhol yangilanadi. */
const STALE_MS = 30_000;

const KINDS: NotifKind[] = ["payment", "order", "task"];

export interface NotificationsValue {
  items: NotifItem[];
  unread: number;
  unreadIsFloor: boolean;
  sources: Record<NotifKind, NotifSource> | null;
  status: "loading" | "ok" | "error";
  /** Kamida bir marta muvaffaqiyatli yuklandimi. */
  everLoaded: boolean;
  /** Server vaqtiga tekislangan "hozir" — nisbiy yozuvlar uchun. */
  nowMs: number;
  reload: () => void;
  /** Panel ochiq/yopiqligini bildiradi (ro'yxat ochiqda siljimaydi). */
  setPanelOpen: (open: boolean) => void;
  /** Panel ochilganda: TO'LIQ ko'rsatilgan manbalarni o'qilgan deb belgilaydi. */
  markSeen: () => void;
  /**
   * Aniq tugma: ekranga sig'magan qatorlari bor manbani ham belgilaydi.
   * `kind` berilsa FAQAT o'sha manba — tugma o'zi turgan banner bilan bir xil
   * ish qilishi uchun (ikkita banner ikkita boshqa manba haqida gapiradi).
   */
  markAllSeen: (kind?: NotifKind) => void;
}

const EMPTY: NotificationsValue = {
  items: [],
  unread: 0,
  unreadIsFloor: false,
  sources: null,
  status: "loading",
  everLoaded: false,
  nowMs: 0,
  reload: () => {},
  setPanelOpen: () => {},
  markSeen: () => {},
  markAllSeen: () => {},
};

const Ctx = createContext<NotificationsValue>(EMPTY);

export function NotificationsProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<NotifItem[]>([]);
  const [unread, setUnread] = useState(0);
  const [unreadIsFloor, setUnreadIsFloor] = useState(false);
  const [sources, setSources] = useState<Record<NotifKind, NotifSource> | null>(null);
  const [status, setStatus] = useState<"loading" | "ok" | "error">("loading");
  const [everLoaded, setEverLoaded] = useState(false);
  /**
   * Server vaqtiga tekislangan "hozir".
   *
   * HOLATDA saqlanadi, render paytida `Date.now()` chaqirilmaydi: render sof
   * bo'lishi kerak (server va klient bir xil chizsin). Har taymer urishida
   * yangilanadi — so'rov MUVAFFAQIYATSIZ bo'lsa ham. Aks holda tarmoq uzilsa
   * soat muzlab qolar va bir soatlik yozuv "5 daqiqa oldin" bo'lib turardi.
   */
  const [nowMs, setNowMs] = useState(0);

  /** Ayni paytda ketayotgan so'rov bormi (qayta kirishdan qo'riqchi). */
  const busy = useRef(false);
  /** Sessiya tugagan — halqa butunlay to'xtaydi. */
  const stopped = useRef(false);
  const skewMs = useRef(0);
  const lastOkAt = useRef(0);
  const lastActiveAt = useRef(0);
  const patching = useRef(false);
  /** Nechta sirt panelni ochib turibdi (navbar + mobil menyu). */
  const openCount = useRef(0);
  /** Panel ochiq ekan kelgan, hali qo'yilmagan ro'yxat. */
  const held = useRef<NotifItem[] | null>(null);
  /**
   * Ekranga kamida bitta ro'yxat chiqarilganmi.
   *
   * HOLAT emas, REF: `run` bo'sh bog'liqlik ro'yxati bilan yaratilgan, ya'ni
   * holat qiymati uning ichida eskirib qolardi.
   */
  const published = useRef(false);

  const run = useCallback(async () => {
    if (busy.current || stopped.current) return;
    busy.current = true;
    try {
      const d = await fetchJson<{ ok: true } & NotifPayload>("/api/notifications");
      skewMs.current = Date.parse(d.serverNow) - Date.now();
      lastOkAt.current = Date.now();
      setNowMs(Date.now() + skewMs.current);
      setUnread(d.unread);
      setUnreadIsFloor(d.unreadIsFloor);
      setSources(d.sources);
      // Panel ochiq bo'lsa qatorlarni SILJITMAYMIZ: foydalanuvchi bosmoqchi
      // bo'lgan qator oyoq ostidan ketib, boshqa yozuv bosilib qolardi.
      // Nishon (raqam) esa jonli qolaveradi.
      //
      // `published` SHARTI MAJBURIY: hali hech narsa chizilmagan bo'lsa
      // ushlab qolinmaydi. Aks holda sekin ulanishda foydalanuvchi qo'ng'iroqni
      // BIRINCHI so'rov ketayotganda ochsa, javob `held` ga tushib, panel
      // "Hozircha bildirishnoma yo'q" deb turardi — ustidagi nishonda esa
      // "54 yangi" yozuvi bilan.
      if (openCount.current > 0 && published.current) held.current = d.items;
      else {
        setItems(d.items);
        published.current = true;
        held.current = null;
      }
      setStatus("ok");
      setEverLoaded(true);
    } catch (e) {
      // XATO YUTILMAYDI va bo'sh ro'yxatga aylantirilmaydi — oxirgi yaxshi
      // ma'lumot joyida qoladi, panel esa "yuklanmadi" deb aytadi.
      setStatus("error");
      // Sessiya tugagan bo'lsa qayta urinishning ma'nosi yo'q: keyingi
      // navigatsiyada (app)/layout.tsx foydalanuvchini chiqarib yuboradi.
      // Aks holda tab cheksiz 401 so'rov yog'dirib turardi.
      if (e instanceof ApiError && e.status === 401) stopped.current = true;
    } finally {
      busy.current = false;
    }
  }, []);

  // So'rov halqasi — loyihadagi yagona naqsh (components/management/CvPage.tsx):
  // setTimeout(...,0) + setInterval + `cancelled` bayrog'i + `busy` refi.
  useEffect(() => {
    let cancelled = false;
    lastActiveAt.current = Date.now();
    setNowMs(Date.now() + skewMs.current);

    const bump = () => { lastActiveAt.current = Date.now(); };
    window.addEventListener("pointerdown", bump, { passive: true });
    window.addEventListener("keydown", bump, { passive: true });
    window.addEventListener("focus", bump);

    const onTick = () => {
      if (cancelled) return;
      // O'ZINI TUZATUVCHI QO'RIQCHI: hech bir panel ochiq bo'lmasa-yu,
      // ushlab qolingan ro'yxat qolib ketgan bo'lsa — qo'yamiz. Hisob
      // biror sabab bilan muvozanatdan chiqsa, ro'yxat sahifa qayta
      // yuklanmaguncha muzlab qolmasin.
      if (openCount.current === 0 && held.current) {
        setItems(held.current);
        held.current = null;
      }
      // Vaqt yozuvlari so'rovdan QAT'I NAZAR qimirlaydi.
      setNowMs(Date.now() + skewMs.current);
      // Yashirin yoki tashlab qo'yilgan tab Atlas'ni bezovta qilmasin
      // (kechasi ochiq qolgan tab bir kechada 480 marta so'rardi). Bu ayni
      // paytda "Aktiv qurilmalar" ro'yxatini ham halol saqlaydi: har so'rov
      // `user_sessions.lastSeenAt` ni yangilaydi (lib/auth.ts).
      if (document.hidden) return;
      if (Date.now() - lastActiveAt.current > IDLE_MS) return;
      void run();
    };

    const first = setTimeout(() => { if (!cancelled) void run(); }, 0);
    const timer = setInterval(onTick, POLL_MS);

    const onVisible = () => {
      if (cancelled || document.hidden) return;
      bump();
      setNowMs(Date.now() + skewMs.current);
      if (Date.now() - lastOkAt.current > STALE_MS) void run();
    };
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      cancelled = true;
      clearTimeout(first);
      clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("pointerdown", bump);
      window.removeEventListener("keydown", bump);
      window.removeEventListener("focus", bump);
    };
  }, [run]);

  const setPanelOpen = useCallback((open: boolean) => {
    openCount.current = Math.max(0, openCount.current + (open ? 1 : -1));
    // Oxirgi panel yopildi — ushlab turilgan ro'yxatni qo'yamiz.
    if (openCount.current === 0 && held.current) {
      setItems(held.current);
      held.current = null;
    }
  }, []);

  /**
   * Kursorni suradi.
   *
   * `includeHidden` — o'qilmagani EKRANDAGIDAN ko'p bo'lgan manba ham
   * belgilansinmi. Sukut bo'yicha YO'Q: tamg'a "eng yangi 8 tasini ko'rdim,
   * ortidagi 51 tasini emas" degan gapni IFODALAY OLMAYDI va `$max` bilan
   * orqaga qaytarib ham bo'lmaydi. Ya'ni panelni bir ochish ko'rilmagan
   * o'nlab yozuvni butunlay yutib yuborardi. Bunday manba faqat
   * foydalanuvchi tugmani bosganda yopiladi (panelda banner turadi).
   *
   * Shart `capped` EMAS: u faqat skanerlash chegarasida (100) yonadi,
   * ro'yxatni esa ko'rsatish chegarasi (8) qisqartiradi — o'lchangan
   * holatda 59 o'qilmagan, 16 qator ko'rinib turardi.
   */
  const mark = useCallback(async (includeHidden: boolean, only?: NotifKind) => {
    if (patching.current || !sources) return;

    const seen: Partial<Record<NotifKind, string>> = {};
    let drop = 0;
    for (const k of KINDS) {
      if (only && k !== only) continue;
      const s = sources[k];
      if (!s || s.state !== "on" || s.unread === 0) continue;
      if (s.unread > s.shown && !includeHidden) continue;
      // EKRANDAGI eng yangi qator — server "hozir" i emas. Ro'yxat `at`
      // bo'yicha kamayish tartibida keladi, ya'ni birinchi mos qator eng
      // yangisi. GET bilan shu so'rov orasida tushgan yozuv o'qilmagan
      // bo'lib qolishi kerak.
      const newest = items.find((it) => it.kind === k);
      if (!newest) continue;
      seen[k] = newest.at;
      drop += s.unread;
    }
    const keys = Object.keys(seen) as NotifKind[];
    if (keys.length === 0) return;

    patching.current = true;
    const prev = { items, unread, unreadIsFloor, sources };
    const cleared = new Set<NotifKind>(keys);
    // Optimistik: nishon darhol so'nadi.
    setItems((cur) => cur.map((it) => (cleared.has(it.kind) && it.unread ? { ...it, unread: false } : it)));
    setUnread((n) => Math.max(0, n - drop));
    const nextSources = { ...sources };
    for (const k of keys) nextSources[k] = { ...nextSources[k], unread: 0, capped: false };
    setSources(nextSources);
    // "N+" faqat chegarali manba QOLMAGANDA so'nadi. Hisob yangilagich
    // ICHIDA emas, TASHQARIDA: React yangilagichni ikki marta chaqirishi
    // mumkin va u yerdagi yon ta'sir ikki marta bajarilardi.
    setUnreadIsFloor(KINDS.some((k) => nextSources[k].state === "on" && nextSources[k].capped));

    try {
      await fetchJson("/api/notifications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ seen }),
      });
    } catch {
      // Server rad etdi — interfeys yolg'on ko'rsatmasin, oldingi holat
      // tiklanadi. Keyingi so'rov haqiqatni qaytadan hisoblaydi.
      setItems(prev.items);
      setUnread(prev.unread);
      setUnreadIsFloor(prev.unreadIsFloor);
      setSources(prev.sources);
    } finally {
      patching.current = false;
    }
  }, [items, sources, unread, unreadIsFloor]);

  const markSeen = useCallback(() => { void mark(false); }, [mark]);
  const markAllSeen = useCallback((kind?: NotifKind) => { void mark(true, kind); }, [mark]);
  const reload = useCallback(() => { void run(); }, [run]);

  const value = useMemo<NotificationsValue>(
    () => ({
      items,
      unread,
      unreadIsFloor,
      sources,
      status,
      everLoaded,
      nowMs,
      reload,
      setPanelOpen,
      markSeen,
      markAllSeen,
    }),
    [items, unread, unreadIsFloor, sources, status, everLoaded, nowMs, reload, setPanelOpen, markSeen, markAllSeen],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useNotifications(): NotificationsValue {
  return useContext(Ctx);
}
