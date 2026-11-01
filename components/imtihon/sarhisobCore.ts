"use client";

import { useCallback, useEffect, useState, type Dispatch, type SetStateAction } from "react";
import { useT } from "@/components/shared/Language";
import { useToast } from "@/components/ui/Toast";
import { CENTER_SHARE_DEFAULT, decodeShare, encodeShare, isValidShareMask, type CenterShareField, type CenterShareShow } from "@/lib/centerShare";
import { groupExamMonth, type GroupExam } from "@/lib/imtihon";
import { fmtExamDate } from "./SarhisobDetailDrawer";

// IMTIHON → SARHISOB: UMUMIY YADRO — eski tab (SarhisobView.tsx) va yangi versiya
// (components/v2/imtihon/*) ikkalasi shundan (23.10.2026, SarhisobView.tsx dan AYNAN
// ko'chirildi): joriy filialning guruh imtihonlari (`group_exams`, GET
// /api/imtihon/group), oy nomi va CSV qatorlari (Sarhisob_YYYY-MM.csv — ustunlar
// tartibi o'zgarmasin).

export function useGroupExams() {
  const [exams, setExams] = useState<GroupExam[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/imtihon/group")
      .then((r) => r.json())
      .then((d) => {
        if (cancelled || !d.ok) return;
        setExams(d.exams as GroupExam[]);
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return { exams, setExams, loading };
}

/** Saqlangan yoki tahrirlangan sarhisob ro'yxatga: bori almashadi, yangisi boshiga qo'shiladi. */
export function upsertExam(list: GroupExam[], exam: GroupExam): GroupExam[] {
  return list.some((r) => r.id === exam.id) ? list.map((r) => (r.id === exam.id ? exam : r)) : [exam, ...list];
}

/**
 * ARXIVLASH va O'CHIRISH (01.11.2026) — eski va yangi versiya uchun bitta (PATCH/DELETE
 * /api/imtihon/group/:id). Arxiv — faqat ko'rinish, so'ramaydi (yangi versiyada xabarda
 * «Arxivdan chiqarish»); o'chirishni chaqiruvchi avval tasdiqlatadi. `busyId` — so'rov
 * ketayotgan sarhisob (tugmalar o'chiq turadi).
 */
export function useExamActions(setExams: Dispatch<SetStateAction<GroupExam[]>>) {
  const { t } = useT();
  const { showError, showToast } = useToast();
  const [busyId, setBusyId] = useState<number | null>(null);

  async function send(exam: GroupExam, init: RequestInit): Promise<{ ok: boolean; exam?: GroupExam }> {
    setBusyId(exam.id);
    try {
      const res = await fetch(`/api/imtihon/group/${exam.id}`, init);
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.ok) {
        showError(t(data.error || "Saqlanmadi"));
        return { ok: false };
      }
      return { ok: true, exam: data.exam as GroupExam | undefined };
    } catch {
      showError(t("Serverga ulanib bo'lmadi"));
      return { ok: false };
    } finally {
      setBusyId(null);
    }
  }

  async function setArchived(exam: GroupExam, archived: boolean): Promise<boolean> {
    const r = await send(exam, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ archived }) });
    if (!r.ok || !r.exam) return false;
    setExams((prev) => upsertExam(prev, r.exam!));
    showToast({
      tone: "success",
      title: archived ? t("Sarhisob arxivlandi") : t("Sarhisob arxivdan chiqarildi"),
      detail: archived ? [exam.groupLabel, t("Tangalar va botdagi natija o'zgarmaydi.")] : exam.groupLabel,
      action: archived ? { label: t("Arxivdan chiqarish"), onClick: () => void setArchived(exam, false) } : undefined,
    });
    return true;
  }

  async function remove(exam: GroupExam): Promise<boolean> {
    const r = await send(exam, { method: "DELETE" });
    if (!r.ok) return false;
    setExams((prev) => prev.filter((x) => x.id !== exam.id));
    showToast({ tone: "success", title: t("Sarhisob o'chirildi"), detail: t("{groupLabel} · {n} o'quvchi", { groupLabel: exam.groupLabel, n: exam.studentCount }) });
    return true;
  }

  return { busyId, setArchived, remove };
}

/**
 * GURUH NATIJALARI HAVOLASI (01.11.2026, «har bir guruh uchun alohida url link»):
 * /natijalar/<kalit>?oy=<sarhisob oyi>. Kalit serverda imzolanadi (API javobidagi
 * `linkKey`, lib/groupResultsLink.ts) — o'quvchi raqamni o'zgartirib boshqa guruhni
 * ocholmaydi. Sahifada faqat shu guruh: shu oy ochiladi, guruhning boshqa oylari
 * tanlovda. Domen — ochiq turgan sayt (Akademiya / boshqa markaz o'z manzili bilan).
 */
export function groupResultsUrl(linkKey: string, month: string): string {
  const q = /^\d{4}-\d{2}$/.test(month) ? `?oy=${month}` : "";
  return `${window.location.origin}/natijalar/${encodeURIComponent(linkKey)}${q}`;
}

/**
 * MARKAZ REYTINGI HAVOLASI (01.11.2026, «markaz bo'yicha reytingni ulashish»):
 * /natijalar/markaz/<kalit>?oy=<oy>[&fan=<fan>]. Kalit — joriy filial va «Ulashish» oynasida
 * belgilangan qismlar (GET /api/imtihon/group/center-link); sahifada shu filialning oylik reytingi.
 */
export function centerResultsUrl(centerKey: string, month: string, course: string): string {
  const q = new URLSearchParams();
  if (/^\d{4}-\d{2}$/.test(month)) q.set("oy", month);
  if (course) q.set("fan", course);
  const s = q.toString();
  return `${window.location.origin}/natijalar/markaz/${encodeURIComponent(centerKey)}${s ? `?${s}` : ""}`;
}

/** Matnni nusxalaydi: Clipboard API, bo'lmasa (eski brauzer, ruxsat yo'q) — vaqtinchalik maydon orqali. */
export async function copyText(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // pastdagi zaxira yo'l
  }
  try {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.setAttribute("readonly", "");
    ta.style.position = "fixed";
    ta.style.top = "0";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand("copy");
    ta.remove();
    return ok;
  } catch {
    return false;
  }
}

/**
 * «Havolani nusxalash» (sarhisob qatori ⋯ menyusi / eski versiyada sarhisob oynasi): shu
 * guruhning havolasini nusxalaydi va xabarda ko'rsatadi (nusxalanmasa ham — qo'lda olish uchun).
 * Kalit oldindan (ro'yxat bilan) keladi — bosish va nusxalash orasida so'rov yo'q, aks holda
 * Safari nusxalashni rad etadi.
 */
export function useCopyGroupLink() {
  const { t } = useT();
  const { showSuccess, showError } = useToast();
  return useCallback(
    async (exam: Pick<GroupExam, "linkKey" | "date" | "month">) => {
      if (!exam.linkKey) {
        showError(t("Havolani olib bo'lmadi — sahifani yangilang"));
        return;
      }
      const link = groupResultsUrl(exam.linkKey, groupExamMonth(exam));
      if (await copyText(link)) showSuccess(t("Havola nusxalandi: {link}", { link }));
      else showError(t("Havolani nusxalab bo'lmadi — qo'lda ko'chiring: {link}", { link }));
    },
    [t, showSuccess, showError],
  );
}

/** «Ulashish» oynasining oxirgi tanlovi — shu brauzerda (keyingi safar shu qismlar belgilangan ochiladi). */
const SHARE_PREFS_KEY = "imtihon.markazReytingi.ulashish";

function loadShareShow(): CenterShareShow {
  try {
    const raw = localStorage.getItem(SHARE_PREFS_KEY);
    const mask = raw && /^\d{1,3}$/.test(raw) ? Number(raw) : NaN;
    if (isValidShareMask(mask)) return decodeShare(mask);
  } catch {
    // yopiq saqlash (shaxsiy oyna) — sukut bo'yicha
  }
  return CENTER_SHARE_DEFAULT;
}

/**
 * «Ulashish» oynasi (Sarhisob → «Markaz reytingi», 01.11.2026: «galochka qo'yilgan qismlar
 * chiqishi kerak holos»): qaysi qismlar ko'rinadi, shu tanlov uchun imzolangan kalit va havola.
 * Kalit har tanlov uchun serverdan (GET /api/imtihon/group/center-link) — katakcha bosilganda
 * so'raladi, nusxalash tugmasi bosilganda emas (Safari bosishdan keyingi so'rovda nusxalashni
 * rad etadi). Bir marta olingan kalit shu oynada eslab qolinadi. Oy va fan — havola manzilida.
 */
export function useCenterShare(month: string, course: string) {
  const { t } = useT();
  const { showSuccess, showError } = useToast();
  const [show, setShow] = useState<CenterShareShow>(loadShareShow);
  /** Belgilar to'plami → kalit; `null` — olib bo'lmadi. */
  const [keys, setKeys] = useState<Record<number, string | null>>({});
  const mask = encodeShare(show);
  const valid = isValidShareMask(mask);
  const key = keys[mask];

  useEffect(() => {
    if (!valid || key !== undefined) return;
    const ctl = new AbortController();
    fetch(`/api/imtihon/group/center-link?f=${mask}`, { signal: ctl.signal })
      .then((r) => r.json())
      .then((d) => setKeys((k) => ({ ...k, [mask]: d.ok && typeof d.key === "string" ? d.key : null })))
      .catch((e: unknown) => {
        if ((e as { name?: string })?.name !== "AbortError") setKeys((k) => ({ ...k, [mask]: null }));
      });
    return () => ctl.abort();
  }, [mask, valid, key]);

  function toggle(field: CenterShareField, on: boolean) {
    const next = { ...show, [field]: on };
    setShow(next);
    try {
      localStorage.setItem(SHARE_PREFS_KEY, String(encodeShare(next)));
    } catch {
      // saqlanmasa ham oyna ishlayveradi
    }
  }

  const link = valid && key ? centerResultsUrl(key, month, course) : "";

  /** Nusxalaydi va xabarda ko'rsatadi (nusxalanmasa ham — qo'lda olish uchun). Nusxalansa — `true`. */
  const copy = useCallback(async (): Promise<boolean> => {
    if (!link) return false;
    if (await copyText(link)) {
      showSuccess(t("Havola nusxalandi: {link}", { link }));
      return true;
    }
    showError(t("Havolani nusxalab bo'lmadi — qo'lda ko'chiring: {link}", { link }));
    return false;
  }, [link, t, showSuccess, showError]);

  return { show, toggle, valid, link, loading: valid && key === undefined, failed: valid && key === null, copy };
}

/** Guruh nomi: «7» → «7-guruh» — qoidasi lib/examRanking.ts da (ochiq reyting sahifasi ham shundan). */
export { examGroupTitle } from "@/lib/examRanking";

/** "2026-10" → "Oktabr 2026" (tanlangan tilda). */
export function useMonthLabel() {
  const { months } = useT();
  return useCallback(
    (m: string) => {
      const x = /^(\d{4})-(\d{2})$/.exec(m);
      return x ? `${months[Number(x[2]) - 1]} ${x[1]}` : m;
    },
    [months],
  );
}

/** Referensdagi CSV: har bir o'quvchi alohida qator. */
export function sarhisobCsvRows(list: GroupExam[], monthLabel: (m: string) => string): unknown[][] {
  const head = ["Sana", "Oy", "Fan", "Ustoz", "Guruh", "O'quvchi", "Savollar", "To'g'ri javob", "O'zlashtirish %"];
  const out: unknown[][] = [head];
  for (const r of list) {
    for (const s of r.students) {
      out.push([fmtExamDate(r.date), monthLabel(groupExamMonth(r)), r.course, r.teacher, r.groupLabel, s.name, r.total, s.correct, s.pct]);
    }
  }
  return out;
}
