"use client";

import { useCallback, useEffect, useState, type Dispatch, type SetStateAction } from "react";
import { useT, type TFn } from "@/components/shared/Language";
import { useToast } from "@/components/ui/Toast";
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

/** Guruh nomi: «7» → «7-guruh», qolgani o'z nomi bilan (bo'sh bo'lsa — to'liq yorliq). */
export function examGroupTitle(r: Pick<GroupExam, "groupName" | "groupLabel">, t: TFn): string {
  return /^\d+$/.test(r.groupName) ? t("{n}-guruh", { n: r.groupName }) : r.groupName || r.groupLabel;
}

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
