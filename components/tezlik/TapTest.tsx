"use client";

import { useCallback, useRef, useState } from "react";
import { Check, Fingerprint, RotateCcw, X } from "lucide-react";
import { laneBases, fmtMs } from "@/components/tezlik/SpeedRace";

// 2-SINOV: "BARMOQDAN TEZ?" — foydalanuvchi doiraga ketma-ket 3 marta
// bosadi. Har bosishda ikkala serverga bittadan so'rov (/api/health/db —
// server bazadan ham o'qiydi) ketadi. Savol: server javobi sizning KEYINGI
// bosishingizdan oldin keladimi? Yangi server (Toshkent) odatda ~50 ms da
// javob beradi — odam ikki bosish orasida 200–400 ms sarflaydi, ya'ni
// server barmoqdan tez. Eski server (Singapur) ~500 ms — keyingi bosishdan
// keyin keladi. Raqam o'rniga his — mijoz buni o'z barmog'i bilan sezadi.
//
// 3-bosishning so'rovi "keyingi bosish" bilan solishtirilmaydi (keyingisi
// yo'q) — faqat vaqti ko'rsatiladi. Xulosa 1- va 2-bosishlar bo'yicha.

const TAPS = 3;
type LaneKey = "old" | "new";

interface Shot {
  /** Bosish lahzasi (performance.now). */
  tapAt: number;
  /** Javob kelgan lahza; null — hali kelmadi. */
  doneAt: Record<LaneKey, number | null>;
  error: Record<LaneKey, boolean>;
}

const LANES: { key: LaneKey; name: string }[] = [
  { key: "old", name: "Eski server · Singapur" },
  { key: "new", name: "Yangi server · Toshkent" },
];

export default function TapTest({ compact = false }: { compact?: boolean }) {
  const [shots, setShots] = useState<Shot[]>([]);
  // "Qayta" bosilgach kechikib kelgan eski javoblar yangi bosishlarga
  // yopishib qolmasin — har tur o'z raqami bilan.
  const round = useRef(0);
  const bases = useRef<Record<LaneKey, string> | null>(null);

  const tap = useCallback(() => {
    if (shots.length >= TAPS) return;
    if (!bases.current) bases.current = laneBases();
    const idx = shots.length;
    const tapAt = performance.now();
    const shot: Shot = { tapAt, doneAt: { old: null, new: null }, error: { old: false, new: false } };
    setShots((s) => [...s, shot]);
    const myRound = round.current;
    for (const lane of LANES) {
      const url = `${bases.current[lane.key]}/api/health/db?t=${Date.now()}-${idx}`;
      fetch(url, { cache: "no-store" })
        .then((r) => { if (!r.ok) throw new Error(String(r.status)); })
        .then(
          () => setShots((s) => (myRound !== round.current ? s : s.map((x, i) => (i === idx ? { ...x, doneAt: { ...x.doneAt, [lane.key]: performance.now() } } : x)))),
          () => setShots((s) => (myRound !== round.current ? s : s.map((x, i) => (i === idx ? { ...x, error: { ...x.error, [lane.key]: true } } : x)))),
        );
    }
  }, [shots.length]);

  const reset = () => { round.current += 1; setShots([]); };

  const finished = shots.length >= TAPS;
  const span = finished ? shots[TAPS - 1].tapAt - shots[0].tapAt : null;

  /** Bosish i uchun javob keyingi bosishdan OLDIN keldimi (faqat oxirgisidan boshqa). */
  const beforeNext = (i: number, lane: LaneKey): boolean | null => {
    const s = shots[i];
    const next = shots[i + 1];
    if (!s || !next) return null;
    const done = s.doneAt[lane];
    if (done === null) return s.error[lane] ? false : null;
    return done <= next.tapAt;
  };
  const wins = (lane: LaneKey) => shots.slice(0, TAPS - 1).filter((_, i) => beforeNext(i, lane) === true).length;
  const avg = (lane: LaneKey) => {
    const v = shots.map((s) => (s.doneAt[lane] === null ? null : s.doneAt[lane]! - s.tapAt)).filter((x): x is number => x !== null);
    return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null;
  };

  return (
    <section className={`rounded-2xl border border-border bg-card ${compact ? "p-4 space-y-3" : "p-5 space-y-4"}`}>
      <div>
        <h2 className="text-[15px] font-semibold">2-sinov: barmoqdan tez?</h2>
        <p className="text-[13px] text-muted-foreground mt-0.5">
          Doiraga ketma-ket <span className="font-medium text-foreground">3 marta</span>{" "}bosing. Har bosishda ikkala serverga so&apos;rov ketadi —{" "}
          server javobi sizning keyingi bosishingizdan oldin keladimi?
        </p>
      </div>

      <div className="flex flex-col sm:flex-row items-center gap-5">
        <button
          type="button"
          onClick={tap}
          disabled={finished}
          aria-label="Bu yerga bosing"
          className={`relative shrink-0 w-28 h-28 rounded-full border-4 flex flex-col items-center justify-center select-none transition-transform active:scale-95
            ${finished ? "border-border bg-secondary text-muted-foreground" : "border-primary/40 bg-primary/10 text-primary hover:bg-primary/15 cursor-pointer"}`}
          style={{ touchAction: "manipulation" }}
        >
          {!finished && <span className="absolute inset-0 rounded-full border-2 border-primary/30 animate-ping" style={{ animationDuration: "1.8s" }} />}
          <Fingerprint className="w-7 h-7" />
          <span className="mt-1 text-[13px] font-semibold tabular-nums">{Math.min(shots.length, TAPS)}/{TAPS}</span>
          <span className="text-[11px]">{finished ? "tugadi" : shots.length === 0 ? "bosing" : "yana"}</span>
        </button>

        <div className="flex-1 w-full space-y-3">
          {LANES.map((lane) => {
            const isNew = lane.key === "new";
            return (
              <div key={lane.key}>
                <div className="flex items-center justify-between gap-2 text-[12.5px]">
                  <span className={`truncate ${isNew ? "font-medium" : "text-muted-foreground"}`}>{lane.name}</span>
                  {finished && (
                    <span className="tabular-nums text-muted-foreground shrink-0" title="Keyingi bosishdan oldin kelgan javoblar · o'rtacha vaqt">
                      {wins(lane.key)}/{TAPS - 1} oldin · o&apos;rt. {fmtMs(avg(lane.key))}
                    </span>
                  )}
                </div>
                <div className="mt-1.5 grid grid-cols-3 gap-2">
                  {Array.from({ length: TAPS }, (_, i) => {
                    const s = shots[i];
                    const done = s ? s.doneAt[lane.key] : null;
                    const err = s?.error[lane.key];
                    const verdict = beforeNext(i, lane.key);
                    const ms = s && done !== null ? done - s.tapAt : null;
                    const tone = !s
                      ? "border-dashed border-border text-muted-foreground"
                      : err ? "border-red-300 bg-red-50 text-red-700 dark:bg-red-950/40 dark:border-red-900 dark:text-red-300"
                      : done === null ? "border-border bg-secondary text-muted-foreground animate-pulse"
                      : verdict === false ? "border-amber-300 bg-amber-50 text-amber-800 dark:bg-amber-950/40 dark:border-amber-900 dark:text-amber-300"
                      : isNew ? "border-primary/40 bg-primary/10 text-primary" : "border-border bg-secondary text-foreground";
                    return (
                      <div key={i} className={`rounded-lg border px-2 py-1.5 text-[12px] tabular-nums flex items-center justify-between gap-1 ${tone}`} title={`${i + 1}-bosish`}>
                        <span className="opacity-70">{i + 1}.</span>
                        <span className="inline-flex items-center gap-1 font-medium whitespace-nowrap">
                          {!s ? "—" : err ? "xato" : done === null ? "…" : fmtMs(ms)}
                          {verdict === true && <Check className="w-3.5 h-3.5" />}
                          {verdict === false && !err && <X className="w-3.5 h-3.5" />}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="text-[13px] text-muted-foreground text-center sm:text-left">
          {finished && span !== null ? (
            <>
              Siz 3 marta bosdingiz — <span className="font-medium text-foreground">{fmtMs(span)}</span>.
              {" "}Yangi server {wins("new")}/{TAPS - 1} marta barmog&apos;ingizdan oldin javob berdi, eski — {wins("old")}/{TAPS - 1}.
              {shots.some((s) => LANES.some((l) => s.doneAt[l.key] === null && !s.error[l.key])) && " (ba'zi javoblar hali kelmoqda…)"}
            </>
          ) : shots.length > 0 ? (
            <>Davom eting — yana {TAPS - shots.length} marta.</>
          ) : (
            <>✓ — javob keyingi bosishdan oldin keldi, ✗ — keyin.</>
          )}
        </div>
        {shots.length > 0 && (
          <button type="button" onClick={reset} className="inline-flex items-center gap-1.5 h-9 px-4 rounded-lg border border-border bg-card hover:bg-secondary text-[13px] font-medium shrink-0">
            <RotateCcw className="w-3.5 h-3.5" /> Qayta
          </button>
        )}
      </div>
    </section>
  );
}
