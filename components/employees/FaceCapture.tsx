"use client";

import { useEffect, useRef, useState } from "react";
import { useT } from "@/components/shared/Language";

// FACE ID — old kamera orqali yuzni olish (30.10.2026, lib/staffFace.ts).
//
// Hammasi TELEFONDA: @vladmandic/face-api (MIT, tfjs ichida) brauzerda yuzni
// topadi, 68 nuqtasini va 128 o'lchamli izini (descriptor) hisoblaydi. Serverga
// faqat izlar va kichik rasm (192×192 JPEG) ketadi — buni chaqiruvchi qiladi.
// Kutubxona (~1.3 MB) va modellar (~7 MB, public/xodim/face-models) faqat shu
// komponent ochilganda yuklanadi; keyin brauzer keshidan.
//
// JONLILIK — rasmni telefonga tutib o'tishga qarshi: avval KO'Z YUMISH (ko'z
// ochiqligi keskin tushib qayta ko'tarilishi). 10 soniyada aniqlanmasa — BOSHNI
// BURISH: burun uchi ko'zlar o'qi bo'ylab chapga va o'ngga siljishi kerak.
// Ikkala o'lchov ham yassi rasmni yonga og'dirish yoki oldinga engashtirishdan
// o'zgarmaydi (30.10 sinovi: eski o'lchovlar bilan qog'oz rasmni ±20° tebratib
// «bosh burish»dan o'tish mumkin edi — tuzatildi, yawOf/eyeOpenness).
//
// Jonlilik va suratlar BITTA YUZGA bog'langan: jonlilik o'tgan kadrda yuz izi
// olinadi, keyingi har surat shu izga yaqin bo'lishi shart. Yuz yo'qolsa yoki
// kadrga ikkinchi yuz kirsa — hammasi boshidan. Aks holda o'z yuzi bilan ko'z
// yumib, keyin kameraga boshqa xodimning rasmini tutish mumkin bo'lardi.
//
// Keyin yuz to'g'ri va ko'zlar ochiq kadrlardan izlar olinadi: ro'yxatga
// olishda 5 ta (server ularning bir odamligini tekshiradi), tekshiruvda 3 ta.
// Aniqlash, iz va surat — hammasi bitta kadr nusxasidan (canvas).

type FaceApi = typeof import("@vladmandic/face-api/dist/face-api.esm.js");
type Pt = { x: number; y: number };

/**
 * Kutubxona tiplari `tf` ning faqat bir qismini e'lon qiladi; bular ham
 * to'plam ichida bor (tfjs-core, face-api.esm.js eksporti tekshirilgan).
 */
interface TfRuntime {
  enableProdMode(): void;
  setBackend(name: string): Promise<boolean>;
  ready(): Promise<void>;
  getBackend(): string;
}
const tfOf = (m: FaceApi) => m.tf as unknown as TfRuntime;

export interface FaceStats {
  backend: string;
  loadMs: number;
  frameMs: number;
  /** Jonlilik qanday o'tdi. */
  live: "blink" | "turn" | "off";
  /** Ko'z ochiqligi (eyeOpenness): ochiq holat bazasi va eng kichigi. */
  eyeOpen: number;
  eyeMin: number;
}

export interface FaceCaptureResult {
  descriptors: number[][];
  /** data:image/jpeg;base64,… */
  photo: string;
  stats: FaceStats;
}

const MODEL_URL = "/xodim/face-models";
/** Kadrlar orasidagi tanaffus (ms) — telefon qizib ketmasin, interfeys qotmasin. */
const LOOP_GAP_MS = 40;
/**
 * Detektor kirish o'lchami. Yaqin (selfi) yuzlar uchun 224 eng barqaror:
 * 30.10 sinovida 144 holatdan 3 tasida yuzni o'tkazib yubordi, 256 da — 21 ta.
 */
const DETECT_INPUT = 224;
/** Ko'z yumish shuncha vaqtda aniqlanmasa — boshni burishga o'tiladi. */
const BLINK_TIMEOUT_MS = 10_000;
/** Ko'z yumilgan deb hisoblanadigan eng uzoq vaqt. */
const BLINK_MAX_MS = 2_000;
/** Ko'z yumildi: ochiqlik ochiq holatdagidan shuncha marta past. */
const CLOSE_RATIO = 0.75;
/** Qayta ochildi. */
const REOPEN_RATIO = 0.88;
/** Boshni burish: burun ko'zlar o'qining shu qismidan chetga chiqsin. */
const TURN_LOW = 0.36;
const TURN_HIGH = 0.64;
/** Suratga olish uchun yuz to'g'ri bo'lsin. */
const FRONTAL_LOW = 0.4;
const FRONTAL_HIGH = 0.6;
/** Yuz shuncha vaqt ko'rinmasa — kuzatuv uzildi, hammasi boshidan. */
const TRACK_GAP_MS = 600;
/**
 * Jonlilikdan keyingi har iz oldingi kadrdagidan shuncha uzoq bo'lsa — kadrdagi
 * yuz almashtirildi (boshqa odam yoki rasm). Ketma-ket kadrlarda bir odamniki
 * odatda 0.3 dan kichik, boshqa odamniki 0.6 dan katta.
 */
const ANCHOR_MAX = 0.55;
const CAPTURE_GAP_MS = 150;
const CAPTURE_TIMEOUT_MS = 15_000;
const PHOTO_SIZE = 192;

// ── Kutubxona va modellar (bir marta, sahifa yopilguncha) ───────────

let apiPromise: Promise<FaceApi> | null = null;
let detectorPromise: Promise<void> | null = null;
let recognizerPromise: Promise<void> | null = null;

function loadFaceApi(): Promise<FaceApi> {
  apiPromise ??= (async () => {
    const m = await import("@vladmandic/face-api/dist/face-api.esm.js");
    const tf = tfOf(m);
    tf.enableProdMode();
    // WebGL bo'lmasa — CPU (sekinroq, lekin ishlaydi).
    const gl = await tf.setBackend("webgl").catch(() => false);
    if (!gl) await tf.setBackend("cpu");
    await tf.ready();
    return m;
  })().catch((e) => {
    apiPromise = null;
    throw e;
  });
  return apiPromise;
}

function loadDetector(m: FaceApi): Promise<void> {
  detectorPromise ??= Promise.all([
    m.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
    m.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
  ])
    .then(() => undefined)
    .catch((e) => {
      detectorPromise = null;
      throw e;
    });
  return detectorPromise;
}

function loadRecognizer(m: FaceApi): Promise<void> {
  recognizerPromise ??= m.nets.faceRecognitionNet.loadFromUri(MODEL_URL).catch((e) => {
    recognizerPromise = null;
    throw e;
  });
  return recognizerPromise;
}

// ── Geometriya ──────────────────────────────────────────────────────

const dist = (a: Pt, b: Pt) => Math.hypot(a.x - b.x, a.y - b.y);

const centerOf = (pts: Pt[]): Pt => ({
  x: pts.reduce((s, p) => s + p.x, 0) / pts.length,
  y: pts.reduce((s, p) => s + p.y, 0) / pts.length,
});

interface Landmarks {
  getLeftEye(): Pt[];
  getRightEye(): Pt[];
  getNose(): Pt[];
}

interface Box {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** Bitta topilgan yuz (iz faqat so'ralgan kadrlarda hisoblanadi). */
interface Det {
  detection: { box: Box; score: number };
  landmarks: Landmarks;
  descriptor?: Float32Array;
}

/** Ko'zlar o'qi (chap ko'z markazidan o'ngiga) va burun uchi. */
function axisOf(lm: Landmarks) {
  const l = centerOf(lm.getLeftEye());
  const r = centerOf(lm.getRightEye());
  const tip = lm.getNose()[3] ?? centerOf(lm.getNose());
  return { l, ax: r.x - l.x, ay: r.y - l.y, tip };
}

/**
 * Burun uchi ko'zlar o'qining qayerida: 0.5 — to'g'ri, chetlari — burilgan.
 * O'qqa PROYEKSIYA — yonga og'dirish (bosh yoki rasm) natijani o'zgartirmaydi.
 */
function yawOf(lm: Landmarks): number {
  const { l, ax, ay, tip } = axisOf(lm);
  const span2 = ax * ax + ay * ay;
  return span2 > 0 ? ((tip.x - l.x) * ax + (tip.y - l.y) * ay) / span2 : 0.5;
}

/**
 * Ko'z ochiqligi: qovoqlar oralig'i ÷ burun uchidan ko'zlar o'qigacha masofa.
 * Ko'z yumilsa kamayadi. Maxraj ham TIK masofa: yassi rasmni oldinga
 * engashtirish ikkalasini birday qisqartiradi va natija o'zgarmaydi (oddiy
 * EAR — qovoqlar oralig'i ÷ ko'z kengligi — esa ~25% tushib, ko'z yumishga
 * o'xshab qolardi).
 */
function eyeOpenness(lm: Landmarks): number {
  const gap = (e: Pt[]) => (dist(e[1], e[5]) + dist(e[2], e[4])) / 2;
  const { l, ax, ay, tip } = axisOf(lm);
  const span = Math.hypot(ax, ay);
  const drop = span > 0 ? Math.abs(ax * (tip.y - l.y) - ay * (tip.x - l.x)) / span : 0;
  return drop > 0 ? (gap(lm.getLeftEye()) + gap(lm.getRightEye())) / 2 / drop : 0;
}

function descDistance(a: readonly number[], b: readonly number[]): number {
  let s = 0;
  for (let i = 0; i < a.length; i++) s += (a[i] - b[i]) ** 2;
  return Math.sqrt(s);
}

function percentile(values: number[], p: number): number {
  if (!values.length) return 0;
  const s = [...values].sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.max(0, Math.round((s.length - 1) * p)))];
}

const round5 = (n: number) => Math.round(n * 1e5) / 1e5;

/** Yuz atrofidagi kvadrat (yuzdan ~1.7 barobar) → 192×192 JPEG. */
function cropPhoto(src: HTMLCanvasElement, box: Box): string {
  const vw = src.width;
  const vh = src.height;
  const side = Math.min(Math.max(box.width, box.height) * 1.7, vw, vh);
  const cx = box.x + box.width / 2;
  const cy = box.y + box.height / 2;
  const sx = Math.min(Math.max(0, cx - side / 2), vw - side);
  const sy = Math.min(Math.max(0, cy - side / 2), vh - side);
  const c = document.createElement("canvas");
  c.width = PHOTO_SIZE;
  c.height = PHOTO_SIZE;
  c.getContext("2d")?.drawImage(src, sx, sy, side, side, 0, 0, PHOTO_SIZE, PHOTO_SIZE);
  return c.toDataURL("image/jpeg", 0.8);
}

// ── Matnlar: har kalit to'g'ridan-to'g'ri t() ichida — i18n-scan ko'rsin ──

type CueId = "camera" | "models" | "noFace" | "many" | "closer" | "farther" | "center" | "blink" | "turn" | "look" | "straight" | "wait" | "done";
type ErrorId = "unsupported" | "denied" | "notFound" | "busy" | "camera" | "models" | "detect";

function cueText(t: (k: string) => string, id: CueId): string {
  switch (id) {
    case "camera":
      return t("Kamera ochilmoqda…");
    case "models":
      return t("Yuz aniqlash yuklanmoqda…");
    case "noFace":
      return t("Yuzingizni doira ichiga olib keling");
    case "many":
      return t("Kadrda faqat siz bo'ling");
    case "closer":
      return t("Yaqinroq keling");
    case "farther":
      return t("Biroz uzoqlashing");
    case "center":
      return t("Yuzingizni doira markaziga olib keling");
    case "blink":
      return t("Ko'zingizni sekin yumib oching");
    case "turn":
      return t("Boshingizni sekin chapga, keyin o'ngga buring");
    case "look":
      return t("Kameraga to'g'ri qarang");
    case "straight":
      return t("Boshingizni to'g'ri tuting");
    case "wait":
      return t("Bir lahza…");
    case "done":
      return t("Tayyor");
  }
}

function errorText(t: (k: string) => string, id: ErrorId): string {
  switch (id) {
    case "unsupported":
      return t("Bu qurilmada kamera ishlamaydi");
    case "denied":
      return t("Kameraga ruxsat berilmadi");
    case "notFound":
      return t("Old kamera topilmadi");
    case "busy":
      return t("Kamera boshqa ilovada band — uni yopib qayta urinib ko'ring");
    case "camera":
      return t("Kamerani ochib bo'lmadi");
    case "models":
      return t("Yuz aniqlash dasturi yuklanmadi — internetni tekshirib qayta urinib ko'ring");
    case "detect":
      return t("Yuzni aniqlab bo'lmadi — qayta urinib ko'ring");
  }
}

function cameraError(e: unknown): ErrorId {
  const name = (e as { name?: string } | null)?.name ?? "";
  if (name === "NotAllowedError" || name === "SecurityError") return "denied";
  if (name === "NotFoundError" || name === "OverconstrainedError") return "notFound";
  if (name === "NotReadableError" || name === "AbortError") return "busy";
  return "camera";
}

// ── Komponent ───────────────────────────────────────────────────────

type Phase = "loading" | "align" | "live" | "capture" | "done" | "error";

interface View {
  phase: Phase;
  cue: CueId;
  good: boolean;
  progress: number;
}

interface Debug {
  backend: string;
  loadMs: number;
  frameMs: number;
  faces: number;
  eye: number;
  eyeOpen: number;
  eyeMin: number;
  yaw: number;
  restarts: number;
}

export default function FaceCapture({
  purpose,
  onCaptured,
  liveness = true,
  debug = false,
}: {
  /** enroll — 5 ta kadr (birinchi marta), verify — 3 ta. */
  purpose: "enroll" | "verify";
  onCaptured: (r: FaceCaptureResult) => void;
  /** Faqat sinov sahifasi uchun o'chiriladi (/xodim/yuz-sinov?live=0). */
  liveness?: boolean;
  /** Sinov sahifasi: ko'z ochiqligi, burilish, tezlik raqamlari. */
  debug?: boolean;
}) {
  const { t } = useT();
  const videoRef = useRef<HTMLVideoElement>(null);
  const onCapturedRef = useRef(onCaptured);
  const [view, setView] = useState<View>({ phase: "loading", cue: "camera", good: false, progress: 0 });
  const [error, setError] = useState<ErrorId | null>(null);
  const [dbg, setDbg] = useState<Debug | null>(null);

  useEffect(() => {
    onCapturedRef.current = onCaptured;
  }, [onCaptured]);

  useEffect(() => {
    let cancelled = false;
    let stream: MediaStream | null = null;
    const need = purpose === "enroll" ? 5 : 3;
    const minAccept = purpose === "enroll" ? 3 : 1;
    let last: View = { phase: "loading", cue: "camera", good: false, progress: 0 };
    const show = (v: View) => {
      if (cancelled) return;
      if (v.phase === last.phase && v.cue === last.cue && v.good === last.good && v.progress === last.progress) return;
      last = v;
      setView(v);
    };
    const stop = () => {
      stream?.getTracks().forEach((tr) => tr.stop());
      stream = null;
    };
    const fail = (id: ErrorId) => {
      stop();
      if (cancelled) return;
      setError(id);
      show({ phase: "error", cue: "camera", good: false, progress: 0 });
    };

    void (async () => {
      const started = performance.now();
      if (!navigator.mediaDevices?.getUserMedia) return fail("unsupported");
      // Kutubxona kamera bilan PARALLEL yuklanadi (ruxsat oynasi shu paytda chiqadi).
      const apiP = loadFaceApi();
      apiP.catch(() => undefined);
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "user", width: { ideal: 640 }, height: { ideal: 480 } },
          audio: false,
        });
      } catch (e) {
        return fail(cameraError(e));
      }
      const video = videoRef.current;
      if (cancelled || !video) return stop();
      video.srcObject = stream;
      await video.play().catch(() => undefined);

      show({ phase: "loading", cue: "models", good: false, progress: 0 });
      let m: FaceApi;
      try {
        m = await apiP;
        await loadDetector(m);
      } catch {
        return fail("models");
      }
      if (cancelled) return stop();
      // Tanib olish modeli katta (~6 MB) — yuz topilayotganda fonda yuklanadi;
      // jonlilik u tayyor bo'lgach boshlanadi (o'tgan kadrning izi kerak).
      let recognizerReady = false;
      let recognizerFailed = false;
      loadRecognizer(m).then(
        () => {
          recognizerReady = true;
        },
        () => {
          recognizerFailed = true;
        },
      );
      const loadMs = Math.round(performance.now() - started);
      const backend = tfOf(m).getBackend();
      // Kadr nusxasi: aniqlash, iz va surat — hammasi aynan shu kadrdan.
      const frame = document.createElement("canvas");
      const frameCtx = frame.getContext("2d");
      if (!frameCtx) return fail("detect");
      const opts = new m.TinyFaceDetectorOptions({ inputSize: DETECT_INPUT, scoreThreshold: 0.5 });
      const detect = async (withDescriptors: boolean): Promise<Det[]> => {
        const task = m.detectAllFaces(frame, opts).withFaceLandmarks();
        return withDescriptors ? await task.withFaceDescriptors() : await task;
      };

      // Jonlilik holati.
      const opens: { at: number; v: number }[] = [];
      let openMin = 1;
      let closedAt: number | null = null;
      let live: FaceStats["live"] | null = liveness ? null : "off";
      let yawMin = 0.5;
      let yawMax = 0.5;
      let liveSince = 0;
      /** Jonlilikdan o'tgan kadrdan boshlab so'nggi yuz izi (zanjir) — suratlar shu yuzniki bo'lishi shart. */
      let anchor: number[] | null = null;
      let lastGoodAt = 0;
      let restarts = 0;
      // Suratga olish.
      const shots: number[][] = [];
      let photo: { score: number; data: string } | null = null;
      let lastShotAt = 0;
      let captureSince = 0;
      let frameMs = 0;
      let lastDbgAt = 0;

      /** Yuz yo'qoldi, ikkinchi yuz kirdi yoki boshqa yuz chiqdi — hammasi boshidan. */
      const restart = () => {
        if (opens.length || shots.length || anchor) restarts++;
        opens.length = 0;
        closedAt = null;
        yawMin = 0.5;
        yawMax = 0.5;
        anchor = null;
        if (liveness) live = null;
        shots.length = 0;
        photo = null;
        captureSince = 0;
      };

      while (!cancelled) {
        await new Promise((r) => setTimeout(r, LOOP_GAP_MS));
        if (cancelled) break;
        if (video.readyState < 2 || !video.videoWidth) continue;
        const vw = video.videoWidth;
        const vh = video.videoHeight;
        if (frame.width !== vw || frame.height !== vh) {
          frame.width = vw;
          frame.height = vh;
        }
        frameCtx.drawImage(video, 0, 0, vw, vh);
        const t0 = performance.now();
        const turnMode = live === null && liveSince > 0 && t0 - liveSince > BLINK_TIMEOUT_MS;
        // Iz: jonlilik o'tishi mumkin bo'lgan kadrlarda (ko'z yumilgan payt, bosh
        // burish rejimi) — o'tgan kadrning o'zida bo'lsin; suratga olishda — har 150 ms.
        const wantDesc =
          recognizerReady &&
          (live === null
            ? turnMode || (closedAt !== null && t0 - closedAt < BLINK_MAX_MS)
            : t0 - lastShotAt >= CAPTURE_GAP_MS);
        const dets = await detect(wantDesc).catch(() => null);
        if (cancelled) break;
        if (!dets) return fail("detect");
        if (recognizerFailed) return fail("models");
        const now = performance.now();
        frameMs = frameMs ? frameMs * 0.8 + (now - t0) * 0.2 : now - t0;

        let cue: CueId = "noFace";
        let face: Det | null = null;
        if (dets.length > 1) cue = "many";
        else if (dets.length === 1) {
          const box = dets[0].detection.box;
          const rel = box.width / Math.min(vw, vh);
          const cx = (box.x + box.width / 2) / vw;
          const cy = (box.y + box.height / 2) / vh;
          if (rel < 0.28) cue = "closer";
          else if (rel > 0.9) cue = "farther";
          else if (Math.abs(cx - 0.5) > 0.2 || Math.abs(cy - 0.5) > 0.22) cue = "center";
          else face = dets[0];
        }

        // Kuzatuv uzildi (ikkinchi yuz yoki yuz uzoq ko'rinmadi) — boshidan.
        const trackGap = Math.max(TRACK_GAP_MS, 3 * (frameMs + LOOP_GAP_MS));
        if (dets.length > 1 || (lastGoodAt > 0 && now - lastGoodAt > trackGap)) restart();
        if (face) lastGoodAt = now;

        let open = 0;
        let yaw = 0.5;
        let openBase = percentile(opens.map((e) => e.v), 0.75);
        if (face) {
          open = eyeOpenness(face.landmarks);
          yaw = yawOf(face.landmarks);
          openMin = Math.min(openMin, open);
          opens.push({ at: now, v: open });
          while (opens.length && now - opens[0].at > 3_000) opens.shift();
          openBase = percentile(opens.map((e) => e.v), 0.75);

          if (live === null) {
            if (!recognizerReady) cue = "models";
            else {
              liveSince ||= now;
              let passed: "blink" | "turn" | null = null;
              // Ko'z yumish: ochiq holat bazasi yetarli kadrdan keyin baholanadi.
              if (opens.length >= 5 && openBase > 0) {
                if (open < openBase * CLOSE_RATIO) closedAt ??= now;
                else if (closedAt !== null && open > openBase * REOPEN_RATIO) {
                  if (now - closedAt < BLINK_MAX_MS) passed = "blink";
                  closedAt = null;
                }
              }
              // Boshni burish (zaxira yo'l) — ikkala tomonga.
              yawMin = Math.min(yawMin, yaw);
              yawMax = Math.max(yawMax, yaw);
              if (turnMode && yawMin < TURN_LOW && yawMax > TURN_HIGH) passed = "turn";
              if (passed && face.descriptor) {
                live = passed;
                anchor = Array.from(face.descriptor);
              }
              cue = turnMode ? "turn" : "blink";
            }
          }
          if (live !== null) {
            // Suratga olish: yuz to'g'ri, ko'zlar ochiq, jonlilikdan o'tgan odam.
            captureSince ||= now;
            const frontal = yaw >= FRONTAL_LOW && yaw <= FRONTAL_HIGH;
            const eyesOpen = openBase <= 0 || open >= openBase * REOPEN_RATIO;
            cue = !recognizerReady ? "wait" : frontal ? "look" : "straight";
            if (face.descriptor) {
              const d = Array.from(face.descriptor, round5);
              // Zanjir: har iz OLDINGISIGA yaqin (kadrlar orasi ~0.2 s, poza deyarli
              // o'zgarmaydi) — kadrdagi yuz almashtirilsa sakrash katta bo'ladi.
              if (anchor && descDistance(d, anchor) > ANCHOR_MAX) restart();
              else {
                if (anchor) anchor = d;
                if (frontal && eyesOpen) {
                  shots.push(d);
                  lastShotAt = now;
                  const score = face.detection.score;
                  if (!photo || score > photo.score) photo = { score, data: cropPhoto(frame, face.detection.box) };
                }
              }
            }
            if (photo && (shots.length >= need || (shots.length >= minAccept && now - captureSince > CAPTURE_TIMEOUT_MS))) {
              stop();
              show({ phase: "done", cue: "done", good: true, progress: 1 });
              onCapturedRef.current({
                descriptors: [...shots],
                photo: photo.data,
                stats: { backend, loadMs, frameMs: Math.round(frameMs), live: live ?? "off", eyeOpen: round5(openBase), eyeMin: round5(openMin) },
              });
              return;
            }
          }
        }

        show({
          phase: !face ? (live === null ? "align" : "capture") : live === null ? "live" : "capture",
          cue,
          good: face !== null,
          progress: live === null ? 0 : shots.length / need,
        });
        if (debug && now - lastDbgAt > 200) {
          lastDbgAt = now;
          setDbg({
            backend,
            loadMs,
            frameMs: Math.round(frameMs),
            faces: dets.length,
            eye: round5(open),
            eyeOpen: round5(openBase),
            eyeMin: round5(openMin),
            yaw: round5(yaw),
            restarts,
          });
        }
      }
      stop();
    })();

    return () => {
      cancelled = true;
      stop();
    };
  }, [purpose, liveness, debug]);

  const ring =
    view.phase === "error"
      ? "ring-rose-500"
      : view.phase === "done"
        ? "ring-emerald-500"
        : view.good
          ? "ring-emerald-400"
          : "ring-amber-400";
  const showVideo = view.phase !== "error" && view.phase !== "done";

  return (
    <div className="flex flex-col items-center gap-3">
      <div className={`relative size-[240px] overflow-hidden rounded-full bg-black ring-4 ${ring} transition-colors`}>
        {/* Ko'zgudek — odam o'zini shunday ko'rishga o'rgangan. */}
        <video ref={videoRef} playsInline muted autoPlay className={`size-full scale-x-[-1] object-cover ${showVideo ? "" : "opacity-0"}`} />
        {view.phase === "loading" && (
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="size-10 animate-spin rounded-full border-4 border-white/30 border-t-white" />
          </div>
        )}
        {view.phase === "done" && <div className="absolute inset-0 flex items-center justify-center text-[56px]">✅</div>}
        {view.phase === "capture" && view.progress > 0 && (
          <div className="absolute inset-x-0 bottom-0 h-1.5 bg-black/40">
            <div className="h-full bg-emerald-400 transition-[width]" style={{ width: `${Math.round(view.progress * 100)}%` }} />
          </div>
        )}
      </div>

      {error ? (
        <div className="max-w-[300px] space-y-1 text-center">
          <p className="text-[14px] font-semibold text-rose-700 dark:text-rose-300">❌ {errorText(t, error)}</p>
          {error === "denied" && (
            <p className="text-[12px] text-muted-foreground">
              {t("Telefon sozlamalarida Telegram'ga kamera ruxsatini bering va qayta urinib ko'ring.")}
            </p>
          )}
        </div>
      ) : (
        <p className={`min-h-[22px] max-w-[300px] text-center text-[15px] font-semibold ${view.good ? "text-emerald-700 dark:text-emerald-300" : ""}`}>
          {cueText(t, view.cue)}
        </p>
      )}

      {debug && dbg && (
        <pre className="w-full max-w-[320px] whitespace-pre-wrap rounded-lg bg-secondary p-2 text-[11px] leading-snug">
          {`backend ${dbg.backend} · load ${dbg.loadMs} ms · frame ${dbg.frameMs} ms\nfaces ${dbg.faces} · eye ${dbg.eye} (open ${dbg.eyeOpen}, min ${dbg.eyeMin})\nyaw ${dbg.yaw} · restarts ${dbg.restarts}`}
        </pre>
      )}
    </div>
  );
}
