"use client";

import { useMemo, useState } from "react";
import { BarChart3, Bell, CalendarCheck, Check, CircleCheck, Clock, Eye, Loader2, Megaphone, Phone, PhoneOff, PlusCircle, RefreshCw, UserX, X } from "lucide-react";
import Link from "@/components/ui/Link";
import { useT } from "@/components/shared/Language";
import { useToast } from "@/components/ui/Toast";
import { fieldCls } from "@/components/v2/form/fields";
import { initialsOf } from "@/components/v2/employees/employeeBits";
import { useReportData } from "@/components/v2/reports/reportHooks";
import { NoticeBar } from "@/components/v2/students/lists/listKit";
import { useProfileFmt } from "@/components/v2/students/profile/profileBits";
import V2Select from "@/components/v2/ui/V2Select";
import { primaryBtn, secondaryBtn } from "@/components/v2/ui/buttons";
import { groupWeekdays } from "@/lib/attendance";
import type { Group } from "@/lib/groups";
import { useGroups } from "@/hooks/useGroups";
import { Card } from "@/components/v2/teacher/teacherBits";

// YANGI VERSIYA — MODERATOR · QO'NG'IROQ NAVBATI (46-qism, rasmlar «Moderator · qo'ng'iroq navbati va natija», telefonda
// «qo'ng'iroq navbati», «qo'ng'iroq natijasi oynasi»). Navbat tartibi: muddati o'tgan qayta qo'ng'iroq → yangi lid (24 soat
// ichida) → dars bo'yicha (darsga kelmagan, birinchi darsdan keyin) → eslatma (ertangi birinchi dars).
// O'ngda natija: Javob berdi / Javob bermadi / Band edi / Raqam noto'g'ri; keyingi qadam — Birinchi darsga yozish
// (guruh + kun), Qayta qo'ng'iroq (vaqt), O'ylab ko'radi, Rad etdi; izoh. «Saqlash · keyingisi».
// Jurnal — /api/front (`lead_calls`), lid holati — /api/orders/:id/holat (bog'lanildi, birinchi dars).

type Section = "shoshilinch" | "yangi" | "dars" | "eslatma";
interface Item {
  key: string;
  section: Section;
  kind: "qayta" | "yangi" | "davomat" | "birinchi_keyin" | "eslatma";
  target: { type: "lead" | "pupil"; id: number; name: string };
  phone: string;
  sub: string;
  badge: string;
  dueText: string;
  overdue: boolean;
}
interface Queue {
  ok: true;
  today: string;
  now: string;
  who: { name: string; preview: boolean };
  branch: string;
  items: Item[];
  stats: { calls: number; answered: number; answeredPct: number | null; firstBooked: number; queue: number; urgent: number; firstCallAt: string | null };
  recent: { id: number; time: string; name: string; type: string; kind: string; result: string; next: string; nextText: string; note: string }[];
}

const SECTIONS: { k: Section; label: string }[] = [
  { k: "shoshilinch", label: "Shoshilinch" },
  { k: "yangi", label: "Yangi lidlar" },
  { k: "dars", label: "Dars bo'yicha" },
  { k: "eslatma", label: "Eslatmalar" },
];
const KIND_ICON = { qayta: RefreshCw, yangi: Megaphone, davomat: UserX, birinchi_keyin: CalendarCheck, eslatma: Bell } as const;
const KIND_TONE = {
  qayta: "bg-v2-info-bg text-v2-info",
  yangi: "bg-v2-surface-2 text-v2-text-2",
  davomat: "bg-v2-danger-bg text-v2-danger",
  birinchi_keyin: "bg-v2-success-bg text-v2-success",
  eslatma: "bg-v2-violet-bg text-v2-violet",
} as const;
export const RESULT_LABEL: Record<string, string> = { javob: "Javob berdi", javobsiz: "Javob bermadi", band: "Band edi", notogri: "Raqam noto'g'ri" };
const fmtPhone = (p: string) => {
  const d = p.replace(/\D/g, "").slice(-9);
  return d.length === 9 ? `+998 ${d.slice(0, 2)} ${d.slice(2, 5)} ${d.slice(5, 7)} ${d.slice(7)}` : p;
};

export default function CallQueueV2({ as }: { as?: string }) {
  const { t } = useT();
  const q = as ? `&as=${encodeURIComponent(as)}&mode=moderator` : "";
  const { data: d, error, reload } = useReportData<Queue>(`/api/front?view=queue${q}`);
  const [tab, setTab] = useState<"navbat" | "bajarildi">("navbat");
  const [selKey, setSelKey] = useState<string | null>(null);
  const [closed, setClosed] = useState(false);

  if (error)
    return (
      <div data-ui="v2" className="p-4">
        <NoticeBar>{t("Ma'lumot yuklanmadi")}</NoticeBar>
      </div>
    );
  if (!d)
    return (
      <div data-ui="v2" className="flex items-center gap-2 p-6 text-v2-small text-v2-text-3">
        <Loader2 className="size-4 animate-spin" aria-hidden /> {t("Yuklanmoqda…")}
      </div>
    );

  const sel = d.items.find((i) => i.key === selKey) ?? (closed ? null : (d.items[0] ?? null));
  const fmtNum = (n: number) => String(n);

  return (
    <div data-ui="v2" className="flex min-h-full flex-col gap-4 bg-v2-bg p-4 font-v2 text-v2-text sm:p-6">
      {d.who.preview ? <NoticeBar icon={Eye}>{t("Rahbar ko'rinishi: {name}", { name: d.who.name })}</NoticeBar> : null}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-v2-page text-v2-text">{t("Qo'ng'iroq navbati")}</h1>
          <p className="mt-0.5 text-v2-small text-v2-text-2">{[t("{time} holatiga", { time: d.now }), d.branch].filter(Boolean).join(" · ")}</p>
        </div>
        <div className="flex gap-2">
          <Link href={`/front-results${as ? `?as=${encodeURIComponent(as)}` : ""}`} className={secondaryBtn}>
            <BarChart3 className="size-4" strokeWidth={1.75} aria-hidden />
            {t("Natijalarim")}
          </Link>
          <Link href="/orders-list/add" className={secondaryBtn}>
            <PlusCircle className="size-4" strokeWidth={1.75} aria-hidden />
            {t("Yangi lid")}
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-px overflow-hidden rounded-v2-lg border border-v2-border bg-v2-border xl:grid-cols-4">
        <Kpi tone="brand" icon={<Phone className="size-5" strokeWidth={1.75} />} value={fmtNum(d.stats.calls)} label={d.stats.firstCallAt ? t("Bugun qo'ng'iroq · {time} dan", { time: d.stats.firstCallAt }) : t("Bugun qo'ng'iroq")} />
        <Kpi tone="success" icon={<CircleCheck className="size-5" strokeWidth={1.75} />} value={d.stats.answeredPct !== null ? `${d.stats.answeredPct}%` : "—"} label={t("Javob berdi · {n} ta", { n: d.stats.answered })} />
        <Kpi tone="info" icon={<CalendarCheck className="size-5" strokeWidth={1.75} />} value={fmtNum(d.stats.firstBooked)} label={t("Birinchi darsga yozildi")} />
        <Kpi tone="warning" icon={<Clock className="size-5" strokeWidth={1.75} />} value={fmtNum(d.stats.queue)} label={t("Navbatda · {n} tasi shoshilinch", { n: d.stats.urgent })} />
      </div>

      <div className="grid grid-cols-[minmax(0,1fr)] items-start gap-4 lg:grid-cols-[minmax(0,1fr)_25rem]">
        <div className="flex min-w-0 flex-col gap-4">
          <Card className="!p-0 sm:!p-0">
            <div className="flex flex-wrap items-start justify-between gap-2 p-4 sm:p-5">
              <div>
                <h2 className="text-v2-section text-v2-text">{t("Navbat · {n}", { n: d.items.length })}</h2>
                <p className="text-v2-small text-v2-text-3">{t("Tartib: muddati o'tgan → yangi lid (24 soat ichida) → dars bo'yicha → eslatma")}</p>
              </div>
              <div role="tablist" className="inline-flex rounded-v2-md border border-v2-border bg-v2-surface-2 p-0.5">
                {(
                  [
                    ["navbat", t("Navbat · {n}", { n: d.items.length })],
                    ["bajarildi", t("Bajarildi · {n}", { n: d.stats.calls })],
                  ] as const
                ).map(([k, label]) => (
                  <button key={k} type="button" role="tab" aria-selected={tab === k} onClick={() => setTab(k)} className={`h-8 rounded-v2-sm px-3 text-v2-small ${tab === k ? "bg-v2-surface font-semibold text-v2-text shadow-v2-sm" : "text-v2-text-2"}`}>
                    {label}
                  </button>
                ))}
              </div>
            </div>
            {tab === "navbat" ? (
              d.items.length === 0 ? (
                <p className="border-t border-v2-border px-5 py-6 text-center text-v2-small text-v2-success">{t("Navbat bo'sh — hammasiga qo'ng'iroq qilindi.")}</p>
              ) : (
                SECTIONS.map((s) => {
                  const list = d.items.filter((i) => i.section === s.k);
                  if (!list.length) return null;
                  return (
                    <div key={s.k}>
                      <div className="border-t border-v2-border bg-v2-surface-2 px-4 py-2 text-v2-caption font-semibold text-v2-text-2 sm:px-5">
                        {t(s.label)} · {list.length}
                      </div>
                      {list.map((i) => {
                        const Icon = KIND_ICON[i.kind];
                        const on = sel?.key === i.key;
                        return (
                          <button
                            key={i.key}
                            type="button"
                            onClick={() => {
                              setSelKey(i.key);
                              setClosed(false);
                            }}
                            className={`flex w-full items-center gap-3 border-l-[3px] border-t border-t-v2-border px-4 py-3 text-left sm:px-5 ${on ? "border-l-v2-brand bg-v2-brand-bg" : "border-l-transparent hover:bg-v2-surface-2"}`}
                          >
                            <span className={`grid size-9 shrink-0 place-items-center rounded-v2-md ${KIND_TONE[i.kind]}`}>
                              <Icon className="size-4" strokeWidth={1.75} aria-hidden />
                            </span>
                            <span className="min-w-0 flex-1">
                              <span className="flex flex-wrap items-center gap-2">
                                <span className="text-v2-body font-semibold text-v2-text">{i.target.name}</span>
                                <span className={`inline-flex items-center gap-1 rounded-v2-sm px-1.5 py-0.5 text-v2-caption ${KIND_TONE[i.kind]}`}>{t(i.badge)}</span>
                              </span>
                              <span className="block truncate text-v2-caption text-v2-text-3">{i.sub}</span>
                            </span>
                            <span className={`hidden shrink-0 items-center gap-1 rounded-v2-sm px-2 py-0.5 text-v2-caption sm:inline-flex ${i.overdue ? "bg-v2-danger-bg text-v2-danger" : "bg-v2-warning-bg text-v2-warning"}`}>
                              <Clock className="size-3.5" strokeWidth={1.75} aria-hidden />
                              {i.dueText}
                            </span>
                            {i.phone ? (
                              <a href={`tel:+998${i.phone.replace(/\D/g, "").slice(-9)}`} onClick={(e) => e.stopPropagation()} aria-label={t("Qo'ng'iroq")} className="grid size-9 shrink-0 place-items-center rounded-v2-md bg-v2-brand-bg text-v2-brand-text">
                                <Phone className="size-4" strokeWidth={1.75} aria-hidden />
                              </a>
                            ) : null}
                          </button>
                        );
                      })}
                    </div>
                  );
                })
              )
            ) : (
              <RecentList rows={d.recent} />
            )}
          </Card>
          {tab === "navbat" ? (
            <Card className="!p-0 sm:!p-0">
              <div className="flex items-start justify-between gap-2 p-4 sm:p-5">
                <div>
                  <h2 className="text-v2-section text-v2-text">{t("Oxirgi qo'ng'iroqlar")}</h2>
                  <p className="text-v2-small text-v2-text-3">{t("{a} tadan {b} tasi", { a: d.stats.calls, b: Math.min(4, d.recent.length) })}</p>
                </div>
                <Link href={`/front-results${as ? `?as=${encodeURIComponent(as)}` : ""}`} className="text-v2-small font-medium text-v2-brand-text">
                  {t("Hammasi")}
                </Link>
              </div>
              <RecentList rows={d.recent.slice(0, 4)} />
            </Card>
          ) : null}
        </div>

        {sel ? (
          <CallPanel
            key={sel.key}
            item={sel}
            as={as}
            today={d.today}
            now={d.now}
            onClose={() => {
              setSelKey(null);
              setClosed(true);
            }}
            onSaved={(next) => {
              const idx = d.items.findIndex((i) => i.key === sel.key);
              setSelKey(next ? (d.items[idx + 1]?.key ?? null) : null);
              setClosed(!next);
              reload();
            }}
          />
        ) : (
          <Card>
            <p className="py-10 text-center text-v2-small text-v2-text-3">{t("Navbatdan qo'ng'iroqni tanlang.")}</p>
          </Card>
        )}
      </div>
    </div>
  );
}

function RecentList({ rows }: { rows: Queue["recent"] }) {
  const { t } = useT();
  if (!rows.length) return <p className="border-t border-v2-border px-5 py-4 text-v2-small text-v2-text-3">{t("Bugun hali qo'ng'iroq yo'q.")}</p>;
  return (
    <ul>
      {rows.map((r) => (
        <li key={r.id} className="flex items-start gap-3 border-t border-v2-border px-4 py-2.5 sm:px-5">
          <span className="w-11 shrink-0 pt-0.5 text-v2-small font-semibold tabular-nums text-v2-text">{r.time}</span>
          <div className="min-w-0 flex-1">
            <div className="text-v2-small">
              <b className="font-semibold text-v2-text">{r.name}</b> <span className="text-v2-text-3">· {r.type === "pupil" ? t("O'quvchi") : t("Lid")}</span>
            </div>
            <div className="truncate text-v2-caption text-v2-text-3">{[r.nextText || nextLabel(t, r.next), r.note].filter(Boolean).join(" — ")}</div>
          </div>
          <span className={`shrink-0 rounded-v2-sm px-2 py-0.5 text-v2-caption ${r.result === "javob" ? "bg-v2-success-bg text-v2-success" : "bg-v2-danger-bg text-v2-danger"}`}>{t(RESULT_LABEL[r.result] ?? r.result)}</span>
        </li>
      ))}
    </ul>
  );
}

export function nextLabel(t: (k: string) => string, n: string) {
  return n === "birinchi_dars" ? t("Birinchi darsga yozildi") : n === "qayta" ? t("Qayta qo'ng'iroq") : n === "oylab" ? t("O'ylab ko'radi") : n === "rad" ? t("Rad etdi") : "";
}

function Kpi({ icon, tone, value, label }: { icon: React.ReactNode; tone: "brand" | "success" | "info" | "warning"; value: string; label: string }) {
  const cls = { brand: "bg-v2-brand-bg text-v2-brand-text", success: "bg-v2-success-bg text-v2-success", info: "bg-v2-info-bg text-v2-info", warning: "bg-v2-warning-bg text-v2-warning" }[tone];
  return (
    <div className="flex items-center gap-3 bg-v2-surface px-3 py-3 sm:px-4 sm:py-4">
      <span className={`hidden size-10 shrink-0 place-items-center rounded-v2-md sm:grid ${cls}`}>{icon}</span>
      <div className="min-w-0">
        <div className={`text-[1.375rem] font-semibold leading-7 tabular-nums ${tone === "warning" ? "text-v2-warning" : "text-v2-text"}`}>{value}</div>
        <div className="text-v2-caption text-v2-text-2">{label}</div>
      </div>
    </div>
  );
}

const addDays = (iso: string, n: number) => new Date(Date.parse(`${iso}T00:00:00Z`) + n * 86400_000).toISOString().slice(0, 10);

function CallPanel({ item, as, today, now, onClose, onSaved }: { item: Item; as?: string; today: string; now: string; onClose: () => void; onSaved: (next: boolean) => void }) {
  const { t } = useT();
  const fmt = useProfileFmt();
  const { showError, showSuccess } = useToast();
  const { groups } = useGroups();
  const [result, setResult] = useState<string | null>(null);
  const [next, setNext] = useState<string>("");
  const [groupId, setGroupId] = useState("");
  const [day, setDay] = useState("");
  const [callback, setCallback] = useState("");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const isLead = item.target.type === "lead";
  const canBook = isLead && (item.kind === "yangi" || item.kind === "qayta");

  const live = useMemo(() => (groups ?? []).filter((g: Group) => g.status !== "archive" && g.status !== "finished"), [groups]);
  const g = live.find((x) => String(x.id) === groupId) ?? null;
  const days = useMemo(() => {
    if (!g) return [] as string[];
    const wd = groupWeekdays(g.day);
    const start = (/(\d{1,2}):(\d{2})/.exec(g.time || "")?.[0] ?? "").padStart(5, "0");
    const out: string[] = [];
    for (let i = 0; i < 21 && out.length < 3; i++) {
      const d = addDays(today, i);
      // Bugungi dars boshlanib bo'lgan bo'lsa — keyingi kundan.
      if (d === today && start && start <= now) continue;
      if (wd.includes(new Date(`${d}T00:00:00Z`).getUTCDay())) out.push(d);
    }
    return out;
  }, [g, today, now]);

  const save = async (andNext: boolean) => {
    if (!result) return;
    if (next === "birinchi_dars" && (!g || !day)) return showError(t("Guruh va kunni tanlang"));
    setSaving(true);
    const start = g ? (/(\d{1,2}):(\d{2})/.exec(g.time || "")?.[0] ?? "09:00").padStart(5, "0") : "";
    const nextText = next === "birinchi_dars" && g ? `${t("Birinchi darsga yozildi")} — ${fmt.dayMonth(day)} ${start}` : next === "qayta" && callback ? `${t("Qayta")}: ${callback.replace("T", " ")}` : "";
    const r = await fetch("/api/front", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "call", target: item.target, kind: item.kind, result, next: result === "javob" ? next : next === "qayta" ? "qayta" : "", callbackAt: callback, note, nextText, ...(as ? { as, mode: "moderator" } : {}) }),
    })
      .then((x) => x.json())
      .catch(() => ({ ok: false, error: t("Serverga ulanib bo'lmadi") }));
    if (!r.ok) {
      setSaving(false);
      return showError(r.error);
    }
    // Lid holati: javob berdi → bog'lanildi; birinchi darsga yozish → «Birinchi dars».
    if (isLead && result === "javob" && item.kind === "yangi") {
      await fetch(`/api/orders/${item.target.id}/holat`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "set", to: "bog" }) }).catch(() => null);
    }
    if (isLead && result === "javob" && next === "birinchi_dars" && g) {
      const start = (/(\d{1,2}):(\d{2})/.exec(g.time || "")?.[0] ?? "09:00").padStart(5, "0");
      const h = await fetch(`/api/orders/${item.target.id}/holat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "set", to: "sinov", sinov: { sana: day, vaqt: start, oqituvchi: g.teacher ?? "", guruhId: g.id } }),
      })
        .then((x) => x.json())
        .catch(() => null);
      if (!h?.ok) showError(h?.error ?? t("Lid holati o'zgarmadi — lid sahifasida yozing"));
    }
    setSaving(false);
    showSuccess(t("Qo'ng'iroq saqlandi"));
    onSaved(andNext);
  };

  const chip = (on: boolean) => `inline-flex h-10 items-center justify-center gap-1.5 rounded-v2-md border px-3 text-v2-small font-medium ${on ? "border-v2-success bg-v2-success-bg text-v2-success" : "border-v2-border-strong text-v2-text hover:bg-v2-surface-2"}`;
  const pill = (on: boolean) => `inline-flex h-9 items-center gap-1.5 rounded-v2-full border px-3.5 text-v2-small ${on ? "border-v2-brand bg-v2-brand-bg font-semibold text-v2-brand-text" : "border-v2-border-strong text-v2-text hover:bg-v2-surface-2"}`;

  return (
    <section className="rounded-v2-lg border border-v2-border bg-v2-surface p-4 shadow-v2-sm sm:p-5 lg:sticky lg:top-4">
      <div className="flex items-start justify-between gap-2">
        <div className="flex min-w-0 items-center gap-3">
          <span className="grid size-11 shrink-0 place-items-center rounded-full bg-v2-brand-bg text-v2-small font-semibold text-v2-brand-text">{initialsOf(item.target.name)}</span>
          <div className="min-w-0">
            <div className="text-v2-section text-v2-text">{item.target.name}</div>
            <div className="truncate text-v2-caption text-v2-text-3">{[t(item.badge), item.sub].filter(Boolean).join(" · ")}</div>
          </div>
        </div>
        <button type="button" onClick={onClose} aria-label={t("Yopish")} className="grid size-8 place-items-center rounded-v2-md text-v2-text-3 hover:bg-v2-surface-2">
          <X className="size-4" strokeWidth={1.75} aria-hidden />
        </button>
      </div>
      {item.phone ? (
        <div className="mt-4 flex items-center justify-between gap-2">
          <div>
            <div className="text-v2-caption text-v2-text-3">{item.target.type === "pupil" ? t("Ota-ona · telefon") : t("O'zi · telefon")}</div>
            <div className="text-v2-section font-semibold tabular-nums text-v2-text">{fmtPhone(item.phone)}</div>
          </div>
          <a href={`tel:+998${item.phone.replace(/\D/g, "").slice(-9)}`} className="grid size-10 place-items-center rounded-v2-md bg-v2-brand-bg text-v2-brand-text" aria-label={t("Qo'ng'iroq")}>
            <Phone className="size-5" strokeWidth={1.75} aria-hidden />
          </a>
        </div>
      ) : null}

      <div className="mt-4 text-v2-small font-semibold text-v2-text">{t("Natija")}</div>
      <div className="mt-1.5 grid grid-cols-2 gap-2">
        <button type="button" onClick={() => setResult("javob")} className={chip(result === "javob")}>
          <Phone className="size-4" strokeWidth={1.75} aria-hidden />
          {t("Javob berdi")}
        </button>
        <button type="button" onClick={() => setResult("javobsiz")} className={chip(result === "javobsiz")}>
          <PhoneOff className="size-4" strokeWidth={1.75} aria-hidden />
          {t("Javob bermadi")}
        </button>
        <button type="button" onClick={() => setResult("band")} className={chip(result === "band")}>
          <Clock className="size-4" strokeWidth={1.75} aria-hidden />
          {t("Band edi")}
        </button>
        <button type="button" onClick={() => setResult("notogri")} className={chip(result === "notogri")}>
          <X className="size-4" strokeWidth={1.75} aria-hidden />
          {t("Raqam noto'g'ri")}
        </button>
      </div>

      {result ? (
        <>
          <div className="mt-4 text-v2-small font-semibold text-v2-text">{t("Keyingi qadam")}</div>
          <div className="mt-1.5 flex flex-wrap gap-2">
            {[
              ...(canBook && result === "javob" ? [["birinchi_dars", t("Birinchi darsga yozish")]] : []),
              ["qayta", t("Qayta qo'ng'iroq")],
              ...(result === "javob" ? [["oylab", t("O'ylab ko'radi")]] : []),
              ...(isLead && result === "javob" ? [["rad", t("Rad etdi")]] : []),
            ].map(([k, label]) => (
              <button key={k} type="button" onClick={() => setNext(next === k ? "" : k)} className={pill(next === k)}>
                {next === k ? <Check className="size-4" strokeWidth={2} aria-hidden /> : null}
                {label}
              </button>
            ))}
          </div>
        </>
      ) : null}

      {next === "birinchi_dars" ? (
        <div className="mt-4 space-y-3">
          <div>
            <div className="mb-1 text-v2-small font-semibold text-v2-text">{t("Guruh")}</div>
            <V2Select value={groupId} onChange={(v) => { setGroupId(v); setDay(""); }} label={t("Guruh")} placeholder={t("Guruhni tanlang")} clearable={false} options={live.map((x) => ({ value: String(x.id), label: `${x.course}${x.level ? ` · ${x.level}` : ""} · ${x.teacher} · ${x.time}` }))} />
            {g ? <p className="mt-1 text-v2-caption text-v2-text-3">{[g.room ? `${g.room}-xona` : null, g.level ? t("daraja: {l}", { l: g.level }) : null].filter(Boolean).join(" · ")}</p> : null}
          </div>
          {g ? (
            <div>
              <div className="mb-1 text-v2-small font-semibold text-v2-text">{t("Birinchi dars kuni")}</div>
              <div className="flex flex-wrap gap-2">
                {days.map((x) => (
                  <button key={x} type="button" onClick={() => setDay(x)} className={pill(day === x)}>
                    {day === x ? <Check className="size-4" strokeWidth={2} aria-hidden /> : null}
                    {fmt.weekday(x).slice(0, 4)}, {fmt.dayMonth(x)}
                  </button>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      ) : null}
      {next === "qayta" ? (
        <label className="mt-4 block">
          <span className="mb-1 block text-v2-small font-semibold text-v2-text">{t("Qachon qayta qo'ng'iroq qilinadi")}</span>
          <input type="datetime-local" value={callback} onChange={(e) => setCallback(e.target.value)} className={fieldCls()} />
        </label>
      ) : null}
      {next === "rad" ? <p className="mt-3 rounded-v2-md bg-v2-surface-2 px-3 py-2 text-v2-small text-v2-text-2">{t("Rad etish sababi lid sahifasida tanlanadi — saqlangach lidni oching.")}</p> : null}

      <label className="mt-4 block">
        <span className="mb-1 block text-v2-small font-semibold text-v2-text">
          {t("Izoh")} <span className="font-normal text-v2-text-3">({t("ixtiyoriy")})</span>
        </span>
        <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={3} maxLength={500} placeholder={t("Masalan: o'zi bilan gaplashildi, chorshanba keladi")} className={fieldCls(undefined, "h-auto py-2")} />
      </label>
      {next === "birinchi_dars" && g ? (
        <p className="mt-3 rounded-v2-md bg-v2-surface-2 px-3 py-2 text-v2-caption text-v2-text-2">{t("Saqlansa, lid «Birinchi dars» bosqichiga o'tadi, ustoz {t} bosh sahifasida ko'radi.", { t: g.teacher })}</p>
      ) : null}
      <div className="mt-4 flex gap-2">
        <button type="button" disabled={!result || saving} onClick={() => void save(true)} className={`${primaryBtn} flex-1 justify-center disabled:opacity-50`}>
          {saving ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Check className="size-4" strokeWidth={2} aria-hidden />}
          {t("Saqlash · keyingisi")}
        </button>
        <button type="button" disabled={!result || saving} onClick={() => void save(false)} className={`${secondaryBtn} disabled:opacity-50`}>
          {t("Saqlash")}
        </button>
      </div>
      {isLead ? (
        <Link href={`/orders-list/${item.target.id}`} className="mt-3 block text-center text-v2-small text-v2-brand-text">
          {t("Lid sahifasini ochish")}
        </Link>
      ) : null}
    </section>
  );
}
