"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { CircleHelp, Fingerprint, Rabbit, RotateCcw, Turtle } from "lucide-react";
import { burstConfetti } from "@/lib/confetti";

// BARMOQ SINOVI — oddiy foydalanuvchi uchun, so'z bilan. Ikki joyda
// ishlatiladi:
//   • /tezlik sahifasi (TapTestPage.tsx) — ommaviy, mijozga havola bilan;
//   • saytning har sahifasidagi suzuvchi robot (SpeedFab.tsx) — modalda.
//
// Foydalanuvchi doirani ketma-ket 2 marta bosadi. 1-BOSISHDA serverga
// bitta so'rov (/api/health/db — server o'z navbatida bazaga bitta arzon
// so'rov qiladi) ketadi; 2-bosish faqat vaqtni belgilaydi (so'rov
// yuborilmaydi — baholanmaydigan so'rov behuda). Server "ulgurdi" —
// javobi 2-bosishdan OLDIN kelgan bo'lsa.
//
// 15.09.2026 GACHA bu yerda ikki server taqqoslanardi (Vercel·Singapur
// va VPS·Toshkent), ustida esa "Tezlik poygasi" — uch bosqichli o'lchov
// turardi (SpeedRace.tsx, git tarixida). 14.09 da Vercel nusxasi
// qo'riqchi bilan to'sildi (proxy.ts: har so'rovga 308, CORS'siz) —
// eski yo'lak "xato" bera boshladi, "Sahifa" bosqichi esa 308 ni kuzatib
// yangi serverni o'lchab yolg'on raqam ko'rsatdi. Poyga olib tashlandi;
// sinov faqat hozirgi serverga ishlaydi, taqqoslash yo'q.
//
// SERVER HAR DOIM PROD VPS: sahifa localhost'dan ochilsa ham (dev server
// kodni yo'l-yo'lakay kompilyatsiya qiladi, bazasi Atlas) so'rov
// www.tizimli24.uz ga boradi — aks holda dev server o'lchanib
// chalg'itardi. Shu sabab /api/health/* CORS "*" beradi (lib/health.ts).
// Prod domenining o'zida — o'sha origin.
//
// HALOLLIK QOIDALARI (12.09.2026 dagi tekshiruvdan keyin):
//   • Bosish oralig'i O'LCHANADI va matn shunga qarab yoziladi: juda tez
//     bosilsa (< 0,15 s) — "hech kim ulgurmaydi, sekinroq bosing", sekin
//     bosilsa (> 1,2 s) — "hamma ulguradi, tezroq bosing"; server haqida
//     xulosa faqat o'rtacha oraliqda. Ilgari bunda internet ayblanardi.
//   • Xato (tarmoq, 500, vaqt tugashi) — "ulgurmadi" EMAS, alohida holat:
//     "javob kelmadi — xulosa yo'q". Timeout 10 s.
//   • Isitish: sinovdan oldin hisobga olinmaydigan /api/health/db so'rovi
//     yuboriladi (aynan sinov uradigan manzil — ulanish HAM, serverning
//     baza ulanishi HAM ochilsin), doira shungacha "tayyorlanmoqda".
//     Prod domenida ulanish sahifa bilan ochilgan bo'ladi, localhost'dan
//     esa sovuq — isitishsiz birinchi so'rovga DNS+TLS qo'shilib ketardi.
//   • Bosishlar soni `useRef` da: 40 ms oralig'ida ikki marta bosilganda
//     ikkala bosish ham eski `taps.length === 0` ni ko'rib ikkita so'rov
//     jo'natardi (React qayta render qilishdan oldin) va ekrandagi raqam
//     kechroq boshlangan so'rovniki bo'lib shishib chiqardi. Ref bir
//     zumda yangilanadi — so'rovni faqat BIRINCHI bosish yuboradi.
//   • Sekin bosib (> 1,2 s) server baribir ulgurmagan bo'lsa — bu "siz
//     tezkorsiz" emas, tarmoq tebranishi: maqtov va qog'ozlar yo'q,
//     "yana urinib ko'ring".
// Millisekund yo'q — hamma vaqt sekundda (fmtTime).

const PROD_BASE = "https://www.tizimli24.uz";
const TAPS = 2;
const TOO_FAST_S = 0.15;
const TOO_SLOW_S = 1.2;

// Serverdan tez bosganga — maqtov (tasodifiy) va qog'ozlar. Faqat javob
// 2-bosishdan keyin kelgan VA bosish sekin bo'lmagan holatda.
const QUICK_PRAISE = [
  "Voy, siz tezkorsiz!",
  "Barmog'ingiz chaqmoqdek!",
  "Chempion barmoq!",
  "Bu tezlikka server ham hayron!",
];

/**
 * Vaqt HAR DOIM sekundda, vergul bilan (oddiy foydalanuvchi "ms" ni
 * bilmaydi): 1250 → "1,25 s", 148 → "0,15 s", 3 → "0,003 s"
 * (0,1 s dan kichigi uch xona bilan, aks holda "0,00 s" bo'lib qolardi).
 */
function fmtTime(ms: number | null): string {
  if (ms === null) return "—";
  const sec = ms / 1000;
  return `${sec.toFixed(sec < 0.1 ? 3 : 2).replace(".", ",")} s`;
}

/** Serverning manzili — prod domenida o'sha origin, boshqa joyda prod. */
function serverBase(): string {
  const host = window.location.hostname;
  return host === "tizimli24.uz" || host.endsWith(".tizimli24.uz") ? window.location.origin : PROD_BASE;
}

/**
 * Bitta so'rovning to'liq vaqti (ms): yuborishdan javob tanasi o'qib
 * bo'linguncha. Keshsiz (`t=` va no-store); xato/timeout — throw.
 */
async function timed(url: string, timeoutMs: number): Promise<number> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  const t0 = performance.now();
  try {
    const res = await fetch(`${url}?t=${Date.now()}`, { cache: "no-store", signal: ctrl.signal });
    if (!res.ok) throw new Error(String(res.status));
    await res.text();
    return performance.now() - t0;
  } finally {
    clearTimeout(timer);
  }
}

/** Hisobga olinmaydigan isitish so'rovi. Xato bo'lsa ham davom etiladi. */
async function warmUp(base: string): Promise<void> {
  try { await timed(`${base}/api/health/db`, 8_000); } catch { /* sovuq qoladi — sinov baribir ketadi */ }
}

interface Probe {
  /** Javob vaqti (bosishdan), soniya; null — hali kelmadi. */
  sec: number | null;
  error: boolean;
}
const NO_PROBE: Probe = { sec: null, error: false };

type Verdict = "fast" | "slow" | "error" | "wait";

export default function TapTest({ compact = false }: { compact?: boolean }) {
  const [ready, setReady] = useState(false);
  const [taps, setTaps] = useState<number[]>([]);
  const [probe, setProbe] = useState<Probe>(NO_PROBE);
  const [showNumbers, setShowNumbers] = useState(false);
  const [praise, setPraise] = useState(QUICK_PRAISE[0]);
  const celebrated = useRef(false);
  // "Yana" bosilgach kechikib kelgan eski javob yangi turga yopishmasin.
  const round = useRef(0);
  const base = useRef<string | null>(null);
  // Bosishlar soni — sinxron qorovul (`taps` holati render'gacha eskiradi).
  const tapCount = useRef(0);

  // Isitish — hisobga olinmaydi.
  useEffect(() => {
    let alive = true;
    const b = serverBase();
    base.current = b;
    warmUp(b).then(() => { if (alive) setReady(true); });
    return () => { alive = false; };
  }, []);

  const tap = useCallback(() => {
    if (!ready || tapCount.current >= TAPS || !base.current) return;
    const index = tapCount.current++;
    const now = performance.now();
    setTaps((t) => [...t, now]);
    if (index > 0) return; // oxirgi bosish — faqat vaqt
    const myRound = round.current;
    timed(`${base.current}/api/health/db`, 10_000).then(
      (ms) => { if (myRound === round.current) setProbe({ sec: ms / 1000, error: false }); },
      () => { if (myRound === round.current) setProbe({ sec: null, error: true }); },
    );
  }, [ready]);

  const reset = () => {
    round.current += 1;
    tapCount.current = 0;
    celebrated.current = false;
    setPraise(QUICK_PRAISE[Math.floor(Math.random() * QUICK_PRAISE.length)]);
    setTaps([]);
    setProbe(NO_PROBE);
  };

  const finished = taps.length >= TAPS;
  const gapSec = finished ? (taps[1] - taps[0]) / 1000 : null;
  const tooSlow = gapSec !== null && gapSec > TOO_SLOW_S;

  const verdict: Verdict = (() => {
    if (gapSec === null) return "wait";
    if (probe.error) return "error";
    if (probe.sec === null) return "wait";
    return probe.sec <= gapSec ? "fast" : "slow";
  })();
  // Foydalanuvchi serverdan tez — javob 2-bosishdan keyin keldi (va
  // bosish sekin emas, yuqoridagi so'nggi qoida).
  const beat = verdict === "slow" && !tooSlow;
  // Juda tez bosilgan, lekin server baribir ulgurgan (juda tez tarmoq).
  const tooFastHint = gapSec !== null && gapSec < TOO_FAST_S && verdict === "fast";

  const headline = (() => {
    if (!finished) return null;
    if (verdict === "wait") return "Javob kelmoqda…";
    if (verdict === "error") return "Server javob bermadi — internet uzilgan bo'lishi mumkin, yana urinib ko'ring.";
    if (beat) return `${praise} Siz serverdan tez bosdingiz (${fmtTime(gapSec! * 1000)}). Biroz sekinroq bosib ko'ring — server ulguradimi?`;
    if (tooSlow) {
      return verdict === "fast"
        ? `Sekin bosdingiz (${fmtTime(gapSec! * 1000)}) — bunday oraliqda deyarli har qanday server ulguradi. Tezroq bosib ko'ring.`
        : "Sekin bosdingiz, server baribir ulgurmadi — tarmoq tebrangan bo'lishi mumkin, yana urinib ko'ring.";
    }
    if (tooFastHint) return "Juda tez bosdingiz, lekin server baribir ulgurdi — internetingiz juda tez!";
    return "Server barmog'ingizdan tez!";
  })();

  // Bayram FAQAT serverdan tez bosganda — bir turda bir marta.
  useEffect(() => {
    if (!beat || celebrated.current) return;
    celebrated.current = true;
    burstConfetti();
  }, [beat]);

  const cardText = (() => {
    switch (verdict) {
      case "fast": return `ulgurdi — javob ${fmtTime(probe.sec! * 1000)} da keldi, siz ${fmtTime(gapSec! * 1000)} da bosdingiz`;
      case "slow": return `ulgurmadi — javob ${fmtTime(probe.sec! * 1000)} da keldi, siz ${fmtTime(gapSec! * 1000)} da bosdingiz`;
      case "error": return "javob kelmadi (xato yoki 10 s vaqt tugadi) — server haqida xulosa yo'q";
      default: return "javob kutilmoqda…";
    }
  })();
  const CardIcon = verdict === "fast" ? Rabbit : verdict === "slow" ? Turtle : CircleHelp;
  const cardTone = verdict === "fast"
    ? "border-emerald-300 bg-emerald-50 text-emerald-900 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-200"
    : verdict === "slow"
      ? "border-red-300 bg-red-50 text-red-900 dark:border-red-900 dark:bg-red-950/40 dark:text-red-200"
      : "border-border bg-secondary text-muted-foreground";
  // Sekin bosilib server ulgurgan bo'lsa kartochka ma'nosiz ("ulgurdi —
  // siz 2,1 s da bosdingiz") — faqat sarlavha qoladi.
  const showCard = finished && !(tooSlow && verdict === "fast");

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
          {showCard && (
            <div className={`rounded-xl border px-3 py-2.5 flex items-center gap-3 ${cardTone}`}>
              <CardIcon className="w-6 h-6 shrink-0" />
              <div className="min-w-0">
                <div className="text-[14px] font-semibold">Server <span className="font-normal opacity-70">· Eskiz VPS, Toshkent</span></div>
                <div className="text-[12.5px] opacity-90">{cardText}</div>
              </div>
            </div>
          )}
          {showNumbers && gapSec !== null && (
            <div className="text-[12px] text-muted-foreground text-center tabular-nums">
              Ikki bosish orasi {fmtTime(gapSec * 1000)} · server javobi {probe.error ? "xato" : fmtTime(probe.sec === null ? null : probe.sec * 1000)}
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
