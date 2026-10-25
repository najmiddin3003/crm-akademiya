"use client";

import { useMemo, useState, type ReactNode } from "react";
import { AlertTriangle, ArrowDown, ArrowUp, Award, ClipboardList, FileUp, Pencil, Plus, RefreshCw, Users } from "lucide-react";
import Link from "@/components/ui/Link";
import { useT } from "@/components/shared/Language";
import { primaryBtn, secondaryBtn } from "@/components/v2/ui/buttons";
import { ROW_TINT } from "@/components/v2/ui/table";
import { initialsOf } from "@/components/v2/employees/employeeBits";
import type { Group } from "@/lib/groups";
import type { Pupil } from "@/lib/pupilsData";
import { rankOf, schemeMax, type UbCells, type UbConfig, type UbTest, type UbTestRow } from "@/lib/uzbmb";
import type { UbTestData } from "@/lib/uzbmbServer";
import { ImtihonHeader } from "../examBits";
import { UbImportDialog } from "./ubDialogs";
import UbSideCard from "./UbSideCard";
import { UbEmptyState } from "./UbEntry";
import { autoDirection, fmtBall, fmtDelta, fmtNum, groupLabelOf, sheetRows, type SheetRow } from "./ubCore";
import { FilterLabel, GroupPicker, TestPicker } from "./ubPickers";

// YANGI VERSIYA — UZBMB → «NATIJALAR» (rasm «UzBMB · Natijalar va taqqoslash», 25.10.2026):
//   • yo'l «UzBMB › Natijalar», o'ngda «Excel'dan yuklash», «Eksport ⌄» (rasm «Excel eksport»);
//   • Test («… №3 · 10-oktabr»), Guruh, o'ngda «✎ Natija kiritish»;
//   • jadval: O'rin (1 — sariq, 2–3 — kulrang doira) | O'quvchi | 1-blok /93 (sertifikat belgisi) |
//     2-blok /63 | Majburiy /33 | Jami /189 (qalin + ko'k chiziq) | «№2 testdan» (↑ yashil / ↓ qizil);
//     to'liq kiritilmaganlar pastda — «—» va «natija to'liq kiritilmagan»;
//   • o'ngda «Taqqoslash» (UbSideCard); qator bosilsa — o'quvchining UzBMB testlari.

function SkeletonRows() {
  return (
    <div aria-hidden>
      <div className="h-10 border-b border-v2-border bg-v2-surface-2" />
      {Array.from({ length: 6 }, (_, i) => (
        <div key={i} className="flex h-[49px] items-center gap-4 border-b border-v2-border px-4 last:border-b-0">
          <div className="size-6 rounded-full bg-v2-skeleton" />
          <div className="h-3 w-44 rounded bg-v2-skeleton" />
          <div className="ml-auto h-3 w-24 rounded bg-v2-skeleton" />
        </div>
      ))}
    </div>
  );
}

export default function UbResults({
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
  legacyCount,
  exportNode,
  onChangeTest,
  onChangeGroup,
  onEnter,
  onNewTest,
  onEditTest,
  onImported,
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
  legacyCount: number;
  exportNode: ReactNode;
  onChangeTest: (id: number) => void;
  onChangeGroup: (id: number) => void;
  onEnter: () => void;
  onNewTest: () => void;
  onEditTest: (t: UbTestRow) => void;
  /** Excel'dan o'qilgan qiymatlar — kiritish jadvaliga o'tib qo'yiladi. */
  onImported: (cells: Record<number, UbCells>) => void;
}) {
  const { t, lang } = useT();
  const [picked, setPicked] = useState<number | null>(null);
  const [importOpen, setImportOpen] = useState(false);

  const group = useMemo(() => groups.find((g) => g.id === groupId) ?? null, [groups, groupId]);
  const results = useMemo(() => data?.results ?? [], [data]);
  const ready = Boolean(test && groupId !== null && members && data);
  const rows: SheetRow[] = useMemo(() => (ready && members && groupId !== null ? sheetRows({ members, results, groupId }) : []), [ready, members, results, groupId]);
  const max = test ? schemeMax(test.scheme) : null;

  const ordered = useMemo(() => {
    const done = rows.filter((r) => r.saved?.complete).sort((a, b) => b.saved!.total - a.saved!.total || a.name.localeCompare(b.name, "uz"));
    const rest = rows.filter((r) => !r.saved?.complete).sort((a, b) => a.name.localeCompare(b.name, "uz"));
    const totals = done.map((r) => r.saved!.total);
    return { done, rest, totals };
  }, [rows]);
  const prevBy = useMemo(() => new Map((data?.prevResults ?? []).filter((r) => r.complete).map((r) => [r.pupilId, r.total])), [data]);

  const groupCounts = useMemo(() => {
    const m = new Map<number, number>();
    for (const r of results) m.set(r.groupId, (m.get(r.groupId) ?? 0) + 1);
    return m;
  }, [results]);

  const pickedRow = picked === null ? null : (rows.find((r) => r.pupilId === picked) ?? null);
  const groupLabel = group ? groupLabelOf(group) : groupId !== null ? (data?.groupLabels[groupId] ?? `#${groupId}`) : "";
  const anySaved = rows.some((r) => r.saved);
  const noTests = tests !== null && tests.length === 0;
  const importDir = useMemo(
    () => (config && groupId !== null ? autoDirection({ group, saved: results.filter((r) => r.groupId === groupId), last: data?.lastDirections[groupId] ?? null, config }).dir : { b1s: "", b2s: "" }),
    [config, group, results, data, groupId],
  );

  const rankBadge = (rank: number) => {
    const cls = rank === 1 ? "bg-v2-warning-bg text-v2-warning" : "text-v2-text-2";
    return <span className={`inline-flex size-6 items-center justify-center rounded-full text-v2-caption font-semibold tabular-nums ${cls}`}>{rank}</span>;
  };

  const nameCell = (r: SheetRow) => (
    <div className="flex min-w-0 items-center gap-2.5">
      <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-v2-surface-2 text-[11px] font-semibold text-v2-text-2" aria-hidden>
        {initialsOf(r.name)}
      </span>
      <span className="min-w-0">
        <button type="button" onClick={() => setPicked(r.pupilId)} className="block max-w-full truncate text-left font-semibold text-v2-text underline-offset-2 hover:underline focus-visible:outline-none focus-visible:shadow-v2-focus">
          {r.name}
        </button>
        {r.saved && r.saved.groupId !== groupId && (
          <span className="block truncate text-v2-caption font-normal text-v2-text-3">{t("{group} bilan saqlangan", { group: data?.groupLabels[r.saved.groupId] ?? `#${r.saved.groupId}` })}</span>
        )}
      </span>
    </div>
  );

  const certMark = (on: boolean) => (on ? <Award className="ml-1 inline size-3.5 align-[-2px] text-v2-brand-text" strokeWidth={1.75} aria-label={t("Sertifikat")} /> : null);

  let body: ReactNode;
  if (noTests) {
    body = (
      <UbEmptyState icon={<ClipboardList className="size-5" strokeWidth={1.75} aria-hidden />} title={t("Hali UzBMB testi yo'q")} text={t("Avval test yarating — nomi va sanasi bilan. Keyin har guruh natijasini kiritasiz.")}>
        <button type="button" onClick={onNewTest} className={primaryBtn}>
          <Plus className="size-4" strokeWidth={2} aria-hidden />
          {t("Yangi test")}
        </button>
      </UbEmptyState>
    );
  } else if (dataError) {
    body = (
      <UbEmptyState icon={<AlertTriangle className="size-5" strokeWidth={1.75} aria-hidden />} title={t(dataError)}>
        <button type="button" onClick={onRetryData} className={secondaryBtn}>
          <RefreshCw className="size-4" strokeWidth={1.75} aria-hidden />
          {t("Qayta urinish")}
        </button>
      </UbEmptyState>
    );
  } else if (tests === null || (test && groupId === null && dataLoading)) {
    // Testlar (yoki sukut guruhni aniqlaydigan natijalar) hali yuklanmoqda — skelet.
    body = <SkeletonRows />;
  } else if (!test || groupId === null) {
    body = <UbEmptyState icon={<Users className="size-5" strokeWidth={1.75} aria-hidden />} title={!test ? t("Testni tanlang") : t("Guruhni tanlang")} text={t("Natijalar guruh bo'yicha ko'rsatiladi — ro'yxatda natija kiritilgan guruhlar birinchi.")} />;
  } else if (ready && !anySaved) {
    body = (
      <UbEmptyState
        icon={<ClipboardList className="size-5" strokeWidth={1.75} aria-hidden />}
        title={t("Bu guruh natijasi hali kiritilmagan")}
        text={rows.length ? t("{n} ta o'quvchi — natijani kiriting yoki Excel'dan yuklang.", { n: rows.length }) : t("Guruhda o'quvchi yo'q")}
      >
        <button type="button" onClick={onEnter} className={primaryBtn}>
          <Pencil className="size-4" strokeWidth={1.75} aria-hidden />
          {t("Natija kiritish")}
        </button>
      </UbEmptyState>
    );
  } else {
    body = (
      <div className="relative overflow-x-auto overflow-y-hidden">
        <table className="w-full min-w-[720px] border-collapse text-v2-body">
          <thead>
            <tr className="bg-v2-surface-2 text-left text-v2-small text-v2-text-2 shadow-[inset_0_-1px_0_var(--v2-border)]">
              <th className="w-14 py-2.5 pl-4 pr-1 font-medium">{t("O'rin")}</th>
              <th className="px-3 py-2.5 font-medium">{t("O'quvchi")}</th>
              <th className="w-[92px] whitespace-nowrap px-3 py-2.5 font-medium">
                {t("1-blok")} <span className="font-normal text-v2-text-3">/{max ? fmtNum(max.b1, lang) : ""}</span>
              </th>
              <th className="w-[92px] whitespace-nowrap px-3 py-2.5 font-medium">
                {t("2-blok")} <span className="font-normal text-v2-text-3">/{max ? fmtNum(max.b2, lang) : ""}</span>
              </th>
              <th className="w-[104px] whitespace-nowrap px-3 py-2.5 font-medium">
                {t("Majburiy")} <span className="font-normal text-v2-text-3">/{max ? fmtNum(max.maj, lang) : ""}</span>
              </th>
              <th className="w-[168px] whitespace-nowrap px-3 py-2.5 font-semibold text-v2-text">
                {t("Jami")} <span className="font-normal text-v2-text-3">/{max ? fmtNum(max.total, lang) : ""}</span>
              </th>
              <th className="w-[112px] whitespace-nowrap py-2.5 pl-3 pr-4 text-right font-medium">{data?.prev ? t("№{no} testdan", { no: data.prev.no }) : t("O'sish")}</th>
            </tr>
          </thead>
          <tbody>
            {!ready &&
              (dataLoading || !members) &&
              Array.from({ length: 5 }, (_, i) => (
                <tr key={`sk${i}`} className="h-[49px] border-b border-v2-border" aria-hidden>
                  <td className="pl-4">
                    <div className="size-6 rounded-full bg-v2-skeleton" />
                  </td>
                  <td className="px-3">
                    <div className="h-3 w-40 rounded bg-v2-skeleton" />
                  </td>
                  {[0, 1, 2].map((k) => (
                    <td key={k} className="px-3">
                      <div className="h-3 w-10 rounded bg-v2-skeleton" />
                    </td>
                  ))}
                  <td className="px-3">
                    <div className="h-3 w-24 rounded bg-v2-skeleton" />
                  </td>
                  <td />
                </tr>
              ))}
            {ordered.done.map((r) => {
              const s = r.saved!;
              const rank = rankOf(s.total, ordered.totals);
              const p = prevBy.get(r.pupilId);
              const delta = p === undefined ? null : s.total - p;
              return (
                <tr key={r.pupilId} onClick={() => setPicked(r.pupilId)} className={`cursor-pointer border-b border-v2-border ${picked === r.pupilId ? ROW_TINT.brand : ROW_TINT.hover}`}>
                  <td className="py-2.5 pl-4 pr-1">{rankBadge(rank)}</td>
                  <td className="px-3 py-2">{nameCell(r)}</td>
                  <td className="whitespace-nowrap px-3 py-2.5 tabular-nums text-v2-text">
                    {fmtBall(s.b1, lang)}
                    {certMark(s.b1cert)}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2.5 tabular-nums text-v2-text">
                    {fmtBall(s.b2, lang)}
                    {certMark(s.b2cert)}
                  </td>
                  <td className="px-3 py-2.5 tabular-nums text-v2-text">{fmtBall(s.maj, lang)}</td>
                  <td className="px-3 py-2.5">
                    <span className="flex items-center gap-3">
                      <span className="w-12 font-semibold tabular-nums text-v2-text">{fmtBall(s.total, lang)}</span>
                      <span className="block h-1.5 w-[84px] overflow-hidden rounded-v2-full bg-v2-hover" aria-hidden>
                        <span className="block h-full rounded-v2-full bg-v2-series-1" style={{ width: `${max ? Math.min(100, (s.total / max.total) * 100) : 0}%` }} />
                      </span>
                    </span>
                  </td>
                  <td className="py-2.5 pl-3 pr-4 text-right text-v2-small tabular-nums">
                    {delta === null ? (
                      <span className="text-v2-text-3">—</span>
                    ) : (
                      <span className={`inline-flex items-center gap-1 font-semibold ${delta > 0.04 ? "text-v2-success" : delta < -0.04 ? "text-v2-danger" : "text-v2-text-2"}`}>
                        {delta > 0.04 ? <ArrowUp className="size-3.5" strokeWidth={2} aria-hidden /> : delta < -0.04 ? <ArrowDown className="size-3.5" strokeWidth={2} aria-hidden /> : null}
                        {fmtDelta(delta, lang)}
                      </span>
                    )}
                  </td>
                </tr>
              );
            })}
            {ordered.rest.map((r) => (
              <tr key={r.pupilId} onClick={() => setPicked(r.pupilId)} className={`cursor-pointer border-b border-v2-border last:border-b-0 ${picked === r.pupilId ? ROW_TINT.brand : ROW_TINT.hover}`}>
                <td className="py-2.5 pl-4 pr-1 text-v2-small text-v2-text-3">
                  <span className="inline-flex size-6 items-center justify-center">—</span>
                </td>
                <td className="px-3 py-2">{nameCell(r)}</td>
                <td colSpan={5} className="whitespace-nowrap px-3 py-2.5 text-v2-small text-v2-text-3">
                  {r.saved ? t("natija to'liq kiritilmagan") : t("natija kiritilmagan")}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <ImtihonHeader
        tab="uzbmb"
        crumbs={[{ label: "UzBMB" }, { label: t("Natijalar") }]}
        actions={
          <>
            <button type="button" onClick={() => setImportOpen(true)} disabled={!ready} title={!ready ? t("Avval test va guruhni tanlang") : undefined} className={`${secondaryBtn} disabled:cursor-not-allowed disabled:opacity-50`}>
              <FileUp className="size-4" strokeWidth={1.75} aria-hidden />
              {t("Excel'dan yuklash")}
            </button>
            {exportNode}
          </>
        }
      />

      <div className="flex flex-wrap items-end gap-3">
        <div className="w-full min-w-0 min-[40rem]:w-[22rem]">
          <FilterLabel>{t("Test")}</FilterLabel>
          <TestPicker tests={tests ?? []} value={test?.id ?? null} onChange={(id) => {
              setPicked(null);
              onChangeTest(id);
            }} withDate loading={tests === null} onNew={onNewTest} onEdit={onEditTest} />
        </div>
        <div className="w-full min-w-0 min-[40rem]:w-[22rem]">
          <FilterLabel>{t("Guruh")}</FilterLabel>
          <GroupPicker groups={groups} value={groupId} onChange={(id) => {
              setPicked(null);
              onChangeGroup(id);
            }} counts={groupCounts} loading={groupsLoading} />
        </div>
        <div className="flex-1" />
        <button type="button" onClick={onEnter} disabled={!test} className={`${secondaryBtn} disabled:cursor-not-allowed disabled:opacity-50`}>
          <Pencil className="size-4" strokeWidth={1.75} aria-hidden />
          {t("Natija kiritish")}
        </button>
      </div>

      <div className={`grid items-start gap-4 ${noTests ? "" : "min-[64rem]:grid-cols-[minmax(0,1fr)_300px]"}`}>
        <div className="flex min-w-0 flex-col gap-2">
          <section className="min-w-0 overflow-hidden rounded-v2-lg border border-v2-border bg-v2-surface shadow-v2-sm" aria-label={t("Natijalar")}>
            {body}
          </section>
          {legacyCount > 0 && (
            <Link href="/imtihon?tab=uzbmb&eski=1" className="self-start text-v2-caption text-v2-text-3 underline-offset-2 hover:text-v2-text hover:underline">
              {t("Testga bog'lanmagan eski natijalar: {n} ta — eski ko'rinishda", { n: legacyCount })}
            </Link>
          )}
        </div>
        {!noTests && <UbSideCard data={data} test={test} rows={rows} picked={pickedRow} onBack={() => setPicked(null)} />}
      </div>

      {importOpen && test && groupId !== null && (
        <UbImportDialog
          title={`${test.name} · ${groupLabel}`}
          scheme={test.scheme}
          dir={importDir}
          rows={rows}
          onClose={() => setImportOpen(false)}
          onApply={(cells) => onImported(cells)}
        />
      )}
    </div>
  );
}
