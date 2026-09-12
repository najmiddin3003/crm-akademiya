"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { CircleHelp, Fingerprint, Rabbit, RotateCcw, Turtle } from "lucide-react";
import { fmtTime, laneBases, timed, warmUp } from "@/components/tezlik/SpeedRace";
import { burstConfetti } from "@/lib/confetti";

// BARMOQ SINOVI — oddiy foydalanuvchi uchun, so'z bilan.
//
// Foydalanuvchi doirani ketma-ket 2 marta bosadi. 1-BOSISHDA ikkala
// serverga bittadan so'rov (/api/health/db) ketadi; 2-bosish faqat
// vaqtni belgilaydi (so'rov yuborilmaydi — baholanmaydigan so'rov behuda).
// Server "ulgurdi" — javobi 2-bosishdan OLDIN kelgan bo'lsa.
//
// HALOLLIK QOIDALARI (12.09.2026 dagi tekshiruvdan keyin):
//   • Bosish oralig'i O'LCHANADI va matn shunga qarab yoziladi: juda tez
//     bosilsa (< 0,15 s) — "hech kim ulgurmaydi, sekinroq bosing", sekin
//     bosilsa (> 1,2 s) — "hamma ulguradi, tezroq bosing"; server haqida
//     xulosa faqat o'rtacha oraliqda. Ilgari bunda internet ayblanardi.
//   • Xato (tarmoq, 500, vaqt tugashi) — "ulgurmadi" EMAS, alohida holat:
//     "javob kelmadi — xulosa yo'q". Timeout 10 s (ilgari umuman yo'q edi).
//   • Isitish: sahifa yangi serverdan kelgani uchun unga ulanish ochiq,
//     eski serverga esa sovuq — sinovdan oldin ikkalasiga ham hisobga
//     olinmaydigan ping yuboriladi (SpeedRace.warmUp), doira shungacha
//     "tayyorlanmoqda".
// Millisekund yo'q — hamma vaqt sekundda (fmtTime).

const TAPS = 2;
const TOO_FAST_S = 0.15;
const TOO_SLOW_S = 1.2;

// Juda tez bosganga — maqtov (tasodifiy), ustiga qog'ozlar sochiladi.
const QUICK_PRAISE = [
  "Voy, siz tezkorsiz!",
  "Barmog'ingiz chaqmoqdek!",
  "Chempion barmoq!",
  "Bu tezlikka server ham hayron!",
];
type LaneKey = "old" | "new";

interface Probe {
  /** Javob vaqti (bosishdan), soniya; null — hali kelmadi. */
  sec: number | null;
  error: boolean;
}

const LANES: { key: LaneKey; name: string; place: string }[] = [
  { key: "new", name: "Yangi server", place: "Toshkent" },
  { key: "old", name: "Eski server", place: "Singapur" },
];

type Verdict = "fast" | "slow" | "error" | "wait";

export default function TapTest({ compact = false }: { compact?: boolean }) {
  const [ready, setReady] = useState(false);
  const [taps, setTaps] = useState<number[]>([]);
  const [probe, setProbe] = useState<Record<LaneKey, Probe>>({ old: { sec: null, error: false }, new: { sec: null, error: false } });
  const [showNumbers, setShowNumbers] = useState(false);
  const [praise, setPraise] = useState(QUICK_PRAISE[0]);
  const celebrated = useRef(false);
  // "Yana" bosilgach kechikib kelgan eski javoblar yangi turga yopishmasin.
  const round = useRef(0);
  const bases = useRef<Record<LaneKey, string> | null>(null);

  // Isitish — ikkala serverga ham, hisobga olinmaydi.
  useEffect(() => {
    let alive = true;
    const b = laneBases();
    bases.current = b;
    Promise.allSettled([warmUp(b.old), warmUp(b.new)]).then(() => { if (alive) setReady(true); });
    return () => { alive = false; };
  }, []);

  const tap = useCallback(() => {
    if (!ready || taps.length >= TAPS || !bases.current) return;
    const now = performance.now();
    setTaps((t) => [...t, now]);
    if (taps.length > 0) return; // oxirgi bosish — faqat vaqt
    const myRound = round.current;
    for (const lane of LANES) {
      timed(`${bases.current[lane.key]}/api/health/db`, {}, 10_000).then(
        (r) => { if (myRound === round.current) setProbe((p) => ({ ...p, [lane.key]: { sec: r.ms / 1000, error: false } })); },
        () => { if (myRound === round.current) setProbe((p) => ({ ...p, [lane.key]: { sec: null, error: true } })); },
      );
    }
  }, [ready, taps.length]);

  const reset = () => {
    round.current += 1;
    celebrated.current = false;
    setPraise(QUICK_PRAISE[Math.floor(Math.random() * QUICK_PRAISE.length)]);
    setTaps([]);
    setProbe({ old: { sec: null, error: false }, new: { sec: null, error: false } });
  };

  const finished = taps.length >= TAPS;
  const gapSec = finished ? (taps[1] - taps[0]) / 1000 : null;
  const tooFast = gapSec !== null && gapSec < TOO_FAST_S;
  const tooSlow = gapSec !== null && gapSec > TOO_SLOW_S;

  const verdictOf = (lane: LaneKey): Verdict => {
    const p = probe[lane];
    if (p.error) return "error";
    if (p.sec === null || gapSec === null) return "wait";
    return p.sec <= gapSec ? "fast" : "slow";
  };
  const vNew = finished ? verdictOf("new") : "wait";
  const vOld = finished ? verdictOf("old") : "wait";
  const waiting = vNew === "wait" || vOld === "wait";

  const headline = (() => {
    if (!finished) return null;
    if (waiting) return "Javoblar kelmoqda…";
    if (vNew === "error" && vOld === "error") return "Ikkala server ham javob bermadi — internet uzilgan bo'lishi mumkin, yana urinib ko'ring.";
    if (vNew === "error") return "Yangi server javob bermadi — xulosa chiqarib bo'lmadi, yana urinib ko'ring.";
    if (tooFast) return `${praise} ${fmtTime(gapSec! * 1000)} — bunga hech qaysi server ulgurmaydi. Biroz sekinroq bosib ko'ring.`;
    if (tooSlow) return `Sekin bosdingiz (${fmtTime(gapSec! * 1000)}) — bunday oraliqda deyarli har qanday server ulguradi. Tezroq bosib ko'ring.`;
    if (vOld === "error") return vNew === "fast" ? "Yangi server barmog'ingizdan tez! (Eski server javob bermadi — taqqoslab bo'lmadi.)" : "Yangi server ulgurmadi; eski server javob bermadi.";
    if (vNew === "fast" && vOld === "slow") return "Yangi server barmog'ingizdan tez, eski — ulgurmadi.";
    if (vNew === "fast" && vOld === "fast") {
      const n = probe.new.sec!, o = probe.old.sec!;
      return n * 1.5 < o ? "Ikkalasi ham ulgurdi — lekin yangi server ancha oldinroq javob berdi." : "Ikkalasi ham ulgurdi, deyarli bir vaqtda.";
    }
    if (vNew === "slow" && vOld === "slow") return "Bu safar ikkalasi ham ulgurmadi — yana urinib ko'ring.";
    return "Bu safar eski server ulgurdi, yangisi — yo'q. Tarmoq tebrangan bo'lishi mumkin, yana urinib ko'ring.";
  })();

  // Bayram: juda tez bosganga ham, yangi server yutganda ham — bir marta.
  const celebrate = finished && !waiting && (tooFast || (!tooSlow && vNew === "fast" && vOld !== "fast" && vOld !== "error"));
  useEffect(() => {
    if (!celebrate || celebrated.current) return;
    celebrated.current = true;
    burstConfetti();
  }, [celebrate]);

  const cardText = (lane: LaneKey, v: Verdict): string => {
    const p = probe[lane];
    switch (v) {
      case "fast": return `ulgurdi — javob ${fmtTime(p.sec! * 1000)} da keldi, siz ${fmtTime(gapSec! * 1000)} da bosdingiz`;
      case "slow": return `ulgurmadi — javob ${fmtTime(p.sec! * 1000)} da keldi, siz ${fmtTime(gapSec! * 1000)} da bosdingiz`;
      case "error": return "javob kelmadi (xato yoki 10 s vaqt tugadi) — bu server haqida xulosa yo'q";
      default: return "javob kutilmoqda…";
    }
  };

  return (
    <section className={`rounded-2xl border border-border bg-card ${compact ? "p-4 space-y-4" : "p-5 space-y-5"}`}>
      <div className="text-center">
        <h2 className="text-[15px] font-semibold">Barmoq sinovi</h2>
        <p className="text-[13px] text-muted-foreground mt-0.5">
          Doirani ketma-ket <span className="font-medium text-foreground">{TAPS} marta</span>{" "}bosing. Server sizning barmog&apos;ingizdan tezmi — ko&apos;ramiz.
        </p>
      </div>

      <div className="flex justify-center">
        <button
          type="button"
          onClick={tap}
          disabled={!ready || finished}
          aria-label="Bu yerga bosing"
          className={`relative w-32 h-32 rounded-full border-4 flex flex-col items-center justify-center select-none transition-transform active:scale-95
            ${!ready || finished ? "border-border bg-secondary text-muted-foreground" : "border-primary/40 bg-primary/10 text-primary hover:bg-primary/15 cursor-pointer"}`}
          style={{ touchAction: "manipulation" }}
        >
          {ready && !finished && <span className="absolute inset-0 rounded-full border-2 border-primary/30 animate-ping" style={{ animationDuration: "1.8s" }} />}
          <Fingerprint className="w-8 h-8" />
          <span className="mt-1 text-2xl font-bold tabular-nums leading-none">
            {Math.min(taps.length, TAPS)}<span className="text-base font-medium opacity-60">/{TAPS}</span>
          </span>
          <span className="mt-1 text-[12px]">{!ready ? "tayyorlanmoqda…" : finished ? "tugadi" : taps.length === 0 ? "bosing" : "yana bosing"}</span>
        </button>
      </div>

      {finished && (
        <div className="space-y-3">
          <div className="text-center text-[15px] font-semibold">{headline}</div>
          {!tooFast && !tooSlow && (
            <ul className="space-y-2">
              {LANES.map((lane) => {
                const v = lane.key === "new" ? vNew : vOld;
                const Icon = v === "fast" ? Rabbit : v === "slow" ? Turtle : CircleHelp;
                const tone = v === "fast"
                  ? "border-emerald-300 bg-emerald-50 text-emerald-900 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-200"
                  : v === "slow"
                    ? "border-red-300 bg-red-50 text-red-900 dark:border-red-900 dark:bg-red-950/40 dark:text-red-200"
                    : "border-border bg-secondary text-muted-foreground";
                return (
                  <li key={lane.key} className={`rounded-xl border px-3 py-2.5 flex items-center gap-3 ${tone}`}>
                    <Icon className="w-6 h-6 shrink-0" />
                    <div className="min-w-0">
                      <div className="text-[14px] font-semibold">{lane.name} <span className="font-normal opacity-70">· {lane.place}</span></div>
                      <div className="text-[12.5px] opacity-90">{cardText(lane.key, v)}</div>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
          {showNumbers && gapSec !== null && (
            <div className="text-[12px] text-muted-foreground text-center tabular-nums">
              Ikki bosish orasi {fmtTime(gapSec * 1000)} · javob: yangi {probe.new.error ? "xato" : fmtTime(probe.new.sec === null ? null : probe.new.sec * 1000)} · eski {probe.old.error ? "xato" : fmtTime(probe.old.sec === null ? null : probe.old.sec * 1000)}
            </div>
          )}
          <div className="flex items-center justify-center gap-4">
            <button type="button" onClick={reset} className="inline-flex items-center gap-1.5 h-9 px-4 rounded-lg border border-border bg-card hover:bg-secondary text-[13px] font-medium">
              <RotateCcw className="w-3.5 h-3.5" /> Yana
            </button>
            <button type="button" onClick={() => setShowNumbers((v) => !v)} className="text-[12px] text-muted-foreground hover:text-foreground underline underline-offset-2">
              {showNumbers ? "Raqamlarni yashirish" : "Raqamlar"}
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
