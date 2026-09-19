"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { SpinnerBlock } from "@/components/ui/Spinner";
import { useToast } from "@/components/ui/Toast";
import MonthPicker from "@/components/ui/MonthPicker";
import type { Group } from "@/lib/groups";
import type { Pupil } from "@/lib/pupilsData";
import Select from "@/components/ui/Select";
import { useT } from "@/components/shared/Language";

// O'quv bo'limi → Mavsumiy baholash → "Baholash" ("+ Baholash" tugmasi shu
// sahifaga o'tadi). Bosqichma-bosqich ochiladi (manba: skrinshot 2-3):
//  1) faqat "Sana" (Oy) ko'rinadi;
//  2) oy tanlangach — "Kurs*"/"Guruh*"/"Saqlash" paydo bo'ladi;
//  3) kurs tanlangach — guruh ro'yxati shu kursga tegishlilar bilan cheklanadi;
//  4) guruh tanlangach — o'sha guruhning HAQIQIY o'quvchilari
//     (/api/groups/:id/students) yuklanadi, har biriga Ball/Izoh kiritish
//     maydoni chiqadi. "Saqlash" — barchasini bir yo'la /api/seasonal-assessments
//     ga POST qiladi.
const labelCls = "block text-[12px] font-medium text-muted-foreground mb-1";

interface Draft {
  ball: string;
  izoh: string;
}

export default function AddSeasonalAssessmentPage() {
  const { t } = useT();
  const router = useRouter();
  const { showSuccess, showError } = useToast();

  const [month, setMonth] = useState<number | null>(null);
  const [course, setCourse] = useState("");
  const [groupId, setGroupId] = useState<number | null>(null);

  const [groups, setGroups] = useState<Group[]>([]);
  // null — hali so'ralmagan yoki so'rov jarayonida; array — natija keldi (bo'sh bo'lishi ham mumkin).
  const [students, setStudents] = useState<Pupil[] | null>(null);
  const [drafts, setDrafts] = useState<Record<number, Draft>>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/groups")
      .then((r) => r.json())
      .then((d) => { if (!cancelled && d.ok) setGroups(d.groups); });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!groupId) return;
    let cancelled = false;
    fetch(`/api/groups/${groupId}/students`)
      .then((r) => r.json())
      .then((d) => {
        if (cancelled || !d.ok) return;
        setStudents(d.students);
        setDrafts(Object.fromEntries((d.students as Pupil[]).map((s) => [s.id, { ball: "", izoh: "" }])));
      });
    return () => { cancelled = true; };
  }, [groupId]);

  const courseOptions = useMemo(() => Array.from(new Set(groups.map((g) => g.course).filter(Boolean))).sort(), [groups]);
  const groupOptions = useMemo(() => groups.filter((g) => g.course === course), [groups, course]);
  const selectedGroup = useMemo(() => groups.find((g) => g.id === groupId) || null, [groups, groupId]);

  function pupilName(p: Pupil): string {
    return `${p.firstName} ${p.lastName || ""}`.trim();
  }

  function setDraft(studentId: number, patch: Partial<Draft>) {
    setDrafts((prev) => ({ ...prev, [studentId]: { ...prev[studentId], ...patch } }));
  }

  const canSave = !!month && !!course && !!groupId && !!students?.some((s) => drafts[s.id]?.ball.trim());

  async function save() {
    if (!month || !groupId || !selectedGroup || !students) return;
    const entries = students
      .filter((s) => drafts[s.id]?.ball.trim())
      .map((s) => ({ studentId: s.id, studentName: pupilName(s), ball: Number(drafts[s.id].ball) || 0, izoh: drafts[s.id].izoh }));
    if (entries.length === 0) {
      showError(t("Kamida bitta o'quvchiga ball qo'ying"));
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/seasonal-assessments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          month,
          course,
          groupId,
          groupName: selectedGroup.name,
          teacher: selectedGroup.teacher,
          entries,
        }),
      });
      const data = await res.json();
      if (!data.ok) {
        showError(t(data.error || "Saqlanmadi"));
        setSaving(false);
        return;
      }
      showSuccess(t("Baholandi — {entries} ta o'quvchi", { entries: entries.length }));
      router.push("/seasonal-assessment");
    } catch {
      showError(t("Serverga ulanib bo'lmadi"));
      setSaving(false);
    }
  }

  return (
    <div className="container mx-auto max-w-[1600px] p-4 md:p-5 space-y-5">
      <div className="flex items-end gap-3 flex-wrap">
        <div>
          <label className={labelCls}>{t("Sana")}</label>
          <MonthPicker
            value={month}
            onChange={(m) => { setMonth(m); }}
            onClear={() => { setMonth(null); setCourse(""); setGroupId(null); setStudents(null); setDrafts({}); }}
            className="w-32"
          />
        </div>

        {month && (
          <>
            <div>
              <label className={labelCls}>{t("Kurs")}<span className="text-rose-500">*</span></label>
              <Select value={course} onChange={(v) => { setCourse(v); setGroupId(null); setStudents(null); setDrafts({}); }} options={courseOptions.map((c) => ({ value: c, label: c }))} placeholder={t("Kursni tanlang")} clearable size="sm" className="w-48" />
            </div>

            <div>
              <label className={labelCls}>{t("Guruh")}<span className="text-rose-500">*</span></label>
              <Select value={String(groupId ?? "")} onChange={(v) => {
                    setGroupId(v ? Number(v) : null);
                    setStudents(null);
                    setDrafts({});
                  }} options={groupOptions.map((g) => ({ value: String(g.id), label: `${g.name}—${g.teacher}` }))} placeholder={t("Guruhni tanlang")} clearable size="sm" className="w-56" disabled={!course} />
            </div>

            <button
              onClick={save}
              disabled={!canSave || saving}
              className="inline-flex items-center h-9 px-6 rounded-lg bg-primary text-white text-sm font-medium hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {saving ? t("Saqlanmoqda…") : t("Saqlash")}
            </button>
          </>
        )}
      </div>

      <div>
        <h2 className="text-[15px] font-semibold mb-3">{t("O'quvchilar ro'yxati")}</h2>
        <div className="rounded-xl border border-border bg-card overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-secondary/40">
                <tr className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground border-b border-border">
                  <th className="text-left px-3 py-3 whitespace-nowrap w-14">№</th>
                  <th className="text-left px-3 py-3 whitespace-nowrap">{t("O'quvchi")}</th>
                  <th className="text-left px-3 py-3 whitespace-nowrap w-40">{t("Bal")}</th>
                  <th className="text-left px-3 py-3 whitespace-nowrap">{t("Izoh")}</th>
                </tr>
              </thead>
              <tbody>
                {(students ?? []).map((s, i) => (
                  <tr key={s.id} className="border-b border-border/50">
                    <td className="px-3 py-3 text-muted-foreground tabular-nums text-[13px]">{i + 1}</td>
                    <td className="px-3 py-3 text-[13px] font-medium">{pupilName(s)}</td>
                    <td className="px-3 py-2">
                      <input
                        value={drafts[s.id]?.ball ?? ""}
                        onChange={(e) => setDraft(s.id, { ball: e.target.value })}
                        type="number"
                        min="0"
                        placeholder={t("Ball")}
                        className="w-full h-9 rounded-lg border border-border bg-card px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
                      />
                    </td>
                    <td className="px-3 py-2">
                      <input
                        value={drafts[s.id]?.izoh ?? ""}
                        onChange={(e) => setDraft(s.id, { izoh: e.target.value })}
                        type="text"
                        placeholder={t("Izoh")}
                        className="w-full h-9 rounded-lg border border-border bg-card px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
                      />
                    </td>
                  </tr>
                ))}
                {(students === null || students.length === 0) && (
                  <tr>
                    <td colSpan={4} className="px-3 py-10 text-center text-sm text-muted-foreground">
                      {!groupId ? "Avval oy, kurs va guruhni tanlang" : students === null ? <SpinnerBlock size={22} /> : "Bu guruhda o'quvchi yo'q"}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
