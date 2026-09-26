import type { CSSProperties } from "react";

// JONLI KOSMOS FONI — Reyting sahifasi va proyektor ekrani orqasida
// yulduzlar sekin suzib yuradi, yorqinlarining bir qismi miltillaydi.
//
// YENGIL: JS tsikli, taymer va qayta chizish yo'q. Yulduzlar SVG plitkada
// bir marta chiziladi; qatlamlar faqat `transform` (suzish) va `opacity`
// (miltillash) bilan qimirlaydi — bu brauzer kompozitorida, asosiy oqimga
// tegmaydi. Qatlamlar har xil o'lcham va tezlikda: uzoqdagilar sekin,
// yaqindagilar tezroq — chuqurlik (parallaks) hissi. Plitka o'lchamlari
// har xil bo'lgani uchun takrorlanish ko'zga tashlanmaydi.
//
// Tasodif deterministik (urug'li): server va mijoz bir xil chizadi —
// gidratatsiya farqi bo'lmaydi. «Harakatni kamaytirish» yoqilgan bo'lsa
// yulduzlar joyida turadi (gamification.css).

interface Layer {
  /** Plitka tomoni, px — qatlam shu masofaga surilib, aylanib turadi. */
  tile: number;
  count: number;
  /** Yulduz radiusi oralig'i, px. */
  r: [number, number];
  seed: number;
  /** Bir plitka masofasini necha soniyada o'tadi (katta — sekinroq). */
  seconds: number;
  /** Atrofida yumshoq nur. */
  glow?: boolean;
  /** To'rt qirrali yaltirash (eng yorqinlari). */
  sparkle?: boolean;
  /** Miltillash davri va kechikishi, s. */
  twinkle?: [number, number];
}

const LAYERS: Layer[] = [
  { tile: 380, count: 70, r: [0.35, 0.8], seed: 11, seconds: 240 },
  { tile: 470, count: 30, r: [0.6, 1.15], seed: 23, seconds: 160 },
  { tile: 560, count: 11, r: [0.9, 1.4], seed: 37, seconds: 105, glow: true },
  { tile: 530, count: 6, r: [1.0, 1.5], seed: 41, seconds: 130, glow: true, sparkle: true, twinkle: [4.2, 0] },
  { tile: 610, count: 6, r: [1.0, 1.6], seed: 53, seconds: 150, glow: true, sparkle: true, twinkle: [5.6, -2.3] },
];

// Oq ko'proq, qolgani — havorang, iliq va binafsha tus.
const COLORS = ["255,255,255", "255,255,255", "255,255,255", "255,255,255", "205,222,255", "205,222,255", "255,236,212", "226,212,255"];

/** Urug'li tasodif (mulberry32). */
function random(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const f = (n: number) => n.toFixed(2).replace(/\.?0+$/, "");

function tileImage(l: Layer): string {
  const rnd = random(l.seed);
  // Nur/yaltirash plitka chetidan chiqmasin — aks holda chokda yarim yulduz qoladi.
  const pad = Math.ceil(l.r[1] * (l.sparkle ? 9 : l.glow ? 5 : 1)) + 1;
  const defs =
    (l.glow ? "<radialGradient id='g'><stop offset='0' stop-color='rgb(255,255,255)' stop-opacity='.55'/><stop offset='.4' stop-color='rgb(190,210,255)' stop-opacity='.18'/><stop offset='1' stop-color='rgb(190,210,255)' stop-opacity='0'/></radialGradient>" : "") +
    (l.sparkle ? "<radialGradient id='s'><stop offset='0' stop-color='rgb(255,255,255)' stop-opacity='.8'/><stop offset='1' stop-color='rgb(255,255,255)' stop-opacity='0'/></radialGradient>" : "");
  let body = "";
  for (let i = 0; i < l.count; i++) {
    const x = f(pad + rnd() * (l.tile - 2 * pad));
    const y = f(pad + rnd() * (l.tile - 2 * pad));
    const r = l.r[0] + rnd() * (l.r[1] - l.r[0]);
    const c = COLORS[Math.floor(rnd() * COLORS.length)];
    const o = f(0.45 + rnd() * 0.55);
    if (l.glow) body += `<circle cx='${x}' cy='${y}' r='${f(r * 5)}' fill='url(#g)'/>`;
    if (l.sparkle) {
      body += `<ellipse cx='${x}' cy='${y}' rx='${f(r * 9)}' ry='${f(r * 0.35)}' fill='url(#s)'/>`;
      body += `<ellipse cx='${x}' cy='${y}' rx='${f(r * 0.35)}' ry='${f(r * 9)}' fill='url(#s)'/>`;
    }
    body += `<circle cx='${x}' cy='${y}' r='${f(r)}' fill='rgb(${c})' fill-opacity='${o}'/>`;
  }
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='${l.tile}' height='${l.tile}'>${defs ? `<defs>${defs}</defs>` : ""}${body}</svg>`;
  // Qo'shtirnoq ichidagi data-URI uchun shu belgilarni kodlash kifoya.
  return `url("data:image/svg+xml,${svg.replace(/[<>#%]/g, encodeURIComponent)}")`;
}

// Modul darajasida bir marta — har renderda qayta hisoblanmaydi.
const STYLES: CSSProperties[] = LAYERS.map(
  (l) =>
    ({
      backgroundImage: tileImage(l),
      "--t": `${l.tile}px`,
      "--d": `${l.seconds}s`,
      ...(l.twinkle ? { "--tw": `${l.twinkle[0]}s`, "--twd": `${l.twinkle[1]}s` } : {}),
    }) as CSSProperties,
);

/** Ota element `isolate` (yoki boshqa stacking context) bo'lsin — fon `z-index: -1` da turadi. */
export default function SpaceBackdrop() {
  return (
    <div aria-hidden className="gm-space">
      <div className="gm-space-view">
        {LAYERS.map((l, i) => (
          <div key={l.seed} className={l.twinkle ? "gm-space-layer gm-space-twinkle" : "gm-space-layer"} style={STYLES[i]} />
        ))}
      </div>
    </div>
  );
}
