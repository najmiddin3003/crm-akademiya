"use client";

import { useMemo, useState } from "react";
import { Loader2 } from "lucide-react";
import { useModalClose } from "@/components/ui/Modal";
import { useToast } from "@/components/ui/Toast";
import { useT } from "@/components/shared/Language";
import V2Dialog from "@/components/v2/form/V2Dialog";
import V2TimeField from "@/components/v2/form/V2TimeField";
import { Chip } from "@/components/v2/form/fields";
import { SearchBox } from "@/components/v2/students/lists/listKit";
import V2Select from "@/components/v2/ui/V2Select";
import { primaryBtn, secondaryBtn } from "@/components/v2/ui/buttons";
import { ROLE_LABELS } from "@/constants/employees";
import { collapseBranchPools, sameBranchPool } from "@/lib/branchPools";
import { parseWorkTime } from "@/lib/workTime";
import type { TempStaffRow } from "@/app/api/temp-staff/route";
import type { TempBranch } from "./TempStaffDialogsV2";

// YANGI VERSIYA — «Vaqtinchalik tugma» → «ISH VAQTINI BELGILASH» (55-qism, 20.11.2026).
// Eski versiyada — components/temp/WorkTimeModal.tsx, o'zgarmagan; mantiq AYNAN o'sha:
//   • hamma FAOL xodim bitta oynada (arxivdagilar yo'q), ism bo'yicha tartiblangan;
//   • yuqoridagi vaqt filtrdan o'tgan (ko'rinib turgan) xodimlarga bir bosishda qo'yiladi;
//   • «Guruh vaqti bo'yicha» — ko'rinib turgan O'QITUVCHILARGA guruhlari dars vaqti (TempStaffRow.groupTime);
//   • «Faqat kiritilmaganlar» SAQLANGAN qiymatga qaraydi — yozilayotgan qator ro'yxatdan yo'qolmasin;
//   • saqlash — oxirida bitta PUT /api/temp-staff/work-time { items: [{ id, workStart, workEnd }] },
//     faqat o'zgargan qatorlar; chala/noto'g'ri qator bo'lsa yuborilmaydi, qatorlar qizil bo'ladi.
// Farqi: saqlanmagan o'zgarish bor paytda yopish (×, «Bekor qilish», Esc) «Saqlanmagan o'zgarishlar bor»
// deb so'raydi (eskisida Esc/fon yopmasdi, × esa so'ramay yopardi). Enter bu oynada saqlamaydi.

type Times = { start: string; end: string };

const roleOf = (turi: string) => ROLE_LABELS[turi as keyof typeof ROLE_LABELS] ?? turi;

export default function WorkTimeDialogV2({
  rows,
  branches,
  onClose,
  onSaved,
}: {
  rows: TempStaffRow[];
  branches: TempBranch[];
  onClose: () => void;
  onSaved: () => Promise<void> | void;
}) {
  const { t } = useT();
  const { showSuccess, showError } = useToast();
  const modal = useModalClose(onClose, "center");
  /** Faqat tegilgan qatorlar: boshqalari saqlangan qiymatini ko'rsatadi. */
  const [drafts, setDrafts] = useState<ReadonlyMap<number, Times>>(new Map());
  const [query, setQuery] = useState("");
  const [branchFilter, setBranchFilter] = useState("");
  const [onlyEmpty, setOnlyEmpty] = useState(false);
  const [quick, setQuick] = useState<Times>({ start: "", end: "" });
  /** Oxirgi «Guruh vaqti bo'yicha» natijasi: nechtasiga qo'yildi, nechtasida guruh yo'q. */
  const [groupApplied, setGroupApplied] = useState<{ done: number; missing: number } | null>(null);
  const [tried, setTried] = useState(false);
  const [saving, setSaving] = useState(false);

  const staff = useMemo(() => rows.filter((r) => !r.archReason).sort((a, b) => a.name.localeCompare(b.name)), [rows]);
  const emptyCount = staff.filter((r) => !r.workStart).length;
  const branchOptions = useMemo(() => collapseBranchPools(branches).map((b) => ({ value: String(b.id), label: b.name })), [branches]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    const branchId = branchFilter ? Number(branchFilter) : null;
    return staff.filter((r) => {
      if (onlyEmpty && r.workStart) return false;
      if (branchId !== null && !r.branchIds.some((id) => sameBranchPool(id, branchId))) return false;
      if (!q) return true;
      return `${r.name} ${roleOf(r.turi)}`.toLowerCase().includes(q);
    });
  }, [staff, query, branchFilter, onlyEmpty]);

  const timesOf = (r: TempStaffRow): Times => drafts.get(r.id) ?? { start: r.workStart ?? "", end: r.workEnd ?? "" };
  const put = (id: number, next: Times) => setDrafts((prev) => new Map(prev).set(id, next));

  const changed = staff.filter((r) => {
    const d = drafts.get(r.id);
    return d !== undefined && (d.start !== (r.workStart ?? "") || d.end !== (r.workEnd ?? ""));
  });
  const wrong = changed.filter((r) => !parseWorkTime(timesOf(r).start, timesOf(r).end).ok);
  const wrongIds = new Set(wrong.map((r) => r.id));

  const quickParsed = parseWorkTime(quick.start, quick.end);
  const quickReady = quickParsed.ok && quickParsed.workStart !== null;
  const visibleTeachers = visible.filter((r) => r.turi === "teacher");

  function applyQuick() {
    if (!quickReady) return;
    setDrafts((prev) => {
      const next = new Map(prev);
      for (const r of visible) next.set(r.id, { ...quick });
      return next;
    });
  }

  function applyGroupTime() {
    const withGroup = visibleTeachers.flatMap((r) => (r.groupTime ? [{ id: r.id, time: r.groupTime }] : []));
    setDrafts((prev) => {
      const next = new Map(prev);
      for (const { id, time } of withGroup) next.set(id, time);
      return next;
    });
    setGroupApplied({ done: withGroup.length, missing: visibleTeachers.length - withGroup.length });
  }

  async function save() {
    setTried(true);
    if (wrong.length > 0 || saving) return;
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
        setSaving(false);
        return;
      }
      showSuccess(t("Ish vaqti saqlandi — {n} ta xodim", { n: data.updated }));
      await onSaved();
      setSaving(false);
      modal.close();
    } catch {
      showError(t("Serverga ulanib bo'lmadi"));
      setSaving(false);
    }
  }

  return (
    <V2Dialog
      title={t("Ish vaqtini belgilash")}
      subtitle={t("Faol xodimlar: {all} ta, kiritilmagan: {empty} ta", { all: staff.length, empty: emptyCount })}
      onClose={onClose}
      controller={modal}
      dirty={changed.length > 0}
      saving={saving}
      width={760}
      footerStart={
        // Xato shu yerda, toast emas: toast pastki o'ng burchakdagi «Saqlash» ustiga tushadi.
        tried && wrong.length > 0 ? (
          <span className="text-v2-small text-v2-danger">{t("{n} ta xodimda vaqt to'liq emas — qizil qatorlarni tuzating", { n: wrong.length })}</span>
        ) : (
          <span className="text-v2-small text-v2-text-2">{changed.length > 0 ? t("O'zgarish: {n} ta xodim", { n: changed.length }) : t("O'zgarish yo'q")}</span>
        )
      }
      footer={(api) => (
        <>
          <button type="button" onClick={api.requestClose} disabled={saving} className={secondaryBtn}>
            {t("Bekor qilish")}
          </button>
          <button type="button" onClick={() => void save()} disabled={saving || changed.length === 0} className={`${primaryBtn} disabled:cursor-not-allowed disabled:opacity-50`}>
            {saving && <Loader2 className="size-4 animate-spin" aria-hidden />}
            {saving ? t("Saqlanmoqda…") : t("Saqlash")}
          </button>
        </>
      )}
    >
      {/* Filtr va «hammasiga qo'yish» qatori ro'yxat aylanganda tepada qotib turadi. */}
      <div className="sticky top-0 z-10 -mx-5 space-y-3 border-b border-v2-border bg-v2-surface px-5 pb-3">
        <div className="flex flex-wrap items-center gap-2">
          <SearchBox value={query} onChange={setQuery} placeholder={t("Ism yoki vazifa")} width={220} />
          <V2Select variant="chip" label={t("Filial")} value={branchFilter} onChange={setBranchFilter} options={branchOptions} searchable={false} />
          <Chip on={onlyEmpty} onClick={() => setOnlyEmpty((v) => !v)}>
            {t("Faqat kiritilmaganlar")}
          </Chip>
        </div>
        <div className="flex flex-wrap items-center gap-2 rounded-v2-md bg-v2-surface-2 p-2.5">
          <div className="w-28 shrink-0">
            <V2TimeField value={quick.start} onChange={(v) => setQuick((q) => ({ ...q, start: v }))} placeholder="09:00" ariaLabel={t("Boshlanishi")} />
          </div>
          <span className="text-v2-text-3" aria-hidden>
            –
          </span>
          <div className="w-28 shrink-0">
            <V2TimeField value={quick.end} onChange={(v) => setQuick((q) => ({ ...q, end: v }))} placeholder="18:00" ariaLabel={t("Tugashi")} />
          </div>
          <button type="button" onClick={applyQuick} disabled={!quickReady || visible.length === 0} className={`${primaryBtn} disabled:cursor-not-allowed disabled:opacity-50`}>
            {t("Ko'rinib turgan {n} xodimga qo'yish", { n: visible.length })}
          </button>
          <button type="button" onClick={applyGroupTime} disabled={!visibleTeachers.some((r) => r.groupTime)} className={`${secondaryBtn} disabled:cursor-not-allowed disabled:opacity-50`}>
            {t("Guruh vaqti bo'yicha")}
          </button>
          {!quickParsed.ok && quick.start !== "" && quick.end !== "" && <span className="text-v2-small text-v2-danger">{t(quickParsed.error)}</span>}
        </div>
        {groupApplied && (
          <p className="text-v2-small text-v2-text-2">
            {t("{n} ta o'qituvchiga guruh vaqti qo'yildi", { n: groupApplied.done })}
            {groupApplied.missing > 0 && ` · ${t("{n} tasida aktiv guruh yo'q, ular o'zgarmadi", { n: groupApplied.missing })}`}
          </p>
        )}
      </div>

      {visible.length === 0 ? (
        <p className="py-10 text-center text-v2-small text-v2-text-3">{t("Ma'lumotlar topilmadi")}</p>
      ) : (
        <ul className="divide-y divide-v2-border">
          {visible.map((r) => {
            const v = timesOf(r);
            const bad = tried && wrongIds.has(r.id);
            const label = r.name || `#${r.id}`;
            return (
              <li key={r.id} className="flex flex-col gap-2 py-2.5 sm:flex-row sm:items-center sm:gap-3">
                <div className="min-w-0 flex-1">
                  <div className="truncate text-v2-body font-medium text-v2-text">{label}</div>
                  <div className="truncate text-v2-small text-v2-text-3">{r.turi ? t(roleOf(r.turi)) : "-"}</div>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <div className="w-24 shrink-0">
                    <V2TimeField icon={false} value={v.start} onChange={(start) => put(r.id, { ...v, start })} state={bad ? "error" : "default"} placeholder="09:00" ariaLabel={`${label} — ${t("Boshlanishi")}`} />
                  </div>
                  <span className="text-v2-text-3" aria-hidden>
                    –
                  </span>
                  <div className="w-24 shrink-0">
                    <V2TimeField icon={false} value={v.end} onChange={(end) => put(r.id, { ...v, end })} state={bad ? "error" : "default"} placeholder="18:00" ariaLabel={`${label} — ${t("Tugashi")}`} />
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </V2Dialog>
  );
}
