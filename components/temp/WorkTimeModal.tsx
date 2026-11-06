"use client";

import { useMemo, useState } from "react";
import { X } from "lucide-react";
import Modal, { useModalClose } from "@/components/ui/Modal";
import SearchInput from "@/components/ui/SearchInput";
import Select from "@/components/ui/Select";
import TimeField from "@/components/ui/TimeField";
import { useToast } from "@/components/ui/Toast";
import { useT } from "@/components/shared/Language";
import EmployeeToggle from "@/components/employees/EmployeeToggle";
import { ROLE_LABELS } from "@/constants/employees";
import { collapseBranchPools, sameBranchPool } from "@/lib/branchPools";
import { parseWorkTime } from "@/lib/workTime";
import type { TempStaffRow } from "@/app/api/temp-staff/route";

// «Vaqtinchalik tugma» → «ISH VAQTINI BELGILASH» (06.11.2026, lib/workTime.ts).
//
// Hamma faol xodim bitta oynada, chunki ish vaqti hech kimda kiritilmagan va uni
// xodim kartalaridan bittalab to'ldirish sekin. Ko'pchilikning vaqti bir xil
// bo'ladi: yuqori qatordagi vaqt filtrdan o'tgan (ko'rinib turgan) xodimlarga
// bir bosishda qo'yiladi, farqlilari qatorida tuzatiladi. Saqlash — oxirida,
// bitta so'rov (PUT /api/temp-staff/work-time); o'zgarmagan qator yuborilmaydi.
//
// «Faqat kiritilmaganlar» SAQLANGAN qiymatga qaraydi: yozilayotgan qator
// ro'yxatdan yo'qolib ketmasin.

type Branch = { id: number; name: string };
type Times = { start: string; end: string };

export default function WorkTimeModal({
  rows,
  branches,
  onClose,
  onSaved,
}: {
  rows: TempStaffRow[];
  branches: Branch[];
  onClose: () => void;
  onSaved: () => Promise<void> | void;
}) {
  const { t } = useT();
  const { showSuccess, showError } = useToast();
  const modal = useModalClose(onClose);
  /** Faqat tegilgan qatorlar: boshqalari saqlangan qiymatini ko'rsatadi. */
  const [drafts, setDrafts] = useState<ReadonlyMap<number, Times>>(new Map());
  const [query, setQuery] = useState("");
  const [branchFilter, setBranchFilter] = useState("");
  const [onlyEmpty, setOnlyEmpty] = useState(false);
  const [quick, setQuick] = useState<Times>({ start: "", end: "" });
  const [tried, setTried] = useState(false);
  const [saving, setSaving] = useState(false);

  const staff = useMemo(() => rows.filter((r) => !r.archReason).sort((a, b) => a.name.localeCompare(b.name)), [rows]);
  const emptyCount = staff.filter((r) => !r.workStart).length;

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    const branchId = branchFilter ? Number(branchFilter) : null;
    return staff.filter((r) => {
      if (onlyEmpty && r.workStart) return false;
      if (branchId !== null && !r.branchIds.some((id) => sameBranchPool(id, branchId))) return false;
      if (!q) return true;
      const role = ROLE_LABELS[r.turi as keyof typeof ROLE_LABELS] ?? r.turi;
      return `${r.name} ${role}`.toLowerCase().includes(q);
    });
  }, [staff, query, branchFilter, onlyEmpty]);

  const timesOf = (r: TempStaffRow): Times => drafts.get(r.id) ?? { start: r.workStart ?? "", end: r.workEnd ?? "" };
  const put = (id: number, next: Times) => setDrafts((prev) => new Map(prev).set(id, next));

  const changed = staff.filter((r) => {
    const d = drafts.get(r.id);
    return d !== undefined && (d.start !== (r.workStart ?? "") || d.end !== (r.workEnd ?? ""));
  });
  const wrong = changed.filter((r) => !parseWorkTime(timesOf(r).start, timesOf(r).end).ok);

  const quickParsed = parseWorkTime(quick.start, quick.end);
  const quickReady = quickParsed.ok && quickParsed.workStart !== null;

  function applyQuick() {
    if (!quickReady) return;
    setDrafts((prev) => {
      const next = new Map(prev);
      for (const r of visible) next.set(r.id, { ...quick });
      return next;
    });
  }

  async function save() {
    setTried(true);
    if (wrong.length > 0) return;
    setSaving(true);
    try {
      const res = await fetch("/api/temp-staff/work-time", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items: changed.map((r) => ({ id: r.id, workStart: timesOf(r).start, workEnd: timesOf(r).end })) }),
      });
      const data = await res.json();
      if (!data.ok) {
        showError(t(data.error || "Saqlanmadi"));
        return;
      }
      showSuccess(t("Ish vaqti saqlandi — {n} ta xodim", { n: data.updated }));
      await onSaved();
      modal.close();
    } catch {
      showError(t("Serverga ulanib bo'lmadi"));
    } finally {
      setSaving(false);
    }
  }

  return (
    // Saqlanmagan o'zgarish bor paytda Esc va fon yopmaydi: ko'p qator yozilgan bo'lishi mumkin.
    <Modal onClose={onClose} controller={modal} locked={saving || changed.length > 0} bare zIndex={120} size="3xl">
      <div className="flex shrink-0 items-start justify-between gap-3 border-b border-border px-5 py-4">
        <div>
          <h3 className="text-[16px] font-semibold">{t("Ish vaqtini belgilash")}</h3>
          <p className="mt-0.5 text-[12px] text-muted-foreground">
            {t("Faol xodimlar: {all} ta, kiritilmagan: {empty} ta", { all: staff.length, empty: emptyCount })}
          </p>
        </div>
        <button
          type="button"
          onClick={modal.close}
          disabled={saving}
          className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg hover:bg-secondary"
          aria-label={t("Yopish")}
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="shrink-0 space-y-3 border-b border-border px-5 py-3">
        <div className="flex flex-wrap items-center gap-3">
          <SearchInput value={query} onChange={setQuery} placeholder={t("Ism yoki vazifa")} className="w-56 max-w-full" />
          <div className="w-44 shrink-0">
            <Select
              value={branchFilter}
              onChange={(v) => setBranchFilter(v)}
              options={collapseBranchPools(branches).map((b) => ({ value: String(b.id), label: b.name }))}
              placeholder={t("Barcha filiallar")}
              clearable
              size="sm"
            />
          </div>
          <EmployeeToggle checked={onlyEmpty} onChange={setOnlyEmpty} label={t("Faqat kiritilmaganlar")} />
        </div>
        <div className="flex flex-wrap items-center gap-2 rounded-lg bg-secondary/40 p-2.5">
          <div className="w-32 shrink-0">
            <TimeField value={quick.start} onChange={(v) => setQuick((q) => ({ ...q, start: v }))} placeholder="09:00" />
          </div>
          <span className="text-muted-foreground">–</span>
          <div className="w-32 shrink-0">
            <TimeField value={quick.end} onChange={(v) => setQuick((q) => ({ ...q, end: v }))} placeholder="18:00" />
          </div>
          <button
            type="button"
            onClick={applyQuick}
            disabled={!quickReady || visible.length === 0}
            className="h-9 rounded-lg bg-primary px-4 text-sm font-medium text-white hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {t("Ko'rinib turgan {n} xodimga qo'yish", { n: visible.length })}
          </button>
          {!quickParsed.ok && quick.start !== "" && quick.end !== "" && (
            <span className="text-[12px] text-rose-600">{t(quickParsed.error)}</span>
          )}
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        {visible.length === 0 ? (
          <p className="px-5 py-10 text-center text-sm text-muted-foreground">{t("Ma'lumotlar topilmadi")}</p>
        ) : (
          <ul className="divide-y divide-border">
            {visible.map((r) => {
              const v = timesOf(r);
              const bad = tried && wrong.includes(r);
              return (
                <li key={r.id} className="flex flex-col gap-2 px-5 py-2.5 sm:flex-row sm:items-center sm:gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[13.5px] font-medium">{r.name || `#${r.id}`}</div>
                    <div className="truncate text-[12px] text-muted-foreground">{ROLE_LABELS[r.turi as keyof typeof ROLE_LABELS] ?? r.turi ?? "-"}</div>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <div className="w-32 shrink-0">
                      <TimeField value={v.start} onChange={(start) => put(r.id, { ...v, start })} error={bad} />
                    </div>
                    <span className="text-muted-foreground">–</span>
                    <div className="w-32 shrink-0">
                      <TimeField value={v.end} onChange={(end) => put(r.id, { ...v, end })} error={bad} />
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <div className="flex shrink-0 items-center justify-between gap-3 border-t border-border px-5 py-3">
        {/* Xato shu yerda, toast emas: toast pastki o'ng burchakdagi «Saqlash» ustiga tushadi. */}
        {tried && wrong.length > 0 ? (
          <span className="text-[12.5px] text-rose-600">
            {t("{n} ta xodimda vaqt to'liq emas — qizil qatorlarni tuzating", { n: wrong.length })}
          </span>
        ) : (
          <span className="text-[12.5px] text-muted-foreground">
            {changed.length > 0 ? t("O'zgarish: {n} ta xodim", { n: changed.length }) : t("O'zgarish yo'q")}
          </span>
        )}
        <div className="flex gap-2">
          <button
            type="button"
            onClick={modal.close}
            disabled={saving}
            className="h-9 rounded-lg border border-border bg-card px-4 text-sm font-medium hover:bg-secondary disabled:opacity-60"
          >
            {t("Bekor qilish")}
          </button>
          <button
            type="button"
            onClick={() => void save()}
            disabled={saving || changed.length === 0}
            className="h-9 rounded-lg bg-primary px-5 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
          >
            {saving ? t("Saqlanmoqda…") : t("Saqlash")}
          </button>
        </div>
      </div>
    </Modal>
  );
}
