import type { ReactNode } from "react";
import s from "./FaceGuide.module.css";

// YUZ MAKETI — kamera doirasi ustidagi yuz shakli (04.11.2026). Tinch turganda
// yuzni qayerga olib kelishni ko'rsatadi, jonlilik paytida so'ralgan harakatni
// o'zi bajaradi va odam unga qarab takrorlaydi: ko'z yumib ochadi yoki chapga,
// keyin o'ngga buriladi.
//
// Faqat ko'rinish: yuz aniqlash <video> ni o'zi o'qiydi (FaceCapture), maket
// kadrga ham, suratga ham tushmaydi.
//
// Chap va o'ng EKRAN bo'yicha: video ko'zgudek, odam o'z chapiga qarasa ekranda
// ham chapga buriladi — maketga ergashsa adashmaydi.
//
// Har a'zo o'z <svg> qatlamida, 240×240 umumiy o'lchovda. Sababi FaceGuide.module.css da.

export type FaceDemo = "blink" | "turn" | null;

const HEAD = "M120 30C160 30 190 62 190 108C190 152 160 210 120 210C80 210 50 152 50 108C50 62 80 30 120 30Z";
const BROW_L = "M74 85Q87 78 101 84";
const BROW_R = "M139 84Q153 78 166 85";
const EYE_L = "M71 108Q87 95 103 108Q87 119 71 108Z";
const EYE_R = "M137 108Q153 95 169 108Q153 119 137 108Z";
// Kipriklar bilan: qosh va yuqoriga ochiq yoy birga katta ochiq ko'zga o'xshab qolardi.
const LID_L = "M71 108Q87 118 103 108M76 112L72 118M87 114V121M98 112L102 118";
const LID_R = "M137 108Q153 118 169 108M142 112L138 118M153 114V121M164 112L168 118";
const NOSE = "M120 118V140M110 146Q120 155 130 146";
const MOUTH = "M96 176Q120 190 144 176";

function Part({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <svg viewBox="0 0 240 240" className={className ? `${s.part} ${className}` : s.part}>
      {children}
    </svg>
  );
}

/** Oq chiziq va ostida qora soya: har qanday kadr ustida ko'rinsin. */
function Line({ d }: { d: string }) {
  return (
    <>
      <path d={d} className={s.halo} />
      <path d={d} className={s.line} />
    </>
  );
}

function Eye({ d, cx }: { d: string; cx: number }) {
  return (
    <>
      <path d={d} className={s.eyeWhite} />
      <circle cx={cx} cy={107} r={6} className={s.iris} />
    </>
  );
}

export default function FaceGuide({ demo }: { demo: FaceDemo }) {
  return (
    <div aria-hidden className={s.guide} data-demo={demo ?? undefined}>
      <div className={s.scrim} />
      <Part className={s.head}>
        <Line d={HEAD} />
      </Part>
      <div className={s.features}>
        <Part className={s.browL}>
          <Line d={BROW_L} />
        </Part>
        <Part className={s.browR}>
          <Line d={BROW_R} />
        </Part>
        <Part className={s.eyeL}>
          <Eye d={EYE_L} cx={87} />
        </Part>
        <Part className={s.eyeR}>
          <Eye d={EYE_R} cx={153} />
        </Part>
        <Part className={s.lids}>
          <Line d={LID_L} />
          <Line d={LID_R} />
        </Part>
        <Part className={s.nose}>
          <Line d={NOSE} />
        </Part>
        <Part className={s.mouth}>
          <Line d={MOUTH} />
        </Part>
      </div>
    </div>
  );
}
