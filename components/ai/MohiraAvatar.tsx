"use client";

import { useEffect, useId, useRef, type RefObject } from "react";

// MOHIR — AI yordamchining roboti (09.10.2026, «Robot va interfeys —
// konsept 01»; avvalgi milliy libosli robot o'rnida). Chizma —
// foydalanuvchi bergan MohiraAI_robot.svg (koordinatalar o'sha, 480×550):
// oq sopol bosh, qora-firuza ekran, kapsula ko'zlar, antenna va yon
// modullar; to'liq ko'rinishda tanasi va ko'kragida «m».
//
// Ikki ko'rinish (`variant`):
//   • head — faqat bosh (32/48/72 px: tugma, sarlavha, xabar yonida);
//   • full — butun gavda (bo'sh suhbatdagi katta Mohira).
//
// Kayfiyat (`mood`) — harakat CSS'da (app/globals.css, «MOHIRA» bo'limi):
//   • idle     — odatiy: suzadi, ko'z qirpiydi, u yoq-bu yoqqa qaraydi;
//   • happy    — hursand: ko'zlari ◠ ◠, og'zi ochiq kulgi, sakraydi;
//   • sad      — hafa: qoshlari tushgan, ko'zlari pastda, labi osilgan,
//                antenna egilgan, ko'zidan yosh oqadi;
//   • thinking — o'ylayapti: ko'zlari tepaga, u yoq-bu yoqqa, antenna tez
//                miltillaydi;
//   • talking  — javob yozilyapti: og'zi gapiradi.
// Barcha yuzlar bir vaqtda chizilgan, kayfiyat faqat ko'rinishini
// almashtiradi — o'tish silliq.
//
// `gaze` — ko'zlar sichqonchaga qaraydi (faqat sichqoncha, 2.6 s qimirlamasa
// joyiga qaytadi). `greet` — paydo bo'lganda qo'l silkitib salomlashadi
// (faqat `full`). `still` — harakatsiz (eski xabarlar yonida: o'nlab
// animatsiya bir vaqtda aylanmasin). `disc` — oq doira ichida (konseptdagi
// kichik belgilar). `prefers-reduced-motion` da hammasi to'xtaydi.
//
// Bir sahifada bir nechta nusxa turadi — gradient va filtr id'lari
// `useId()` bilan noyob.

export type MohiraMood = "idle" | "happy" | "sad" | "thinking" | "talking";
export type MohiraVariant = "head" | "full";

const VIEW: Record<MohiraVariant, string> = {
  head: "60 -6 361 361",
  full: "44 20 392 500",
};

/** Ko'zlar sichqonchaga qaraydi: yo'nalish CSS o'zgaruvchilariga yoziladi (`.mh-gaze`, `.mh-face`). */
function useGaze(ref: RefObject<SVGSVGElement | null>, on: boolean) {
  useEffect(() => {
    const el = ref.current;
    if (!on || !el) return;
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
    let frame = 0;
    let rest = 0;
    let px = 0;
    let py = 0;
    const apply = () => {
      frame = 0;
      const r = el.getBoundingClientRect();
      if (!r.width) return;
      const dx = px - (r.left + r.width / 2);
      const dy = py - (r.top + r.height * 0.45);
      const d = Math.hypot(dx, dy);
      if (d < 1) return;
      // Yaqinda — deyarli to'g'riga, uzoqda — to'liq burilib qaraydi.
      const k = Math.min(1, d / 260);
      el.style.setProperty("--mh-gx", `${((dx / d) * k * 9).toFixed(2)}px`);
      el.style.setProperty("--mh-gy", `${((dy / d) * k * 6).toFixed(2)}px`);
      el.dataset.gaze = "";
    };
    const relax = () => {
      el.style.removeProperty("--mh-gx");
      el.style.removeProperty("--mh-gy");
      delete el.dataset.gaze;
    };
    const onMove = (e: PointerEvent) => {
      if (e.pointerType !== "mouse") return;
      px = e.clientX;
      py = e.clientY;
      if (!frame) frame = requestAnimationFrame(apply);
      window.clearTimeout(rest);
      rest = window.setTimeout(relax, 2600);
    };
    window.addEventListener("pointermove", onMove, { passive: true });
    return () => {
      window.removeEventListener("pointermove", onMove);
      cancelAnimationFrame(frame);
      window.clearTimeout(rest);
      relax();
    };
  }, [ref, on]);
}

export default function MohiraAvatar({
  className = "",
  mood = "idle",
  variant = "head",
  still = false,
  gaze = false,
  greet = false,
  disc = false,
}: {
  className?: string;
  mood?: MohiraMood;
  variant?: MohiraVariant;
  still?: boolean;
  gaze?: boolean;
  greet?: boolean;
  disc?: boolean;
}) {
  const uid = useId().replace(/[^A-Za-z0-9]/g, "");
  const id = (name: string) => `mh-${name}-${uid}`;
  const url = (name: string) => `url(#${id(name)})`;
  const ref = useRef<SVGSVGElement>(null);
  useGaze(ref, gaze && !still);
  const full = variant === "full";

  const svg = (
    <svg
      ref={ref}
      viewBox={VIEW[variant]}
      fill="none"
      className={`mh ${disc ? "" : className}`}
      data-mood={mood}
      data-variant={variant}
      data-still={still ? "" : undefined}
      data-greet={greet && full ? "" : undefined}
      aria-hidden="true"
    >
      <defs>
        <linearGradient id={id("shell")} x1="127" y1="86" x2="359" y2="305" gradientUnits="userSpaceOnUse">
          <stop stopColor="#FFFFFF" />
          <stop offset=".45" stopColor="#FDFEFE" />
          <stop offset=".78" stopColor="#E7F0F0" />
          <stop offset="1" stopColor="#ADCBCC" />
        </linearGradient>
        <linearGradient id={id("edge")} x1="85" y1="166" x2="132" y2="220" gradientUnits="userSpaceOnUse">
          <stop stopColor="#F3FCFC" />
          <stop offset="1" stopColor="#84B7BC" />
        </linearGradient>
        <linearGradient id={id("earR")} x1="370" y1="150" x2="410" y2="218" gradientUnits="userSpaceOnUse">
          <stop stopColor="#C7E4E5" />
          <stop offset="1" stopColor="#739CA2" />
        </linearGradient>
        <linearGradient id={id("screen")} x1="173" y1="107" x2="310" y2="275" gradientUnits="userSpaceOnUse">
          <stop stopColor="#183E48" />
          <stop offset=".52" stopColor="#102D35" />
          <stop offset="1" stopColor="#081D25" />
        </linearGradient>
        <linearGradient id={id("glass")} x1="199" y1="104" x2="241" y2="226" gradientUnits="userSpaceOnUse">
          <stop stopColor="#88CBCA" stopOpacity=".17" />
          <stop offset="1" stopColor="#87D5CD" stopOpacity="0" />
        </linearGradient>
        <linearGradient id={id("eye")} x1="195" y1="162" x2="195" y2="210" gradientUnits="userSpaceOnUse">
          <stop stopColor="#AEFFF2" />
          <stop offset=".55" stopColor="#5FF1DC" />
          <stop offset="1" stopColor="#23C8BD" />
        </linearGradient>
        <linearGradient id={id("teal")} x1="209" y1="35" x2="257" y2="68" gradientUnits="userSpaceOnUse">
          <stop stopColor="#B6FFF0" />
          <stop offset=".5" stopColor="#39CEBD" />
          <stop offset="1" stopColor="#058B99" />
        </linearGradient>
        <radialGradient id={id("beacon")}>
          <stop stopColor="#7FF5E4" stopOpacity=".8" />
          <stop offset="1" stopColor="#5FF1DC" stopOpacity="0" />
        </radialGradient>
        {full && (
          <>
            <linearGradient id={id("body")} x1="175" y1="305" x2="300" y2="432" gradientUnits="userSpaceOnUse">
              <stop stopColor="#FFFFFF" />
              <stop offset=".45" stopColor="#F4FAFA" />
              <stop offset=".8" stopColor="#DAEAEA" />
              <stop offset="1" stopColor="#9BBFC2" />
            </linearGradient>
            <linearGradient id={id("arm")} x1="120" y1="322" x2="169" y2="378" gradientUnits="userSpaceOnUse">
              <stop stopColor="#FFFFFF" />
              <stop offset=".5" stopColor="#EBF7F6" />
              <stop offset="1" stopColor="#97BFC1" />
            </linearGradient>
            <linearGradient id={id("armR")} x1="325" y1="323" x2="359" y2="382" gradientUnits="userSpaceOnUse">
              <stop stopColor="#F4FFFF" />
              <stop offset=".5" stopColor="#D8E9E9" />
              <stop offset="1" stopColor="#7FAAAF" />
            </linearGradient>
            <linearGradient id={id("neck")} x1="216" y1="289" x2="269" y2="315" gradientUnits="userSpaceOnUse">
              <stop stopColor="#AED0D1" />
              <stop offset="1" stopColor="#709FA4" />
            </linearGradient>
            <linearGradient id={id("foot")} x1="198" y1="417" x2="213" y2="450" gradientUnits="userSpaceOnUse">
              <stop stopColor="#F4FBFB" />
              <stop offset="1" stopColor="#9DC5C7" />
            </linearGradient>
            <radialGradient id={id("belly")}>
              <stop stopColor="#F8FFFF" />
              <stop offset="1" stopColor="#D6E8E7" />
            </radialGradient>
            <filter id={id("soft")}>
              <feGaussianBlur stdDeviation="9" />
            </filter>
          </>
        )}
        <filter id={id("glow")} x="-100%" y="-100%" width="300%" height="300%">
          <feGaussianBlur stdDeviation="5" />
        </filter>
        <filter id={id("shadow")} x="-30%" y="-30%" width="160%" height="180%">
          <feDropShadow dx="0" dy="7" stdDeviation="9" floodColor="#193A42" floodOpacity=".12" />
        </filter>
      </defs>

      {/* Yerdagi soya — gavda ko'tarilganda kichrayadi. */}
      {full && <ellipse className="mh-ground" cx="241" cy="492" rx="92" ry="10" fill="#365E65" opacity=".13" filter={url("soft")} />}

      <g className="mh-float">
        {full && (
          <g>
            <rect x="215" y="280" width="52" height="41" rx="19" fill={url("neck")} />
            <rect x="185" y="413" width="45" height="31" rx="15.5" transform="rotate(-8 185 413)" fill={url("foot")} />
            <rect x="253" y="407" width="45" height="31" rx="15.5" transform="rotate(8 253 407)" fill={url("foot")} />
            <g className="mh-arm mh-arm-l">
              <rect x="140" y="315" width="30" height="75" rx="15" transform="rotate(17 140 315)" fill={url("arm")} stroke="#DBECEB" strokeWidth="1" />
            </g>
            <g className="mh-arm mh-arm-r">
              <rect x="310" y="324" width="30" height="75" rx="15" transform="rotate(-17 310 324)" fill={url("armR")} stroke="#C5DEDD" strokeWidth="1" />
            </g>
            <path
              d="M181 310C196 295 218 294 240 294C262 294 284 295 300 310C314 324 316 355 307 382L297 408C290 427 268 439 240 439C212 439 190 427 183 408L173 382C164 355 167 324 181 310Z"
              fill={url("body")}
              stroke="#DCEAE9"
              strokeWidth="1.5"
            />
            <path d="M179 323C183 306 206 299 228 299" stroke="white" strokeWidth="5" strokeLinecap="round" opacity=".9" />
            <ellipse cx="240" cy="365" rx="38" ry="37" fill={url("belly")} />
            <ellipse cx="240" cy="365" rx="37.5" ry="36.5" stroke="#C8DEDC" />
            {/* Ko'krakdagi «m» — robot va MohirAI belgisi bitta. */}
            <path
              d="M221 374V360C221 350 238 350 240 360V374M240 360C242 350 259 350 259 360V374"
              stroke="#0696A0"
              strokeWidth="6.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <path d="M216 415Q240 423 264 415" stroke="#94B6B7" strokeWidth="1.5" strokeLinecap="round" opacity=".6" />
          </g>
        )}

        <g className="mh-head">
          {/* Antenna — yagona tanish urg'u; ortida nur miltillaydi. */}
          <g className="mh-antenna">
            <circle className="mh-beacon" cx="240" cy="49" r="24" fill={url("beacon")} />
            <path d="M241 89V60" stroke="#ADCBD0" strokeWidth="10" strokeLinecap="round" />
            <path d="M239 87V61" stroke="#F3FFFF" strokeWidth="3" strokeLinecap="round" />
            <ellipse cx="240" cy="49" rx="16" ry="15" fill={url("teal")} />
            <ellipse cx="235" cy="44" rx="6" ry="4" fill="#F0FFFF" opacity=".65" />
          </g>

          {/* Yon modullar — chiroqlari «ishlayotganda» tezroq yonadi. */}
          <g className="mh-ear mh-ear-l">
            <rect x="72" y="155" width="44" height="81" rx="22" fill={url("edge")} />
            <rect x="76" y="168" width="10" height="49" rx="5" fill="#0A8F9C" />
            <path className="mh-ear-light" d="M83 172V210" stroke="#78E5D7" strokeWidth="3" strokeLinecap="round" />
          </g>
          <g className="mh-ear mh-ear-r">
            <rect x="366" y="155" width="43" height="81" rx="21.5" fill={url("earR")} />
            <rect x="393" y="168" width="10" height="49" rx="5" fill="#087F8F" />
            <path className="mh-ear-light" d="M397 174V207" stroke="#64CCCA" strokeWidth="3" strokeLinecap="round" />
          </g>

          {/* Sopol bosh va ekran (shisha yaltirog'i bilan). */}
          <g filter={url("shadow")}>
            <path
              d="M97 168C99 116 118 84 169 80C212 77 267 77 311 80C362 84 381 116 383 168L382 214C381 266 355 296 310 301C266 306 214 306 170 301C125 296 99 266 98 214L97 168Z"
              fill={url("shell")}
              stroke="#D4E7E7"
              strokeWidth="1.5"
            />
            <path d="M108 156C111 112 133 93 173 90C213 86 263 86 306 89" stroke="white" strokeWidth="6" strokeLinecap="round" opacity=".96" />
            <path
              d="M127 140C138 116 155 108 181 107C220 104 260 104 299 107C325 108 342 116 353 140C364 163 365 219 352 242C343 259 325 269 300 271C263 274 217 274 180 271C155 269 137 259 128 242C115 219 116 163 127 140Z"
              fill="#72959C"
            />
            <path
              d="M129 142C139 119 156 111 181 110C220 107 260 107 299 110C324 111 341 119 351 142C361 164 362 218 350 240C341 256 324 266 300 268C263 271 217 271 180 268C156 266 139 256 130 240C118 218 119 164 129 142Z"
              fill={url("screen")}
            />
            <path
              d="M129 150C140 124 155 115 184 114C226 111 263 111 300 114C326 115 342 126 350 147C296 134 220 135 170 162C145 175 133 194 123 204C121 184 123 164 129 150Z"
              fill={url("glass")}
            />
            <path d="M142 130C165 116 188 119 203 117" stroke="#A0D8D9" strokeWidth="2" opacity=".2" strokeLinecap="round" />
            <path d="M178 289C214 293 267 293 302 289" stroke="white" strokeWidth="2.5" strokeLinecap="round" opacity=".85" />
          </g>

          {/* YUZ. Ichma-ich guruhlar: yuz (sichqonchaga biroz) → nigoh (ko'proq)
              → atrofga qarash → kayfiyat (ko'z holati) → qirpish. */}
          <g className="mh-face">
            <g className="mh-gaze">
              <g className="mh-look">
                <g className="mh-eyes">
                  <g className="mh-blink">
                    <g opacity=".2" filter={url("glow")}>
                      <rect x="174" y="163" width="31" height="42" rx="15.5" fill="#53E7D6" />
                      <rect x="275" y="163" width="31" height="42" rx="15.5" fill="#53E7D6" />
                    </g>
                    <rect x="174" y="162" width="30" height="43" rx="15" fill={url("eye")} />
                    <rect x="276" y="162" width="30" height="43" rx="15" fill={url("eye")} />
                    <path d="M180 171C180 167 184 165 188 165" stroke="#D7FFF9" strokeWidth="2" strokeLinecap="round" opacity=".65" />
                    <path d="M282 171C282 167 286 165 290 165" stroke="#D7FFF9" strokeWidth="2" strokeLinecap="round" opacity=".65" />
                  </g>
                  {/* Hursand — ◠ ◠ */}
                  <path className="mh-joy" d="M175 191Q189 166 203 191M277 191Q291 166 305 191" stroke={url("eye")} strokeWidth="10" strokeLinecap="round" />
                </g>
                {/* Hafa — ichki uchi ko'tarilgan qoshlar */}
                <path className="mh-brows" d="M174 154L203 143M277 143L306 154" stroke="#61E4D3" strokeWidth="5" strokeLinecap="round" />
              </g>
            </g>
            <path className="mh-smile" d="M219 221Q240 238 261 221" stroke="#61E4D3" strokeWidth="5" strokeLinecap="round" />
            <path className="mh-grin" d="M214 217Q240 221 266 217Q262 246 240 246Q218 246 214 217Z" fill="#61E4D3" />
            <path className="mh-frown" d="M223 234Q240 221 257 234" stroke="#61E4D3" strokeWidth="5" strokeLinecap="round" />
            <path className="mh-hmm" d="M227 229Q233.5 223 240 228T253 227" stroke="#61E4D3" strokeWidth="5" strokeLinecap="round" />
            <ellipse className="mh-talk" cx="240" cy="229" rx="12" ry="9" fill="#61E4D3" />
            <circle className="mh-cheek" cx="152" cy="219" r="3" fill="#37B7B2" opacity=".5" />
            <circle className="mh-cheek" cx="328" cy="219" r="3" fill="#37B7B2" opacity=".5" />
            <path
              className="mh-tear"
              d="M181 205C176 212 174.5 215.5 174.5 218.5C174.5 222.5 177.5 225 181 225C184.5 225 187.5 222.5 187.5 218.5C187.5 215.5 186 212 181 205Z"
              fill="#8EEFE3"
            />
          </g>
        </g>
      </g>
    </svg>
  );

  return disc ? <span className={`mh-disc ${className}`}>{svg}</span> : svg;
}
