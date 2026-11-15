"use client";

// Onest — dizayn shrifti (qobiqsiz sahifa — o'zi yuklaydi, AppShellV2 dagidek).
import "@fontsource-variable/onest/wght.css";
import { useCallback, useState, type ComponentType } from "react";
import {
  CalendarDays,
  ChartColumn,
  Check,
  ChevronDown,
  Coins,
  Contrast,
  House,
  RotateCcw,
  Sun,
  Moon,
  UserRound,
  Wallet,
  type LucideProps,
} from "lucide-react";
import { useT } from "@/components/shared/Language";
import { usePopover } from "@/components/v2/shell/usePopover";
import type { StudentMe } from "@/components/student-web/types";
import { CENTER_SHORT } from "@/lib/center";
import AsosiyTab from "./AsosiyTab";
import DarslarTab from "./DarslarTab";
import NatijalarTab from "./NatijalarTab";
import TangaTab from "./TangaTab";
import TolovlarTab from "./TolovlarTab";
import ProfileDialogV2 from "./ProfileDialogV2";
import { initials, type CabinetTab, type CabinetTabProps } from "./bits";
import { chooseStudentTheme, useHtmlDark } from "./studentPrefs";

// O'QUVCHI KABINETI — YANGI KO'RINISH (v2, 28-qism; rasmlar 55–58).
//
// Telegram Mini App ichida ochiladi, ya'ni asosan TELEFON: 768 px dan tor
// ekranda tablar PASTKI panelda (bosh barmoq yetadigan joyda), kengida —
// yuqori paneldagi qatorda (rasmdagidek). Ma'lumot bitta so'rovdan
// (/api/student-web/me → `cabinet`), tablar o'rtasida qayta yuklanmaydi.
//
// RASMDAN FARQLAR (design/v2/SAVOLLAR.md, 28-qism): «Namuna» yorlig'i,
// qo'ng'iroqcha (bildirishnomalar) va «Taklif qilish» kartasi YO'Q — tizimda
// ularning manbasi yo'q. Ism menyusida rasmda ko'rinmagan bandlar bor:
// «Mening ma'lumotlarim» (eski Profil va Manzil tablari o'rniga), mavzu va
// «Eski ko'rinish».

type Icon = ComponentType<LucideProps>;

const TABS: { key: CabinetTab; label: string; icon: Icon }[] = [
  { key: "asosiy", label: "Asosiy", icon: House },
  { key: "darslar", label: "Darslar", icon: CalendarDays },
  { key: "tolovlar", label: "To'lovlar", icon: Wallet },
  { key: "natijalar", label: "Natijalar", icon: ChartColumn },
  { key: "tanga", label: "Tanga", icon: Coins },
];

const TAB_VIEW: Record<CabinetTab, ComponentType<CabinetTabProps>> = {
  asosiy: AsosiyTab,
  darslar: DarslarTab,
  tolovlar: TolovlarTab,
  natijalar: NatijalarTab,
  tanga: TangaTab,
};

/** Tab ikonkasi; qarz bo'lsa «To'lovlar» ustida qizil nuqta. */
function TabIcon({ icon: I, dot, className }: { icon: Icon; dot: boolean; className: string }) {
  return (
    <span className="relative inline-flex">
      <I className={className} strokeWidth={1.75} aria-hidden />
      {dot ? <span aria-hidden className="absolute -right-1 -top-0.5 size-2 rounded-full bg-v2-danger ring-2 ring-v2-surface" /> : null}
    </span>
  );
}

// ── Ism menyusi ──────────────────────────────────────────────────────

const ROW =
  "flex w-full items-center gap-3 rounded-v2-md px-2.5 py-2 text-left text-v2-body text-v2-text transition-colors hover:bg-v2-hover focus-visible:bg-v2-hover focus-visible:outline-none";
const ICON = "size-4 shrink-0 text-v2-text-2";

function AccountMenu({ me, onProfile, onClassic }: { me: StudentMe; onProfile: () => void; onClassic: () => void }) {
  const { t } = useT();
  const { open, ref, toggle, close } = usePopover();
  const isDark = useHtmlDark();
  const p = me.profile;
  const ini = initials(p.fullName);
  const roleLabel = p.role === "parent" ? t("Ota-ona") : t("O'quvchi");
  const kids = p.kids ?? [];

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={toggle}
        aria-haspopup="menu"
        aria-expanded={open}
        title={p.fullName}
        className={`flex h-10 items-center gap-2 rounded-v2-full border border-v2-border pl-1 pr-2 transition-colors hover:bg-v2-surface-2 focus-visible:outline-none focus-visible:shadow-v2-focus ${open ? "bg-v2-surface-2" : "bg-v2-surface"}`}
      >
        <span className="flex size-8 shrink-0 items-center justify-center rounded-v2-full bg-v2-brand-bg text-v2-caption font-semibold text-v2-brand-text">{ini}</span>
        <span className="hidden max-w-[150px] truncate text-v2-body font-semibold text-v2-text lg:block">{p.fullName}</span>
        <ChevronDown className={`size-4 shrink-0 text-v2-text-3 transition-transform ${open ? "rotate-180" : ""}`} strokeWidth={1.75} aria-hidden />
      </button>

      {open ? (
        <div
          role="menu"
          aria-label={p.fullName}
          className="absolute right-0 top-full z-50 mt-2 w-72 overflow-hidden rounded-v2-lg border border-v2-border bg-v2-surface shadow-v2-md max-sm:fixed max-sm:inset-x-3 max-sm:top-[3.75rem] max-sm:mt-0 max-sm:w-auto"
        >
          <div className="flex items-center gap-3 border-b border-v2-border p-3">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-v2-full bg-v2-brand text-v2-body font-semibold text-v2-on-brand">{ini}</span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-v2-body font-semibold text-v2-text" title={p.fullName}>
                {p.fullName}
              </span>
              <span className="block truncate text-v2-caption text-v2-text-3">{[roleLabel, p.branch].filter(Boolean).join(" · ")}</span>
            </span>
          </div>

          {kids.length > 1 ? (
            <div className="border-b border-v2-border p-1.5">
              <div className="px-2.5 pb-1 pt-1 text-v2-caption text-v2-text-3">{t("Farzandlar")}</div>
              {kids.map((k) => (
                <div key={k.id} className="flex items-center gap-3 px-2.5 py-1.5 text-v2-body text-v2-text">
                  <span className="flex size-6 shrink-0 items-center justify-center rounded-v2-full bg-v2-surface-2 text-[10px] font-semibold text-v2-text-2">
                    {initials(k.name)}
                  </span>
                  <span className="min-w-0 flex-1 truncate">{k.name}</span>
                  {k.id === p.id ? <Check className="size-4 shrink-0 text-v2-brand-text" strokeWidth={2} aria-label={t("Hozir ko'rilmoqda")} /> : null}
                </div>
              ))}
              <p className="px-2.5 pb-1.5 pt-1 text-v2-caption font-normal text-v2-text-3">
                {t("Boshqa farzandni ko'rish uchun botda «Boshqa profil» tugmasini bosing va kabinetni qayta oching.")}
              </p>
            </div>
          ) : null}

          <div className="border-b border-v2-border p-1.5">
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                close();
                onProfile();
              }}
              className={ROW}
            >
              <UserRound className={ICON} strokeWidth={1.75} />
              {t("Mening ma'lumotlarim")}
            </button>
            <div className="flex items-center gap-3 px-2.5 py-1.5 text-v2-body text-v2-text">
              <Contrast className={ICON} strokeWidth={1.75} />
              <span className="min-w-0 flex-1">{t("Mavzu")}</span>
              <span role="group" aria-label={t("Mavzu")} className="flex gap-0.5 rounded-v2-md border border-v2-border bg-v2-surface-2 p-0.5">
                {[
                  { dark: false, label: t("Yorug'"), I: Sun },
                  { dark: true, label: t("Qorong'i"), I: Moon },
                ].map(({ dark, label, I }) => (
                  <button
                    key={label}
                    type="button"
                    onClick={() => chooseStudentTheme(dark ? "dark" : "light")}
                    aria-pressed={isDark === dark}
                    title={label}
                    aria-label={label}
                    className={`inline-flex size-7 items-center justify-center rounded-[6px] transition-colors ${
                      isDark === dark ? "bg-v2-surface text-v2-text shadow-v2-sm" : "text-v2-text-3 hover:text-v2-text"
                    }`}
                  >
                    <I className="size-4" strokeWidth={1.75} />
                  </button>
                ))}
              </span>
            </div>
          </div>

          <div className="p-1.5">
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                close();
                onClassic();
              }}
              className={ROW}
            >
              <RotateCcw className={ICON} strokeWidth={1.75} />
              {t("Eski ko'rinish")}
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

// ── Qobiq ────────────────────────────────────────────────────────────

export default function CabinetV2({
  me,
  initData,
  onClassic,
  initialTab = "asosiy",
}: {
  me: StudentMe;
  initData: string;
  onClassic: () => void;
  initialTab?: CabinetTab;
}) {
  const { t } = useT();
  const [tab, setTab] = useState<CabinetTab>(initialTab);
  const [profileOpen, setProfileOpen] = useState(false);
  const cab = me.cabinet!;
  const hasDebt = cab.debt.total > 0;

  const go = useCallback((next: CabinetTab) => {
    setTab(next);
    window.scrollTo({ top: 0 });
  }, []);

  const View = TAB_VIEW[tab];
  const brandLetter = (CENTER_SHORT.trim().charAt(0) || "T").toUpperCase();

  return (
    <div data-ui="v2" className="min-h-dvh bg-v2-bg font-v2 text-v2-body text-v2-text">
      {/* YUQORI PANEL */}
      <header className="sticky top-0 z-30 border-b border-v2-border bg-v2-surface">
        <div className="mx-auto flex h-14 w-full max-w-[1120px] items-center gap-3 px-4 sm:px-6 md:h-16">
          <div className="flex min-w-0 shrink-0 items-center gap-2.5">
            <span className="flex size-8 shrink-0 items-center justify-center rounded-v2-md bg-v2-brand text-v2-body font-semibold text-v2-on-brand" aria-hidden>
              {brandLetter}
            </span>
            <span className="min-w-0 md:hidden lg:block">
              <span className="block truncate text-v2-body font-semibold leading-tight text-v2-text">{CENTER_SHORT}</span>
              <span className="block truncate text-v2-caption font-normal text-v2-text-3">{t("O'quvchi kabineti")}</span>
            </span>
          </div>

          <nav aria-label={t("Bo'limlar")} className="ml-2 hidden items-center gap-1 md:flex lg:ml-6">
            {TABS.map((tb) => {
              const active = tb.key === tab;
              return (
                <button
                  key={tb.key}
                  type="button"
                  onClick={() => go(tb.key)}
                  aria-current={active ? "page" : undefined}
                  className={`inline-flex h-9 items-center gap-2 rounded-v2-md px-3 text-v2-body font-medium transition-colors focus-visible:outline-none focus-visible:shadow-v2-focus ${
                    active ? "bg-v2-brand-bg text-v2-brand-text" : "text-v2-text-2 hover:bg-v2-surface-2 hover:text-v2-text"
                  }`}
                >
                  <TabIcon icon={tb.icon} dot={tb.key === "tolovlar" && hasDebt} className="size-4" />
                  {t(tb.label)}
                </button>
              );
            })}
          </nav>

          <div className="ml-auto">
            <AccountMenu me={me} onProfile={() => setProfileOpen(true)} onClassic={onClassic} />
          </div>
        </div>
      </header>

      {/* SAHIFA */}
      <main className="mx-auto w-full max-w-[1120px] px-4 pb-28 pt-5 sm:px-6 md:pb-12 md:pt-7">
        <View me={me} cab={cab} go={go} initData={initData} />
        <p className="mt-8 text-center text-v2-caption font-normal text-v2-text-3">
          {t("Ma'lumotlar faqat ko'rish uchun. O'zgartirish kerak bo'lsa o'quv markaziga murojaat qiling.")}
        </p>
      </main>

      {/* TELEFON: PASTKI TAB PANELI */}
      <nav
        aria-label={t("Bo'limlar")}
        className="fixed inset-x-0 bottom-0 z-30 border-t border-v2-border bg-v2-surface pb-[env(safe-area-inset-bottom)] md:hidden"
      >
        <div className="mx-auto grid max-w-md grid-cols-5">
          {TABS.map((tb) => {
            const active = tb.key === tab;
            return (
              <button
                key={tb.key}
                type="button"
                onClick={() => go(tb.key)}
                aria-current={active ? "page" : undefined}
                className={`flex min-w-0 flex-col items-center gap-1 px-1 pb-2 pt-1.5 text-[11px] font-medium leading-tight transition-colors focus-visible:outline-none ${
                  active ? "text-v2-brand-text" : "text-v2-text-3"
                }`}
              >
                <span className={`flex h-7 w-12 items-center justify-center rounded-v2-full transition-colors ${active ? "bg-v2-brand-bg" : ""}`}>
                  <TabIcon icon={tb.icon} dot={tb.key === "tolovlar" && hasDebt} className="size-5" />
                </span>
                <span className="max-w-full truncate">{t(tb.label)}</span>
              </button>
            );
          })}
        </div>
      </nav>

      {profileOpen ? <ProfileDialogV2 me={me} paidTotal={cab.paid.total} onClose={() => setProfileOpen(false)} /> : null}
    </div>
  );
}
