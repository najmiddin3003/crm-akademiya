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
  type ReactNode,
} from "react";
import { createPortal, flushSync } from "react-dom";
import { useRouter } from "next/navigation";
import {
  ArrowDownLeft,
  ArrowLeftRight,
  ArrowUp,
  ArrowUpRight,
  Bot,
  CalendarCheck,
  Check,
  ChevronDown,
  Circle,
  CircleAlert,
  CircleCheck,
  ClipboardList,
  ExternalLink,
  Gauge,
  GraduationCap,
  ListChecks,
  Maximize2,
  MessageSquarePlus,
  Milestone,
  Minimize2,
  MonitorPlay,
  PanelLeftClose,
  PanelLeftOpen,
  Settings,
  Square,
  SquarePen,
  Trash2,
  UserCog,
  UserPlus,
  Users,
  X,
  type LucideIcon,
} from "lucide-react";
import Button from "@/components/ui/Button";
import Link from "@/components/ui/Link";
import Segmented from "@/components/ui/Segmented";
import Spinner, { SpinnerBlock } from "@/components/ui/Spinner";
import TapTest from "@/components/tezlik/TapTest";
import WhyFast from "@/components/tezlik/WhyFast";
import { useT } from "@/components/shared/Language";
import { ASSISTANT_NAME } from "@/lib/ai/brand";
import { effortLabel } from "@/lib/ai/models";
import type { AiActionFieldKey, AiActionKind, AiActionStatus, AiPlanStep } from "@/lib/ai/protocol";
import { refreshScreen } from "./AiScreenRefresh";
import { isInternalHref } from "./aiMarkdown";
import { endGenie, genieDone, playGenie, rectOf, reducedMotion, type Box } from "./genie";
import HistorySidebar from "./HistorySidebar";
import MessageText from "./MessageText";
import ModelPicker from "./ModelPicker";
import MohiraAvatar, { type MohiraState } from "./MohiraAvatar";
import { useAiChat, type UiAction, type UiMessage, type UiToolChip } from "./useAiChat";

// MOHIRAAI PANELI — AI yordamchi va tezlik sinovi (components/tezlik/
// SpeedFab.tsx ochadi). Ikki tab:
//   • Yordamchi — admin yoqqan va serverda kalit bo'lsa; aks holda sababi
//     yoziladi (adminga — sozlamaga havola) va panel tezlik sinovidan ochiladi;
//   • Tezlik sinovi — avvalgi robot oynasining o'zi.
//
// IKKI KO'RINISH (08.10.2026, ChatGPT oynasi kabi):
//   • TO'LIQ EKRAN — ochilganda. Chapda suhbatlar tarixi (HistorySidebar),
//     yozish maydoni ichida model va «Tezlik» tanlovi (ModelPicker);
//   • SUZUVCHI OYNA — kichik, sarlavhasidan sudrab istalgan joyga qo'yiladi
//     (joyi shu qurilmada eslab qolinadi), orqadagi sahifa ishlayveradi.
// AI ishga kirishsa (vosita ma'lumot olsa, qoralama tuzsa, yozuv saqlansa)
// panel O'ZI kichrayadi va CRM'da o'sha ish sahifasini ochadi — xodim AI
// nima qilayotganini ekranda ko'radi; ish davomida ekran chetlarida rangli
// nur aylanadi. Buni sarlavhadagi «ekranda ko'rsatish» tugmasi bilan
// o'chirish mumkin (tanlov eslab qolinadi).
//
// ANIMATSIYALAR (08.10.2026, 6-bosqich):
//   • ochilish/yopilish — Mac'dagi «genie»: oyna robot tugmasidan voronka
//     bo'lib chiqadi va unga qaytib kiradi (components/ai/genie.ts);
//   • to'liq ekran ↔ suzuvchi oyna — View Transitions: oyna joyidan yangi
//     joyiga silliq o'tadi (brauzer bilmasa — darhol almashadi);
//   • javob kutilayotganda — robot o'ylaydi, «O'ylayapti…» yaltiraydi,
//     yozish maydoni chetida rangli halqa aylanadi, matn oxirida nuqta
//     miltillaydi; «Reja» va «Ish jarayoni» silliq ochilib-yopiladi.
// Hammasi `prefers-reduced-motion` da o'chadi (app/globals.css).
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
const SIDE_KEY = "tizimli:ai-history";
const FLOAT_MARGIN = 12;
/** Bir qadamda bir nechta vosita ishlasa — ekranda faqat oxirgisi ochiladi. */
const SCREEN_DELAY_MS = 350;
/** To'liq ekrandan kichrayish animatsiyasi (`.ai-vt`, ~420 ms) tugagach sahifa ochiladi. */
const MORPH_WAIT_MS = 480;
/** Tarix pardasi telefonda (shu kenglikdan tor ekranda) — ustma-ust ochiladi. */
const NARROW = "(max-width: 767px)";

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

/**
 * Tarix ochiqmi: telefonda doim yopiq (parda suhbatni yopib qo'ymasin),
 * kompyuterda — oxirgi tanlov, bo'lmasa keng ekranda ochiq.
 */
function loadSide(): boolean {
  try {
    if (window.matchMedia(NARROW).matches) return false;
    const saved = localStorage.getItem(SIDE_KEY);
    return saved === null ? window.innerWidth >= 1024 : saved === "1";
  } catch {
    return false;
  }
}

const isNarrow = () => typeof window !== "undefined" && !!window.matchMedia?.(NARROW).matches;

/**
 * To'liq ekran ↔ suzuvchi oyna: View Transitions bilan oyna eski joyidan
 * yangisiga silliq o'tadi (rasmlari almashib). Nom (`view-transition-name`)
 * faqat o'tish paytida beriladi; uslubi — `html.ai-vt` (app/globals.css).
 * Brauzer bilmasa — o'zgarish darhol.
 */
function morph(panel: HTMLElement, update: () => void): ViewTransition | null {
  if (typeof document.startViewTransition !== "function") {
    update();
    return null;
  }
  const root = document.documentElement;
  const end = () => {
    panel.style.removeProperty("view-transition-name");
    root.classList.remove("ai-vt");
  };
  panel.style.setProperty("view-transition-name", "ai-panel");
  root.classList.add("ai-vt");
  try {
    const vt = document.startViewTransition(() => flushSync(update));
    vt.ready.catch(() => {}); // o'tish bekor bo'lsa — xato emas
    vt.finished.then(end, end);
    return vt;
  } catch {
    end();
    update();
    return null;
  }
}

// SSR'da portal chizib bo'lmaydi (components/ui/Modal.tsx bilan bir xil yo'l).
const subscribeNoop = () => () => {};
const useMounted = () => useSyncExternalStore(subscribeNoop, () => true, () => false);

export default function AssistantPanel({
  onClose,
  origin = null,
}: {
  /** Yopilish animatsiyasi tugagach chaqiriladi. */
  onClose: () => void;
  /** Robot tugmasining joyi — oyna shundan chiqadi va shunga qaytib kiradi. */
  origin?: Box | null;
}) {
  const { t } = useT();
  const router = useRouter();
  const mounted = useMounted();
  const [view, setView] = useState<View>("full");
  const [follow, setFollow] = useState(loadFollow);
  const [pos, setPos] = useState<Pos | null>(null);
  const [draft, setDraft] = useState("");
  const [picked, setPicked] = useState<Tab | null>(null);
  const [sideOpen, setSideOpen] = useState(loadSide);

  const stageRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  /** Hozirgi ko'rinish — oqim davomidagi chaqiruvlar uchun (state kechikadi). */
  const viewRef = useRef<View>("full");
  /** Ochilish animatsiyasi ketyapti (yopish bossa — shu joyidan orqaga buriladi). */
  const genieRef = useRef<Animation[] | null>(null);
  const vtRef = useRef<ViewTransition | null>(null);
  const closingRef = useRef(false);
  const onCloseRef = useRef(onClose);
  const originRef = useRef(origin);
  useEffect(() => {
    onCloseRef.current = onClose;
    originRef.current = origin;
  }, [onClose, origin]);

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

  const changeView = useCallback((next: View) => {
    if (viewRef.current === next) return;
    viewRef.current = next;
    const apply = () => {
      // Suzuvchi oynaning joyi o'tishdan OLDIN ma'lum bo'lsin — yangi holat shu joyda suratga olinadi.
      if (next === "float") setPos((p) => p ?? loadFloatPos());
      setView(next);
    };
    const panel = panelRef.current;
    if (!panel || genieRef.current || closingRef.current || reducedMotion()) apply();
    else vtRef.current = morph(panel, apply);
  }, []);

  const showOnScreen = useCallback(
    (href: string, refresh: boolean) => {
      if (!followRef.current || !isInternalHref(href)) return;
      const wait = viewRef.current === "full" ? MORPH_WAIT_MS : SCREEN_DELAY_MS;
      changeView("float");
      if (navTimer.current !== null) window.clearTimeout(navTimer.current);
      navTimer.current = window.setTimeout(() => {
        navTimer.current = null;
        const here = `${window.location.pathname}${window.location.search}`;
        if (here !== href) router.push(href);
        else if (refresh) refreshScreen();
      }, wait);
    },
    [changeView, router],
  );

  const chat = useAiChat({ onScreen: showOnScreen });
  const { status, busy } = chat;
  const ready = !!status && status.enabled && status.configured;
  // Tanlanmagan bo'lsa: yordamchi tayyor bo'lsa — u, aks holda tezlik sinovi.
  const tab: Tab = picked ?? (status && !ready ? "speed" : "assistant");
  const full = view === "full" || tab === "speed" || !ready;
  const withHistory = full && ready && tab === "assistant";

  // OCHILISH — oyna robot tugmasidan chiqadi (genie). Tugma joyi
  // berilmagan bo'lsa yoki harakat kamaytirilgan bo'lsa — animatsiyasiz.
  useLayoutEffect(() => {
    if (!mounted) return;
    const stage = stageRef.current;
    const panel = panelRef.current;
    const icon = originRef.current;
    if (!stage || !panel || !icon || reducedMotion()) return;
    const anims = playGenie(stage, panel, rectOf(panel), icon, "open");
    if (!anims) return;
    genieRef.current = anims;
    void genieDone(anims).then(() => {
      if (genieRef.current !== anims) return; // yopilish uni teskari burib oldi
      genieRef.current = null;
      endGenie(anims, panel);
    });
    return () => {
      if (genieRef.current === anims) genieRef.current = null;
      endGenie(anims, panel);
    };
  }, [mounted]);

  /**
   * YOPILISH — oyna robot tugmasiga qaytib kiradi, animatsiya tugagach
   * `onClose`. Ochilish hali tugamagan bo'lsa — o'sha joyidan orqaga.
   */
  const requestClose = useCallback(() => {
    if (closingRef.current) return;
    closingRef.current = true;
    vtRef.current?.skipTransition();
    const finish = () => onCloseRef.current();
    const running = genieRef.current;
    if (running) {
      genieRef.current = null;
      for (const a of running) a.reverse();
      void genieDone(running).then(finish);
      return;
    }
    const stage = stageRef.current;
    const panel = panelRef.current;
    const icon = originRef.current;
    const anims = stage && panel && icon && !reducedMotion() ? playGenie(stage, panel, rectOf(panel), icon, "close") : null;
    if (anims) void genieDone(anims).then(finish);
    else finish();
  }, []);

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

  const toggleSide = () => {
    const next = !sideOpen;
    setSideOpen(next);
    if (isNarrow()) return; // telefondagi parda eslab qolinmaydi
    try {
      localStorage.setItem(SIDE_KEY, next ? "1" : "0");
    } catch {
      // eslab qolinmasa ham ishlaydi
    }
  };

  // Tarixdan tanlandi / yangi suhbat — telefonda parda yopiladi (suhbat ko'rinsin).
  const pickConversation = (id: string) => {
    void chat.openConversation(id);
    if (isNarrow()) setSideOpen(false);
  };
  const startNewChat = () => {
    chat.newChat();
    setDraft("");
    if (isNarrow()) setSideOpen(false);
  };

  // Havola bosildi (javobdagi yoki kartadagi) — sahifa ochiladi, suhbat kichrayib qoladi.
  const onNavigate = useCallback(() => changeView("float"), [changeView]);

  // Esc — to'liq ekranda panelni yopadi (ichidagi ro'yxatlar Esc'ni o'zi ushlaydi).
  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === "Escape" && full) {
      e.stopPropagation();
      requestClose();
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
            onClick={requestClose}
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
      {/* AI ishlayapti — ekran chetlarida rangli nur (panel kichraygan, sahifa ko'rinib turibdi). */}
      {!full && busy && <WorkingGlow />}
      {/* SAHNA — butun ekran: genie paytida voronka shaklida kesiladi; to'liq ekranda fon ham shu. */}
      <div ref={stageRef} className={`pointer-events-none fixed inset-0 z-[1150] ${full ? "ai-screen" : ""}`}>
        <div
          ref={panelRef}
          role="dialog"
          aria-modal={full}
          aria-label={ASSISTANT_NAME}
          onKeyDown={onKeyDown}
          className={
            full
              ? "ai-screen pointer-events-auto absolute inset-0 flex flex-col"
              : "pointer-events-auto absolute flex flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-2xl"
          }
          style={full ? undefined : pos ? { left: pos.x, top: pos.y, width: floatSize().w, height: floatSize().h } : { visibility: "hidden" }}
        >
          {full ? (
            <FullHeader
              chat={chat}
              tab={tab}
              onTab={setPicked}
              ready={ready}
              follow={follow}
              onFollow={toggleFollow}
              sideOpen={withHistory && sideOpen}
              onSide={withHistory ? toggleSide : null}
              onNewChat={startNewChat}
              onShrink={() => changeView("float")}
              onClose={requestClose}
            />
          ) : (
            <FloatHeader
              chat={chat}
              follow={follow}
              onFollow={toggleFollow}
              onExpand={() => changeView("full")}
              onClose={requestClose}
              pos={pos}
              onMove={setPos}
            />
          )}
          {withHistory ? (
            <div className="relative flex min-h-0 flex-1">
              <HistorySidebar
                open={sideOpen}
                items={chat.history.items}
                at={chat.history.at}
                activeId={chat.conversationId}
                busy={busy}
                onOpen={pickConversation}
                onNew={startNewChat}
                onDelete={(id) => void chat.removeConversation(id)}
                onDismiss={() => setSideOpen(false)}
              />
              <div className="flex min-w-0 flex-1 flex-col">{body}</div>
            </div>
          ) : (
            body
          )}
        </div>
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

/** Hozir nima bo'lyapti — sarlavhada: ishlayotgan vosita yorlig'i, javob yozilyapti yoki o'ylayapti. */
function stepOf(chat: Chat): { tool: string } | { plan: string } | "writing" | "thinking" | null {
  const last = chat.messages[chat.messages.length - 1];
  if (!chat.busy || !last || last.role !== "assistant") return null;
  const running = [...(last.tools ?? [])].reverse().find((x) => x.status === "start");
  if (running) return { tool: running.label };
  // Reja bo'lsa — hozirgi qadam (model yozgan matn, tarjima qilinmaydi).
  const active = last.plan?.find((s) => s.status === "active");
  if (active) return { plan: active.title };
  return last.content ? "writing" : "thinking";
}

/** Robotning holati: javob yozilyapti — gapiradi, boshqa ish — o'ylaydi. */
function moodOf(chat: Chat): MohiraState {
  const s = stepOf(chat);
  return s === null ? "idle" : s === "writing" ? "talking" : "thinking";
}

function FullHeader({
  chat,
  tab,
  onTab,
  ready,
  follow,
  onFollow,
  sideOpen,
  onSide,
  onNewChat,
  onShrink,
  onClose,
}: {
  chat: Chat;
  tab: Tab;
  onTab: (t: Tab) => void;
  ready: boolean;
  follow: boolean;
  onFollow: () => void;
  sideOpen: boolean;
  /** Tarixni ochish/yopish — faqat yordamchi tabida. */
  onSide: (() => void) | null;
  onNewChat: () => void;
  onShrink: () => void;
  onClose: () => void;
}) {
  const { t } = useT();
  const { status, busy } = chat;
  const remaining = status && ready ? status.remaining : null;
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
      <div className="flex shrink-0 items-center gap-2.5 border-b border-border/70 px-3 py-2 md:px-4">
        {onSide && (
          <IconButton
            title={sideOpen ? t("Tarixni yopish") : t("Suhbatlar tarixi")}
            icon={sideOpen ? PanelLeftClose : PanelLeftOpen}
            active={sideOpen}
            onClick={onSide}
          />
        )}
        <MohiraAvatar className="h-10 w-10 shrink-0" state={moodOf(chat)} />
        <div className="min-w-0 flex-1 sm:flex-none">
          <h3 className="truncate text-base font-semibold tracking-tight">{ASSISTANT_NAME}</h3>
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
              {/* Tarix ochiq bo'lsa «Yangi suhbat» o'sha yerda. */}
              {!sideOpen && (
                <IconButton title={t("Yangi suhbat")} icon={SquarePen} onClick={onNewChat} disabled={busy || chat.messages.length === 0} />
              )}
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
  const step =
    s === null ? "" : s === "writing" ? t("Javob yozilmoqda…") : s === "thinking" ? t("O'ylayapti…") : "tool" in s ? t(s.tool) : s.plan;

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
      <MohiraAvatar className="h-8 w-8 shrink-0" state={moodOf(chat)} />
      <div className="min-w-0 flex-1">
        <div className="truncate text-[13px] font-semibold">{ASSISTANT_NAME}</div>
        <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
          {step ? (
            <span className="ai-shimmer truncate font-medium">{step}</span>
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

/** Ekran chetlari bo'ylab aylanuvchi rangli nur — AI ishlayotganda (Siri/Gemini kabi). */
function WorkingGlow() {
  return (
    <div aria-hidden className="ai-glow pointer-events-none fixed inset-0 z-[1149]">
      <span className="ai-glow-edge ai-glow-t" />
      <span className="ai-glow-edge ai-glow-r" />
      <span className="ai-glow-edge ai-glow-b" />
      <span className="ai-glow-edge ai-glow-l" />
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

/**
 * Silliq ochilib-yopiladigan qism (akkordeon): balandlik `grid-template-rows`
 * 0fr ↔ 1fr bilan o'zgaradi — o'lchash shart emas. Yopiq qism `inert`.
 */
function Collapse({ open, children }: { open: boolean; children: ReactNode }) {
  return (
    <div className="ai-collapse" data-open={open ? "" : undefined} inert={!open}>
      <div>{children}</div>
    </div>
  );
}

/** «O'ylayapti…» — sakrovchi nuqtalar va yaltiroq yozuv (AI saytlaridagi kabi). */
function Thinking({ label }: { label: string }) {
  return (
    <span className="inline-flex items-center gap-2 py-0.5" role="status">
      <span className="ai-dots" aria-hidden>
        <i />
        <i />
        <i />
      </span>
      <span className="ai-shimmer font-medium">{label}</span>
    </span>
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
  const { messages, busy, status, opening } = chat;
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
      {examples.map((ex, i) => (
        <button
          key={ex.label}
          type="button"
          disabled={busy || noQuota}
          onClick={() => submit(t(ex.label))}
          style={{ animationDelay: `${120 + i * 50}ms` }}
          className="ai-msg-in rounded-full border border-border bg-card px-3 py-1.5 text-left text-[12px] transition-colors hover:bg-secondary disabled:opacity-50"
        >
          {t(ex.label)}
        </button>
      ))}
    </div>
  );

  const bubbles = messages.map((m) => <Bubble key={m.key} m={m} chat={chat} onNavigate={onNavigate} />);

  if (opening) {
    return (
      <div className="flex min-h-0 flex-1 items-center justify-center">
        <Spinner size={22} />
      </div>
    );
  }

  if (full && messages.length === 0) {
    // ChatGPT'ning bo'sh oynasi kabi: o'rtada Mohira, savol, yozish maydoni va takliflar.
    return (
      <div className="flex min-h-0 flex-1 flex-col items-center justify-center overflow-y-auto px-4 pb-10">
        <div className="w-full max-w-3xl space-y-5">
          <div className="ai-msg-in flex flex-col items-center gap-2 text-center">
            <div className="ai-hero relative h-24 w-24">
              <MohiraAvatar className="relative h-24 w-24" />
            </div>
            <h2 className="text-2xl font-semibold tracking-tight md:text-3xl">{t("Salom, men {name}!", { name: ASSISTANT_NAME })}</h2>
            <p className="text-[15px] text-muted-foreground">{t("Qanday yordam bera olaman?")}</p>
          </div>
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
            <div className="ai-msg-in space-y-3">
              <div className="flex items-center gap-2.5">
                <MohiraAvatar className="h-10 w-10 shrink-0" />
                <p className="text-[13px] font-medium">{t("Salom, men {name}!", { name: ASSISTANT_NAME })}</p>
              </div>
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
 * va «Tezlik» tanlovi, o'ngda yuborish / to'xtatish. AI ishlayotganda
 * chetida rangli halqa aylanadi (`.ai-composer[data-busy]`).
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
    <div data-busy={busy ? "" : undefined} className="ai-composer">
      <div className="ai-composer-box rounded-3xl border border-border bg-card shadow-sm transition-shadow focus-within:border-primary/40 focus-within:shadow-md">
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
              className="ai-stop flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-foreground text-background transition-opacity hover:opacity-85"
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
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary text-white transition-[opacity,transform] active:scale-90 disabled:opacity-40"
            >
              <ArrowUp className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function Bubble({ m, chat, onNavigate }: { m: UiMessage; chat: Chat; onNavigate: () => void }) {
  const { t } = useT();
  if (m.role === "user") {
    return (
      <div className="ai-msg-in ai-msg-user flex justify-end">
        <div className="max-w-[85%] whitespace-pre-wrap break-words rounded-2xl rounded-br-md bg-primary px-3 py-2 text-[13px] text-white">
          {m.content}
        </div>
      </div>
    );
  }
  const tools = m.tools ?? [];
  const toolRunning = tools.some((x) => x.status === "start");
  // Javob kutilyapti: hali matn yo'q va hech bir vosita ishlamayapti — model o'ylayapti.
  const thinking = !!m.pending && !m.content && !toolRunning;
  const mood: MohiraState = !m.pending ? "idle" : m.content ? "talking" : "thinking";
  return (
    <div className="ai-msg-in flex gap-2.5">
      <MohiraAvatar className="mt-0.5 h-7 w-7 shrink-0" state={mood} still={!m.pending} />
      <div className="min-w-0 flex-1 space-y-1.5 text-[13px]">
        {m.plan && m.plan.length > 0 && <PlanCard steps={m.plan} live={!!m.pending} />}
        {tools.length > 0 && <WorkLog tools={tools} live={!!m.pending} onNavigate={onNavigate} />}
        {thinking && <Thinking label={t("O'ylayapti…")} />}
        {m.content && <MessageText text={m.content} onNavigate={onNavigate} caret={!!m.pending} />}
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

// ── Reja va ish jarayoni (5-bosqich, Cowork kabi) ───────────────────
//
// Xodim AI nima qilayotganini ko'rib turadi: model yozgan reja (belgilanadigan
// ro'yxat) va har vosita — bitta qadam (holat, natija yozuvi, sahifa
// havolasi). Ikkalasi ham akkordeon: sarlavhasi bosilsa silliq yig'iladi /
// ochiladi; «Ish jarayoni» javob tugagach o'zi yig'iladi.

/** `update_plan` rejasi. Qadam matnlari — model yozgan (xodim tilida), tarjima qilinmaydi. */
function PlanCard({ steps, live }: { steps: AiPlanStep[]; live: boolean }) {
  const { t } = useT();
  const [open, setOpen] = useState(true);
  const done = steps.filter((s) => s.status === "done").length;
  return (
    <div className="ai-msg-in rounded-xl border border-border bg-card/70 px-3 py-2">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground transition-colors hover:text-foreground"
      >
        <span className="inline-flex items-center gap-1.5">
          <ListChecks className="h-3.5 w-3.5" />
          {t("Reja")}
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="tabular-nums">
            {done}/{steps.length}
          </span>
          <ChevronDown className={`h-3.5 w-3.5 transition-transform duration-300 ${open ? "rotate-180" : ""}`} />
        </span>
      </button>
      <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-secondary">
        <div
          className="h-full rounded-full bg-primary transition-[width] duration-500 ease-out"
          style={{ width: `${steps.length ? Math.round((done / steps.length) * 100) : 0}%` }}
        />
      </div>
      <Collapse open={open}>
        <ol className="space-y-1 pt-2">
          {steps.map((s, i) => (
            <li key={i} className="flex items-start gap-2 text-[12px]">
              <span className="mt-0.5 flex h-3.5 w-3.5 shrink-0 items-center justify-center">
                {s.status === "done" ? (
                  <CircleCheck className="ai-pop h-3.5 w-3.5 text-emerald-600" />
                ) : s.status === "active" && live ? (
                  <Spinner size={12} />
                ) : (
                  <Circle className="h-3.5 w-3.5 text-muted-foreground/50" />
                )}
              </span>
              <span
                className={
                  s.status === "done"
                    ? "text-muted-foreground"
                    : s.status === "active" && live
                      ? "ai-shimmer font-medium"
                      : s.status === "active"
                        ? "font-medium"
                        : ""
                }
              >
                {s.title}
              </span>
            </li>
          ))}
        </ol>
      </Collapse>
    </div>
  );
}

/**
 * Ish jarayoni — har vosita bitta qadam. Javob kelayotganda ochiq, tugagach
 * o'zi silliq yig'iladi (xodim o'zi ochib-yopgan bo'lsa — tanlovi qoladi).
 */
function WorkLog({ tools, live, onNavigate }: { tools: UiToolChip[]; live: boolean; onNavigate: () => void }) {
  const { t } = useT();
  const [picked, setPicked] = useState<boolean | null>(null);
  const open = picked ?? live;
  const errors = tools.filter((x) => x.status === "error").length;
  return (
    <div>
      <button
        type="button"
        onClick={() => setPicked(!open)}
        aria-expanded={open}
        className="inline-flex max-w-full items-center gap-1.5 rounded-full bg-secondary/70 px-2.5 py-1 text-[11px] text-muted-foreground transition-colors hover:text-foreground"
      >
        {live ? <Spinner size={11} /> : <ListChecks className="h-3.5 w-3.5 shrink-0" />}
        <span className={`truncate ${live ? "ai-shimmer font-medium" : ""}`}>
          {live ? t("Ish jarayoni") : t("{n} ta qadam bajarildi", { n: tools.length })}
        </span>
        {errors > 0 && <span className="shrink-0 text-rose-600">· {t("{n} ta xato", { n: errors })}</span>}
        <ChevronDown className={`h-3 w-3 shrink-0 transition-transform duration-300 ${open ? "rotate-180" : ""}`} />
      </button>
      <Collapse open={open}>
        <div className="mt-1.5 space-y-1.5 rounded-xl border border-border/70 bg-secondary/30 px-2.5 py-2">
          {tools.map((x) => (
            <div key={x.id} className="ai-step-in flex items-start gap-2 text-[12px]">
              <span className="mt-0.5 flex h-3.5 w-3.5 shrink-0 items-center justify-center">
                {x.status === "start" ? (
                  <Spinner size={12} />
                ) : x.status === "error" ? (
                  <CircleAlert className="ai-pop h-3.5 w-3.5 text-rose-500" />
                ) : (
                  <Check className="ai-pop h-3.5 w-3.5 text-emerald-600" />
                )}
              </span>
              <div className="min-w-0 flex-1">
                <div className={x.status === "error" ? "text-rose-600" : x.status === "start" ? "ai-shimmer font-medium" : ""}>{t(x.label)}</div>
                {x.note && <div className="text-[11px] text-muted-foreground">{x.note}</div>}
              </div>
              {x.href && isInternalHref(x.href) && (
                <Link href={x.href} onClick={onNavigate} title={t("Sahifani ochish")} className="mt-0.5 shrink-0 text-muted-foreground hover:text-primary">
                  <ExternalLink className="h-3.5 w-3.5" />
                </Link>
              )}
            </div>
          ))}
        </div>
      </Collapse>
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
  { kind: "pupil", label: "Yangi o'quvchi", icon: GraduationCap },
  { kind: "membership", label: "Guruh a'zoligi", icon: Users },
  { kind: "attendance", label: "Davomat", icon: CalendarCheck },
  { kind: "status", label: "O'quvchi holati", icon: UserCog },
  { kind: "stage", label: "Lid bosqichi", icon: Milestone },
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
  { key: "phone", label: "Telefon" },
  { key: "birth_date", label: "Tug'ilgan sana" },
  { key: "category", label: "Kategoriya" },
  { key: "source", label: "Manba" },
  { key: "joined_at", label: "Darslar boshlanadi" },
  { key: "op", label: "Amal" },
  { key: "date", label: "Sana" },
  { key: "marks", label: "Belgilar" },
  { key: "summary", label: "Jami" },
  { key: "status", label: "Holat" },
  { key: "reason", label: "Sabab" },
  { key: "lead", label: "Lid" },
  { key: "stage", label: "Bosqich" },
  { key: "trial", label: "Sinov darsi" },
  { key: "effect", label: "Natija" },
  { key: "warning", label: "Diqqat" },
];

const STATUS_LABELS: { status: AiActionStatus; label: string; cls: string }[] = [
  { status: "draft", label: "Tasdiq kutmoqda", cls: "bg-amber-100 text-amber-700" },
  { status: "executing", label: "Saqlanmoqda…", cls: "bg-secondary text-muted-foreground" },
  { status: "done", label: "Saqlandi", cls: "bg-emerald-100 text-emerald-700" },
  { status: "failed", label: "Saqlanmadi", cls: "bg-rose-100 text-rose-600" },
  { status: "cancelled", label: "Bekor qilindi", cls: "bg-secondary text-muted-foreground" },
  { status: "expired", label: "Eskirgan", cls: "bg-secondary text-muted-foreground" },
];

/** Xodim qoralamani o'zgartirdi — eskisi yangisi bilan almashtirilgan (status `cancelled` + `replacedBy`). */
const REPLACED_BADGE = { label: "Almashtirildi", cls: "bg-secondary text-muted-foreground" };

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
  const badge = status === "cancelled" && a.replacedBy ? REPLACED_BADGE : (STATUS_LABELS.find((x) => x.status === status) ?? STATUS_LABELS[0]);
  const Icon = meta.icon;

  const shown = (key: AiActionFieldKey, value: string): string => {
    if (key === "month" && /^\d{4}-\d{2}$/.test(value)) {
      const [y, m] = value.split("-").map(Number);
      return `${months[m - 1] ?? value} ${y}`;
    }
    if (key === "days") return value.split(", ").map((d) => t(d)).join(", ");
    // Summalar ("{n} so'm"), to'lov turi, tranzaksiya turi — lug'atda bo'lsa o'giriladi, bo'lmasa o'z holicha.
    // Amal nomi va oqibati (5-bosqich) ham — o'zgarmas matn bo'lsa lug'atdan.
    if (key === "amount" || key === "discount" || key === "fine" || key === "method" || key === "type" || key === "op" || key === "effect" || key === "warning") {
      return t(value);
    }
    return value;
  };

  return (
    <div className="ai-msg-in rounded-xl border border-border bg-card p-3">
      <div className="mb-2 flex items-center gap-2">
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <Icon className="h-4 w-4" />
        </span>
        <span className="min-w-0 flex-1 truncate text-[13px] font-semibold">{t(meta.label)}</span>
        <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium ${badge.cls}`}>{t(badge.label)}</span>
      </div>

      <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-[12px]">
        {/* Kalit + tartib: ogohlantirish (`warning`) bir kartada bir nechta bo'lishi mumkin. */}
        {a.fields.map((f, i) => (
          <Fragment key={`${f.key}-${i}`}>
            <dt className={f.key === "warning" ? "font-medium text-rose-600" : "text-muted-foreground"}>
              {t(FIELD_LABELS.find((x) => x.key === f.key)?.label ?? f.key)}
            </dt>
            <dd className={`min-w-0 whitespace-pre-line break-words font-medium${f.key === "warning" ? " text-rose-600" : ""}`}>
              {shown(f.key, f.value)}
            </dd>
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
          <Check className="ai-pop h-3.5 w-3.5 shrink-0" />
          {/* Yozuv raqami ("#708") o'zicha qoladi; "guruhga qo'shildi" kabi so'zlar lug'atda bo'lsa o'giriladi. */}
          <span>{t("Saqlandi: {ref}", { ref: t(a.resultText ?? "") })}</span>
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
