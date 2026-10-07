"use client";

import { Fragment, useEffect, useRef, useState, type KeyboardEvent } from "react";
import {
  ArrowDownLeft,
  ArrowUpRight,
  Bot,
  Check,
  CircleAlert,
  ExternalLink,
  Gauge,
  SendHorizontal,
  Settings,
  Square,
  SquarePen,
  Trash2,
  UserPlus,
  X,
  type LucideIcon,
} from "lucide-react";
import Modal, { useModalClose } from "@/components/ui/Modal";
import Button from "@/components/ui/Button";
import Link from "@/components/ui/Link";
import Segmented from "@/components/ui/Segmented";
import Spinner, { SpinnerBlock } from "@/components/ui/Spinner";
import TapTest from "@/components/tezlik/TapTest";
import WhyFast from "@/components/tezlik/WhyFast";
import RobotFace from "@/components/tezlik/RobotFace";
import { useT } from "@/components/shared/Language";
import type { AiActionFieldKey, AiActionKind, AiActionStatus } from "@/lib/ai/protocol";
import { isInternalHref } from "./aiMarkdown";
import MessageText from "./MessageText";
import { useAiChat, type UiAction, type UiMessage } from "./useAiChat";

// ROBOT PANELI — AI yordamchi va tezlik sinovi (components/tezlik/SpeedFab.tsx
// ochadi). Ikki tab:
//   • Yordamchi — admin yoqqan va serverda kalit bo'lsa; aks holda sababi
//     yoziladi (adminga — sozlamaga havola) va panel tezlik sinovidan ochiladi;
//   • Tezlik sinovi — avvalgi robot oynasining o'zi.
//
// Javob matni model yozganidek chiziladi (tarjima qilinmaydi — model
// interfeys tilida yozadi). Interfeysning o'z matnlari `t()` dan o'tadi.

type Tab = "assistant" | "speed";

/** Bo'sh suhbatda taklif qilinadigan savollar (`label:` — i18n skaneri shundan taniydi). */
const EXAMPLES = [
  { label: "Bugungi asosiy ko'rsatkichlar qanday?" },
  { label: "Eng katta qarzdor o'quvchilar kimlar?" },
  { label: "Shu oyda kirim va chiqim qancha bo'ldi?" },
  { label: "Lid qanday qo'shiladi?" },
];

/** Amallar yoqilgan bo'lsa qo'shimcha takliflar (2-bosqich). */
const ACTION_EXAMPLES = [
  { label: "Yangi lid qo'shmoqchiman" },
  { label: "O'quvchidan to'lov qabul qilmoqchiman" },
];

const MAX_CHARS = 2000;

export default function AssistantPanel({ onClose }: { onClose: () => void }) {
  const { t } = useT();
  const modal = useModalClose(onClose, "drawer");
  const chat = useAiChat();
  const { status } = chat;
  const ready = !!status && status.enabled && status.configured;
  const [picked, setPicked] = useState<Tab | null>(null);
  // Tanlanmagan bo'lsa: yordamchi tayyor bo'lsa — u, aks holda tezlik sinovi.
  const tab: Tab = picked ?? (status && !ready ? "speed" : "assistant");

  return (
    <Modal variant="drawer" size="lg" bare controller={modal} onClose={onClose} zIndex={1150} panelClassName="overflow-hidden">
      <div className="flex items-center gap-3 border-b border-border p-4">
        <RobotFace className="h-9 w-9 shrink-0" />
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-base font-semibold">{t("AI yordamchi")}</h3>
          <p className="truncate text-[11px] text-muted-foreground">
            {ready ? t("Bugun yana {n} ta savol", { n: status.remaining }) : t("Savol bering yoki sayt tezligini o'lchang")}
          </p>
        </div>
        <button
          type="button"
          onClick={modal.close}
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-secondary"
          title={t("Yopish")}
        >
          <X className="icon icon-sm" />
        </button>
      </div>

      <div className="border-b border-border px-4 py-2">
        <Segmented
          size="sm"
          value={tab}
          onChange={(v) => setPicked(v as Tab)}
          options={[
            { value: "assistant", label: "Yordamchi", icon: Bot },
            { value: "speed", label: "Tezlik sinovi", icon: Gauge },
          ]}
        />
      </div>

      {tab === "speed" ? (
        <div className="flex-1 space-y-3 overflow-y-auto p-4">
          <TapTest compact />
          <WhyFast compact />
          <Link href="/tezlik" target="_blank" className="inline-flex items-center gap-1.5 text-[13px] text-muted-foreground hover:text-foreground">
            <ExternalLink className="h-3.5 w-3.5" />{" "}{t("Alohida sahifada ochish")}
          </Link>
        </div>
      ) : !status ? (
        <div className="flex-1 p-4">
          {chat.loadError ? <Notice text={t(chat.loadError)} /> : <SpinnerBlock />}
        </div>
      ) : !ready ? (
        <div className="flex-1 space-y-3 p-4">
          <Notice
            text={
              !status.configured
                ? t("AI yordamchi sozlanmagan: serverda OpenAI kaliti yo'q. Administratorga murojaat qiling.")
                : t("AI yordamchi hozircha o'chirilgan.")
            }
          />
          {status.isAdmin && status.configured && (
            <Link
              href="/settings-app?tab=ai"
              onClick={modal.close}
              className="inline-flex items-center gap-1.5 text-[13px] font-medium text-primary hover:underline"
            >
              <Settings className="h-3.5 w-3.5" />{" "}{t("Sozlamalarda yoqish")}
            </Link>
          )}
        </div>
      ) : (
        <Chat chat={chat} onNavigate={modal.close} />
      )}
    </Modal>
  );
}

/** `text` — allaqachon o'girilgan (chaqiruvchi `t()` qiladi: skaner kalitni o'sha yerda ko'radi). */
function Notice({ text }: { text: string }) {
  return (
    <div className="flex items-start gap-2 rounded-xl border border-border bg-secondary/40 p-3 text-[13px]">
      <CircleAlert className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
      <span>{text}</span>
    </div>
  );
}

function Chat({ chat, onNavigate }: { chat: ReturnType<typeof useAiChat>; onNavigate: () => void }) {
  const { t } = useT();
  const [draft, setDraft] = useState("");
  const listRef = useRef<HTMLDivElement>(null);
  const { messages, busy, status } = chat;
  const noQuota = (status?.remaining ?? 0) <= 0;
  const examples = status?.actions ? [...EXAMPLES, ...ACTION_EXAMPLES] : EXAMPLES;

  // Yangi bo'lak kelganda pastga aylantiramiz.
  useEffect(() => {
    const el = listRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages]);

  const submit = (text = draft) => {
    if (!text.trim() || busy || noQuota) return;
    void chat.send(text);
    setDraft("");
  };
  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      submit();
    }
  };

  return (
    <>
      <div ref={listRef} className="flex-1 space-y-3 overflow-y-auto p-4">
        {messages.length === 0 ? (
          <div className="space-y-3">
            <p className="text-[13px] text-muted-foreground">
              {t("Salom! Ruxsatingiz bor bo'limlar bo'yicha savol bering: qarzdorlar, tushum, guruhlar, lidlar, oylik yoki CRM'dan qanday foydalanish.")}
            </p>
            <div className="flex flex-wrap gap-2">
              {examples.map((ex) => (
                <button
                  key={ex.label}
                  type="button"
                  disabled={busy || noQuota}
                  onClick={() => submit(t(ex.label))}
                  className="rounded-full border border-border px-3 py-1.5 text-left text-[12px] transition-colors hover:bg-secondary disabled:opacity-50"
                >
                  {t(ex.label)}
                </button>
              ))}
            </div>
          </div>
        ) : (
          messages.map((m) => <Bubble key={m.key} m={m} onNavigate={onNavigate} onDecide={chat.decide} />)
        )}
      </div>

      <div className="space-y-2 border-t border-border p-3">
        <div className="flex items-end gap-2">
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value.slice(0, MAX_CHARS))}
            onKeyDown={onKeyDown}
            rows={2}
            maxLength={MAX_CHARS}
            disabled={noQuota}
            placeholder={noQuota ? t("Bugungi limit tugadi") : t("Savolingizni yozing…")}
            aria-label={t("Savolingizni yozing…")}
            className="max-h-40 min-h-[44px] flex-1 resize-y rounded-xl border border-border bg-card px-3 py-2 text-[13px] focus:outline-none focus:ring-2 focus:ring-primary/40 disabled:opacity-60"
          />
          {busy ? (
            <button
              type="button"
              onClick={chat.stop}
              title={t("To'xtatish")}
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-border text-muted-foreground hover:bg-secondary"
            >
              <Square className="h-4 w-4" />
            </button>
          ) : (
            <button
              type="button"
              onClick={() => submit()}
              disabled={!draft.trim() || noQuota}
              title={t("Yuborish")}
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary text-white disabled:opacity-50"
            >
              <SendHorizontal className="h-4 w-4" />
            </button>
          )}
        </div>
        <div className="flex items-center justify-between gap-2 text-[11px] text-muted-foreground">
          <span>{t("AI xato qilishi mumkin — muhim raqamlarni sahifadan tekshiring.")}</span>
          {messages.length > 0 && (
            <span className="flex shrink-0 items-center gap-1">
              <button type="button" onClick={chat.newChat} disabled={busy} title={t("Yangi suhbat")} className="rounded p-1 hover:bg-secondary disabled:opacity-50">
                <SquarePen className="h-3.5 w-3.5" />
              </button>
              <button type="button" onClick={() => void chat.deleteChat()} disabled={busy} title={t("Suhbatni o'chirish")} className="rounded p-1 hover:bg-secondary disabled:opacity-50">
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </span>
          )}
        </div>
      </div>
    </>
  );
}

type Decide = (id: string, op: "confirm" | "cancel") => void;

function Bubble({ m, onNavigate, onDecide }: { m: UiMessage; onNavigate: () => void; onDecide: Decide }) {
  const { t } = useT();
  if (m.role === "user") {
    return (
      <div className="flex justify-end">
        <div className="max-w-[85%] whitespace-pre-wrap break-words rounded-2xl rounded-br-md bg-primary px-3 py-2 text-[13px] text-white">
          {m.content}
        </div>
      </div>
    );
  }
  const working = m.pending && !m.content;
  return (
    <div className="flex gap-2">
      <RobotFace className="mt-0.5 h-6 w-6 shrink-0" />
      <div className="min-w-0 flex-1 space-y-1.5 text-[13px]">
        {m.tools && m.tools.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {m.tools.map((x) => (
              <span
                key={x.id}
                className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] ${
                  x.status === "error" ? "bg-rose-100 text-rose-600" : "bg-secondary text-muted-foreground"
                }`}
              >
                {x.status === "start" && <Spinner size={10} />}
                {t(x.label)}
              </span>
            ))}
          </div>
        )}
        {working && (!m.tools || m.tools.length === 0) && (
          <span className="inline-flex items-center gap-2 text-muted-foreground">
            <Spinner size={14} /> {t("O'ylayapti…")}
          </span>
        )}
        {m.content && <MessageText text={m.content} onNavigate={onNavigate} />}
        {m.actions?.map((a) => <ActionCard key={a.id} a={a} onDecide={onDecide} onNavigate={onNavigate} />)}
        {m.stopped && <p className="text-[11px] text-muted-foreground">{t("To'xtatildi")}</p>}
        {(m.error || m.cutOff) && (
          <p className="flex items-start gap-1.5 text-[12px] text-rose-600">
            <CircleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            <span>{m.error ? t(m.error) : t("Javob oxirigacha kelmadi. Qayta urinib ko'ring.")}</span>
          </p>
        )}
      </div>
    </div>
  );
}

// ── Tasdiq kartasi (2-bosqich) ──────────────────────────────────────
//
// AI tuzgan qoralama. Yozuv FAQAT shu yerdagi «Tasdiqlash» bilan bo'ladi
// (POST /api/ai/actions/:id). Yorliqlar `label:` ro'yxatlarda — i18n
// skaneri ularni shundan taniydi; qiymatlar CRM'dagi nomlar.

const ACTION_TITLES: { kind: AiActionKind; label: string; icon: LucideIcon }[] = [
  { kind: "lead", label: "Lid qo'shish", icon: UserPlus },
  { kind: "kirim", label: "Kirim", icon: ArrowDownLeft },
  { kind: "chiqim", label: "Chiqim", icon: ArrowUpRight },
];

const FIELD_LABELS: { key: AiActionFieldKey; label: string }[] = [
  { key: "type", label: "Turi" },
  { key: "pupil", label: "O'quvchi" },
  { key: "employee", label: "Xodim" },
  { key: "group", label: "Guruh" },
  { key: "teacher", label: "Ustoz" },
  { key: "course", label: "Kurs" },
  { key: "days", label: "Dars kunlari" },
  { key: "amount", label: "Summa" },
  { key: "method", label: "To'lov turi" },
  { key: "month", label: "Qaysi oy uchun" },
  { key: "discount", label: "Tanga chegirmasi" },
  { key: "cashbox", label: "Kassa" },
  { key: "branch", label: "Filial" },
  { key: "author", label: "Kim qo'shadi" },
  { key: "note", label: "Izoh" },
];

const STATUS_LABELS: { status: AiActionStatus; label: string; cls: string }[] = [
  { status: "draft", label: "Tasdiq kutmoqda", cls: "bg-amber-100 text-amber-700" },
  { status: "executing", label: "Saqlanmoqda…", cls: "bg-secondary text-muted-foreground" },
  { status: "done", label: "Saqlandi", cls: "bg-emerald-100 text-emerald-700" },
  { status: "failed", label: "Saqlanmadi", cls: "bg-rose-100 text-rose-600" },
  { status: "cancelled", label: "Bekor qilindi", cls: "bg-secondary text-muted-foreground" },
  { status: "expired", label: "Eskirgan", cls: "bg-secondary text-muted-foreground" },
];

const hm = (d: Date) => `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;

/**
 * Qoralama muddati o'tdimi — panel ochiq turgan paytda eskirsa tugmalar
 * o'zi yo'qolsin. Taymer bilan: render ichida `Date.now()` chaqirilmaydi.
 * Qayta ochilgan suhbatda eskirganini server o'zi aytadi (`expired`).
 */
function useExpired(expiresAt: string, active: boolean): boolean {
  const [expired, setExpired] = useState(false);
  useEffect(() => {
    if (!active) return;
    const id = setTimeout(() => setExpired(true), Math.max(0, Date.parse(expiresAt) - Date.now()));
    return () => clearTimeout(id);
  }, [expiresAt, active]);
  return expired;
}

function ActionCard({ a, onDecide, onNavigate }: { a: UiAction; onDecide: Decide; onNavigate: () => void }) {
  const { t, months } = useT();
  const expired = useExpired(a.expiresAt, a.status === "draft");
  const status: AiActionStatus = a.status === "draft" && expired ? "expired" : a.status;
  const meta = ACTION_TITLES.find((x) => x.kind === a.kind) ?? ACTION_TITLES[0];
  const badge = STATUS_LABELS.find((x) => x.status === status) ?? STATUS_LABELS[0];
  const Icon = meta.icon;

  const shown = (key: AiActionFieldKey, value: string): string => {
    if (key === "month" && /^\d{4}-\d{2}$/.test(value)) {
      const [y, m] = value.split("-").map(Number);
      return `${months[m - 1] ?? value} ${y}`;
    }
    if (key === "days") return value.split(", ").map((d) => t(d)).join(", ");
    // Summalar ("{n} so'm"), to'lov turi, tranzaksiya turi — lug'atda bo'lsa o'giriladi, bo'lmasa o'z holicha.
    if (key === "amount" || key === "discount" || key === "method" || key === "type") return t(value);
    return value;
  };

  return (
    <div className="rounded-xl border border-border bg-card p-3">
      <div className="mb-2 flex items-center gap-2">
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <Icon className="h-4 w-4" />
        </span>
        <span className="min-w-0 flex-1 truncate text-[13px] font-semibold">{t(meta.label)}</span>
        <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium ${badge.cls}`}>{t(badge.label)}</span>
      </div>

      <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-[12px]">
        {a.fields.map((f) => (
          <Fragment key={f.key}>
            <dt className="text-muted-foreground">{t(FIELD_LABELS.find((x) => x.key === f.key)?.label ?? f.key)}</dt>
            <dd className="min-w-0 break-words font-medium">{shown(f.key, f.value)}</dd>
          </Fragment>
        ))}
      </dl>

      {status === "draft" && !a.busy && (
        <div className="mt-3 space-y-2">
          <div className="flex flex-wrap gap-2">
            <Button type="button" lucideIcon={Check} onClick={() => onDecide(a.id, "confirm")} className="h-8 px-3 text-[13px]">
              {t("Tasdiqlash")}
            </Button>
            <Button type="button" variant="outline" onClick={() => onDecide(a.id, "cancel")} className="h-8 px-3 text-[13px]">
              {t("Bekor qilish")}
            </Button>
          </div>
          <p className="text-[11px] text-muted-foreground">
            {t("Tasdiqlamaguningizcha hech narsa saqlanmaydi. {time} gacha amal qiladi.", { time: hm(new Date(a.expiresAt)) })}
          </p>
        </div>
      )}
      {(a.busy || status === "executing") && (
        <p className="mt-3 inline-flex items-center gap-2 text-[12px] text-muted-foreground">
          <Spinner size={12} /> {t("Saqlanmoqda…")}
        </p>
      )}
      {status === "done" && (
        <p className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1 text-[12px] text-emerald-700">
          <Check className="h-3.5 w-3.5 shrink-0" />
          <span>{t("Saqlandi: {ref}", { ref: a.resultText ?? "" })}</span>
          {a.resultHref && isInternalHref(a.resultHref) && (
            <Link href={a.resultHref} onClick={onNavigate} className="font-medium text-primary hover:underline">
              {t("Sahifani ochish")}
            </Link>
          )}
        </p>
      )}
      {status === "failed" && a.error && (
        <p className="mt-3 flex items-start gap-1.5 text-[12px] text-rose-600">
          <CircleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span>{t(a.error)}</span>
        </p>
      )}
      {a.note && (
        <p className="mt-2 flex items-start gap-1.5 text-[12px] text-rose-600">
          <CircleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span>{t(a.note)}</span>
        </p>
      )}
    </div>
  );
}
