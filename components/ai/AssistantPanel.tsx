"use client";

import {
  Fragment,
  memo,
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
  ChevronLeft,
  ChevronRight,
  Circle,
  CircleAlert,
  CircleCheck,
  ClipboardList,
  Copy,
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
  Pencil,
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
import { useLang, useT } from "@/components/shared/Language";
import { MONTHS } from "@/lib/i18n";
import { ASSISTANT_NAME, ASSISTANT_TAG } from "@/lib/ai/brand";
import { effortLabel } from "@/lib/ai/models";
import type { AiActionFieldKey, AiActionKind, AiActionStatus, AiModelOption, AiPlanStep, AiQuestion } from "@/lib/ai/protocol";
import { answerText, clockOf, dateParts, dayKind, needsSeparator, splitRecommended } from "./conversation";
import { refreshScreen } from "./AiScreenRefresh";
import AlertsCard from "./AlertsCard";
import type { AiAlertsApi } from "./useAiAlerts";
import { isInternalHref } from "./aiMarkdown";
import { endGenie, genieDone, playGenie, rectOf, reducedMotion, type Box } from "./genie";
import HistorySidebar from "./HistorySidebar";
import MessageText from "./MessageText";
import ModelPicker from "./ModelPicker";
import MohiraAvatar, { type MohiraMood } from "./MohiraAvatar";
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
// MOHIR KAYFIYATI (09.10.2026, «Robot va interfeys — konsept 01»):
// sarlavha — brend rangidagi tasma (robot, «MohirAI · AI», holat nuqtasi).
// Robot ishga qarab: o'ylaydi / gapiradi; javob xatosiz tugasa yoki amal
// saqlansa bir necha soniya HURSAND (`useJoy`); xato, uzilgan javob,
// saqlanmagan amal, tugagan limit yoki o'chiq yordamchida — HAFA;
// qolgan paytda — odatiy (`moodOf`).
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
/** «Javob tayyor» — javob tugagach yoki amal saqlangach robot shuncha vaqt xursand turadi. */
const JOY_MS = 4500;

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
  alerts,
}: {
  /** Yopilish animatsiyasi tugagach chaqiriladi. */
  onClose: () => void;
  /** Robot tugmasining joyi — oyna shundan chiqadi va shunga qaytib kiradi. */
  origin?: Box | null;
  /** Adminga ogohlantirishlar (12.10.2026, components/ai/AlertsCard.tsx) — faqat admin'da. */
  alerts?: AiAlertsApi;
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
  const joyKey = useJoy(chat.messages);
  const mood = moodOf(chat, ready, joyKey);
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
      <ChatBody chat={chat} full={full} draft={draft} setDraft={setDraft} onNavigate={onNavigate} mood={mood} joyKey={joyKey} />
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
              mood={mood}
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
              mood={mood}
              follow={follow}
              onFollow={toggleFollow}
              onExpand={() => changeView("full")}
              onClose={requestClose}
              pos={pos}
              onMove={setPos}
            />
          )}
          {/* Daraxt ikkala ko'rinishda BIR XIL: kichraytirish/kattalashtirishda suhbat
              qayta qurilmaydi. Avval bu yerda ikki xil daraxt edi — har almashishda
              butun suhbat qaytadan chizilib (uzun suhbatda ~150 ms qotish), har xabar
              «paydo bo'lish» animatsiyasini qaytadan o'ynardi (09.10.2026). */}
          <div className="relative flex min-h-0 flex-1">
            {withHistory && (
              <HistorySidebar
                open={sideOpen}
                items={chat.history.items}
                at={chat.history.at}
                archivedView={chat.history.archived}
                activeId={chat.conversationId}
                busy={busy}
                onOpen={pickConversation}
                onNew={startNewChat}
                onDelete={(id) => void chat.removeConversation(id)}
                onArchive={(id, archived) => void chat.archiveConversation(id, archived)}
                onFilter={chat.setHistoryFilter}
                onDismiss={() => setSideOpen(false)}
              />
            )}
            <div className="flex min-w-0 flex-1 flex-col">
              {alerts && tab !== "speed" && <AlertsCard api={alerts} onNavigate={onNavigate} />}
              {body}
            </div>
          </div>
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
  band,
}: {
  title: string;
  icon: LucideIcon;
  onClick: () => void;
  active?: boolean;
  disabled?: boolean;
  small?: boolean;
  /** To'q sarlavha tasmasi ustida (`.mh-band`) — oq ranglar. */
  band?: boolean;
}) {
  const tone = band
    ? active
      ? "bg-white/20 text-white hover:bg-white/25"
      : "text-white/85 hover:bg-white/15 hover:text-white"
    : active
      ? "bg-primary/10 text-primary hover:bg-primary/15"
      : "text-muted-foreground hover:bg-secondary hover:text-foreground";
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      aria-label={title}
      aria-pressed={active}
      className={`flex shrink-0 items-center justify-center rounded-full transition-colors disabled:opacity-40 ${small ? "h-7 w-7" : "h-8 w-8"} ${tone}`}
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

/** Sarlavha ostidagi yozuv: hozirgi qadam (vosita / reja / yozilmoqda / o'ylayapti) yoki bo'sh. */
function useStepText(chat: Chat): string {
  const { t } = useT();
  const s = stepOf(chat);
  return s === null ? "" : s === "writing" ? t("Javob yozilmoqda…") : s === "thinking" ? t("O'ylayapti…") : "tool" in s ? t(s.tool) : s.plan;
}

function lastAssistant(messages: UiMessage[]): UiMessage | undefined {
  for (let i = messages.length - 1; i >= 0; i--) if (messages[i].role === "assistant") return messages[i];
  return undefined;
}

/** Javob ko'ngilsiz tugadimi: xato, uzilgan oqim yoki saqlanmagan amal. */
function wentWrong(m: UiMessage | undefined): boolean {
  return !!m && (!!m.error || !!m.cutOff || !!m.actions?.some((a) => a.status === "failed"));
}

/**
 * Robotning kayfiyati: ish ketyapti — o'ylaydi / gapiradi; oxirgi javob
 * ko'ngilsiz tugagan, limit tugagan yoki yordamchi ishlamayapti — hafa;
 * javob hozirgina tugagan (`joyKey`) — hursand; qolgan paytda — odatiy.
 */
function moodOf(chat: Chat, ready: boolean, joyKey: string | null): MohiraMood {
  const s = stepOf(chat);
  if (s === "writing") return "talking";
  if (s !== null) return "thinking";
  const { status } = chat;
  if (chat.loadError || (status && (!ready || status.remaining <= 0))) return "sad";
  if (wentWrong(lastAssistant(chat.messages))) return "sad";
  return joyKey ? "happy" : "idle";
}

/**
 * «Javob tayyor» — shu oynada xatosiz tugagan javob (yoki saqlangan amal)
 * xabarining kaliti, JOY_MS davomida; keyin `null`. Tarixdan ochilgan
 * eski javoblar sanalmaydi — faqat ko'z oldida tugaganlari.
 */
function useJoy(messages: UiMessage[]): string | null {
  const [joy, setJoy] = useState<string | null>(null);
  const seen = useRef<{ pending: Set<string>; actions: Map<string, AiActionStatus> } | null>(null);
  const hideTimer = useRef(0);
  useEffect(() => () => window.clearTimeout(hideTimer.current), []);
  useEffect(() => {
    seen.current ??= { pending: new Set(), actions: new Map() };
    const { pending, actions } = seen.current;
    let key: string | null = null;
    for (const m of messages) {
      if (m.role !== "assistant") continue;
      if (m.pending) pending.add(m.key);
      else if (pending.delete(m.key) && !wentWrong(m) && !m.stopped) key = m.key;
      for (const a of m.actions ?? []) {
        const before = actions.get(a.id);
        if (before && before !== a.status && a.status === "done") key = m.key;
        actions.set(a.id, a.status);
      }
    }
    if (!key) return;
    const k = key;
    // Holat effekt ichida darhol emas, navbatda yangilanadi. Taymerlar oqim
    // hodisalarida bekor qilinmaydi — aks holda robot xursandligicha qolib ketardi.
    window.setTimeout(() => setJoy(k), 0);
    window.clearTimeout(hideTimer.current);
    hideTimer.current = window.setTimeout(() => setJoy(null), JOY_MS);
  }, [messages]);
  return joy;
}

/** Holat nuqtasi (konsept: Tayyor · O'ylayapti · Javob tayyor; hafa — qizil). Ustida — bugungi qolgan savollar. */
function StateDot({ chat, mood }: { chat: Chat; mood: MohiraMood }) {
  const { t } = useT();
  const { status } = chat;
  const label =
    mood === "thinking"
      ? t("O'ylayapti…")
      : mood === "talking"
        ? t("Javob yozilmoqda…")
        : mood === "happy"
          ? t("Javob tayyor")
          : mood === "sad"
            ? status && status.remaining <= 0
              ? t("Bugungi limit tugadi")
              : t("Xato")
            : t("Tayyor");
  const title = status ? `${label} · ${t("Bugun yana {n} ta savol", { n: status.remaining })}` : label;
  return <span className="mh-state" data-mood={mood} title={title} role="img" aria-label={title} />;
}

/** Tasmadagi tablar — to'q fonda oq «tabletka» (telefonda tasma ostida oddiy Segmented). */
function BandTabs({ value, onChange }: { value: Tab; onChange: (t: Tab) => void }) {
  const { t } = useT();
  const options = [
    { value: "assistant" as const, label: "Yordamchi", icon: Bot },
    { value: "speed" as const, label: "Tezlik sinovi", icon: Gauge },
  ];
  return (
    <div className="inline-flex items-center gap-0.5 rounded-full bg-white/15 p-0.5">
      {options.map((o) => {
        const active = o.value === value;
        const Icon = o.icon;
        return (
          <button
            key={o.value}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(o.value)}
            className={`inline-flex h-7 items-center gap-1.5 rounded-full px-3 text-[12px] font-medium transition-colors ${
              active ? "bg-white text-primary shadow-sm" : "text-white/85 hover:bg-white/15 hover:text-white"
            }`}
          >
            <Icon className="h-3.5 w-3.5 shrink-0" />
            {t(o.label)}
          </button>
        );
      })}
    </div>
  );
}

function FullHeader({
  chat,
  mood,
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
  mood: MohiraMood;
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
  const { busy } = chat;
  const step = useStepText(chat);
  return (
    <>
      {/* Konseptdagi to'q tasma — sahifa chetidan biroz ichkarida, yumaloq. */}
      <div className="shrink-0 px-2 pt-2 md:px-3 md:pt-3">
        <div className="mh-band mh-band-card flex items-center gap-2.5 rounded-2xl px-2.5 py-2 md:px-3">
          {onSide && (
            <IconButton
              band
              title={sideOpen ? t("Tarixni yopish") : t("Suhbatlar tarixi")}
              icon={sideOpen ? PanelLeftClose : PanelLeftOpen}
              active={sideOpen}
              onClick={onSide}
            />
          )}
          <MohiraAvatar disc gaze mood={mood} className="h-11 w-11" />
          <div className="min-w-0 flex-1 sm:flex-none">
            <div className="flex items-center gap-1.5">
              <h3 className="truncate text-base font-semibold tracking-tight">{ASSISTANT_NAME}</h3>
              <span className="mh-ai-tag">{ASSISTANT_TAG}</span>
            </div>
            <p className="truncate text-[11px] text-white/80">
              {step ? (
                <span className="ai-shimmer font-medium">{step}</span>
              ) : ready ? (
                t("Sizning aqlli yordamchingiz")
              ) : (
                t("Savol bering yoki sayt tezligini o'lchang")
              )}
            </p>
          </div>
          <div className="mx-auto hidden sm:block">
            <BandTabs value={tab} onChange={onTab} />
          </div>
          {ready && <StateDot chat={chat} mood={mood} />}
          <div className="flex shrink-0 items-center gap-0.5">
            {ready && tab === "assistant" && (
              <>
                <IconButton
                  band
                  title={follow ? t("AI ishini ekranda ko'rsatish: yoqilgan") : t("AI ishini ekranda ko'rsatish: o'chirilgan")}
                  icon={MonitorPlay}
                  active={follow}
                  onClick={onFollow}
                />
                {/* Tarix ochiq bo'lsa «Yangi suhbat» o'sha yerda. */}
                {!sideOpen && (
                  <IconButton band title={t("Yangi suhbat")} icon={SquarePen} onClick={onNewChat} disabled={busy || chat.messages.length === 0} />
                )}
                <IconButton band title={t("Kichraytirish")} icon={Minimize2} onClick={onShrink} />
              </>
            )}
            <IconButton band title={t("Yopish")} icon={X} onClick={onClose} />
          </div>
        </div>
      </div>
      <div className="shrink-0 px-3 pt-2 sm:hidden">
        <Segmented
          size="sm"
          value={tab}
          onChange={(v) => onTab(v as Tab)}
          options={[
            { value: "assistant", label: "Yordamchi", icon: Bot },
            { value: "speed", label: "Tezlik sinovi", icon: Gauge },
          ]}
        />
      </div>
    </>
  );
}

function FloatHeader({
  chat,
  mood,
  follow,
  onFollow,
  onExpand,
  onClose,
  pos,
  onMove,
}: {
  chat: Chat;
  mood: MohiraMood;
  follow: boolean;
  onFollow: () => void;
  onExpand: () => void;
  onClose: () => void;
  pos: Pos | null;
  onMove: (p: Pos) => void;
}) {
  const { t } = useT();
  const drag = useRef<{ sx: number; sy: number; origin: Pos } | null>(null);
  const step = useStepText(chat);

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
      className="mh-band flex shrink-0 cursor-grab touch-none select-none items-center gap-2.5 px-3 py-2 active:cursor-grabbing"
    >
      <MohiraAvatar disc gaze mood={mood} className="h-9 w-9" />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <span className="truncate text-[13px] font-semibold">{ASSISTANT_NAME}</span>
          <span className="mh-ai-tag">{ASSISTANT_TAG}</span>
        </div>
        <div className="truncate text-[11px] text-white/80">
          {step ? <span className="ai-shimmer font-medium">{step}</span> : t("Sizning aqlli yordamchingiz")}
        </div>
      </div>
      <StateDot chat={chat} mood={mood} />
      <IconButton
        small
        band
        title={follow ? t("AI ishini ekranda ko'rsatish: yoqilgan") : t("AI ishini ekranda ko'rsatish: o'chirilgan")}
        icon={MonitorPlay}
        active={follow}
        onClick={onFollow}
      />
      <IconButton small band title={t("To'liq ekran")} icon={Maximize2} onClick={onExpand} />
      <IconButton small band title={t("Yopish")} icon={X} onClick={onClose} />
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
  mood,
  joyKey,
}: {
  chat: Chat;
  full: boolean;
  draft: string;
  setDraft: (v: string) => void;
  onNavigate: () => void;
  mood: MohiraMood;
  /** Hozirgina tugagan javob — uning yonidagi robot xursand. */
  joyKey: string | null;
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

  // Tahrirlash va intervyu javobi — barqaror havola (Bubble `memo`): `chat.*`
  // har xabar o'zgarishida yangilanadi, oqim paytida hamma xabar qayta chizilmasin.
  const editRef = useRef(chat.editMessage);
  const sendRef = useRef(chat.send);
  useEffect(() => {
    editRef.current = chat.editMessage;
    sendRef.current = chat.send;
  });
  const onEdit = useCallback((key: string, text: string) => void editRef.current(key, text), []);
  const onAnswer = useCallback((text: string) => void sendRef.current(text), []);
  // Kun yorlig'i («Bugun», «Kecha») — ro'yxat olingan vaqtga nisbatan (render ichida soat o'qilmaydi).
  const now = chat.history.at;

  const bubbles = messages.map((m, i) => (
    <Fragment key={m.key}>
      {/* Suhbat boshlangan vaqt va keyin yozilgan kun/vaqt (11.10.2026). */}
      {m.at && needsSeparator(messages[i - 1]?.at, m.at) && <TimeDivider at={m.at} first={i === 0} now={now} />}
      <Bubble
        m={m}
        models={status?.models}
        decide={chat.decide}
        onNavigate={onNavigate}
        joy={joyKey === m.key}
        last={i === messages.length - 1}
        idle={!busy}
        onEdit={onEdit}
        onAnswer={onAnswer}
      />
    </Fragment>
  ));

  if (opening) {
    return (
      <div className="flex min-h-0 flex-1 items-center justify-center">
        <Spinner size={22} />
      </div>
    );
  }

  if (full && messages.length === 0) {
    // ChatGPT'ning bo'sh oynasi kabi: o'rtada Mohir (konseptdagi to'liq
    // gavda, halqalar ichida, qo'l silkitib salomlashadi), savol, yozish
    // maydoni va takliflar. Markazlash `my-auto` bilan: ekran past bo'lsa
    // (justify-center'dan farqli) tepasi kesilmaydi — aylantirib ko'riladi;
    // past ekranda robot ham kichrayadi.
    return (
      <div className="flex min-h-0 flex-1 flex-col items-center overflow-y-auto px-4 pb-10 pt-4">
        <div className="my-auto w-full max-w-3xl space-y-5">
          <div className="ai-msg-in flex flex-col items-center gap-2 text-center">
            <div className="mh-stage mb-2 h-36 w-[113px] md:h-44 md:w-[138px] [@media(max-height:720px)]:h-28 [@media(max-height:720px)]:w-[88px]">
              <MohiraAvatar variant="full" greet gaze mood={mood} className="relative z-[1] h-full w-full" />
            </div>
            {/* `relative` — halqalar (mutlaq joylashgan) yozuv ustiga tushmasin. */}
            <h2 className="relative text-2xl font-semibold tracking-tight md:text-3xl">{t("Salom, men {name}!", { name: ASSISTANT_NAME })}</h2>
            <p className="relative text-[15px] text-muted-foreground">{t("Qanday yordam bera olaman?")}</p>
          </div>
          {composer}
          {exampleChips}
          <p className="text-center text-[12px] text-muted-foreground">
            {t("Salom! Ruxsatingiz bor bo'limlar bo'yicha savol bering: qarzdorlar, tushum, guruhlar, lidlar, oylik yoki CRM'dan qanday foydalanish.")}
          </p>
          {status && (
            <p className="text-center text-[11px] text-muted-foreground/80">{t("Bugun yana {n} ta savol", { n: status.remaining })}</p>
          )}
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
                <MohiraAvatar disc gaze mood={mood} className="h-10 w-10" />
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
        <div className="mt-1.5 flex items-center gap-2 px-1 text-[11px] text-muted-foreground">
          <span className="min-w-0 flex-1 truncate">{t("AI xato qilishi mumkin — muhim raqamlarni sahifadan tekshiring.")}</span>
          {status && <span className="shrink-0 tabular-nums">{t("Bugun yana {n} ta savol", { n: status.remaining })}</span>}
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

/**
 * Bitta xabar. `memo` — o'zgarmagan xabar qayta chizilmaydi: javob oqimida
 * faqat oxirgisi yangilanadi, ko'rinish almashganda (to'liq ekran ↔ suzuvchi
 * oyna) hech biri. Shu sabab `chat` emas, kerakli bo'laklari uzatiladi
 * (`decide` — barqaror useCallback, `models` — holat bilan bir xil havola).
 */
const Bubble = memo(function Bubble({
  m,
  models,
  decide,
  onNavigate,
  joy,
  last,
  idle,
  onEdit,
  onAnswer,
}: {
  m: UiMessage;
  models: AiModelOption[] | undefined;
  decide: Chat["decide"];
  onNavigate: () => void;
  /** Shu javob hozirgina tugadi — robot xursand. */
  joy: boolean;
  /** Suhbatning oxirgi xabari — yonidagi robot «tirik» (qolganlari harakatsiz). */
  last: boolean;
  /** AI hozir javob yozmayapti — tahrirlash va intervyu javobi mumkin. */
  idle: boolean;
  onEdit: (key: string, text: string) => void;
  onAnswer: (text: string) => void;
}) {
  const { t } = useT();
  const [editing, setEditing] = useState(false);
  if (m.role === "user") {
    return (
      <div className="ai-msg-in ai-msg-user flex flex-col items-end gap-1">
        {editing ? (
          <EditBox
            initial={m.content}
            onCancel={() => setEditing(false)}
            onSave={(text) => {
              setEditing(false);
              if (text.trim() && text.trim() !== m.content) onEdit(m.key, text);
            }}
          />
        ) : (
          <div className="max-w-[85%] whitespace-pre-wrap break-words rounded-2xl rounded-br-md bg-primary px-3 py-2 text-[13px] text-white">
            {m.content}
          </div>
        )}
        {!editing && (
          <div className="ai-msg-tools flex items-center gap-0.5 text-[10px] text-muted-foreground">
            {m.at && <span className="px-1 tabular-nums">{clockOf(m.at)}</span>}
            <CopyButton text={m.content} />
            {idle && (
              <button
                type="button"
                onClick={() => setEditing(true)}
                title={t("Tahrirlash")}
                aria-label={t("Tahrirlash")}
                className="rounded p-1 hover:bg-secondary hover:text-foreground"
              >
                <Pencil className="h-3 w-3" />
              </button>
            )}
          </div>
        )}
      </div>
    );
  }
  const tools = m.tools ?? [];
  const toolRunning = tools.some((x) => x.status === "start");
  // Javob kutilyapti: hali matn yo'q va hech bir vosita ishlamayapti — model o'ylayapti.
  const thinking = !!m.pending && !m.content && !toolRunning;
  // Yozilayotgan javob — o'ylaydi / gapiradi; ko'ngilsiz tugagan — hafa; hozirgina tugagan — hursand.
  const mood: MohiraMood = m.pending
    ? m.content
      ? "talking"
      : "thinking"
    : wentWrong(m)
      ? "sad"
      : joy
        ? "happy"
        : "idle";
  return (
    <div className="ai-msg-in flex gap-2.5">
      <MohiraAvatar disc mood={mood} still={!m.pending && !last} className="mt-0.5 h-8 w-8" />
      <div className="min-w-0 flex-1 space-y-1.5 text-[13px]">
        {m.plan && m.plan.length > 0 && <PlanCard steps={m.plan} live={!!m.pending} />}
        {tools.length > 0 && <WorkLog tools={tools} live={!!m.pending} onNavigate={onNavigate} />}
        {thinking && <Thinking label={t("O'ylayapti…")} />}
        {m.content && <MessageText text={m.content} onNavigate={onNavigate} caret={!!m.pending} />}
        {m.questions && m.questions.length > 0 && (
          <QuestionCard questions={m.questions} active={last && idle && !m.pending} done={!last} onAnswer={onAnswer} />
        )}
        {m.actions?.map((a) => <ActionCard key={a.id} a={a} onDecide={decide} onNavigate={onNavigate} />)}
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
        {!m.pending && (m.content || m.via || m.at) && (
          <div className="ai-msg-tools flex items-center gap-1 text-[10px] text-muted-foreground/80">
            {m.at && <span className="tabular-nums">{clockOf(m.at)}</span>}
            {m.via && (
              <span>
                {m.at ? "· " : ""}
                {/* "GPT-6 Sol · Tez" — ro'yxatda bo'lsa nomi, bo'lmasa ID. */}
                {models?.find((x) => x.id === m.via?.model)?.name ?? m.via.model}
                {m.via.effort ? ` · ${t(effortLabel(m.via.effort))}` : ""}
              </span>
            )}
            {m.content && <CopyButton text={m.content} />}
          </div>
        )}
      </div>
    </div>
  );
});

// ── Vaqt, nusxa, tahrirlash, intervyu (11.10.2026) ─────────────────────
//
// Foydalanuvchi: «yangi chat ochilib yozilsa yuqorida chat boshlangan vaqt
// tursin, 1–2 kundan keyin yozilsa o'sha yozilgan vaqt ko'rinib chat davom
// etsin, copy qilish, edit qilishlar bo'lsin» va «intervyu qilib so'rasin …
// user tanlab javob bersin». Sof qoidalar — components/ai/conversation.ts.

/** Kun ajratgichi: «Suhbat boshlandi · Bugun, 09:44» yoki «11-oktyabr, 14:05». */
function TimeDivider({ at, first, now }: { at: string; first: boolean; now: number }) {
  const { t } = useT();
  const [lang] = useLang();
  const kind = now ? dayKind(at, new Date(now)) : "date";
  const { day, month, year } = dateParts(at);
  const sameYear = !now || new Date(now).getFullYear() === year;
  const name = MONTHS[lang][month] ?? "";
  const date =
    kind === "today"
      ? t("Bugun")
      : kind === "yesterday"
        ? t("Kecha")
        : `${lang === "en" ? `${day} ${name}` : `${day}-${name.toLowerCase()}`}${sameYear ? "" : ` ${year}`}`;
  return (
    <div className="ai-msg-in flex items-center gap-3 py-1 text-[11px] text-muted-foreground" role="separator">
      <span className="h-px flex-1 bg-border" />
      <span className="shrink-0 tabular-nums">
        {first ? `${t("Suhbat boshlandi")} · ` : ""}
        {date}, {clockOf(at)}
      </span>
      <span className="h-px flex-1 bg-border" />
    </div>
  );
}

/** Xabar matnini nusxalash — bir lahza «belgi» ko'rsatadi. */
function CopyButton({ text }: { text: string }) {
  const { t } = useT();
  const [done, setDone] = useState(false);
  useEffect(() => {
    if (!done) return;
    const id = window.setTimeout(() => setDone(false), 1500);
    return () => window.clearTimeout(id);
  }, [done]);
  return (
    <button
      type="button"
      onClick={() => {
        void navigator.clipboard?.writeText(text).then(
          () => setDone(true),
          () => {},
        );
      }}
      title={done ? t("Nusxa olindi") : t("Nusxa olish")}
      aria-label={done ? t("Nusxa olindi") : t("Nusxa olish")}
      className="rounded p-1 hover:bg-secondary hover:text-foreground"
    >
      {done ? <Check className="h-3 w-3 text-emerald-600" /> : <Copy className="h-3 w-3" />}
    </button>
  );
}

/** Savolni joyida tahrirlash: Enter — yuborish, Esc — bekor qilish. */
function EditBox({ initial, onCancel, onSave }: { initial: string; onCancel: () => void; onSave: (text: string) => void }) {
  const { t } = useT();
  const [value, setValue] = useState(initial);
  const ref = useRef<HTMLTextAreaElement>(null);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 220)}px`;
  }, [value]);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.focus({ preventScroll: true });
    el.setSelectionRange(el.value.length, el.value.length);
  }, []);
  return (
    <div className="w-full max-w-[85%] rounded-2xl border border-primary/40 bg-card p-2 shadow-sm">
      <textarea
        ref={ref}
        value={value}
        rows={1}
        maxLength={MAX_CHARS}
        onChange={(e) => setValue(e.target.value.slice(0, MAX_CHARS))}
        onKeyDown={(e) => {
          if (e.key === "Escape") onCancel();
          else if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
            e.preventDefault();
            onSave(value);
          }
        }}
        aria-label={t("Tahrirlash")}
        className="block w-full resize-none bg-transparent px-1.5 py-1 text-[13px] focus:outline-none"
      />
      <div className="mt-1 flex items-center justify-end gap-1.5">
        <span className="mr-auto px-1 text-[10px] text-muted-foreground">{t("Keyingi javoblar yangisi bilan almashadi")}</span>
        <button type="button" onClick={onCancel} className="rounded-lg px-2.5 py-1 text-[12px] text-muted-foreground hover:bg-secondary">
          {t("Bekor qilish")}
        </button>
        <button
          type="button"
          onClick={() => onSave(value)}
          disabled={!value.trim()}
          className="rounded-lg bg-primary px-2.5 py-1 text-[12px] font-medium text-white disabled:opacity-40"
        >
          {t("Yuborish")}
        </button>
      </div>
    </div>
  );
}

/**
 * INTERVYU KARTASI (`ask_user`, Claude'dagi kabi) — savollar BITTALAB.
 *
 * 11.10.2026, foydalanuvchi: «savollar almashib chiqsin, hozir barcha
 * savollar birdaniga ko'rinib chiqyapti». Endi bir vaqtda bitta savol:
 * tepada qadamlar (savol yorlig'i, javob berilgani ✓ — bosib istalganiga
 * o'tiladi), pastda «Orqaga» / «Keyingi». Bitta tanlovli savolda variant
 * bosilsa keyingi JAVOBSIZ savolga o'zi o'tadi; savol bir nechta bo'lsa
 * oxirida «Tekshirish» qadami — hamma javoblar ro'yxati (qatorni bosib
 * o'zgartiriladi) va «Javob berish». Har savolda «Boshqa» — o'zi yozadi.
 *
 * AI yozayotganda — faqat ko'rish uchun. Javob berilgan karta (undan keyin
 * xabar bor) — ixcham ro'yxat: variantlar endi kerak emas, tanlov esa
 * keyingi xabarda turibdi.
 */
function QuestionCard({
  questions,
  active,
  done,
  onAnswer,
}: {
  questions: AiQuestion[];
  /** Hozir javob berish mumkin — oxirgi xabar va AI yozmayapti. */
  active: boolean;
  /** Javob berilgan — bu xabardan keyin suhbat davom etgan. */
  done: boolean;
  onAnswer: (text: string) => void;
}) {
  const { t } = useT();
  const n = questions.length;
  // «Tekshirish» qadamining raqami; bitta savolda bunday qadam yo'q (−1).
  const review = n > 1 ? n : -1;
  const [step, setStep] = useState(0);
  // Qaysi tomonga surilgani — faqat almashtirilgandan keyin (birinchi chizilishda animatsiya yo'q).
  const [dir, setDir] = useState<"next" | "prev" | null>(null);
  const [picked, setPicked] = useState<string[][]>(() => questions.map(() => []));
  const [other, setOther] = useState<string[]>(() => questions.map(() => ""));
  const [sent, setSent] = useState(false);
  const timer = useRef<number | null>(null);
  const boxRef = useRef<HTMLDivElement>(null);
  const shown = useRef(false);
  const disabled = !active || sent;

  const valuesOf = (i: number) => [...(picked[i] ?? []), ...((other[i] ?? "").trim() ? [other[i].trim()] : [])];
  const answered = (i: number) => valuesOf(i).length > 0;
  const ready = questions.every((_, i) => answered(i));

  useEffect(
    () => () => {
      if (timer.current !== null) window.clearTimeout(timer.current);
    },
    [],
  );
  // Savol almashganda karta ko'rinib tursin: yangi savol balandroq bo'lsa
  // tugmalar ro'yxat pastiga tushib qolmasin (ro'yxat o'zi faqat yangi
  // xabarda pastga aylanadi). Birinchi chizilishda — tegilmaydi.
  useEffect(() => {
    if (!shown.current) {
      shown.current = true;
      return;
    }
    boxRef.current?.scrollIntoView({ block: "nearest", behavior: reducedMotion() ? "auto" : "smooth" });
  }, [step]);

  const stopTimer = () => {
    if (timer.current !== null) {
      window.clearTimeout(timer.current);
      timer.current = null;
    }
  };
  const go = (to: number) => {
    stopTimer();
    if (to === step) return;
    setDir(to < step ? "prev" : "next");
    setStep(to);
  };
  // Javob berilgach qayerga: keyingi JAVOBSIZ savol (oldingilari ham —
  // aylanib), hammasiga javob bo'lsa «Tekshirish» (bitta savolda −1).
  const afterAnswer = (qi: number) => {
    for (let k = 1; k < n; k++) {
      const j = (qi + k) % n;
      if (!answered(j)) return j;
    }
    return review;
  };

  const pick = (qi: number, label: string) => {
    if (disabled) return;
    const multi = questions[qi].multiSelect === true;
    setPicked((p) => p.map((arr, i) => (i !== qi ? arr : multi ? (arr.includes(label) ? arr.filter((x) => x !== label) : [...arr, label]) : [label])));
    if (multi) return;
    // Bitta tanlov: yozilgan «Boshqa» bekor bo'ladi va keyingi savolga
    // o'tiladi — tanlov ko'zga ilinib ulgursin deb ozgina kechikib.
    setOther((o) => o.map((v, i) => (i === qi ? "" : v)));
    const to = afterAnswer(qi);
    if (to < 0) return;
    stopTimer();
    timer.current = window.setTimeout(() => {
      timer.current = null;
      setDir(to < qi ? "prev" : "next");
      setStep(to);
    }, 260);
  };
  const typeOther = (qi: number, value: string) => {
    setOther((o) => o.map((v, i) => (i === qi ? value.slice(0, 200) : v)));
    if (!questions[qi].multiSelect && value.trim()) setPicked((p) => p.map((arr, i) => (i === qi ? [] : arr)));
  };
  const submit = () => {
    if (disabled || !ready) return;
    stopTimer();
    setSent(true);
    onAnswer(answerText(questions, questions.map((_, i) => valuesOf(i).map((v) => splitRecommended(v).text))));
  };
  // «Boshqa» da Enter: javob bo'lsa — keyingisiga (bitta savolda — yuboradi).
  const enterOther = (qi: number) => {
    if (!answered(qi)) return;
    if (n === 1) submit();
    else go(afterAnswer(qi));
  };

  // Javob berilgan — ixcham ro'yxat.
  if (done || sent) {
    return (
      <div className="ai-msg-in space-y-1 rounded-xl border border-border bg-card/60 px-3 py-2 text-[12px]">
        {questions.map((q, i) => {
          const vals = valuesOf(i).map((v) => splitRecommended(v).text);
          return (
            <p key={i} className="flex flex-wrap items-baseline gap-x-1.5">
              <span className="tabular-nums text-muted-foreground">{i + 1}.</span>
              <span className="font-medium">{q.header || q.question}</span>
              {vals.length > 0 ? (
                <span className="text-primary">— {vals.join(", ")}</span>
              ) : (
                q.header && <span className="text-muted-foreground">{q.question}</span>
              )}
            </p>
          );
        })}
      </div>
    );
  }

  const q = step >= 0 && step < n ? questions[step] : null;
  const slide = dir === "next" ? "ai-q-next" : dir === "prev" ? "ai-q-prev" : "";
  return (
    <div ref={boxRef} className={`ai-msg-in overflow-hidden rounded-xl border border-primary/30 bg-card ${disabled ? "opacity-70" : ""}`}>
      {n > 1 && (
        <nav aria-label={t("Savollar")} className="flex items-center gap-1 overflow-x-auto border-b border-border/70 px-2 py-1.5">
          {questions.map((qq, i) => {
            const on = step === i;
            const ok = answered(i);
            return (
              <button
                key={i}
                type="button"
                disabled={disabled}
                aria-current={on ? "step" : undefined}
                aria-label={qq.header ? undefined : qq.question}
                onClick={() => go(i)}
                className={`flex min-w-0 shrink-0 items-center gap-1.5 rounded-md px-2 py-1 text-[11px] font-medium transition-colors ${
                  on ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-secondary"
                }`}
              >
                <span
                  aria-hidden
                  className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-[10px] tabular-nums ${
                    ok ? "bg-primary text-white" : on ? "border border-primary" : "border border-border"
                  }`}
                >
                  {ok ? <Check className="h-2.5 w-2.5" /> : i + 1}
                </span>
                {qq.header && <span className="max-w-[120px] truncate">{qq.header}</span>}
              </button>
            );
          })}
          <button
            type="button"
            disabled={disabled || !ready}
            aria-current={step === review ? "step" : undefined}
            onClick={() => go(review)}
            className={`ml-auto flex shrink-0 items-center gap-1 rounded-md px-2 py-1 text-[11px] font-medium transition-colors disabled:opacity-40 ${
              step === review ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-secondary"
            }`}
          >
            <ListChecks className="h-3.5 w-3.5" />
            {t("Tekshirish")}
          </button>
        </nav>
      )}
      <div key={step} className={`p-3 ${slide}`}>
        {q ? (
          <fieldset disabled={disabled} className="space-y-1.5">
            <legend className="mb-1.5 flex flex-wrap items-center gap-2">
              {n === 1 && q.header && (
                <span className="rounded-md bg-primary/10 px-1.5 py-0.5 text-[11px] font-semibold text-primary">{q.header}</span>
              )}
              <span className="text-[13px] font-medium">{q.question}</span>
              {q.multiSelect && <span className="text-[11px] text-muted-foreground">{t("bir nechtasini tanlash mumkin")}</span>}
            </legend>
            <div className="grid gap-1.5">
              {q.options.map((o) => {
                const { text, recommended } = splitRecommended(o.label);
                const on = (picked[step] ?? []).includes(o.label);
                return (
                  <button
                    key={o.label}
                    type="button"
                    role={q.multiSelect ? "checkbox" : "radio"}
                    aria-checked={on}
                    onClick={() => pick(step, o.label)}
                    className={`flex items-start gap-2 rounded-lg border px-2.5 py-1.5 text-left text-[13px] transition-colors ${
                      on ? "border-primary bg-primary/10" : "border-border hover:bg-secondary"
                    }`}
                  >
                    <span
                      aria-hidden
                      className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center border ${q.multiSelect ? "rounded" : "rounded-full"} ${
                        on ? "border-primary bg-primary text-white" : "border-border"
                      }`}
                    >
                      {on && <Check className="h-3 w-3" />}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="font-medium">{text}</span>
                      {recommended && (
                        <span className="ml-1.5 rounded bg-emerald-500/10 px-1 py-px text-[10px] font-semibold text-emerald-700 dark:text-emerald-400">
                          {t("Tavsiya")}
                        </span>
                      )}
                      {o.description && <span className="block text-[11px] text-muted-foreground">{o.description}</span>}
                    </span>
                  </button>
                );
              })}
              <input
                value={other[step] ?? ""}
                onChange={(e) => typeOther(step, e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.nativeEvent.isComposing) {
                    e.preventDefault();
                    enterOther(step);
                  }
                }}
                placeholder={t("Boshqa — o'zingiz yozing")}
                aria-label={t("Boshqa — o'zingiz yozing")}
                className="rounded-lg border border-dashed border-border bg-transparent px-2.5 py-1.5 text-[13px] focus:border-primary focus:outline-none"
              />
            </div>
          </fieldset>
        ) : (
          <div className="space-y-1.5">
            <p className="text-[12px] font-medium text-muted-foreground">{t("Javoblaringizni tekshiring")}</p>
            {questions.map((qq, i) => (
              <button
                key={i}
                type="button"
                disabled={disabled}
                onClick={() => go(i)}
                className="flex w-full items-start gap-2 rounded-lg border border-border px-2.5 py-1.5 text-left text-[13px] transition-colors hover:bg-secondary"
              >
                <span className="min-w-0 flex-1">
                  <span className="block text-[11px] text-muted-foreground">{qq.header || qq.question}</span>
                  <span className="font-medium">{valuesOf(i).map((v) => splitRecommended(v).text).join(", ")}</span>
                </span>
                <Pencil aria-hidden className="mt-1 h-3 w-3 shrink-0 text-muted-foreground" />
              </button>
            ))}
          </div>
        )}
      </div>
      {!disabled && (
        <div className="flex items-center gap-1.5 border-t border-border/70 px-3 py-2">
          {step > 0 && (
            <button
              type="button"
              onClick={() => go(step - 1)}
              className="flex items-center gap-0.5 rounded-lg px-2 py-1 text-[12px] text-muted-foreground transition-colors hover:bg-secondary"
            >
              <ChevronLeft className="h-3.5 w-3.5" />
              {t("Orqaga")}
            </button>
          )}
          {q && n > 1 ? (
            <>
              <span className="ml-auto text-[11px] tabular-nums text-muted-foreground">
                {step + 1}/{n}
              </span>
              <button
                type="button"
                onClick={() => go(step + 1 < n ? step + 1 : review)}
                disabled={!answered(step)}
                className="flex items-center gap-0.5 rounded-lg bg-primary px-3 py-1.5 text-[12px] font-medium text-white transition-opacity disabled:opacity-40"
              >
                {t("Keyingi")}
                <ChevronRight className="h-3.5 w-3.5" />
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={submit}
              disabled={!ready}
              className="ml-auto rounded-lg bg-primary px-3 py-1.5 text-[12px] font-medium text-white transition-opacity disabled:opacity-40"
            >
              {t("Javob berish")}
            </button>
          )}
        </div>
      )}
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
