"use client";

import dynamic from "next/dynamic";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { ArrowRight, Cake, MessageSquareText, TriangleAlert } from "lucide-react";
import Link from "@/components/ui/Link";
import { useT } from "@/components/shared/Language";
import { useToast } from "@/components/ui/Toast";
import type { HrEmployeeFull } from "@/components/employees/employeeExtras";
import { employeeRoleLabel, useRoleNames } from "@/components/employees/useRoleNames";
import { ROLE_LABELS } from "@/constants/employees";
import { useStaff } from "@/hooks/useStaff";
import { useStudents } from "@/hooks/useStudents";
import { buildBirthdays, type BirthdayPerson } from "@/lib/birthdays";
import { MONTHS, WEEKDAYS_FULL, type Lang } from "@/lib/i18n";
import { hasSectionPermission, isPathAllowed } from "@/lib/permissions";
import { pupilFullName } from "@/lib/pupilsData";
import { toUz } from "@/lib/uzTime";
import { usePopover } from "./usePopover";

// YANGI VERSIYA: TUG'ILGAN KUNLAR OYNASI (21-qism «Tug'ilgan kunlar» rasmi) —
// tort tugmasi + yaqin 7 kun: Bugun / Ertaga / Shu hafta.
//
// MA'LUMOT Tug'ilgan kunlar sahifasi bilan BITTA (components/birthdays/
// BirthdaysPage.tsx): o'quvchilar /api/pupils dan (sanasi kiritilganlar,
// FILIAL bo'yicha kesilgan), xodimlar /api/hr-employees/ref dan (butun
// jamoa, arxivdagilarsiz). So'rov oyna BIRINCHI ochilganda ketadi — har
// sahifada tort uchun 2 ta ro'yxat tortilmasin; keyin keshdan.
//
// «Tabriklash» — mavjud SMS oynasi (components/orders/SmsModal.tsx,
// O'quvchilar ro'yxatidagi bilan bir xil): shablon (Avto sms → «Tug'ilgan
// kunida» matni ham shu ro'yxatda), ota-onaga ham. Faqat bugungi
// O'QUVCHIDA va SMS yuborish ruxsati borlarda (pastdagi SMS_PAGES).

const SmsModal = dynamic(() => import("@/components/orders/SmsModal"), { ssr: false });

const ICON_BTN =
  "relative size-9 shrink-0 items-center justify-center rounded-v2-md text-v2-text-2 transition-colors hover:bg-v2-surface-2 hover:text-v2-text";
const ICON = "size-5";
/** TopbarV2 dagi oyna bilan bir xil. */
const PANEL =
  "absolute right-0 top-full z-50 mt-2 overflow-hidden rounded-v2-lg border border-v2-border bg-v2-surface shadow-v2-md max-sm:fixed max-sm:inset-x-3 max-sm:top-[4.25rem] max-sm:mt-0 max-sm:w-auto";

/**
 * POST /api/sms-messages ochiq bo'lgan sahifalar — lib/apiPermissions.generated.ts
 * dagi yozuv bilan bir xil (proxy shu ro'yxatdan BIRINI talab qiladi). U yerda
 * o'zgarsa shu yerda ham: aks holda tugma ko'rinib, yuborishda 403 bo'ladi.
 */
const SMS_PAGES = ["/archive-students", "/first-lessons", "/orders-list", "/sales-messages", "/students-list"];

const ROLE_LABEL_MAP = ROLE_LABELS as Record<string, string>;

/** Yaqin kunlardan biri (Toshkent taqvimi). */
interface DayInfo {
  offset: number;
  year: number;
  month: number;
  day: number;
  /** 0 — dushanba (WEEKDAYS_FULL tartibi). */
  weekday: number;
}

function nextDays(nowMs: number, count: number): DayInfo[] {
  return Array.from({ length: count }, (_, i) => {
    const u = toUz(new Date(nowMs + i * 86_400_000));
    return { offset: i, year: u.getFullYear(), month: u.getMonth() + 1, day: u.getDate(), weekday: (u.getDay() + 6) % 7 };
  });
}

const isLeap = (y: number) => (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;

/** 29-fevral kabisa bo'lmagan yilda 28-fevralda nishonlanadi (aks holda yil bo'yi ko'rinmasdi). */
function fallsOn(p: BirthdayPerson, d: DayInfo): boolean {
  if (p.month === d.month && p.day === d.day) return true;
  return p.month === 2 && p.day === 29 && d.month === 2 && d.day === 28 && !isLeap(d.year);
}

/** «12-oktabr, dushanba» (inglizchada «Monday, October 12»). */
function longDate(lang: Lang, d: DayInfo): string {
  const month = MONTHS[lang][d.month - 1] ?? "";
  const weekday = WEEKDAYS_FULL[lang][d.weekday] ?? "";
  if (lang === "en") return `${weekday}, ${month} ${d.day}`;
  return `${d.day}-${month.toLowerCase()}, ${weekday.toLowerCase()}`;
}

/** «15-oktabr» — «Shu hafta» qatorining o'ng tomoni. */
function shortDate(lang: Lang, d: DayInfo): string {
  const month = MONTHS[lang][d.month - 1] ?? "";
  if (lang === "en") return `${month} ${d.day}`;
  return `${d.day}-${month.toLowerCase()}`;
}

/** «Asadbek Karimov» → «AK» (TopbarV2 dagi bilan bir xil). */
function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const letters = parts.slice(0, 2).map((p) => p.charAt(0).toUpperCase()).join("");
  return letters || "?";
}

/** 6733 → «6 733». */
function fmtInt(n: number): string {
  return Math.round(n).toLocaleString("ru-RU").replace(/[  ,]/g, " ");
}

function profileHref(p: BirthdayPerson): string {
  return p.kind === "employee" ? `/management-xodimlar/${p.id}` : `/student-edit/${p.id}`;
}

function SectionTitle({ children }: { children: ReactNode }) {
  return <div className="px-4 pb-1 pt-3 text-v2-caption text-v2-text-3">{children}</div>;
}

interface PanelProps {
  open: boolean;
  /** Oyna ochilgan lahza — kunlar shundan sanaladi. */
  nowMs: number;
  permissions: string[] | null;
  onNavigate: () => void;
  onCongratulate: (p: BirthdayPerson) => void;
}

/**
 * Ma'lumotli qism — oyna BIRINCHI ochilganda o'rnatiladi va keyin o'chmaydi
 * (yopiq paytda hech narsa chizmaydi). Shu bilan so'rovlar oynasiz ketmaydi.
 */
function BirthdaysPanel({ open, nowMs, permissions, onNavigate, onCongratulate }: PanelProps) {
  const { t, lang } = useT();
  // `birthDate` standart to'plamda yo'q — ataylab so'raladi; serverda faqat
  // sanasi kiritilganlar (BirthdaysPage bilan bir xil so'rov — bitta kesh).
  const { pupils, loading: pupilsLoading } = useStudents({ extra: ["birthDate"] as const, hasBirthDate: true });
  const { employees, loading: staffLoading } = useStaff();
  const roleNames = useRoleNames();
  const loading = pupilsLoading || staffLoading;

  // Sanasi kiritilmagan o'quvchilar soni — ikkita `countOnly` (faqat son,
  // hujjat tortilmaydi), ro'yxat bilan bir qamrovda (joriy filial). Xato
  // bo'lsa ogohlantirish shunchaki chiqmaydi.
  const [missing, setMissing] = useState<number | null>(null);
  useEffect(() => {
    let alive = true;
    const count = (extra: string) =>
      fetch(`/api/pupils?countOnly=1${extra}`)
        .then((r) => r.json())
        .then((d: { ok?: boolean; count?: number }) => (d?.ok && typeof d.count === "number" ? d.count : null))
        .catch(() => null);
    Promise.all([count(""), count("&hasBirthDate=1")]).then(([all, withDate]) => {
      if (alive && all !== null && withDate !== null) setMissing(Math.max(0, all - withDate));
    });
    return () => {
      alive = false;
    };
  }, []);

  const staffById = useMemo(() => new Map((employees as HrEmployeeFull[]).map((e) => [e.id, e])), [employees]);
  const categoryById = useMemo(() => new Map(pupils.map((p) => [p.id, (p.category ?? "").trim()])), [pupils]);

  const people = useMemo(() => {
    const studentSources = pupils.map((p) => ({ id: p.id, name: pupilFullName(p), phone: p.phone, birthDate: p.birthDate }));
    // Arxivdagi xodim ko'rinmaydi (Tug'ilgan kunlar sahifasidagidek).
    const employeeSources = (employees as HrEmployeeFull[])
      .filter((e) => !e.archReason)
      .map((e) => ({ id: e.id, name: e.name, phone: e.phone, birthDate: e.birthDate }));
    return buildBirthdays(studentSources, employeeSources);
  }, [pupils, employees]);

  const days = useMemo(() => nextDays(nowMs, 7), [nowMs]);
  const buckets = useMemo(
    () =>
      days.map((d) =>
        people
          .filter((p) => fallsOn(p, d))
          .sort((a, b) => a.name.localeCompare(b.name, "uz")),
      ),
    [days, people],
  );

  if (!open) return null;

  const canSms = SMS_PAGES.some((p) => hasSectionPermission(p, permissions));
  const today = buckets[0] ?? [];
  const tomorrow = buckets[1] ?? [];
  const week = days.slice(2).flatMap((d) => (buckets[d.offset] ?? []).map((p) => ({ p, d })));
  const total = today.length + tomorrow.length + week.length;

  const subtitle = (p: BirthdayPerson, d: DayInfo): string => {
    if (p.kind === "employee") {
      const e = staffById.get(p.id);
      const role = e ? employeeRoleLabel(e, roleNames, ROLE_LABEL_MAP) : null;
      // Umumiy «Xodim» yorlig'ini ikki marta yozmaymiz.
      return [t("Xodim"), role && role !== ROLE_LABEL_MAP.staff ? t(role) : ""].filter(Boolean).join(" · ");
    }
    const age = d.year - p.year;
    const course = categoryById.get(p.id) ?? "";
    return [t("O'quvchi"), course ? t(course) : "", age > 0 && age < 120 ? t("{n} yosh", { n: age }) : ""]
      .filter(Boolean)
      .join(" · ");
  };

  const row = (p: BirthdayPerson, d: DayInfo, right: ReactNode) => {
    const href = profileHref(p);
    const linked = isPathAllowed(href, permissions);
    return (
      <li key={`${p.kind}:${p.id}:${d.offset}`} className="flex items-center gap-3 px-4 py-2">
        <span
          className={`flex size-9 shrink-0 items-center justify-center rounded-v2-full text-v2-caption font-semibold ${
            p.kind === "employee" ? "bg-v2-violet-bg text-v2-violet" : "bg-v2-brand-bg text-v2-brand-text"
          }`}
          aria-hidden
        >
          {initialsOf(p.name)}
        </span>
        <span className="min-w-0 flex-1">
          {linked ? (
            <Link href={href} onClick={onNavigate} className="block truncate text-v2-body font-semibold text-v2-text hover:underline">
              {p.name}
            </Link>
          ) : (
            <span className="block truncate text-v2-body font-semibold text-v2-text">{p.name}</span>
          )}
          <span className="block truncate text-v2-caption text-v2-text-3">{subtitle(p, d)}</span>
        </span>
        {right}
      </li>
    );
  };

  const congratulate = (p: BirthdayPerson) =>
    p.kind === "student" && canSms ? (
      <button
        type="button"
        onClick={() => onCongratulate(p)}
        className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-v2-md bg-v2-brand-bg px-2.5 text-v2-small font-medium text-v2-brand-text transition-[filter] hover:brightness-95"
      >
        <MessageSquareText className="size-4" strokeWidth={1.75} aria-hidden />
        {t("Tabriklash")}
      </button>
    ) : null;

  let body: ReactNode;
  if (loading && people.length === 0) {
    body = (
      <div aria-busy="true" className="motion-safe:animate-pulse">
        {[0, 1, 2].map((i) => (
          <div key={i} className="flex items-center gap-3 px-4 py-2.5">
            <span className="size-9 shrink-0 rounded-v2-full bg-v2-skeleton" />
            <span className="flex-1 space-y-2">
              <span className="block h-3 w-1/2 rounded-v2-sm bg-v2-skeleton" />
              <span className="block h-3 w-1/3 rounded-v2-sm bg-v2-skeleton" />
            </span>
          </div>
        ))}
      </div>
    );
  } else if (total === 0) {
    body = (
      <div className="flex flex-col items-center px-6 py-10 text-center">
        <span className="mb-3 flex size-11 items-center justify-center rounded-v2-full bg-v2-surface-2 text-v2-text-3">
          <Cake className="size-5" strokeWidth={1.75} />
        </span>
        <div className="text-v2-body font-semibold text-v2-text">{t("Yaqin 7 kunda tug'ilgan kun yo'q")}</div>
      </div>
    );
  } else {
    body = (
      <>
        <section>
          <SectionTitle>
            <span className="font-semibold text-v2-text-2">{t("Bugun")}</span> · {longDate(lang, days[0])}
          </SectionTitle>
          {today.length > 0 ? (
            <ul>{today.map((p) => row(p, days[0], congratulate(p)))}</ul>
          ) : (
            <div className="px-4 pb-2 text-v2-small text-v2-text-3">{t("Bugun tug'ilgan kun yo'q")}</div>
          )}
        </section>
        {tomorrow.length > 0 && (
          <section>
            <SectionTitle>
              <span className="font-semibold text-v2-text-2">{t("Ertaga")}</span> · {longDate(lang, days[1])}
            </SectionTitle>
            <ul>{tomorrow.map((p) => row(p, days[1], null))}</ul>
          </section>
        )}
        {week.length > 0 && (
          <section>
            <SectionTitle>
              <span className="font-semibold text-v2-text-2">{t("Shu hafta")}</span>
            </SectionTitle>
            <ul>
              {week.map(({ p, d }) =>
                row(
                  p,
                  d,
                  <span className="shrink-0 whitespace-nowrap text-v2-caption text-v2-text-3 tabular-nums">{shortDate(lang, d)}</span>,
                ),
              )}
            </ul>
          </section>
        )}
      </>
    );
  }

  return (
    <div role="dialog" aria-label={t("Tug'ilgan kunlar")} className={`${PANEL} w-[380px]`}>
      <div className="flex items-center justify-between gap-3 border-b border-v2-border px-4 py-3">
        <h3 className="text-v2-section text-v2-text">{t("Tug'ilgan kunlar")}</h3>
        {!loading && total > 0 && <span className="text-v2-caption text-v2-text-3">{t("7 kun ichida: {n}", { n: total })}</span>}
      </div>

      <div className="max-h-[min(26rem,calc(100dvh-12rem))] overflow-y-auto overscroll-contain pb-1">
        {body}
        {missing !== null && missing > 0 && (
          <div className="mx-3 mb-2 mt-2 flex items-start gap-2 rounded-v2-md bg-v2-warning-bg px-3 py-2 text-v2-caption text-v2-warning">
            <TriangleAlert className="mt-px size-4 shrink-0" strokeWidth={1.75} aria-hidden />
            <span>
              {t("{n} ta o'quvchida tug'ilgan sana kiritilmagan — ular bu ro'yxatga tushmaydi", { n: fmtInt(missing) })}
            </span>
          </div>
        )}
      </div>

      <div className="border-t border-v2-border px-4 py-2.5">
        <Link
          href="/birthdays"
          onClick={onNavigate}
          className="inline-flex items-center gap-1 text-v2-small font-medium text-v2-brand-text hover:underline"
        >
          {t("Barcha tug'ilgan kunlar")}
          <ArrowRight className="size-3.5" strokeWidth={1.75} aria-hidden />
        </Link>
      </div>
    </div>
  );
}

export interface BirthdaysPopoverV2Props {
  /**
   * Foydalanuvchi ruxsatlari (TopbarV2 `permissions`): profil havolasi va
   * «Tabriklash» (SMS) shundan. `null` — admin (hammasi). MAJBURIY, ataylab:
   * unutilsa SMS ruxsati yo'qqa tugma chiqib, yuborishda 403 bo'lardi.
   */
  permissions: string[] | null;
}

export default function BirthdaysPopoverV2({ permissions }: BirthdaysPopoverV2Props) {
  const { t } = useT();
  const { showSuccess, showError } = useToast();
  const { open, ref, toggle, close } = usePopover();
  /** Oyna ochilgan lahza; 0 — hali ochilmagan (ma'lumot so'ralmaydi). */
  const [openedAt, setOpenedAt] = useState(0);
  const [smsFor, setSmsFor] = useState<{ name: string; phone: string } | null>(null);

  const onCake = () => {
    if (!open) setOpenedAt(Date.now());
    toggle();
  };

  return (
    <div ref={ref} className="relative hidden md:block">
      <button
        type="button"
        onClick={onCake}
        aria-expanded={open}
        aria-haspopup="dialog"
        title={t("Tug'ilgan kunlar")}
        aria-label={t("Tug'ilgan kunlar")}
        className={`${ICON_BTN} hidden md:inline-flex ${open ? "bg-v2-surface-2 text-v2-text" : ""}`}
      >
        <Cake className={ICON} strokeWidth={1.75} />
      </button>

      {openedAt > 0 && (
        <BirthdaysPanel
          open={open}
          nowMs={openedAt}
          permissions={permissions}
          onNavigate={close}
          onCongratulate={(p) => {
            close();
            setSmsFor({ name: p.name, phone: p.phone });
          }}
        />
      )}

      {smsFor && (
        <SmsModal
          studentName={smsFor.name}
          phone={smsFor.phone}
          onClose={() => setSmsFor(null)}
          onSent={({ simulated }) => {
            // Toast matnni o'zi tarjima qiladi (O'quvchilar ro'yxatidagidek).
            if (simulated) showError("SMS jo'natilmadi: Eskiz sozlanmagan (jurnalga yozildi)");
            else showSuccess("SMS yuborildi");
            setSmsFor(null);
          }}
          onError={showError}
        />
      )}
    </div>
  );
}
