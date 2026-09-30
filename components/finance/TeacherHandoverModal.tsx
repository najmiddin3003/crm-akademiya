"use client";

import { useEffect, useMemo, useState } from "react";
import { X } from "lucide-react";
import Modal, { useModalClose } from "@/components/ui/Modal";
import DateField from "@/components/ui/DateField";
import Select from "@/components/ui/Select";
import { SpinnerBlock } from "@/components/ui/Spinner";
import { useToast } from "@/components/ui/Toast";
import { useT } from "@/components/shared/Language";
import type { TeacherHandover } from "@/lib/teacherHandover";

// USTOZ ALMASHUVI OYNASI — Moliya → Oylik hisob-kitob, foizli o'qituvchi
// qatoridan ochiladi (30.09.2026). Oy o'rtasida o'quvchilar boshqa ustozga
// o'tgan bo'lsa, eski ustoz nomidagi shu oy to'lovlari kalendar kunlariga
// qarab bo'linadi: oxirgi dars kunigacha — eski ustozga, qolgani — yangi
// ustozga (lib/teacherHandover.ts). Kassa va jurnalga tegilmaydi.

interface PupilRow {
  pupilId: number | null;
  name: string;
  total: number;
  count: number;
  currentTeacher: string | null;
}

interface Loaded {
  teacher: string;
  teacherPercent: number | null;
  daysIn: number;
  handover: TeacherHandover | null;
  pupils: PupilRow[];
  teachers: { name: string; percent: number | null }[];
}

function fmtNum(n: number): string {
  return Math.round(n).toLocaleString("ru-RU");
}

const rowKey = (p: { pupilId: number | null; name: string }) =>
  p.pupilId != null ? `p:${p.pupilId}` : `n:${p.name.trim().toLowerCase()}`;

export default function TeacherHandoverModal({
  teacher,
  month,
  monthLabel,
  onClose,
  onSaved,
}: {
  teacher: string;
  /** "YYYY-MM" */
  month: string;
  /** "Sentyabr 2026" — sarlavha uchun. */
  monthLabel: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { t } = useT();
  const modal = useModalClose(onClose);
  const { showSuccess, showError } = useToast();
  const [data, setData] = useState<Loaded | null>(null);
  const [lastDay, setLastDay] = useState("");
  // O'quvchi kaliti → yangi ustoz ("" — hech kimga).
  const [targets, setTargets] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let alive = true;
    // Manzil QATTIQ yozilgan — ruxsatlar jadvali (scripts/gen-api-permissions.mjs)
    // chaqiruv manzilini matndan topadi.
    fetch(`/api/teacher-handovers?month=${month}&teacher=${encodeURIComponent(teacher)}`)
      .then((r) => r.json())
      .catch(() => null)
      .then((d) => {
        if (!alive) return;
        if (!d?.ok) {
          showError(t(d?.error || "Ma'lumot yuklanmadi"));
          return;
        }
        const loaded = d as Loaded;
        setData(loaded);
        // Saqlangan almashuv bo'lsa — o'sha; bo'lmasa HOZIRGI guruh ustozi taklif.
        const saved = new Map((loaded.handover?.pupils ?? []).map((p) => [rowKey(p), p.toTeacher ?? ""]));
        const init: Record<string, string> = {};
        for (const p of loaded.pupils) init[rowKey(p)] = saved.has(rowKey(p)) ? saved.get(rowKey(p))! : p.currentTeacher ?? "";
        setTargets(init);
        setLastDay(loaded.handover?.lastDay ?? "");
      });
    return () => { alive = false; };
  }, [teacher, month, showError, t]);

  const daysIn = data?.daysIn ?? 0;
  const ld = /^(\d{4}-\d{2})-(\d{2})$/.exec(lastDay);
  const oldDays = ld && ld[1] === month ? Number(ld[2]) : 0;
  const dayValid = oldDays >= 1 && oldDays < daysIn;
  const oldRatio = dayValid ? oldDays / daysIn : 1;
  const newDays = dayValid ? daysIn - oldDays : 0;

  const teacherOptions = useMemo(
    () => (data?.teachers ?? []).map((x) => ({ value: x.name, label: x.percent != null ? `${x.name} (${x.percent}%)` : x.name })),
    [data],
  );
  const percentOf = (name: string) => data?.teachers.find((x) => x.name === name)?.percent ?? null;

  // Oldindan ko'rish: eski ustozda qoladigan va har yangi ustozga o'tadigan tushum.
  const preview = useMemo(() => {
    const total = (data?.pupils ?? []).reduce((s, p) => s + p.total, 0);
    const byTarget = new Map<string, number>();
    for (const p of data?.pupils ?? []) {
      const to = targets[rowKey(p)] ?? "";
      byTarget.set(to, (byTarget.get(to) ?? 0) + p.total * (1 - oldRatio));
    }
    return { total, keep: total * oldRatio, byTarget };
  }, [data, targets, oldRatio]);

  function setAll(to: string) {
    setTargets((prev) => Object.fromEntries(Object.keys(prev).map((k) => [k, to])));
  }

  async function save() {
    if (!data) return;
    if (!dayValid) {
      showError(t("Oxirgi dars kunini shu oy ichidan tanlang (oy oxiri emas)"));
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/teacher-handovers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          month,
          teacher: data.teacher,
          lastDay,
          pupils: data.pupils.map((p) => ({ pupilId: p.pupilId, name: p.name, toTeacher: targets[rowKey(p)] || null })),
        }),
      });
      const d = await res.json();
      if (!d.ok) {
        showError(t(d.error || "Saqlanmadi"));
        return;
      }
      showSuccess(t("Ustoz almashuvi saqlandi — oylik qayta hisoblandi"));
      onSaved();
      modal.close();
    } catch {
      showError(t("Serverga ulanib bo'lmadi"));
    } finally {
      setSaving(false);
    }
  }

  async function remove() {
    if (!data) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/teacher-handovers?month=${month}&teacher=${encodeURIComponent(data.teacher)}`, { method: "DELETE" });
      const d = await res.json();
      if (!d.ok) {
        showError(t(d.error || "O'chirilmadi"));
        return;
      }
      showSuccess(t("Ustoz almashuvi olib tashlandi"));
      onSaved();
      modal.close();
    } catch {
      showError(t("Serverga ulanib bo'lmadi"));
    } finally {
      setSaving(false);
    }
  }

  const pct = data?.teacherPercent ?? null;

  return (
    <Modal onClose={onClose} controller={modal} bare size="3xl" locked={saving} zIndex={110}>
      <div className="flex shrink-0 items-start justify-between gap-3 border-b border-border px-5 py-4">
        <div>
          <h3 className="text-[15px] font-semibold">{t("Ustoz almashuvi")}</h3>
          <p className="mt-0.5 text-[12px] text-muted-foreground">{`${teacher} · ${monthLabel}`}</p>
        </div>
        <button type="button" onClick={modal.close} className="inline-flex h-8 w-8 items-center justify-center rounded-lg hover:bg-secondary" aria-label={t("Yopish")}>
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-5 py-4">
        <p className="text-[12.5px] text-muted-foreground">
          {t("Oy o'rtasida o'quvchilar boshqa ustozga o'tgan bo'lsa, shu oyning to'lovlari kalendar kunlariga qarab bo'linadi: oxirgi dars kunigacha — shu ustozga, qolgani — yangi ustozga (o'z foizi bilan). Kassa va jurnalga tegilmaydi.")}
        </p>

        {!data ? (
          <SpinnerBlock size={22} />
        ) : (
          <>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <div>
                <label className="mb-1 block text-[12px] font-medium">{t("Oxirgi dars kuni")}</label>
                <DateField value={lastDay} onChange={setLastDay} variant="form" placeholder="kk/oo/yyyy" error={!!lastDay && !dayValid} />
                {dayValid ? (
                  <p className="mt-1 text-[11.5px] text-muted-foreground">
                    {t("{teacher}ga {old}/{daysIn} kun, yangi ustozga {neww}/{daysIn} kun", { teacher, old: oldDays, neww: newDays, daysIn })}
                  </p>
                ) : lastDay ? (
                  <p className="mt-1 text-[11.5px] text-rose-600">{t("Oxirgi dars kunini shu oy ichidan tanlang (oy oxiri emas)")}</p>
                ) : null}
              </div>
              <div>
                <label className="mb-1 block text-[12px] font-medium">{t("Hammasini bitta ustozga")}</label>
                <Select value="" onChange={setAll} options={teacherOptions} placeholder={t("Tanlang")} />
              </div>
            </div>

            {data.pupils.length === 0 ? (
              <p className="py-6 text-center text-[13px] text-muted-foreground">
                {t("Bu oyda shu ustoz nomiga to'lov yo'q — bo'linadigan narsa yo'q.")}
              </p>
            ) : (
              <div className="overflow-hidden rounded-xl border border-border">
                <table className="w-full text-[13px]">
                  <thead className="bg-secondary/40 text-[10.5px] font-semibold uppercase tracking-wider text-muted-foreground">
                    <tr>
                      <th className="px-3 py-2 text-left">{t("O'quvchi")}</th>
                      <th className="px-3 py-2 text-right">{t("To'lov")}</th>
                      <th className="px-3 py-2 text-left">{t("Yangi ustoz")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.pupils.map((p) => {
                      const k = rowKey(p);
                      return (
                        <tr key={k} className="border-t border-border/60 align-top">
                          <td className="px-3 py-2">
                            <div className="font-medium">{p.name || "—"}</div>
                            {p.count > 1 && <div className="text-[11px] text-muted-foreground">{t("{n} ta to'lov", { n: p.count })}</div>}
                          </td>
                          <td className="whitespace-nowrap px-3 py-2 text-right tabular-nums">
                            {fmtNum(p.total)}
                            {dayValid && (
                              <div className="text-[11px] text-muted-foreground">
                                {`${fmtNum(p.total * oldRatio)} + ${fmtNum(p.total - p.total * oldRatio)}`}
                              </div>
                            )}
                          </td>
                          <td className="w-[46%] px-3 py-2">
                            <Select
                              value={targets[k] ?? ""}
                              onChange={(v) => setTargets((prev) => ({ ...prev, [k]: v }))}
                              options={teacherOptions}
                              placeholder={t("— hech kimga (markazda qoladi)")}
                              clearable
                              size="sm"
                            />
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            {/* NATIJA — saqlashdan oldin ko'rinsin. */}
            {dayValid && data.pupils.length > 0 && (
              <div className="space-y-1 rounded-xl border border-border bg-secondary/20 p-3 text-[13px]">
                <div className="flex justify-between gap-3">
                  <span>{t("{teacher} — tushum", { teacher })}</span>
                  <span className="tabular-nums">
                    {`${fmtNum(preview.total)} → `}<strong>{fmtNum(preview.keep)}</strong>
                    {pct != null && <span className="text-muted-foreground">{` · ${t("oylikka")} ${fmtNum(preview.keep * pct / 100)} (${pct}%)`}</span>}
                  </span>
                </div>
                {[...preview.byTarget.entries()].filter(([, v]) => Math.abs(v) >= 0.5).map(([to, v]) => {
                  const p2 = to ? percentOf(to) : null;
                  return (
                    <div key={to || "-"} className="flex justify-between gap-3 text-muted-foreground">
                      <span>{to ? `+ ${to}` : t("Hech kimga o'tmaydi (markazda qoladi)")}</span>
                      <span className="tabular-nums">
                        {fmtNum(v)}
                        {p2 != null && ` · ${t("oylikka")} +${fmtNum(v * p2 / 100)} (${p2}%)`}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}
      </div>

      <div className="flex shrink-0 items-center justify-between gap-2 border-t border-border px-5 py-3">
        <div>
          {data?.handover && (
            <button
              type="button"
              onClick={remove}
              disabled={saving}
              className="h-9 rounded-lg border border-rose-500/30 px-3 text-sm font-medium text-rose-600 hover:bg-rose-500/10 disabled:opacity-50"
            >
              {t("Almashuvni olib tashlash")}
            </button>
          )}
        </div>
        <div className="flex gap-2">
          <button type="button" onClick={modal.close} disabled={saving} className="h-9 rounded-lg border border-border bg-card px-4 text-sm font-medium hover:bg-secondary disabled:opacity-60">
            {t("Bekor qilish")}
          </button>
          <button
            type="button"
            onClick={save}
            disabled={saving || !data || data.pupils.length === 0 || !dayValid}
            className="h-9 rounded-lg bg-primary px-5 text-sm font-medium text-white hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {saving ? t("Saqlanmoqda…") : t("Saqlash")}
          </button>
        </div>
      </div>
    </Modal>
  );
}
