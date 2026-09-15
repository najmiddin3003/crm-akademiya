"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { useToast } from "@/components/ui/Toast";
import { ApiError, fetchJson } from "@/lib/fetchJson";
import type { InboxAnswer, InboxPayload, InboxTask } from "@/lib/taskInbox";

// XODIMNING SHAXSIY TOPSHIRIQ OYNASI — yagona klient manbasi.
//
// Navbardagi topshiriq ikonkasi (qizil nishon), mobil chekma menyudagi
// qator va modal oynaning o'zi — hammasi shu kontekstdan o'qiydi.
// Ma'lumot app/api/tasks/inbox dan, har 60 soniyada (qo'ng'iroq paneli
// bilan bir xil ritm va bir xil qo'riqchilar: yashirin tab so'ramaydi,
// 15 daqiqa tegilmagan tab so'ramaydi, 401 dan keyin halqa to'xtaydi).
//
// AVTOMATIK OCHILISH — talab: "xodim saytga login qilib kirgandan keyin
// modal oynasida". Qobiq mount bo'lganda (login, sahifa yuklanishi) ro'yxat
// bo'sh bo'lmasa oyna o'zi ochiladi. Qaysi topshiriqlar uchun ochilgani
// localStorage'da SESSIYA KALITI bilan eslab qolinadi: F5 bosilganda o'sha
// topshiriq uchun oyna qaytadan tushmaydi (xodim uni "Keyinroq" deb
// yopgan), yangi login (yangi `sid`) esa kalitni almashtiradi va oyna yana
// ochiladi. Sessiya davomida KELGAN yangi topshiriq oynani majburan
// ochmaydi — xodim kassa oynasining o'rtasida bo'lishi mumkin; uning
// o'rniga toast chiqadi va ikonka qizaradi.

const POLL_MS = 60_000;
/** Shuncha vaqt tegilmagan tab so'rov yubormaydi. */
const IDLE_MS = 15 * 60_000;
/** Tab qaytganda shundan eski ma'lumot darhol yangilanadi. */
const STALE_MS = 30_000;
const SHOWN_KEY = "tizimli:taskInbox.shown";

interface Shown {
  sessionKey: string;
  keys: string[];
}

function readShown(): Shown | null {
  try {
    const raw = localStorage.getItem(SHOWN_KEY);
    if (!raw) return null;
    const v = JSON.parse(raw) as Shown;
    return v && typeof v.sessionKey === "string" && Array.isArray(v.keys) ? v : null;
  } catch {
    return null;
  }
}

function writeShown(v: Shown) {
  try {
    localStorage.setItem(SHOWN_KEY, JSON.stringify(v));
  } catch {
    // localStorage yopiq (maxfiy rejim) — oyna shunchaki har mount'da ochiladi.
  }
}

/** Ro'yxat kalitlari: bitta topshiriq kutilayotgan ham, hisobot ham bo'lishi mumkin. */
function keysOf(p: Pick<InboxPayload, "pending" | "reports">): string[] {
  return [...p.pending.map((t) => `p:${t.id}`), ...p.reports.map((t) => `r:${t.id}`)];
}

export interface TaskInboxValue {
  /** Menga berilgan, javob kutayotgan topshiriqlar. */
  pending: InboxTask[];
  /** Men bergan topshiriqlarga kelgan, hali ko'rilmagan hisobotlar. */
  reports: InboxTask[];
  status: "loading" | "ok" | "error";
  everLoaded: boolean;
  /** Server soati − klient soati (ms) — hisoblagich shu bilan tuzatiladi. */
  skewMs: number;
  open: boolean;
  openModal: () => void;
  closeModal: () => void;
  /** Mas'ul xodimning javobi; xato bo'lsa otadi (oyna xabarni ko'rsatadi). */
  answer: (a: InboxAnswer) => Promise<void>;
  /** Rahbar hisobotlarni ko'rdi. */
  markReportsSeen: (ids: number[]) => Promise<void>;
  reload: () => void;
}

const EMPTY: TaskInboxValue = {
  pending: [],
  reports: [],
  status: "loading",
  everLoaded: false,
  skewMs: 0,
  open: false,
  openModal: () => {},
  closeModal: () => {},
  answer: async () => {},
  markReportsSeen: async () => {},
  reload: () => {},
};

const Ctx = createContext<TaskInboxValue>(EMPTY);

export function TaskInboxProvider({ children }: { children: React.ReactNode }) {
  const { showSuccess } = useToast();
  const [pending, setPending] = useState<InboxTask[]>([]);
  const [reports, setReports] = useState<InboxTask[]>([]);
  const [status, setStatus] = useState<"loading" | "ok" | "error">("loading");
  const [everLoaded, setEverLoaded] = useState(false);
  const [skewMs, setSkewMs] = useState(0);
  const [open, setOpen] = useState(false);

  const busy = useRef(false);
  const stopped = useRef(false);
  const lastOkAt = useRef(0);
  const lastActiveAt = useRef(0);
  /** Birinchi muvaffaqiyatli javob keldimi (avtomatik ochilish faqat shunda). */
  const firstLoadDone = useRef(false);

  const run = useCallback(async () => {
    if (busy.current || stopped.current) return;
    busy.current = true;
    try {
      const d = await fetchJson<{ ok: true } & InboxPayload>("/api/tasks/inbox");
      setSkewMs(Date.parse(d.serverNow) - Date.now());
      lastOkAt.current = Date.now();
      setPending(d.pending);
      setReports(d.reports);
      setStatus("ok");
      setEverLoaded(true);

      // Avtomatik ochilish / toast — faqat HALI KO'RSATILMAGAN qatorlar uchun.
      const prev = readShown();
      const shown = new Set(prev && prev.sessionKey === d.sessionKey ? prev.keys : []);
      const keys = keysOf(d);
      const fresh = keys.filter((k) => !shown.has(k));
      if (fresh.length > 0) {
        if (!firstLoadDone.current) setOpen(true);
        else {
          const nP = fresh.filter((k) => k.startsWith("p:")).length;
          const nR = fresh.length - nP;
          if (nP > 0) showSuccess(nP === 1 ? "Sizga yangi topshiriq berildi" : `Sizga ${nP} ta yangi topshiriq berildi`);
          if (nR > 0) showSuccess(nR === 1 ? "Topshiriq bo'yicha hisobot keldi" : `${nR} ta topshiriq hisoboti keldi`);
        }
      }
      // HAR SAFAR joriy ro'yxat yoziladi, qo'shilmaydi: javob berilib
      // ro'yxatdan chiqqan topshiriq rahbar tomonidan QAYTA berilsa (yangi
      // muddat, hisobot o'chadi — app/api/tasks/[id]) u yana "yangi"
      // hisoblanadi va toast chiqadi. Yozuv ham o'smaydi.
      writeShown({ sessionKey: d.sessionKey, keys });
      firstLoadDone.current = true;
    } catch (e) {
      setStatus("error");
      if (e instanceof ApiError && e.status === 401) stopped.current = true;
    } finally {
      busy.current = false;
    }
  }, [showSuccess]);

  // So'rov halqasi — components/shared/NotificationsProvider.tsx bilan bir xil.
  useEffect(() => {
    let cancelled = false;
    lastActiveAt.current = Date.now();
    const bump = () => { lastActiveAt.current = Date.now(); };
    window.addEventListener("pointerdown", bump, { passive: true });
    window.addEventListener("keydown", bump, { passive: true });
    window.addEventListener("focus", bump);

    const onTick = () => {
      if (cancelled || document.hidden) return;
      if (Date.now() - lastActiveAt.current > IDLE_MS) return;
      void run();
    };
    const first = setTimeout(() => { if (!cancelled) void run(); }, 0);
    const timer = setInterval(onTick, POLL_MS);
    const onVisible = () => {
      if (cancelled || document.hidden) return;
      bump();
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

  const answer = useCallback(async (a: InboxAnswer) => {
    await fetchJson("/api/tasks/inbox", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(a),
    });
    // Server tasdiqladi — qator ro'yxatdan chiqadi. Optimistik EMAS: javob
    // rad etilsa (izoh bo'sh, allaqachon javob berilgan) qator joyida
    // qoladi va oyna xabarni ko'rsatadi.
    setPending((cur) => cur.filter((t) => t.id !== a.id));
  }, []);

  const markReportsSeen = useCallback(async (ids: number[]) => {
    if (ids.length === 0) return;
    await fetchJson("/api/tasks/inbox", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ seen: ids }),
    });
    const gone = new Set(ids);
    setReports((cur) => cur.filter((t) => !gone.has(t.id)));
  }, []);

  // Ochilganda ro'yxat yangilanadi: so'nggi so'rovdan beri (60 s gacha)
  // rahbar muddatni o'zgartirgan yoki yangi topshiriq bergan bo'lishi mumkin.
  const openModal = useCallback(() => { setOpen(true); void run(); }, [run]);
  const closeModal = useCallback(() => setOpen(false), []);
  const reload = useCallback(() => { void run(); }, [run]);

  const value = useMemo<TaskInboxValue>(
    () => ({ pending, reports, status, everLoaded, skewMs, open, openModal, closeModal, answer, markReportsSeen, reload }),
    [pending, reports, status, everLoaded, skewMs, open, openModal, closeModal, answer, markReportsSeen, reload],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useTaskInbox(): TaskInboxValue {
  return useContext(Ctx);
}
