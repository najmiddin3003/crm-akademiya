"use client";

import {
  Fragment,
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type KeyboardEvent,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import {
  ArrowDownLeft,
  ArrowLeftRight,
  ArrowUp,
  ArrowUpRight,
  Bot,
  Check,
  CircleAlert,
  ClipboardList,
  ExternalLink,
  Gauge,
  Maximize2,
  MessageSquarePlus,
  Minimize2,
  MonitorPlay,
  Settings,
  Square,
  SquarePen,
  Trash2,
  UserPlus,
  X,
  type LucideIcon,
} from "lucide-react";
import Button from "@/components/ui/Button";
import Link from "@/components/ui/Link";
import Segmented from "@/components/ui/Segmented";
import Spinner, { SpinnerBlock } from "@/components/ui/Spinner";
import TapTest from "@/components/tezlik/TapTest";
import WhyFast from "@/components/tezlik/WhyFast";
import RobotFace from "@/components/tezlik/RobotFace";
import { useT } from "@/components/shared/Language";
import { effortLabel } from "@/lib/ai/models";
import type { AiActionFieldKey, AiActionKind, AiActionStatus } from "@/lib/ai/protocol";
import { refreshScreen } from "./AiScreenRefresh";
import { isInternalHref } from "./aiMarkdown";
import MessageText from "./MessageText";
import ModelPicker from "./ModelPicker";
import { useAiChat, type UiAction, type UiMessage } from "./useAiChat";

// ROBOT PANELI — AI yordamchi va tezlik sinovi (components/tezlik/SpeedFab.tsx
// ochadi). Ikki tab:
//   • Yordamchi — admin yoqqan va serverda kalit bo'lsa; aks holda sababi
//     yoziladi (adminga — sozlamaga havola) va panel tezlik sinovidan ochiladi;
//   • Tezlik sinovi — avvalgi robot oynasining o'zi.
//
// IKKI KO'RINISH (08.10.2026, ChatGPT oynasi kabi):
//   • TO'LIQ EKRAN — ochilganda. Yozish maydoni ichida model va «Tezlik»
//     tanlovi (components/ai/ModelPicker.tsx);
//   • SUZUVCHI OYNA — kichik, sarlavhasidan sudrab istalgan joyga qo'yiladi
//     (joyi shu qurilmada eslab qolinadi), orqadagi sahifa ishlayveradi.
// AI ishga kirishsa (vosita ma'lumot olsa, qoralama tuzsa, yozuv saqlansa)
// panel O'ZI kichrayadi va CRM'da o'sha ish sahifasini ochadi — xodim AI
// nima qilayotganini ekranda ko'radi; ish davomida ekran chetida nur
// yonadi. Buni sarlavhadagi «ekranda ko'rsatish» tugmasi bilan o'chirish
// mumkin (tanlov eslab qolinadi).
//
// Javob matni model yozganidek chiziladi (tarjima qilinmaydi — model
// interfeys tilida yozadi). Interfeysning o'z matnlari `t()` dan o'tadi.

type Tab = "assistant" | "speed";
type View = "full" | "float";
type Chat = ReturnType<typeof useAiChat>;

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

const FOLLOW_KEY = "tizimli:ai-follow";
const FLOAT_KEY = "tizimli:ai-float";
const FLOAT_MARGIN = 12;
/** Bir qadamda bir nechta vosita ishlasa — ekranda faqat oxirgisi ochiladi. */
const SCREEN_DELAY_MS = 350;

interface Pos {
  x: number;
  y: number;
}

/** Suzuvchi oyna o'lchami — tor ekranda deyarli butun kenglik. */
function floatSize(): { w: number; h: number } {
  return {
    w: Math.min(400, window.innerWidth - FLOAT_MARGIN * 2),
    h: Math.min(580, Math.round(window.innerHeight * 0.72)),
  };
}

function clampPos(p: Pos): Pos {
  const { w, h } = floatSize();
  return {
    x: Math.min(Math.max(FLOAT_MARGIN, p.x), Math.max(FLOAT_MARGIN, window.innerWidth - w - FLOAT_MARGIN)),
    y: Math.min(Math.max(FLOAT_MARGIN, p.y), Math.max(FLOAT_MARGIN, window.innerHeight - h - FLOAT_MARGIN)),
  };
}

/** Saqlangan joy, bo'lmasa o'ng-past burchak. */
function loadFloatPos(): Pos {
  try {
    const p = JSON.parse(localStorage.getItem(FLOAT_KEY) || "null") as Partial<Pos> | null;
    if (p && typeof p.x === "number" && typeof p.y === "number") return clampPos({ x: p.x, y: p.y });
  } catch {
    // localStorage yo'q/yopiq — standart joy
  }
  const { w, h } = floatSize();
  return clampPos({ x: window.innerWidth - w - FLOAT_MARGIN * 2, y: window.innerHeight - h - FLOAT_MARGIN * 2 });
}

function loadFollow(): boolean {
  try {
    return localStorage.getItem(FOLLOW_KEY) !== "0";
  } catch {
    return true;
  }
}

// SSR'da portal chizib bo'lmaydi (components/ui/Modal.tsx bilan bir xil yo'l).
const subscribeNoop = () => () => {};
const useMounted = () => useSyncExternalStore(subscribeNoop, () => true, () => false);

export default function AssistantPanel({ onClose }: { onClose: () => void }) {
  const { t } = useT();
  const router = useRouter();
  const mounted = useMounted();
  const [view, setView] = useState<View>("full");
  const [follow, setFollow] = useState(loadFollow);
  const [pos, setPos] = useState<Pos | null>(null);
  const [draft, setDraft] = useState("");
  const [picked, setPicked] = useState<Tab | null>(null);

  // Ekranda ko'rsatish: panel kichrayadi, sahifa ochiladi (oqim davomida
  // keladi — eng so'nggi `follow` ref orqali o'qiladi).
  const followRef = useRef(follow);
  useEffect(() => {
    followRef.current = follow;
  }, [follow]);
  const navTimer = useRef<number | null>(null);
  useEffect(() => () => {
    if (navTimer.current !== null) window.clearTimeout(navTimer.current);
  }, []);

  const showOnScreen = useCallback(
    (href: string, refresh: boolean) => {
      if (!followRef.current || !isInternalHref(href)) return;
      setView("float");
      if (navTimer.current !== null) window.clearTimeout(navTimer.current);
      navTimer.current = window.setTimeout(() => {
        navTimer.current = null;
        const here = `${window.location.pathname}${window.location.search}`;
        if (here !== href) router.push(href);
        else if (refresh) refreshScreen();
      }, SCREEN_DELAY_MS);
    },
    [router],
  );

  const chat = useAiChat({ onScreen: showOnScreen });
  const { status, busy } = chat;
  const ready = !!status && status.enabled && status.configured;
  // Tanlanmagan bo'lsa: yordamchi tayyor bo'lsa — u, aks holda tezlik sinovi.
  const tab: Tab = picked ?? (status && !ready ? "speed" : "assistant");
  const full = view === "full" || tab === "speed" || !ready;

  // Suzuvchi oyna joyi: birinchi kichrayishda o'qiladi, oyna o'lchami o'zgarsa ekran ichiga qaytadi.
  useEffect(() => {
    if (full) return;
    const id = window.setTimeout(() => setPos((p) => p ?? loadFloatPos()), 0);
    const onResize = () => setPos((p) => (p ? clampPos(p) : p));
    window.addEventListener("resize", onResize);
    return () => {
      window.clearTimeout(id);
      window.removeEventListener("resize", onResize);
    };
  }, [full]);

  const toggleFollow = () => {
    const next = !follow;
    setFollow(next);
    try {
      localStorage.setItem(FOLLOW_KEY, next ? "1" : "0");
    } catch {
      // eslab qolinmasa ham ishlaydi
    }
  };

  // Havola bosildi (javobdagi yoki kartadagi) — sahifa ochiladi, suhbat kichrayib qoladi.
  const onNavigate = useCallback(() => setView("float"), []);

  // Esc — to'liq ekranda panelni yopadi (ichidagi ro'yxatlar Esc'ni o'zi ushlaydi).
  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === "Escape" && full) {
      e.stopPropagation();
      onClose();
    }
  };

  if (!mounted) return null;

  const body =
    tab === "speed" ? (
      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto w-full max-w-2xl space-y-3 p-4">
          <TapTest compact />
          <WhyFast compact />
          <Link href="/tezlik" target="_blank" className="inline-flex items-center gap-1.5 text-[13px] text-muted-foreground hover:text-foreground">
            <ExternalLink className="h-3.5 w-3.5" />{" "}{t("Alohida sahifada ochish")}
          </Link>
        </div>
      </div>
    ) : !status ? (
      <div className="mx-auto w-full max-w-2xl flex-1 p-4">
        {chat.loadError ? <Notice text={t(chat.loadError)} /> : <SpinnerBlock />}
      </div>
    ) : !ready ? (
      <div className="mx-auto w-full max-w-2xl flex-1 space-y-3 p-4">
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
            onClick={onClose}
            className="inline-flex items-center gap-1.5 text-[13px] font-medium text-primary hover:underline"
          >
            <Settings className="h-3.5 w-3.5" />{" "}{t("Sozlamalarda yoqish")}
          </Link>
        )}
      </div>
    ) : (
      <ChatBody chat={chat} full={full} draft={draft} setDraft={setDraft} onNavigate={onNavigate} />
    );

  const node = (
    <>
      {/* AI ishlayapti — ekran chetida nur (panel kichraygan, sahifa ko'rinib turibdi). */}
      {!full && busy && <div aria-hidden className="ai-working-glow pointer-events-none fixed inset-0 z-[1149]" />}
      <div
        role="dialog"
        aria-modal={full}
        aria-label={t("AI yordamchi")}
        onKeyDown={onKeyDown}
        className={
          full
            ? "ui-modal-in ai-screen fixed inset-0 z-[1150] flex flex-col"
            : "ui-modal-in fixed z-[1150] flex flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-2xl"
        }
        style={full ? undefined : pos ? { left: pos.x, top: pos.y, width: floatSize().w, height: floatSize().h } : { visibility: "hidden" }}
      >
        {full ? (
          <FullHeader
            tab={tab}
            onTab={setPicked}
            ready={ready}
            remaining={status && ready ? status.remaining : null}
            follow={follow}
            onFollow={toggleFollow}
            canNewChat={ready && tab === "assistant" && chat.messages.length > 0 && !busy}
            onNewChat={chat.newChat}
            onShrink={() => setView("float")}
            onClose={onClose}
          />
        ) : (
          <FloatHeader chat={chat} follow={follow} onFollow={toggleFollow} onExpand={() => setView("full")} onClose={onClose} pos={pos} onMove={setPos} />
        )}
        {body}
      </div>
    </>
  );

  return createPortal(node, document.body);
}

// ── Sarlavhalar ──────────────────────────────────────────────────────

function IconButton({
  title,
  icon: Icon,
  onClick,
  active,
  disabled,
  small,
}: {
  title: string;
  icon: LucideIcon;
  onClick: () => void;
  active?: boolean;
  disabled?: boolean;
  small?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      aria-label={title}
      aria-pressed={active}
      className={`flex shrink-0 items-center justify-center rounded-full transition-colors disabled:opacity-40 ${small ? "h-7 w-7" : "h-8 w-8"} ${
        active ? "bg-primary/10 text-primary hover:bg-primary/15" : "text-muted-foreground hover:bg-secondary hover:text-foreground"
      }`}
    >
      <Icon className={small ? "h-3.5 w-3.5" : "h-4 w-4"} />
    </button>
  );
}

function FullHeader({
  tab,
  onTab,
  ready,
  remaining,
  follow,
  onFollow,
  canNewChat,
  onNewChat,
  onShrink,
  onClose,
}: {
  tab: Tab;
  onTab: (t: Tab) => void;
  ready: boolean;
  remaining: number | null;
  follow: boolean;
  onFollow: () => void;
  canNewChat: boolean;
  onNewChat: () => void;
  onShrink: () => void;
  onClose: () => void;
}) {
  const { t } = useT();
  const tabs = (
    <Segmented
      size="sm"
      value={tab}
      onChange={(v) => onTab(v as Tab)}
      options={[
        { value: "assistant", label: "Yordamchi", icon: Bot },
        { value: "speed", label: "Tezlik sinovi", icon: Gauge },
      ]}
    />
  );
  return (
    <>
      <div className="flex shrink-0 items-center gap-3 border-b border-border/70 px-3 py-2.5 md:px-5">
        <RobotFace className="h-9 w-9 shrink-0" />
        <div className="min-w-0 flex-1 sm:flex-none">
          <h3 className="truncate text-base font-semibold">{t("AI yordamchi")}</h3>
          <p className="truncate text-[11px] text-muted-foreground">
            {remaining !== null ? t("Bugun yana {n} ta savol", { n: remaining }) : t("Savol bering yoki sayt tezligini o'lchang")}
          </p>
        </div>
        <div className="mx-auto hidden w-64 sm:block">{tabs}</div>
        <div className="flex shrink-0 items-center gap-0.5">
          {ready && tab === "assistant" && (
            <>
              <IconButton
                title={follow ? t("AI ishini ekranda ko'rsatish: yoqilgan") : t("AI ishini ekranda ko'rsatish: o'chirilgan")}
                icon={MonitorPlay}
                active={follow}
                onClick={onFollow}
              />
              <IconButton title={t("Yangi suhbat")} icon={SquarePen} onClick={onNewChat} disabled={!canNewChat} />
              <IconButton title={t("Kichraytirish")} icon={Minimize2} onClick={onShrink} />
            </>
          )}
          <IconButton title={t("Yopish")} icon={X} onClick={onClose} />
        </div>
      </div>
      <div className="shrink-0 border-b border-border/70 px-3 py-2 sm:hidden">{tabs}</div>
    </>
  );
}

/** Hozir nima bo'lyapti — kichik oyna sarlavhasida: ishlayotgan vosita yorlig'i, javob yozilyapti yoki o'ylayapti. */
function stepOf(chat: Chat): { tool: string } | "writing" | "thinking" | null {
  const last = chat.messages[chat.messages.length - 1];
  if (!chat.busy || !last || last.role !== "assistant") return null;
  const running = [...(last.tools ?? [])].reverse().find((x) => x.status === "start");
  if (running) return { tool: running.label };
  return last.content ? "writing" : "thinking";
}

function FloatHeader({
  chat,
  follow,
  onFollow,
  onExpand,
  onClose,
  pos,
  onMove,
}: {
  chat: Chat;
  follow: boolean;
  onFollow: () => void;
  onExpand: () => void;
  onClose: () => void;
  pos: Pos | null;
  onMove: (p: Pos) => void;
}) {
  const { t } = useT();
  const drag = useRef<{ sx: number; sy: number; origin: Pos } | null>(null);
  const s = stepOf(chat);
  const step = s === null ? "" : s === "writing" ? t("Javob yozilmoqda…") : s === "thinking" ? t("O'ylayapti…") : t(s.tool);

  // Sarlavhadan sudrash (tugmalar bundan mustasno). Joy qo'yib yuborilganda eslab qolinadi.
  const onPointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (!pos || (e.target as HTMLElement).closest("button")) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    drag.current = { sx: e.clientX, sy: e.clientY, origin: pos };
  };
  const onPointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    if (!d) return;
    onMove(clampPos({ x: d.origin.x + e.clientX - d.sx, y: d.origin.y + e.clientY - d.sy }));
  };
  const onPointerUp = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (!drag.current) return;
    drag.current = null;
    if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId);
    if (pos) {
      try {
        localStorage.setItem(FLOAT_KEY, JSON.stringify(pos));
      } catch {
        // eslab qolinmasa ham ishlaydi
      }
    }
  };

  return (
    <div
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      title={t("Sudrab ko'chirish mumkin")}
      className="flex shrink-0 cursor-grab touch-none select-none items-center gap-2 border-b border-border bg-card px-3 py-2 active:cursor-grabbing"
    >
      <RobotFace className={`h-7 w-7 shrink-0 ${chat.busy ? "animate-pulse" : ""}`} />
      <div className="min-w-0 flex-1">
        <div className="truncate text-[13px] font-semibold">{t("AI yordamchi")}</div>
        <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
          {step ? (
            <>
              <Spinner size={10} />
              <span className="truncate">{step}</span>
            </>
          ) : (
            <span className="truncate">{chat.status ? t("Bugun yana {n} ta savol", { n: chat.status.remaining }) : ""}</span>
          )}
        </div>
      </div>
      <IconButton
        small
        title={follow ? t("AI ishini ekranda ko'rsatish: yoqilgan") : t("AI ishini ekranda ko'rsatish: o'chirilgan")}
        icon={MonitorPlay}
        active={follow}
        onClick={onFollow}
      />
      <IconButton small title={t("To'liq ekran")} icon={Maximize2} onClick={onExpand} />
      <IconButton small title={t("Yopish")} icon={X} onClick={onClose} />
    </div>
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

// ── Suhbat ──────────────────────────────────────────────────────────

function ChatBody({
  chat,
  full,
  draft,
  setDraft,
  onNavigate,
}: {
  chat: Chat;
  full: boolean;
  draft: string;
  setDraft: (v: string) => void;
  onNavigate: () => void;
}) {
  const { t } = useT();
  const listRef = useRef<HTMLDivElement>(null);
  const { messages, busy, status } = chat;
  const noQuota = (status?.remaining ?? 0) <= 0;
  const examples = status?.actions ? [...EXAMPLES, ...ACTION_EXAMPLES] : EXAMPLES;

  // Yangi bo'lak kelganda (va ko'rinish almashganda) pastga aylantiramiz.
  useEffect(() => {
    const el = listRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages, full]);

  const submit = (text = draft) => {
    if (!text.trim() || busy || noQuota) return;
    void chat.send(text);
    setDraft("");
  };

  const composer = (
    <Composer
      chat={chat}
      value={draft}
      onChange={setDraft}
      onSubmit={() => submit()}
      disabled={noQuota}
      compact={!full}
      autoFocus={full}
    />
  );

  const exampleChips = (
    <div className={`flex flex-wrap gap-2 ${full ? "justify-center" : ""}`}>
      {examples.map((ex) => (
        <button
          key={ex.label}
          type="button"
          disabled={busy || noQuota}
          onClick={() => submit(t(ex.label))}
          className="rounded-full border border-border bg-card px-3 py-1.5 text-left text-[12px] transition-colors hover:bg-secondary disabled:opacity-50"
        >
          {t(ex.label)}
        </button>
      ))}
    </div>
  );

  const bubbles = messages.map((m) => <Bubble key={m.key} m={m} chat={chat} onNavigate={onNavigate} />);

  if (full && messages.length === 0) {
    // ChatGPT'ning bo'sh oynasi kabi: o'rtada savol, yozish maydoni va takliflar.
    return (
      <div className="flex min-h-0 flex-1 flex-col items-center justify-center overflow-y-auto px-4 pb-10">
        <div className="w-full max-w-3xl space-y-5">
          <h2 className="text-center text-2xl font-semibold tracking-tight md:text-3xl">{t("Qanday yordam bera olaman?")}</h2>
          {composer}
          {exampleChips}
          <p className="text-center text-[12px] text-muted-foreground">
            {t("Salom! Ruxsatingiz bor bo'limlar bo'yicha savol bering: qarzdorlar, tushum, guruhlar, lidlar, oylik yoki CRM'dan qanday foydalanish.")}
          </p>
        </div>
      </div>
    );
  }

  return (
    <>
      <div ref={listRef} className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
        <div className={full ? "mx-auto w-full max-w-3xl space-y-4 px-4 py-6" : "space-y-3 p-3"}>
          {messages.length === 0 ? (
            <div className="space-y-3">
              <p className="text-[13px] text-muted-foreground">
                {t("Salom! Ruxsatingiz bor bo'limlar bo'yicha savol bering: qarzdorlar, tushum, guruhlar, lidlar, oylik yoki CRM'dan qanday foydalanish.")}
              </p>
              {exampleChips}
            </div>
          ) : (
            bubbles
          )}
        </div>
      </div>
      <div className={full ? "mx-auto w-full max-w-3xl shrink-0 px-4 pb-3" : "shrink-0 border-t border-border p-2"}>
        {composer}
        <div className="mt-1.5 flex items-center justify-between gap-2 px-1 text-[11px] text-muted-foreground">
          <span className="min-w-0 truncate">{t("AI xato qilishi mumkin — muhim raqamlarni sahifadan tekshiring.")}</span>
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

/**
 * Yozish maydoni — ChatGPT'dagi kabi bitta yumaloq quti: matn, ostida model
 * va «Tezlik» tanlovi, o'ngda yuborish / to'xtatish.
 */
function Composer({
  chat,
  value,
  onChange,
  onSubmit,
  disabled,
  compact,
  autoFocus,
}: {
  chat: Chat;
  value: string;
  onChange: (v: string) => void;
  onSubmit: () => void;
  disabled: boolean;
  compact: boolean;
  autoFocus: boolean;
}) {
  const { t } = useT();
  const ref = useRef<HTMLTextAreaElement>(null);
  const { busy } = chat;
  const max = compact ? 120 : 200;

  // Matn ko'paysa quti o'sadi (chegaragacha, keyin ichida aylanadi).
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, max)}px`;
  }, [value, max]);

  useEffect(() => {
    if (autoFocus) ref.current?.focus({ preventScroll: true });
  }, [autoFocus]);

  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      onSubmit();
    }
  };

  return (
    <div className="rounded-3xl border border-border bg-card shadow-sm transition-shadow focus-within:border-primary/40 focus-within:shadow-md">
      <textarea
        ref={ref}
        value={value}
        onChange={(e) => onChange(e.target.value.slice(0, MAX_CHARS))}
        onKeyDown={onKeyDown}
        rows={1}
        maxLength={MAX_CHARS}
        disabled={disabled}
        placeholder={disabled ? t("Bugungi limit tugadi") : t("Savolingizni yozing…")}
        aria-label={t("Savolingizni yozing…")}
        className={`block w-full resize-none bg-transparent px-4 pt-3 focus:outline-none disabled:opacity-60 ${compact ? "text-[13px]" : "text-[15px]"}`}
        style={{ maxHeight: max }}
      />
      <div className="flex items-center gap-2 px-2 pb-2 pt-1">
        {chat.status && (
          <ModelPicker models={chat.status.models} choice={chat.choice} onChange={chat.setChoice} disabled={busy} compact={compact} />
        )}
        <span className="flex-1" />
        {busy ? (
          <button
            type="button"
            onClick={chat.stop}
            title={t("To'xtatish")}
            aria-label={t("To'xtatish")}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-foreground text-background transition-opacity hover:opacity-85"
          >
            <Square className="h-3.5 w-3.5 fill-current" />
          </button>
        ) : (
          <button
            type="button"
            onClick={onSubmit}
            disabled={!value.trim() || disabled}
            title={t("Yuborish")}
            aria-label={t("Yuborish")}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary text-white transition-opacity disabled:opacity-40"
          >
            <ArrowUp className="h-4 w-4" />
          </button>
        )}
      </div>
    </div>
  );
}

function Bubble({ m, chat, onNavigate }: { m: UiMessage; chat: Chat; onNavigate: () => void }) {
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
        {m.actions?.map((a) => <ActionCard key={a.id} a={a} onDecide={chat.decide} onNavigate={onNavigate} />)}
        {m.stopped && <p className="text-[11px] text-muted-foreground">{t("To'xtatildi")}</p>}
        {(m.error || m.cutOff) && (
          <p className="flex items-start gap-1.5 text-[12px] text-rose-600">
            <CircleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            <span>{m.error ? t(m.error) : t("Javob oxirigacha kelmadi. Qayta urinib ko'ring.")}</span>
          </p>
        )}
        {m.error && m.errorDetail && (
          <p className="break-words rounded-md bg-secondary px-2 py-1 font-mono text-[11px] text-muted-foreground">
            {t("Sabab (faqat admin ko'radi)")}: {m.errorDetail}
          </p>
        )}
        {m.via && !m.pending && (
          <p className="text-[10px] text-muted-foreground/80">
            {/* "GPT-6 Sol · Tez" — ro'yxatda bo'lsa nomi, bo'lmasa ID. */}
            {chat.status?.models.find((x) => x.id === m.via?.model)?.name ?? m.via.model}
            {m.via.effort ? ` · ${t(effortLabel(m.via.effort))}` : ""}
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

type Decide = (id: string, op: "confirm" | "cancel") => void;

const ACTION_TITLES: { kind: AiActionKind; label: string; icon: LucideIcon }[] = [
  { kind: "lead", label: "Lid qo'shish", icon: UserPlus },
  { kind: "kirim", label: "Kirim", icon: ArrowDownLeft },
  { kind: "chiqim", label: "Chiqim", icon: ArrowUpRight },
  { kind: "transfer", label: "Boshqa kassaga ko'chirish", icon: ArrowLeftRight },
  { kind: "comment", label: "O'quvchiga izoh", icon: MessageSquarePlus },
  { kind: "task", label: "Topshiriq berish", icon: ClipboardList },
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
  { key: "from_cashbox", label: "Qaysi kassadan" },
  { key: "to_cashbox", label: "Qaysi kassaga" },
  { key: "comment", label: "Izoh matni" },
  { key: "title", label: "Topshiriq" },
  { key: "description", label: "Tavsif" },
  { key: "deadline", label: "Muddat" },
  { key: "priority", label: "Muhimlik" },
  { key: "fine", label: "Bajarilmasa jarima" },
  { key: "link", label: "Havola" },
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
    if (key === "amount" || key === "discount" || key === "fine" || key === "method" || key === "type") return t(value);
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
