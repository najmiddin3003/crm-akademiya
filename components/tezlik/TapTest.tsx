"use client";

import { useCallback, useRef, useState } from "react";
import { Fingerprint, Rabbit, RotateCcw, Turtle } from "lucide-react";
import { laneBases, fmtTime } from "@/components/tezlik/SpeedRace";

// BARMOQ SINOVI — oddiy foydalanuvchi uchun, raqamsiz.
//
// Foydalanuvchi doirani ketma-ket 2 marta bosadi (avval 3 edi — ko'p
// tuyuldi). Har bosishda ikkala serverga bittadan so'rov (/api/health/db)
// ketadi. Server "ulgurdi" deb hisoblanadi, agar 1-bosishga javobi
// 2-bosishdan OLDIN kelsa (oxirgi bosishdan keyin bosish yo'q). Odam ikki
// bosish orasida ~200–400 ms sarflaydi: Toshkentdagi server (~50 ms)
// ulguradi, Singapurdagi (~500 ms) — yo'q. Natija so'z bilan: quyon/toshbaqa.
// Millisekundlar faqat "Raqamlar" tugmasi ostida — qiziquvchilar uchun.

const TAPS = 2;
type LaneKey = "old" | "new";

interface Shot {
  tapAt: number;
  doneAt: Record<LaneKey, number | null>;
  error: Record<LaneKey, boolean>;
}

const LANES: { key: LaneKey; name: string; place: string }[] = [
  { key: "new", name: "Yangi server", place: "Toshkent" },
  { key: "old", name: "Eski server", place: "Singapur" },
];

type Verdict = "fast" | "slow" | "mixed" | "wait";

const VERDICT_TEXT: Record<Verdict, string> = {
  fast: "ulgurdi — javob siz ikkinchi marta bosguningizcha kelib bo'lgan edi",
  slow: "ulgurmadi — javob ikkinchi bosishingizdan keyin keldi",
  mixed: "bir marta ulgurdi, bir marta yo'q",
  wait: "javob kutilmoqda…",
};

export default function TapTest({ compact = false }: { compact?: boolean }) {
  const [shots, setShots] = useState<Shot[]>([]);
  const [showNumbers, setShowNumbers] = useState(false);
  // "Yana" bosilgach kechikib kelgan eski javoblar yangi turga yopishmasin.
  const round = useRef(0);
  const bases = useRef<Record<LaneKey, string> | null>(null);

  const tap = useCallback(() => {
    if (shots.length >= TAPS) return;
    if (!bases.current) bases.current = laneBases();
    const idx = shots.length;
    const shot: Shot = { tapAt: performance.now(), doneAt: { old: null, new: null }, error: { old: false, new: false } };
    setShots((s) => [...s, shot]);
    const myRound = round.current;
    for (const lane of LANES) {
      fetch(`${bases.current[lane.key]}/api/health/db?t=${Date.now()}-${idx}`, { cache: "no-store" })
        .then((r) => { if (!r.ok) throw new Error(String(r.status)); })
        .then(
          () => setShots((s) => (myRound !== round.current ? s : s.map((x, i) => (i === idx ? { ...x, doneAt: { ...x.doneAt, [lane.key]: performance.now() } } : x)))),
          () => setShots((s) => (myRound !== round.current ? s : s.map((x, i) => (i === idx ? { ...x, error: { ...x.error, [lane.key]: true } } : x)))),
        );
    }
  }, [shots.length]);

  const reset = () => { round.current += 1; setShots([]); };

  const finished = shots.length >= TAPS;

  /** Bosish i ning javobi keyingi bosishdan oldin keldimi (null — hali noma'lum). */
  const beforeNext = (i: number, lane: LaneKey): boolean | null => {
    const s = shots[i];
    const next = shots[i + 1];
    if (!s || !next) return null;
    if (s.error[lane]) return false;
    const done = s.doneAt[lane];
    if (done === null) return null;
    return done <= next.tapAt;
  };
  const verdictOf = (lane: LaneKey): Verdict => {
    const v = Array.from({ length: TAPS - 1 }, (_, i) => beforeNext(i, lane));
    if (v.some((x) => x === null)) return "wait";
    const wins = v.filter(Boolean).length;
    return wins === v.length ? "fast" : wins === 0 ? "slow" : "mixed";
  };
  const avg = (lane: LaneKey) => {
    const v = shots.map((s) => (s.doneAt[lane] === null ? null : s.doneAt[lane]! - s.tapAt)).filter((x): x is number => x !== null);
    return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null;
  };

  const vNew = finished ? verdictOf("new") : "wait";
  const vOld = finished ? verdictOf("old") : "wait";
  const headline =
    !finished ? null
    : vNew === "wait" || vOld === "wait" ? "Javoblar kelmoqda…"
    : vNew === "fast" && vOld !== "fast" ? "Yangi server barmog'ingizdan tez!"
    : vNew === "fast" && vOld === "fast"
      ? ((avg("new") ?? 0) * 1.5 < (avg("old") ?? 0) ? "Ikkalasi ham ulgurdi — lekin yangi server ancha oldinroq javob berdi" : "Ikkalasi ham ulgurdi — internetingiz juda tez")
    : vNew === "slow" && vOld === "slow" ? "Bu safar hech kim ulgurmadi — internet sekin, yana urinib ko'ring"
    : vNew !== "slow" ? "Yangi server ulgurdi, eski — qisman"
    : "Bu safar yangi server ulgurmadi — yana urinib ko'ring";

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
          disabled={finished}
          aria-label="Bu yerga bosing"
          className={`relative w-32 h-32 rounded-full border-4 flex flex-col items-center justify-center select-none transition-transform active:scale-95
            ${finished ? "border-border bg-secondary text-muted-foreground" : "border-primary/40 bg-primary/10 text-primary hover:bg-primary/15 cursor-pointer"}`}
          style={{ touchAction: "manipulation" }}
        >
          {!finished && <span className="absolute inset-0 rounded-full border-2 border-primary/30 animate-ping" style={{ animationDuration: "1.8s" }} />}
          <Fingerprint className="w-8 h-8" />
          <span className="mt-1 text-2xl font-bold tabular-nums leading-none">
            {Math.min(shots.length, TAPS)}<span className="text-base font-medium opacity-60">/{TAPS}</span>
          </span>
          <span className="mt-1 text-[12px]">{finished ? "tugadi" : shots.length === 0 ? "bosing" : "yana bosing"}</span>
        </button>
      </div>

      {finished && (
        <div className="space-y-3">
          <div className="text-center text-[16px] font-semibold">{headline}</div>
          <ul className="space-y-2">
            {LANES.map((lane) => {
              const v = lane.key === "new" ? vNew : vOld;
              const good = v === "fast";
              const bad = v === "slow";
              const Icon = bad ? Turtle : Rabbit;
              const tone = good
                ? "border-emerald-300 bg-emerald-50 text-emerald-900 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-200"
                : bad
                  ? "border-red-300 bg-red-50 text-red-900 dark:border-red-900 dark:bg-red-950/40 dark:text-red-200"
                  : "border-amber-300 bg-amber-50 text-amber-900 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-200";
              return (
                <li key={lane.key} className={`rounded-xl border px-3 py-2.5 flex items-center gap-3 ${tone}`}>
                  <Icon className="w-6 h-6 shrink-0" />
                  <div className="min-w-0">
                    <div className="text-[14px] font-semibold">{lane.name} <span className="font-normal opacity-70">· {lane.place}</span></div>
                    <div className="text-[12.5px] opacity-90">{VERDICT_TEXT[v]}</div>
                  </div>
                </li>
              );
            })}
          </ul>
          {showNumbers && (
            <div className="text-[12px] text-muted-foreground text-center tabular-nums">
              O&apos;rtacha javob: yangi {fmtTime(avg("new"))} · eski {fmtTime(avg("old"))} · ikki bosish orasi {fmtTime(shots[TAPS - 1].tapAt - shots[0].tapAt)}
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
