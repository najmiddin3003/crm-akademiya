"use client";

import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, ChevronRight, RotateCcw } from "lucide-react";
import Select from "@/components/ui/Select";
import SearchInput from "@/components/ui/SearchInput";
import DateRangePicker, { type DateRange } from "@/components/ui/DateRangePicker";
import { SpinnerBlock } from "@/components/ui/Spinner";
import { useT } from "@/components/shared/Language";
import { useBranches } from "@/hooks/useBranches";
import { ACTION_KINDS, ACTOR_KIND_LABELS, SECTION_LABELS, actionLabel, sectionLabel } from "@/lib/actionLogLabels";
import { branchBuildingLabel } from "@/lib/branchPools";
import { describeUserAgent } from "@/lib/userSessions";

// «AMALLAR JURNALI» (10.10.2026) — CRM'da kim, qachon, nima qilgani
// (lib/actionLog.ts yozadi, GET /api/action-log o'qiydi). Faqat admin:
// sahifa app/(app)/amallar-jurnali/page.tsx da to'siladi.
//
// Yozuvlar 1 yil saqlanadi. Saytdagi har bir qo'shish/o'zgartirish/o'chirish
// (proxy.ts), kirish urinishlari, Telegram bot va QR amallari, tizimning o'zi
// qo'ygan jarimalar.

interface LogActor {
  kind: string;
  userId?: string | null;
  employeeId?: number | null;
  name?: string | null;
  role?: string | null;
  phone?: string | null;
  tgId?: number | null;
}

interface LogRow {
  id: string;
  at: string;
  actor: LogActor;
  source: string;
  section: string;
  action: string;
  path?: string;
  query?: string;
  target?: string | null;
  status?: number | null;
  denied?: boolean;
  ip?: string | null;
  ua?: string | null;
  branchId?: number | null;
  body?: unknown;
  details?: Record<string, unknown>;
}

interface Person {
  key: string;
  name: string;
  kind: string;
  count: number;
}

/** Brauzer kuni "YYYY-MM-DD" (sana tanlagichdan). */
function dayKey(d: Date): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

const TZ = "Asia/Tashkent";
const fmtTime = (iso: string) =>
  new Date(iso).toLocaleTimeString("ru-RU", { timeZone: TZ, hour: "2-digit", minute: "2-digit", second: "2-digit" });
const fmtDate = (iso: string) => new Date(iso).toLocaleDateString("ru-RU", { timeZone: TZ, day: "2-digit", month: "2-digit", year: "numeric" });

export default function ActionLogPage() {
  const { t } = useT();
  const { branches } = useBranches();
  const today = useMemo(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), d.getDate());
  }, []);
  const [range, setRange] = useState<DateRange>({ start: today, end: today });
  const [who, setWho] = useState("");
  const [section, setSection] = useState("");
  const [kind, setKind] = useState("");
  const [q, setQ] = useState("");
  const [qApplied, setQApplied] = useState("");
  const [rows, setRows] = useState<LogRow[]>([]);
  const [people, setPeople] = useState<Person[]>([]);
  const [next, setNext] = useState<string | null>(null);
  // Qaysi filtr bilan yuklangani — `loading` shundan hosila (effekt ichida
  // setState chaqirmaslik uchun: react-hooks/set-state-in-effect).
  const [loadedQuery, setLoadedQuery] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState("");
  const [open, setOpen] = useState<string | null>(null);
  const seq = useRef(0);

  // Qidiruv matni yozib bo'lingach (0,4 s) — har harfda so'rov ketmasin.
  useEffect(() => {
    const id = window.setTimeout(() => setQApplied(q.trim()), 400);
    return () => window.clearTimeout(id);
  }, [q]);

  const query = useMemo(() => {
    const p = new URLSearchParams();
    const from = range.start ?? today;
    p.set("from", dayKey(from));
    p.set("to", dayKey(range.end ?? from));
    if (who) p.set("who", who);
    if (section) p.set("section", section);
    if (kind) p.set("kind", kind);
    if (qApplied) p.set("q", qApplied);
    return p.toString();
  }, [range, today, who, section, kind, qApplied]);

  const loading = loadedQuery !== query;

  // Holat faqat javobdan KEYIN yoziladi; yuklash belgisi `loadedQuery` dan.
  const load = useCallback(
    (before: string | null) => {
      const my = ++seq.current;
      return fetch(`/api/action-log?${query}${before ? `&before=${encodeURIComponent(before)}` : ""}`, { cache: "no-store" })
        .then((res) => res.json())
        .then((d) => {
          if (my !== seq.current) return;
          if (!d?.ok) {
            setError(t(d?.error || "Jurnal yuklanmadi"));
            return;
          }
          setError("");
          setRows((prev) => (before ? [...prev, ...(d.rows as LogRow[])] : (d.rows as LogRow[])));
          setNext(d.next ?? null);
          if (!before) {
            setPeople(d.people ?? []);
            setOpen(null);
          }
        })
        .catch(() => {
          if (my === seq.current) setError(t("Tarmoq xatosi — qayta urinib ko'ring"));
        })
        .finally(() => {
          if (my === seq.current) {
            setLoadedQuery(query);
            setLoadingMore(false);
          }
        });
    },
    [query, t],
  );

  useEffect(() => {
    void load(null);
  }, [load]);

  const branchName = useMemo(() => {
    const m = new Map<number, string>();
    for (const b of branches) m.set(b.id, branchBuildingLabel(b, (n) => t("{n}-bino", { n })));
    return m;
  }, [branches, t]);

  // Bir nomli bo'limlar bitta qatorda (Xodimlar: employees + hr-employees).
  const sectionOptions = useMemo(() => {
    const byLabel = new Map<string, string[]>();
    for (const [key, label] of Object.entries(SECTION_LABELS)) byLabel.set(label, [...(byLabel.get(label) ?? []), key]);
    return [...byLabel]
      .map(([label, keys]) => ({ value: keys.join(","), label: t(label) }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [t]);

  const kindOptions = useMemo(
    () => [...ACTION_KINDS.map((k) => ({ value: k.value, label: t(k.label) })), { value: "denied", label: t("Rad etilgan urinishlar") }],
    [t],
  );

  const peopleOptions = useMemo(
    () =>
      people.map((p) => ({
        value: p.key,
        label: p.name || (p.kind === "public" ? t("Tizimga kirmagan") : p.key),
        sub: t(ACTOR_KIND_LABELS[p.kind] ?? p.kind),
        hint: String(p.count),
      })),
    [people, t],
  );

  const anyFilter = Boolean(who || section || kind || qApplied);

  return (
    <div className="page-frame container mx-auto max-w-[1600px] p-4 md:p-5 space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">{t("Amallar jurnali")}</h1>
          <div className="text-[12px] text-muted-foreground mt-0.5">
            {t("CRM'da kim, qachon va nima qilgani: saytdagi har bir o'zgarish, kirish urinishlari, Telegram bot va QR. Yozuvlar 1 yil saqlanadi.")}
          </div>
        </div>
        <button
          type="button"
          onClick={() => {
            setLoadedQuery(null);
            void load(null);
          }}
          className="inline-flex items-center gap-1.5 h-9 px-3 rounded-lg border border-border bg-card hover:bg-secondary text-sm font-medium"
        >
          <RotateCcw className="w-4 h-4" />
          {t("Yangilash")}
        </button>
      </div>

      <div className="table-frame rounded-2xl bg-card border border-border overflow-hidden">
        <div className="flex flex-wrap items-center gap-3 px-5 py-3 border-b border-border">
          <DateRangePicker value={range} onChange={setRange} className="w-[230px]" />
          <Select value={who} onChange={setWho} options={peopleOptions} placeholder={t("Barcha odamlar")} clearable searchable style={{ width: 230 }} />
          <Select value={section} onChange={setSection} options={sectionOptions} placeholder={t("Barcha bo'limlar")} clearable searchable style={{ width: 200 }} />
          <Select value={kind} onChange={setKind} options={kindOptions} placeholder={t("Barcha amallar")} clearable style={{ width: 200 }} />
          <SearchInput value={q} onChange={setQ} placeholder={t("Yo'l, ism, telefon, IP")} className="w-[220px]" />
          {anyFilter && (
            <button
              type="button"
              onClick={() => {
                setWho("");
                setSection("");
                setKind("");
                setQ("");
              }}
              className="text-[12px] text-muted-foreground hover:text-foreground"
            >
              {t("Tozalash")}
            </button>
          )}
          <div className="ml-auto inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-[12px] font-medium">
            <span>{t("Yozuvlar:")}</span>
            <span className="tabular-nums">{rows.length}{next ? "+" : ""}</span>
          </div>
        </div>

        {error && <p className="px-5 py-3 text-[13px] text-rose-600">{error}</p>}

        <div className="table-scroll">
          <table className="w-full text-sm min-w-[1100px]">
            <thead>
              <tr className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground border-b border-border">
                <th className="px-3 py-3 text-left w-8" />
                <th className="px-4 py-3 text-left w-32">{t("Vaqt")}</th>
                <th className="px-4 py-3 text-left">{t("Kim")}</th>
                <th className="px-4 py-3 text-left">{t("Amal")}</th>
                <th className="px-4 py-3 text-left">{t("Bo'lim")}</th>
                <th className="px-4 py-3 text-left w-24">{t("Obyekt")}</th>
                <th className="px-4 py-3 text-left">{t("Filial")}</th>
                <th className="px-4 py-3 text-left">{t("IP va qurilma")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {loading ? (
                <tr>
                  <td colSpan={8} className="py-10">
                    <SpinnerBlock />
                  </td>
                </tr>
              ) : rows.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-5 py-10 text-center text-[13px] text-muted-foreground">
                    {t("Bu oraliqda yozuv yo'q")}
                  </td>
                </tr>
              ) : (
                rows.map((r) => {
                  const isOpen = open === r.id;
                  const failed = r.denied || (typeof r.status === "number" && r.status >= 400);
                  const who = r.actor.name || r.actor.phone || (r.actor.kind === "public" ? t("Tizimga kirmagan") : "—");
                  return (
                    <Fragment key={r.id}>
                      <tr
                        onClick={() => setOpen(isOpen ? null : r.id)}
                        className={`cursor-pointer transition-colors ${isOpen ? "bg-primary/5" : "hover:bg-secondary/30"}`}
                      >
                        <td className="px-3 py-2.5 text-muted-foreground">
                          {isOpen ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                        </td>
                        <td className="px-4 py-2.5 tabular-nums">
                          <div className="font-medium">{fmtTime(r.at)}</div>
                          <div className="text-[11px] text-muted-foreground">{fmtDate(r.at)}</div>
                        </td>
                        <td className="px-4 py-2.5">
                          <div className="font-medium">{who}</div>
                          <div className="text-[11px] text-muted-foreground">
                            {t(ACTOR_KIND_LABELS[r.actor.kind] ?? r.actor.kind)}
                            {r.actor.role === "admin" ? ` · ${t("admin")}` : ""}
                          </div>
                        </td>
                        <td className="px-4 py-2.5">
                          <span className={failed ? "text-rose-600" : ""}>{t(actionLabel(r))}</span>
                          {failed && (
                            <span className="ml-1.5 inline-flex items-center rounded-full bg-rose-500/10 px-2 py-0.5 text-[11px] font-medium text-rose-600">
                              {r.denied ? t("rad etildi") : t("xato")}
                              {typeof r.status === "number" ? ` ${r.status}` : ""}
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-2.5 text-[13px]">{t(sectionLabel(r.section))}</td>
                        <td className="px-4 py-2.5 tabular-nums text-[13px]">{r.target ? `#${r.target}` : "—"}</td>
                        <td className="px-4 py-2.5 text-[12px] text-muted-foreground">
                          {typeof r.branchId === "number" ? branchName.get(r.branchId) ?? `#${r.branchId}` : "—"}
                        </td>
                        <td className="px-4 py-2.5 text-[12px] text-muted-foreground">
                          <div className="tabular-nums">{r.ip || "—"}</div>
                          {r.ua && <div className="truncate max-w-[220px]">{describeUserAgent(r.ua)}</div>}
                        </td>
                      </tr>
                      {isOpen && (
                        <tr className="bg-secondary/20">
                          <td />
                          <td colSpan={7} className="px-4 py-3">
                            <div className="grid gap-2 text-[12px]">
                              {r.path && (
                                <div>
                                  <span className="text-muted-foreground">{t("So'rov:")}</span>{" "}
                                  <code className="rounded bg-card px-1.5 py-0.5">
                                    {r.action} {r.path}
                                    {r.query ?? ""}
                                  </code>
                                </div>
                              )}
                              {r.actor.phone && (
                                <div>
                                  <span className="text-muted-foreground">{t("Telefon:")}</span> {r.actor.phone}
                                </div>
                              )}
                              {r.ua && (
                                <div className="break-all">
                                  <span className="text-muted-foreground">{t("Qurilma:")}</span> {r.ua}
                                </div>
                              )}
                              {r.details && (
                                <pre className="max-h-64 overflow-auto rounded-lg border border-border bg-card p-3 text-[11.5px] leading-relaxed">
                                  {JSON.stringify(r.details, null, 2)}
                                </pre>
                              )}
                              {r.body !== undefined && r.body !== null && (
                                <pre className="max-h-64 overflow-auto rounded-lg border border-border bg-card p-3 text-[11.5px] leading-relaxed">
                                  {JSON.stringify(r.body, null, 2)}
                                </pre>
                              )}
                              {!r.details && (r.body === undefined || r.body === null) && (
                                <div className="text-muted-foreground">{t("Qo'shimcha ma'lumot yo'q")}</div>
                              )}
                            </div>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })
              )}
            </tbody>
          </table>
          {next && !loading && (
            <div className="flex justify-center py-4">
              <button
                type="button"
                disabled={loadingMore}
                onClick={() => {
                  setLoadingMore(true);
                  void load(next);
                }}
                className="inline-flex items-center gap-2 h-9 px-4 rounded-lg border border-border bg-card hover:bg-secondary text-sm font-medium disabled:opacity-40"
              >
                {loadingMore ? t("Yuklanmoqda…") : t("Yana yuklash")}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
