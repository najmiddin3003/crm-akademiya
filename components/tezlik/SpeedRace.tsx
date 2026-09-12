"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Database, Gauge, MapPin, Play, Server, Trophy, Wifi } from "lucide-react";

// TEZLIK POYGASI — o'lchov va yo'laklar. Ikki joyda ishlatiladi:
//   • /tezlik sahifasi (components/tezlik/SpeedRacePage.tsx) — ommaviy,
//     mijozga havola bilan berish uchun;
//   • saytning har sahifasidagi suzuvchi robot tugmasi (SpeedFab.tsx) —
//     bosilganda shu poyga modalda ochiladi.
//
// Eski server — Vercel'dagi nusxa (Singapur, texnik domen; 12.09.2026
// gacha prod shu edi), yangi — Eskiz VPS (Toshkent). Ikkalasida BIR XIL
// kod turadi (GitHub'ga push — Vercel ham o'zi quradi), ya'ni farq faqat
// infratuzilmada: masofa va bazaning joylashuvi.
//
// Uch bosqich, har yo'lakda ketma-ket (ikki yo'lak parallel):
//   1) Ulanish      — /api/health/ping (birinchi so'rov: TCP + TLS + javob)
//   2) Bazadan javob— /api/health/db   (server bazaga bitta so'rov qiladi,
//                     o'z vaqtini ham qaytaradi — "server → baza" masofasi)
//   3) Sahifa       — /                (login sahifasining HTML'i)
// Eski server uchun `/` boshqa origin'dan `no-cors` bilan olinadi — javob
// o'qilmaydi, lekin vaqt o'lchanadi. /api/health/* esa CORS "*" beradi.
//
// Yangi yo'lak HAR DOIM prod VPS: sahifa localhost'dan ochilsa ham
// (dev server kodni yo'l-yo'lakay kompilyatsiya qiladi, bazasi Atlas)
// o'lchov www.tizimli24.uz ga boradi — aks holda "yangi server" deb dev
// server ko'rsatilib chalg'itardi. Prod domenining o'zida — o'sha origin.
//
// ADOLAT — ISITISH. Sahifa yangi serverdan kelgani uchun unga ulanish
// (DNS, TLS, HTTP/2) allaqachon ochiq, eski server esa boshqa domen —
// sovuq ulanish Singapurga qo'shimcha 2 ta borib-kelish qo'shardi va
// "farq faqat masofada" degan gap yolg'on bo'lardi. Shu sabab o'lchovdan
// OLDIN ikkalasiga ham hisobga olinmaydigan bitta ping yuboriladi
// (`warmUp`), keyin uchala bosqich issiq ulanishda o'lchanadi. Ya'ni
// "Javob" bosqichi — sof borib-kelish, TLS emas.

const OLD_BASE = "https://crm-akademiya-777777.vercel.app";
const NEW_BASE = "https://www.tizimli24.uz";

type StepKey = "connect" | "db" | "page";
const STEPS: { key: StepKey; label: string; icon: typeof Wifi }[] = [
  { key: "connect", label: "Javob (ping)", icon: Wifi },
  { key: "db", label: "Bazadan javob", icon: Database },
  { key: "page", label: "Sahifa", icon: Gauge },
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
  /** Isitish so'rovi ketmoqda (hisobga olinmaydi). */
  warming: boolean;
  done: boolean;
}

const EMPTY_STEPS = (): Record<StepKey, StepResult> => ({ connect: { ms: null }, db: { ms: null }, page: { ms: null } });

/**
 * Vaqt HAR DOIM sekundda, vergul bilan (oddiy foydalanuvchi "ms" ni
 * bilmaydi): 1250 → "1,25 s", 148 → "0,15 s", 3 → "0,003 s"
 * (0,1 s dan kichigi uch xona bilan, aks holda "0,00 s" bo'lib qolardi).
 */
export function fmtTime(ms: number | null): string {
  if (ms === null) return "—";
  const sec = ms / 1000;
  return `${sec.toFixed(sec < 0.1 ? 3 : 2).replace(".", ",")} s`;
}

export async function timed(url: string, opts: RequestInit = {}, timeoutMs = 20_000): Promise<{ ms: number; body?: { dbMs?: number } }> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
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

/** Ikkala serverning manzili — TapTest.tsx ham shu qoidani ishlatadi. */
export function laneBases(): { old: string; new: string } {
  const host = window.location.hostname;
  const newBase = host === "tizimli24.uz" || host.endsWith(".tizimli24.uz") ? window.location.origin : NEW_BASE;
  return { old: OLD_BASE, new: newBase };
}

/** Hisobga olinmaydigan isitish so'rovi — ulanish ochilsin (xato bo'lsa ham davom etiladi). */
export async function warmUp(base: string): Promise<void> {
  try { await timed(`${base}/api/health/ping`, {}, 8_000); } catch { /* sovuq qoladi — o'lchov baribir ketadi */ }
}

function makeLanes(): Lane[] {
  const b = laneBases();
  return [
    { key: "old", name: "Eski server", place: "Vercel · Singapur", base: b.old, steps: EMPTY_STEPS(), running: false, warming: false, done: false },
    { key: "new", name: "Yangi server", place: "Eskiz VPS · Toshkent", base: b.new, steps: EMPTY_STEPS(), running: false, warming: false, done: false },
  ];
}

/**
 * Ikki yo'lak + xulosa + "Yana yugurtir". `compact` — modal ichida
 * (kichikroq raqamlar, kamroq bo'shliq).
 */
export default function SpeedRace({ compact = false }: { compact?: boolean }) {
  const [lanes, setLanes] = useState<Lane[]>([]);
  const [elapsed, setElapsed] = useState<Record<string, number>>({});
  const [runs, setRuns] = useState(0);
  const startedAt = useRef<Record<string, number>>({});
  const raf = useRef<number | null>(null);

  const patch = (key: Lane["key"], fn: (l: Lane) => Lane) =>
    setLanes((prev) => prev.map((l) => (l.key === key ? fn(l) : l)));

  const runLane = useCallback(async (lane: Lane) => {
    patch(lane.key, (l) => ({ ...l, steps: EMPTY_STEPS(), running: false, warming: true, done: false }));
    await warmUp(lane.base);
    startedAt.current[lane.key] = performance.now();
    patch(lane.key, (l) => ({ ...l, warming: false, running: true }));
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
  }, [runLane]);

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

  // Ochilishi bilan poyga boshlanadi. setTimeout — effekt tanasida
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
  const comparable = allDone && !!oldTotal && !!newTotal && newTotal > 0 && !!old && !!neu
    && !STEPS.some((s) => old.steps[s.key].error || neu.steps[s.key].error);
  const ratio = comparable ? oldTotal / newTotal : null;
  // G'olib — HAQIQATAN tez chiqqani. Teng bo'lsa (±5 %) — hech kim.
  const winner: Lane["key"] | null = ratio === null ? null : ratio >= 1.05 ? "new" : ratio <= 0.95 ? "old" : null;
  const maxStep = (key: StepKey) => Math.max(1, ...lanes.map((l) => l.steps[key].ms ?? 0));

  return (
    <div className={compact ? "space-y-3" : "space-y-6"}>
      <div className={compact ? "grid gap-3 sm:grid-cols-2" : "grid gap-4 sm:grid-cols-2"}>
        {lanes.map((lane) => {
          const isNew = lane.key === "new";
          const t = total(lane);
          const live = lane.running ? elapsed[lane.key] ?? 0 : t;
          const failed = lane.done && STEPS.every((s) => lane.steps[s.key].error);
          return (
            <section
              key={lane.key}
              className={`rounded-2xl border bg-card ${compact ? "p-4 space-y-3" : "p-5 space-y-4"} ${isNew ? "border-primary/50 ring-1 ring-primary/20" : "border-border"}`}
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
                {winner === lane.key && (
                  <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[12px] font-semibold ${isNew ? "bg-primary/10 text-primary" : "bg-secondary text-foreground"}`}>
                    <Trophy className="w-3.5 h-3.5" /> g&apos;olib
                  </span>
                )}
              </div>

              <div className="tabular-nums">
                <div className={`${compact ? "text-3xl" : "text-4xl"} font-bold leading-none ${isNew && winner !== "old" ? "text-primary" : ""}`}>
                  {lane.warming ? "…" : failed ? "—" : fmtTime(live ?? null)}
                </div>
                <div className="mt-1 text-[12px] text-muted-foreground">
                  {lane.warming ? "ulanish isitilmoqda…" : lane.running ? "o'lchanmoqda…" : failed ? "server javob bermadi" : lane.done ? "jami (uch bosqich)" : ""}
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
                            <span className="text-[11px] opacity-70">· bazaning o&apos;zi {fmtTime(r.serverMs)}</span>
                          )}
                        </span>
                        <span className="font-medium tabular-nums">{r.error ? "xato" : fmtTime(r.ms)}</span>
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

      <section className={`rounded-2xl border border-border bg-card ${compact ? "p-4" : "p-5"} flex flex-col sm:flex-row items-center justify-between gap-4`}>
        <div className="text-center sm:text-left">
          {ratio !== null ? (
            <>
              <div className="text-lg font-semibold">
                {winner === "new" && <>Yangi server <span className="text-primary">{ratio.toFixed(1).replace(".", ",")} barobar</span> tez</>}
                {winner === "old" && <>Bu safar eski server <span className="text-primary">{(1 / ratio).toFixed(1).replace(".", ",")} barobar</span> tez chiqdi</>}
                {winner === null && <>Bu safar deyarli teng chiqdi</>}
              </div>
              <div className="text-[13px] text-muted-foreground">
                {fmtTime(oldTotal)} → {fmtTime(newTotal)} · {runs}-o&apos;lchov, sizning tarmog&apos;ingizdan
                {winner !== "new" && " · tarmoq tebranishi bo'lishi mumkin, yana yugurtiring"}
              </div>
            </>
          ) : allDone ? (
            <div className="text-[13px] text-muted-foreground">
              {old && STEPS.some((s) => old.steps[s.key].error)
                ? <>Eski server javob bermadi — taqqoslab bo&apos;lmadi. Yangi server: {fmtTime(newTotal)}.</>
                : <>Yangi server javob bermadi — yana yugurtirib ko&apos;ring.</>}
            </div>
          ) : (
            <div className="text-[13px] text-muted-foreground">Poyga ketmoqda…</div>
          )}
        </div>
        <button
          type="button"
          onClick={() => void race()}
          disabled={lanes.some((l) => l.running || l.warming)}
          className="inline-flex items-center gap-2 h-10 px-5 rounded-lg bg-primary text-white text-sm font-medium hover:opacity-90 disabled:opacity-60 shrink-0"
        >
          <Play className="w-4 h-4" /> Yana yugurtir
        </button>
      </section>
    </div>
  );
}

/** "Nega tez?" — sahifada ham, modalda ham bir xil uch qator. */
export function WhyFast({ compact = false }: { compact?: boolean }) {
  return (
    <section className={`rounded-2xl border border-border bg-card ${compact ? "p-4" : "p-5"}`}>
      <h2 className="text-[15px] font-semibold mb-2">Nega tez?</h2>
      <ul className="space-y-1.5 text-[13.5px] text-muted-foreground list-disc pl-5">
        <li>Server endi <span className="text-foreground font-medium">Toshkentda</span> (TAS-IX) — so&apos;rov Singapurga borib kelmaydi.</li>
        <li>Ma&apos;lumotlar bazasi ham <span className="text-foreground font-medium">server yonida, Toshkentda</span>. (Eski serverda ham baza yonida edi — lekin ikkalasi Singapurda.)</li>
        <li>Kod ikkala serverda bir xil, o&apos;lchovdan oldin ikkalasiga ham ulanish isitiladi — farq faqat masofada. Natija internet tezligingizga ham bog&apos;liq; qayta yugurtirib ko&apos;ring.</li>
      </ul>
    </section>
  );
}
