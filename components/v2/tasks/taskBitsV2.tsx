"use client";

import { useMemo } from "react";
import { Eye } from "lucide-react";
import { useT } from "@/components/shared/Language";
import { initialsOf } from "@/components/v2/employees/employeeBits";
import { MONTHS, WEEKDAYS_FULL } from "@/lib/i18n";
import { toUz } from "@/lib/uzTime";
import {
  HOUR_MS,
  STATUS_LABEL,
  STATUS_TONE,
  isOpen,
  ms,
  redeadlineOf,
  sameUzDay,
  type StaffTask,
  type StaffTaskStatus,
  type Tone,
} from "@/lib/staffTasks";
import type { StaffFmt } from "@/components/staff-tasks/format";

// YANGI VERSIYA — TOPSHIRIQLAR RO'YXATINING BO'LAKLARI (rasm «Topshiriqlar · Rahbar»,
// 23.10.2026): holat belgisi (nuqta + yozuv, och fon), muhimlik raqami (1–2 kulrang,
// 3–4 sariq, 5 qizil — rasmda 5 yo'q, tartib bo'yicha), «Muddat» katagi
// («14-oktabr | 12:00» + ostida «2 kun qoldi» / «qayta muddat: …» / «bugun · 5 soat
// 45 daqiqa»), xodim avatari va sana yozuvi.

/**
 * Holat nomlari — yangi versiyada «Yangi» → «Faol» (rasmlar «Xodim profili» va
 * «Topshiriqlar», ikkalasida ham «Faol»; SAVOLLAR 129, 134). Qolganlari tizimdagidek.
 */
export const V2_STATUS_LABEL: Record<StaffTaskStatus, string> = { ...STATUS_LABEL, yangi: "Faol" };

/** Holat rangi: och fon + holat rangidagi nuqta va yozuv (DESIGN.md → holat belgilari). */
export const TONE_V2: Record<Tone, { chip: string; dot: string }> = {
  pri: { chip: "bg-v2-info-bg text-v2-info", dot: "bg-v2-info" },
  vio: { chip: "bg-v2-violet-bg text-v2-violet", dot: "bg-v2-violet" },
  amber: { chip: "bg-v2-warning-bg text-v2-warning", dot: "bg-v2-warning" },
  hot: { chip: "bg-v2-warning-bg text-v2-warning", dot: "bg-v2-warning" },
  ok: { chip: "bg-v2-success-bg text-v2-success", dot: "bg-v2-success" },
  bad: { chip: "bg-v2-danger-bg text-v2-danger", dot: "bg-v2-danger" },
  gray: { chip: "bg-v2-surface-2 text-v2-text-2", dot: "bg-v2-text-3" },
};

export function StatusChipV2({ status, className = "" }: { status: StaffTaskStatus; className?: string }) {
  const { t } = useT();
  const tone = TONE_V2[STATUS_TONE[status]];
  return (
    <span className={`inline-flex h-6 items-center gap-1.5 whitespace-nowrap rounded-v2-full px-2 text-v2-caption font-medium ${tone.chip} ${className}`}>
      <span className={`size-1.5 shrink-0 rounded-full ${tone.dot}`} aria-hidden />
      {t(V2_STATUS_LABEL[status])}
    </span>
  );
}

/** Muhimlik raqami — o'lchangan: 1–2 `skeleton` foni, 3–4 `warning-bg`; 5 — `danger-bg` (taxmin). */
export function prioCls(p: number): string {
  if (p >= 5) return "bg-v2-danger-bg text-v2-danger";
  if (p >= 3) return "bg-v2-warning-bg text-v2-warning";
  return "bg-v2-skeleton text-v2-text-2";
}

export function PriorityBadgeV2({ p, title }: { p: number; title?: string }) {
  return (
    <span title={title} className={`inline-flex size-7 items-center justify-center rounded-v2-md text-v2-small font-semibold tabular-nums ${prioCls(p)}`}>
      {p}
    </span>
  );
}

/** Xodim avatari — `surface-2` doira, chegara, bosh harflar (rasmdagi «GA», «MQ»). */
export function TaskAvatar({ name }: { name: string }) {
  return (
    <span aria-hidden className="inline-flex size-7 shrink-0 items-center justify-center rounded-full border border-v2-border bg-v2-surface-2 text-[11px] font-semibold text-v2-text-2">
      {initialsOf(name) || "?"}
    </span>
  );
}

/** «Ko'rildi» / «hali ko'rilmagan» — holat belgisi ostida (rahbarga, ochiq topshiriqda). */
export function SeenLine({ seen }: { seen: boolean }) {
  const { t } = useT();
  return (
    <span className="mt-1 flex items-center gap-1 text-v2-caption font-normal text-v2-text-3">
      <Eye className="size-3.5 shrink-0" strokeWidth={1.75} aria-hidden />
      {seen ? t("ko'rildi") : t("hali ko'rilmagan")}
    </span>
  );
}

/**
 * Yangi versiyaning sana yozuvlari (Toshkent vaqti): «14-oktabr | 12:00» (oy to'liq,
 * rasmdagidek; eski sahifa «14-okt | 12:00»), sana maydonida «15-oktabr, payshanba».
 * Boshqa yil bo'lsa yil qo'shiladi.
 */
export function useTaskV2Fmt() {
  const { lang } = useT();
  return useMemo(() => {
    const p2 = (n: number) => String(n).padStart(2, "0");
    const dayMonth = (d: Date, nowMs?: number) => {
      const mon = MONTHS[lang][d.getMonth()] ?? "";
      const year = nowMs !== undefined && toUz(new Date(nowMs)).getFullYear() !== d.getFullYear() ? ` ${d.getFullYear()}` : "";
      return lang === "en" ? `${mon} ${d.getDate()}${year}` : `${d.getDate()}-${mon.toLowerCase()}${year}`;
    };
    /** «14-oktabr | 12:00». */
    const stamp = (v: string | number | null | undefined, nowMs?: number): string => {
      const m = typeof v === "number" ? v : ms(v);
      if (!Number.isFinite(m)) return "—";
      const d = toUz(new Date(m));
      return `${dayMonth(d, nowMs)} | ${p2(d.getHours())}:${p2(d.getMinutes())}`;
    };
    /** «15-oktabr, payshanba» — mahalliy sana obyekti (taqvim maydoni). */
    const dayLong = (d: Date): string => {
      const wd = WEEKDAYS_FULL[lang][(d.getDay() + 6) % 7] ?? "";
      return `${dayMonth(d)}, ${lang === "en" ? wd : wd.toLowerCase()}`;
    };
    return { stamp, dayLong };
  }, [lang]);
}

export type TaskV2Fmt = ReturnType<typeof useTaskV2Fmt>;

/** «5 soat 45 daqiqa» — bugun tugaydigan muddatgacha (rasmdagi «bugun · 5 soat 45 daqiqa»). */
function leftToday(delta: number, t: StaffFmt["t"]): string {
  const min = Math.max(1, Math.round(delta / 60_000));
  const h = Math.floor(min / 60);
  const m = min % 60;
  if (!h) return t("{n} daqiqa", { n: m });
  if (!m) return t("{n} soat", { n: h });
  return t("{h} soat {m} daqiqa", { h, m });
}

/** «Muddat» katagi: sana + holatga qarab izoh (rang bilan). */
export function DueCellV2({ task, nowMs, fmt, vf, graceHours }: { task: StaffTask; nowMs: number; fmt: StaffFmt; vf: TaskV2Fmt; graceHours: number }) {
  const { t, rel } = fmt;
  let line = "";
  let cls = "text-v2-text-2";
  const dl = ms(task.deadline);
  switch (task.status) {
    case "yangi":
    case "qaytarildi": {
      const left = dl - nowMs;
      if (left < 0) {
        line = rel(dl, nowMs);
        cls = "font-medium text-v2-danger";
      } else if (sameUzDay(dl, nowMs)) {
        line = `${t("bugun")} · ${leftToday(left, t)}`;
        cls = "font-medium text-v2-warning";
      } else {
        line = rel(dl, nowMs);
        if (left < 6 * HOUR_MS) cls = "font-medium text-v2-warning";
      }
      break;
    }
    case "muddati_otdi":
      line = t("qayta muddat: {when}", { when: vf.stamp(redeadlineOf(task, graceHours), nowMs) });
      cls = "font-medium text-v2-warning";
      break;
    case "tasdiq_kutilmoqda":
      if (task.isLate) {
        line = t("kechikib bajarildi");
        cls = "font-medium text-v2-warning";
      } else line = dl > nowMs ? rel(dl, nowMs) : t("o'z vaqtida bajarildi");
      break;
    case "yakunlandi":
      if (task.completedLate) {
        line = t("kechikib");
        cls = "font-medium text-v2-warning";
      } else line = t("o'z vaqtida");
      break;
    case "bajarilmadi":
      line = t("bajarilmadi");
      cls = "font-medium text-v2-danger";
      break;
    default:
      line = t("bekor qilingan");
      cls = "text-v2-text-3";
  }
  return (
    <div className="min-w-0">
      <div className="whitespace-nowrap text-v2-small tabular-nums text-v2-text">{vf.stamp(dl, nowMs)}</div>
      <div className={`mt-0.5 truncate text-v2-caption ${cls}`}>{line}</div>
    </div>
  );
}

/** Sarlavha ostidagi satr — holatga qarab (rasm: «Bajardim: 12-oktabr | 09:40 · fayl biriktirilgan»). */
export function titleSubline(x: StaffTask, nowMs: number, fmt: StaffFmt, vf: TaskV2Fmt): string {
  const { t, money } = fmt;
  const desc = (x.desc || "").split("\n")[0].trim();
  const batch = x.batchSize > 1 && isOpen(x.status) ? t("{n} xodimga berilgan", { n: x.batchSize }) : "";
  switch (x.status) {
    case "tasdiq_kutilmoqda":
      return [
        t("Bajardim: {when}", { when: vf.stamp(x.doneAt, nowMs) }),
        x.resultFile ? t("fayl biriktirilgan") : x.resultLink ? t("havola biriktirilgan") : "",
      ]
        .filter(Boolean)
        .join(" · ");
    case "yakunlandi":
      return t("Tasdiqlandi: {when}", { when: vf.stamp(x.completedAt, nowMs) });
    case "bajarilmadi":
      if (x.fine) return x.fine.status === "bekor" ? t("Jarima bekor qilingan") : t("Jarima: {sum}", { sum: money(x.fine.amount) });
      return desc;
    case "bekor":
      return x.cancelReason ? t("Sabab: {reason}", { reason: x.cancelReason }) : desc;
    case "qaytarildi":
      return [t("Qaytarildi: {n} marta", { n: x.returnCount || 1 }), desc, batch].filter(Boolean).join(" · ");
    default:
      return [desc, batch].filter(Boolean).join(" · ");
  }
}
