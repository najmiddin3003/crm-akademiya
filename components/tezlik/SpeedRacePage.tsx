"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Database, Gauge, MapPin, Play, Server, Trophy, Wifi } from "lucide-react";

// TEZLIK POYGASI — /tezlik (ommaviy, loginsiz).
//
// Maqsad: mijozga "sayt tezlashdi" deb aytish o'rniga UNING O'Z
// qurilmasidan ikkala serverga bir vaqtda so'rov yuborib, millisekundlarni
// jonli ko'rsatish. Eski server — Vercel'dagi nusxa (Singapur, texnik
// domen; 12.09.2026 gacha prod shu edi), yangi — Eskiz VPS (Toshkent).
// Ikkalasida BIR XIL kod turadi (GitHub'ga push — Vercel ham o'zi quradi),
// ya'ni farq faqat infratuzilmada: masofa va bazaning joylashuvi.
//
// Uch bosqich, har yo'lakda ketma-ket (ikki yo'lak parallel):
//   1) Ulanish      — /api/health/ping (birinchi so'rov: TCP + TLS + javob)
//   2) Bazadan javob— /api/health/db   (server bazaga bitta so'rov qiladi,
//                     o'z vaqtini ham qaytaradi — "server → baza" masofasi)
//   3) Sahifa       — /                (login sahifasining HTML'i)
// Eski server uchun `/` boshqa origin'dan `no-cors` bilan olinadi — javob
// o'qilmaydi, lekin vaqt o'lchanadi. /api/health/* esa CORS "*" beradi.
//
// Raqamlar mijozning tarmog'iga bog'liq — sahifa buni ochiq aytadi.

const OLD_BASE = "https://crm-akademiya-777777.vercel.app";
const NEW_BASE_FALLBACK = "https://www.tizimli24.uz";

type StepKey = "connect" | "db" | "page";
const STEPS: { key: StepKey; label: string; hint: string; icon: typeof Wifi }[] = [
  { key: "connect", label: "Ulanish", hint: "brauzer → server → brauzer", icon: Wifi },
  { key: "db", label: "Bazadan javob", hint: "server bazadan bitta yozuv o'qiydi", icon: Database },
  { key: "page", label: "Sahifa", hint: "kirish sahifasi yuklanadi", icon: Gauge },
];

interface StepResult {
  ms: number | null;
  /** Serverning o'zi o'lchagan baza vaqti (faqat "db" bosqichida). */
  serverMs?: number;
  error?: boolean;
}
interface Lane {
  key: "old" | "new";
  name: string;
  place: string;
  base: string;
  steps: Record<StepKey, StepResult>;
  running: boolean;
  done: boolean;
}

const EMPTY_STEPS = (): Record<StepKey, StepResult> => ({ connect: { ms: null }, db: { ms: null }, page: { ms: null } });

function fmt(ms: number | null): string {
  if (ms === null) return "—";
  return ms >= 1000 ? `${(ms / 1000).toFixed(2)} s` : `${Math.round(ms)} ms`;
}

async function timed(url: string, opts: RequestInit = {}): Promise<{ ms: number; body?: { dbMs?: number } }> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 20_000);
  const t0 = performance.now();
  try {
    const res = await fetch(`${url}${url.includes("?") ? "&" : "?"}t=${Date.now()}`, { cache: "no-store", signal: ctrl.signal, ...opts });
    let body: { dbMs?: number } | undefined;
    if (res.type !== "opaque") {
      if (!res.ok) throw new Error(String(res.status));
      try { body = (await res.json()) as { dbMs?: number }; } catch { body = undefined; }
    }
    return { ms: performance.now() - t0, body };
  } finally {
    clearTimeout(timer);
  }
}

export default function SpeedRacePage() {
  const [lanes, setLanes] = useState<Lane[]>([]);
  const [elapsed, setElapsed] = useState<Record<string, number>>({});
  const [runs, setRuns] = useState(0);
  const startedAt = useRef<Record<string, number>>({});
  const raf = useRef<number | null>(null);

  // Yangi server — sahifa ochilgan origin (dev'da localhost, prodda
  // www.tizimli24.uz). Sahifa tasodifan Vercel'dan ochilsa — prod domeni.
  const makeLanes = useCallback((): Lane[] => {
    const here = window.location.origin;
    const newBase = window.location.hostname.endsWith("vercel.app") ? NEW_BASE_FALLBACK : here;
    return [
      { key: "old", name: "Eski server", place: "Vercel · Singapur", base: OLD_BASE, steps: EMPTY_STEPS(), running: false, done: false },
      { key: "new", name: "Yangi server", place: "Eskiz VPS · Toshkent", base: newBase, steps: EMPTY_STEPS(), running: false, done: false },
    ];
  }, []);

  const patch = (key: Lane["key"], fn: (l: Lane) => Lane) =>
    setLanes((prev) => prev.map((l) => (l.key === key ? fn(l) : l)));

  const runLane = useCallback(async (lane: Lane) => {
    startedAt.current[lane.key] = performance.now();
    patch(lane.key, (l) => ({ ...l, steps: EMPTY_STEPS(), running: true, done: false }));
    for (const step of STEPS) {
      try {
        const r =
          step.key === "connect" ? await timed(`${lane.base}/api/health/ping`)
          : step.key === "db" ? await timed(`${lane.base}/api/health/db`)
          : await timed(`${lane.base}/`, { mode: "no-cors" });
        patch(lane.key, (l) => ({ ...l, steps: { ...l.steps, [step.key]: { ms: r.ms, serverMs: r.body?.dbMs } } }));
      } catch {
        patch(lane.key, (l) => ({ ...l, steps: { ...l.steps, [step.key]: { ms: null, error: true } } }));
      }
    }
    delete startedAt.current[lane.key];
    patch(lane.key, (l) => ({ ...l, running: false, done: true }));
  }, []);

  const race = useCallback(async () => {
    const fresh = makeLanes();
    setLanes(fresh);
    setElapsed({});
    setRuns((n) => n + 1);
    await Promise.all(fresh.map((l) => runLane(l)));
  }, [makeLanes, runLane]);

  // Jonli sekundomer — yo'lak ishlayotganda o'tgan vaqt.
  useEffect(() => {
    const tick = () => {
      const now = performance.now();
      const e: Record<string, number> = {};
      for (const [k, t] of Object.entries(startedAt.current)) e[k] = now - t;
      if (Object.keys(e).length) setElapsed(e);
      raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
    return () => { if (raf.current) cancelAnimationFrame(raf.current); };
  }, []);

  // Sahifa ochilishi bilan poyga boshlanadi. setTimeout — effekt tanasida
  // to'g'ridan-to'g'ri setState chaqirilmasin (react-hooks qoidasi).
  useEffect(() => {
    const id = setTimeout(() => { void race(); }, 0);
    return () => clearTimeout(id);
  }, [race]);

  const total = (l: Lane) => {
    const vals = STEPS.map((s) => l.steps[s.key].ms).filter((v): v is number => v !== null);
    return vals.length ? vals.reduce((a, b) => a + b, 0) : null;
  };
  const old = lanes.find((l) => l.key === "old");
  const neu = lanes.find((l) => l.key === "new");
  const oldTotal = old ? total(old) : null;
  const newTotal = neu ? total(neu) : null;
  const allDone = lanes.length > 0 && lanes.every((l) => l.done);
  const ratio = allDone && oldTotal && newTotal && newTotal > 0 && old && !STEPS.some((s) => old.steps[s.key].error) ? oldTotal / newTotal : null;
  const maxStep = (key: StepKey) => Math.max(1, ...lanes.map((l) => l.steps[key].ms ?? 0));

  return (
    <main className="min-h-screen px-4 py-8 sm:py-12">
      <div className="mx-auto max-w-3xl space-y-6">
        <header className="text-center space-y-2">
          <div className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1 text-[12px] text-muted-foreground">
            <Gauge className="w-3.5 h-3.5" /> Tizimli · jonli o&apos;lchov
          </div>
          <h1 className="text-2xl sm:text-3xl font-semibold">Tezlik poygasi</h1>
          <p className="text-sm text-muted-foreground max-w-xl mx-auto">
            Sizning qurilmangizdan ikkala serverga bir vaqtda so&apos;rov yuboriladi. Raqamlar shu yerda, hozir o&apos;lchanmoqda — taxmin emas.
          </p>
        </header>

        <div className="grid gap-4 sm:grid-cols-2">
          {lanes.map((lane) => {
            const isNew = lane.key === "new";
            const t = total(lane);
            const live = lane.running ? elapsed[lane.key] ?? 0 : t;
            const failed = lane.done && STEPS.every((s) => lane.steps[s.key].error);
            return (
              <section
                key={lane.key}
                className={`rounded-2xl border bg-card p-5 space-y-4 ${isNew ? "border-primary/50 ring-1 ring-primary/20" : "border-border"}`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2 text-[15px] font-semibold">
                      <Server className={`w-4 h-4 ${isNew ? "text-primary" : "text-muted-foreground"}`} />
                      {lane.name}
                    </div>
                    <div className="mt-0.5 flex items-center gap-1 text-[12px] text-muted-foreground">
                      <MapPin className="w-3 h-3" /> {lane.place}
                    </div>
                  </div>
                  {ratio !== null && isNew && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2.5 py-1 text-[12px] font-semibold text-primary">
                      <Trophy className="w-3.5 h-3.5" /> g&apos;olib
                    </span>
                  )}
                </div>

                <div className="tabular-nums">
                  <div className={`text-4xl font-bold leading-none ${isNew ? "text-primary" : ""}`}>
                    {failed ? "—" : fmt(live ?? null)}
                  </div>
                  <div className="mt-1 text-[12px] text-muted-foreground">
                    {lane.running ? "o'lchanmoqda…" : failed ? "server javob bermadi" : lane.done ? "jami (uch bosqich)" : ""}
                  </div>
                </div>

                <ul className="space-y-2.5">
                  {STEPS.map((s) => {
                    const r = lane.steps[s.key];
                    const width = r.ms === null ? 0 : Math.max(4, (r.ms / maxStep(s.key)) * 100);
                    const Icon = s.icon;
                    return (
                      <li key={s.key}>
                        <div className="flex items-center justify-between text-[12.5px]">
                          <span className="inline-flex items-center gap-1.5 text-muted-foreground">
                            <Icon className="w-3.5 h-3.5" /> {s.label}
                            {s.key === "db" && r.serverMs !== undefined && (
                              <span className="text-[11px] opacity-70">· bazaning o&apos;zi {fmt(r.serverMs)}</span>
                            )}
                          </span>
                          <span className="font-medium tabular-nums">{r.error ? "xato" : fmt(r.ms)}</span>
                        </div>
                        <div className="mt-1 h-2 rounded-full bg-secondary overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-[width] duration-700 ease-out ${isNew ? "bg-primary" : "bg-muted-foreground/50"}`}
                            style={{ width: `${width}%` }}
                          />
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </section>
            );
          })}
        </div>

        <section className="rounded-2xl border border-border bg-card p-5 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="text-center sm:text-left">
            {ratio !== null ? (
              <>
                <div className="text-lg font-semibold">
                  Yangi server <span className="text-primary">{ratio.toFixed(1).replace(".", ",")} barobar</span> tez
                </div>
                <div className="text-[13px] text-muted-foreground">
                  {fmt(oldTotal)} → {fmt(newTotal)} · {runs}-o&apos;lchov, sizning tarmog&apos;ingizdan
                </div>
              </>
            ) : allDone ? (
              <div className="text-[13px] text-muted-foreground">
                Eski server javob bermadi — taqqoslab bo&apos;lmadi. Yangi server: {fmt(newTotal)}.
              </div>
            ) : (
              <div className="text-[13px] text-muted-foreground">Poyga ketmoqda…</div>
            )}
          </div>
          <button
            type="button"
            onClick={() => void race()}
            disabled={lanes.some((l) => l.running)}
            className="inline-flex items-center gap-2 h-10 px-5 rounded-lg bg-primary text-white text-sm font-medium hover:opacity-90 disabled:opacity-60"
          >
            <Play className="w-4 h-4" /> Yana yugurtir
          </button>
        </section>

        <section className="rounded-2xl border border-border bg-card p-5">
          <h2 className="text-[15px] font-semibold mb-2">Nega tez?</h2>
          <ul className="space-y-1.5 text-[13.5px] text-muted-foreground list-disc pl-5">
            <li>Server endi <span className="text-foreground font-medium">Toshkentda</span> (TAS-IX) — so&apos;rov Singapurga borib kelmaydi.</li>
            <li>Ma&apos;lumotlar bazasi <span className="text-foreground font-medium">serverning o&apos;zida</span> — har so&apos;rov 120 ms o&apos;rniga 3 ms.</li>
            <li>Kod ikkala serverda bir xil — farq faqat masofada. Natija internet tezligingizga ham bog&apos;liq; qayta yugurtirib ko&apos;ring.</li>
          </ul>
        </section>
      </div>
    </main>
  );
}
