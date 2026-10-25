"use client";

import { useSyncExternalStore } from "react";
import { CV_ANY_BRANCH, CV_EXP_LEVELS, CV_TEACHING_ROLES } from "@/constants/managementCv";
import type { Tone } from "@/components/v2/students/profile/profileBits";
import { cvCertLabel, cvExpLabel, formatUzPhone, type CvApplication, type CvStatus } from "@/lib/managementCv";

// YANGI VERSIYA — ISHGA QABUL (CV) BO'LAKLARI (13-qism, 25.10.2026): holat ranglari (rasm «Nomzodlar
// ro'yxati»: Yangi — ko'k, Ko'rildi — kulrang, Suhbat — binafsha, Ishga olindi — yashil, Rad etildi —
// qizil), bosqichlar, sana va yorliq yordamchilari, Google Sheets manzili (eski sahifa sozlaydi).

export const CV_TONE: Record<CvStatus, Tone> = {
  new: { label: "Yangi", badge: "bg-v2-info-bg text-v2-info", dot: "bg-v2-info" },
  reviewed: { label: "Ko'rildi", badge: "bg-v2-surface-2 text-v2-text-2", dot: "bg-v2-text-3" },
  interview: { label: "Suhbat", badge: "bg-v2-violet-bg text-v2-violet", dot: "bg-v2-violet" },
  accepted: { label: "Ishga olindi", badge: "bg-v2-success-bg text-v2-success", dot: "bg-v2-success" },
  rejected: { label: "Rad etildi", badge: "bg-v2-danger-bg text-v2-danger", dot: "bg-v2-danger" },
};

/** Bosqich chizig'i (rad etish — alohida yo'l, chiziqda yo'q). */
export const CV_STEPS: readonly CvStatus[] = ["new", "reviewed", "interview", "accepted"];

/** «11.10.2026 | 21:14» → { iso: "2026-10-11", hm: "21:14" }. */
export function submittedParts(s: string): { iso: string; hm: string } {
  const m = /^(\d{2})\.(\d{2})\.(\d{4})(?:\s*\|\s*(\d{2}:\d{2}))?/.exec((s || "").trim());
  return m ? { iso: `${m[3]}-${m[2]}-${m[1]}`, hm: m[4] ?? "" } : { iso: "", hm: "" };
}

/** «2026-10-14T15:00» → { iso, hm }. */
export function interviewParts(at?: string): { iso: string; hm: string } | null {
  const m = /^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2})$/.exec(at || "");
  return m ? { iso: m[1], hm: m[2] } : null;
}

export function isTeaching(cv: Pick<CvApplication, "position">): boolean {
  return CV_TEACHING_ROLES.includes(cv.position) || /o['ʻ’]qituvchi/i.test(cv.position || "");
}

/** «Yo'nalish» ustuni: o'qituvchida fan(lar), boshqalarda lavozim. */
export function cvTrackLabel(cv: CvApplication): string {
  if (isTeaching(cv)) return (cv.subjects?.length ? cv.subjects.join(", ") : cv.subject || "").trim() || cv.position || "";
  return cv.position || "";
}

/** «Sertifikat»: turi tarjima bilan («Milliy sertifikat A+» → "National certificate A+"), eski — erkin matn. */
export function cvCertText(cv: Pick<CvApplication, "certType" | "certLevel" | "achievements">, t: (s: string) => string): string {
  if (cv.certType) return cv.certType === "Yo'q" ? "" : `${t(cv.certType)} ${cv.certLevel ?? ""}`.trim();
  return cvCertLabel(cv);
}

/** Vergul bilan ajratilgan anketa qiymatlari (fanlar, yosh guruhlari) — har biri tarjima bilan. */
export function cvListText(raw: string | undefined, t: (s: string) => string): string {
  return (raw || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .map((s) => t(s))
    .join(", ");
}

/** «Yo'nalish» ko'rinishi: fan / lavozim nomlari anketa ro'yxatlaridan — tarjima qilinadi. */
export function cvTrackText(cv: CvApplication, t: (s: string) => string): string {
  return cvListText(cvTrackLabel(cv), t);
}

/** Filial: nomzod tanlagani; «qaysi filial bo'lsa ham» — «Istalgan filial». */
export function cvBranchLabel(cv: Pick<CvApplication, "branchId" | "branchName">, t: (s: string) => string): string {
  if (cv.branchId === null || cv.branchName === CV_ANY_BRANCH) return t("Istalgan filial");
  return cv.branchName || "—";
}

/** «94 111 88 55» — jadval, panel va oynalardagi telefon ko'rinishi. */
export function cvPhoneShow(phone: string): string {
  const d = (phone || "").replace(/\D/g, "");
  if (!d) return "";
  return formatUzPhone(d).replace("+998 ", "").replace(/[()]/g, "").replace(/-/g, " ");
}

/** «+998941118855» — tel: havola va nusxa uchun (bazada 9 yoki 12 raqam bo'lishi mumkin). */
export function cvTel(phone: string): string {
  const d = (phone || "").replace(/\D/g, "");
  if (d.length < 9) return "";
  return `+998${d.slice(-9)}`;
}

/**
 * Sarlavhadagi ibora: «4 yil tajriba» → «3–5 yil tajriba»; tajribasiz — «Tajribasiz» («Tajribasiz
 * tajriba» emas); eski erkin matn — o'zi (unga «tajriba» qo'shilmaydi).
 */
export function cvExpPhrase(cv: Pick<CvApplication, "experience">, t: (s: string, v?: Record<string, string | number>) => string): string {
  const raw = (cv.experience || "").trim();
  if (!raw) return "";
  if (raw === "Tajribam yo'q") return t("Tajribasiz");
  if (CV_EXP_LEVELS.includes(raw)) return t("{exp} tajriba", { exp: t(cvExpLabel(raw)) });
  return raw;
}

export function cvExpText(cv: Pick<CvApplication, "experience">, t: (s: string) => string): string {
  const e = cvExpLabel(cv.experience || "");
  if (!e) return "—";
  // Eski erkin matnli anketalar jadvalni buzmasin (eski sahifadagi `shortExperience`).
  return e.length > 14 ? `${e.slice(0, 12).trim()}…` : t(e);
}

/** Filial nomi va manzili (GET /api/management-cv → `places`) — suhbat joyi sukuti. */
export interface CvPlace {
  id: number;
  name: string;
  address: string;
}

export function placeText(p: CvPlace | undefined): string {
  if (!p) return "";
  return [p.name, p.address].map((s) => s.trim()).filter(Boolean).join(", ");
}

/** "YYYY-MM-DD" → mahalliy Date (taqvim maydoni uchun). */
export function dateOfIso(iso: string): Date {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
}

/** Mahalliy Date → "YYYY-MM-DD". */
export function isoOfDate(d: Date): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

export function addDaysIso(iso: string, n: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, (m || 1) - 1, (d || 1) + n)).toISOString().slice(0, 10);
}

/** Rollar ro'yxatidagi rol (GET /api/roles). */
export interface CvRole {
  id: number;
  key?: string;
  name: string;
}

const lc = (s: string) => (s || "").toLowerCase().replace(/[‘’ʻʼ`']/g, "'");

/**
 * Anketadagi vakansiya → Rollar'dagi rol (sukut; foydalanuvchi o'zgartiradi). O'qituvchilik
 * vakansiyalari — «O'qituvchi» (teacher); qolganlari nomdagi kalit so'z bo'yicha; topilmasa —
 * bo'sh (tanlash shart).
 */
export function roleForPosition(cv: Pick<CvApplication, "position">, roles: CvRole[]): number | null {
  if (isTeaching(cv)) return roles.find((r) => r.key === "teacher")?.id ?? null;
  const p = lc(cv.position);
  const rules: [RegExp, RegExp][] = [
    [/^it\b/, /^it\b/],
    [/administrator/, /administrator/],
    [/rahbar/, /filial (menejeri|rahbari)/],
    [/farrosh|qorovul|haydovchi/, /xizmat/],
  ];
  for (const [from, to] of rules) {
    if (!from.test(p)) continue;
    const hit = roles.find((r) => to.test(lc(r.name)));
    if (hit) return hit.id;
  }
  return roles.find((r) => lc(r.name) === p)?.id ?? null;
}

/* ── Google Sheets (eski sahifa sozlaydi, brauzerda) ───────────────────── */

const SHEETS_KEY = "tizimli_cv_sheets_url";
const noop = () => () => {};

function readSheets(): string {
  try {
    return localStorage.getItem(SHEETS_KEY) || "";
  } catch {
    return "";
  }
}

/** Sheets ulangan bo'lsa — havola uni olib yuradi, holat o'zgarishi jadvalga ham yoziladi. */
export function useCvSheetsUrl(): string {
  return useSyncExternalStore(noop, readSheets, () => "");
}

export function pushSheetsStatus(sheetsUrl: string, sid: string | undefined, status: CvStatus) {
  if (!sheetsUrl || !sid) return;
  fetch(sheetsUrl, { method: "POST", body: JSON.stringify({ action: "status", sid, status }) }).catch(() => {});
}

/** Ochiq anketa havolasi (Sheets ulangan bo'lsa — manzili bilan, eski sahifadagidek). */
export function applyLink(sheetsUrl: string): string {
  const base = `${window.location.origin}/ariza`;
  return sheetsUrl ? `${base}#s=${encodeURIComponent(btoa(sheetsUrl))}` : base;
}
