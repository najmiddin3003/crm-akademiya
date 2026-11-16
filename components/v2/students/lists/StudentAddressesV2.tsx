"use client";

import { useMemo, useState } from "react";
import { ArrowRight, Download, MapPin, MoreHorizontal, Plus, UserRound } from "lucide-react";
import Link from "@/components/ui/Link";
import { useT } from "@/components/shared/Language";
import { useBranch } from "@/components/shared/BranchContext";
import ActionMenu, { type ActionMenuEntry } from "@/components/v2/ui/ActionMenu";
import ColumnsControl from "@/components/v2/ui/ColumnsControl";
import V2Checkbox from "@/components/v2/ui/V2Checkbox";
import V2Select from "@/components/v2/ui/V2Select";
import { secondaryBtn } from "@/components/v2/ui/buttons";
import { useColumnPrefs, type ColumnDef } from "@/components/v2/ui/columnPrefs";
import { ROW_TINT } from "@/components/v2/ui/table";
import type { StudentListRow } from "@/lib/studentListsTypes";
import AddressDialogV2 from "./AddressDialogV2";
import {
  B,
  EmptyRow,
  PageHead,
  PageShell,
  PersonCell,
  SearchBox,
  SimplePager,
  SkeletonRows,
  SortHead,
  TableCard,
  TH,
  downloadCsv,
  fmtPhone,
  matchQuery,
} from "./listKit";
import { useStudentLists } from "./useStudentLists";

// YANGI VERSIYA — O'QUVCHILAR → O'QUVCHILAR MANZILLARI (30-qism, rasm, yorug'/qorong'i).
//
// «Qaysi mahalladan kelishadi — flyer va reklama joyini tanlash uchun». Mahalla, mo'ljal va yashash
// turi (Doimiy / Ijara) — o'quvchi kartasining yangi maydonlari (`mahalla`, `addressLandmark`,
// `housing`; PATCH /api/pupils/:id); manzil matni — avvalgi «Uy manzili» (`address`), bo'lmasa
// «Manzil» tabidagi birinchisi. Arxivdagilar kirmaydi. Rasmdagi «Chortoqdan tashqaridan» kartasi —
// shahar/tuman maydoni yo'q (SAVOLLAR 416): o'rniga «Mahallasi kiritilmagan». Eski sahifa — `?classic=1`.

type ColKey = "student" | "mahalla" | "address" | "landmark" | "housing" | "source";
type SortKey = "name" | "mahalla";

const COLUMNS: ColumnDef<ColKey>[] = [
  { key: "student", label: "O'quvchi", on: true, locked: true },
  { key: "mahalla", label: "Mahalla", on: true },
  { key: "address", label: "Manzil", on: true },
  { key: "landmark", label: "Mo'ljal", on: true },
  { key: "housing", label: "Turi", on: true },
  { key: "source", label: "Manba", on: true },
];

const TOP = 5;

export default function StudentAddressesV2() {
  const { t } = useT();
  const branch = useBranch();
  const { rows: all, loading, reload } = useStudentLists();
  const columns = useColumnPrefs("v2:student-addresses:columns:1", COLUMNS);

  const [q, setQ] = useState("");
  const [mahalla, setMahalla] = useState("");
  const [source, setSource] = useState("");
  const [sort, setSort] = useState<{ key: SortKey; dir: "asc" | "desc" }>({ key: "name", dir: "asc" });
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [editFor, setEditFor] = useState<StudentListRow | null>(null);

  const rows = useMemo(() => all.filter((r) => r.status !== "Arxiv"), [all]);
  const byMahalla = useMemo(() => {
    const m = new Map<string, number>();
    for (const r of rows) if (r.mahalla) m.set(r.mahalla, (m.get(r.mahalla) ?? 0) + 1);
    return [...m.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "uz"));
  }, [rows]);
  const withAddress = rows.filter((r) => r.mahalla || r.address).length;
  const noMahalla = rows.filter((r) => !r.mahalla).length;
  const renting = rows.filter((r) => r.housing === "Ijara").length;
  const top = byMahalla.slice(0, TOP);
  const rest = byMahalla.slice(TOP);
  const restCount = rest.reduce((s, [, n]) => s + n, 0);
  const max = top[0]?.[1] ?? 1;

  const sourceOptions = useMemo(() => [...new Set(rows.map((r) => r.source).filter(Boolean))].sort().map((v) => ({ value: v, label: t(v) })), [rows, t]);
  const filtered = useMemo(() => {
    const list = rows.filter((r) => {
      if (!matchQuery(q, r.name, r.phone, r.address, r.landmark, r.mahalla)) return false;
      if (mahalla === "__none" ? Boolean(r.mahalla) : mahalla && r.mahalla !== mahalla) return false;
      if (source && r.source !== source) return false;
      return true;
    });
    const sign = sort.dir === "asc" ? 1 : -1;
    return [...list].sort((a, b) => {
      const c = sort.key === "mahalla" ? (a.mahalla || "￿").localeCompare(b.mahalla || "￿", "uz") : a.name.localeCompare(b.name, "uz");
      return c !== 0 ? c * sign : a.id - b.id;
    });
  }, [rows, q, mahalla, source, sort]);

  const slice = filtered.slice((page - 1) * pageSize, page * pageSize);
  const pageIds = slice.map((r) => r.id);
  const pageSelected = pageIds.filter((id) => selected.has(id)).length;
  const branchName = branch.branches.find((b) => b.id === branch.branchId)?.name ?? "";
  const colCount = columns.shown.length + 3;
  const pct = (n: number) => (rows.length ? Math.round((n / rows.length) * 100) : 0);

  const onSort = (k: SortKey) => {
    setSort((s) => (s.key === k ? { key: k, dir: s.dir === "asc" ? "desc" : "asc" } : { key: k, dir: "asc" }));
    setPage(1);
  };
  const toggle = (id: number, on: boolean) =>
    setSelected((prev) => {
      const n = new Set(prev);
      if (on) n.add(id);
      else n.delete(id);
      return n;
    });

  function cell(r: StudentListRow, k: ColKey) {
    switch (k) {
      case "student":
        return null;
      case "mahalla":
        return r.mahalla ? <span className="font-semibold text-v2-text">{r.mahalla}</span> : <span className="text-v2-text-3">{t("Kiritilmagan")}</span>;
      case "address":
        return r.address ? (
          <span className="block max-w-[260px] truncate text-v2-text" title={r.address}>{r.address}</span>
        ) : (
          <button type="button" onClick={() => setEditFor(r)} className="inline-flex items-center gap-1 font-semibold text-v2-brand-text hover:underline">
            <Plus className="size-3.5" strokeWidth={2} aria-hidden />
            {t("Manzil qo'shish")}
          </button>
        );
      case "landmark":
        return r.landmark ? <span className="block max-w-[200px] truncate text-v2-text" title={r.landmark}>{r.landmark}</span> : <span className="text-v2-text-3">—</span>;
      case "housing":
        return r.housing ? <span className="text-v2-text">{t(r.housing)}</span> : <span className="text-v2-text-3">—</span>;
      case "source":
        return r.source ? <span className="text-v2-text">{t(r.source)}</span> : <span className="text-v2-text-3">—</span>;
    }
  }

  const head: Record<ColKey, React.ReactNode> = {
    student: null,
    mahalla: <SortHead label={t("Mahalla")} k="mahalla" sort={sort} onSort={onSort} />,
    address: t("Manzil"),
    landmark: t("Mo'ljal"),
    housing: t("Turi"),
    source: t("Manba"),
  };

  function rowMenu(r: StudentListRow): ActionMenuEntry[] {
    return [
      { key: "h", heading: r.name },
      { key: "edit", label: r.address || r.mahalla ? t("Manzilni tahrirlash") : t("Manzil qo'shish"), icon: MapPin, onSelect: () => setEditFor(r) },
      { key: "open", label: t("Profilni ochish"), icon: UserRound, href: `/student-edit/${r.id}` },
    ];
  }

  function exportCsv() {
    const list = selected.size ? filtered.filter((r) => selected.has(r.id)) : filtered;
    downloadCsv(
      "oquvchilar-manzillari.csv",
      ["ID", "O'quvchi", "Telefon", "Mahalla", "Manzil", "Mo'ljal", "Turi", "Manba"],
      list.map((r) => [r.id, r.name, fmtPhone(r.phone), r.mahalla, r.address, r.landmark, r.housing, r.source]),
    );
  }

  const statCard = "flex flex-1 flex-col justify-center gap-0.5 px-4 py-3";

  return (
    <PageShell>
      <PageHead
        title={t("O'quvchilar manzillari")}
        subtitle={[branchName, t("qaysi mahalladan kelishadi — flyer va reklama joyini tanlash uchun")].filter(Boolean).join(" · ")}
        actions={
          <button type="button" onClick={exportCsv} className={secondaryBtn}>
            <Download className="size-4" strokeWidth={1.75} aria-hidden />
            {t("Export")}
          </button>
        }
      />

      <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_300px]">
        <section className="rounded-v2-lg border border-v2-border bg-v2-surface p-4 shadow-v2-sm">
          <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="text-v2-section text-v2-text">{t("Mahallalar bo'yicha")}</h2>
            <span className="text-v2-small text-v2-text-3">{t("{n} ta o'quvchi · eng ko'p {k} ta mahalla", { n: rows.length, k: top.length })}</span>
          </div>
          {loading ? (
            <div className="space-y-2.5" aria-hidden>
              {Array.from({ length: 5 }, (_, i) => <div key={i} className="h-3 rounded bg-v2-skeleton" style={{ width: `${90 - i * 12}%` }} />)}
            </div>
          ) : top.length === 0 ? (
            <p className="py-4 text-v2-small text-v2-text-3">{t("Hali birorta o'quvchiga mahalla kiritilmagan. Jadvaldagi «Manzil qo'shish» bilan boshlang.")}</p>
          ) : (
            <ul className="space-y-2">
              {top.map(([name, n]) => (
                <li key={name} className="grid grid-cols-[96px_minmax(0,1fr)_72px] items-center gap-3 text-v2-small">
                  <button type="button" onClick={() => { setMahalla(name); setPage(1); }} className="truncate text-left text-v2-text hover:text-v2-brand-text" title={name}>
                    {name}
                  </button>
                  <span className="h-2 overflow-hidden rounded-v2-full bg-v2-surface-2">
                    <span className="block h-full rounded-v2-full bg-v2-brand" style={{ width: `${Math.max(4, (n / max) * 100)}%` }} />
                  </span>
                  <span className="text-right tabular-nums text-v2-text-2">
                    <b className="font-semibold text-v2-text">{n}</b> · {pct(n)}%
                  </span>
                </li>
              ))}
            </ul>
          )}
          <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1 border-t border-v2-border pt-2.5 text-v2-small text-v2-text-2">
            {rest.length > 0 && (
              <span>{t("Yana {n} ta mahalla", { n: rest.length })} — <B>{restCount}</B></span>
            )}
            <span>{t("Mahalla kiritilmagan")} — <B>{noMahalla}</B></span>
          </div>
        </section>

        <section className="flex flex-col divide-y divide-v2-border overflow-hidden rounded-v2-lg border border-v2-border bg-v2-surface shadow-v2-sm">
          <div className={statCard}>
            <span className="text-v2-small text-v2-text-2">{t("Manzil kiritilgan")}</span>
            <span className="text-v2-number tabular-nums text-v2-text">
              {withAddress} <span className="text-v2-body font-normal text-v2-text-3">/ {rows.length}</span>
            </span>
          </div>
          <div className={statCard}>
            <span className="text-v2-small text-v2-text-2">{t("Ijara uyda yashaydi")}</span>
            <span className="text-v2-number tabular-nums text-v2-text">{renting}</span>
          </div>
          <div className={statCard}>
            <span className="text-v2-small text-v2-text-2">{t("Mahallasi noma'lum")}</span>
            <span className="flex items-end justify-between gap-3">
              <span className="text-v2-number tabular-nums text-v2-text">{noMahalla}</span>
              <Link href="/sales-marketing" className="inline-flex shrink-0 items-center gap-1 whitespace-nowrap pb-1 text-v2-small font-semibold text-v2-brand-text hover:underline">
                {t("Reklama natijasi")}
                <ArrowRight className="size-3.5" strokeWidth={2} aria-hidden />
              </Link>
            </span>
          </div>
        </section>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <SearchBox value={q} onChange={(v) => { setQ(v); setPage(1); }} placeholder={t("Ism, ko'cha yoki mo'ljal")} />
        <V2Select
          variant="chip"
          label={t("Mahalla")}
          value={mahalla}
          onChange={(v) => { setMahalla(v); setPage(1); }}
          options={[...byMahalla.map(([m, n]) => ({ value: m, label: m, hint: String(n) })), { value: "__none", label: t("Kiritilmagan"), hint: String(noMahalla) }]}
        />
        <V2Select variant="chip" label={t("Manba")} value={source} onChange={(v) => { setSource(v); setPage(1); }} options={sourceOptions} />
        <div className="ml-auto">
          <ColumnsControl prefs={columns} />
        </div>
      </div>

      <TableCard footer={<SimplePager total={filtered.length} page={page} pageSize={pageSize} onPage={setPage} onPageSize={(n) => { setPageSize(n); setPage(1); }} />}>
        <thead>
          <tr>
            <th className={`${TH} w-10 pl-4 pr-2`}>
              <V2Checkbox
                checked={pageIds.length > 0 && pageSelected === pageIds.length}
                indeterminate={pageSelected > 0 && pageSelected < pageIds.length}
                onChange={(on) => pageIds.forEach((id) => toggle(id, on))}
                label={t("Sahifadagilarni belgilash")}
              />
            </th>
            <th className={TH}><SortHead label={t("O'quvchi")} k="name" sort={sort} onSort={onSort} /></th>
            {columns.shown.map((c) => (
              <th key={c.key} className={TH}>{head[c.key]}</th>
            ))}
            <th className={`${TH} w-px`}><span className="sr-only">{t("Amallar")}</span></th>
          </tr>
        </thead>
        <tbody>
          {loading && <SkeletonRows cols={colCount} />}
          {!loading && slice.length === 0 && (
            <EmptyRow cols={colCount} title={rows.length === 0 ? t("Hozircha o'quvchi yo'q") : t("Mos o'quvchi topilmadi")} hint={rows.length ? t("Qidiruv yoki filtrlarni o'zgartirib ko'ring.") : undefined} />
          )}
          {!loading &&
            slice.map((r) => {
              const on = selected.has(r.id);
              const missing = !r.mahalla && !r.address;
              return (
                <tr key={r.id} className={`group border-b border-v2-border last:border-b-0 ${on ? ROW_TINT.brand : missing ? "bg-v2-surface-2" : ""} ${on ? "" : ROW_TINT.hover}`}>
                  <td className="py-2.5 pl-4 pr-2"><V2Checkbox checked={on} onChange={(v) => toggle(r.id, v)} label={t("{name} — belgilash", { name: r.name })} /></td>
                  <td className="px-2.5 py-2.5"><PersonCell id={r.id} name={r.name} sub={fmtPhone(r.phone) || "—"} /></td>
                  {columns.shown.map((c) => (
                    <td key={c.key} className="px-2.5 py-2.5">{cell(r, c.key)}</td>
                  ))}
                  <td className="py-2.5 pl-1 pr-3 text-right">
                    <ActionMenu items={rowMenu(r)} label={t("{name} — amallar", { name: r.name })}>
                      {(trigger) => (
                        <button type="button" {...trigger} aria-label={t("{name} — amallar", { name: r.name })} className="inline-flex size-8 items-center justify-center rounded-v2-md text-v2-text-2 hover:bg-v2-surface-2 hover:text-v2-text">
                          <MoreHorizontal className="size-4" strokeWidth={1.75} />
                        </button>
                      )}
                    </ActionMenu>
                  </td>
                </tr>
              );
            })}
        </tbody>
      </TableCard>

      {editFor && (
        <AddressDialogV2
          row={editFor}
          mahallas={byMahalla.map(([m]) => m)}
          onClose={() => setEditFor(null)}
          onSaved={() => void reload()}
        />
      )}
    </PageShell>
  );
}
