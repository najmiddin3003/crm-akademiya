"use client";

import { Ban, Clock3, Minus, Sparkles, Undo2, UserCog, UserMinus, UserPlus, Users, Wallet, X, type LucideIcon } from "lucide-react";
import { useT, type TFn } from "@/components/shared/Language";
import { fmtSum } from "@/components/v2/employees/employeeBits";
import { roomLabel, timeLabel } from "@/components/v2/ui/groupStatus";
import type { PupilProfilePayload } from "@/lib/pupilProfile";
import type { ActivityItem, ActivityKind } from "./profileActivity";
import { groupTitle, type ProfileFmt } from "./profileBits";

// YANGI VERSIYA — HARAKATLAR RO'YXATI (rasm «O'quvchi sahifasi · Umumiy» → «So'nggi
// harakatlar»): chapda dumaloq ikonka, sarlavha (qalin) + izoh, o'ngda «7-oktyabr | 16:05».
// Umumiy (oxirgi 5 ta) va Tarix tabi (hammasi) bitta ko'rinishda.

const ICON: Record<ActivityKind, { icon: LucideIcon; cls: string }> = {
  payment: { icon: Wallet, cls: "border border-v2-border bg-v2-surface text-v2-text-2" },
  refund: { icon: Undo2, cls: "border border-v2-border bg-v2-surface text-v2-text-2" },
  cancelled: { icon: Ban, cls: "border border-v2-border bg-v2-surface-2 text-v2-text-3" },
  absent: { icon: X, cls: "bg-v2-danger-bg text-v2-danger" },
  excused: { icon: Minus, cls: "bg-v2-warning-bg text-v2-warning" },
  late: { icon: Clock3, cls: "bg-v2-warning-bg text-v2-warning" },
  first: { icon: Sparkles, cls: "bg-v2-success-bg text-v2-success" },
  joined: { icon: Users, cls: "border border-v2-border bg-v2-surface text-v2-text-2" },
  left: { icon: UserMinus, cls: "border border-v2-border bg-v2-surface text-v2-text-2" },
  status: { icon: UserCog, cls: "border border-v2-border bg-v2-surface text-v2-text-2" },
  created: { icon: UserPlus, cls: "border border-v2-border bg-v2-surface text-v2-text-2" },
};

/** Yozuvning sarlavhasi va izohi (tarjima bilan). */
export function activityText(x: ActivityItem, data: PupilProfilePayload, t: TFn, fmt: ProfileFmt): { title: string; sub: string } {
  const course = x.group ? groupTitle(x.group) : "";
  // Davomat yozuvida — faqat kurs nomi («Davomat: kelmadi · Matematika», rasmdagidek).
  const courseOnly = x.group ? x.group.course || x.group.label : "";
  const g = x.group;
  switch (x.kind) {
    case "payment":
    case "refund":
    case "cancelled": {
      const list = x.entries ?? [];
      const head = list[0];
      const sum = fmtSum(Math.abs(list.reduce((s, e) => s + e.amount, 0)));
      const title =
        x.kind === "refund"
          ? t("Pul qaytarildi · {sum} so'm", { sum })
          : x.kind === "cancelled"
            ? t("To'lov bekor qilingan · {sum} so'm", { sum })
            : list.length > 1
              ? t("{n} ta to'lov · {sum} so'm", { n: list.length, sum })
              : t("To'lov qabul qilindi · {sum} so'm", { sum });
      const forMonth = head?.periodMonth
        ? g?.course
          ? t("{course}, {month} uchun", { course: g.course, month: fmt.monthLower(head.periodMonth) })
          : t("{month} uchun", { month: fmt.monthName(head.periodMonth) })
        : "";
      const sub = [forMonth, head?.paymentType ? t(head.paymentType) : "", head?.cashboxName ?? "", head?.status === "waiting" ? t("kutilmoqda") : ""]
        .filter(Boolean)
        .join(" · ");
      return { title, sub };
    }
    case "absent":
    case "excused":
    case "late":
    case "first": {
      const m = x.mark;
      const what =
        x.kind === "absent" ? t("Davomat: kelmadi") : x.kind === "excused" ? t("Davomat: sababli") : x.kind === "late" ? t("Davomat: kechikdi") : t("Birinchi darsga keldi");
      const why = [m?.reason ? t(m.reason) : "", m?.note ?? ""].filter((s) => s.trim()).join(" — ");
      return {
        title: courseOnly ? `${what} · ${courseOnly}` : what,
        sub: why || (m?.author ? t("{name} belgiladi", { name: m.author }) : ""),
      };
    }
    case "joined":
      return {
        title: course ? `${t("Guruhga qo'shildi")} · ${course}` : t("Guruhga qo'shildi"),
        sub: g ? [g.day.trim(), timeLabel(g.time), roomLabel(g.room)].filter(Boolean).join(" · ") : "",
      };
    case "left":
      return { title: course ? `${t("Guruhdan chiqdi")} · ${course}` : t("Guruhdan chiqdi"), sub: g?.teacher ?? "" };
    case "status": {
      const s = data.pupil.status;
      const title = s === "Muzlatilgan" ? t("Muzlatildi") : s === "Arxiv" ? t("Arxivga o'tkazildi") : t("Faol holatga qaytarildi");
      return { title, sub: data.pupil.statusReason };
    }
    case "created":
      return {
        title: data.pupil.source ? t("O'quvchi qo'shildi · manba: {source}", { source: t(data.pupil.source) }) : t("O'quvchi qo'shildi"),
        sub: data.pupil.moderator ? t("Qo'shdi: {name}", { name: data.pupil.moderator }) : "",
      };
  }
}

export default function ActivityList({ items, data, fmt }: { items: ActivityItem[]; data: PupilProfilePayload; fmt: ProfileFmt }) {
  const { t } = useT();
  return (
    <ul className="divide-y divide-v2-border">
      {items.map((x) => {
        const { icon: Icon, cls } = ICON[x.kind];
        const { title, sub } = activityText(x, data, t, fmt);
        return (
          <li key={x.key} className="flex items-start gap-3 px-4 py-3">
            <span className={`mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-v2-full ${cls}`} aria-hidden>
              <Icon className="size-4" strokeWidth={1.75} />
            </span>
            <div className="min-w-0 flex-1">
              <div className={`text-v2-small font-semibold ${x.kind === "cancelled" ? "text-v2-text-2 line-through decoration-v2-text-3" : "text-v2-text"}`}>{title}</div>
              {sub && <div className="mt-0.5 text-v2-caption text-v2-text-2">{sub}</div>}
            </div>
            <span className="shrink-0 whitespace-nowrap pt-0.5 text-v2-caption tabular-nums text-v2-text-3">{fmt.stamp(x.date, x.time)}</span>
          </li>
        );
      })}
    </ul>
  );
}
