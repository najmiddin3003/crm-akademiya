"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { AiActionView, AiChatMessage, AiStatus, AiStreamEvent, AiToolStatus } from "@/lib/ai/protocol";

// AI PANELINING HOLATI — yordamchi holati, xabarlar va oqimni o'qish.
//
// Javob NDJSON oqim bo'lib keladi (lib/ai/protocol.ts): har qator bitta
// hodisa. `fetch` + `ReadableStream` bilan o'qiladi — EventSource faqat
// GET yuboradi.

export interface UiToolChip {
  id: string;
  label: string;
  status: AiToolStatus;
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

export function useAiChat() {
  const [status, setStatus] = useState<AiStatus | null>(null);
  const [loadError, setLoadError] = useState("");
  const [messages, setMessages] = useState<UiMessage[]>([]);
  const [conversationId, setConversationId] = useState("");
  const [busy, setBusy] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  // Panel ochilganda: holat va oxirgi suhbat (parallel).
  useEffect(() => {
    let alive = true;
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
        setStatus({
          enabled: st.enabled,
          configured: st.configured,
          isAdmin: st.isAdmin,
          limit: st.limit,
          remaining: st.remaining,
          actions: st.actions === true,
        });
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

  const handle = useCallback(
    (e: AiStreamEvent) => {
      if (e.type === "meta") {
        if (e.conversationId) setConversationId(e.conversationId);
        setStatus((s) => (s ? { ...s, remaining: e.remaining, limit: e.limit } : s));
      } else if (e.type === "delta") {
        patchLast((m) => ({ ...m, content: m.content + e.text }));
      } else if (e.type === "tool") {
        patchLast((m) => {
          const tools = (m.tools ?? []).filter((x) => x.id !== e.id);
          return { ...m, tools: [...tools, { id: e.id, label: e.label, status: e.status }] };
        });
      } else if (e.type === "action") {
        patchLast((m) => ({ ...m, actions: [...(m.actions ?? []).filter((a) => a.id !== e.action.id), e.action] }));
      } else if (e.type === "error") {
        patchLast((m) => ({ ...m, error: e.message, errorDetail: e.detail }));
      }
    },
    [patchLast],
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
          body: JSON.stringify({ message: q, conversationId }),
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
            handle(ev);
          }
        }
        // Oqim `done`/`error` siz tugadi (server qayta ishga tushdi, ulanish
        // uzildi) — chala javob to'liqdek ko'rinib qolmasin.
        if (!finished) patchLast((m) => ({ ...m, cutOff: true }));
      } catch {
        if (ctl.signal.aborted) patchLast((m) => ({ ...m, stopped: true }));
        else patchLast((m) => ({ ...m, error: "Serverga ulanib bo'lmadi" }));
      } finally {
        patchLast((m) => ({ ...m, pending: false }));
        abortRef.current = null;
        setBusy(false);
      }
    },
    [busy, conversationId, handle, patchLast],
  );

  const stop = useCallback(() => abortRef.current?.abort(), []);

  /** Kartani yangilash — qaysi xabarda bo'lsa ham (suhbat davomida yangi javoblar qo'shilgan bo'lishi mumkin). */
  const patchAction = useCallback((id: string, fn: (a: UiAction) => UiAction) => {
    setMessages((list) =>
      list.map((m) =>
        m.actions?.some((a) => a.id === id) ? { ...m, actions: m.actions.map((a) => (a.id === id ? fn(a) : a)) } : m,
      ),
    );
  }, []);

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
      } catch {
        patchAction(id, (a) => ({ ...a, busy: false, note: "Serverga ulanib bo'lmadi" }));
      }
    },
    [patchAction],
  );

  /** Yangi suhbat — eskisi bazada qoladi (30 kundan keyin o'zi o'chadi). */
  const newChat = useCallback(() => {
    abortRef.current?.abort();
    setMessages([]);
    setConversationId("");
  }, []);

  /** Joriy suhbatni bazadan butunlay o'chirish. */
  const deleteChat = useCallback(async () => {
    const id = conversationId;
    newChat();
    if (id) await fetch(`/api/ai/conversations?id=${encodeURIComponent(id)}`, { method: "DELETE" }).catch(() => {});
  }, [conversationId, newChat]);

  return { status, loadError, messages, busy, conversationId, send, stop, newChat, deleteChat, decide };
}
