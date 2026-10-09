"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { DEFAULT_EFFORT, isEffort, nearestEffort } from "@/lib/ai/models";
import type { AiActionView, AiChatMessage, AiEffort, AiPlanStep, AiStatus, AiStreamEvent, AiToolStatus } from "@/lib/ai/protocol";
import { touchHistory, type AiHistoryItem } from "./history";

// AI PANELINING HOLATI — yordamchi holati, xabarlar va oqimni o'qish.
//
// Javob NDJSON oqim bo'lib keladi (lib/ai/protocol.ts): har qator bitta
// hodisa. `fetch` + `ReadableStream` bilan o'qiladi — EventSource faqat
// GET yuboradi.
//
// MODEL VA «TEZLIK» (4-bosqich) — xodim tanlovi shu qurilmada eslab
// qolinadi (localStorage); ro'yxat o'zgargan bo'lsa (admin modelni
// yopgan) sukutga qaytadi. Server tanlovni baribir qayta tekshiradi.
//
// EKRANDA KO'RSATISH — vosita ko'rgan ma'lumot sahifasi (`tool.href`) va
// saqlangan yozuv sahifasi (`resultHref`) `onScreen` ga uzatiladi: panel
// kichrayib, CRM'da o'sha sahifani ochadi.
//
// SUHBATLAR TARIXI (08.10.2026) — to'liq ekranning chap ro'yxati: panel
// ochilganda yuklanadi, javob saqlangach suhbat tepaga chiqadi (qayta
// so'ramasdan), ro'yxatdan boshqa suhbatni ochish va o'chirish shu yerda.

export interface UiToolChip {
  id: string;
  label: string;
  status: AiToolStatus;
  /** Natija haqida qisqa yozuv (server, o'zbekcha) — ish jarayoni ro'yxatida. */
  note?: string;
  /** Shu qadam ko'rgan sahifa — ro'yxatdan bosib ochish mumkin. */
  href?: string;
}

/** Tasdiq kartasi + mijozdagi holat (so'rov ketyapti / vaqtinchalik xato). */
export interface UiAction extends AiActionView {
  busy?: boolean;
  /** Tugma bosilganda kelgan xato (o'zbekcha, `t()` bilan chiziladi). */
  note?: string;
}

export interface UiMessage {
  key: string;
  role: "user" | "assistant";
  content: string;
  tools?: UiToolChip[];
  /** Xato matni (o'zbekcha, chizishda `t()` dan o'tadi). */
  error?: string;
  /** Xatoning asl sababi — server faqat adminga yuboradi, tarjima qilinmaydi. */
  errorDetail?: string;
  /** Javob hali kelmoqda. */
  pending?: boolean;
  /** Xodim "To'xtatish" ni bosdi. */
  stopped?: boolean;
  /** Oqim yakun belgisisiz uzildi — javob chala bo'lishi mumkin. */
  cutOff?: boolean;
  /** Shu javobdagi amal qoralamalari (2-bosqich). */
  actions?: UiAction[];
  /** Javobni qaysi model va daraja yozdi (`meta` hodisasidan) — ostida kichik yozuv. */
  via?: { model: string; effort: AiEffort | null };
  /** Vazifa rejasi (`update_plan`, 5-bosqich) — eng so'nggi holati. */
  plan?: AiPlanStep[];
}

/** Paneldagi tanlov. `model: ""` — holat hali yuklanmagan. */
export interface AiChoice {
  model: string;
  effort: AiEffort | null;
}

const CHOICE_KEY = "tizimli:ai-choice";

function loadChoice(): Partial<AiChoice> {
  try {
    const raw = JSON.parse(localStorage.getItem(CHOICE_KEY) || "{}") as Record<string, unknown>;
    return { model: typeof raw.model === "string" ? raw.model : undefined, effort: isEffort(raw.effort) ? raw.effort : undefined };
  } catch {
    return {}; // localStorage yo'q/yopiq — sukut
  }
}

function saveChoice(c: AiChoice): void {
  try {
    localStorage.setItem(CHOICE_KEY, JSON.stringify(c));
  } catch {
    // eslab qolinmasa ham ishlaydi
  }
}

/** Tanlov hali ruxsat etilganmi: model ro'yxatda, daraja shu modelda bor — aks holda eng yaqini yoki sukut. */
export function fitChoice(status: Pick<AiStatus, "models" | "defaultModel" | "defaultEffort">, want: Partial<AiChoice>): AiChoice {
  const model =
    status.models.find((m) => m.id === want.model) ?? status.models.find((m) => m.id === status.defaultModel) ?? status.models[0];
  if (!model) return { model: "", effort: null };
  const effort = isEffort(want.effort) ? want.effort : (status.defaultEffort ?? DEFAULT_EFFORT);
  return { model: model.id, effort: nearestEffort(effort, model.efforts) };
}

export interface AiChatOptions {
  /** Ekranda ko'rsatiladigan sahifa; `refresh` — yozuv saqlandi, sahifa yangilansin. */
  onScreen?: (href: string, refresh: boolean) => void;
}

let seq = 0;
const nextKey = () => `m${Date.now().toString(36)}${(seq++).toString(36)}`;

function fromStored(m: AiChatMessage): UiMessage {
  return { key: nextKey(), role: m.role, content: m.content, ...(m.actions?.length ? { actions: m.actions } : {}) };
}

async function errorOf(res: Response): Promise<string> {
  try {
    const d = await res.json();
    if (d?.error) return String(d.error);
  } catch {
    // JSON emas
  }
  return res.status === 429 ? "Bugungi limit tugadi" : "Serverga ulanib bo'lmadi";
}

/** Chap ro'yxat: `items: null` — hali yuklanmoqda; `at` — olingan vaqt (guruhlash shunga nisbatan). */
export interface AiHistory {
  items: AiHistoryItem[] | null;
  at: number;
}

export function useAiChat(opts: AiChatOptions = {}) {
  const [status, setStatus] = useState<AiStatus | null>(null);
  const [loadError, setLoadError] = useState("");
  const [messages, setMessages] = useState<UiMessage[]>([]);
  const [conversationId, setConversationId] = useState("");
  const [busy, setBusy] = useState(false);
  const [choice, setChoiceState] = useState<AiChoice>({ model: "", effort: null });
  const [history, setHistory] = useState<AiHistory>({ items: null, at: 0 });
  /** Ro'yxatdan tanlangan suhbat yuklanmoqda. */
  const [opening, setOpening] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  /** Ketma-ket bosilgan suhbatlardan faqat oxirgisi ochilsin. */
  const openSeq = useRef(0);
  // Eng so'nggi `onScreen` — oqim o'qilayotgan paytda ham (ref effektda yangilanadi).
  const onScreenRef = useRef(opts.onScreen);
  useEffect(() => {
    onScreenRef.current = opts.onScreen;
  }, [opts.onScreen]);

  // Panel ochilganda: holat, oxirgi suhbat va suhbatlar ro'yxati (parallel).
  // Ro'yxat olinmasa ham panel ishlayveradi — chap tomon bo'sh qoladi.
  useEffect(() => {
    let alive = true;
    void fetch("/api/ai/conversations?list=1", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .catch(() => null)
      .then((d: { conversations?: AiHistoryItem[] } | null) => {
        if (alive) setHistory({ items: Array.isArray(d?.conversations) ? d.conversations : [], at: Date.now() });
      });
    (async () => {
      try {
        const [s, c] = await Promise.all([
          fetch("/api/ai/status", { cache: "no-store" }),
          fetch("/api/ai/conversations", { cache: "no-store" }),
        ]);
        if (!s.ok) throw new Error(await errorOf(s));
        const st = (await s.json()) as AiStatus & { ok: boolean };
        const cv = c.ok ? await c.json().catch(() => null) : null;
        if (!alive) return;
        const next: AiStatus = {
          enabled: st.enabled,
          configured: st.configured,
          isAdmin: st.isAdmin,
          limit: st.limit,
          remaining: st.remaining,
          actions: st.actions === true,
          models: Array.isArray(st.models) ? st.models : [],
          defaultModel: String(st.defaultModel ?? ""),
          defaultEffort: isEffort(st.defaultEffort) ? st.defaultEffort : null,
        };
        setStatus(next);
        setChoiceState(fitChoice(next, loadChoice()));
        if (cv?.conversation) {
          setConversationId(String(cv.conversation.id));
          setMessages((cv.conversation.messages as AiChatMessage[]).map(fromStored));
        }
      } catch (e) {
        if (alive) setLoadError(e instanceof Error ? e.message : "Serverga ulanib bo'lmadi");
      }
    })();
    return () => {
      alive = false;
      abortRef.current?.abort();
    };
  }, []);

  const patchLast = useCallback((fn: (m: UiMessage) => UiMessage) => {
    setMessages((list) => {
      if (!list.length) return list;
      const copy = list.slice();
      copy[copy.length - 1] = fn(copy[copy.length - 1]);
      return copy;
    });
  }, []);

  /** Kartani yangilash — qaysi xabarda bo'lsa ham (suhbat davomida yangi javoblar qo'shilgan bo'lishi mumkin). */
  const patchAction = useCallback((id: string, fn: (a: UiAction) => UiAction) => {
    setMessages((list) =>
      list.map((m) =>
        m.actions?.some((a) => a.id === id) ? { ...m, actions: m.actions.map((a) => (a.id === id ? fn(a) : a)) } : m,
      ),
    );
  }, []);

  const handle = useCallback(
    (e: AiStreamEvent) => {
      if (e.type === "meta") {
        if (e.conversationId) setConversationId(e.conversationId);
        setStatus((s) => (s ? { ...s, remaining: e.remaining, limit: e.limit } : s));
        const model = e.model;
        if (model) patchLast((m) => (m.role === "assistant" ? { ...m, via: { model, effort: e.effort ?? null } } : m));
      } else if (e.type === "delta") {
        patchLast((m) => ({ ...m, content: m.content + e.text }));
      } else if (e.type === "tool") {
        // Qadam o'z joyida yangilanadi (tartib — boshlangan tartibda).
        patchLast((m) => {
          const tools = m.tools ?? [];
          const chip: UiToolChip = { id: e.id, label: e.label, status: e.status, ...(e.note ? { note: e.note } : {}), ...(e.href ? { href: e.href } : {}) };
          const at = tools.findIndex((x) => x.id === e.id);
          return { ...m, tools: at >= 0 ? tools.map((x, i) => (i === at ? chip : x)) : [...tools, chip] };
        });
        if (e.status === "done" && e.href) onScreenRef.current?.(e.href, false);
      } else if (e.type === "plan") {
        patchLast((m) => ({ ...m, plan: e.steps }));
      } else if (e.type === "action") {
        patchLast((m) => ({ ...m, actions: [...(m.actions ?? []).filter((a) => a.id !== e.action.id), e.action] }));
      } else if (e.type === "action_update") {
        // Eski karta (oldingi javobda) yangisi bilan almashtirildi — o'z joyida "bekor qilindi".
        patchAction(e.action.id, (a) => ({ ...e.action, busy: a.busy, note: undefined }));
      } else if (e.type === "error") {
        patchLast((m) => ({ ...m, error: e.message, errorDetail: e.detail }));
      }
    },
    [patchAction, patchLast],
  );

  const send = useCallback(
    async (text: string) => {
      const q = text.trim();
      if (!q || busy) return;
      setBusy(true);
      setMessages((list) => [
        ...list,
        { key: nextKey(), role: "user", content: q },
        { key: nextKey(), role: "assistant", content: "", pending: true },
      ]);
      const ctl = new AbortController();
      abortRef.current = ctl;
      try {
        const res = await fetch("/api/ai/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            message: q,
            conversationId,
            ...(choice.model ? { model: choice.model } : {}),
            ...(choice.effort ? { effort: choice.effort } : {}),
          }),
          signal: ctl.signal,
        });
        const type = res.headers.get("content-type") || "";
        if (!res.ok || !type.includes("ndjson") || !res.body) {
          const msg = await errorOf(res);
          patchLast((m) => ({ ...m, error: msg }));
          if (res.status === 429) setStatus((s) => (s ? { ...s, remaining: 0 } : s));
          return;
        }
        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buf = "";
        let finished = false;
        // Saqlangan suhbat id'si (oxirgi `meta`) va javob to'liq saqlandimi (`done`).
        let savedId = "";
        let saved = false;
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          buf += decoder.decode(value, { stream: true });
          let nl: number;
          while ((nl = buf.indexOf("\n")) >= 0) {
            const line = buf.slice(0, nl).trim();
            buf = buf.slice(nl + 1);
            if (!line) continue;
            let ev: AiStreamEvent;
            try {
              ev = JSON.parse(line) as AiStreamEvent;
            } catch {
              continue; // buzilgan qator — o'tkazib yuboriladi
            }
            if (ev.type === "done" || ev.type === "error") finished = true;
            if (ev.type === "meta" && ev.conversationId) savedId = ev.conversationId;
            if (ev.type === "done") saved = true;
            handle(ev);
          }
        }
        // Oqim `done`/`error` siz tugadi (server qayta ishga tushdi, ulanish
        // uzildi) — chala javob to'liqdek ko'rinib qolmasin.
        if (!finished) patchLast((m) => ({ ...m, cutOff: true }));
        // Chap ro'yxat: suhbat tepaga chiqadi (yangisi qo'shiladi).
        if (saved && savedId) {
          const at = Date.now();
          setHistory((h) => ({ items: touchHistory(h.items, savedId, q, new Date(at).toISOString()), at }));
        }
      } catch {
        if (ctl.signal.aborted) patchLast((m) => ({ ...m, stopped: true }));
        else patchLast((m) => ({ ...m, error: "Serverga ulanib bo'lmadi" }));
      } finally {
        patchLast((m) => ({ ...m, pending: false }));
        abortRef.current = null;
        setBusy(false);
      }
    },
    [busy, choice, conversationId, handle, patchLast],
  );

  /** Model yoki «Tezlik» almashtirildi — ruxsat etilganiga moslanib, eslab qolinadi. */
  const setChoice = useCallback(
    (next: Partial<AiChoice>) => {
      if (!status) return;
      const fitted = fitChoice(status, { ...choice, ...next });
      setChoiceState(fitted);
      saveChoice(fitted);
    },
    [choice, status],
  );

  const stop = useCallback(() => abortRef.current?.abort(), []);

  /**
   * «Tasdiqlash» / «Bekor qilish». Javobda kartaning yangi holati keladi
   * (saqlandi, bekor qilindi, eskirgan …); u bo'lmasa — xato kartaning
   * ostida yoziladi.
   */
  const decide = useCallback(
    async (id: string, op: "confirm" | "cancel") => {
      patchAction(id, (a) => ({ ...a, busy: true, note: undefined }));
      try {
        const res = await fetch(`/api/ai/actions/${encodeURIComponent(id)}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ op }),
        });
        const d = (await res.json().catch(() => null)) as { ok?: boolean; error?: string; action?: AiActionView } | null;
        patchAction(id, (a) => ({
          ...(d?.action ?? a),
          busy: false,
          // Saqlab bo'lmagan yozuvning sababi kartaning o'zida (`error`) — ikki marta yozilmasin.
          note: d?.ok || d?.action?.status === "failed" ? undefined : d?.error || "Serverga ulanib bo'lmadi",
        }));
        // Saqlandi — yozuv ko'rinadigan sahifa ekranda ochiladi (o'sha sahifada turgan bo'lsa — yangilanadi).
        if (d?.action?.status === "done" && d.action.resultHref) onScreenRef.current?.(d.action.resultHref, true);
      } catch {
        patchAction(id, (a) => ({ ...a, busy: false, note: "Serverga ulanib bo'lmadi" }));
      }
    },
    [patchAction],
  );

  /** Yangi suhbat — eskisi bazada qoladi (30 kundan keyin o'zi o'chadi). */
  const newChat = useCallback(() => {
    abortRef.current?.abort();
    openSeq.current++; // yuklanayotgan suhbat bo'lsa — endi kerak emas
    setOpening(false);
    setMessages([]);
    setConversationId("");
  }, []);

  /**
   * Ro'yxatdan suhbatni ochish. Javob kelayotganda — yo'q (yarim javob
   * yo'qolmasin). Suhbat topilmasa (muddati o'tgan, boshqa qurilmada
   * o'chirilgan) — ro'yxatdan olib tashlanadi.
   */
  const openConversation = useCallback(
    async (id: string) => {
      if (busy || !id || id === conversationId) return;
      const seq = ++openSeq.current;
      setOpening(true);
      try {
        const res = await fetch(`/api/ai/conversations?id=${encodeURIComponent(id)}`, { cache: "no-store" });
        const d = res.ok ? ((await res.json().catch(() => null)) as { conversation?: { id: string; messages: AiChatMessage[] } | null } | null) : null;
        if (seq !== openSeq.current) return;
        if (d?.conversation) {
          setConversationId(String(d.conversation.id));
          setMessages(d.conversation.messages.map(fromStored));
        } else if (res.ok) {
          setHistory((h) => ({ ...h, items: h.items?.filter((x) => x.id !== id) ?? h.items }));
        }
      } catch {
        // tarmoq — joriy suhbat o'z holicha qoladi
      } finally {
        if (seq === openSeq.current) setOpening(false);
      }
    },
    [busy, conversationId],
  );

  /** Suhbatni bazadan butunlay o'chirish (ro'yxatdan yoki joriysini). */
  const removeConversation = useCallback(
    async (id: string) => {
      if (!id) return;
      if (id === conversationId) {
        if (busy) return;
        newChat();
      }
      setHistory((h) => ({ ...h, items: h.items?.filter((x) => x.id !== id) ?? h.items }));
      await fetch(`/api/ai/conversations?id=${encodeURIComponent(id)}`, { method: "DELETE" }).catch(() => {});
    },
    [busy, conversationId, newChat],
  );

  /** Joriy suhbatni bazadan butunlay o'chirish. */
  const deleteChat = useCallback(async () => {
    const id = conversationId;
    if (id) await removeConversation(id);
    else newChat();
  }, [conversationId, newChat, removeConversation]);

  return {
    status,
    loadError,
    messages,
    busy,
    conversationId,
    choice,
    setChoice,
    send,
    stop,
    newChat,
    deleteChat,
    decide,
    history,
    opening,
    openConversation,
    removeConversation,
  };
}
