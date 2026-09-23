"use client";

import { useId, type ReactNode } from "react";

// So'rovnoma ikonkalari — prototipdagi `P` (24×24 chiziqli yo'llar) va
// `FLAG` (doira ichidagi soddalashtirilgan bayroqlar). Kalit — tanlov nomi;
// sozlamada yangi kurs qo'shilsa va unga ikonka bo'lmasa, yo'nalishning
// umumiy belgisi chiziladi (`fallback`).

const P: Record<string, string> = {
  // Fanlar
  "Ona tili": "M3 5.5c2.5-1 5.5-1 9 1 3.5-2 6.5-2 9-1v13c-2.5-1-5.5-1-9 1-3.5-2-6.5-2-9-1z M12 6.5v13",
  Matematika: "M7 4v6M4 7h6 M14 7h6 M5 15l4 4M9 15l-4 4 M14 15.5h6M14 18.5h6",
  Fizika: "M5 3h4v9a3 3 0 006 0V3h4v9a7 7 0 01-14 0z M5 7h4M15 7h4",
  Kimyo: "M9 3h6 M10 3v6l-5.4 9.4A1.7 1.7 0 006 21h12a1.7 1.7 0 001.4-2.6L14 9V3 M7.2 15h9.6",
  Biologiya: "M7 3c0 5 10 5 10 9s-10 4-10 9 M17 3c0 5-10 5-10 9s10 4 10 9 M8.5 6.5h7M8.5 17.5h7",
  Tarix: "M6 3h12M6 21h12 M7 3c0 5 5 6 5 9s-5 4-5 9 M17 3c0 5-5 6-5 9s5 4 5 9",
  Huquq: "M12 3v17 M7 21h10 M4 7h16 M6 7l-3 7a3 2 0 006 0z M18 7l-3 7a3 2 0 006 0z",
  Geografiya: "M12 21a9 9 0 100-18 9 9 0 000 18z M3 12h18 M12 3c3 3 4 6 4 9s-1 6-4 9 M12 3c-3 3-4 6-4 9s1 6 4 9",
  // Sertifikatlar
  IELTS: "M8 3l2.5 6M16 3l-2.5 6 M18 15a6 6 0 11-12 0 6 6 0 0112 0z M12 12.5v5",
  CEFR: "M4 20v-5M9 20v-8M14 20V8M19 20V4 M3 21h18",
  SAT: "M14 3H6a1 1 0 00-1 1v16a1 1 0 001 1h12a1 1 0 001-1V8z M14 3v5h5 M8 13h7M8 17h4",
  Multilevel: "M12 2.5l9 4.5-9 4.5L3 7z M3 12l9 4.5 9-4.5 M3 16.5l9 4.5 9-4.5",
  "Milliy sertifikat":
    "M10 15H4V4h16v11h-4 M8 8h8M8 11h4 M15.5 18a2.5 2.5 0 100-5 2.5 2.5 0 000 5z M14 17.5l-.8 4 2.3-1.3 2.3 1.3-.8-4",
  // Maktablar
  "Prezident maktablari": "M12 3l2.6 5.6 6 .7-4.5 4.1 1.2 6L12 16.8l-5.3 2.6 1.2-6-4.5-4.1 6-.7z",
  "Ixtisoslashtirilgan maktablar": "M2 9l10-5 10 5-10 5z M6 11v5c0 1.5 3 3 6 3s6-1.5 6-3v-5 M22 9v5",
  "Ijod maktablari":
    "M12 3a9 9 0 100 18c1.2 0 1.8-.8 1.8-1.7 0-1.2-1-1.6-1-2.6s.8-1.7 1.8-1.7H17a4 4 0 004-4c0-4.4-4-8-9-8z M7.5 11.5h.01M10 7.5h.01M14.5 7.5h.01",
  "Abu Ali ibn Sino maktabi": "M3 12h4l2-4.5 3 9 2.2-4.5H21",
  "Is'hoqxon to'ra Ibrat maktabi": "M19 3C11 4 7 9 6 16l-2 5 M19 3c-1 7-5 11-11 13 M6 16h5",
  "Muhammad al-Xorazmiy maktabi": "M8 7l-5 5 5 5M16 7l5 5-5 5M14 4l-4 16",
  // Vaqt
  Ertalab: "M3 18h18 M6 18a6 6 0 0112 0 M12 5v3 M4.9 9.9L7 12 M19.1 9.9L17 12 M8 21h8",
  "Tushdan keyin": "M12 16a4 4 0 100-8 4 4 0 000 8z M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4",
  Kechqurun: "M20 14.5A8 8 0 019.5 4 8 8 0 1020 14.5z",
  "Farqi yo'q": "M12 21a9 9 0 100-18 9 9 0 000 18z M12 7v5l3 2",
  // Manba
  Instagram: "M4 8h3l2-3h6l2 3h3v11H4z M12 17a3.5 3.5 0 100-7 3.5 3.5 0 000 7z",
  Telegram: "M21 4L3 11l6 2 2 6 3-4 5 4z M9 13l12-9",
  "Tanish orqali": "M9 11a3.5 3.5 0 100-7 3.5 3.5 0 000 7z M2.5 20c.5-3.5 3.2-5.5 6.5-5.5s6 2 6.5 5.5 M16 4.5a3.5 3.5 0 010 6.5 M18 14.8c2 .7 3.3 2.5 3.5 5.2",
  "Ko'cha banneri": "M3 4h18v10H3z M8 14v7M16 14v7 M7 8h10M7 11h6",
  "Google qidiruv": "M10.5 17a6.5 6.5 0 100-13 6.5 6.5 0 000 13z M15.5 15.5L21 21",
  Facebook: "M15 3h-2.5A3.5 3.5 0 009 6.5V10H6.5v3.5H9V21h3.5v-7.5H15l.5-3.5h-3V7a1 1 0 011-1H15z",
  YouTube: "M3 8.5a3 3 0 013-3h12a3 3 0 013 3v7a3 3 0 01-3 3H6a3 3 0 01-3-3z M10 9.5v5l4.5-2.5z",
  Boshqa: "M5 12h.01M12 12h.01M19 12h.01",
  // Bo'lim sarlavhalari
  _fan: "M9 3h6 M10 3v6l-5.4 9.4A1.7 1.7 0 006 21h12a1.7 1.7 0 001.4-2.6L14 9V3 M7.2 15h9.6",
  _til: "M4 5h16v10H10l-5 4v-4H4z M8 9h8M8 12h5",
  _pm: "M12 3l2.6 5.6 6 .7-4.5 4.1 1.2 6L12 16.8l-5.3 2.6 1.2-6-4.5-4.1 6-.7z",
  _daraja: "M4 20v-5M9 20v-8M14 20V8M19 20V4",
  _sinf: "M4 19V6a2 2 0 012-2h13v13H6a2 2 0 00-2 2zm0 0a2 2 0 002 2h13 M9 8h6",
  _filial: "M12 21s-7-6.2-7-11a7 7 0 0114 0c0 4.8-7 11-7 11z M12 12.5a2.5 2.5 0 100-5 2.5 2.5 0 000 5z",
  _vaqt: "M12 21a9 9 0 100-18 9 9 0 000 18z M12 7v5l3 2",
  _manba: "M3 11v2a1 1 0 001 1h3l6 4V6L7 10H4a1 1 0 00-1 1z M17 8.5a5 5 0 010 7 M19.5 6a8.5 8.5 0 010 12",
  _aloqa: "M5 4h4l2 5-2.5 1.5a11 11 0 005 5L15 13l5 2v4a2 2 0 01-2 2A16 16 0 013 6a2 2 0 012-2",
};

/** Bizdagi manba nomlari (O'quvchilar oqimi) → prototip ikonkasi. */
const ALIAS: Record<string, string> = {
  Tavsiya: "Tanish orqali",
  Banner: "Ko'cha banneri",
  "Veb-sayt": "Geografiya",
  Sayt: "Geografiya",
};

const FLAG: Record<string, ReactNode> = {
  "Ingliz tili": (
    <>
      <rect width="24" height="24" fill="#012169" />
      <path d="M0 0L24 24M24 0L0 24" stroke="#fff" strokeWidth="5" />
      <path d="M0 0L24 24M24 0L0 24" stroke="#c8102e" strokeWidth="1.6" />
      <path d="M12 0v24M0 12h24" stroke="#fff" strokeWidth="7" />
      <path d="M12 0v24M0 12h24" stroke="#c8102e" strokeWidth="4" />
    </>
  ),
  "Rus tili": (
    <>
      <rect width="24" height="8" fill="#fff" />
      <rect y="8" width="24" height="8" fill="#0039a6" />
      <rect y="16" width="24" height="8" fill="#d52b1e" />
    </>
  ),
  "Arab tili": (
    <>
      <rect width="24" height="24" fill="#0a7d43" />
      <text x="12" y="17.2" textAnchor="middle" fontSize="15" fontWeight="700" fill="#fff" fontFamily="Tahoma,Arial,sans-serif">
        ع
      </text>
    </>
  ),
  "Turk tili": (
    <>
      <rect width="24" height="24" fill="#e30a17" />
      <circle cx="10" cy="12" r="5.6" fill="#fff" />
      <circle cx="11.4" cy="12" r="4.5" fill="#e30a17" />
      <path d="M16.2 9.6l.7 1.7 1.8.1-1.4 1.2.5 1.8-1.6-1-1.6 1 .5-1.8-1.4-1.2 1.8-.1z" fill="#fff" />
    </>
  ),
  "Koreys tili": (
    <>
      <rect width="24" height="24" fill="#fff" />
      <path d="M7 12a5 5 0 0110 0z" fill="#cd2e3a" />
      <path d="M7 12a5 5 0 0010 0z" fill="#0047a0" />
      <path
        d="M3.5 5.5l2 -1.6M4.3 6.6l2-1.6M18.5 3.9l2 1.6M17.7 5l2 1.6M3.5 18.5l2 1.6M4.3 17.4l2 1.6M18.5 20.1l2-1.6M17.7 19l2-1.6"
        stroke="#111"
        strokeWidth="1"
      />
    </>
  ),
  "Nemis tili": (
    <>
      <rect width="24" height="8" fill="#111" />
      <rect y="8" width="24" height="8" fill="#dd0000" />
      <rect y="16" width="24" height="8" fill="#ffce00" />
    </>
  ),
};

/** Tipografik apostroflar (‘ ’ ʼ) — bitta shaklga: kalitlar ASCII bilan yozilgan. */
const keyOf = (s: string) => s.replace(/[‘’ʼ`]/g, "'").trim();

export function hasFlag(name: string): boolean {
  return keyOf(name) in FLAG;
}

export function SurveyIcon({ name, fallback = "Boshqa" }: { name: string; fallback?: string }) {
  const clipId = useId();
  const k = keyOf(name);
  const flag = FLAG[k];
  if (flag) {
    return (
      <svg className="flag" viewBox="0 0 24 24" aria-hidden="true">
        <defs>
          <clipPath id={clipId}>
            <circle cx="12" cy="12" r="12" />
          </clipPath>
        </defs>
        <g clipPath={`url(#${clipId})`}>{flag}</g>
        <circle cx="12" cy="12" r="11.5" fill="none" stroke="rgba(0,0,0,.12)" />
      </svg>
    );
  }
  const d = P[k] ?? P[ALIAS[k] ?? ""] ?? P[fallback] ?? P.Boshqa;
  const seg = d.match(/M[^M]*/g) ?? [];
  const line = seg.filter((x) => !/h\.01/.test(x)).join(" ");
  const dot = seg.filter((x) => /h\.01/.test(x)).join(" ");
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round">
      {line && <path d={line} strokeWidth={1.8} />}
      {dot && <path d={dot} strokeWidth={3.2} />}
    </svg>
  );
}
