"use client";

import { useEffect, useState } from "react";
import { AlarmClock, BellRing, CalendarX2, ChevronDown, CircleCheckBig, DoorOpen, UserRoundX, type LucideIcon } from "lucide-react";
import Link from "@/components/ui/Link";
import { useT } from "@/components/shared/Language";
import type { AiAlert, AiAlertKind } from "@/lib/ai/protocol";
import type { AiAlertsApi } from "./useAiAlerts";

// «MOHIRA XABARLARI» — AI panelining tepasidagi ogohlantirishlar kartasi
// (12.10.2026, lib/ai/alerts.ts). Faqat admin. Yangi xabar bo'lsa karta
// ochiq chiqadi va bir lahzadan keyin xabarlar «ko'rildi» bo'ladi (robot
// tugmasidagi belgi o'chadi); ko'rilganlari xira, 7 kungacha turadi.
// Matn — `kind` + `params` dan t() bilan (uch til).

type TFn = (key: string, params?: Record<string, string | number>) => string;

const ICONS: Record<AiAlertKind, { Icon: LucideIcon; cls: string }> = {
  "lead-overdue": { Icon: UserRoundX, cls: "text-amber-600 dark:text-amber-400" },
  "group-ended": { Icon: CalendarX2, cls: "text-rose-600 dark:text-rose-400" },
  "room-freed": { Icon: DoorOpen, cls: "text-sky-600 dark:text-sky-400" },
  "task-early": { Icon: CircleCheckBig, cls: "text-emerald-600 dark:text-emerald-400" },
  "task-overdue": { Icon: AlarmClock, cls: "text-rose-600 dark:text-rose-400" },
};

/** Davomiylik (server soatda beradi): 48 soatgacha — soat, keyin — kun. */
function dur(h: unknown, t: TFn): string {
  const n = Math.max(1, Math.round(Number(h) || 0));
  return n < 48 ? t("{n} soat", { n }) : t("{n} kun", { n: Math.round(n / 24) });
}

/** «Qachon»: hozirgina / N daqiqa / N soat / N kun oldin. */
function ago(iso: string, t: TFn): string {
  const min = Math.floor((Date.now() - Date.parse(iso)) / 60_000);
  if (!Number.isFinite(min) || min < 1) return t("Hozirgina");
  if (min < 60) return t("{n} daqiqa oldin", { n: min });
  const h = Math.floor(min / 60);
  return h < 48 ? t("{n} soat oldin", { n: h }) : t("{n} kun oldin", { n: Math.floor(h / 24) });
}

export function alertText(a: Pick<AiAlert, "kind" | "params">, t: TFn): string {
  const p = a.params;
  const s = (k: string) => String(p[k] ?? "");
  switch (a.kind) {
    case "lead-overdue":
      return s("name")
        ? t("{name}ga biriktirilgan {n} ta lid 24 soatdan oshdi — eng eskisi {age} oldin kelgan", { name: s("name"), n: Number(p.n) || 0, age: dur(p.ageH, t) })
        : t("Hech kimga biriktirilmagan {n} ta lid 24 soatdan oshdi — eng eskisi {age} oldin kelgan", { n: Number(p.n) || 0, age: dur(p.ageH, t) });
    case "group-ended":
      return t("«{group}» o'qish muddati {end} da tugagan — arxivlaysizmi yoki muddatini uzaytirasizmi?", { group: s("group"), end: s("end") });
    case "room-freed": {
      const why =
        p.reason === "moved"
          ? t("boshqa xonaga («{room}») ko'chdi", { room: s("newRoom") })
          : p.reason === "time"
            ? t("vaqti o'zgardi")
            : p.reason === "ended"
              ? t("o'qish muddati tugadi")
              : t("arxivlandi");
      const base = t("«{room}» xonasi bo'shadi: «{group}» ({day}, {time}) {why}", {
        room: s("room"),
        group: s("group"),
        day: s("day"),
        time: s("time"),
        why,
      });
      return Number(p.empty) ? `${base}. ${t("Xona endi butunlay bo'sh.")}` : base;
    }
    case "task-early":
      return Number(p.mine)
        ? t("Xodimlar topshiriqlarni bajaryapti: siz {ago} oldin bergan «{title}» topshirig'ingizni {employee} muddatidan {early} avval topshirdi. Bir ko'rasizmi, afandim?", {
            ago: dur(p.givenAgoH, t),
            title: s("title"),
            employee: s("employee"),
            early: dur(p.earlyH, t),
          })
        : t("Xodimlar topshiriqlarni bajaryapti: {creator} {ago} oldin bergan «{title}» topshirig'ini {employee} muddatidan {early} avval topshirdi. Bir ko'rasizmi, afandim?", {
            creator: s("creator"),
            ago: dur(p.givenAgoH, t),
            title: s("title"),
            employee: s("employee"),
            early: dur(p.earlyH, t),
          });
    case "task-overdue":
      return t("{employee} «{title}» topshirig'ini muddatida bajarmadi — {late} kechikmoqda", { employee: s("employee"), title: s("title"), late: dur(p.lateH, t) });
  }
}

export default function AlertsCard({ api, onNavigate }: { api: AiAlertsApi; onNavigate: () => void }) {
  const { t } = useT();
  const { alerts, unseen, markSeen } = api;
  // Yangi xabar bilan ochilgan bo'lsa — karta ochiq.
  const [open, setOpen] = useState(() => unseen > 0);

  // Ko'rinib turgan yangi xabarlar bir lahzadan keyin «ko'rildi».
  useEffect(() => {
    if (!open) return;
    const keys = alerts.filter((a) => !a.seen).map((a) => a.key);
    if (keys.length === 0) return;
    const id = window.setTimeout(() => markSeen(keys), 1_500);
    return () => window.clearTimeout(id);
  }, [open, alerts, markSeen]);

  if (alerts.length === 0) return null;

  return (
    <div className="mx-auto w-full max-w-2xl shrink-0 px-3 pt-2">
      <div className="ai-msg-in rounded-xl border border-amber-500/30 bg-amber-500/5">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          className="flex w-full items-center gap-2 px-3 py-2 text-left text-[13px] font-medium"
        >
          <BellRing className={`h-4 w-4 shrink-0 ${unseen > 0 ? "text-rose-600" : "text-amber-600"}`} />
          <span className="min-w-0 flex-1 truncate">
            {unseen > 0 ? t("Afandim, {n} ta yangi xabar bor", { n: unseen }) : t("Xabarlar")}
          </span>
          <span className="rounded-full bg-amber-500/15 px-1.5 text-[11px] tabular-nums text-amber-700 dark:text-amber-300">{alerts.length}</span>
          <ChevronDown className={`h-4 w-4 shrink-0 text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`} />
        </button>
        {open && (
          <ul className="max-h-[38vh] space-y-1 overflow-y-auto border-t border-amber-500/20 px-2 py-2">
            {alerts.map((a) => {
              const { Icon, cls } = ICONS[a.kind];
              return (
                <li key={a.key} className={`flex gap-2 rounded-lg px-1.5 py-1.5 ${a.seen ? "opacity-70" : "bg-card"}`}>
                  <Icon aria-hidden className={`mt-0.5 h-4 w-4 shrink-0 ${cls}`} />
                  <div className="min-w-0 flex-1 text-[12.5px] leading-snug">
                    <p className={a.seen ? "" : "font-medium"}>{alertText(a, t)}</p>
                    <div className="mt-0.5 flex items-center gap-2 text-[11px] text-muted-foreground">
                      <span>{ago(a.at, t)}</span>
                      <Link href={a.href} onClick={onNavigate} className="font-medium text-primary hover:underline">
                        {t("Ko'rish")} →
                      </Link>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
