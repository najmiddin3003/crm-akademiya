// MAC'DAGI «GENIE» ANIMATSIYASI (08.10.2026) — AI oynasi robot tugmasidan
// chiqadi va yopilganda unga qaytib kiradi, macOS'da oyna Dock'dagi
// belgiga kirib-chiqqanidek: oynaning tugma tomondagi qismi voronka bo'lib
// torayadi (yonlari S-egri), so'ng oyna shu voronka bo'ylab tugma ichiga
// «so'riladi». Ochilish — xuddi shu kadrlar teskari tartibda.
//
// Brauzerda oynani egib bo'lmaydi, shu bois ikki qatlam:
//   • SAHNA — butun ekranni egallagan o'ram; `clip-path: polygon(...)`
//     bilan voronka shaklida kesiladi. Koordinata — ekranniki: voronka
//     oynadan tashqariga, tugmagacha cho'ziladi;
//   • OYNA — `transform` bilan voronka bo'ylab siljiydi va siqiladi.
// Kadrlar shu yerda hisoblanadi (sof funksiya, scripts/_verify-ai.mjs
// sinaydi), ijro — Web Animations API (`playGenie`).
//
// Hisob voronka o'qi bo'yicha: u — oynaning tugmadan uzoq chetidan tugma
// tomon, v — unga ko'ndalang. Tugma qaysi tomonda (pastda, chapda …) —
// `genieSide` tanlaydi; nuqtalar keyin ekranning x/y'iga qaytariladi.

export interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

export type GenieSide = "top" | "bottom" | "left" | "right";

export interface GenieFrame {
  offset: number;
  /** Sahna uchun `clip-path` (ekran koordinatasida). */
  clip: string;
  /** Oyna uchun `transform` (`transform-origin: 0 0` bilan). */
  transform: string;
  opacity: number;
}

export const GENIE_OPEN_MS = 560;
export const GENIE_CLOSE_MS = 480;

/** 1-bosqich (voronka egiladi) — vaqtning shuncha qismi, qolgani — oyna voronkadan o'tadi. */
const BEND_PART = 0.42;
/** Shundan keyin oyna so'nadi: u allaqachon tugma kattaligida. */
const FADE_FROM = 0.82;
/** Mac'dagi kabi pastga (Dock tomon) ketish tabiiyroq — vertikal o'q biroz ustun. */
const VERTICAL_BIAS = 1.5;

const clamp01 = (t: number) => Math.min(1, Math.max(0, t));
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const smooth = (t: number) => t * t * (3 - 2 * t);
const easeInOut = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);
const easeIn = (t: number) => t * t;
const r1 = (n: number) => Math.round(n * 10) / 10;
const r4 = (n: number) => Math.round(n * 10_000) / 10_000;

/** Voronka qaysi tomonga: tugma oyna markazidan qaysi o'q bo'yicha ko'proq uzoqda (oyna o'lchamiga nisbatan). */
export function genieSide(win: Box, icon: Box): GenieSide {
  const dx = (icon.x + icon.w / 2 - (win.x + win.w / 2)) / Math.max(1, win.w);
  const dy = (icon.y + icon.h / 2 - (win.y + win.h / 2)) / Math.max(1, win.h);
  if (Math.abs(dy) * VERTICAL_BIAS >= Math.abs(dx)) return dy >= 0 ? "bottom" : "top";
  return dx >= 0 ? "right" : "left";
}

interface Axis {
  /** Oynaning o'q bo'yicha uzunligi. */
  depth: number;
  /** Oynaning ko'ndalang chegaralari (ekranda). */
  v0: number;
  v1: number;
  /** Tugmaning o'q bo'yicha (yaqin va uzoq) va ko'ndalang chegaralari. */
  iu0: number;
  iu1: number;
  iv0: number;
  iv1: number;
  /** (u, v) → ekrandagi (x, y). */
  point: (u: number, v: number) => [number, number];
  /** O'q bo'yicha [u0, u1] × ko'ndalang [va, vb] → ekrandagi to'rtburchak. */
  box: (u0: number, u1: number, va: number, vb: number) => Box;
}

function axisOf(win: Box, icon: Box, side: GenieSide): Axis {
  const right = win.x + win.w;
  const bottom = win.y + win.h;
  if (side === "bottom" || side === "top") {
    const down = side === "bottom";
    return {
      depth: win.h,
      v0: win.x,
      v1: right,
      iu0: down ? icon.y - win.y : bottom - (icon.y + icon.h),
      iu1: down ? icon.y + icon.h - win.y : bottom - icon.y,
      iv0: icon.x,
      iv1: icon.x + icon.w,
      point: (u, v) => [v, down ? win.y + u : bottom - u],
      box: (u0, u1, va, vb) => ({ x: va, y: down ? win.y + u0 : bottom - u1, w: vb - va, h: u1 - u0 }),
    };
  }
  const toRight = side === "right";
  return {
    depth: win.w,
    v0: win.y,
    v1: bottom,
    iu0: toRight ? icon.x - win.x : right - (icon.x + icon.w),
    iu1: toRight ? icon.x + icon.w - win.x : right - icon.x,
    iv0: icon.y,
    iv1: icon.y + icon.h,
    point: (u, v) => [toRight ? win.x + u : right - u, v],
    box: (u0, u1, va, vb) => ({ x: toRight ? win.x + u0 : right - u1, y: va, w: u1 - u0, h: vb - va }),
  };
}

/**
 * YOPILISH kadrlari: 0 — oyna o'z joyida, 1 — tugma ichida (ochilish —
 * shu ro'yxat teskari). Har kadrda ko'pburchak nuqtalari soni bir xil —
 * brauzer kadrlar orasini silliq to'ldiradi.
 *
 *   1-bosqich: oynaning tugma tomondagi qismi voronka bo'lib egiladi,
 *              oyna o'q bo'yicha tugmagacha cho'ziladi (yoki siqiladi);
 *   2-bosqich: oynaning uzoq cheti voronka bo'ylab tugmaga yetib keladi,
 *              eni ham voronka eniga torayadi.
 */
export function genieFrames(win: Box, icon: Box, frames = 28, points = 16): GenieFrame[] {
  const a = axisOf(win, icon, genieSide(win, icon));
  const iu0 = Math.max(a.iu0, 1);
  const iu1 = Math.max(a.iu1, iu0 + 1);
  const funnel = (u: number): [number, number] => {
    const s = smooth(clamp01(u / iu0));
    return [lerp(a.v0, a.iv0, s), lerp(a.v1, a.iv1, s)];
  };

  const out: GenieFrame[] = [];
  for (let i = 0; i <= frames; i++) {
    const p = i / frames;
    let u0: number;
    let u1: number;
    let bend: number;
    let across: [number, number];
    if (p <= BEND_PART) {
      bend = easeInOut(p / BEND_PART);
      u0 = 0;
      u1 = lerp(a.depth, iu1, bend);
      across = [a.v0, a.v1];
    } else {
      bend = 1;
      u0 = lerp(0, iu0, easeIn((p - BEND_PART) / (1 - BEND_PART)));
      u1 = iu1;
      across = funnel(u0);
    }

    const near: [number, number][] = [];
    const far: [number, number][] = [];
    for (let k = 0; k < points; k++) {
      const u = lerp(u0, u1, k / (points - 1));
      const [f0, f1] = funnel(u);
      near.push(a.point(u, lerp(a.v0, f0, bend)));
      far.push(a.point(u, lerp(a.v1, f1, bend)));
    }
    const poly = [...near, ...far.reverse()].map(([x, y]) => `${r1(x)}px ${r1(y)}px`).join(", ");
    const b = a.box(u0, u1, across[0], across[1]);
    out.push({
      offset: r4(p),
      clip: `polygon(${poly})`,
      transform: `translate(${r1(b.x - win.x)}px, ${r1(b.y - win.y)}px) scale(${r4(b.w / Math.max(1, win.w))}, ${r4(b.h / Math.max(1, win.h))})`,
      opacity: p <= FADE_FROM ? 1 : r4(1 - (p - FADE_FROM) / (1 - FADE_FROM)),
    });
  }
  return out;
}

export function rectOf(el: Element): Box {
  const r = el.getBoundingClientRect();
  return { x: r.left, y: r.top, w: r.width, h: r.height };
}

export function reducedMotion(): boolean {
  return typeof window !== "undefined" && !!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
}

/**
 * Animatsiyani boshlaydi: sahnaga voronka, oynaga siljish. Qaytaradi —
 * ikkala animatsiya (to'xtatish yoki teskari burish uchun); brauzer Web
 * Animations'ni bilmasa — `null` (chaqiruvchi animatsiyasiz davom etadi).
 * `fill: "both"` — oxirgi kadr saqlanib turadi: ochilishda chaqiruvchi
 * `endGenie` bilan tozalaydi, yopilishda oyna baribir yo'qoladi.
 */
export function playGenie(stage: HTMLElement, panel: HTMLElement, win: Box, icon: Box, mode: "open" | "close"): Animation[] | null {
  if (typeof panel.animate !== "function" || win.w < 1 || win.h < 1) return null;
  const frames = genieFrames(win, icon);
  const timing: KeyframeAnimationOptions = {
    duration: mode === "open" ? GENIE_OPEN_MS : GENIE_CLOSE_MS,
    easing: "linear",
    direction: mode === "open" ? "reverse" : "normal",
    fill: "both",
  };
  panel.style.transformOrigin = "0 0";
  return [
    stage.animate(frames.map((f) => ({ offset: f.offset, clipPath: f.clip })), timing),
    panel.animate(frames.map((f) => ({ offset: f.offset, transform: f.transform, opacity: f.opacity })), timing),
  ];
}

/** Ochilish tugadi — kesish va siljish olib tashlanadi, oyna odatdagidek ishlaydi. */
export function endGenie(anims: Animation[], panel: HTMLElement): void {
  for (const a of anims) a.cancel();
  panel.style.transformOrigin = "";
}

/** Hammasi tugaganda (yoki bekor qilinganda) hal bo'ladi — hech qachon xato bermaydi. */
export function genieDone(anims: Animation[]): Promise<void> {
  return Promise.all(anims.map((a) => a.finished)).then(
    () => undefined,
    () => undefined,
  );
}
