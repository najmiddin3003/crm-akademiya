"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Download, MoreHorizontal, Pencil, Plus, Trash2, Wrench, CheckCircle2 } from "lucide-react";
import { useT } from "@/components/shared/Language";
import { useBranch } from "@/components/shared/BranchContext";
import { useToast } from "@/components/ui/Toast";
import V2Confirm from "@/components/v2/form/V2Confirm";
import { IsoDateField } from "@/components/v2/students/lists/listKit";
import V2Dialog from "@/components/v2/form/V2Dialog";
import { Field, Segmented, TextInput } from "@/components/v2/form/fields";
import ActionMenu, { type ActionMenuEntry } from "@/components/v2/ui/ActionMenu";
import V2Select from "@/components/v2/ui/V2Select";
import { primaryBtn, secondaryBtn } from "@/components/v2/ui/buttons";
import { ROW_TINT } from "@/components/v2/ui/table";
import { EQUIPMENT_CATEGORIES, type Equipment, type EquipmentStatus } from "@/lib/equipment";
import type { Room } from "@/lib/rooms";
import { daysBetween } from "@/lib/studentListsTypes";
import {
  Badge,
  EmptyRow,
  PageHead,
  PageShell,
  SegmentPills,
  SimplePager,
  SkeletonRows,
  TableCard,
  TH,
  dayMonth,
  dmy,
  downloadCsv,
  fmtNum,
  todayIso,
} from "@/components/v2/students/lists/listKit";

// YANGI VERSIYA — GURUH → JIHOZLAR (31-qism, rasm «Jihozlar», yorug'/qorong'i).
//
// Tepada 4 ko'rsatkich (jami dona · nomlar, umumiy qiymat, ta'mirda, kafolati 30 kunda tugaydi),
// xonalar bo'yicha tabletkalar, o'ngda Turi / Holati; jadval: jihoz (inventar kodi · turi), xona(lar),
// soni, holati (+ izoh, qachondan), qiymati (dona × soni), olingan (sana + manba), mas'ul.
// Yangi maydonlar (turi, xonalar, soni, holat, kafolat, mas'ul, filial) — lib/equipment.ts, eski
// yozuvlarda bo'sh. Rasmdagi «kassadagi chiqimdan bir bosishda» va «1-sentabr inventarizatsiya
// eslatmasi» tizimda yo'q (SAVOLLAR 422). Eski sahifa — `?classic=1`.

const STATUS: Record<EquipmentStatus, { label: string; tone: "success" | "warning" | "danger" }> = {
  ok: { label: "Ishlayapti", tone: "success" },
  repair: { label: "Ta'mirda", tone: "warning" },
  broken: { label: "Ishlamaydi", tone: "danger" },
};
const EXTRA_PLACES = ["Qabulxona", "Koridor"];

const qtyOf = (e: Equipment) => Math.max(1, Number(e.quantity) || 1);
const statusOf = (e: Equipment): EquipmentStatus => e.status ?? "ok";
const placeLabel = (p: string) => (/^\d+$/.test(p) ? `${p}-xona` : p);

function useEquipment() {
  const [items, setItems] = useState<Equipment[]>([]);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [loading, setLoading] = useState(true);
  const load = useCallback(async () => {
    const [e, r] = await Promise.all([
      fetch("/api/equipment?scoped=1", { cache: "no-store" }).then((x) => x.json()).catch(() => null),
      fetch("/api/rooms", { cache: "no-store" }).then((x) => x.json()).catch(() => null),
    ]);
    return { e, r };
  }, []);
  const apply = useCallback((res: { e: { ok?: boolean; equipment?: Equipment[] } | null; r: { ok?: boolean; rooms?: Room[] } | null }) => {
    if (res.e?.ok) setItems(res.e.equipment ?? []);
    if (res.r?.ok) setRooms(res.r.rooms ?? []);
    setLoading(false);
  }, []);
  const reload = useCallback(() => load().then(apply), [load, apply]);
  useEffect(() => {
    load().then(apply);
  }, [load, apply]);
  return { items, rooms, loading, reload };
}

export default function EquipmentV2() {
  const { t } = useT();
  const branch = useBranch();
  const { showSuccess, showError } = useToast();
  const { items, rooms, loading, reload } = useEquipment();
  const today = todayIso();

  const [place, setPlace] = useState("all");
  const [category, setCategory] = useState("");
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [edit, setEdit] = useState<Equipment | "new" | null>(null);
  const [delFor, setDelFor] = useState<Equipment | null>(null);

  const places = useMemo(() => {
    const m = new Map<string, number>();
    for (const e of items) for (const p of e.rooms ?? []) m.set(p, (m.get(p) ?? 0) + 1);
    return [...m.entries()].sort((a, b) => a[0].localeCompare(b[0], "uz", { numeric: true }));
  }, [items]);
  const filtered = useMemo(
    () =>
      items.filter(
        (e) =>
          (place === "all" || (e.rooms ?? []).includes(place)) &&
          (!category || (e.category ?? "") === category) &&
          (!status || statusOf(e) === status),
      ),
    [items, place, category, status],
  );

  const totalQty = items.reduce((s, e) => s + qtyOf(e), 0);
  const totalValue = items.reduce((s, e) => s + (Number(e.price) || 0) * qtyOf(e), 0);
  const inRepair = items.filter((e) => statusOf(e) === "repair").length;
  const warrantySoon = items.filter((e) => e.warrantyUntil && e.warrantyUntil >= today && daysBetween(today, e.warrantyUntil) <= 30).length;
  const slice = filtered.slice((page - 1) * pageSize, page * pageSize);
  const branchName = branch.branches.find((b) => b.id === branch.branchId)?.name ?? "";
  const COLS = 8;

  async function patch(e: Equipment, body: Record<string, unknown>, okMsg: string) {
    const res = await fetch(`/api/equipment/${e.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) })
      .then((r) => r.json())
      .catch(() => null);
    if (!res?.ok) {
      showError(t(res?.error || "Saqlab bo'lmadi"));
      return;
    }
    showSuccess(okMsg);
    void reload();
  }

  async function remove(e: Equipment) {
    const res = await fetch(`/api/equipment/${e.id}`, { method: "DELETE" })
      .then((r) => r.json())
      .catch(() => null);
    setDelFor(null);
    if (!res?.ok) {
      showError(t(res?.error || "O'chirib bo'lmadi"));
      return;
    }
    showSuccess(t("Jihoz o'chirildi"));
    void reload();
  }

  function rowMenu(e: Equipment): ActionMenuEntry[] {
    const st = statusOf(e);
    return [
      { key: "h", heading: e.name },
      { key: "edit", label: t("Tahrirlash"), icon: Pencil, onSelect: () => setEdit(e) },
      st === "ok"
        ? { key: "rep", label: t("Ta'mirga berish"), icon: Wrench, onSelect: () => void patch(e, { status: "repair", statusSince: today }, t("Ta'mirda deb belgilandi")) }
        : { key: "fix", label: t("Ishlayapti deb belgilash"), icon: CheckCircle2, onSelect: () => void patch(e, { status: "ok", statusNote: "", statusSince: today }, t("Ishlayapti deb belgilandi")) },
      { key: "d", divider: true },
      { key: "del", label: t("O'chirish"), icon: Trash2, danger: true, onSelect: () => setDelFor(e) },
    ];
  }

  function exportCsv() {
    downloadCsv(
      "jihozlar.csv",
      ["Inventar kodi", "Jihoz", "Turi", "Xona", "Soni", "Holati", "Izoh", "Narxi (dona)", "Qiymati", "Olingan", "Manba", "Mas'ul", "Kafolat"],
      filtered.map((e) => [
        e.inventoryCode,
        e.name,
        e.category ?? "",
        (e.rooms ?? []).map(placeLabel).join(", "),
        qtyOf(e),
        STATUS[statusOf(e)].label,
        e.statusNote ?? "",
        e.price,
        (Number(e.price) || 0) * qtyOf(e),
        e.acquiredAt ?? "",
        e.source ?? "",
        e.responsible ?? "",
        e.warrantyUntil ?? "",
      ]),
    );
  }

  const kpi = "flex flex-col gap-1 px-4 py-3";

  return (
    <PageShell>
      <PageHead
        title={t("Jihozlar")}
        subtitle={[branchName, t("xonalardagi texnika, mebel va o'quv qurollari")].filter(Boolean).join(" · ")}
        actions={
          <>
            <button type="button" onClick={exportCsv} className={secondaryBtn}>
              <Download className="size-4" strokeWidth={1.75} aria-hidden />
              {t("Export")}
            </button>
            <button type="button" onClick={() => setEdit("new")} className={primaryBtn}>
              <Plus className="size-4" strokeWidth={2} aria-hidden />
              {t("Jihoz qo'shish")}
            </button>
          </>
        }
      />

      <div className="grid grid-cols-2 divide-v2-border overflow-hidden rounded-v2-lg border border-v2-border bg-v2-surface shadow-v2-sm lg:grid-cols-4 lg:divide-x">
        <div className={kpi}>
          <span className="text-v2-small text-v2-text-2">{t("Jami jihoz")}</span>
          <span className="text-v2-number tabular-nums text-v2-text">
            {fmtNum(totalQty)} <span className="text-v2-body font-normal text-v2-text-2">{t("dona")} · {t("{n} nom", { n: items.length })}</span>
          </span>
        </div>
        <div className={kpi}>
          <span className="text-v2-small text-v2-text-2">{t("Umumiy qiymati")}</span>
          <span className="text-v2-number tabular-nums text-v2-text">
            {fmtNum(totalValue)} <span className="text-v2-body font-normal text-v2-text-2">{t("so'm")}</span>
          </span>
        </div>
        <div className={kpi}>
          <span className="text-v2-small text-v2-text-2">{t("Ta'mirda")}</span>
          <span className={`text-v2-number tabular-nums ${inRepair ? "text-v2-warning" : "text-v2-text"}`}>{inRepair}</span>
        </div>
        <div className={kpi}>
          <span className="text-v2-small text-v2-text-2">{t("Kafolati 30 kunda tugaydi")}</span>
          <span className="text-v2-number tabular-nums text-v2-text">{warrantySoon}</span>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <SegmentPills
          value={place}
          onChange={(k) => { setPlace(k); setPage(1); }}
          items={[{ key: "all", label: t("Hammasi"), count: items.length }, ...places.map(([p, n]) => ({ key: p, label: t(p), count: n }))]}
        />
        <div className="ml-auto flex items-center gap-2">
          <V2Select variant="chip" label={t("Turi")} value={category} onChange={(v) => { setCategory(v); setPage(1); }} searchable={false} options={EQUIPMENT_CATEGORIES.map((c) => ({ value: c, label: t(c) }))} />
          <V2Select
            variant="chip"
            label={t("Holati")}
            value={status}
            onChange={(v) => { setStatus(v); setPage(1); }}
            searchable={false}
            options={(Object.keys(STATUS) as EquipmentStatus[]).map((k) => ({ value: k, label: t(STATUS[k].label) }))}
          />
        </div>
      </div>

      <TableCard footer={<SimplePager total={filtered.length} page={page} pageSize={pageSize} onPage={setPage} onPageSize={(n) => { setPageSize(n); setPage(1); }} />}>
        <thead>
          <tr>
            <th className={`${TH} pl-4`}>{t("Jihoz")}</th>
            <th className={TH}>{t("Xona")}</th>
            <th className={`${TH} text-right`}>{t("Soni")}</th>
            <th className={TH}>{t("Holati")}</th>
            <th className={`${TH} text-right`}>{t("Qiymati")}</th>
            <th className={TH}>{t("Olingan")}</th>
            <th className={TH}>{t("Mas'ul")}</th>
            <th className={`${TH} w-px`}><span className="sr-only">{t("Amallar")}</span></th>
          </tr>
        </thead>
        <tbody>
          {loading && <SkeletonRows cols={COLS} />}
          {!loading && slice.length === 0 && (
            <EmptyRow
              cols={COLS}
              title={items.length === 0 ? t("Hozircha jihoz yo'q") : t("Mos jihoz topilmadi")}
              hint={items.length === 0 ? t("Xonalardagi texnika va mebelni qo'shing — qiymati va holati shu yerda kuzatiladi.") : t("Xona, turi yoki holatni o'zgartirib ko'ring.")}
              action={
                items.length === 0 ? (
                  <button type="button" onClick={() => setEdit("new")} className={`${primaryBtn} mt-2`}>
                    <Plus className="size-4" strokeWidth={2} aria-hidden />
                    {t("Jihoz qo'shish")}
                  </button>
                ) : undefined
              }
            />
          )}
          {!loading &&
            slice.map((e) => {
              const st = STATUS[statusOf(e)];
              const qty = qtyOf(e);
              const price = Number(e.price) || 0;
              const placesOf = e.rooms ?? [];
              const warrantyNote = e.warrantyUntil && e.warrantyUntil >= today && daysBetween(today, e.warrantyUntil) <= 30 ? t("kafolat {date}da tugaydi", { date: dayMonth(e.warrantyUntil) }) : "";
              const statusNote = [e.statusNote, statusOf(e) !== "ok" && e.statusSince ? t("{date}dan", { date: dayMonth(e.statusSince) }) : ""].filter(Boolean).join(" · ");
              return (
                <tr key={e.id} className={`group border-b border-v2-border last:border-b-0 ${ROW_TINT.hover}`}>
                  <td className="py-2.5 pl-4 pr-2.5">
                    <span className="block font-semibold text-v2-text">{e.name}</span>
                    <span className="block text-v2-small text-v2-text-3">{[e.inventoryCode, e.category ? t(e.category) : ""].filter(Boolean).join(" · ")}</span>
                  </td>
                  <td className="px-2.5 py-2.5 text-v2-text">
                    {placesOf.length === 0 ? <span className="text-v2-text-3">—</span> : placesOf.length > 3 ? t("{n} ta xonada", { n: placesOf.length }) : placesOf.map(placeLabel).join(", ")}
                  </td>
                  <td className="px-2.5 py-2.5 text-right font-semibold tabular-nums text-v2-text">{qty}</td>
                  <td className="px-2.5 py-2.5">
                    <Badge tone={st.tone}>{t(st.label)}</Badge>
                    {(statusNote || warrantyNote) && <span className="mt-0.5 block text-v2-small text-v2-text-3">{statusNote || warrantyNote}</span>}
                  </td>
                  <td className="px-2.5 py-2.5 text-right whitespace-nowrap tabular-nums">
                    <span className="block font-semibold text-v2-text">{price ? fmtNum(price * qty) : "—"}</span>
                    {price > 0 && qty > 1 && <span className="block text-v2-small text-v2-text-3">{fmtNum(price)} × {qty}</span>}
                  </td>
                  <td className="px-2.5 py-2.5 whitespace-nowrap">
                    <span className="block tabular-nums text-v2-text">{dmy(e.acquiredAt) || (e.createdAt || "").split("|")[0].trim() || "—"}</span>
                    {e.source && <span className="block text-v2-small text-v2-text-3">{e.source}</span>}
                  </td>
                  <td className="px-2.5 py-2.5 text-v2-text">{e.responsible || <span className="text-v2-text-3">—</span>}</td>
                  <td className="py-2.5 pl-1 pr-3 text-right">
                    <ActionMenu items={rowMenu(e)} label={t("{name} — amallar", { name: e.name })}>
                      {(trigger) => (
                        <button type="button" {...trigger} aria-label={t("{name} — amallar", { name: e.name })} className="inline-flex size-8 items-center justify-center rounded-v2-md text-v2-text-2 hover:bg-v2-surface-2 hover:text-v2-text">
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

      {edit && <EquipmentDialogV2 item={edit === "new" ? null : edit} rooms={rooms} onClose={() => setEdit(null)} onSaved={() => void reload()} />}
      {delFor && (
        <V2Confirm
          title={t("Jihoz o'chirilsinmi?")}
          body={t("«{name}» ro'yxatdan butunlay o'chiriladi.", { name: delFor.name })}
          confirmLabel={t("O'chirish")}
          cancelLabel={t("Bekor qilish")}
          onCancel={() => setDelFor(null)}
          onConfirm={() => void remove(delFor)}
        />
      )}
    </PageShell>
  );
}

/** «Jihoz qo'shish» / tahrirlash — o'ngdan panel (rasm yo'q, «Formalar» qoidasi). */
function EquipmentDialogV2({ item, rooms, onClose, onSaved }: { item: Equipment | null; rooms: Room[]; onClose: () => void; onSaved: () => void }) {
  const { t } = useT();
  const { showError, showSuccess } = useToast();
  const [name, setName] = useState(item?.name ?? "");
  const [category, setCategory] = useState(item?.category || "Texnika");
  const [code, setCode] = useState(item?.inventoryCode ?? "");
  const [qty, setQty] = useState(String(item ? qtyOf(item) : 1));
  const [price, setPrice] = useState(item?.price ? String(item.price) : "");
  const [places, setPlaces] = useState<string[]>(item?.rooms ?? []);
  const [status, setStatus] = useState<EquipmentStatus>(item ? statusOf(item) : "ok");
  const [note, setNote] = useState(item?.statusNote ?? "");
  const [acquiredAt, setAcquiredAt] = useState(item?.acquiredAt ?? todayIso());
  const [source, setSource] = useState(item?.source ?? "kassa chiqimi");
  const [responsible, setResponsible] = useState(item?.responsible ?? "");
  const [warranty, setWarranty] = useState(item?.warrantyUntil ?? "");
  const [saving, setSaving] = useState(false);
  const options = [...new Set([...rooms.map((r) => r.name.replace(/\s*-?\s*xona$/i, "").trim()), ...EXTRA_PLACES, ...places])].filter(Boolean);

  async function save(close: () => void) {
    if (!name.trim()) {
      showError(t("Jihoz nomini kiriting"));
      return;
    }
    setSaving(true);
    const body = {
      name: name.trim(),
      inventoryCode: code.trim(),
      price: Number(price.replace(/\D/g, "")) || 0,
      category,
      quantity: Number(qty) || 1,
      rooms: places,
      status,
      statusNote: status === "ok" ? "" : note.trim(),
      statusSince: item && statusOf(item) === status ? (item.statusSince ?? "") : status === "ok" ? "" : todayIso(),
      acquiredAt,
      source: source.trim(),
      responsible: responsible.trim(),
      warrantyUntil: warranty,
    };
    const res = await fetch(item ? `/api/equipment/${item.id}` : "/api/equipment", {
      method: item ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    })
      .then((r) => r.json())
      .catch(() => null);
    setSaving(false);
    if (!res?.ok) {
      showError(t(res?.error || "Saqlab bo'lmadi"));
      return;
    }
    showSuccess(item ? t("Jihoz saqlandi") : t("Jihoz qo'shildi"));
    onSaved();
    close();
  }

  return (
    <V2Dialog
      variant="right"
      title={item ? t("Jihozni tahrirlash") : t("Jihoz qo'shish")}
      subtitle={item ? item.inventoryCode : t("Inventar kodi bo'sh qoldirilsa o'zi beriladi")}
      onClose={onClose}
      saving={saving}
      dirty={!item ? Boolean(name) : name !== item.name}
      footer={(api) => (
        <>
          <button type="button" onClick={api.requestClose} disabled={saving} className={secondaryBtn}>{t("Bekor qilish")}</button>
          <button type="button" onClick={() => void save(api.close)} disabled={saving} className={`${primaryBtn} disabled:opacity-50`}>{t("Saqlash")}</button>
        </>
      )}
    >
      <div className="space-y-4">
        <Field label={t("Jihoz nomi")} htmlFor="eq-name">
          <TextInput id="eq-name" value={name} onChange={(e) => setName(e.target.value)} placeholder={t("Masalan: Proyektor")} />
        </Field>
        <Field label={t("Turi")}>
          <Segmented label={t("Turi")} value={category} onChange={setCategory} options={EQUIPMENT_CATEGORIES.map((c) => ({ value: c, label: t(c) }))} />
        </Field>
        <div className="grid grid-cols-[1fr_96px_1fr] gap-3">
          <Field label={t("Inventar kodi")} optional htmlFor="eq-code">
            <TextInput id="eq-code" value={code} onChange={(e) => setCode(e.target.value)} placeholder="INV-…" />
          </Field>
          <Field label={t("Soni")} htmlFor="eq-qty">
            <TextInput id="eq-qty" inputMode="numeric" value={qty} onChange={(e) => setQty(e.target.value.replace(/\D/g, ""))} />
          </Field>
          <Field label={t("Narxi (dona)")} htmlFor="eq-price">
            <TextInput id="eq-price" inputMode="numeric" value={price ? fmtNum(Number(price.replace(/\D/g, ""))) : ""} onChange={(e) => setPrice(e.target.value.replace(/\D/g, ""))} placeholder="0" />
          </Field>
        </div>
        <Field label={t("Qayerda")} hint={t("Bir nechtasini tanlash mumkin")}>
          <div className="flex flex-wrap gap-2">
            {options.map((p) => {
              const on = places.includes(p);
              return (
                <button
                  key={p}
                  type="button"
                  aria-pressed={on}
                  onClick={() => setPlaces((cur) => (on ? cur.filter((x) => x !== p) : [...cur, p]))}
                  className={`h-8 rounded-v2-md border px-3 text-v2-small transition-colors ${on ? "border-v2-brand bg-v2-brand-bg font-semibold text-v2-brand-text" : "border-v2-border-strong bg-v2-surface text-v2-text hover:bg-v2-surface-2"}`}
                >
                  {placeLabel(p)}
                </button>
              );
            })}
          </div>
        </Field>
        <Field label={t("Holati")}>
          <Segmented
            label={t("Holati")}
            value={status}
            onChange={(v) => setStatus(v as EquipmentStatus)}
            options={(Object.keys(STATUS) as EquipmentStatus[]).map((k) => ({ value: k, label: t(STATUS[k].label) }))}
          />
        </Field>
        {status !== "ok" && (
          <Field label={t("Nima bo'ldi")} optional htmlFor="eq-note">
            <TextInput id="eq-note" value={note} onChange={(e) => setNote(e.target.value)} placeholder={t("Masalan: lampa")} />
          </Field>
        )}
        <div className="grid grid-cols-2 gap-3">
          <Field label={t("Olingan sana")} htmlFor="eq-date">
            <IsoDateField id="eq-date" value={acquiredAt} onChange={setAcquiredAt} />
          </Field>
          <Field label={t("Kafolat tugaydi")} optional htmlFor="eq-warranty">
            <IsoDateField id="eq-warranty" value={warranty} onChange={setWarranty} />
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label={t("Qayerdan")} optional htmlFor="eq-source">
            <TextInput id="eq-source" value={source} onChange={(e) => setSource(e.target.value)} />
          </Field>
          <Field label={t("Mas'ul")} optional htmlFor="eq-resp">
            <TextInput id="eq-resp" value={responsible} onChange={(e) => setResponsible(e.target.value)} placeholder={t("Xodim ismi")} />
          </Field>
        </div>
      </div>
    </V2Dialog>
  );
}
