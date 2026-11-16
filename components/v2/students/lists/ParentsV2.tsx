"use client";

import { useMemo, useState } from "react";
import { Download, MessageSquare, MoreHorizontal, Phone, Send, UserRound } from "lucide-react";
import Link from "@/components/ui/Link";
import { useT } from "@/components/shared/Language";
import { useBranch } from "@/components/shared/BranchContext";
import { useToast } from "@/components/ui/Toast";
import ActionMenu, { type ActionMenuEntry } from "@/components/v2/ui/ActionMenu";
import ColumnsControl from "@/components/v2/ui/ColumnsControl";
import V2Checkbox from "@/components/v2/ui/V2Checkbox";
import V2Select from "@/components/v2/ui/V2Select";
import { primaryBtn, secondaryBtn, secondaryIcon } from "@/components/v2/ui/buttons";
import { useColumnPrefs, type ColumnDef } from "@/components/v2/ui/columnPrefs";
import { FAN_DOT, fanOf } from "@/components/v2/ui/fan";
import { ROW_TINT } from "@/components/v2/ui/table";
import { parentsOf, type CabinetState, type ParentRow } from "@/lib/studentListsTypes";
import BulkSmsDialogV2, { type SmsRecipient } from "./BulkSmsDialogV2";
import {
  B,
  CabinetBadge,
  EmptyRow,
  PageHead,
  PageShell,
  PersonCell,
  SearchBox,
  SegmentPills,
  SimplePager,
  SkeletonRows,
  SortHead,
  SummaryLine,
  TableCard,
  TH,
  downloadCsv,
  fmtNum,
  fmtPhone,
  matchQuery,
  todayIso,
  useStudentLists,
} from "./listKit";

// YANGI VERSIYA — O'QUVCHILAR → OTA-ONA (30-qism, rasm «Ota-ona», yorug'/qorong'i).
//
// Qatorlar — o'quvchi kartasidagi ota va ona maydonlaridan (lib/studentListsTypes.ts → parentsOf):
// bir xil telefon — bitta odam, farzandlari birga. Kabinet — o'quvchilar boti: ota-ona sifatida
// bog'langan («Kirgan · sana»), SMS taklif yuborilgan («Taklif · sana»), hech biri («Kirmagan»).
// «Kabinetga taklif» — kirmaganlarga SMS (bot havolasi bilan); yuborilgach farzand kartasiga
// `parentInvitedAt` yoziladi. Umumiy balans — farzandlari balansining yig'indisi. Eski sahifa — `?classic=1`.

type Seg = "all" | CabinetState;
type ColKey = "parent" | "role" | "children" | "work" | "balance" | "cabinet";
type SortKey = "name" | "balance";

const COLUMNS: ColumnDef<ColKey>[] = [
  { key: "parent", label: "Ota-ona", on: true, locked: true },
  { key: "role", label: "Kim", on: true },
  { key: "children", label: "Farzandlari", on: true },
  { key: "work", label: "Ish joyi", on: true },
  { key: "balance", label: "Umumiy balans", on: true, align: "right" },
  { key: "cabinet", label: "Kabinet", on: true },
];

const SLACK = 1000;
const balanceOf = (p: ParentRow) => (Math.abs(p.balance) < SLACK ? 0 : Math.round(p.balance));

export default function ParentsV2() {
  const { t } = useT();
  const branch = useBranch();
  const { showSuccess, showError } = useToast();
  const { rows: students, loading, botLink, reload } = useStudentLists();
  const columns = useColumnPrefs("v2:parents:columns:1", COLUMNS);

  const [seg, setSeg] = useState<Seg>("all");
  const [q, setQ] = useState("");
  const [role, setRole] = useState("");
  const [bal, setBal] = useState("");
  const [sort, setSort] = useState<{ key: SortKey; dir: "asc" | "desc" }>({ key: "name", dir: "asc" });
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [inviteFor, setInviteFor] = useState<ParentRow[] | null>(null);
  const [smsFor, setSmsFor] = useState<ParentRow[] | null>(null);

  const parents = useMemo(() => parentsOf(students), [students]);
  const base = useMemo(
    () =>
      parents.filter((p) => {
        if (!matchQuery(q, p.name, p.phone, ...p.children.map((c) => c.name))) return false;
        if (role && p.role !== role) return false;
        const b = balanceOf(p);
        if (bal === "debt" && !(b < 0)) return false;
        if (bal === "credit" && !(b > 0)) return false;
        if (bal === "zero" && b !== 0) return false;
        return true;
      }),
    [parents, q, role, bal],
  );
  const counts = useMemo(
    () => ({
      all: base.length,
      in: base.filter((p) => p.cabinet === "in").length,
      invited: base.filter((p) => p.cabinet === "invited").length,
      none: base.filter((p) => p.cabinet === "none").length,
    }),
    [base],
  );
  const filtered = useMemo(() => {
    const list = seg === "all" ? base : base.filter((p) => p.cabinet === seg);
    const sign = sort.dir === "asc" ? 1 : -1;
    return [...list].sort((a, b) => {
      const c = sort.key === "balance" ? balanceOf(a) - balanceOf(b) : a.name.localeCompare(b.name, "uz");
      return c !== 0 ? c * sign : a.key.localeCompare(b.key);
    });
  }, [base, seg, sort]);

  const childCount = new Set(filtered.flatMap((p) => p.children.map((c) => c.id))).size;
  const bigFamilies = filtered.filter((p) => p.children.length >= 2).length;
  const toInvite = parents.filter((p) => p.cabinet === "none" && p.phone.replace(/\D/g, "").length >= 9);
  const slice = filtered.slice((page - 1) * pageSize, page * pageSize);
  const pageKeys = slice.map((p) => p.key);
  const pageSelected = pageKeys.filter((k) => selected.has(k)).length;
  const branchName = branch.branches.find((b) => b.id === branch.branchId)?.name ?? "";
  const colCount = columns.shown.length + 3;

  const onSort = (k: SortKey) => {
    setSort((s) => (s.key === k ? { key: k, dir: s.dir === "asc" ? "desc" : "asc" } : { key: k, dir: k === "name" ? "asc" : "desc" }));
    setPage(1);
  };
  const toggle = (k: string, on: boolean) =>
    setSelected((prev) => {
      const n = new Set(prev);
      if (on) n.add(k);
      else n.delete(k);
      return n;
    });

  const recipientsOf = (list: ParentRow[]): SmsRecipient[] =>
    list.map((p) => ({
      key: p.key,
      label: `${p.name} — ${p.children.map((c) => c.name).join(", ")}`,
      phone: p.phone,
      values: { name: p.children.map((c) => c.name.split(" ")[0]).join(", "), link: botLink },
    }));

  async function markInvited(keys: string[]) {
    const today = todayIso();
    const ids = new Set(parents.filter((p) => keys.includes(p.key)).flatMap((p) => p.children.map((c) => c.id)));
    await Promise.all(
      [...ids].map((id) =>
        fetch(`/api/pupils/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ parentInvitedAt: today }) }).catch(() => null),
      ),
    );
  }

  function cell(p: ParentRow, k: ColKey) {
    switch (k) {
      case "parent":
        return null;
      case "role":
        return <span className="text-v2-text">{t(p.role)}</span>;
      case "children":
        return (
          <div className="min-w-[170px] space-y-1">
            {p.children.map((c) => {
              const g = c.groups[0] ?? c.lastGroup;
              return (
                <div key={c.id}>
                  <span className="flex items-center gap-1.5">
                    <span className={`size-2 shrink-0 rounded-full ${FAN_DOT[fanOf(g?.course)]}`} aria-hidden />
                    <Link href={`/student-edit/${c.id}`} className="truncate font-semibold text-v2-text hover:text-v2-brand-text hover:underline">{c.name}</Link>
                  </span>
                  <span className="block truncate pl-3.5 text-v2-small text-v2-text-3">
                    {c.groups.length > 1
                      ? t("{n} guruh: {list}", { n: c.groups.length, list: c.groups.map((x) => x.course).join(", ") })
                      : g
                        ? [g.course, g.level].filter(Boolean).join(" · ")
                        : t("guruhsiz")}
                  </span>
                </div>
              );
            })}
          </div>
        );
      case "work":
        return p.work ? <span className="text-v2-text">{p.work}</span> : <span className="text-v2-text-3">—</span>;
      case "balance": {
        const b = balanceOf(p);
        return (
          <span className={`whitespace-nowrap tabular-nums ${b < 0 ? "font-semibold text-v2-danger" : b > 0 ? "font-semibold text-v2-success" : "text-v2-text"}`}>
            {b > 0 ? "+" : ""}
            {fmtNum(b)} {t("so'm")}
          </span>
        );
      }
      case "cabinet":
        return <CabinetBadge row={p} withDate />;
    }
  }

  const head: Record<ColKey, React.ReactNode> = {
    parent: null,
    role: t("Kim"),
    children: t("Farzandlari"),
    work: t("Ish joyi"),
    balance: <SortHead label={t("Umumiy balans")} k="balance" sort={sort} onSort={onSort} align="right" />,
    cabinet: t("Kabinet"),
  };

  function rowMenu(p: ParentRow): ActionMenuEntry[] {
    return [
      { key: "h", heading: p.name },
      ...p.children.map((c) => ({ key: `c${c.id}`, label: t("{name} — profil", { name: c.name }), icon: UserRound, href: `/student-edit/${c.id}` })),
      { key: "d", divider: true },
      {
        key: "inv",
        label: t("Kabinetga taklif yuborish"),
        icon: Send,
        disabled: p.cabinet === "in" || p.phone.replace(/\D/g, "").length < 9,
        title: p.cabinet === "in" ? t("Kabinetga kirgan") : undefined,
        onSelect: () => setInviteFor([p]),
      },
    ];
  }

  function exportCsv() {
    const list = selected.size ? filtered.filter((p) => selected.has(p.key)) : filtered;
    downloadCsv(
      "ota-onalar.csv",
      ["Ota-ona", "Telefon", "Kim", "Farzandlari", "Ish joyi", "Umumiy balans", "Kabinet"],
      list.map((p) => [
        p.name,
        fmtPhone(p.phone),
        p.role,
        p.children.map((c) => c.name).join("; "),
        p.work,
        balanceOf(p),
        p.cabinet === "in" ? `Kirgan ${p.cabinetAt ?? ""}` : p.cabinet === "invited" ? `Taklif ${p.cabinetAt ?? ""}` : "Kirmagan",
      ]),
    );
  }

  return (
    <PageShell>
      <PageHead
        title={t("Ota-ona")}
        subtitle={[branchName, t("o'quvchi kartasidagi ota-onalar — kabinetga shu telefon bilan kiradi")].filter(Boolean).join(" · ")}
        actions={
          <>
            <button type="button" onClick={exportCsv} className={secondaryBtn}>
              <Download className="size-4" strokeWidth={1.75} aria-hidden />
              {t("Export")}
            </button>
            <button
              type="button"
              disabled={toInvite.length === 0}
              title={toInvite.length === 0 ? t("Taklif yuboriladigan ota-ona yo'q") : undefined}
              onClick={() => setInviteFor(selected.size ? parents.filter((p) => selected.has(p.key) && p.cabinet !== "in") : toInvite)}
              className={`${primaryBtn} disabled:opacity-50`}
            >
              <Send className="size-4" strokeWidth={2} aria-hidden />
              {t("Kabinetga taklif · {n}", { n: selected.size ? parents.filter((p) => selected.has(p.key) && p.cabinet !== "in").length : toInvite.length })}
            </button>
          </>
        }
      />

      <SegmentPills
        value={seg}
        onChange={(k) => { setSeg(k); setPage(1); }}
        items={[
          { key: "all", label: t("Hammasi"), count: counts.all },
          { key: "in", label: t("Kabinetga kirgan"), count: counts.in },
          { key: "invited", label: t("Taklif yuborilgan"), count: counts.invited },
          { key: "none", label: t("Kirmagan"), count: counts.none },
        ]}
      />

      <div className="flex flex-wrap items-center gap-2">
        <SearchBox value={q} onChange={(v) => { setQ(v); setPage(1); }} placeholder={t("Ota-ona yoki farzand ismi, telefon")} width={280} />
        <V2Select variant="chip" label={t("Qarindoshligi")} value={role} onChange={(v) => { setRole(v); setPage(1); }} searchable={false} options={[{ value: "Ota", label: t("Ota") }, { value: "Ona", label: t("Ona") }]} />
        <V2Select
          variant="chip"
          label={t("Balans")}
          value={bal}
          onChange={(v) => { setBal(v); setPage(1); }}
          searchable={false}
          options={[
            { value: "debt", label: t("Qarzdor") },
            { value: "credit", label: t("Haqdor") },
            { value: "zero", label: t("0 so'm") },
          ]}
        />
        <div className="ml-auto">
          <ColumnsControl prefs={columns} />
        </div>
      </div>

      <SummaryLine
        items={[
          <span key="p"><B>{filtered.length}</B> {t("ta ota-ona")}</span>,
          <span key="c"><B>{childCount}</B> {t("ta farzand")}</span>,
          <span key="f"><B>{bigFamilies}</B> {t("oilada 2 va undan ko'p farzand")}</span>,
          selected.size > 0 && <span key="s" className="text-v2-brand-text">{t("{n} ta belgilandi", { n: selected.size })}</span>,
        ]}
      />

      <TableCard footer={<SimplePager total={filtered.length} page={page} pageSize={pageSize} onPage={setPage} onPageSize={(n) => { setPageSize(n); setPage(1); }} />}>
        <thead>
          <tr>
            <th className={`${TH} w-10 pl-4 pr-2`}>
              <V2Checkbox
                checked={pageKeys.length > 0 && pageSelected === pageKeys.length}
                indeterminate={pageSelected > 0 && pageSelected < pageKeys.length}
                onChange={(on) => pageKeys.forEach((k) => toggle(k, on))}
                label={t("Sahifadagilarni belgilash")}
              />
            </th>
            <th className={TH}><SortHead label={t("Ota-ona")} k="name" sort={sort} onSort={onSort} /></th>
            {columns.shown.map((c) => (
              <th key={c.key} className={`${TH} ${c.align === "right" ? "text-right" : ""}`}>{head[c.key]}</th>
            ))}
            <th className={`${TH} w-px`}><span className="sr-only">{t("Amallar")}</span></th>
          </tr>
        </thead>
        <tbody>
          {loading && <SkeletonRows cols={colCount} />}
          {!loading && slice.length === 0 && (
            <EmptyRow
              cols={colCount}
              title={parents.length === 0 ? t("Ota-ona ma'lumoti kiritilmagan") : t("Mos ota-ona topilmadi")}
              hint={parents.length === 0 ? t("O'quvchi kartasida otasi yoki onasining ismi va telefoni kiritilsa, shu yerda chiqadi.") : t("Qidiruv yoki filtrlarni o'zgartirib ko'ring.")}
            />
          )}
          {!loading &&
            slice.map((p) => {
              const on = selected.has(p.key);
              const hasPhone = p.phone.replace(/\D/g, "").length >= 9;
              return (
                <tr key={p.key} className={`group border-b border-v2-border last:border-b-0 ${on ? ROW_TINT.brand : ROW_TINT.hover}`}>
                  <td className="py-2.5 pl-4 pr-2"><V2Checkbox checked={on} onChange={(v) => toggle(p.key, v)} label={t("{name} — belgilash", { name: p.name })} /></td>
                  <td className="px-2.5 py-2.5"><PersonCell name={p.name} sub={fmtPhone(p.phone) || "—"} /></td>
                  {columns.shown.map((c) => (
                    <td key={c.key} className={`px-2.5 py-2.5 ${c.align === "right" ? "text-right" : ""}`}>{cell(p, c.key)}</td>
                  ))}
                  <td className="py-2.5 pl-1 pr-3">
                    <div className="flex items-center justify-end gap-1.5">
                      {hasPhone ? (
                        <a href={`tel:+998${p.phone.replace(/\D/g, "").slice(-9)}`} title={t("Qo'ng'iroq")} aria-label={t("{name} — qo'ng'iroq", { name: p.name })} className={`${secondaryIcon} size-8! h-8!`}>
                          <Phone className="size-4" strokeWidth={1.75} />
                        </a>
                      ) : null}
                      <button type="button" disabled={!hasPhone} onClick={() => setSmsFor([p])} title={t("SMS yuborish")} aria-label={t("{name} — SMS", { name: p.name })} className={`${secondaryIcon} size-8! h-8! disabled:opacity-40`}>
                        <MessageSquare className="size-4" strokeWidth={1.75} />
                      </button>
                      <ActionMenu items={rowMenu(p)} label={t("{name} — amallar", { name: p.name })}>
                        {(trigger) => (
                          <button type="button" {...trigger} aria-label={t("{name} — amallar", { name: p.name })} className="inline-flex size-8 items-center justify-center rounded-v2-md text-v2-text-2 hover:bg-v2-surface-2 hover:text-v2-text">
                            <MoreHorizontal className="size-4" strokeWidth={1.75} />
                          </button>
                        )}
                      </ActionMenu>
                    </div>
                  </td>
                </tr>
              );
            })}
        </tbody>
      </TableCard>

      {inviteFor && (
        <BulkSmsDialogV2
          title={t("Kabinetga taklif")}
          subtitle={botLink ? t("{n} ta ota-onaga — o'quvchilar boti havolasi bilan", { n: inviteFor.length }) : t("O'quvchilar boti sozlanmagan — havolani matnga o'zingiz yozing")}
          recipients={recipientsOf(inviteFor)}
          defaultText={t("Assalomu alaykum! {name}ning darslari, davomati va to'lovlarini Telegram kabinetda kuzating: {link}")}
          submitLabel={(n) => t("Taklif yuborish · {n} SMS", { n })}
          onClose={() => setInviteFor(null)}
          onDone={async (keys, simulated) => {
            await markInvited(keys);
            if (simulated) showError(t("SMS jo'natilmadi: Eskiz sozlanmagan (jurnalga yozildi)"));
            else showSuccess(t("{n} ta ota-onaga taklif yuborildi", { n: keys.length }));
            setSelected(new Set());
            void reload();
          }}
        />
      )}
      {smsFor && (
        <BulkSmsDialogV2
          title={t("SMS yuborish")}
          subtitle={smsFor[0]?.name ?? ""}
          recipients={recipientsOf(smsFor)}
          defaultText=""
          submitLabel={() => t("Yuborish")}
          onClose={() => setSmsFor(null)}
          onDone={(_keys, simulated) => {
            if (simulated) showError(t("SMS jo'natilmadi: Eskiz sozlanmagan (jurnalga yozildi)"));
            else showSuccess(t("SMS yuborildi"));
          }}
        />
      )}
    </PageShell>
  );
}
