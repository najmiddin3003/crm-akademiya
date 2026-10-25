"use client";

import { useEffect, useMemo, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { AlertTriangle, Award, Check, ChevronDown, FileUp, Loader2, Plus, RefreshCw, Users, X } from "lucide-react";
import { useT } from "@/components/shared/Language";
import { useToast } from "@/components/ui/Toast";
import V2DateField from "@/components/v2/form/V2DateField";
import V2Confirm from "@/components/v2/form/V2Confirm";
import { fieldCls } from "@/components/v2/form/fields";
import { primaryBtn, secondaryBtn } from "@/components/v2/ui/buttons";
import { dayMonthLabel } from "@/components/v2/ui/V2DateRange";
import { ROW_TINT } from "@/components/v2/ui/table";
import { initialsOf } from "@/components/v2/employees/employeeBits";
import NewStudentDrawerV2 from "@/components/v2/students/NewStudentDrawerV2";
import type { Group } from "@/lib/groups";
import type { Pupil } from "@/lib/pupilsData";
import { uzDateIso } from "@/lib/uzTime";
import {
  EMPTY_CELLS,
  UB_MAJ_SHORT,
  avgOf,
  cellsCalc,
  cellsEmpty,
  resultCells,
  sameCells,
  schemeMax,
  type UbCells,
  type UbConfig,
  type UbResult,
  type UbTest,
  type UbTestRow,
} from "@/lib/uzbmb";
import type { UbTestData } from "@/lib/uzbmbServer";
import { ImtihonHeader } from "../examBits";
import { UbAddPupilDialog, UbImportDialog } from "./ubDialogs";
import {
  EMPTY_DRAFT,
  NO_DIR,
  autoDirection,
  ballInput,
  cellsOf,
  countInput,
  dateToIso,
  dirLabel,
  draftOf,
  fmtBall,
  fmtNum,
  isoToDate,
  sameDir,
  schemeLabel,
  sheetRows,
  type Dir,
  type DraftCells,
  type SheetRow,
} from "./ubCore";
import { DirectionPicker, FilterLabel, GroupPicker, MaxBallBox, TestPicker } from "./ubPickers";

// YANGI VERSIYA — UZBMB → «NATIJA KIRITISH» (rasm «UzBMB · Natija kiritish», yorug'/qorong'i, 25.10.2026):
//   • yo'l «UzBMB › Natija kiritish», «Imtihon», «Excel'dan yuklash», «Eksport ⌄»; tablar Sarhisob | UzBMB;
//   • tanlovlar (surface-2): Test, Sana, Guruh, Yo'nalish («avto» — guruhdan), «Maks. ball 189 = 93 + 63 + 33»;
//   • «8 ta o'quvchi · guruhdan avtomatik olindi · to'g'ri javoblar soni kiritiladi, ball o'zi hisoblanadi»,
//     «+ O'quvchi qo'shish»; jadval: № | O'quvchi | 1-blok (fan, «30 × 3,1») | 2-blok | Majburiy × 3 |
//     Jami ball («189 dan», chiziq) | ✓ yoki fokusdagi qatorda «Tab». Katak — «24 /30», ostida «= 74,4 ball»;
//     sertifikat — katakdagi belgini bosib, ball qo'lda («93,0 ball», ostida «Sertifikat»);
//   • pastda «6 / 8 kiritildi • Guruh o'rtachasi 145,5 ball», izoh, «Bekor qilish», «✓ Natijalarni saqlash».
//
// QORALAMA: o'zgartirilgan qatorlar `edits` da, qolgani saqlangan natijadan; faqat o'zgarganlari
// yuboriladi (PUT …/tests/:id/results). Yo'nalish varaqniki, lekin saqlangan natijasi boshqa
// yo'nalishda bo'lgan o'quvchi o'z fanlarida qoladi (ismi ostida yozuv). Test/guruh almashganda
// komponent qayta yaratiladi (UzbmbV2 → `key`) — qoralama tozalanadi (avval so'raladi).

type ColKey = "b1" | "b2" | "m1" | "m2" | "m3";
const COLS: readonly ColKey[] = ["b1", "b2", "m1", "m2", "m3"];

/** Sertifikat belgisi bor, lekin ball yozilmagan blok — kiritilmagan hisoblanadi. */
function normCells(c: UbCells): UbCells {
  return {
    ...c,
    ...(c.b1cert && c.b1m === null ? { b1cert: false, b1c: null } : {}),
    ...(c.b2cert && c.b2m === null ? { b2cert: false, b2c: null } : {}),
  };
}

const savedDir = (r: UbResult): Dir => ({ b1s: r.b1s, b2s: r.b2s });

const smallBtn =
  "inline-flex h-8 shrink-0 items-center gap-1.5 rounded-v2-md border border-v2-border-strong bg-v2-surface px-3 text-v2-small font-medium text-v2-text transition-[background-color,box-shadow] hover:bg-v2-surface-2 focus-visible:shadow-v2-focus focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50";

export default function UbEntry({
  config,
  tests,
  test,
  data,
  dataLoading,
  dataError,
  onRetryData,
  groups,
  groupsLoading,
  groupId,
  members,
  membersError,
  seed,
  exportNode,
  onChangeTest,
  onChangeGroup,
  onNewTest,
  onEditTest,
  onSaved,
  onLeave,
  onMemberAdded,
}: {
  config: UbConfig | null;
  tests: UbTestRow[] | null;
  test: UbTest | null;
  data: UbTestData | null;
  dataLoading: boolean;
  dataError: string | null;
  onRetryData: () => void;
  groups: Group[];
  groupsLoading: boolean;
  groupId: number | null;
  members: Pupil[] | null;
  membersError: string | null;
  /** «Excel'dan yuklash» natijalar ko'rinishida bosilgan bo'lsa — jadvalga qo'yiladigan qiymatlar. */
  seed: Record<number, UbCells> | null;
  exportNode: ReactNode;
  onChangeTest: (id: number) => void;
  onChangeGroup: (id: number) => void;
  onNewTest: () => void;
  onEditTest: (t: UbTestRow) => void;
  onSaved: (results: UbResult[], info: { saved: number; removed: number; partial: number }) => void;
  onLeave: () => void;
  onMemberAdded: (p: Pupil) => void;
}) {
  const { t, lang } = useT();
  const { showSuccess, showError } = useToast();

  const [edits, setEdits] = useState<Record<number, DraftCells>>(() => {
    const out: Record<number, DraftCells> = {};
    if (seed) for (const [pid, c] of Object.entries(seed)) out[Number(pid)] = draftOf(c);
    return out;
  });
  const [dirChoice, setDirChoice] = useState<Dir | null>(null);
  const [dateChoice, setDateChoice] = useState<string | null>(null);
  const [added, setAdded] = useState<{ id: number; name: string }[]>([]);
  const [focus, setFocus] = useState<{ pid: number; col: ColKey } | null>(null);
  const [tried, setTried] = useState(false);
  const [saving, setSaving] = useState(false);
  const [ask, setAsk] = useState<null | { kind: "leave" } | { kind: "test"; id: number } | { kind: "group"; id: number }>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [newOpen, setNewOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const inputs = useRef(new Map<string, HTMLInputElement>());

  const group = useMemo(() => groups.find((g) => g.id === groupId) ?? null, [groups, groupId]);
  const scheme = test?.scheme ?? null;
  const max = scheme ? schemeMax(scheme) : null;
  const results = useMemo(() => data?.results ?? [], [data]);
  const ready = Boolean(test && groupId !== null && members && data);
  const rows: SheetRow[] = useMemo(
    () => (ready && members && groupId !== null ? sheetRows({ members, results, groupId, added }) : []),
    [ready, members, results, groupId, added],
  );
  const savedHere = useMemo(() => results.filter((r) => r.groupId === groupId), [results, groupId]);

  const auto = useMemo(
    () => (config && groupId !== null ? autoDirection({ group, saved: savedHere, last: data?.lastDirections[groupId] ?? null, config }) : { dir: NO_DIR, auto: false }),
    [config, group, savedHere, data, groupId],
  );
  const baseDir = auto.dir;
  const sheetDir = dirChoice ?? baseDir;
  const dirAuto = dirChoice === null && auto.auto;

  const baseDate = useMemo(() => {
    const tally = new Map<string, number>();
    for (const r of savedHere) if (r.date) tally.set(r.date, (tally.get(r.date) ?? 0) + 1);
    const top = [...tally.entries()].sort((a, b) => b[1] - a[1])[0];
    return top?.[0] ?? test?.date ?? uzDateIso();
  }, [savedHere, test]);
  const date = dateChoice ?? baseDate;

  const rowDir = (r: SheetRow): Dir => (r.saved ? (sameDir(savedDir(r.saved), baseDir) ? sheetDir : savedDir(r.saved)) : sheetDir);
  const draftFor = (r: SheetRow): DraftCells => edits[r.pupilId] ?? (r.saved ? draftOf(resultCells(r.saved)) : EMPTY_DRAFT);
  const isDirty = (r: SheetRow): boolean => {
    const cur = normCells(cellsOf(draftFor(r)));
    const before = r.saved ? resultCells(r.saved) : EMPTY_CELLS;
    if (!sameCells(cur, before)) return true;
    if (r.saved && r.saved.groupId === groupId && !cellsEmpty(cur)) {
      if (!sameDir(rowDir(r), savedDir(r.saved))) return true;
      if (dateChoice !== null && r.saved.date !== date) return true;
    }
    return false;
  };

  const view = rows.map((r) => {
    const d = draftFor(r);
    const calc = scheme ? cellsCalc(normCells(cellsOf(d)), scheme) : null;
    return { r, d, calc, dir: rowDir(r), dirty: isDirty(r) };
  });
  const dirtyRows = view.filter((v) => v.dirty);
  const dirty = dirtyRows.length > 0 || added.length > 0;
  const complete = view.filter((v) => v.calc?.complete);
  const avg = avgOf(complete.map((v) => v.calc!.total));

  // Saqlanmagan natija bor — sahifani yopish/yangilashdan oldin brauzer so'raydi.
  useEffect(() => {
    if (!dirty) return;
    const onBefore = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", onBefore);
    return () => window.removeEventListener("beforeunload", onBefore);
  }, [dirty]);

  // ── Kataklar ──
  function setCell(r: SheetRow, col: ColKey, raw: string) {
    if (!scheme || !max) return;
    const base = draftFor(r);
    const cert = (col === "b1" && base.b1cert) || (col === "b2" && base.b2cert);
    const q = col === "b1" ? scheme.b1.q : col === "b2" ? scheme.b2.q : scheme.maj.q;
    const v = cert ? ballInput(raw, col === "b1" ? max.b1 : max.b2) : countInput(raw, q);
    setEdits((prev) => ({ ...prev, [r.pupilId]: { ...(prev[r.pupilId] ?? base), [col]: v } }));
  }

  function toggleCert(r: SheetRow, col: "b1" | "b2") {
    const base = draftFor(r);
    const key = col === "b1" ? "b1cert" : "b2cert";
    setEdits((prev) => {
      const d = prev[r.pupilId] ?? base;
      return { ...prev, [r.pupilId]: { ...d, [key]: !d[key], [col]: "" } };
    });
    requestAnimationFrame(() => inputs.current.get(`${r.pupilId}:${col}`)?.focus());
  }

  function focusAt(i: number, col: ColKey) {
    const r = rows[i];
    if (!r) return;
    const el = inputs.current.get(`${r.pupilId}:${col}`);
    el?.focus();
    el?.select();
  }

  function onKey(e: KeyboardEvent<HTMLInputElement>, i: number, col: ColKey) {
    if (e.key === "Enter" || e.key === "ArrowDown") {
      e.preventDefault();
      if (i + 1 < rows.length) focusAt(i + 1, col);
      else e.currentTarget.blur();
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      focusAt(i - 1, col);
    }
  }

  // ── Saqlash ──
  async function save() {
    setTried(true);
    if (!test) return showError(t("Testni tanlang"));
    if (groupId === null) return showError(t("Guruhni tanlang"));
    const payload = dirtyRows.map((v) => {
      const cells = normCells(cellsOf(v.d));
      return { pupilId: v.r.pupilId, b1s: v.dir.b1s, b2s: v.dir.b2s, ...cells };
    });
    if (!payload.length) {
      showError(t("Saqlanadigan o'zgarish yo'q"));
      return;
    }
    const needDir = payload.some((p) => !cellsEmpty(p) && (!p.b1s || !p.b2s));
    if (needDir) return showError(t("Yo'nalishni tanlang — 1-blok va 2-blok fani"));
    const partial = payload.filter((p) => !cellsEmpty(p) && scheme && !cellsCalc(p, scheme).complete).length;
    setSaving(true);
    try {
      const res = await fetch(`/api/imtihon/uzbmb/tests/${test.id}/results`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ groupId, date, rows: payload }),
      });
      const d = await res.json();
      if (!d.ok) {
        showError(t(d.error || "Saqlanmadi"));
        setSaving(false);
        return;
      }
      // Saqlandi — endi «saqlanmagan» emas (beforeunload so'ramasin).
      setEdits({});
      setAdded([]);
      onSaved(d.results as UbResult[], { saved: Number(d.saved) || 0, removed: Number(d.removed) || 0, partial });
    } catch {
      showError(t("Serverga ulanib bo'lmadi"));
      setSaving(false);
    }
  }

  const guard = (next: NonNullable<typeof ask>) => {
    if (saving) return;
    if (!dirty) {
      if (next.kind === "leave") onLeave();
      else if (next.kind === "test") onChangeTest(next.id);
      else onChangeGroup(next.id);
      return;
    }
    setAsk(next);
  };

  const groupCounts = useMemo(() => {
    const m = new Map<number, number>();
    for (const r of results) m.set(r.groupId, (m.get(r.groupId) ?? 0) + 1);
    return m;
  }, [results]);

  const dateObj = isoToDate(date);
  const errDir = tried && (!sheetDir.b1s || !sheetDir.b2s);
  const groupLabel = (id: number) => data?.groupLabels[id] ?? groups.find((g) => g.id === id)?.course ?? `#${id}`;

  // ── Sarlavha katagi ──
  const head = (col: ColKey) => {
    const top = col === "b1" ? t("1-blok") : col === "b2" ? t("2-blok") : t("Majburiy");
    const name = col === "b1" ? sheetDir.b1s || "—" : col === "b2" ? sheetDir.b2s || "—" : t(UB_MAJ_SHORT[col]);
    const meta = scheme ? schemeLabel(scheme, col === "b1" ? "b1" : col === "b2" ? "b2" : "maj", lang) : "";
    return (
      <th key={col} className="px-2 py-2.5 align-bottom font-normal">
        <span className="block text-v2-caption text-v2-text-3">{top}</span>
        <span className="block truncate text-v2-small font-semibold text-v2-text" title={name}>
          {name}
        </span>
        <span className="block text-v2-caption font-normal tabular-nums text-v2-text-3">{meta}</span>
      </th>
    );
  };

  // ── Katak ──
  const cell = (v: (typeof view)[number], i: number, col: ColKey) => {
    const { r, d, calc } = v;
    const block = col === "b1" || col === "b2";
    const cert = (col === "b1" && d.b1cert) || (col === "b2" && d.b2cert);
    const q = !scheme ? 0 : col === "b1" ? scheme.b1.q : col === "b2" ? scheme.b2.q : scheme.maj.q;
    const ball = !calc ? null : col === "b1" ? calc.b1 : col === "b2" ? calc.b2 : calc.mb[col];
    const raw = d[col];
    const label = `${r.name} — ${col === "b1" ? sheetDir.b1s || t("1-blok") : col === "b2" ? sheetDir.b2s || t("2-blok") : t(UB_MAJ_SHORT[col as "m1"])}`;
    return (
      <td key={col} className="px-2 py-1 align-top">
        <div className={`group/cell relative ${block ? "w-[100px]" : "w-[78px]"}`}>
          <input
            ref={(el) => {
              const key = `${r.pupilId}:${col}`;
              if (el) inputs.current.set(key, el);
              else inputs.current.delete(key);
            }}
            value={cert && lang === "en" ? raw.replace(",", ".") : raw}
            onChange={(e) => setCell(r, col, e.target.value)}
            onFocus={() => setFocus({ pid: r.pupilId, col })}
            onBlur={() => setFocus((f) => (f && f.pid === r.pupilId && f.col === col ? null : f))}
            onKeyDown={(e) => onKey(e, i, col)}
            inputMode={cert ? "decimal" : "numeric"}
            autoComplete="off"
            placeholder="—"
            disabled={!scheme}
            aria-label={cert ? t("{label} — sertifikat bali", { label }) : t("{label} — to'g'ri javoblar", { label })}
            className={fieldCls(
              "default",
              `h-7! px-2.5 font-semibold tabular-nums ${block ? "pr-[3.25rem]" : "pr-9"} ${cert ? "border-v2-brand bg-v2-brand-bg! text-v2-text" : ""}`,
              "sm",
            )}
          />
          <span className={`pointer-events-none absolute top-1/2 -translate-y-1/2 text-v2-caption font-normal tabular-nums text-v2-text-3 ${block ? "right-7" : "right-2.5"}`}>
            {cert ? t("ball") : `/${q}`}
          </span>
          {block && (
            <button
              type="button"
              tabIndex={-1}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => toggleCert(r, col)}
              title={cert ? t("Sertifikatni olib tashlash") : t("Sertifikat bor — ball qo'lda")}
              aria-label={cert ? t("Sertifikatni olib tashlash") : t("Sertifikat bor — ball qo'lda")}
              aria-pressed={cert}
              className={`absolute right-1.5 top-1/2 inline-flex size-5 -translate-y-1/2 items-center justify-center rounded-v2-sm opacity-0 transition-opacity group-focus-within/cell:opacity-100 group-hover/cell:opacity-100 hover:bg-v2-surface-2 focus-visible:opacity-100 ${
                cert ? "text-v2-brand-text" : "text-v2-text-3"
              }`}
            >
              <Award className="size-3.5" strokeWidth={1.75} aria-hidden />
            </button>
          )}
        </div>
        <div className="mt-0.5 h-3.5 whitespace-nowrap text-[11px] font-normal leading-[14px] tabular-nums">
          {cert ? (
            <span className="inline-flex items-center gap-1 text-v2-brand-text">
              <Award className="size-3" strokeWidth={2} aria-hidden />
              {t("Sertifikat")}
            </span>
          ) : ball !== null ? (
            <span className="text-v2-text-3">= {t("{ball} ball", { ball: fmtBall(ball, lang) })}</span>
          ) : null}
        </div>
      </td>
    );
  };

  const testRows = tests ?? [];
  const noTests = tests !== null && tests.length === 0;

  return (
    <div className="flex flex-col gap-4">
      <ImtihonHeader
        tab="uzbmb"
        crumbs={[{ label: "UzBMB", onClick: () => guard({ kind: "leave" }) }, { label: t("Natija kiritish") }]}
        actions={
          <>
            <button type="button" onClick={() => setImportOpen(true)} disabled={!ready || !scheme} title={!ready ? t("Avval test va guruhni tanlang") : undefined} className={`${secondaryBtn} disabled:cursor-not-allowed disabled:opacity-50`}>
              <FileUp className="size-4" strokeWidth={1.75} aria-hidden />
              {t("Excel'dan yuklash")}
            </button>
            {exportNode}
          </>
        }
      />

      {/* Tanlovlar paneli */}
      <div className="grid grid-cols-2 gap-3 rounded-v2-lg border border-v2-border bg-v2-surface-2 p-4 min-[40rem]:grid-cols-3 min-[80rem]:grid-cols-[1.35fr_0.85fr_1.45fr_1.2fr_0.95fr]">
        <div className="col-span-2 min-w-0 min-[40rem]:col-span-1">
          <FilterLabel error={tried && !test}>{t("Test")}</FilterLabel>
          <TestPicker tests={testRows} value={test?.id ?? null} onChange={(id) => guard({ kind: "test", id })} loading={tests === null} onNew={onNewTest} onEdit={onEditTest} state={tried && !test ? "error" : "default"} />
        </div>
        <div className="min-w-0">
          <FilterLabel>{t("Sana")}</FilterLabel>
          <V2DateField
            value={dateObj}
            disabled={!test}
            onChange={(d) => setDateChoice(dateToIso(d))}
            trigger={(p, open) => (
              <button type="button" {...p} aria-label={t("Sana")} disabled={!test} className={fieldCls("default", `flex items-center gap-2 text-left ${open ? "border-v2-brand shadow-v2-focus" : ""}`, "sm")}>
                <span className="min-w-0 flex-1 truncate font-semibold tabular-nums text-v2-text">{dateObj ? dayMonthLabel(dateObj, lang) : "—"}</span>
                <ChevronDown className={`size-4 shrink-0 text-v2-text-3 transition-transform ${open ? "rotate-180" : ""}`} strokeWidth={1.75} aria-hidden />
              </button>
            )}
          />
        </div>
        <div className="col-span-2 min-w-0 min-[40rem]:col-span-1">
          <FilterLabel error={tried && groupId === null}>{t("Guruh")}</FilterLabel>
          <GroupPicker groups={groups} value={groupId} onChange={(id) => guard({ kind: "group", id })} counts={groupCounts} loading={groupsLoading} state={tried && groupId === null ? "error" : "default"} />
        </div>
        <div className="col-span-2 min-w-0 min-[40rem]:col-span-1">
          <FilterLabel error={errDir} auto={dirAuto && Boolean(sheetDir.b1s && sheetDir.b2s)}>
            {t("Yo'nalish")}
          </FilterLabel>
          <DirectionPicker config={config} value={sheetDir} onChange={(d) => setDirChoice(d)} state={errDir ? "error" : "default"} />
        </div>
        <div className="min-w-0">
          <FilterLabel>{t("Maks. ball")}</FilterLabel>
          <MaxBallBox scheme={scheme} />
        </div>
      </div>

      {/* O'quvchilar kartasi */}
      <section className="min-w-0 overflow-hidden rounded-v2-lg border border-v2-border bg-v2-surface shadow-v2-sm" aria-label={t("O'quvchilar")}>
        {noTests ? (
          <EmptyState icon={<Award className="size-5" strokeWidth={1.75} aria-hidden />} title={t("Hali UzBMB testi yo'q")} text={t("Avval test yarating — nomi va sanasi bilan. Keyin har guruh natijasini shu yerda kiritasiz.")}>
            <button type="button" onClick={onNewTest} className={primaryBtn}>
              <Plus className="size-4" strokeWidth={2} aria-hidden />
              {t("Yangi test")}
            </button>
          </EmptyState>
        ) : tests === null ? (
          <div className="space-y-3 p-4" aria-hidden>
            {Array.from({ length: 5 }, (_, i) => (
              <div key={i} className="h-9 rounded-v2-md bg-v2-skeleton" />
            ))}
          </div>
        ) : !test || groupId === null ? (
          <EmptyState icon={<Users className="size-5" strokeWidth={1.75} aria-hidden />} title={!test ? t("Testni tanlang") : t("Guruhni tanlang")} text={t("Guruh tanlangach unga biriktirilgan o'quvchilar shu yerda chiqadi — har fanga to'g'ri javoblar sonini yozasiz.")} />
        ) : dataError || membersError ? (
          <EmptyState icon={<AlertTriangle className="size-5" strokeWidth={1.75} aria-hidden />} title={t(dataError || membersError || "Yuklanmadi")}>
            <button type="button" onClick={onRetryData} className={secondaryBtn}>
              <RefreshCw className="size-4" strokeWidth={1.75} aria-hidden />
              {t("Qayta urinish")}
            </button>
          </EmptyState>
        ) : (
          <>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-2 px-4 py-3">
              <div className="min-w-0 flex-1">
                <span className="text-v2-body font-semibold text-v2-text">{ready ? t("{n} ta o'quvchi", { n: rows.length }) : t("O'quvchilar")}</span>{" "}
                <span className="text-v2-small text-v2-text-2">{t("guruhdan avtomatik olindi · to'g'ri javoblar soni kiritiladi, ball o'zi hisoblanadi")}</span>
              </div>
              <button type="button" onClick={() => setAddOpen(true)} disabled={!ready} className={smallBtn}>
                <Plus className="size-4" strokeWidth={1.75} aria-hidden />
                {t("O'quvchi qo'shish")}
              </button>
            </div>

            {ready && (!sheetDir.b1s || !sheetDir.b2s) && (
              <div role="note" className={`mx-4 mb-3 flex items-start gap-2 rounded-v2-md px-3 py-2.5 text-v2-small text-v2-text ${errDir ? "bg-v2-danger-bg" : "bg-v2-warning-bg"}`}>
                <AlertTriangle className={`mt-0.5 size-4 shrink-0 ${errDir ? "text-v2-danger" : "text-v2-warning"}`} strokeWidth={2} aria-hidden />
                <span>{t("Guruh yo'nalishini tanlang — 1-blok va 2-blok qaysi fanligi. Ball hisobiga ta'sir qilmaydi, fanlar bo'yicha tahlil shundan.")}</span>
              </div>
            )}

            {/* `relative` — sarlavhadagi yashirin (sr-only) yozuv shu o'ram ichida qolsin (telefonda sahifa yonga surilmasin). */}
            <div className="relative overflow-x-auto overflow-y-hidden">
              <table className="w-full min-w-[1000px] border-collapse text-v2-body">
                <thead>
                  <tr className="bg-v2-surface-2 text-left text-v2-small text-v2-text-2 shadow-[inset_0_-1px_0_var(--v2-border),inset_0_1px_0_var(--v2-border)]">
                    <th className="w-10 py-2.5 pl-4 pr-1 align-bottom font-medium">№</th>
                    <th className="min-w-[200px] px-3 py-2.5 align-bottom font-medium">{t("O'quvchi")}</th>
                    {COLS.map(head)}
                    <th className="w-[130px] px-3 py-2.5 align-bottom font-normal">
                      <span className="block text-v2-small font-semibold text-v2-text">{t("Jami ball")}</span>
                      <span className="block text-v2-caption font-normal tabular-nums text-v2-text-3">{max ? t("{max} dan", { max: fmtNum(max.total, lang) }) : ""}</span>
                    </th>
                    <th className="w-[64px] py-2.5 pl-1 pr-4">
                      <span className="sr-only">{t("Holat")}</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {!ready &&
                    (dataLoading || !members) &&
                    Array.from({ length: 4 }, (_, i) => (
                      <tr key={`sk${i}`} className="h-[62px] border-b border-v2-border" aria-hidden>
                        <td className="pl-4">
                          <div className="h-3 w-4 rounded bg-v2-skeleton" />
                        </td>
                        <td className="px-3">
                          <div className="h-3 w-40 rounded bg-v2-skeleton" />
                        </td>
                        {COLS.map((c) => (
                          <td key={c} className="px-2">
                            <div className="h-8 w-[78px] rounded-v2-md bg-v2-skeleton" />
                          </td>
                        ))}
                        <td className="px-3">
                          <div className="h-3 w-12 rounded bg-v2-skeleton" />
                        </td>
                        <td />
                      </tr>
                    ))}
                  {ready && rows.length === 0 && (
                    <tr>
                      <td colSpan={9} className="px-4 py-8 text-center">
                        <div className="text-v2-body font-semibold text-v2-text">{t("Guruhda o'quvchi yo'q")}</div>
                        <p className="mt-1 text-v2-small text-v2-text-2">{t("«O'quvchi qo'shish» tugmasi bilan qo'shing.")}</p>
                      </td>
                    </tr>
                  )}
                  {view.map((v, i) => {
                    const { r, calc } = v;
                    const focused = focus?.pid === r.pupilId;
                    const other = r.saved && r.saved.groupId !== groupId ? r.saved.groupId : null;
                    const ownDir = !sameDir(v.dir, sheetDir) && (v.dir.b1s || v.dir.b2s);
                    return (
                      <tr key={r.pupilId} className={`border-b border-v2-border last:border-b-0 ${focused ? ROW_TINT.brand : ROW_TINT.hover}`}>
                        <td className="py-1 pl-4 pr-1 align-top text-v2-small tabular-nums text-v2-text-2">
                          <span className="flex h-7 items-center">{i + 1}</span>
                        </td>
                        <td className="px-3 py-1 align-top">
                          <div className="flex min-h-7 min-w-0 items-center gap-2.5">
                            <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-v2-surface-2 text-[11px] font-semibold text-v2-text-2" aria-hidden>
                              {initialsOf(r.name)}
                            </span>
                            <span className="min-w-0">
                              <span className="flex items-center gap-1.5">
                                <span className="truncate font-semibold text-v2-text">{r.name}</span>
                                {!r.member && <span className="shrink-0 rounded-v2-sm bg-v2-surface-2 px-1.5 py-px text-v2-caption text-v2-text-2">{t("Qo'shilgan")}</span>}
                                {r.added && !r.saved && (
                                  <button
                                    type="button"
                                    onClick={() => setAdded((list) => list.filter((x) => x.id !== r.pupilId))}
                                    title={t("Jadvaldan olib tashlash")}
                                    aria-label={t("{name} — jadvaldan olib tashlash", { name: r.name })}
                                    className="inline-flex size-5 shrink-0 items-center justify-center rounded-v2-sm text-v2-text-3 hover:bg-v2-surface-2 hover:text-v2-text"
                                  >
                                    <X className="size-3.5" strokeWidth={1.75} />
                                  </button>
                                )}
                              </span>
                              {other !== null && <span className="block truncate text-v2-caption font-normal text-v2-text-3">{t("{group} bilan saqlangan", { group: groupLabel(other) })}</span>}
                              {ownDir && <span className="block truncate text-v2-caption font-normal text-v2-warning">{t("{dir} yo'nalishi", { dir: dirLabel(v.dir) })}</span>}
                            </span>
                          </div>
                        </td>
                        {COLS.map((c) => cell(v, i, c))}
                        <td className="px-3 py-1 align-top">
                          {calc?.complete ? (
                            <>
                              <span className="flex h-7 items-center text-v2-body font-semibold tabular-nums text-v2-text">{fmtBall(calc.total, lang)}</span>
                              <span className="mt-0.5 block h-1.5 w-[72px] overflow-hidden rounded-v2-full bg-v2-hover" aria-hidden>
                                <span className="block h-full rounded-v2-full bg-v2-series-1" style={{ width: `${max ? Math.min(100, (calc.total / max.total) * 100) : 0}%` }} />
                              </span>
                            </>
                          ) : focused ? (
                            <span className="flex h-7 items-center text-v2-caption font-normal text-v2-text-3">{t("kiritilmoqda…")}</span>
                          ) : calc && calc.filled > 0 ? (
                            <span className="flex h-7 items-center text-v2-caption font-normal text-v2-warning">{t("to'liq emas")}</span>
                          ) : (
                            <span className="flex h-7 items-center text-v2-caption font-normal text-v2-text-3">{t("kiritilmagan")}</span>
                          )}
                        </td>
                        <td className="py-1 pl-1 pr-4 align-top">
                          <span className="flex h-7 items-center justify-end">
                            {focused ? (
                              <kbd className="rounded-v2-sm border border-v2-border bg-v2-surface px-1.5 py-px font-sans text-[11px] text-v2-text-2">Tab</kbd>
                            ) : calc?.complete ? (
                              <Check className="size-4 text-v2-success" strokeWidth={2} aria-label={t("Kiritildi")} />
                            ) : null}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="flex flex-col gap-3 border-t border-v2-border bg-v2-surface-2 px-4 py-3 min-[64rem]:flex-row min-[64rem]:items-center">
              <div className="min-w-0 text-v2-small text-v2-text-2">
                <span className="font-semibold tabular-nums text-v2-text">
                  {complete.length} / {rows.length}
                </span>{" "}
                {t("kiritildi")}
                <span className="mx-2 text-v2-text-3" aria-hidden>
                  •
                </span>
                {t("Guruh o'rtachasi")} <span className="font-semibold tabular-nums text-v2-text">{avg === null ? "—" : t("{ball} ball", { ball: fmtBall(avg, lang) })}</span>
              </div>
              <div className="flex min-w-0 flex-1 items-center gap-1.5 text-v2-caption font-normal text-v2-text-3 min-[64rem]:justify-end">
                <Award className="size-3.5 shrink-0" strokeWidth={1.75} aria-hidden />
                <span>{t("Sertifikati bor fan: katakdagi shu belgini bosing — ball qo'lda yoziladi")}</span>
              </div>
              <div className="flex flex-col-reverse gap-2 min-[40rem]:flex-row">
                <button type="button" onClick={() => guard({ kind: "leave" })} disabled={saving} className={`${secondaryBtn} justify-center`}>
                  {t("Bekor qilish")}
                </button>
                <button type="button" onClick={() => void save()} disabled={saving || !ready} className={`${primaryBtn} justify-center disabled:opacity-60`}>
                  {saving ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Check className="size-4" strokeWidth={2} aria-hidden />}
                  {t("Natijalarni saqlash")}
                </button>
              </div>
            </div>
          </>
        )}
      </section>

      {addOpen && (
        <UbAddPupilDialog
          existing={new Set(rows.map((r) => r.pupilId))}
          onClose={() => setAddOpen(false)}
          onPick={(p) => {
            setAdded((list) => [...list, p]);
            requestAnimationFrame(() => inputs.current.get(`${p.id}:b1`)?.focus());
          }}
          onNewPupil={() => setNewOpen(true)}
        />
      )}
      {newOpen && group && (
        <NewStudentDrawerV2
          initialGroupId={group.id}
          groups={groups}
          onClose={() => setNewOpen(false)}
          onSaved={(pupil, addedTo) => {
            if (addedTo === group.id) onMemberAdded(pupil);
            else setAdded((list) => [...list, { id: pupil.id, name: `${pupil.firstName} ${pupil.lastName}`.trim() }]);
          }}
        />
      )}
      {importOpen && scheme && test && (
        <UbImportDialog
          title={`${test.name} · ${group ? groupLabel(group.id) : ""}`}
          scheme={scheme}
          dir={sheetDir}
          rows={rows}
          onClose={() => setImportOpen(false)}
          onApply={(cells) => {
            setEdits((prev) => {
              const next = { ...prev };
              for (const [pid, c] of Object.entries(cells)) next[Number(pid)] = draftOf(c);
              return next;
            });
            showSuccess(t("{n} ta natija jadvalga qo'yildi — tekshirib, saqlang", { n: Object.keys(cells).length }));
          }}
        />
      )}
      {ask && (
        <V2Confirm
          title={t("Saqlanmagan natijalar bor")}
          body={t("Kiritilgan natijalar saqlanmaydi. Davom etasizmi?")}
          confirmLabel={ask.kind === "leave" ? t("Saqlamasdan chiqish") : t("Saqlamasdan o'tish")}
          cancelLabel={t("Davom etish")}
          onCancel={() => setAsk(null)}
          onConfirm={() => {
            const a = ask;
            setAsk(null);
            setEdits({});
            setAdded([]);
            if (a.kind === "leave") onLeave();
            else if (a.kind === "test") onChangeTest(a.id);
            else onChangeGroup(a.id);
          }}
        />
      )}
    </div>
  );
}

function EmptyState({ icon, title, text, children }: { icon: ReactNode; title: ReactNode; text?: ReactNode; children?: ReactNode }) {
  return (
    <div className="p-6">
      <div className="flex flex-col items-center gap-2 rounded-v2-lg bg-v2-surface-2 px-6 py-10 text-center">
        <span className="flex size-10 items-center justify-center rounded-v2-md bg-v2-surface text-v2-text-3 shadow-v2-sm">{icon}</span>
        <div className="text-v2-section text-v2-text">{title}</div>
        {text && <p className="max-w-md text-v2-small text-v2-text-2">{text}</p>}
        {children && <div className="mt-1">{children}</div>}
      </div>
    </div>
  );
}

export { EmptyState as UbEmptyState };
