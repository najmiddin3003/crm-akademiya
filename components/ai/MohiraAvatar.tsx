"use client";

import { useId } from "react";

// MOHIRA — AI yordamchining harakatlanuvchi roboti (08.10.2026; avvalgi
// ko'k robot yuzi components/tezlik/RobotFace.tsx o'rnida).
//
// Milliy ko'rinish: boshida chust do'ppi (qora, oq «qalampir» naqsh),
// ikki tomonda sochpopukli kokillar, quloqlarida zirak, yelkasida atlas
// (abr) naqsh; ko'zlari Samarqand firuzasi rangida.
//
// Holatlar (`state`) — harakat CSS'da (app/globals.css, «MOHIRA» bo'limi):
//   • idle     — nafas oladi (biroz tebranadi), ko'z qirpiydi, kokil va
//                zirak chayqaladi;
//   • thinking — ko'zlari u yoq-bu yoqqa qaraydi, boshi qiyshayadi, do'ppi
//                naqshi yaltiraydi, yonida uchqunlar;
//   • talking  — og'zi gapiradi (javob yozilyapti).
// `still` — harakatsiz (eski xabarlar yonidagi kichik rasm: o'nlab
// animatsiya bir vaqtda aylanmasin). `prefers-reduced-motion` da ham
// hammasi to'xtaydi.
//
// Bir sahifada bir nechta nusxa turadi — gradient va kesish id'lari
// `useId()` bilan noyob.

export type MohiraState = "idle" | "thinking" | "talking";

/** Atlas naqshining zigzag chiziqlari: x va rang. */
const ATLAS = [
  { x: 13, c: "#FACC15" },
  { x: 19, c: "#2563EB" },
  { x: 25, c: "#F8FAFC" },
  { x: 31, c: "#16A34A" },
  { x: 37, c: "#FACC15" },
  { x: 43, c: "#2563EB" },
  { x: 49, c: "#F8FAFC" },
];
const ZIGZAG = "l1.6 2 l-1.6 2 ".repeat(3);

/** Kokil bo'g'inlari (chap tomon; o'ngi — ko'zgu aksi). */
const BRAID = [
  { cx: 13.6, cy: 40.6, rx: 2.9, ry: 3.3 },
  { cx: 12.8, cy: 45.6, rx: 2.7, ry: 3.1 },
  { cx: 12.2, cy: 50.4, rx: 2.5, ry: 2.9 },
  { cx: 11.8, cy: 54.8, rx: 2.2, ry: 2.6 },
];

function Braid({ side }: { side: "l" | "r" }) {
  const x = (v: number) => (side === "l" ? v : 64 - v);
  return (
    <g className={`mh-braid mh-braid-${side}`}>
      {BRAID.map((s, i) => (
        <g key={i}>
          <ellipse cx={x(s.cx)} cy={s.cy} rx={s.rx} ry={s.ry} fill="#2E2148" />
          <path d={`M${x(s.cx) - s.rx + 0.7} ${s.cy - 0.6} q${s.rx - 0.7} 1.5 ${(s.rx - 0.7) * 2} 0`} stroke="#5B4A8B" strokeWidth=".8" fill="none" strokeLinecap="round" />
        </g>
      ))}
      <circle cx={x(11.7)} cy="58.3" r="1.5" fill="#F4B63F" />
      <path d={`M${x(11.7)} 59.6 v2.8`} stroke="#F43F5E" strokeWidth="2" strokeLinecap="round" />
    </g>
  );
}

function Earring({ side }: { side: "l" | "r" }) {
  const cx = side === "l" ? 12.4 : 51.6;
  return (
    <g className={`mh-earring mh-earring-${side}`}>
      <path d={`M${cx} 39.1 v1.7`} stroke="#F4B63F" strokeWidth=".9" strokeLinecap="round" />
      <path d={`M${cx} 40.8 c-1.5 1.7 -1.3 3.4 0 3.6 c1.3 -0.2 1.5 -1.9 0 -3.6 z`} fill="#F43F5E" stroke="#F4B63F" strokeWidth=".5" />
    </g>
  );
}

export default function MohiraAvatar({
  className = "",
  state = "idle",
  still = false,
}: {
  className?: string;
  state?: MohiraState;
  still?: boolean;
}) {
  const uid = useId().replace(/[^A-Za-z0-9]/g, "");
  const id = (name: string) => `mh-${name}-${uid}`;
  const url = (name: string) => `url(#${id(name)})`;

  return (
    <svg viewBox="0 0 64 64" className={`mh ${className}`} data-state={state} data-still={still ? "" : undefined} aria-hidden="true">
      <defs>
        <linearGradient id={id("head")} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#FFFFFF" />
          <stop offset="1" stopColor="#DCE4FF" />
        </linearGradient>
        <linearGradient id={id("screen")} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#1A2B5E" />
          <stop offset="1" stopColor="#0B1533" />
        </linearGradient>
        <linearGradient id={id("cap")} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#2B2B3A" />
          <stop offset="1" stopColor="#101018" />
        </linearGradient>
        <clipPath id={id("body")}>
          <path d="M10 64 C10 56.4 18 52.6 32 52.6 C46 52.6 54 56.4 54 64 Z" />
        </clipPath>
      </defs>

      <g className="mh-bob">
        {/* Yelka — atlas naqshli ko'ylak, bo'ynida oltin jiyak */}
        <g clipPath={url("body")}>
          <rect x="9" y="52" width="46" height="12" fill="#DB2777" />
          {ATLAS.map((s) => (
            <path key={s.x} d={`M${s.x} 52 ${ZIGZAG}`} stroke={s.c} strokeWidth="2.4" strokeLinejoin="round" fill="none" />
          ))}
        </g>
        <Braid side="l" />
        <Braid side="r" />
        <rect x="28.4" y="47" width="7.2" height="7" rx="2.2" fill="#C7D2FE" />
        <path d="M24.6 53.4 Q32 58.6 39.4 53.4" stroke="#F4B63F" strokeWidth="1.8" strokeLinecap="round" fill="none" />

        <g className="mh-head">
          {/* Quloqlar (oltin) va zirak */}
          <circle cx="12.4" cy="35.8" r="3.4" fill="#F4B63F" />
          <circle cx="12.4" cy="35.8" r="1.6" fill="#FDE68A" />
          <circle cx="51.6" cy="35.8" r="3.4" fill="#F4B63F" />
          <circle cx="51.6" cy="35.8" r="1.6" fill="#FDE68A" />
          <Earring side="l" />
          <Earring side="r" />

          <rect x="13" y="20" width="38" height="31" rx="13.5" fill={url("head")} stroke="#B6C4F2" strokeWidth=".8" />
          <path d="M16.4 30.5 Q15.6 34 16.4 37.5" stroke="#FFFFFF" strokeWidth="1.2" strokeLinecap="round" fill="none" opacity=".9" />
          <rect x="18" y="26.6" width="28" height="19" rx="8.6" fill={url("screen")} />

          <g className="mh-look">
            <g className="mh-eyes">
              <ellipse cx="25.4" cy="35.4" rx="3.1" ry="3.7" fill="#5EEAD4" />
              <ellipse cx="38.6" cy="35.4" rx="3.1" ry="3.7" fill="#5EEAD4" />
              <circle cx="26.4" cy="34" r="1.05" fill="#FFFFFF" />
              <circle cx="39.6" cy="34" r="1.05" fill="#FFFFFF" />
              <path d="M22.6 32.6 l-1.6 -1.2 M41.4 32.6 l1.6 -1.2" stroke="#5EEAD4" strokeWidth="1" strokeLinecap="round" />
            </g>
          </g>
          <ellipse cx="21.4" cy="40.8" rx="2.1" ry="1.15" fill="#FB7185" opacity=".55" />
          <ellipse cx="42.6" cy="40.8" rx="2.1" ry="1.15" fill="#FB7185" opacity=".55" />
          <path className="mh-smile" d="M29.2 40.8 Q32 43.2 34.8 40.8" stroke="#5EEAD4" strokeWidth="1.5" strokeLinecap="round" fill="none" />
          <ellipse className="mh-talk" cx="32" cy="41.6" rx="2.2" ry="1.3" fill="#5EEAD4" />

          {/* Chust do'ppi: qora, oq hoshiya va «qalampir» naqsh */}
          <path d="M16.2 23.6 C16.6 18.2 17.4 13.4 19 10.8 Q32 7.4 45 10.8 C46.6 13.4 47.4 18.2 47.8 23.6 Q32 26 16.2 23.6 Z" fill={url("cap")} />
          <path d="M19.4 11.1 Q32 7.9 44.6 11.1" stroke="#F8FAFC" strokeWidth=".9" fill="none" opacity=".9" />
          <path d="M16.5 22 Q32 24.5 47.5 22" stroke="#F8FAFC" strokeWidth="1.9" fill="none" />
          <path
            className="mh-motif"
            d="M32 11.6 C35.7 13.8 36.3 18.4 33 20.4 C31.2 21.4 28.9 20.4 29.1 18.3 C29.3 16.5 31.4 16.2 32.4 14.8 C33 13.8 32.8 12.6 32 11.6 Z"
            fill="#F8FAFC"
          />
          <circle cx="32.4" cy="18.4" r=".85" fill="#15151E" />
          <path
            className="mh-motif-line"
            d="M20.8 12.8 C19.5 15.4 19.6 18.8 21.3 21.2 M43.2 12.8 C44.5 15.4 44.4 18.8 42.7 21.2"
            stroke="#F8FAFC"
            strokeWidth="1.3"
            strokeLinecap="round"
            fill="none"
          />
        </g>

        {/* O'ylayotganda — uchqunlar */}
        <path className="mh-spark mh-spark-a" d="M54.5 6 Q55.2 10.3 59.5 11 Q55.2 11.7 54.5 16 Q53.8 11.7 49.5 11 Q53.8 10.3 54.5 6 Z" fill="#FACC15" />
        <path className="mh-spark mh-spark-b" d="M9 9.5 Q9.4 12 12 12.4 Q9.4 12.8 9 15.3 Q8.6 12.8 6 12.4 Q8.6 12 9 9.5 Z" fill="#5EEAD4" />
      </g>
    </svg>
  );
}
