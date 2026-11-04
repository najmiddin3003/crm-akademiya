import { useEffect, useRef } from "react";
import type { Lang } from "@/lib/i18n";

// FACE ID OVOZI (04.11.2026). Doiradagi ko'rsatmani mayin ayol ovozi aytib
// turadi: odam ekrandagi yozuvni o'qimasa ham nima qilishni biladi.
//
// Ovoz TAYYOR FAYLLAR: Android WebView'da speechSynthesis yo'q, telefonlarda
// o'zbek ovozi o'rnatilmagan. Iboralar public/xodim/face-voice da (Mini App'da
// sessiya yo'q, proxy.ts sessiyasiz statik faylni faqat /xodim ostida beradi).
// Ovoz Microsoft Madina (uz-UZ-MadinaNeural), tezlik -10% — egasi Edge'da
// tinglab tanlagan «Mayin» ohangi. Fayllar edge-tts bilan olingan (Edge'ning
// bepul norasmiy xizmati, egasi 04.11 shu yo'lni tanladi; rasmiy yo'l Azure
// Speech, ovoz o'sha), oxiridagi ~0.75 s jimlik kesilgan.
//
// Telefon ovozni faqat BOSISH ichida ochadi: tugma bosilganda unlockFaceVoice
// SINXRON chaqiriladi. AudioContext modulda yashaydi — qayta urinishda
// FaceCapture yangidan yaratilsa ham ochiqligicha qoladi. Har kungi tekshiruv
// tugmasiz boshlanardi, «Boshlash» shu uchun qo'shildi (StaffCheckinTg, ready).
//
// Faqat o'zbek tilida: inglizchada ovoz ham, ortiqcha bosish ham yo'q.

export type VoiceCue = "noFace" | "many" | "closer" | "farther" | "center" | "turn" | "look" | "straight" | "done";

const CUES: readonly VoiceCue[] = ["noFace", "many", "closer", "farther", "center", "turn", "look", "straight", "done"];
const CLIP_DIR = "/xodim/face-voice";
const MUTE_KEY = "tizimli:face-voice-off";
/** Ko'rsatma shuncha turib qolsagina aytiladi: bir-ikki kadrlik sakrashlar jim o'tadi. */
const SETTLE_MS = 600;
/** Bir ibora qayta aytilishidan oldingi tanaffus. */
const REPEAT_MS = 7_000;
/** Bir urinishda bir ibora eng ko'pi bilan shuncha marta aytiladi. */
const MAX_TIMES = 3;
/** Ovoz hali tayyor bo'lmasa, shuncha vaqtdan keyin qayta uriniladi. */
const RETRY_MS = 400;
/** Ketma-ket iboralar orasidagi jimlik (s). */
const GAP_S = 0.15;

type ContextClass = typeof AudioContext;

function contextClass(): ContextClass | null {
  if (typeof window === "undefined") return null;
  return window.AudioContext ?? (window as unknown as { webkitAudioContext?: ContextClass }).webkitAudioContext ?? null;
}

let ctx: AudioContext | null = null;
let current: AudioBufferSourceNode | null = null;
/** Oxirgi ibora qachon tugaydi (ctx.currentTime o'lchovida). */
let endsAt = 0;
let loading: Promise<void> | null = null;
let muted: boolean | null = null;
const clips = new Map<VoiceCue, AudioBuffer>();

export function faceVoiceMuted(): boolean {
  if (muted === null) {
    try {
      muted = localStorage.getItem(MUTE_KEY) === "1";
    } catch {
      muted = false;
    }
  }
  return muted;
}

export function setFaceVoiceMuted(next: boolean): void {
  muted = next;
  try {
    if (next) localStorage.setItem(MUTE_KEY, "1");
    else localStorage.removeItem(MUTE_KEY);
  } catch {
    // Saqlanmasa faqat shu ochilishda eslab qolinadi.
  }
  if (next) {
    try {
      current?.stop();
    } catch {
      // Ibora allaqachon tugagan.
    }
    if (ctx) endsAt = ctx.currentTime;
  }
}

export function faceVoiceAvailable(lang: Lang): boolean {
  return lang !== "en" && contextClass() !== null;
}

/** Ovozni ochish uchun alohida bosish kerakmi (o'chirib qo'yilgan bo'lsa — kerak emas). */
export function faceVoiceNeedsTap(lang: Lang): boolean {
  return faceVoiceAvailable(lang) && !faceVoiceMuted() && ctx?.state !== "running";
}

function preload(context: AudioContext): void {
  loading ??= Promise.all(
    CUES.map(async (cue) => {
      const r = await fetch(`${CLIP_DIR}/${cue}.mp3`);
      if (!r.ok) return;
      const data = await r.arrayBuffer();
      // Eski WebKit'da decodeAudioData faqat callback bilan ishlaydi.
      const clip = await new Promise<AudioBuffer>((ok, no) => void context.decodeAudioData(data, ok, no));
      clips.set(cue, clip);
    }),
  )
    .then(() => undefined)
    .catch(() => {
      // Tarmoq uzilsa ovozsiz davom etadi; keyingi bosishda qayta uriniladi.
      loading = null;
    });
}

/** Faqat bosish ichida, SINXRON chaqirilsin — aks holda telefon ovozni ochmaydi. */
export function unlockFaceVoice(lang: Lang): void {
  const Context = contextClass();
  if (!Context || !faceVoiceAvailable(lang)) return;
  try {
    ctx ??= new Context();
    void ctx.resume().catch(() => undefined);
    // Bitta jim namuna: iOS shu bilan ovoz chiqarishga ruxsat beradi.
    const blank = ctx.createBufferSource();
    blank.buffer = ctx.createBuffer(1, 1, 22050);
    blank.connect(ctx.destination);
    blank.start(0);
    preload(ctx);
  } catch {
    ctx = null;
  }
}

/** Ibora navbatga qo'yildimi. Oldingisi tugagach boshlanadi, uni kesmaydi. */
export function sayFaceCue(cue: VoiceCue): boolean {
  const clip = clips.get(cue);
  if (!ctx || !clip || faceVoiceMuted()) return false;
  if (ctx.state !== "running") {
    void ctx.resume().catch(() => undefined);
    return false;
  }
  const src = ctx.createBufferSource();
  src.buffer = clip;
  src.connect(ctx.destination);
  const at = endsAt > ctx.currentTime ? endsAt + GAP_S : ctx.currentTime;
  src.start(at);
  endsAt = at + clip.duration;
  current = src;
  return true;
}

function busyMs(): number {
  return ctx ? Math.max(0, (endsAt - ctx.currentTime) * 1000) : 0;
}

/** Ko'rsatmani ovoz bilan aytadi: barqaror bo'lgach, oldingi ibora tugagach, cheklangan marta. */
export function useFaceVoice(cue: VoiceCue | null): void {
  const said = useRef(new Map<VoiceCue, { at: number; times: number }>());

  useEffect(() => {
    if (!cue) return;
    let timer = 0;
    const tick = () => {
      const log = said.current.get(cue) ?? { at: -REPEAT_MS, times: 0 };
      if (log.times >= MAX_TIMES) return;
      const now = performance.now();
      const wait = Math.max(log.at + REPEAT_MS - now, busyMs());
      if (wait > 0) timer = window.setTimeout(tick, wait);
      else if (sayFaceCue(cue)) {
        said.current.set(cue, { at: now, times: log.times + 1 });
        timer = window.setTimeout(tick, REPEAT_MS);
      } else timer = window.setTimeout(tick, RETRY_MS);
    };
    timer = window.setTimeout(tick, SETTLE_MS);
    return () => window.clearTimeout(timer);
  }, [cue]);
}
