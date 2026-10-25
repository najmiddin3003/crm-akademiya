"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Info, Loader2, RefreshCw, Search, ScrollText } from "lucide-react";
import { useT } from "@/components/shared/Language";
import { useBranch } from "@/components/shared/BranchContext";
import type { DateRange } from "@/components/ui/DateRangePicker";
import V2DateRange from "@/components/v2/ui/V2DateRange";
import V2Select from "@/components/v2/ui/V2Select";
import { secondaryBtn } from "@/components/v2/ui/buttons";
import { EmptyBlock, useProfileFmt } from "@/components/v2/students/profile/profileBits";
import { LOG_CATEGORIES, type LogCategory } from "@/lib/actionLogLabels";
import { collapseBranchPools } from "@/lib/branchPools";
import { AboutCard, LogRowItem, PeriodCard, type FeedRow } from "./logBits";

// YANGI VERSIYA — «AMALLAR JURNALI» (rasm «Amallar jurnali», yorug'/qorong'i, 25.10.2026, 14-qism):
//   • «Amallar jurnali», «Barcha filiallar · kim, qachon, nima qildi»; o'ngda «Ism, summa yoki guruh»;
//   • toifa chiplari (Hammasi · Moliya · O'quvchi va guruh · … soni bilan), o'ngda «Xodim: Hammasi»,
//     «Filial: Barchasi», sana oralig'i (sukut — kecha va bugun);
//   • kunlar bo'yicha («Bugun 12-oktabr, dushanba · 9 ta amal»): vaqt, toifa ikonkasi, «Ism fe'l —
//     obyekt», meta, o'ngda summa / «O'chirilgan»; tahrir bosilsa — «oldin → keyin» jadvali;
//   • o'ngda «Davr bo'yicha» (toifa chiziqlari) va «Nima yoziladi».
// Ma'lumot — GET /api/action-log/feed (lib/actionLogView.ts). Faqat admin (sahifa ham, API ham).
// Eski jadval ko'rinishi — `?classic=1` (texnik tafsilot: yo'l, IP, tana).

interface Person {
  key: string;
  name: string;
  kind: string;
  count: number;
}

interface Feed {
  total: number;
  counts: Record<string, number>;
  dayCounts: Record<string, number>;
  rows: FeedRow[];
  next: number | null;
  truncated: boolean;
  people: Person[];
}

const PAD = (n: number) => String(n).padStart(2, "0");
const isoOf = (d: Date) => `${d.getFullYear()}-${PAD(d.getMonth() + 1)}-${PAD(d.getDate())}`;

function startRange(): DateRange {
  const today = new Date();
  const t0 = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  return { start: new Date(t0.getFullYear(), t0.getMonth(), t0.getDate() - 1), end: t0 };
}

export default function ActionLogV2() {
  const { t } = useT();
  const f = useProfileFmt();
  const branch = useBranch();
  const [range, setRange] = useState<DateRange>(startRange);
  const [who, setWho] = useState("");
  const [branchId, setBranchId] = useState("");
  const [cat, setCat] = useState<LogCategory | "">("");
  const [q, setQ] = useState("");
  const [qApplied, setQApplied] = useState("");
  const [feed, setFeed] = useState<Feed | null>(null);
  const [loadedKey, setLoadedKey] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [more, setMore] = useState(false);
  const [open, setOpen] = useState<string | null>(null);
  const [version, setVersion] = useState(0);
  const seq = useRef(0);

  // Qidiruv yozib bo'lingach (0,4 s).
  useEffect(() => {
    const id = window.setTimeout(() => setQApplied(q.trim()), 400);
    return () => window.clearTimeout(id);
  }, [q]);

  const query = useMemo(() => {
    const p = new URLSearchParams();
    const s = range.start ?? new Date();
    p.set("from", isoOf(s));
    p.set("to", isoOf(range.end ?? s));
    if (who) p.set("who", who);
    if (branchId) p.set("branch", branchId);
    if (cat) p.set("cat", cat);
    if (qApplied) p.set("q", qApplied);
    return p.toString();
  }, [range, who, branchId, cat, qApplied]);
  const key = `${query}#${version}`;
  const loading = loadedKey !== key;

  useEffect(() => {
    const my = ++seq.current;
    fetch(`/api/action-log/feed?${query}`, { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => {
        if (my !== seq.current) return;
        if (!d?.ok) {
          setError(String(d?.error || "Jurnal yuklanmadi"));
          return;
        }
        setError("");
        setFeed(d as Feed);
        setOpen(null);
      })
      .catch(() => {
        if (my === seq.current) setError("Tarmoq xatosi — qayta urinib ko'ring");
      })
      .finally(() => {
        if (my === seq.current) setLoadedKey(key);
      });
  }, [query, key]);

  function loadMore() {
    if (!feed?.next || more) return;
    setMore(true);
    fetch(`/api/action-log/feed?${query}&offset=${feed.next}`, { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => {
        if (d?.ok) setFeed((prev) => (prev ? { ...prev, rows: [...prev.rows, ...(d.rows as FeedRow[])], next: d.next ?? null } : prev));
        else setError(String(d?.error || "Jurnal yuklanmadi"));
      })
      .catch(() => setError("Tarmoq xatosi — qayta urinib ko'ring"))
      .finally(() => setMore(false));
  }

  const counts: Record<string, number> = feed?.counts ?? { all: 0 };
  const chips = [{ key: "" as const, label: "Hammasi", n: counts.all ?? 0 }, ...LOG_CATEGORIES.filter((c) => (counts[c.key] ?? 0) > 0 || c.key === cat).map((c) => ({ key: c.key, label: c.label, n: counts[c.key] ?? 0 }))];

  const peopleOptions = useMemo(
    () => (feed?.people ?? []).map((p) => ({ value: p.key, label: p.name || (p.kind === "public" ? "Tizimga kirmagan" : p.kind === "system" ? "Tizim" : p.key), hint: String(p.count) })),
    [feed?.people],
  );
  const branchOptions = useMemo(() => collapseBranchPools(branch.branches).map((b) => ({ value: String(b.id), label: b.name })), [branch.branches]);

  // Kunlar bo'yicha (javob tartibida — eng yangisi tepada).
  const groups = useMemo(() => {
    const out: { day: string; rows: FeedRow[] }[] = [];
    for (const r of feed?.rows ?? []) {
      const g = out[out.length - 1];
      if (g && g.day === r.day) g.rows.push(r);
      else out.push({ day: r.day, rows: [r] });
    }
    return out;
  }, [feed?.rows]);

  const todayIso = isoOf(new Date());
  const yesterdayIso = isoOf(new Date(new Date().getFullYear(), new Date().getMonth(), new Date().getDate() - 1));
  const dayHead = (day: string) => {
    const rel = day === todayIso ? t("Bugun") : day === yesterdayIso ? t("Kecha") : "";
    return { title: rel || f.dayMonth(day), sub: rel ? `${f.dayMonth(day)}, ${f.weekday(day)}` : f.weekday(day) };
  };

  const filtersOn = Boolean(who || branchId || cat || qApplied);
  const shownCats = LOG_CATEGORIES.filter((c) => (counts[c.key] ?? 0) > 0).map((c) => c.key);

  return (
    <div data-ui="v2" className="flex min-h-full flex-col gap-4 bg-v2-surface p-4 font-v2 text-v2-text sm:p-5">
      {/* Sarlavha */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-v2-page text-v2-text">{t("Amallar jurnali")}</h1>
          <p className="mt-0.5 text-v2-small text-v2-text-2">{t("Barcha filiallar · kim, qachon, nima qildi")}</p>
        </div>
        <div className="relative w-full sm:w-[260px]">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-v2-text-3" strokeWidth={1.75} aria-hidden />
          <input
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={t("Ism, summa yoki guruh")}
            aria-label={t("Ism, summa yoki guruh")}
            className="h-9 w-full rounded-v2-md border border-v2-border-field bg-v2-surface! pl-9 pr-3 text-v2-body text-v2-text placeholder:text-v2-text-3 transition-[border-color,box-shadow] focus:border-v2-brand focus:shadow-v2-focus focus:outline-none"
          />
        </div>
      </div>

      {/* Toifalar va filtrlar */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex max-w-full items-center gap-1.5 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden" role="group" aria-label={t("Toifa")}>
          {chips.map((c) => {
            const on = cat === c.key;
            return (
              <button
                key={c.key || "all"}
                type="button"
                aria-pressed={on}
                onClick={() => setCat(c.key)}
                className={`inline-flex h-8 shrink-0 items-center gap-1.5 rounded-v2-full border px-3 text-v2-small transition-colors focus-visible:outline-none focus-visible:shadow-v2-focus ${
                  on ? "border-v2-brand bg-v2-brand-bg font-semibold text-v2-brand-text" : "border-v2-border-strong bg-v2-surface text-v2-text hover:bg-v2-surface-2"
                }`}
              >
                {t(c.label)}
                {feed && <span className={`tabular-nums ${on ? "text-v2-brand-text" : "text-v2-text-3"}`}>{c.n}</span>}
              </button>
            );
          })}
        </div>
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <V2Select variant="value" label={t("Xodim")} emptyLabel="Hammasi" value={who} onChange={setWho} options={peopleOptions} />
          <V2Select variant="value" label={t("Filial")} emptyLabel="Barchasi" value={branchId} onChange={setBranchId} options={branchOptions} searchable={false} />
          <V2DateRange value={range} onChange={setRange} allowAll={false} />
        </div>
      </div>

      {/* Ro'yxat va o'ng kartalar */}
      <div className="grid min-w-0 gap-4 lg:grid-cols-[minmax(0,1fr)_280px]">
        <section className="min-w-0 overflow-hidden rounded-v2-lg border border-v2-border bg-v2-surface shadow-v2-sm" aria-busy={loading}>
          {error && !feed ? (
            <div className="p-6">
              <EmptyBlock
                icon={<Info className="size-5" strokeWidth={1.75} aria-hidden />}
                title={t(error)}
                action={
                  <button type="button" onClick={() => setVersion((v) => v + 1)} className={secondaryBtn}>
                    <RefreshCw className="size-4" strokeWidth={1.75} aria-hidden />
                    {t("Qayta urinish")}
                  </button>
                }
              />
            </div>
          ) : !feed ? (
            <div className="space-y-4 p-5" aria-hidden>
              {Array.from({ length: 7 }, (_, i) => (
                <div key={i} className="flex items-center gap-3">
                  <div className="h-3 w-10 rounded bg-v2-skeleton" />
                  <div className="size-7 rounded-full bg-v2-skeleton" />
                  <div className="flex-1 space-y-1.5">
                    <div className="h-3 w-2/3 rounded bg-v2-skeleton" />
                    <div className="h-2.5 w-1/3 rounded bg-v2-skeleton" />
                  </div>
                </div>
              ))}
            </div>
          ) : feed.rows.length === 0 ? (
            <div className="p-6">
              <EmptyBlock
                icon={<ScrollText className="size-5" strokeWidth={1.75} aria-hidden />}
                title={filtersOn ? t("Bu filtr bo'yicha amal yo'q") : t("Bu davrda amal yo'q")}
                text={filtersOn ? undefined : t("Sana oralig'ini kengaytirib ko'ring.")}
                action={
                  filtersOn ? (
                    <button
                      type="button"
                      onClick={() => {
                        setWho("");
                        setBranchId("");
                        setCat("");
                        setQ("");
                      }}
                      className={secondaryBtn}
                    >
                      {t("Filtrlarni tozalash")}
                    </button>
                  ) : undefined
                }
              />
            </div>
          ) : (
            <div className={loading ? "opacity-60 transition-opacity" : ""}>
              {error && (
                <p role="alert" className="flex items-center gap-2 border-b border-v2-border bg-v2-danger-bg px-4 py-2 text-v2-caption font-normal text-v2-danger">
                  <Info className="size-3.5 shrink-0" strokeWidth={2} aria-hidden />
                  {t(error)}
                </p>
              )}
              {feed.truncated && (
                <p className="flex items-center gap-2 border-b border-v2-border bg-v2-warning-bg px-4 py-2 text-v2-caption font-normal text-v2-text">
                  <Info className="size-3.5 shrink-0 text-v2-warning" strokeWidth={2} aria-hidden />
                  {t("Oraliq juda katta — so'nggi 3000 ta amal hisoblandi. Sanani toraytiring.")}
                </p>
              )}
              {groups.map((g) => {
                const h = dayHead(g.day);
                return (
                  <div key={g.day} className="border-b border-v2-border pb-2 last:border-b-0">
                    <h2 className="px-4 pb-1.5 pt-4 text-v2-body">
                      <span className="font-semibold text-v2-text">{h.title}</span>{" "}
                      <span className="text-v2-small font-normal text-v2-text-2">
                        {h.sub} · {t("{n} ta amal", { n: feed.dayCounts[g.day] ?? g.rows.length })}
                      </span>
                    </h2>
                    <ul>
                      {g.rows.map((r, i) => (
                        <LogRowItem key={r.id} row={r} open={open === r.id} onToggle={() => setOpen(open === r.id ? null : r.id)} last={i === g.rows.length - 1} />
                      ))}
                    </ul>
                  </div>
                );
              })}
              {feed.next !== null && (
                <div className="flex justify-center border-t border-v2-border py-3">
                  <button type="button" onClick={loadMore} disabled={more} className={`${secondaryBtn} disabled:opacity-60`}>
                    {more && <Loader2 className="size-4 animate-spin" aria-hidden />}
                    {more ? t("Yuklanmoqda…") : t("Yana yuklash")}
                    {!more && <span className="text-v2-text-3 tabular-nums">{feed.total - feed.rows.length}</span>}
                  </button>
                </div>
              )}
            </div>
          )}
        </section>

        <aside className="flex flex-col gap-4">
          <PeriodCard counts={feed ? counts : null} />
          <AboutCard shown={shownCats.length ? shownCats : ["finance", "pupils", "auth", "deleted"]} />
        </aside>
      </div>
    </div>
  );
}
